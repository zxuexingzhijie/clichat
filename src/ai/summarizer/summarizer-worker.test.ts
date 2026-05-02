import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { NpcMemoryEntry } from '../../state/npc-memory-store';

const mockNpcMemoryGetState = mock(() => ({ memories: {} }));
const mockNpcMemorySetState = mock((_recipe: (draft: unknown) => void) => {});

mock.module('../../state/npc-memory-store', () => ({
  npcMemoryStore: {
    getState: mockNpcMemoryGetState,
    setState: mockNpcMemorySetState,
  },
}));

mock.module('./summarizer-queue', () => ({
  enqueueTask: mock(() => {}),
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

const { applyNpcMemoryCompression, configureSummarizerWorkerStores, runNextTask, runSummarizerLoop } = await import('./summarizer-worker');
const { dequeuePending: mockDequeuePending } = await import('./summarizer-queue') as unknown as {
  dequeuePending: ReturnType<typeof mock>;
};
const { generateNpcMemorySummary: mockGenerateNpcMemorySummary } = await import('../roles/memory-summarizer') as unknown as {
  generateNpcMemorySummary: ReturnType<typeof mock>;
};

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
    configureSummarizerWorkerStores({
      npcMemory: { getState: mockNpcMemoryGetState, setState: mockNpcMemorySetState } as never,
    });
  });

  it('uses a configured runtime NPC memory store', async () => {
    const entries = makeEntries(3);
    const runtimeGetState = mock(() => ({
      memories: {
        npc_runtime: {
          npcId: 'npc_runtime',
          recentMemories: entries,
          salientMemories: [],
          archiveSummary: '',
          lastUpdated: new Date().toISOString(),
          version: 5,
        },
      },
    }));
    const runtimeSetState = mock((_recipe: (draft: unknown) => void) => {});
    const cleanup = configureSummarizerWorkerStores({
      npcMemory: { getState: runtimeGetState, setState: runtimeSetState } as never,
    });

    const result = await applyNpcMemoryCompression({
      id: 'task_runtime',
      type: 'npc_memory_compress',
      targetId: 'npc_runtime',
      entryIds: ['entry_0'],
      baseVersion: 5,
      priority: 2,
      triggerReason: 'threshold',
      createdAt: new Date().toISOString(),
      status: 'running',
    }, 'runtime summary');
    cleanup();

    expect(result).toBe('applied');
    expect(runtimeSetState).toHaveBeenCalledTimes(1);
    expect(mockNpcMemorySetState).not.toHaveBeenCalled();
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

  it('returns applied when versions match, updates archiveSummary, merges archiveSourceIds, increments version', async () => {
    const entries = makeEntries(5);
    mockNpcMemoryGetState.mockReturnValue({
      memories: {
        npc_001: {
          npcId: 'npc_001',
          allMemories: entries,
          recentMemories: entries,
          salientMemories: [],
          archiveSummary: 'old summary',
          archiveSourceIds: ['entry_0', 'legacy_entry'],
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
          allMemories: [...entries],
          recentMemories: [...entries],
          salientMemories: [entries[4]!],
          archiveSummary: 'old summary',
          archiveSourceIds: ['entry_0', 'legacy_entry'],
          lastUpdated: new Date().toISOString(),
          version: 2,
        },
      },
    };
    if (capturedRecipe) (capturedRecipe as (d: typeof draft) => void)(draft);
    expect(draft.memories.npc_001.archiveSummary).toBe('new compressed memory');
    expect(draft.memories.npc_001.archiveSourceIds).toEqual(['entry_0', 'legacy_entry', 'entry_1']);
    expect(draft.memories.npc_001.version).toBe(3);
    expect(draft.memories.npc_001.allMemories.map((memory) => memory.id)).toEqual(entries.map((memory) => memory.id));
    expect(draft.memories.npc_001.recentMemories.map((memory) => memory.id)).toEqual(entries.map((memory) => memory.id));
    expect(draft.memories.npc_001.salientMemories.map((memory) => memory.id)).toEqual([entries[4]!.id]);
  });

  it('preserves all raw/source entries after write-back', async () => {
    const entries = makeEntries(5);
    const entryIds = [entries[0]!.id, entries[1]!.id];

    mockNpcMemoryGetState.mockReturnValue({
      memories: {
        npc_001: {
          npcId: 'npc_001',
          allMemories: entries,
          recentMemories: entries.slice(1),
          salientMemories: [entries[0]!],
          archiveSummary: '',
          archiveSourceIds: [] as string[],
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
          allMemories: [...entries],
          recentMemories: entries.slice(1),
          salientMemories: [entries[0]!],
          archiveSummary: '',
          archiveSourceIds: [] as string[],
          lastUpdated: new Date().toISOString(),
          version: 0,
        },
      },
    };
    if (capturedRecipe) (capturedRecipe as (d: typeof draft) => void)(draft);
    expect(draft.memories.npc_001.allMemories.map((memory) => memory.id)).toEqual(entries.map((memory) => memory.id));
    expect(draft.memories.npc_001.recentMemories.map((memory) => memory.id)).toEqual(entries.slice(1).map((memory) => memory.id));
    expect(draft.memories.npc_001.salientMemories.map((memory) => memory.id)).toEqual([entries[0]!.id]);
    expect(draft.memories.npc_001.archiveSourceIds).toEqual(entryIds);
  });
});

describe('runNextTask — NPC memory compression dispatch', () => {
  beforeEach(() => {
    mockNpcMemoryGetState.mockReset();
    mockNpcMemorySetState.mockReset();
    (mockDequeuePending as ReturnType<typeof mock>).mockReset();
    (mockGenerateNpcMemorySummary as ReturnType<typeof mock>).mockReset();
    (mockGenerateNpcMemorySummary as ReturnType<typeof mock>).mockResolvedValue('compressed selected raw entries');
    configureSummarizerWorkerStores({
      npcMemory: { getState: mockNpcMemoryGetState, setState: mockNpcMemorySetState } as never,
    });
  });

  it('summarizes selected allMemories entries by task.entryIds and archives only summarized ids', async () => {
    const entries = makeEntries(12);
    const oldEntry = entries[1]!;
    const recentEntry = entries[11]!;
    const taskEntryIds = [oldEntry.id, recentEntry.id, 'missing_entry'];
    const record = {
      npcId: 'npc_001',
      allMemories: entries,
      recentMemories: entries.slice(-5),
      salientMemories: entries.slice(0, 7),
      archiveSummary: '',
      archiveSourceIds: ['entry_0'],
      lastUpdated: new Date().toISOString(),
      version: 4,
    };

    mockNpcMemoryGetState.mockReturnValue({ memories: { npc_001: record } });
    (mockDequeuePending as ReturnType<typeof mock>).mockReturnValue({
      id: 'task_dispatch',
      type: 'npc_memory_compress',
      targetId: 'npc_001',
      entryIds: taskEntryIds,
      baseVersion: 4,
      priority: 2,
      triggerReason: 'threshold',
      createdAt: new Date().toISOString(),
      status: 'pending',
    });

    let capturedRecipe: ((draft: unknown) => void) | null = null;
    mockNpcMemorySetState.mockImplementation((recipe: (_draft: unknown) => void) => {
      capturedRecipe = recipe;
    });

    const didRun = await runNextTask();

    expect(didRun).toBe(true);
    expect(mockGenerateNpcMemorySummary).toHaveBeenCalledWith('npc_001', [oldEntry, recentEntry]);

    const draft = { memories: { npc_001: { ...record, archiveSourceIds: ['entry_0'] } } };
    if (capturedRecipe) (capturedRecipe as (d: typeof draft) => void)(draft);
    expect(draft.memories.npc_001.archiveSourceIds).toEqual(['entry_0', oldEntry.id, recentEntry.id]);
  });
});

describe('runSummarizerLoop — AbortSignal', () => {
  beforeEach(() => {
    (mockDequeuePending as ReturnType<typeof mock>).mockReset();
  });

  it('exits immediately when signal is pre-aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    (mockDequeuePending as ReturnType<typeof mock>).mockReturnValue(null);

    await expect(runSummarizerLoop(controller.signal)).resolves.toBeUndefined();
    expect(mockDequeuePending).not.toHaveBeenCalled();
  });

  it('exits cleanly after idle cycle when signal aborts during setTimeout', async () => {
    const controller = new AbortController();
    (mockDequeuePending as ReturnType<typeof mock>).mockReturnValue(null);

    const loopPromise = runSummarizerLoop(controller.signal);
    setTimeout(() => controller.abort(), 10);

    await expect(loopPromise).resolves.toBeUndefined();
  });
});
