import { z } from "zod";
import { Visibility } from "./epistemic.ts";
import { AiGroundingSchema, EcologyBeliefHookSchema } from "./authoring-v2.ts";

export const RelationshipStatus = z.enum([
  "active",
  "broken",
  "dormant",
  "secret",
]);

export const RelationshipEcologySchema = z.strictObject({
  belief_hooks: z.array(EcologyBeliefHookSchema).optional(),
}).optional();

export const RelationshipEdgeSchema = z.strictObject({
  source_id: z.string(),
  target_id: z.string(),
  relation_type: z.string(),
  visibility: Visibility,
  strength: z.number().min(0).max(1),
  status: RelationshipStatus,
  evidence: z.string().optional(),
  note: z.string().optional(),
  ai_grounding: AiGroundingSchema,
  ecology: RelationshipEcologySchema,
});

export type RelationshipEdge = z.infer<typeof RelationshipEdgeSchema>;
