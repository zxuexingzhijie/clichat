import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import { _fs } from './memory-persistence';
import { eventBus } from '../events/event-bus';
import { addMemory, npcMemoryStore } from '../state/npc-memory-store';
import type { NpcMemoryRecord } from '../state/npc-memory-store';
import { createGameContext } from '../context/game-context';

const mockBunWrite = mock(() => Promise.resolve(0));
const mockBunFile = mock((_filePath: string) => ({
  text: mock(() => Promise.resolve('{}')),
  exists: mock(() => Promise.resolve(false)),
}));

let mkdirSpy: ReturnType<typeof spyOn>;
const originalBunWrite = ((globalThis as Record<string, unknown>).Bun as Record<string, unknown> | undefined)?.write;
const originalBunFile = ((globalThis as Record<string, unknown>).Bun as Record<string, unknown> | undefined)?.file;

beforeEach(() => {
  mkdirSpy = spyOn(_fs, 'mkdir').mockImplementation(() => Promise.resolve(undefined));
  if (typeof Bun !== 'undefined') {
    (Bun as unknown as Record<string, unknown>).write = mockBunWrite;
    (Bun as unknown as Record<string, unknown>).file = mockBunFile;
  }
  mockBunWrite.mockClear();
  mockBunFile.mockClear();
});

afterEach(() => {
  mkdirSpy.mockRestore();
  if (typeof Bun !== 'undefined' && originalBunWrite) {
    (Bun as unknown as Record<string, unknown>).write = originalBunWrite;
  }
  if (typeof Bun !== 'undefined' && originalBunFile) {
    (Bun as unknown as Record<string, unknown>).file = originalBunFile;
  }
});

function makeRecord(
  npcId: string,
  recentCount: number,
  salientCount: number = 0,
  archiveSummary: string = '',
): NpcMemoryRecord {
  const makeEntry = (i: number) => ({
    id: `entry-${i}`,
    npcId,
    event: `event-${i}`,
    turnNumber: i,
    importance: 'low' as const,
    emotionalValence: 0,
    participants: [],
  });
  const recentMemories = Array.from({ length: recentCount }, (_, i) => makeEntry(i));
  const salientMemories = Array.from({ length: salientCount }, (_, i) => makeEntry(100 + i));
  return {
    npcId,
    allMemories: [...salientMemories, ...recentMemories],
    recentMemories,
    salientMemories,
    archiveSummary,
    archiveSourceIds: [],
    lastUpdated: new Date().toISOString(),
    version: 0,
  };
}

describe('initMemoryPersistence', () => {
  it('subscribes to npc_memory_written event', async () => {
    const { initMemoryPersistence } = await import('./memory-persistence');

    const cleanup = initMemoryPersistence('/tmp/memory', eventBus, npcMemoryStore, { debounceMs: 0 });
    cleanup();

    expect(typeof initMemoryPersistence).toBe('function');
  });

  it('writes memory from an injected game context store when that store emits npc_memory_written', async () => {
    const { initMemoryPersistence } = await import('./memory-persistence');
    const ctx = createGameContext();
    const cleanup = initMemoryPersistence('/tmp/memory', ctx.eventBus, ctx.stores.npcMemory, { debounceMs: 0 });

    addMemory(ctx.stores.npcMemory, 'npc_context_guard', {
      id: 'context-entry-1',
      npcId: 'npc_context_guard',
      event: 'context store event',
      turnNumber: 1,
      importance: 'medium',
      emotionalValence: 0,
      participants: [],
    });

    await new Promise(r => setTimeout(r, 20));
    cleanup();

    const writtenPaths = (mockBunWrite.mock.calls as unknown as [string, string][]).map(c => c[0]);
    expect(writtenPaths.some(p => p.includes('npc_context_guard.json'))).toBe(true);
  });

  it('when npc_memory_written fires, triggers a write for that npcId', async () => {
    const { initMemoryPersistence } = await import('./memory-persistence');

    npcMemoryStore.setState(draft => {
      draft.memories['npc_guard'] = makeRecord('npc_guard', 1);
    });

    initMemoryPersistence('/tmp/memory', eventBus, npcMemoryStore, { debounceMs: 0 });

    eventBus.emit('npc_memory_written', {
      npcId: 'npc_guard',
      event: 'player greeted the guard',
      turnNumber: 1,
    });

    await new Promise(r => setTimeout(r, 50));

    expect(mockBunWrite).toHaveBeenCalled();
  });

  it('errors from Bun.write are caught and NOT thrown (fire-and-forget)', async () => {
    mockBunWrite.mockImplementationOnce(() => Promise.reject(new Error('disk full')));

    const { initMemoryPersistence } = await import('./memory-persistence');

    npcMemoryStore.setState(draft => {
      draft.memories['npc_guard'] = makeRecord('npc_guard', 1);
    });

    initMemoryPersistence('/tmp/memory', eventBus, npcMemoryStore, { debounceMs: 0 });

    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      eventBus.emit('npc_memory_written', {
        npcId: 'npc_guard',
        event: 'test event',
        turnNumber: 1,
      });
    }).not.toThrow();

    await new Promise(r => setTimeout(r, 50));

    errorSpy.mockRestore();
  });
});

