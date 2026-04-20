import { z } from "zod";

export const AuthorityLevel = z.enum([
  "canonical_truth",
  "established_canon",
  "regional_common_knowledge",
  "institutional_doctrine",
  "scholarly_dispute",
  "street_rumor",
]);

export const TruthStatus = z.enum([
  "true",
  "false",
  "partially_true",
  "misleading",
  "unknown",
  "contested",
  "propaganda",
  "mythic",
]);

export const Scope = z.enum([
  "global",
  "kingdom_wide",
  "regional",
  "local",
  "faction_internal",
  "personal",
  "ancient",
  "forbidden",
]);

export const Visibility = z.enum([
  "public",
  "discovered",
  "hidden",
  "secret",
  "forbidden",
]);

export const SourceType = z.enum([
  "authorial",
  "official_record",
  "ancient_text",
  "oral_history",
  "npc_memory",
  "faction_claim",
  "street_rumor",
  "player_found",
  "system_event",
]);

export const Volatility = z.enum(["stable", "evolving", "deprecated"]);

export const EpistemicMetadataSchema = z.object({
  authority: AuthorityLevel,
  truth_status: TruthStatus,
  scope: Scope,
  scope_ref: z.string().optional(),
  visibility: Visibility,
  confidence: z.number().min(0).max(1),
  source_type: SourceType,
  source_bias: z.string().optional(),
  known_by: z.array(z.string()).default([]),
  contradicts: z.array(z.string()).default([]),
  volatility: Volatility.default("stable"),
});

export type EpistemicMetadata = z.infer<typeof EpistemicMetadataSchema>;
