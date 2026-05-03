import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { loadAllCodex } from "./loader.ts";
import { WorldManifestSchema } from "../world-manifest-schema.ts";

const WORLD_DATA_DIR = new URL("../../world-data/", import.meta.url);
const CODEX_DIR = new URL("../../world-data/codex/", import.meta.url);
const EXPECTED_WORLD_DATA_SCHEMA = "2.0.0";

const DOCUMENTED_NARRATIVE_STATE_KEYS = new Set([
  "act3_confrontation",
]);

function readYaml(relativePath: string): unknown {
  return parseYaml(readFileSync(new URL(relativePath, WORLD_DATA_DIR), "utf8"));
}

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(new URL(relativePath, WORLD_DATA_DIR), "utf8"));
}

type RawEntry = { [key: string]: unknown };
type RawQuest = RawEntry & {
  id: string;
  type: "quest";
  stages?: { id: string }[];
  world_effects?: {
    on_stage_enter?: { [stageId: string]: WorldEffectStage };
  };
  world_effects_none?: boolean;
};
type WorldEffectStage = {
  facts_created?: (string | WorldEffectSeed)[];
  rumors_created?: (string | WorldEffectSeed)[];
  beliefs_created?: WorldEffectSeed[];
};
type WorldEffectSeed = {
  id?: string;
  tags?: string[];
  statement?: string;
  truth_status?: string;
};
type NarrativeTransition = {
  on_stage: string;
  set_world_flags?: { [flag: string]: boolean };
};
type NarrativeTransitions = {
  transitions: NarrativeTransition[];
};

function collectPlayerFacingValues(value: unknown, path: string[] = []): { path: string; value: string }[] {
  if (typeof value === "string") {
    return [{ path: path.join("."), value }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectPlayerFacingValues(item, [...path, String(index)]));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => collectPlayerFacingValues(child, [...path, key]));
  }
  return [];
}

function questEntries(entries: RawEntry[]): RawQuest[] {
  return entries.filter((entry): entry is RawQuest => entry.type === "quest");
}

function stageEffectSeeds(stageEffects: WorldEffectStage | undefined): WorldEffectSeed[] {
  if (!stageEffects) return [];
  return [
    ...(stageEffects.facts_created ?? []),
    ...(stageEffects.rumors_created ?? []),
    ...(stageEffects.beliefs_created ?? []),
  ].filter((seed): seed is WorldEffectSeed => typeof seed === "object" && seed !== null);
}

function seedMentionsFlag(seed: WorldEffectSeed, flag: string): boolean {
  return seed.id === flag
    || seed.id?.includes(flag) === true
    || seed.tags?.includes(`flag:${flag}`) === true;
}

const RUNTIME_PLAYER_FACING_KEYS = new Set([
  "affordance",
  "description",
  "first_visit",
  "guardPromptHint",
  "label",
  "name",
  "player_facing_override",
  "revisit",
  "short_label",
  "visible_name",
]);

const RUNTIME_PLAYER_FACING_CONTAINERS = new Set([
  "description_overrides",
  "player_facing",
]);

function collectRuntimePlayerFacingStrings(
  value: unknown,
  path: string[] = [],
  withinPlayerFacingContainer = false,
): { path: string; value: string }[] {
  if (typeof value === "string") {
    return withinPlayerFacingContainer ? [{ path: path.join("."), value }] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectRuntimePlayerFacingStrings(item, [...path, String(index)], withinPlayerFacingContainer));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => {
      const childIsPlayerFacing = withinPlayerFacingContainer
        || RUNTIME_PLAYER_FACING_CONTAINERS.has(key)
        || RUNTIME_PLAYER_FACING_KEYS.has(key);
      return collectRuntimePlayerFacingStrings(child, [...path, key], childIsPlayerFacing);
    });
  }
  return [];
}

function collectRuntimePlayerFacingValues(entry: RawEntry, file: string): { path: string; value: string }[] {
  return collectRuntimePlayerFacingStrings(entry, [file, String(entry.id)]);
}

function collectRuntimePlayerFacingValuesFromYaml(value: unknown, file: string): { path: string; value: string }[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => {
      const id = entry && typeof entry === "object" && "id" in entry ? String((entry as RawEntry).id) : String(index);
      return collectRuntimePlayerFacingStrings(entry, [file, id]);
    });
  }
  return collectRuntimePlayerFacingStrings(value, [file]);
}

type NarrativeWorldFlagAuditResult = {
  missingFlagEffects: string[];
  falseContradictions: string[];
};

