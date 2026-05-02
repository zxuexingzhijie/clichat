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
  allMemories: z.array(NpcMemoryEntrySchema).default([]),
  recentMemories: z.array(NpcMemoryEntrySchema).default([]),
  salientMemories: z.array(NpcMemoryEntrySchema).default([]),
  archiveSummary: z.string(),
  archiveSourceIds: z.array(z.string()).default([]),
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

function getRawMemorySource(record?: {
  allMemories?: readonly NpcMemoryEntry[];
  salientMemories?: readonly NpcMemoryEntry[];
  recentMemories?: readonly NpcMemoryEntry[];
}): NpcMemoryEntry[] {
  if (!record) return [];

  const rawSource = record.allMemories?.length
    ? record.allMemories
    : [...(record.salientMemories ?? []), ...(record.recentMemories ?? [])];
  const seenIds = new Set<string>();
  return rawSource.filter(memory => {
    if (seenIds.has(memory.id)) return false;
    seenIds.add(memory.id);
    return true;
  });
}

export function createNpcMemoryStore(bus: EventBus): Store<NpcMemoryState> {
  return createStore<NpcMemoryState>(
    getDefaultNpcMemoryState(),
    ({ newState, oldState }) => {
      for (const npcId of Object.keys(newState.memories)) {
        const newRecord = newState.memories[npcId];
        const oldRecord = oldState.memories[npcId];
        const newRawMemories = getRawMemorySource(newRecord);
        const oldRawMemories = getRawMemorySource(oldRecord);

        if (newRawMemories.length > oldRawMemories.length) {
          const latest = newRawMemories[newRawMemories.length - 1];
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

export function addMemory(
  store: Store<NpcMemoryState>,
  npcId: string,
  entry: NpcMemoryEntry,
): void {
  store.setState(draft => {
    if (!draft.memories[npcId]) {
      draft.memories[npcId] = {
        npcId,
        allMemories: [],
        recentMemories: [],
        salientMemories: [],
        archiveSummary: '',
        archiveSourceIds: [],
        lastUpdated: new Date().toISOString(),
        version: 0,
      };
    }
    const record = draft.memories[npcId]!;
    const allMemories = [...getRawMemorySource(record), entry];
    record.allMemories = allMemories;
    record.recentMemories = allMemories.slice(-15);
    record.salientMemories = allMemories.slice(0, Math.max(0, allMemories.length - 15));
    record.archiveSourceIds = record.archiveSourceIds ?? [];
    record.lastUpdated = new Date().toISOString();
  });
}
