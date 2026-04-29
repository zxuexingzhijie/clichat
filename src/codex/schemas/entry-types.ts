import { z } from "zod";
import { EpistemicMetadataSchema } from "./epistemic.ts";

const baseFields = {
  id: z.string().min(1),
  name: z.string(),
  tags: z.array(z.string()),
  description: z.string(),
  epistemic: EpistemicMetadataSchema,
};

export const RaceSchema = z.object({
  ...baseFields,
  type: z.literal("race"),
  traits: z.array(z.string()),
  abilities: z.array(z.string()),
  lore: z.string().optional(),
});

export const ProfessionSchema = z.object({
  ...baseFields,
  type: z.literal("profession"),
  abilities: z.array(z.string()),
  starting_equipment: z.array(z.string()),
  primary_attribute: z.enum(["physique", "finesse", "mind"]),
});

export const SpatialExitSchema = z.object({
  direction: z.string(),
  targetId: z.string(),
  distance: z.number().optional(),
  label: z.string().optional(),
});

export const LocationSchema = z.object({
  ...baseFields,
  type: z.literal("location"),
  region: z.string(),
  danger_level: z.number().min(0).max(10),
  exits: z.array(z.union([z.string(), SpatialExitSchema])),
  notable_npcs: z.array(z.string()),
  objects: z.array(z.string()),
  coordinates: z.object({ x: z.number(), y: z.number() }).optional(),
  map_icon: z.string().optional(),
  enemies: z.array(z.string()).optional(),
});

export const FactionSchema = z.object({
  ...baseFields,
  type: z.literal("faction"),
  territory: z.string(),
  alignment: z.string(),
  goals: z.array(z.string()),
  rivals: z.array(z.string()),
});

export const NpcTrustGateSchema = z.object({
  min_trust: z.number().int().min(0).max(10),
  reveals: z.string(),
});

export const NpcKnowledgeProfileSchema = z.object({
  always_knows: z.array(z.string()).optional(),
  hidden_knowledge: z.array(z.string()).optional(),
  trust_gates: z.array(NpcTrustGateSchema).optional(),
});

export const NpcSchema = z.object({
  ...baseFields,
  type: z.literal("npc"),
  location_id: z.string(),
  personality_tags: z.array(z.string()),
  goals: z.array(z.string()),
  backstory: z.string(),
  initial_disposition: z.number().min(-1).max(1),
  faction: z.string().optional(),
  knowledge_profile: NpcKnowledgeProfileSchema.optional(),
});

export const SpellSchema = z.object({
  ...baseFields,
  type: z.literal("spell"),
  element: z.string(),
  mp_cost: z.number(),
  effect: z.string(),
  requirements: z.array(z.string()),
  effect_type: z.enum(['damage', 'heal', 'buff']).optional(),
  base_value: z.number().optional(),
});

export const ItemSchema = z.object({
  ...baseFields,
  type: z.literal("item"),
  item_type: z.enum(["weapon", "armor", "consumable", "key_item", "misc"]),
  value: z.number(),
  effect: z.string().optional(),
  base_damage: z.number().optional(),
  armor_value: z.number().optional(),
  heal_amount: z.number().optional(),
  mp_restore: z.number().optional(),
});

export const HistoryEventSchema = z.object({
  ...baseFields,
  type: z.literal("history_event"),
  date: z.string(),
  participants: z.array(z.string()),
  impact: z.string(),
  era: z.string(),
});

export const EnemySchema = z.object({
  ...baseFields,
  type: z.literal("enemy"),
  hp: z.number().int().min(1),
  maxHp: z.number().int().min(1),
  attack: z.number().int(),
  defense: z.number().int(),
  dc: z.number().int().min(1),
  damage_base: z.number().int().min(0),
  abilities: z.array(z.string()),
  loot: z.array(z.string()).optional(),
  danger_level: z.number().min(0).max(10),
}).refine(data => data.hp <= data.maxHp, {
  message: "hp must not exceed maxHp",
  path: ["hp"],
});

export const BackgroundSchema = z.object({
  ...baseFields,
  type: z.literal("background"),
  question: z.string(),
  attribute_bias: z.object({
    physique: z.number().optional(),
    finesse: z.number().optional(),
    mind: z.number().optional(),
  }),
  starting_tags: z.array(z.string()),
  world_state_effects: z.array(z.string()),
  narrative_hook: z.string(),
});

export const QuestObjectiveSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['talk', 'visit_location', 'defeat_enemy', 'find_item', 'check_flag']),
  targetId: z.string().optional(),
  description: z.string(),
});

export const QuestTriggerSchema = z.object({
  event: z.enum(['dialogue_ended', 'location_entered', 'item_found', 'combat_ended']),
  targetId: z.string().optional(),
  secondaryEvent: z.enum(['dialogue_ended', 'location_entered', 'item_found', 'combat_ended']).optional(),
  secondaryTargetId: z.string().optional(),
});

export type QuestTrigger = z.infer<typeof QuestTriggerSchema>;

export const ConditionalNextStageSchema = z.object({
  condition_flag: z.string(),
  condition_value: z.unknown().optional(),
  nextStageId: z.string(),
});
export type ConditionalNextStage = z.infer<typeof ConditionalNextStageSchema>;

export const QuestStageSchema = z.object({
  id: z.string().min(1),
  description: z.string(),
  objectives: z.array(QuestObjectiveSchema),
  nextStageId: z.string().nullable(),
  conditional_next_stages: z.array(ConditionalNextStageSchema).optional(),
  completionCondition: z.string().optional(),
  trigger: QuestTriggerSchema.optional(),
});

export const QuestTemplateSchema = z.object({
  ...baseFields,
  type: z.literal('quest'),
  quest_type: z.enum(['main', 'side', 'faction']),
  region: z.string().optional(),
  required_npc_id: z.string().optional(),
  min_reputation: z.number().optional(),
  auto_accept: z.boolean().optional(),
  stages: z.array(QuestStageSchema),
  rewards: z.object({
    gold: z.number().optional(),
    items: z.array(z.string()).optional(),
    reputation_delta: z.record(z.string(), z.number()).optional(),
    relation_delta: z.record(z.string(), z.number()).optional(),
  }),
});

export const CodexEntrySchema = z.discriminatedUnion("type", [
  RaceSchema,
  ProfessionSchema,
  LocationSchema,
  FactionSchema,
  NpcSchema,
  SpellSchema,
  ItemSchema,
  HistoryEventSchema,
  EnemySchema,
  BackgroundSchema,
  QuestTemplateSchema,
]);

export type SpatialExit = z.infer<typeof SpatialExitSchema>;
export type Race = z.infer<typeof RaceSchema>;
export type Profession = z.infer<typeof ProfessionSchema>;
export type Location = z.infer<typeof LocationSchema>;
export type Faction = z.infer<typeof FactionSchema>;
export type NpcTrustGate = z.infer<typeof NpcTrustGateSchema>;
export type NpcKnowledgeProfile = z.infer<typeof NpcKnowledgeProfileSchema>;
export type Npc = z.infer<typeof NpcSchema>;
export type Spell = z.infer<typeof SpellSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type HistoryEvent = z.infer<typeof HistoryEventSchema>;
export type Enemy = z.infer<typeof EnemySchema>;
export type Background = z.infer<typeof BackgroundSchema>;
export type QuestObjective = z.infer<typeof QuestObjectiveSchema>;
export type QuestStage = z.infer<typeof QuestStageSchema>;
export type QuestTemplate = z.infer<typeof QuestTemplateSchema>;
export type CodexEntry = z.infer<typeof CodexEntrySchema>;