function seedAssertsFlagActive(seed: WorldEffectSeed): boolean {
  return seed.truth_status === "active"
    || seed.truth_status === "confirmed"
    || seed.truth_status === "true";
}

function auditNarrativeWorldFlagConsistency(
  mainQuest: RawQuest,
  transitions: NarrativeTransition[],
): NarrativeWorldFlagAuditResult {
  const missingFlagEffects = transitions.flatMap((transition) => {
    const stageEffects = mainQuest.world_effects?.on_stage_enter?.[transition.on_stage];
    const seeds = stageEffectSeeds(stageEffects);
    return Object.entries(transition.set_world_flags ?? {})
      .filter(([, value]) => value === true)
      .filter(([flag]) => !seeds.some((seed) => seedMentionsFlag(seed, flag)))
      .map(([flag]) => `${transition.on_stage}.${flag}`);
  });

  const falseContradictions = transitions.flatMap((transition) => {
    const stageEffects = mainQuest.world_effects?.on_stage_enter?.[transition.on_stage];
    const seeds = stageEffectSeeds(stageEffects);
    return Object.entries(transition.set_world_flags ?? {})
      .flatMap(([flag, flagEnabled]) => seeds
        .filter((seed) => seedMentionsFlag(seed, flag))
        .filter((seed) => flagEnabled === true ? seed.truth_status === "false" : seedAssertsFlagActive(seed))
        .map((seed) => `${transition.on_stage}.${flag}.${seed.id ?? "unnamed_seed"}`)
      );
  });

  return { missingFlagEffects, falseContradictions };
}

describe("world-data authoring v2 audit helper guards", () => {
  it("scans runtime-visible labels and descriptions outside player_facing for AI-only markers", () => {
    const entry: RawEntry = {
      id: "quest_test",
      name: "TODO public quest title",
      description: "Public description with INTERNAL marker",
      player_facing: { short_label: "Visible short label" },
      description_overrides: {
        flag_active: "DO NOT SHOW location override",
      },
      stages: [
        {
          id: "stage_test",
          description: "FIXME public stage description",
          objectives: [
            { id: "obj_test", description: "SYSTEM_PROMPT objective text" },
          ],
        },
      ],
      options: [
        { id: "option_test", label: "AI_ONLY option label", description: "Visible option description" },
      ],
      ai_grounding: {
        must_not_invent: ["MUST_NOT_INVENT is allowed in non-player-facing grounding"],
      },
    };

    expect(collectRuntimePlayerFacingValues(entry, "quests.yaml").map(({ path }) => path).sort()).toEqual([
      "quests.yaml.quest_test.description",
      "quests.yaml.quest_test.description_overrides.flag_active",
      "quests.yaml.quest_test.name",
      "quests.yaml.quest_test.options.0.description",
      "quests.yaml.quest_test.options.0.label",
      "quests.yaml.quest_test.player_facing.short_label",
      "quests.yaml.quest_test.stages.0.description",
      "quests.yaml.quest_test.stages.0.objectives.0.description",
    ]);
  });

  it("flags stage world-effect seeds that assert flags disabled by narrative transitions", () => {
    const mainQuest: RawQuest = {
      id: "quest_main_01",
      type: "quest",
      world_effects: {
        on_stage_enter: {
          stage_disabled: {
            facts_created: [
              {
                id: "fact_disabled_flag_confirmed",
                tags: ["flag:ritual_site_active"],
                truth_status: "confirmed",
              },
            ],
          },
        },
      },
    };
    const transitions: NarrativeTransition[] = [
      { on_stage: "stage_disabled", set_world_flags: { ritual_site_active: false } },
    ];

    expect(auditNarrativeWorldFlagConsistency(mainQuest, transitions)).toEqual({
      missingFlagEffects: [],
      falseContradictions: ["stage_disabled.ritual_site_active.fact_disabled_flag_confirmed"],
    });
  });
});

