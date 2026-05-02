import { describe, it, expect } from 'bun:test';
import mitt from 'mitt';
import {
  addMemory,
  createNpcMemoryStore,
  NpcMemoryRecordSchema,
  type NpcMemoryEntry,
} from './npc-memory-store';
import type { DomainEvents } from '../events/event-types';

const baseRecord = {
  npcId: 'npc_elder',
  recentMemories: [],
  salientMemories: [],
  archiveSummary: '',
  lastUpdated: '2026-01-01T00:00:00.000Z',
};

function createMemoryEntry(index: number, npcId = 'npc_guard'): NpcMemoryEntry {
  return {
    id: `memory-${index}`,
    npcId,
    event: `event-${index}`,
    turnNumber: index,
    importance: 'medium',
    emotionalValence: 0,
    participants: [npcId],
  };
}

describe('NpcMemoryRecordSchema', () => {
  it('rejects record missing version field (old saves must default to 0)', () => {
    const result = NpcMemoryRecordSchema.safeParse(baseRecord);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(0);
    }
  });

  it('accepts record with explicit version: 0', () => {
    const result = NpcMemoryRecordSchema.safeParse({ ...baseRecord, version: 0 });
    expect(result.success).toBe(true);
  });

  it('accepts record with explicit version: 1', () => {
    const result = NpcMemoryRecordSchema.safeParse({ ...baseRecord, version: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(1);
    }
  });

  it('rejects non-integer version field', () => {
    const result = NpcMemoryRecordSchema.safeParse({ ...baseRecord, version: 1.5 });
    expect(result.success).toBe(false);
  });

  it('accepts append-only records with long raw memory history and derived views', () => {
    const entries = Array.from({ length: 75 }, (_, index) => createMemoryEntry(index));

    const result = NpcMemoryRecordSchema.safeParse({
      ...baseRecord,
      npcId: 'npc_guard',
      allMemories: entries,
      recentMemories: entries.slice(-15),
      salientMemories: entries.slice(0, 50),
      archiveSourceIds: [],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allMemories).toEqual(entries);
      expect(result.data.recentMemories).toEqual(entries.slice(-15));
      expect(result.data.salientMemories).toEqual(entries.slice(0, 50));
      expect(result.data.archiveSourceIds).toEqual([]);
    }
  });
});

describe('addMemory', () => {
  it('keeps all raw entries while deriving recent and salient compatibility views', () => {
    const bus = mitt<DomainEvents>();
    const store = createNpcMemoryStore(bus);
    const entries = Array.from({ length: 20 }, (_, index) => createMemoryEntry(index));

    for (const entry of entries) {
      addMemory(store, 'npc_guard', entry);
    }

    const record = store.getState().memories.npc_guard;
    expect(record?.allMemories).toHaveLength(20);
    expect(record?.allMemories).toEqual(entries);
    expect(record?.recentMemories).toEqual(entries.slice(-15));
    expect(record?.salientMemories).toEqual(entries.slice(0, 5));
  });

  it('preserves legacy salient memories when rebuilding raw memory source', () => {
    const bus = mitt<DomainEvents>();
    const store = createNpcMemoryStore(bus);
    const salientEntry = createMemoryEntry(1);
    const recentEntry = createMemoryEntry(2);
    const newEntry = createMemoryEntry(3);

    store.setState(draft => {
      draft.memories.npc_guard = {
        npcId: 'npc_guard',
        allMemories: [],
        recentMemories: [recentEntry],
        salientMemories: [salientEntry],
        archiveSummary: '',
        archiveSourceIds: [],
        lastUpdated: '2026-01-01T00:00:00.000Z',
        version: 0,
      };
    });

    addMemory(store, 'npc_guard', newEntry);

    const record = store.getState().memories.npc_guard;
    expect(record?.allMemories).toEqual([salientEntry, recentEntry, newEntry]);
    expect(record?.allMemories.some(memory => memory.id === salientEntry.id)).toBe(true);
  });

  it('emits npc_memory_written for the twentieth raw memory write', () => {
    const bus = mitt<DomainEvents>();
    const events: DomainEvents['npc_memory_written'][] = [];
    bus.on('npc_memory_written', event => events.push(event));
    const store = createNpcMemoryStore(bus);

    for (let index = 0; index < 20; index += 1) {
      addMemory(store, 'npc_guard', createMemoryEntry(index));
    }

    expect(events).toHaveLength(20);
    expect(events.at(-1)).toEqual({
      npcId: 'npc_guard',
      event: 'event-19',
      turnNumber: 19,
    });
  });
});
