import { describe, expect, it } from "bun:test";
import { CodexEntrySchema, type CodexEntry } from "./entry-types.ts";

const validEpistemic = {
  authority: "canonical_truth" as const,
  truth_status: "true" as const,
  scope: "regional" as const,
  visibility: "public" as const,
  confidence: 1,
  source_type: "authorial" as const,
  known_by: [],
  contradicts: [],
  volatility: "stable" as const,
};

const sharedV2Fields = {
  player_facing: {
    first_visit: "第一次来到测试地点。",
    revisit: "你回到测试地点。",
    short_label: "测试条目",
    sensory: {
      sights: ["石墙"],
      sounds: ["风声"],
      smells: ["尘土"],
    },
    interactables: [
      { id: "notice_board", visible_name: "公告栏", affordance: "查看告示" },
    ],
  },
  ai_grounding: {
    must_know: ["这是测试条目的确定信息"],
    must_not_invent: ["不要说这里有龙"],
    tone: ["冷清"],
    reveal_policy: { default: "public_surface_only" },
  },
  ecology: {
    facts_seeded: [
      {
        id: "fact_test_entry",
        statement: "测试条目存在",
        scope: "global" as const,
        truth_status: "confirmed" as const,
        confidence: 1,
        tags: ["test"],
      },
    ],
    rumors_seeded: [
      {
        id: "rumor_test_entry",
        statement: "测试条目有传闻",
        scope: "location" as const,
        scope_id: "loc_test_gate",
        confidence: 0.6,
        tags: ["rumor"],
        spread: ["loc_tavern"],
        starts_at_stage: "stage_rumor",
      },
    ],
    belief_hooks: [
      {
        when: "player_asks_guard",
        holder_id: "npc_guard",
        holder_type: "npc" as const,
        subject_id: "player",
        stance: "believes" as const,
        statement: "玩家正在打听守卫",
        confidence: 0.7,
        decay: "normal",
        tags: ["guard"],
      },
    ],
    propagation: {
      default_visibility: "same_location",
      faction_scope: "faction_guard",
    },
  },
};

function expectEnrichedEntryPreserved(entry: Record<string, unknown>): CodexEntry {
  const result = CodexEntrySchema.safeParse(entry);
  expect(result.success).toBe(true);
  if (!result.success) {
    throw new Error(result.error.message);
  }

  const parsed = result.data;
  expect(parsed.player_facing?.short_label).toBe("测试条目");
  expect(parsed.player_facing?.sensory?.sights).toEqual(["石墙"]);
  expect(parsed.player_facing?.interactables?.[0]?.visible_name).toBe("公告栏");
  expect(parsed.ai_grounding?.must_know).toEqual(["这是测试条目的确定信息"]);
  expect(parsed.ai_grounding?.must_not_invent).toEqual(["不要说这里有龙"]);
  expect(parsed.ai_grounding?.reveal_policy?.default).toBe("public_surface_only");
  expect(parsed.ecology?.facts_seeded?.[0]?.id).toBe("fact_test_entry");
  expect(parsed.ecology?.rumors_seeded?.[0]?.spread).toEqual(["loc_tavern"]);
  expect(parsed.ecology?.belief_hooks?.[0]?.holder_id).toBe("npc_guard");
  return parsed;
}

function expectEntryInvalid(entry: Record<string, unknown>) {
  const result = CodexEntrySchema.safeParse(entry);
  expect(result.success).toBe(false);
}

function minimalLocationEntry(v2Fields: Record<string, unknown> = {}) {
  return {
    id: "loc_test_gate",
    name: "测试城门",
    type: "location",
    tags: ["test"],
    description: "fallback summary",
    epistemic: validEpistemic,
    region: "测试区域",
    danger_level: 1,
    exits: [],
    notable_npcs: [],
    objects: [],
    ...v2Fields,
  };
}

function expectEntryType<TType extends CodexEntry["type"]>(
  entry: CodexEntry,
  type: TType,
): Extract<CodexEntry, { type: TType }> {
  expect(entry.type).toBe(type);
  if (entry.type !== type) {
    throw new Error(`Expected ${type} entry, received ${entry.type}`);
  }
  return entry as Extract<CodexEntry, { type: TType }>;
}

