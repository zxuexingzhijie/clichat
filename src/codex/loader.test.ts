import { describe, it, expect, beforeAll } from "bun:test";
import { loadCodexFile, loadAllCodex } from "./loader.ts";
import { queryByType, queryByTag, queryById, queryRelationships } from "./query.ts";
import type { CodexEntry } from "./schemas/entry-types.ts";
import type { RelationshipEdge } from "./schemas/relationship.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "path";

const CODEX_DIR = resolve(import.meta.dir, "../../world-data/codex");

describe("loadCodexFile", () => {
  it("loads and validates locations.yaml", async () => {
    const entries = await loadCodexFile(resolve(CODEX_DIR, "locations.yaml"));
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of entries) {
      expect(entry.type).toBe("location");
    }
  });

  it("loads and validates races.yaml", async () => {
    const entries = await loadCodexFile(resolve(CODEX_DIR, "races.yaml"));
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of entries) {
      expect(entry.type).toBe("race");
    }
  });

  it("loads and validates professions.yaml", async () => {
    const entries = await loadCodexFile(resolve(CODEX_DIR, "professions.yaml"));
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of entries) {
      expect(entry.type).toBe("profession");
    }
  });

  it("loads and validates factions.yaml", async () => {
    const entries = await loadCodexFile(resolve(CODEX_DIR, "factions.yaml"));
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of entries) {
      expect(entry.type).toBe("faction");
    }
  });

  it("loads and validates npcs.yaml", async () => {
    const entries = await loadCodexFile(resolve(CODEX_DIR, "npcs.yaml"));
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of entries) {
      expect(entry.type).toBe("npc");
    }
  });

  it("loads and validates spells.yaml", async () => {
    const entries = await loadCodexFile(resolve(CODEX_DIR, "spells.yaml"));
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of entries) {
      expect(entry.type).toBe("spell");
    }
  });

  it("loads and validates items.yaml", async () => {
    const entries = await loadCodexFile(resolve(CODEX_DIR, "items.yaml"));
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of entries) {
      expect(entry.type).toBe("item");
    }
  });

  it("loads and validates history_events.yaml", async () => {
    const entries = await loadCodexFile(resolve(CODEX_DIR, "history_events.yaml"));
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of entries) {
      expect(entry.type).toBe("history_event");
    }
  });

  it("preserves declared authoring v2 blocks", async () => {
    const yaml = `
- id: test_loader_v2_race
  name: "Loader v2 Race"
  type: "race"
  tags: ["test"]
  description: "A temporary entry for loader preservation tests."
  epistemic:
    authority: established_canon
    truth_status: "true"
    scope: global
    visibility: public
    confidence: 1
    source_type: authorial
  player_facing:
    short_label: "Loader v2"
    sensory:
      sights: ["blue lanterns"]
  ai_grounding:
    must_know: ["Preserve this grounding fact"]
    must_not_invent: ["Do not strip this guardrail"]
    reveal_policy:
      default: public_surface_only
  ecology:
    facts_seeded:
      - id: fact_loader_v2
        statement: "Loader preserves ecology facts."
        scope: global
        truth_status: confirmed
        confidence: 1
    belief_hooks:
      - holder_id: npc_guard
        holder_type: npc
        subject_id: test_loader_v2_race
        fact_id: fact_loader_v2
        stance: knows
        statement: "The guard knows the loader fact."
        confidence: 0.9
        when: on_first_meeting
  traits: ["observed"]
  abilities: ["validation"]
`;
    const tmpDir = await mkdtemp(join(tmpdir(), "codex-loader-v2-"));
    const tmpPath = resolve(tmpDir, "loader-v2.yaml");
    await Bun.write(tmpPath, yaml);
    try {
      const [entry] = await loadCodexFile(tmpPath);

      expect(entry.player_facing?.short_label).toBe("Loader v2");
      expect(entry.player_facing?.sensory?.sights).toEqual(["blue lanterns"]);
      expect(entry.ai_grounding?.must_know).toEqual(["Preserve this grounding fact"]);
      expect(entry.ai_grounding?.reveal_policy?.default).toBe("public_surface_only");
      expect(entry.ecology?.facts_seeded?.[0]?.id).toBe("fact_loader_v2");
      expect(entry.ecology?.belief_hooks?.[0]?.holder_id).toBe("npc_guard");
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("throws on invalid YAML data with entry id and field info", async () => {
    const invalidYaml = `
- id: bad_entry
  name: "Bad"
  type: "race"
  tags: []
  description: "missing epistemic"
  traits: []
  abilities: []
`;
    const tmpPath = resolve(CODEX_DIR, "__test_invalid.yaml");
    await Bun.write(tmpPath, invalidYaml);
    try {
      await expect(loadCodexFile(tmpPath)).rejects.toThrow();
    } finally {
      const { unlinkSync } = await import("fs");
      unlinkSync(tmpPath);
    }
  });
});

describe("loadAllCodex", () => {
  let codex: Map<string, CodexEntry>;

  beforeAll(async () => {
    codex = await loadAllCodex(CODEX_DIR);
  });

  it("loads all entries keyed by id", () => {
    expect(codex.size).toBeGreaterThanOrEqual(16);
    expect(codex.has("race_human")).toBe(true);
    expect(codex.has("loc_north_gate")).toBe(true);
  });

  it("all entries are validated CodexEntry instances", () => {
    for (const [id, entry] of codex) {
      expect(entry.id).toBe(id);
      expect(typeof entry.type).toBe("string");
      expect(typeof entry.name).toBe("string");
    }
  });

  it("all loaded codex entries expose player-facing short labels", () => {
    const documentedExemptions = new Set<string>();
    const missingLabels = [...codex.values()]
      .filter((entry) => !documentedExemptions.has(entry.id))
      .filter((entry) => !entry.player_facing?.short_label)
      .map((entry) => entry.id);

    expect(missingLabels).toEqual([]);
  });

  it("all first-party codex entries declare ai grounding", () => {
    const missingGrounding = [...codex.values()]
      .filter((entry) => !entry.ai_grounding)
      .map((entry) => entry.id);

    expect(missingGrounding).toEqual([]);
  });

  it("quest public ai grounding does not include stage-gated spoiler parentheticals", () => {
    const stageGatedSpoiler = /[（(]Stage\s*\d+后[:：][^）)]*[）)]/;
    const leakedMustKnow = [...codex.values()]
      .filter((entry) => entry.type === "quest")
      .flatMap((entry) =>
        (entry.ai_grounding?.must_know ?? [])
          .filter((fact) => stageGatedSpoiler.test(fact))
          .map((fact) => ({ id: entry.id, fact })),
      );

    expect(leakedMustKnow).toEqual([]);
  });

  it("loads migrated core codex entries with authoring v2 fields", () => {
    const coreLocationIds = [
      "loc_north_gate",
      "loc_main_street",
      "loc_tavern",
      "loc_blacksmith",
      "loc_market",
      "loc_temple",
      "loc_forest_road",
      "loc_abandoned_camp",
      "loc_dark_cave",
    ];

    for (const id of coreLocationIds) {
      const entry = codex.get(id);
      expect(entry?.type).toBe("location");
      if (!entry || entry.type !== "location") {
        throw new Error(`Expected ${id} to be a location entry`);
      }

      expect(entry.player_facing?.short_label).toBeTruthy();
      expect(entry.player_facing?.first_visit).toBeTruthy();
      expect(entry.player_facing?.revisit).toBeTruthy();
      expect(entry.player_facing?.sensory).toBeDefined();
      expect(entry.ai_grounding).toBeDefined();
      expect(entry.ecology).toBeDefined();
      expect(entry.location_context).toBeDefined();
    }

    for (const id of coreLocationIds) {
      const entry = codex.get(id);
      if (!entry || entry.type !== "location") {
        throw new Error(`Expected ${id} to be a location entry`);
      }

      const interactableIds = new Set(entry.player_facing?.interactables?.map((item) => item.id) ?? []);
      expect([...interactableIds].sort()).toEqual([...entry.objects].sort());
    }

    const coreNpcIds = [
      "npc_guard",
      "npc_bartender",
      "npc_captain",
      "npc_hunter",
      "npc_elder",
      "npc_priestess",
      "npc_shadow_contact",
    ];

    for (const id of coreNpcIds) {
      const entry = codex.get(id);
      expect(entry?.type).toBe("npc");
      if (!entry || entry.type !== "npc") {
        throw new Error(`Expected ${id} to be an npc entry`);
      }

      expect(entry.voice).toBeDefined();
      expect(entry.ai_grounding).toBeDefined();
      expect(entry.social_memory).toBeDefined();
      expect(entry.ecology?.belief_hooks).toBeDefined();
    }

    const quest = codex.get("quest_main_01");
    expect(quest?.type).toBe("quest");
    if (!quest || quest.type !== "quest") {
      throw new Error("Expected quest_main_01 to be a quest entry");
    }
    expect(quest.world_effects).toBeDefined();

    const coreFactionIds = ["faction_guard", "faction_merchants", "faction_shadow_guild"];

    for (const id of coreFactionIds) {
      const entry = codex.get(id);
      expect(entry?.type).toBe("faction");
      if (!entry || entry.type !== "faction") {
        throw new Error(`Expected ${id} to be a faction entry`);
      }

      expect(entry.information_network).toBeDefined();
      expect(entry.reaction_policy).toBeDefined();
    }
  });
});

