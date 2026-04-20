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

export const LocationSchema = z.object({
  ...baseFields,
  type: z.literal("location"),
  region: z.string(),
  danger_level: z.number().min(0).max(10),
  exits: z.array(z.string()),
  notable_npcs: z.array(z.string()),
  objects: z.array(z.string()),
});

export const FactionSchema = z.object({
  ...baseFields,
  type: z.literal("faction"),
  territory: z.string(),
  alignment: z.string(),
  goals: z.array(z.string()),
  rivals: z.array(z.string()),
});

export const NpcSchema = z.object({
  ...baseFields,
  type: z.literal("npc"),
  location_id: z.string(),
  personality_tags: z.array(z.string()),
  goals: z.array(z.string()),
  backstory: z.string(),
  initial_disposition: z.number().min(-1).max(1),
});

export const SpellSchema = z.object({
  ...baseFields,
  type: z.literal("spell"),
  element: z.string(),
  mp_cost: z.number(),
  effect: z.string(),
  requirements: z.array(z.string()),
});

export const ItemSchema = z.object({
  ...baseFields,
  type: z.literal("item"),
  item_type: z.enum(["weapon", "armor", "consumable", "key_item", "misc"]),
  value: z.number(),
  effect: z.string().optional(),
  base_damage: z.number().optional(),
  armor_value: z.number().optional(),
});

export const HistoryEventSchema = z.object({
  ...baseFields,
  type: z.literal("history_event"),
  date: z.string(),
  participants: z.array(z.string()),
  impact: z.string(),
  era: z.string(),
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
]);

export type Race = z.infer<typeof RaceSchema>;
export type Profession = z.infer<typeof ProfessionSchema>;
export type Location = z.infer<typeof LocationSchema>;
export type Faction = z.infer<typeof FactionSchema>;
export type Npc = z.infer<typeof NpcSchema>;
export type Spell = z.infer<typeof SpellSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type HistoryEvent = z.infer<typeof HistoryEventSchema>;
export type CodexEntry = z.infer<typeof CodexEntrySchema>;