describe("CodexEntrySchema v2 authoring fields", () => {
  it("preserves snake_case ecology fields from YAML-facing authoring data", () => {
    const parsed = expectEnrichedEntryPreserved(minimalLocationEntry({
      ...sharedV2Fields,
      ecology: {
        ...sharedV2Fields.ecology,
        facts_seeded: [
          {
            id: "fact_test_entry",
            statement: "测试条目存在",
            scope: "location",
            scope_id: "loc_test_gate",
            truth_status: "confirmed",
            confidence: 1,
            tags: ["test"],
          },
        ],
        belief_hooks: [
          {
            when: "player_asks_guard",
            holder_id: "npc_guard",
            holder_type: "npc",
            subject_id: "player",
            fact_id: "fact_test_entry",
            stance: "believes",
            statement: "玩家正在打听守卫",
            confidence: 0.7,
          },
        ],
      },
    }));

    expect(parsed.ecology?.facts_seeded?.[0]?.scope_id).toBe("loc_test_gate");
    expect(parsed.ecology?.facts_seeded?.[0]?.truth_status).toBe("confirmed");
    expect(parsed.ecology?.belief_hooks?.[0]?.holder_id).toBe("npc_guard");
    expect(parsed.ecology?.belief_hooks?.[0]?.holder_type).toBe("npc");
    expect(parsed.ecology?.belief_hooks?.[0]?.subject_id).toBe("player");
    expect(parsed.ecology?.belief_hooks?.[0]?.fact_id).toBe("fact_test_entry");
  });

  it("rejects typoed v2 authoring fields instead of stripping them", () => {
    expectEntryInvalid(minimalLocationEntry({
      player_facing: {
        short_lable: "拼错的短标签",
      },
    }));

    expectEntryInvalid(minimalLocationEntry({
      ecology: {
        ...sharedV2Fields.ecology,
        facts_seeded: [
          {
            id: "fact_typo",
            statement: "使用了 camelCase 字段名",
            scope: "global",
            truthStatus: "confirmed",
            confidence: 1,
          },
        ],
      },
    }));
  });

  it("rejects top-level v2 authoring field typos instead of stripping them", () => {
    expectEntryInvalid(minimalLocationEntry({
      playerFacing: sharedV2Fields.player_facing,
    }));

    expectEntryInvalid(minimalLocationEntry({
      aiGrounding: sharedV2Fields.ai_grounding,
    }));

    expectEntryInvalid(minimalLocationEntry({
      locationContext: {
        travel_role: "town_gate",
      },
    }));
  });

  it("validates documented reveal_policy and reaction_policy shapes", () => {
    const revealPolicyResult = CodexEntrySchema.safeParse(minimalLocationEntry({
      ai_grounding: {
        reveal_policy: {
          default: "public_surface_only",
          after_trust_gate: { response: "reveal_hidden_detail" },
        },
      },
    }));
    expect(revealPolicyResult.success).toBe(true);

    const reactionPolicyResult = CodexEntrySchema.safeParse({
      id: "faction_test_guard",
      name: "测试守卫队",
      type: "faction",
      tags: ["law_enforcement"],
      description: "测试守卫队描述",
      epistemic: validEpistemic,
      territory: "测试城门",
      alignment: "lawful_neutral",
      goals: ["maintain_order"],
      rivals: [],
      reaction_policy: {
        player_helped: "reputation_up",
        player_spied: { response: "watch_closely" },
      },
    });
    expect(reactionPolicyResult.success).toBe(true);
  });

  it("rejects unsupported nested arbitrary policy object shapes", () => {
    expectEntryInvalid(minimalLocationEntry({
      ai_grounding: {
        reveal_policy: {
          default: {
            arbitrary: { nested: true },
          },
        },
      },
    }));

    expectEntryInvalid({
      id: "faction_test_guard",
      name: "测试守卫队",
      type: "faction",
      tags: ["law_enforcement"],
      description: "测试守卫队描述",
      epistemic: validEpistemic,
      territory: "测试城门",
      alignment: "lawful_neutral",
      goals: ["maintain_order"],
      rivals: [],
      reaction_policy: {
        player_helped: {
          arbitrary: { nested: true },
        },
      },
    });
  });
  it("validates and preserves enriched location entries", () => {
    const parsed = expectEntryType(expectEnrichedEntryPreserved({
      id: "loc_test_gate",
      name: "测试城门",
      type: "location",
      tags: ["test"],
      description: "fallback summary",
      epistemic: validEpistemic,
      region: "测试区域",
      danger_level: 1,
      exits: [],
      notable_npcs: [],
      objects: [],
      ...sharedV2Fields,
      location_context: {
        travel_role: "town_gate",
        default_actions: ["talk", "inspect", "move"],
        state_overrides: {
          act3_confrontation: {
            player_facing_override: "气氛紧张。",
            ai_tone_override: "confrontation",
          },
        },
      },
    }), "location");

    expect(parsed.location_context?.travel_role).toBe("town_gate");
    expect(parsed.location_context?.default_actions).toEqual(["talk", "inspect", "move"]);
    expect(parsed.location_context?.state_overrides?.act3_confrontation?.ai_tone_override).toBe("confrontation");
  });

  it("validates and preserves enriched NPC entries", () => {
    const parsed = expectEntryType(expectEnrichedEntryPreserved({
      id: "npc_test_guard",
      name: "测试守卫",
      type: "npc",
      tags: ["guard"],
      description: "测试守卫描述",
      epistemic: validEpistemic,
      location_id: "loc_test_gate",
      personality_tags: ["dutiful"],
      goals: ["protect_gate"],
      backstory: "从小在测试城门长大",
      initial_disposition: 0,
      ...sharedV2Fields,
      voice: {
        register: "粗粝、直接",
        sentence_style: "短句为主",
        verbal_tics: ["听着"],
      },
      social_memory: {
        remembers: ["favors"],
        shares_with: ["faction_guard"],
        secrecy: "cautious",
      },
    }), "npc");

    expect(parsed.voice?.register).toBe("粗粝、直接");
    expect(parsed.voice?.verbal_tics).toEqual(["听着"]);
    expect(parsed.social_memory?.shares_with).toEqual(["faction_guard"]);
  });

  it("validates and preserves enriched quest entries", () => {
    const parsed = expectEntryType(expectEnrichedEntryPreserved({
      id: "quest_test",
      name: "测试任务",
      type: "quest",
      tags: ["side"],
      description: "测试任务描述",
      epistemic: validEpistemic,
      quest_type: "side",
      stages: [
        {
          id: "stage_01",
          description: "寻找线索",
          objectives: [{ id: "obj_01", type: "talk", targetId: "npc_test_guard", description: "问守卫" }],
          nextStageId: null,
        },
      ],
      rewards: {},
      ...sharedV2Fields,
      world_effects: {
        on_stage_enter: {
          stage_01: {
            facts_created: [
              {
                id: "fact_stage_started",
                statement: "测试任务已开始",
                scope: "quest",
                scope_id: "quest_test",
                confidence: 1,
                tags: ["quest"],
              },
            ],
            rumors_created: [
              {
                id: "rumor_stage_started",
                statement: "有人开始调查测试任务",
                scope: "location",
                scope_id: "loc_test_gate",
                confidence: 0.5,
                spread: ["loc_tavern"],
              },
            ],
            beliefs_created: [
              {
                holder_id: "npc_test_guard",
                holder_type: "npc",
                subject_id: "player",
                stance: "believes",
                statement: "玩家正在调查测试任务",
                confidence: 0.6,
              },
            ],
          },
        },
        on_complete: {
          facts_created: ["fact_stage_started"],
        },
      },
    }), "quest");

    expect(parsed.world_effects?.on_stage_enter?.stage_01?.facts_created?.[0]).toMatchObject({ id: "fact_stage_started" });
    expect(parsed.world_effects?.on_complete?.facts_created).toEqual(["fact_stage_started"]);
  });

  it("validates and preserves enriched item entries", () => {
    expectEnrichedEntryPreserved({
      id: "item_test_sword",
      name: "测试铁剑",
      type: "item",
      tags: ["weapon"],
      description: "普通测试铁剑",
      epistemic: validEpistemic,
      item_type: "weapon",
      value: 10,
      base_damage: 5,
      ...sharedV2Fields,
    });
  });

  it("validates and preserves enriched faction entries", () => {
    const parsed = expectEntryType(expectEnrichedEntryPreserved({
      id: "faction_test_guard",
      name: "测试守卫队",
      type: "faction",
      tags: ["law_enforcement"],
      description: "测试守卫队描述",
      epistemic: validEpistemic,
      territory: "测试城门",
      alignment: "lawful_neutral",
      goals: ["maintain_order"],
      rivals: [],
      ...sharedV2Fields,
      information_network: {
        hears_from: ["loc_tavern"],
        spreads_to: ["npc_test_guard"],
        rumor_threshold: "medium",
      },
      reaction_policy: {
        player_helped: "reputation_up",
        nested_example: { response: "watch_closely" },
      },
    }), "faction");

    expect(parsed.information_network?.hears_from).toEqual(["loc_tavern"]);
    expect(parsed.reaction_policy?.player_helped).toBe("reputation_up");
    expect(parsed.reaction_policy?.nested_example).toEqual({ response: "watch_closely" });
  });

  it("validates and preserves enriched enemy entries", () => {
    expectEnrichedEntryPreserved({
      id: "enemy_test_wolf",
      name: "测试狼",
      type: "enemy",
      tags: ["beast"],
      description: "测试狼描述",
      epistemic: validEpistemic,
      hp: 8,
      maxHp: 8,
      attack: 3,
      defense: 1,
      dc: 10,
      damage_base: 2,
      abilities: ["bite"],
      danger_level: 2,
      ...sharedV2Fields,
    });
  });

  it("validates and preserves enriched race entries", () => {
    expectEnrichedEntryPreserved({
      id: "race_test_human",
      name: "测试人类",
      type: "race",
      tags: ["playable"],
      description: "测试人类描述",
      epistemic: validEpistemic,
      traits: ["adaptable"],
      abilities: ["resolve"],
      ...sharedV2Fields,
    });
  });

  it("validates and preserves enriched profession entries", () => {
    expectEnrichedEntryPreserved({
      id: "prof_test_adventurer",
      name: "测试冒险者",
      type: "profession",
      tags: ["combat"],
      description: "测试冒险者描述",
      epistemic: validEpistemic,
      abilities: ["basic_combat"],
      starting_equipment: ["item_test_sword"],
      primary_attribute: "physique",
      ...sharedV2Fields,
    });
  });

  it("validates and preserves enriched background entries", () => {
    expectEnrichedEntryPreserved({
      id: "background_test_outsider",
      name: "测试外乡人",
      type: "background",
      tags: ["origin"],
      description: "测试外乡人描述",
      epistemic: validEpistemic,
      question: "你为什么来到这里？",
      attribute_bias: { mind: 1 },
      starting_tags: ["outsider"],
      world_state_effects: ["arrived_recently"],
      narrative_hook: "你刚来到测试城门。",
      ...sharedV2Fields,
    });
  });

  it("validates and preserves enriched spell entries", () => {
    expectEnrichedEntryPreserved({
      id: "spell_test_spark",
      name: "测试火花",
      type: "spell",
      tags: ["fire"],
      description: "测试火花描述",
      epistemic: validEpistemic,
      element: "fire",
      mp_cost: 3,
      effect: "造成火焰伤害",
      requirements: ["mind >= 3"],
      ...sharedV2Fields,
    });
  });

  it("validates and preserves enriched history event entries", () => {
    expectEnrichedEntryPreserved({
      id: "event_test_disaster",
      name: "测试灾难",
      type: "history_event",
      tags: ["history"],
      description: "测试灾难描述",
      epistemic: validEpistemic,
      date: "五年前",
      participants: ["npc_test_guard"],
      impact: "测试城门更警惕外来者",
      era: "近代",
      ...sharedV2Fields,
    });
  });

  it("keeps legacy entries valid when v2 fields are omitted", () => {
    const result = CodexEntrySchema.safeParse({
      id: "race_legacy_human",
      name: "旧版人类",
      type: "race",
      tags: ["playable"],
      description: "旧版条目仍然有效",
      epistemic: validEpistemic,
      traits: ["adaptable"],
      abilities: [],
    });

    expect(result.success).toBe(true);
  });
});