describe("queryByType", () => {
  let codex: Map<string, CodexEntry>;

  beforeAll(async () => {
    codex = await loadAllCodex(CODEX_DIR);
  });

  it("returns only location entries", () => {
    const locations = queryByType(codex, "location");
    expect(locations.length).toBeGreaterThanOrEqual(2);
    for (const entry of locations) {
      expect(entry.type).toBe("location");
    }
  });

  it("returns only race entries", () => {
    const races = queryByType(codex, "race");
    expect(races.length).toBeGreaterThanOrEqual(2);
    for (const entry of races) {
      expect(entry.type).toBe("race");
    }
  });

  it("returns empty for nonexistent type", () => {
    const result = queryByType(codex, "nonexistent");
    expect(result).toEqual([]);
  });
});

describe("queryByTag", () => {
  let codex: Map<string, CodexEntry>;

  beforeAll(async () => {
    codex = await loadAllCodex(CODEX_DIR);
  });

  it("returns entries with playable tag", () => {
    const playable = queryByTag(codex, "playable");
    expect(playable.length).toBeGreaterThanOrEqual(2);
    for (const entry of playable) {
      expect(entry.tags).toContain("playable");
    }
  });

  it("returns empty for nonexistent tag", () => {
    const result = queryByTag(codex, "totally_nonexistent_tag_xyz");
    expect(result).toEqual([]);
  });
});

