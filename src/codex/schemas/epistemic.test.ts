import { describe, it, expect } from "bun:test";
import { z } from "zod";
import {
  EpistemicMetadataSchema,
  type EpistemicMetadata,
  AuthorityLevel,
  TruthStatus,
  Scope,
  Visibility,
  SourceType,
  Volatility,
} from "./epistemic.ts";
import {
  RaceSchema,
  LocationSchema,
  NpcSchema,
  FactionSchema,
  SpellSchema,
  ItemSchema,
  ProfessionSchema,
  HistoryEventSchema,
  CodexEntrySchema,
  QuestObjectiveSchema,
  QuestStageSchema,
  QuestTemplateSchema,
  type CodexEntry,
} from "./entry-types.ts";
import {
  RelationshipEdgeSchema,
  type RelationshipEdge,
} from "./relationship.ts";

const validEpistemic: EpistemicMetadata = {
  authority: "canonical_truth",
  truth_status: "true",
  scope: "regional",
  visibility: "public",
  confidence: 1.0,
  source_type: "authorial",
  known_by: [],
  contradicts: [],
  volatility: "stable",
};

describe("EpistemicMetadataSchema", () => {
  it("parses valid epistemic metadata", () => {
    const result = EpistemicMetadataSchema.parse({
      authority: "canonical_truth",
      truth_status: "true",
      scope: "regional",
      visibility: "public",
      confidence: 1.0,
      source_type: "authorial",
      known_by: [],
      contradicts: [],
      volatility: "stable",
    });
    expect(result.authority).toBe("canonical_truth");
    expect(result.truth_status).toBe("true");
    expect(result.scope).toBe("regional");
    expect(result.visibility).toBe("public");
    expect(result.confidence).toBe(1.0);
    expect(result.source_type).toBe("authorial");
    expect(result.known_by).toEqual([]);
    expect(result.contradicts).toEqual([]);
    expect(result.volatility).toBe("stable");
  });

  it("rejects invalid authority value", () => {
    expect(() =>
      EpistemicMetadataSchema.parse({
        authority: "invalid",
        truth_status: "true",
        scope: "regional",
        visibility: "public",
        confidence: 1.0,
        source_type: "authorial",
      })
    ).toThrow();
  });

  it("rejects confidence below 0", () => {
    expect(() =>
      EpistemicMetadataSchema.parse({
        ...validEpistemic,
        confidence: -0.1,
      })
    ).toThrow();
  });

  it("rejects confidence above 1", () => {
    expect(() =>
      EpistemicMetadataSchema.parse({
        ...validEpistemic,
        confidence: 1.1,
      })
    ).toThrow();
  });

  it("defaults known_by to empty array", () => {
    const { known_by, ...rest } = validEpistemic;
    const result = EpistemicMetadataSchema.parse(rest);
    expect(result.known_by).toEqual([]);
  });

  it("defaults contradicts to empty array", () => {
    const { contradicts, ...rest } = validEpistemic;
    const result = EpistemicMetadataSchema.parse(rest);
    expect(result.contradicts).toEqual([]);
  });

  it("defaults volatility to stable", () => {
    const { volatility, ...rest } = validEpistemic;
    const result = EpistemicMetadataSchema.parse(rest);
    expect(result.volatility).toBe("stable");
  });

  it("accepts optional scope_ref", () => {
    const result = EpistemicMetadataSchema.parse({
      ...validEpistemic,
      scope_ref: "黑松镇",
    });
    expect(result.scope_ref).toBe("黑松镇");
  });

  it("accepts optional source_bias", () => {
    const result = EpistemicMetadataSchema.parse({
      ...validEpistemic,
      source_bias: "pro-kingdom",
    });
    expect(result.source_bias).toBe("pro-kingdom");
  });
});

describe("RaceSchema", () => {
  it("parses valid race entry", () => {
    const result = RaceSchema.parse({
      id: "race_human",
      name: "人类",
      type: "race",
      tags: ["playable"],
      description: "适应力极强的种族",
      epistemic: validEpistemic,
      traits: ["adaptable"],
      abilities: [],
      lore: "",
    });
    expect(result.id).toBe("race_human");
    expect(result.type).toBe("race");
    expect(result.traits).toEqual(["adaptable"]);
  });

  it("rejects race without id", () => {
    expect(() =>
      RaceSchema.parse({
        name: "人类",
        type: "race",
        tags: ["playable"],
        description: "适应力极强的种族",
        epistemic: validEpistemic,
        traits: ["adaptable"],
        abilities: [],
      })
    ).toThrow();
  });

  it("rejects race with empty id", () => {
    expect(() =>
      RaceSchema.parse({
        id: "",
        name: "人类",
        type: "race",
        tags: ["playable"],
        description: "适应力极强的种族",
        epistemic: validEpistemic,
        traits: ["adaptable"],
        abilities: [],
      })
    ).toThrow();
  });
});

