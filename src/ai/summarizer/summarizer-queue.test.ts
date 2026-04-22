import { describe, it, expect, beforeEach, mock } from 'bun:test';

const mockEmit = mock(() => {});

mock.module('../../events/event-bus', () => ({
  eventBus: { emit: mockEmit, on: mock(() => {}), off: mock(() => {}) },
}));

const {
  summarizerQueueStore,
  enqueueTask,
  dequeuePending,
  markRunning,
  markDone,
  markFailed,
} = await import('./summarizer-queue');

function resetStore() {
  summarizerQueueStore.setState((draft) => {
    draft.tasks = [];
    draft.isRunning = false;
    draft.cooldownUntil = null;
  });
}

describe('summarizerQueue', () => {
  beforeEach(() => {
    resetStore();
    mockEmit.mockReset();
  });

  describe('enqueueTask', () => {
    it('adds a task to the store', () => {
      enqueueTask({
        type: 'npc_memory_compress',
        targetId: 'npc_001',
        entryIds: ['e1', 'e2'],
        baseVersion: 0,
        priority: 2,
        triggerReason: 'threshold',
      });
      const { tasks } = summarizerQueueStore.getState();
      expect(tasks.length).toBe(1);
      expect(tasks[0]!.type).toBe('npc_memory_compress');
      expect(tasks[0]!.targetId).toBe('npc_001');
      expect(tasks[0]!.status).toBe('pending');
      expect(typeof tasks[0]!.id).toBe('string');
      expect(typeof tasks[0]!.createdAt).toBe('string');
    });

    it('deduplicates pending tasks for same targetId+type', () => {
      enqueueTask({
        type: 'npc_memory_compress',
        targetId: 'npc_001',
        entryIds: ['e1'],
        baseVersion: 0,
        priority: 2,
        triggerReason: 'threshold',
      });
      enqueueTask({
        type: 'npc_memory_compress',
        targetId: 'npc_001',
        entryIds: ['e2'],
        baseVersion: 0,
        priority: 2,
        triggerReason: 'threshold',
      });
      expect(summarizerQueueStore.getState().tasks.length).toBe(1);
    });

    it('allows multiple pending tasks for different targetIds', () => {
      enqueueTask({
        type: 'npc_memory_compress',
        targetId: 'npc_001',
        entryIds: ['e1'],
        baseVersion: 0,
        priority: 2,
        triggerReason: 'threshold',
      });
      enqueueTask({
        type: 'npc_memory_compress',
        targetId: 'npc_002',
        entryIds: ['e2'],
        baseVersion: 0,
        priority: 2,
        triggerReason: 'threshold',
      });
      expect(summarizerQueueStore.getState().tasks.length).toBe(2);
    });

    it('sorts tasks by priority ascending (1 first)', () => {
      enqueueTask({
        type: 'npc_memory_compress',
        targetId: 'npc_low',
        entryIds: [],
        baseVersion: 0,
        priority: 3,
        triggerReason: 'interval',
      });
      enqueueTask({
        type: 'chapter_summary',
        targetId: 'chapter_high',
        entryIds: [],
        baseVersion: 0,
        priority: 1,
        triggerReason: 'save_game_completed',
      });
      enqueueTask({
        type: 'turn_log_compress',
        targetId: 'turn_mid',
        entryIds: [],
        baseVersion: 0,
        priority: 2,
        triggerReason: 'interval',
      });
      const { tasks } = summarizerQueueStore.getState();
      expect(tasks[0]!.priority).toBe(1);
      expect(tasks[1]!.priority).toBe(2);
      expect(tasks[2]!.priority).toBe(3);
    });

    it('allows enqueuing same targetId+type if existing task is not pending', () => {
      enqueueTask({
        type: 'npc_memory_compress',
        targetId: 'npc_001',
        entryIds: ['e1'],
        baseVersion: 0,
        priority: 2,
        triggerReason: 'threshold',
      });
      const task = summarizerQueueStore.getState().tasks[0]!;
      markDone(task.id);
      enqueueTask({
        type: 'npc_memory_compress',
        targetId: 'npc_001',
        entryIds: ['e2'],
        baseVersion: 1,
        priority: 2,
        triggerReason: 'threshold',
      });
      expect(summarizerQueueStore.getState().tasks.length).toBe(2);
    });
  });

  describe('dequeuePending', () => {
    it('returns null when no pending tasks', () => {
      expect(dequeuePending()).toBeNull();
    });

    it('returns highest-priority pending task', () => {
      enqueueTask({
        type: 'npc_memory_compress',
        targetId: 'npc_low',
        entryIds: [],
        baseVersion: 0,
        priority: 3,
        triggerReason: 'interval',
      });
      enqueueTask({
        type: 'chapter_summary',
        targetId: 'chapter_high',
        entryIds: [],
        baseVersion: 0,
        priority: 1,
        triggerReason: 'save_game_completed',
      });
      const task = dequeuePending();
      expect(task).not.toBeNull();
      expect(task!.priority).toBe(1);
      expect(task!.targetId).toBe('chapter_high');
    });

    it('does not mutate store state', () => {
      enqueueTask({
        type: 'npc_memory_compress',
        targetId: 'npc_001',
        entryIds: [],
        baseVersion: 0,
        priority: 2,
        triggerReason: 'threshold',
      });
      dequeuePending();
      expect(summarizerQueueStore.getState().tasks[0]!.status).toBe('pending');
    });

    it('skips running tasks and returns next pending', () => {
      enqueueTask({
        type: 'chapter_summary',
        targetId: 'chapter_001',
        entryIds: [],
        baseVersion: 0,
        priority: 1,
        triggerReason: 'save_game_completed',
      });
      enqueueTask({
        type: 'npc_memory_compress',
        targetId: 'npc_001',
        entryIds: [],
        baseVersion: 0,
        priority: 2,
        triggerReason: 'threshold',
      });
      const firstTask = summarizerQueueStore.getState().tasks[0]!;
      markRunning(firstTask.id);
      const next = dequeuePending();
      expect(next).not.toBeNull();
      expect(next!.targetId).toBe('npc_001');
    });
  });

  describe('markRunning', () => {
    it('updates task status to running', () => {
      enqueueTask({
        type: 'npc_memory_compress',
        targetId: 'npc_001',
        entryIds: [],
        baseVersion: 0,
        priority: 2,
        triggerReason: 'threshold',
      });
      const task = summarizerQueueStore.getState().tasks[0]!;
      markRunning(task.id);
      expect(summarizerQueueStore.getState().tasks[0]!.status).toBe('running');
    });
  });

  describe('markDone', () => {
    it('updates task status to done', () => {
      enqueueTask({
        type: 'npc_memory_compress',
        targetId: 'npc_001',
        entryIds: [],
        baseVersion: 0,
        priority: 2,
        triggerReason: 'threshold',
      });
      const task = summarizerQueueStore.getState().tasks[0]!;
      markDone(task.id);
      expect(summarizerQueueStore.getState().tasks[0]!.status).toBe('done');
    });

    it('emits summarizer_task_completed event', () => {
      enqueueTask({
        type: 'npc_memory_compress',
        targetId: 'npc_001',
        entryIds: [],
        baseVersion: 0,
        priority: 2,
        triggerReason: 'threshold',
      });
      const task = summarizerQueueStore.getState().tasks[0]!;
      markDone(task.id);
      expect(mockEmit).toHaveBeenCalledWith('summarizer_task_completed', {
        taskId: task.id,
        type: 'npc_memory_compress',
      });
    });
  });

  describe('markFailed', () => {
    it('updates task status to failed', () => {
      enqueueTask({
        type: 'npc_memory_compress',
        targetId: 'npc_001',
        entryIds: [],
        baseVersion: 0,
        priority: 2,
        triggerReason: 'threshold',
      });
      const task = summarizerQueueStore.getState().tasks[0]!;
      markFailed(task.id);
      expect(summarizerQueueStore.getState().tasks[0]!.status).toBe('failed');
    });
  });
});