describe("queryById", () => {
  let codex: Map<string, CodexEntry>;

  beforeAll(async () => {
    codex = await loadAllCodex(CODEX_DIR);
  });

  it("returns the human race entry", () => {
    const entry = queryById(codex, "race_human");
    expect(entry).toBeDefined();
    expect(entry!.name).toBe("人类");
  });

  it("returns undefined for nonexistent id", () => {
    const entry = queryById(codex, "nonexistent_id");
    expect(entry).toBeUndefined();
  });
});

describe("queryRelationships", () => {
  let relationships: RelationshipEdge[];

  beforeAll(async () => {
    const { loadRelationships } = await import("./loader.ts");
    relationships = await loadRelationships(resolve(CODEX_DIR, "relationships.yaml"));
  });

  it("filters by source_id", () => {
    const guardEdges = queryRelationships(relationships, { source_id: "npc_guard" });
    expect(guardEdges.length).toBeGreaterThanOrEqual(1);
    for (const edge of guardEdges) {
      expect(edge.source_id).toBe("npc_guard");
    }
  });

  it("filters by target_id", () => {
    const tavernEdges = queryRelationships(relationships, { target_id: "loc_tavern" });
    expect(tavernEdges.length).toBeGreaterThanOrEqual(1);
    for (const edge of tavernEdges) {
      expect(edge.target_id).toBe("loc_tavern");
    }
  });

  it("filters by relation_type", () => {
    const memberEdges = queryRelationships(relationships, { relation_type: "member_of" });
    expect(memberEdges.length).toBeGreaterThanOrEqual(1);
    for (const edge of memberEdges) {
      expect(edge.relation_type).toBe("member_of");
    }
  });

  it("filters by multiple fields", () => {
    const result = queryRelationships(relationships, {
      source_id: "npc_guard",
      relation_type: "member_of",
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    for (const edge of result) {
      expect(edge.source_id).toBe("npc_guard");
      expect(edge.relation_type).toBe("member_of");
    }
  });

  it("returns empty for no match", () => {
    const result = queryRelationships(relationships, { source_id: "nonexistent" });
    expect(result).toEqual([]);
  });

  it("loadRelationships accepts and preserves relationship v2 fields", async () => {
    const relationshipYaml = `
- source_id: npc_guard
  target_id: faction_guard
  relation_type: member_of
  visibility: public
  strength: 0.9
  status: active
  ai_grounding:
    must_know:
      - "The guard serves the town watch."
    must_not_invent:
      - "Do not claim the guard leads the faction."
  ecology:
    belief_hooks:
      - holder_id: npc_guard
        holder_type: npc
        subject_id: faction_guard
        fact_id: fact_guard_membership
        stance: knows
        statement: "The guard knows their duty to the faction."
        confidence: 0.95
        when: relationship_loaded
`;
    const tmpDir = await mkdtemp(join(tmpdir(), "codex-relationships-"));
    const tmpPath = resolve(tmpDir, "relationships-v2.yaml");
    await Bun.write(tmpPath, relationshipYaml);
    try {
      const { loadRelationships } = await import("./loader.ts");
      const [edge] = await loadRelationships(tmpPath);

      expect(edge.ai_grounding?.must_know).toEqual(["The guard serves the town watch."]);
      expect(edge.ai_grounding?.must_not_invent).toEqual([
        "Do not claim the guard leads the faction.",
      ]);
      expect(edge.ecology?.belief_hooks?.[0]?.holder_id).toBe("npc_guard");
      expect(edge.ecology?.belief_hooks?.[0]?.fact_id).toBe("fact_guard_membership");
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("epistemic system demonstration", () => {
  let codex: Map<string, CodexEntry>;

  beforeAll(async () => {
    codex = await loadAllCodex(CODEX_DIR);
  });

  it("wolf disaster has canonical truth entry", () => {
    const wolfDisaster = queryById(codex, "event_wolf_disaster");
    expect(wolfDisaster).toBeDefined();
    expect(wolfDisaster!.epistemic.authority).toBe("established_canon");
    expect(wolfDisaster!.epistemic.truth_status).toBe("true");
  });

  it("wolf disaster rumor contradicts the canonical entry", () => {
    const wolfRumor = queryById(codex, "event_wolf_disaster_rumor");
    expect(wolfRumor).toBeDefined();
    expect(wolfRumor!.epistemic.authority).toBe("street_rumor");
    expect(wolfRumor!.epistemic.truth_status).toBe("partially_true");
    expect(wolfRumor!.epistemic.contradicts).toContain("event_wolf_disaster");
  });
});
