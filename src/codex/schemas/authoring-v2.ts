import { z } from "zod";

const TruthStatusSchema = z.enum(["confirmed", "rumor", "contested", "false", "unknown"]);
const PolicyValueSchema = z.union([
  z.string(),
  z.strictObject({
    response: z.string(),
  }),
]);

const EcologyFactSeedFields = {
  id: z.string(),
  statement: z.string(),
  scope: z.enum(["global", "location", "faction", "npc", "quest", "player"]),
  scope_id: z.string().nullable().optional(),
  truth_status: TruthStatusSchema.optional(),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.string()).optional(),
};

const EcologyBeliefFields = {
  holder_id: z.string(),
  holder_type: z.enum(["npc", "faction"]),
  subject_id: z.string().nullable().optional(),
  fact_id: z.string().nullable().optional(),
  stance: z.enum(["believes", "doubts", "denies", "fears", "wants", "knows"]),
  statement: z.string(),
  confidence: z.number().min(0).max(1),
  decay: z.enum(["none", "slow", "normal", "fast"]).optional(),
  tags: z.array(z.string()).optional(),
};

export const PlayerFacingSchema = z.strictObject({
  first_visit: z.string().optional(),
  revisit: z.string().optional(),
  short_label: z.string().optional(),
  sensory: z.strictObject({
    sights: z.array(z.string()).optional(),
    sounds: z.array(z.string()).optional(),
    smells: z.array(z.string()).optional(),
  }).optional(),
  interactables: z.array(z.strictObject({
    id: z.string(),
    visible_name: z.string(),
    affordance: z.string().optional(),
  })).optional(),
}).optional();

export const AiGroundingSchema = z.strictObject({
  must_know: z.array(z.string()).optional(),
  must_not_invent: z.array(z.string()).optional(),
  tone: z.array(z.string()).optional(),
  reveal_policy: z.record(z.string(), PolicyValueSchema).optional(),
}).optional();

export const EcologyFactSeedSchema = z.strictObject(EcologyFactSeedFields);

export const EcologyRumorSeedSchema = z.strictObject({
  ...EcologyFactSeedFields,
  truth_status: TruthStatusSchema.optional(),
  spread: z.array(z.string()).optional(),
  starts_at_stage: z.string().optional(),
});

export const EcologyBeliefSchema = z.strictObject(EcologyBeliefFields);

export const EcologyBeliefHookSchema = z.strictObject({
  ...EcologyBeliefFields,
  when: z.string(),
});

export const EcologySchema = z.strictObject({
  facts_seeded: z.array(EcologyFactSeedSchema).optional(),
  rumors_seeded: z.array(EcologyRumorSeedSchema).optional(),
  belief_hooks: z.array(EcologyBeliefHookSchema).optional(),
  propagation: z.strictObject({
    default_visibility: z.string().optional(),
    faction_scope: z.string().optional(),
  }).optional(),
}).optional();

export const LocationContextSchema = z.strictObject({
  travel_role: z.string().optional(),
  default_actions: z.array(z.string()).optional(),
  state_overrides: z.record(z.string(), z.strictObject({
    player_facing_override: z.string().optional(),
    ai_tone_override: z.string().optional(),
  })).optional(),
}).optional();

export const VoiceSchema = z.strictObject({
  register: z.string().optional(),
  sentence_style: z.string().optional(),
  verbal_tics: z.array(z.string()).optional(),
}).optional();

export const SocialMemorySchema = z.strictObject({
  remembers: z.array(z.string()).optional(),
  shares_with: z.array(z.string()).optional(),
  secrecy: z.string().optional(),
}).optional();

const WorldEffectFactSchema = z.union([EcologyFactSeedSchema, z.string()]);
const WorldEffectRumorSchema = z.union([EcologyRumorSeedSchema, z.string()]);

export const WorldEffectsStageSchema = z.strictObject({
  facts_created: z.array(WorldEffectFactSchema).optional(),
  rumors_created: z.array(WorldEffectRumorSchema).optional(),
  beliefs_created: z.array(EcologyBeliefSchema).optional(),
});

export const WorldEffectsSchema = z.strictObject({
  on_stage_enter: z.record(z.string(), WorldEffectsStageSchema).optional(),
  on_complete: WorldEffectsStageSchema.optional(),
}).optional();

export const InformationNetworkSchema = z.strictObject({
  hears_from: z.array(z.string()).optional(),
  spreads_to: z.array(z.string()).optional(),
  rumor_threshold: z.string().optional(),
}).optional();

export const ReactionPolicySchema = z.record(z.string(), PolicyValueSchema).optional();

export type PlayerFacing = z.infer<typeof PlayerFacingSchema>;
export type AiGrounding = z.infer<typeof AiGroundingSchema>;
export type Ecology = z.infer<typeof EcologySchema>;
export type LocationContext = z.infer<typeof LocationContextSchema>;
export type Voice = z.infer<typeof VoiceSchema>;
export type SocialMemory = z.infer<typeof SocialMemorySchema>;
export type WorldEffects = z.infer<typeof WorldEffectsSchema>;
export type InformationNetwork = z.infer<typeof InformationNetworkSchema>;
export type ReactionPolicy = z.infer<typeof ReactionPolicySchema>;