describe("LocationSchema", () => {
  it("requires region and danger_level", () => {
    const result = LocationSchema.parse({
      id: "loc_north_gate",
      name: "黑松镇·北门",
      type: "location",
      tags: ["town_entrance"],
      description: "黑松镇的北面入口",
      epistemic: validEpistemic,
      region: "黑松镇",
      danger_level: 2,
      exits: ["loc_main_street"],
      notable_npcs: ["npc_guard"],
      objects: ["notice_board"],
    });
    expect(result.region).toBe("黑松镇");
    expect(result.danger_level).toBe(2);
  });

  it("rejects danger_level above 10", () => {
    expect(() =>
      LocationSchema.parse({
        id: "loc_hell",
        name: "地狱",
        type: "location",
        tags: [],
        description: "危险之地",
        epistemic: validEpistemic,
        region: "unknown",
        danger_level: 11,
        exits: [],
        notable_npcs: [],
        objects: [],
      })
    ).toThrow();
  });

  it("rejects danger_level below 0", () => {
    expect(() =>
      LocationSchema.parse({
        id: "loc_safe",
        name: "安全之地",
        type: "location",
        tags: [],
        description: "安全",
        epistemic: validEpistemic,
        region: "unknown",
        danger_level: -1,
        exits: [],
        notable_npcs: [],
        objects: [],
      })
    ).toThrow();
  });
});

describe("NpcSchema", () => {
  it("requires location_id, personality_tags, and goals", () => {
    const result = NpcSchema.parse({
      id: "npc_guard",
      name: "北门守卫",
      type: "npc",
      tags: ["guard"],
      description: "黑松镇北门的守卫",
      epistemic: validEpistemic,
      location_id: "loc_north_gate",
      personality_tags: ["dutiful", "cautious"],
      goals: ["protect_gate"],
      backstory: "从小在黑松镇长大",
      initial_disposition: 0.0,
    });
    expect(result.location_id).toBe("loc_north_gate");
    expect(result.personality_tags).toEqual(["dutiful", "cautious"]);
    expect(result.goals).toEqual(["protect_gate"]);
  });

  it("rejects initial_disposition below -1", () => {
    expect(() =>
      NpcSchema.parse({
        id: "npc_evil",
        name: "恶人",
        type: "npc",
        tags: [],
        description: "坏人",
        epistemic: validEpistemic,
        location_id: "loc_unknown",
        personality_tags: [],
        goals: [],
        backstory: "",
        initial_disposition: -1.5,
      })
    ).toThrow();
  });

  it("rejects initial_disposition above 1", () => {
    expect(() =>
      NpcSchema.parse({
        id: "npc_good",
        name: "好人",
        type: "npc",
        tags: [],
        description: "好人",
        epistemic: validEpistemic,
        location_id: "loc_unknown",
        personality_tags: [],
        goals: [],
        backstory: "",
        initial_disposition: 1.5,
      })
    ).toThrow();
  });
});

describe("RelationshipEdgeSchema", () => {
  it("parses valid relationship edge", () => {
    const result = RelationshipEdgeSchema.parse({
      source_id: "npc_guard",
      target_id: "faction_militia",
      relation_type: "member_of",
      visibility: "public",
      strength: 0.8,
      status: "active",
    });
    expect(result.source_id).toBe("npc_guard");
    expect(result.target_id).toBe("faction_militia");
    expect(result.relation_type).toBe("member_of");
    expect(result.strength).toBe(0.8);
    expect(result.status).toBe("active");
  });

  it("accepts optional evidence and note fields", () => {
    const result = RelationshipEdgeSchema.parse({
      source_id: "npc_guard",
      target_id: "faction_militia",
      relation_type: "member_of",
      visibility: "public",
      strength: 0.8,
      status: "active",
      evidence: "wears militia badge",
      note: "loyal member since youth",
    });
    expect(result.evidence).toBe("wears militia badge");
    expect(result.note).toBe("loyal member since youth");
  });

  it("rejects strength above 1", () => {
    expect(() =>
      RelationshipEdgeSchema.parse({
        source_id: "a",
        target_id: "b",
        relation_type: "ally",
        visibility: "public",
        strength: 1.5,
        status: "active",
      })
    ).toThrow();
  });

  it("rejects strength below 0", () => {
    expect(() =>
      RelationshipEdgeSchema.parse({
        source_id: "a",
        target_id: "b",
        relation_type: "ally",
        visibility: "public",
        strength: -0.1,
        status: "active",
      })
    ).toThrow();
  });

  it("rejects invalid status", () => {
    expect(() =>
      RelationshipEdgeSchema.parse({
        source_id: "a",
        target_id: "b",
        relation_type: "ally",
        visibility: "public",
        strength: 0.5,
        status: "invalid_status",
      })
    ).toThrow();
  });
});

