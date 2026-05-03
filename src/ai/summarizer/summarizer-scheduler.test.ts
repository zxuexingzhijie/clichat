import { describe, it, expect, beforeEach, mock } from 'bun:test';

const mockEmit = mock(() => {});
const mockOn = mock((_event: string, _handler: unknown) => {});
const mockEnqueueTask = mock((_task: unknown) => {});
const mockGetMemoryState = mock(() => ({ memories: {} }));
const mockGetCombatState = mock(() => ({ active: false }));

mock.module('../../events/event-bus', () => ({
  eventBus: { emit: mockEmit, on: mockOn, off: mock(() => {}) },
}));

mock.module('./summarizer-queue', () => ({
  enqueueTask: mockEnqueueTask,
  summarizerQueueStore: { getState: () => ({ tasks: [], isRunning: false, cooldownUntil: null }) },
  dequeuePending: mock(() => null),
  markRunning: mock(() => {}),
  markDone: mock(() => {}),
  markFailed: mock(() => {}),
}));

mock.module('../../state/npc-memory-store', () => ({
  npcMemoryStore: { getState: mockGetMemoryState },
}));

mock.module('../../state/combat-store', () => ({
  combatStore: { getState: mockGetCombatState },
}));

const { evaluateTriggers, initSummarizerScheduler } = await import('./summarizer-scheduler');

function evaluateTestTriggers(source: Parameters<typeof evaluateTriggers>[0], context?: Parameters<typeof evaluateTriggers>[1]): void {
  evaluateTriggers(source, context, {
    npcMemory: { getState: mockGetMemoryState } as never,
    combat: { getState: mockGetCombatState } as never,
  });
}

function makeMemoryEntries(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `entry_${i}`,
    npcId: 'npc_001',
    event: `event_${i}`,
    turnNumber: i,
    importance: 'low' as const,
    emotionalValence: 0,
    participants: [],
  }));
}

