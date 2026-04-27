import { z } from 'zod';
import { createStore, type Store } from './create-store';
import { eventBus } from '../events/event-bus';
import type { EventBus } from '../events/event-bus';

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

export const NpcMemoryRecordSchema = z.object({
  npcId: z.string(),
  recentMemories: z.array(NpcMemoryEntrySchema).max(15),
  salientMemories: z.array(NpcMemoryEntrySchema).max(50),
  archiveSummary: z.string(),
  lastUpdated: z.string(),
  version: z.number().int().default(0),
});

export type NpcMemoryRecord = z.infer<typeof NpcMemoryRecordSchema>;

export const NpcMemoryStateSchema = z.object({
  memories: z.record(z.string(), NpcMemoryRecordSchema),
});

export type NpcMemoryState = z.infer<typeof NpcMemoryStateSchema>;

export function getDefaultNpcMemoryState(): NpcMemoryState {
  return { memories: {} };
}

export function createNpcMemoryStore(bus: EventBus): Store<NpcMemoryState> {
  return createStore<NpcMemoryState>(
    getDefaultNpcMemoryState(),
    ({ newState, oldState }) => {
      for (const npcId of Object.keys(newState.memories)) {
        const newLen = newState.memories[npcId]?.recentMemories.length ?? 0;
        const oldLen = oldState.memories[npcId]?.recentMemories.length ?? 0;
        if (newLen > oldLen) {
          const recentMemories = newState.memories[npcId]!.recentMemories;
          const latest = recentMemories[recentMemories.length - 1];
          if (latest) {
            bus.emit('npc_memory_written', {
              npcId,
              event: latest.event,
              turnNumber: latest.turnNumber,
            });
          }
        }
      }
    },
  );
}

export const npcMemoryStore = createNpcMemoryStore(eventBus);