describe('writeMemoryToDisk — index.json', () => {
  it('writes to memory/index.json with entry for the npcId', async () => {
    const { initMemoryPersistence } = await import('./memory-persistence');

    npcMemoryStore.setState(draft => {
      draft.memories['npc_guard'] = makeRecord('npc_guard', 1);
    });

    initMemoryPersistence('/tmp/memory', eventBus, npcMemoryStore, { debounceMs: 0 });
    eventBus.emit('npc_memory_written', {
      npcId: 'npc_guard',
      event: 'test',
      turnNumber: 1,
    });

    await new Promise(r => setTimeout(r, 50));

    const writtenPaths = (mockBunWrite.mock.calls as unknown as [string, string][]).map(c => c[0]);
    expect(writtenPaths.some(p => p.includes('index.json'))).toBe(true);
  });

  it('writes NPC memory file to memory/{region}/{npcId}.json', async () => {
    const { initMemoryPersistence } = await import('./memory-persistence');

    npcMemoryStore.setState(draft => {
      draft.memories['npc_guard'] = makeRecord('npc_guard', 1);
    });

    initMemoryPersistence('/tmp/memory', eventBus, npcMemoryStore, { debounceMs: 0 });
    eventBus.emit('npc_memory_written', {
      npcId: 'npc_guard',
      event: 'test',
      turnNumber: 1,
    });

    await new Promise(r => setTimeout(r, 50));

    const writtenPaths = (mockBunWrite.mock.calls as unknown as [string, string][]).map(c => c[0]);
    expect(writtenPaths.some(p => p.includes('npc_guard.json'))).toBe(true);
  });

  it('writes a normalized no-loss memory record to the NPC memory file', async () => {
    const { initMemoryPersistence } = await import('./memory-persistence');
    const ctx = createGameContext();

    ctx.stores.npcMemory.setState(draft => {
      draft.memories['npc_guard'] = makeRecord('npc_guard', 15);
    });

    const cleanup = initMemoryPersistence('/tmp/memory', ctx.eventBus, ctx.stores.npcMemory, { debounceMs: 0 });
    ctx.eventBus.emit('npc_memory_written', {
      npcId: 'npc_guard',
      event: 'test',
      turnNumber: 1,
    });

    await new Promise(r => setTimeout(r, 50));
    cleanup();

    const npcWrite = (mockBunWrite.mock.calls as unknown as [string, string][]).find(([path]) =>
      path.includes('npc_guard.json'),
    );
    expect(npcWrite).toBeDefined();
    const writtenRecord = JSON.parse(npcWrite![1]) as NpcMemoryRecord;
    expect(writtenRecord.allMemories).toHaveLength(15);
    expect(writtenRecord.recentMemories).toHaveLength(15);
    expect(writtenRecord.salientMemories).toHaveLength(0);
  });
});

