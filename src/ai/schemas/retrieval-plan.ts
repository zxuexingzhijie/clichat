import { z } from 'zod';

export const RetrievalPlanSchema = z.object({
  codexIds: z.array(z.string()).max(3).describe('Codex entry IDs to retrieve'),
  npcIds: z.array(z.string()).max(2).describe('NPC IDs whose memories to fetch'),
  questIds: z.array(z.string()).max(1).describe('Active quest IDs for context'),
  reasoning: z.string().describe('Why these entries are relevant'),
});

export type RetrievalPlan = z.infer<typeof RetrievalPlanSchema>;