describe('evaluateTriggers', () => {
  beforeEach(() => {
    mockEnqueueTask.mockReset();
    mockGetMemoryState.mockReset();
    mockGetCombatState.mockReset();
    mockGetCombatState.mockReturnValue({ active: false });
    mockGetMemoryState.mockReturnValue({ memories: {} });
  });

  it('initSummarizerScheduler wires injected event bus to injected stores', () => {
    const handlers = new Map<string, (payload?: unknown) => void>();
    const bus = {
      on: mock((event: string, handler: (payload?: unknown) => void) => { handlers.set(event, handler); }),
      off: mock((event: string) => { handlers.delete(event); }),
      emit: mock(() => {}),
    };
    const npcMemory = {
      getState: mock(() => ({
        memories: {
          npc_ctx: {
            npcId: 'npc_ctx',
            recentMemories: makeMemoryEntries(10),
            salientMemories: [],
            archiveSummary: '',
            lastUpdated: new Date().toISOString(),
            version: 4,
          },
        },
      })),
    };
    const combat = { getState: mock(() => ({ active: false })) };

    const cleanup = initSummarizerScheduler(bus as never, { npcMemory: npcMemory as never, combat: combat as never });
    handlers.get('npc_memory_written')?.({ npcId: 'npc_ctx' });
    cleanup();

    expect(mockEnqueueTask).toHaveBeenCalledTimes(1);
    expect((mockEnqueueTask.mock.calls[0]![0] as { targetId: string; baseVersion: number }).targetId).toBe('npc_ctx');
    expect((mockEnqueueTask.mock.calls[0]![0] as { targetId: string; baseVersion: number }).baseVersion).toBe(4);
    expect(bus.off).toHaveBeenCalledWith('npc_memory_written', expect.any(Function));
  });

  describe('combat gate', () => {
    it('skips low-priority (3) tasks when combat is active', () => {
      mockGetCombatState.mockReturnValue({ active: true });
      mockGetMemoryState.mockReturnValue({
        memories: {
          npc_001: {
            npcId: 'npc_001',
            recentMemories: makeMemoryEntries(12),
            salientMemories: [],
            archiveSummary: '',
            lastUpdated: new Date().toISOString(),
            version: 0,
          },
        },
      });

      evaluateTestTriggers('interval');

      const lowPriorityCalls = mockEnqueueTask.mock.calls.filter(
        (call) => (call[0] as { priority: number }).priority === 3,
      );
      expect(lowPriorityCalls.length).toBe(0);
    });

    it('allows high-priority (1) tasks even during active combat', () => {
      mockGetCombatState.mockReturnValue({ active: true });
      mockGetMemoryState.mockReturnValue({ memories: {} });

      evaluateTestTriggers('save_game_completed');

      const highPriorityCalls = mockEnqueueTask.mock.calls.filter(
        (call) => (call[0] as { priority: number }).priority === 1,
      );
      expect(highPriorityCalls.length).toBe(1);
    });
  });

  describe('NPC memory threshold trigger', () => {
    it('enqueues npc_memory_compress from unsummarized allMemories when threshold is reached', () => {
      const entries = makeMemoryEntries(12);
      mockGetMemoryState.mockReturnValue({
        memories: {
          npc_001: {
            npcId: 'npc_001',
            allMemories: entries,
            recentMemories: entries.slice(-5),
            salientMemories: entries.slice(0, 7),
            archiveSummary: '',
            archiveSourceIds: ['entry_0', 'entry_1'],
            lastUpdated: new Date().toISOString(),
            version: 2,
          },
        },
      });

      evaluateTestTriggers('npc_memory_written', { npcId: 'npc_001' });

      expect(mockEnqueueTask).toHaveBeenCalledTimes(1);
      const call = mockEnqueueTask.mock.calls[0]![0] as {
        type: string;
        targetId: string;
        priority: number;
        baseVersion: number;
        entryIds: string[];
      };
      expect(call.type).toBe('npc_memory_compress');
      expect(call.targetId).toBe('npc_001');
      expect(call.priority).toBe(2);
      expect(call.baseVersion).toBe(2);
      expect(call.entryIds).toEqual(entries.slice(2).map((memory) => memory.id));
    });

    it('falls back to legacy salientMemories + recentMemories and de-duplicates by id when allMemories is missing or empty', () => {
      const entries = makeMemoryEntries(12);
      const salientMemories = entries.slice(0, 6);
      const recentMemories = [entries[5]!, ...entries.slice(6, 12)];
      const expectedEntryIds = entries.slice(0, 12).map((memory) => memory.id);
      mockGetMemoryState.mockReturnValue({
        memories: {
          npc_missing_all: {
            npcId: 'npc_missing_all',
            recentMemories,
            salientMemories,
            archiveSummary: '',
            archiveSourceIds: [],
            lastUpdated: new Date().toISOString(),
            version: 1,
          },
          npc_empty_all: {
            npcId: 'npc_empty_all',
            allMemories: [],
            recentMemories,
            salientMemories,
            archiveSummary: '',
            archiveSourceIds: [],
            lastUpdated: new Date().toISOString(),
            version: 2,
          },
        },
      });

      evaluateTestTriggers('npc_memory_written', { npcId: 'npc_missing_all' });
      evaluateTestTriggers('npc_memory_written', { npcId: 'npc_empty_all' });

      expect(mockEnqueueTask).toHaveBeenCalledTimes(2);
      expect((mockEnqueueTask.mock.calls[0]![0] as { targetId: string; entryIds: string[] }).targetId).toBe('npc_missing_all');
      expect((mockEnqueueTask.mock.calls[0]![0] as { targetId: string; entryIds: string[] }).entryIds).toEqual(expectedEntryIds);
      expect((mockEnqueueTask.mock.calls[1]![0] as { targetId: string; entryIds: string[] }).targetId).toBe('npc_empty_all');
      expect((mockEnqueueTask.mock.calls[1]![0] as { targetId: string; entryIds: string[] }).entryIds).toEqual(expectedEntryIds);
    });

    it('does not enqueue when unsummarized source memories < 10', () => {
      const entries = makeMemoryEntries(12);
      mockGetMemoryState.mockReturnValue({
        memories: {
          npc_001: {
            npcId: 'npc_001',
            allMemories: entries,
            recentMemories: entries.slice(-5),
            salientMemories: entries.slice(0, 7),
            archiveSummary: '',
            archiveSourceIds: entries.slice(0, 3).map((memory) => memory.id),
            lastUpdated: new Date().toISOString(),
            version: 0,
          },
        },
      });

      evaluateTestTriggers('npc_memory_written', { npcId: 'npc_001' });

      expect(mockEnqueueTask).not.toHaveBeenCalled();
    });

    it('interval falls back to legacy salientMemories + recentMemories and de-duplicates by id when allMemories is missing or empty', () => {
      const originalDateNow = Date.now;
      Date.now = mock(() => originalDateNow() + 10_000) as never;

      try {
        const entries = makeMemoryEntries(12);
        const salientMemories = entries.slice(0, 6);
        const recentMemories = [entries[5]!, ...entries.slice(6, 12)];
        const expectedEntryIds = entries.slice(0, 12).map((memory) => memory.id);
        mockGetMemoryState.mockReturnValue({
          memories: {
            npc_missing_all: {
              npcId: 'npc_missing_all',
              recentMemories,
              salientMemories,
              archiveSummary: '',
              archiveSourceIds: [],
              lastUpdated: new Date().toISOString(),
              version: 1,
            },
            npc_empty_all: {
              npcId: 'npc_empty_all',
              allMemories: [],
              recentMemories,
              salientMemories,
              archiveSummary: '',
              archiveSourceIds: [],
              lastUpdated: new Date().toISOString(),
              version: 2,
            },
          },
        });

        evaluateTestTriggers('interval');

        expect(mockEnqueueTask).toHaveBeenCalledTimes(2);
        expect((mockEnqueueTask.mock.calls[0]![0] as { targetId: string; entryIds: string[]; priority: number }).targetId).toBe('npc_missing_all');
        expect((mockEnqueueTask.mock.calls[0]![0] as { targetId: string; entryIds: string[]; priority: number }).entryIds).toEqual(expectedEntryIds);
        expect((mockEnqueueTask.mock.calls[0]![0] as { targetId: string; entryIds: string[]; priority: number }).priority).toBe(3);
        expect((mockEnqueueTask.mock.calls[1]![0] as { targetId: string; entryIds: string[]; priority: number }).targetId).toBe('npc_empty_all');
        expect((mockEnqueueTask.mock.calls[1]![0] as { targetId: string; entryIds: string[]; priority: number }).entryIds).toEqual(expectedEntryIds);
        expect((mockEnqueueTask.mock.calls[1]![0] as { targetId: string; entryIds: string[]; priority: number }).priority).toBe(3);
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('does not enqueue when npcId not found in store', () => {
      mockGetMemoryState.mockReturnValue({ memories: {} });

      evaluateTestTriggers('npc_memory_written', { npcId: 'npc_nonexistent' });

      expect(mockEnqueueTask).not.toHaveBeenCalled();
    });
  });

  describe('save_game_completed trigger', () => {
    it('enqueues chapter_summary at priority 1 on save', () => {
      evaluateTestTriggers('save_game_completed');

      expect(mockEnqueueTask).toHaveBeenCalledTimes(1);
      const call = mockEnqueueTask.mock.calls[0]![0] as {
        type: string;
        priority: number;
      };
      expect(call.type).toBe('chapter_summary');
      expect(call.priority).toBe(1);
    });
  });

  describe('debounce', () => {
    it('does not fire twice within 5 seconds on interval trigger', () => {
      mockGetMemoryState.mockReturnValue({ memories: {} });

      evaluateTestTriggers('interval');
      evaluateTestTriggers('interval');

      expect(mockEnqueueTask).toHaveBeenCalledTimes(0);
    });
  });
});