describe("world-data authoring v2 audit", () => {
  it("gives every location object a player-facing affordance or codex display fallback", async () => {
    const codex = await loadAllCodex(CODEX_DIR.pathname);
    const locations = [...codex.values()].filter((entry) => entry.type === "location");
    const missing: string[] = [];

    for (const location of locations) {
      const interactables = new Map(
        (location.player_facing?.interactables ?? []).map((interactable) => [interactable.id, interactable])
      );

      for (const objectId of location.objects) {
        const affordance = interactables.get(objectId)?.affordance;
        const fallback = codex.get(objectId)?.player_facing?.short_label ?? codex.get(objectId)?.name;
        if (!affordance && !fallback) {
          missing.push(`${location.id}.objects.${objectId}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("gives every migrated NPC voice and knowledge_profile metadata", async () => {
    const codex = await loadAllCodex(CODEX_DIR.pathname);
    const missing = [...codex.values()]
      .filter((entry) => entry.type === "npc")
      .flatMap((npc) => {
        const missingFields: string[] = [];
        if (!npc.voice || Object.keys(npc.voice).length === 0) missingFields.push("voice");
        if (!npc.knowledge_profile || Object.keys(npc.knowledge_profile).length === 0) missingFields.push("knowledge_profile");
        return missingFields.map((field) => `${npc.id}.${field}`);
      });

    expect(missing).toEqual([]);
  });

  it("documents world effects or an explicit no-effects marker for every quest stage", () => {
    const quests = questEntries(readYaml("codex/quests.yaml") as RawEntry[]);
    const missing = quests.flatMap((quest) => {
      if (quest.world_effects_none === true) return [];
      return (quest.stages ?? [])
        .filter((stage) => !quest.world_effects?.on_stage_enter?.[stage.id])
        .map((stage) => `${quest.id}.${stage.id}`);
    });

    expect(missing).toEqual([]);
  });

  it("keeps obvious AI-only markers out of player-facing fields", () => {
    const codexFiles = [
      "backgrounds.yaml",
      "enemies.yaml",
      "factions.yaml",
      "history_events.yaml",
      "items.yaml",
      "locations.yaml",
      "npcs.yaml",
      "professions.yaml",
      "quests.yaml",
      "races.yaml",
      "spells.yaml",
      "guard-dialogue.yaml",
    ];
    const marker = /\b(AI_ONLY|AI-ONLY|INTERNAL|DO NOT SHOW|SYSTEM_PROMPT|HIDDEN_KNOWLEDGE|MUST_NOT_INVENT|REVEAL_POLICY|CHAIN_OF_THOUGHT|DEVELOPER_NOTE|TODO|FIXME)\b/i;
    const leaks = codexFiles.flatMap((file) =>
      collectRuntimePlayerFacingValuesFromYaml(readYaml(`codex/${file}`), file)
        .filter(({ value }) => marker.test(value))
        .map(({ path, value }) => `${path}: ${value}`)
    );

    expect(leaks).toEqual([]);
  });

  it("keeps narrative transition stage IDs aligned with main quest stage IDs", () => {
    const quests = questEntries(readYaml("codex/quests.yaml") as RawEntry[]);
    const mainQuest = quests.find((quest) => quest.id === "quest_main_01");
    const transitions = (readYaml("narrative-transitions.yaml") as NarrativeTransitions).transitions;

    expect(transitions.map((transition) => transition.on_stage).sort()).toEqual(
      (mainQuest?.stages ?? []).map((stage) => stage.id).sort()
    );
  });

  it("keeps narrative transition world flags consistent with quest world effects", () => {
    const quests = questEntries(readYaml("codex/quests.yaml") as RawEntry[]);
    const mainQuest = quests.find((quest) => quest.id === "quest_main_01");
    if (!mainQuest) throw new Error("quest_main_01 is required for narrative transition audit");
    const transitions = (readYaml("narrative-transitions.yaml") as NarrativeTransitions).transitions;

    expect(auditNarrativeWorldFlagConsistency(mainQuest, transitions)).toEqual({
      missingFlagEffects: [],
      falseContradictions: [],
    });
  });

  it("uses only valid narrative/world flag keys in location state overrides", () => {
    const transitions = (readYaml("narrative-transitions.yaml") as NarrativeTransitions).transitions;
    const worldFlagKeys = new Set(transitions.flatMap((transition) => Object.keys(transition.set_world_flags ?? {})));
    const locations = (readYaml("codex/locations.yaml") as RawEntry[]).filter((entry) => entry.type === "location");
    const invalidKeys = locations.flatMap((location) => {
      const stateOverrides = (location.location_context as { state_overrides?: { [key: string]: unknown } } | undefined)?.state_overrides ?? {};
      return Object.keys(stateOverrides)
        .filter((key) => !worldFlagKeys.has(key) && !DOCUMENTED_NARRATIVE_STATE_KEYS.has(key))
        .map((key) => `${location.id}.location_context.state_overrides.${key}`);
    });

    expect(invalidKeys).toEqual([]);
  });

  it("declares the expected worldDataSchema version in world-manifest.json", () => {
    const manifest = readJson("world-manifest.json") as { [key: string]: unknown };

    expect(manifest.worldDataSchema).toBe(EXPECTED_WORLD_DATA_SCHEMA);
    expect(WorldManifestSchema.parse(manifest).worldDataSchema).toBe(EXPECTED_WORLD_DATA_SCHEMA);
  });
});