describe("CodexEntrySchema discriminated union", () => {
  it("routes to RaceSchema when type is race", () => {
    const result = CodexEntrySchema.parse({
      id: "race_elf",
      name: "精灵",
      type: "race",
      tags: ["playable"],
      description: "优雅而长寿的种族",
      epistemic: validEpistemic,
      traits: ["keen_senses"],
      abilities: ["darkvision"],
    });
    expect(result.type).toBe("race");
  });

  it("routes to LocationSchema when type is location", () => {
    const result = CodexEntrySchema.parse({
      id: "loc_tavern",
      name: "酒馆",
      type: "location",
      tags: ["building"],
      description: "黑松镇的酒馆",
      epistemic: validEpistemic,
      region: "黑松镇",
      danger_level: 0,
      exits: ["loc_main_street"],
      notable_npcs: [],
      objects: [],
    });
    expect(result.type).toBe("location");
  });

  it("routes to NpcSchema when type is npc", () => {
    const result = CodexEntrySchema.parse({
      id: "npc_bartender",
      name: "酒馆老板",
      type: "npc",
      tags: ["merchant"],
      description: "友善的酒馆老板",
      epistemic: validEpistemic,
      location_id: "loc_tavern",
      personality_tags: ["friendly"],
      goals: ["run_business"],
      backstory: "继承了父亲的酒馆",
      initial_disposition: 0.3,
    });
    expect(result.type).toBe("npc");
  });

  it("routes to SpellSchema when type is spell", () => {
    const result = CodexEntrySchema.parse({
      id: "spell_fireball",
      name: "火焰箭",
      type: "spell",
      tags: ["fire", "attack"],
      description: "发射一道火焰",
      epistemic: validEpistemic,
      element: "fire",
      mp_cost: 3,
      effect: "对目标造成火焰伤害",
      requirements: ["mind >= 3"],
    });
    expect(result.type).toBe("spell");
  });

  it("routes to ItemSchema when type is item", () => {
    const result = CodexEntrySchema.parse({
      id: "item_iron_sword",
      name: "铁剑",
      type: "item",
      tags: ["weapon", "common"],
      description: "普通的铁剑",
      epistemic: validEpistemic,
      item_type: "weapon",
      value: 10,
      base_damage: 5,
    });
    expect(result.type).toBe("item");
  });

  it("routes to FactionSchema when type is faction", () => {
    const result = CodexEntrySchema.parse({
      id: "faction_guard",
      name: "黑松镇守卫",
      type: "faction",
      tags: ["law_enforcement"],
      description: "维持黑松镇秩序的守卫队",
      epistemic: validEpistemic,
      territory: "黑松镇",
      alignment: "lawful_neutral",
      goals: ["maintain_order"],
      rivals: ["faction_shadow_guild"],
    });
    expect(result.type).toBe("faction");
  });

  it("routes to ProfessionSchema when type is profession", () => {
    const result = CodexEntrySchema.parse({
      id: "prof_adventurer",
      name: "冒险者",
      type: "profession",
      tags: ["combat"],
      description: "以冒险为生的人",
      epistemic: validEpistemic,
      abilities: ["basic_combat"],
      starting_equipment: ["iron_sword", "leather_armor"],
      primary_attribute: "physique",
    });
    expect(result.type).toBe("profession");
  });

  it("routes to HistoryEventSchema when type is history_event", () => {
    const result = CodexEntrySchema.parse({
      id: "event_wolf_disaster",
      name: "黑松镇狼灾",
      type: "history_event",
      tags: ["disaster", "黑松镇"],
      description: "五年前狼群袭击黑松镇的事件",
      epistemic: validEpistemic,
      date: "五年前",
      participants: ["wolves", "militia"],
      impact: "镇民对外来者更加警惕",
      era: "近代",
    });
    expect(result.type).toBe("history_event");
  });

  it("rejects entry with unknown type", () => {
    expect(() =>
      CodexEntrySchema.parse({
        id: "unknown_thing",
        name: "未知",
        type: "unknown_type",
        tags: [],
        description: "unknown",
        epistemic: validEpistemic,
      })
    ).toThrow();
  });
});