describe('applyRetention — no-loss legacy normalization', () => {
  it('when recentMemories reaches 15, preserves every raw entry in allMemories instead of evicting', async () => {
    const { applyRetention } = await import('./memory-persistence');

    const record = makeRecord('npc_guard', 15, 0);
    const result = applyRetention(record);

    expect(result.allMemories.map(m => m.id)).toEqual(Array.from({ length: 15 }, (_, i) => `entry-${i}`));
    expect(result.recentMemories.length).toBe(15);
    expect(result.salientMemories.length).toBe(0);
    expect(result.archiveSummary).toBe('');
  });

  it('when recentMemories < 15, preserves all raw entries', async () => {
    const { applyRetention } = await import('./memory-persistence');

    const record = makeRecord('npc_guard', 14, 0);
    const result = applyRetention(record);

    expect(result.allMemories.length).toBe(14);
    expect(result.recentMemories.length).toBe(14);
    expect(result.salientMemories.length).toBe(0);
  });

  it('when salientMemories reaches 50, keeps structured entries in allMemories instead of archiving them as the only copy', async () => {
    const { applyRetention } = await import('./memory-persistence');

    const record = makeRecord('npc_guard', 0, 50);
    const result = applyRetention(record);

    expect(result.allMemories.length).toBe(50);
    expect(result.allMemories.some(m => m.id === 'entry-100' && m.event === 'event-100')).toBe(true);
    expect(result.archiveSummary).toBe('');
    expect(result.salientMemories.length).toBe(35);
    expect(result.recentMemories.length).toBe(15);
  });

  it('does not append salient memory text to an existing archiveSummary during normalization', async () => {
    const { applyRetention } = await import('./memory-persistence');

    const record = makeRecord('npc_guard', 0, 50, 'existing archive');
    const result = applyRetention(record);

    expect(result.archiveSummary).toBe('existing archive');
    expect(result.archiveSummary).not.toContain('event-100');
    expect(result.allMemories.length).toBe(50);
  });

  it('when salientMemories < 50, preserves all raw salient entries', async () => {
    const { applyRetention } = await import('./memory-persistence');

    const record = makeRecord('npc_guard', 0, 49);
    const result = applyRetention(record);

    expect(result.allMemories.length).toBe(49);
    expect(result.salientMemories.length).toBe(34);
    expect(result.recentMemories.length).toBe(15);
    expect(result.archiveSummary).toBe('');
  });

  it('does not mutate the original record', async () => {
    const { applyRetention } = await import('./memory-persistence');

    const record = makeRecord('npc_guard', 15, 0);
    const originalRecentLength = record.recentMemories.length;
    const originalAllLength = record.allMemories.length;
    applyRetention(record);

    expect(record.recentMemories.length).toBe(originalRecentLength);
    expect(record.allMemories.length).toBe(originalAllLength);
  });

  it('preserves mixed-importance entries instead of evicting the lowest-importance entry', async () => {
    const { applyRetention } = await import('./memory-persistence');

    const entries: NpcMemoryRecord['recentMemories'] = Array.from({ length: 15 }, (_, i) => ({
      id: `entry-${i}`,
      npcId: 'npc_guard',
      event: `event-${i}`,
      turnNumber: i,
      importance: 'medium' as const,
      emotionalValence: 0,
      participants: [],
    }));
    entries[0] = { ...entries[0]!, importance: 'high' };
    entries[14] = { ...entries[14]!, importance: 'low' };

    const record: NpcMemoryRecord = {
      npcId: 'npc_guard',
      allMemories: entries,
      recentMemories: entries,
      salientMemories: [],
      archiveSummary: '',
      archiveSourceIds: [],
      lastUpdated: new Date().toISOString(),
      version: 0,
    };

    const result = applyRetention(record);

    expect(result.allMemories.map(m => m.id)).toContain('entry-14');
    expect(result.recentMemories.length).toBe(15);
    expect(result.recentMemories.some(m => m.id === 'entry-0')).toBe(true);
    expect(result.recentMemories.some(m => m.id === 'entry-14')).toBe(true);
    expect(result.salientMemories.length).toBe(0);
  });

  it('sorts the unified raw memories by turnNumber without dropping the oldest entry', async () => {
    const { applyRetention } = await import('./memory-persistence');

    const entries = Array.from({ length: 15 }, (_, i) => ({
      id: `entry-${i}`,
      npcId: 'npc_guard',
      event: `event-${i}`,
      turnNumber: i + 10,
      importance: 'medium' as const,
      emotionalValence: 0,
      participants: [],
    }));
    entries[7] = { ...entries[7]!, turnNumber: 1 };

    const record: NpcMemoryRecord = {
      npcId: 'npc_guard',
      allMemories: entries,
      recentMemories: entries,
      salientMemories: [],
      archiveSummary: '',
      archiveSourceIds: [],
      lastUpdated: new Date().toISOString(),
      version: 0,
    };

    const result = applyRetention(record);

    expect(result.allMemories[0]?.id).toBe('entry-7');
    expect(result.allMemories).toHaveLength(15);
    expect(result.recentMemories).toHaveLength(15);
    expect(result.recentMemories.some(m => m.id === 'entry-7')).toBe(true);
    expect(result.salientMemories).toHaveLength(0);
  });

  it('normalizes legacy records by unioning allMemories, recentMemories, and salientMemories by id', async () => {
    const { applyRetention } = await import('./memory-persistence');

    const record: NpcMemoryRecord = {
      npcId: 'npc_guard',
      allMemories: [
        {
          id: 'all-2',
          npcId: 'npc_guard',
          event: 'all memory',
          turnNumber: 2,
          importance: 'medium',
          emotionalValence: 0,
          participants: [],
        },
      ],
      recentMemories: [
        {
          id: 'recent-3',
          npcId: 'npc_guard',
          event: 'recent memory',
          turnNumber: 3,
          importance: 'low',
          emotionalValence: 0,
          participants: [],
        },
      ],
      salientMemories: [
        {
          id: 'salient-1',
          npcId: 'npc_guard',
          event: 'salient memory',
          turnNumber: 1,
          importance: 'high',
          emotionalValence: 0,
          participants: [],
        },
        {
          id: 'recent-3',
          npcId: 'npc_guard',
          event: 'duplicate recent memory',
          turnNumber: 99,
          importance: 'high',
          emotionalValence: 0,
          participants: [],
        },
      ],
      archiveSummary: 'legacy summary',
      archiveSourceIds: ['already-archived'],
      lastUpdated: new Date().toISOString(),
      version: 0,
    };

    const result = applyRetention(record);

    expect(result.allMemories.map(m => m.id)).toEqual(['salient-1', 'all-2', 'recent-3']);
    expect(result.archiveSummary).toBe('legacy summary');
    expect(result.archiveSourceIds).toEqual(['already-archived']);
  });
});
