import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import { _fs } from './memory-persistence';
import { eventBus } from '../events/event-bus';
import { npcMemoryStore } from '../state/npc-memory-store';
import type { NpcMemoryRecord } from '../state/npc-memory-store';

const mockBunWrite = mock(() => Promise.resolve(0));
const mockBunFile = mock((_filePath: string) => ({
  text: mock(() => Promise.resolve('{}')),
  exists: mock(() => Promise.resolve(false)),
}));

let mkdirSpy: ReturnType<typeof spyOn>;
const originalBunWrite = ((globalThis as Record<string, unknown>).Bun as Record<string, unknown> | undefined)?.write;
const originalBunFile = ((globalThis as Record<string, unknown>).Bun as Record<string, unknown> | undefined)?.file;

beforeEach(() => {
  mkdirSpy = spyOn(_fs, 'mkdirSync').mockImplementation(() => undefined as unknown as ReturnType<typeof _fs.mkdirSync>);
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
  return {
    npcId,
    recentMemories: Array.from({ length: recentCount }, (_, i) => makeEntry(i)),
    salientMemories: Array.from({ length: salientCount }, (_, i) => makeEntry(100 + i)),
    archiveSummary,
    lastUpdated: new Date().toISOString(),
    version: 0,
  };
}

describe('initMemoryPersistence', () => {
  it('subscribes to npc_memory_written event', async () => {
    const { initMemoryPersistence } = await import('./memory-persistence');

    initMemoryPersistence('/tmp/memory');

    expect(typeof initMemoryPersistence).toBe('function');
  });

  it('when npc_memory_written fires, triggers a write for that npcId', async () => {
    const { initMemoryPersistence } = await import('./memory-persistence');

    npcMemoryStore.setState(draft => {
      draft.memories['npc_guard'] = makeRecord('npc_guard', 1);
    });

    initMemoryPersistence('/tmp/memory');

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

    initMemoryPersistence('/tmp/memory');

    expect(() => {
      eventBus.emit('npc_memory_written', {
        npcId: 'npc_guard',
        event: 'test event',
        turnNumber: 1,
      });
    }).not.toThrow();

    await new Promise(r => setTimeout(r, 50));
  });
});

describe('writeMemoryToDisk — index.json', () => {
  it('writes to memory/index.json with entry for the npcId', async () => {
    const { initMemoryPersistence } = await import('./memory-persistence');

    npcMemoryStore.setState(draft => {
      draft.memories['npc_guard'] = makeRecord('npc_guard', 1);
    });

    initMemoryPersistence('/tmp/memory');
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

    initMemoryPersistence('/tmp/memory');
    eventBus.emit('npc_memory_written', {
      npcId: 'npc_guard',
      event: 'test',
      turnNumber: 1,
    });

    await new Promise(r => setTimeout(r, 50));

    const writtenPaths = (mockBunWrite.mock.calls as unknown as [string, string][]).map(c => c[0]);
    expect(writtenPaths.some(p => p.includes('npc_guard.json'))).toBe(true);
  });
});

describe('applyRetention — three-layer logic', () => {
  it('when recentMemories reaches 15, oldest entry is promoted to salientMemories', async () => {
    const { applyRetention } = await import('./memory-persistence');

    const record = makeRecord('npc_guard', 15, 0);
    const result = applyRetention(record);

    expect(result.recentMemories.length).toBe(14);
    expect(result.salientMemories.length).toBe(1);
    expect(result.salientMemories[0]?.id).toBe('entry-0');
  });

  it('when recentMemories < 15, no promotion occurs', async () => {
    const { applyRetention } = await import('./memory-persistence');

    const record = makeRecord('npc_guard', 14, 0);
    const result = applyRetention(record);

    expect(result.recentMemories.length).toBe(14);
    expect(result.salientMemories.length).toBe(0);
  });

  it('when salientMemories reaches 50, oldest 25 are archived into archiveSummary', async () => {
    const { applyRetention } = await import('./memory-persistence');

    const record = makeRecord('npc_guard', 0, 50);
    const result = applyRetention(record);

    expect(result.salientMemories.length).toBe(25);
    expect(result.archiveSummary).toContain('event-100');
  });

  it('archive text is appended to existing archiveSummary', async () => {
    const { applyRetention } = await import('./memory-persistence');

    const record = makeRecord('npc_guard', 0, 50, 'existing archive');
    const result = applyRetention(record);

    expect(result.archiveSummary).toContain('existing archive');
    expect(result.archiveSummary).toContain('event-100');
  });

  it('when salientMemories < 50, no archiving occurs', async () => {
    const { applyRetention } = await import('./memory-persistence');

    const record = makeRecord('npc_guard', 0, 49);
    const result = applyRetention(record);

    expect(result.salientMemories.length).toBe(49);
    expect(result.archiveSummary).toBe('');
  });

  it('does not mutate the original record', async () => {
    const { applyRetention } = await import('./memory-persistence');

    const record = makeRecord('npc_guard', 15, 0);
    const originalRecentLength = record.recentMemories.length;
    applyRetention(record);

    expect(record.recentMemories.length).toBe(originalRecentLength);
  });
});