describe("QuestObjectiveSchema", () => {
  it("parses a valid talk objective", () => {
    const result = QuestObjectiveSchema.parse({
      id: "obj_01",
      type: "talk",
      targetId: "npc_captain",
      description: "与守卫队长交谈",
    });
    expect(result.id).toBe("obj_01");
    expect(result.type).toBe("talk");
    expect(result.targetId).toBe("npc_captain");
  });

  it("parses a valid defeat_enemy objective without targetId", () => {
    const result = QuestObjectiveSchema.parse({
      id: "obj_02",
      type: "defeat_enemy",
      description: "击败敌人",
    });
    expect(result.type).toBe("defeat_enemy");
    expect(result.targetId).toBeUndefined();
  });

  it("rejects invalid objective type", () => {
    expect(() =>
      QuestObjectiveSchema.parse({
        id: "obj_03",
        type: "invalid_type",
        description: "invalid",
      })
    ).toThrow();
  });
});

describe("QuestStageSchema", () => {
  it("parses a valid stage with objectives", () => {
    const result = QuestStageSchema.parse({
      id: "stage_01",
      description: "调查失踪事件",
      objectives: [
        { id: "obj_01", type: "talk", targetId: "npc_captain", description: "问队长" },
      ],
      nextStageId: "stage_02",
    });
    expect(result.id).toBe("stage_01");
    expect(result.objectives).toHaveLength(1);
    expect(result.nextStageId).toBe("stage_02");
  });

  it("accepts null nextStageId for terminal stage", () => {
    const result = QuestStageSchema.parse({
      id: "stage_final",
      description: "最终阶段",
      objectives: [],
      nextStageId: null,
    });
    expect(result.nextStageId).toBeNull();
  });
});

describe("QuestTemplateSchema", () => {
  const validQuest = {
    id: "quest_missing_persons",
    name: "失踪事件调查",
    type: "quest" as const,
    tags: ["main", "investigation"],
    description: "调查黑松镇的失踪事件",
    epistemic: validEpistemic,
    quest_type: "main" as const,
    region: "黑松镇",
    stages: [
      {
        id: "stage_01",
        description: "寻找线索",
        objectives: [
          { id: "obj_01", type: "talk" as const, targetId: "npc_captain", description: "问队长" },
        ],
        nextStageId: null,
      },
    ],
    rewards: {
      gold: 100,
      reputation_delta: { faction_guard: 10 },
    },
  };

  it("parses a valid quest template", () => {
    const result = QuestTemplateSchema.parse(validQuest);
    expect(result.type).toBe("quest");
    expect(result.quest_type).toBe("main");
    expect(result.stages).toHaveLength(1);
    expect(result.rewards.gold).toBe(100);
  });

  it("accepts optional region and required_npc_id", () => {
    const result = QuestTemplateSchema.parse({
      ...validQuest,
      required_npc_id: "npc_captain",
    });
    expect(result.required_npc_id).toBe("npc_captain");
  });

  it("accepts optional min_reputation", () => {
    const result = QuestTemplateSchema.parse({
      ...validQuest,
      min_reputation: 20,
    });
    expect(result.min_reputation).toBe(20);
  });

  it("rejects invalid quest_type", () => {
    expect(() =>
      QuestTemplateSchema.parse({ ...validQuest, quest_type: "invalid" })
    ).toThrow();
  });

  it("accepts rewards with items and relation_delta", () => {
    const result = QuestTemplateSchema.parse({
      ...validQuest,
      rewards: {
        items: ["item_iron_sword"],
        relation_delta: { npc_captain: 0.2 },
      },
    });
    expect(result.rewards.items).toEqual(["item_iron_sword"]);
    expect(result.rewards.relation_delta?.["npc_captain"]).toBe(0.2);
  });
});

describe("CodexEntrySchema with QuestTemplateSchema", () => {
  it("routes to QuestTemplateSchema when type is quest", () => {
    const result = CodexEntrySchema.parse({
      id: "quest_001",
      name: "测试任务",
      type: "quest",
      tags: ["side"],
      description: "一个测试任务",
      epistemic: validEpistemic,
      quest_type: "side",
      stages: [],
      rewards: {},
    });
    expect(result.type).toBe("quest");
  });
});
