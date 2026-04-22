import { z } from 'zod';
import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';

export const KnowledgeStatusSchema = z.enum(['heard', 'suspected', 'confirmed', 'contradicted']);
export type KnowledgeStatus = z.infer<typeof KnowledgeStatusSchema>;

export const PlayerKnowledgeEntrySchema = z.object({
  id: z.string(),
  codexEntryId: z.string().nullable(),
  source: z.string(),
  turnNumber: z.number(),
  credibility: z.number().min(0).max(1),
  knowledgeStatus: KnowledgeStatusSchema,
  description: z.string(),
  relatedQuestId: z.string().nullable(),
});
export type PlayerKnowledgeEntry = z.infer<typeof PlayerKnowledgeEntrySchema>;

export const PlayerKnowledgeStateSchema = z.object({
  entries: z.record(z.string(), PlayerKnowledgeEntrySchema),
});
export type PlayerKnowledgeState = z.infer<typeof PlayerKnowledgeStateSchema>;

export function getDefaultPlayerKnowledgeState(): PlayerKnowledgeState {
  return { entries: {} };
}

export const playerKnowledgeStore = createStore<PlayerKnowledgeState>(
  getDefaultPlayerKnowledgeState(),
  ({ newState, oldState }) => {
    for (const entryId of Object.keys(newState.entries)) {
      if (!oldState.entries[entryId]) {
        const entry = newState.entries[entryId]!;
        eventBus.emit('knowledge_discovered', {
          entryId,
          codexEntryId: entry.codexEntryId,
          knowledgeStatus: entry.knowledgeStatus,
          turnNumber: entry.turnNumber,
        });
      }
    }
  },
);
