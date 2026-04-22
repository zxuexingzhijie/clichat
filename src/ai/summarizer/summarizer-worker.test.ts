import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { NpcMemoryEntry } from '../../state/npc-memory-store';

const mockNpcMemoryGetState = mock(() => ({ memories: {} }));
const mockNpcMemorySetState = mock((_recipe: unknown) => {});

mock.module('../../state/npc-memory-store', () => ({
  npcMemoryStore: {
    getState: mockNpcMemoryGetState,
    setState: mockNpcMemorySetState,
  },
}));

mock.module('./summarizer-queue', () => ({
  dequeuePending: mock(() => null),
  markRunning: mock(() => {}),
  markDone: mock(() => {}),
  markFailed: mock(() => {}),
  summarizerQueueStore: { getState: () => ({ tasks: [], isRunning: false }) },
}));

mock.module('../roles/memory-summarizer', () => ({
  generateNpcMemorySummary: mock(() => Promise.resolve('compressed memory')),
  generateChapterSummary: mock(() => Promise.resolve('chapter summary')),
  generateTurnLogCompress: mock(() => Promise.resolve('compressed turns')),
}));

const { applyNpcMemoryCompression } = await import('./summarizer-worker');

function makeEntries(count: number): NpcMemoryEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `entry_${i}`,
    npcId: 'npc_001',
    event: `event ${i}`,
    turnNumber: i,
    importance: 'low' as const,
    emotionalValence: 0,
    participants: [],
  }));
}

describe('applyNpcMemoryCompression', () => {
  beforeEach(() => {
    mockNpcMemoryGetState.mockReset();
    mockNpcMemorySetState.mockReset();
  });

  it('returns conflict when npcId not found in store', async () => {
    mockNpcMemoryGetState.mockReturnValue({ memories: {} });

    const task = {
      id: 'task_001',
      type: 'npc_memory_compress' as const,
      targetId: 'npc_001',
      entryIds: ['e1', 'e2'],
      baseVersion: 0,
      priority: 2 as const,
      triggerReason: 'threshold',
      createdAt: new Date().toISOString(),
      status: 'running' as const,
    };

    const result = await applyNpcMemoryCompression(task, 'compressed memory');
    expect(result).toBe('conflict');
    expect(mockNpcMemorySetState).not.toHaveBeenCalled();
  });

  it('returns conflict when record.version !== task.baseVersion', async () => {
    mockNpcMemoryGetState.mockReturnValue({
      memories: {
        npc_001: {
          npcId: 'npc_001',
          recentMemories: makeEntries(5),
          salientMemories: [],
          archiveSummary: 'old summary',
          lastUpdated: new Date().toISOString(),
          version: 3,
        },
      },
    });

    const task = {
      id: 'task_001',
      type: 'npc_memory_compress' as const,
      targetId: 'npc_001',
      entryIds: ['entry_0', 'entry_1'],
      baseVersion: 1,
      priority: 2 as const,
      triggerReason: 'threshold',
      createdAt: new Date().toISOString(),
      status: 'running' as const,
    };

    const result = await applyNpcMemoryCompression(task, 'new compressed');
    expect(result).toBe('conflict');
    expect(mockNpcMemorySetState).not.toHaveBeenCalled();
  });

  it('returns applied when versions match, updates archiveSummary, increments version', async () => {
    const entries = makeEntries(5);
    mockNpcMemoryGetState.mockReturnValue({
      memories: {
        npc_001: {
          npcId: 'npc_001',
          recentMemories: entries,
          salientMemories: [],
          archiveSummary: 'old summary',
          lastUpdated: new Date().toISOString(),
          version: 2,
        },
      },
    });

    const entryIds = [entries[0]!.id, entries[1]!.id];
    const task = {
      id: 'task_001',
      type: 'npc_memory_compress' as const,
      targetId: 'npc_001',
      entryIds,
      baseVersion: 2,
      priority: 2 as const,
      triggerReason: 'threshold',
      createdAt: new Date().toISOString(),
      status: 'running' as const,
    };

    let capturedRecipe: ((draft: unknown) => void) | null = null;
    mockNpcMemorySetState.mockImplementation((recipe: (_draft: unknown) => void) => {
      capturedRecipe = recipe;
    });

    const result = await applyNpcMemoryCompression(task, 'new compressed memory');
    expect(result).toBe('applied');
    expect(mockNpcMemorySetState).toHaveBeenCalledTimes(1);

    const draft = {
      memories: {
        npc_001: {
          npcId: 'npc_001',
          recentMemories: [...entries],
          salientMemories: [],
          archiveSummary: 'old summary',
          lastUpdated: new Date().toISOString(),
          version: 2,
        },
      },
    };
    if (capturedRecipe) (capturedRecipe as (d: typeof draft) => void)(draft);
    expect(draft.memories.npc_001.archiveSummary).toBe('new compressed memory');
    expect(draft.memories.npc_001.version).toBe(3);
    expect(draft.memories.npc_001.recentMemories.length).toBe(entries.length - entryIds.length);
  });

  it('preserves recentMemories not in entryIds after write-back', async () => {
    const entries = makeEntries(5);
    const entryIds = [entries[0]!.id, entries[1]!.id];

    mockNpcMemoryGetState.mockReturnValue({
      memories: {
        npc_001: {
          npcId: 'npc_001',
          recentMemories: entries,
          salientMemories: [],
          archiveSummary: '',
          lastUpdated: new Date().toISOString(),
          version: 0,
        },
      },
    });

    const task = {
      id: 'task_002',
      type: 'npc_memory_compress' as const,
      targetId: 'npc_001',
      entryIds,
      baseVersion: 0,
      priority: 2 as const,
      triggerReason: 'threshold',
      createdAt: new Date().toISOString(),
      status: 'running' as const,
    };

    let capturedRecipe: ((draft: unknown) => void) | null = null;
    mockNpcMemorySetState.mockImplementation((recipe: (_draft: unknown) => void) => {
      capturedRecipe = recipe;
    });

    await applyNpcMemoryCompression(task, 'summary text');

    const draft = {
      memories: {
        npc_001: {
          npcId: 'npc_001',
          recentMemories: [...entries],
          salientMemories: [],
          archiveSummary: '',
          lastUpdated: new Date().toISOString(),
          version: 0,
        },
      },
    };
    if (capturedRecipe) (capturedRecipe as (d: typeof draft) => void)(draft);
    expect(draft.memories.npc_001.recentMemories.length).toBe(3);
    expect(draft.memories.npc_001.recentMemories[0]!.id).toBe(entries[2]!.id);
  });
});
