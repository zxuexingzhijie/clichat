import { z } from 'zod';
import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';

export const NpcMemoryEntrySchema = z.object({
  id: z.string(),
  npcId: z.string(),
  event: z.string(),
  turnNumber: z.number(),
  importance: z.enum(['low', 'medium', 'high']),
  emotionalValence: z.number().min(-1).max(1),
  participants: z.array(z.string()),
  locationId: z.string().optional(),
});

export type NpcMemoryEntry = z.infer<typeof NpcMemoryEntrySchema>;

export const NpcMemoryStateSchema = z.object({
  memories: z.record(z.string(), z.array(NpcMemoryEntrySchema)),
});

export type NpcMemoryState = z.infer<typeof NpcMemoryStateSchema>;

export function getDefaultNpcMemoryState(): NpcMemoryState {
  return { memories: {} };
}

export const npcMemoryStore = createStore<NpcMemoryState>(
  getDefaultNpcMemoryState(),
  ({ newState, oldState }) => {
    for (const npcId of Object.keys(newState.memories)) {
      const newMemories = newState.memories[npcId] ?? [];
      const oldMemories = oldState.memories[npcId] ?? [];
      if (newMemories.length > oldMemories.length) {
        const latest = newMemories[newMemories.length - 1];
        if (latest) {
          eventBus.emit('npc_memory_written', {
            npcId,
            event: latest.event,
            turnNumber: latest.turnNumber,
          });
        }
      }
    }
  },
);
