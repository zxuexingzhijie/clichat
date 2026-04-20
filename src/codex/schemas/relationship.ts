import { z } from "zod";
import { Visibility } from "./epistemic.ts";

export const RelationshipStatus = z.enum([
  "active",
  "broken",
  "dormant",
  "secret",
]);

export const RelationshipEdgeSchema = z.object({
  source_id: z.string(),
  target_id: z.string(),
  relation_type: z.string(),
  visibility: Visibility,
  strength: z.number().min(0).max(1),
  status: RelationshipStatus,
  evidence: z.string().optional(),
  note: z.string().optional(),
});

export type RelationshipEdge = z.infer<typeof RelationshipEdgeSchema>;
