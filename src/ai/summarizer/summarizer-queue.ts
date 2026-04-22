import { z } from 'zod';
import { nanoid } from 'nanoid';
import { createStore } from '../../state/create-store';
import { eventBus } from '../../events/event-bus';

export const COOLDOWN_MS = 30000;

export const SummarizerTaskSchema = z.object({
  id: z.string(),
  type: z.enum(['chapter_summary', 'npc_memory_compress', 'turn_log_compress']),
  targetId: z.string(),
  entryIds: z.array(z.string()).readonly(),
  baseVersion: z.number().int(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  triggerReason: z.string(),
  createdAt: z.string(),
  status: z.enum(['pending', 'running', 'done', 'failed']),
});

export type SummarizerTask = z.infer<typeof SummarizerTaskSchema>;

export type SummarizerQueueState = {
  readonly tasks: readonly SummarizerTask[];
  readonly isRunning: boolean;
  readonly cooldownUntil: string | null;
};

function getDefaultState(): SummarizerQueueState {
  return { tasks: [], isRunning: false, cooldownUntil: null };
}

export const summarizerQueueStore = createStore<SummarizerQueueState>(
  getDefaultState(),
  () => {},
);

export function enqueueTask(
  task: Omit<SummarizerTask, 'id' | 'createdAt' | 'status'>,
): void {
  const state = summarizerQueueStore.getState();

  const hasPending = state.tasks.some(
    (t) => t.targetId === task.targetId && t.type === task.type && t.status === 'pending',
  );
  if (hasPending) return;

  if (state.cooldownUntil !== null) {
    const cooldown = new Date(state.cooldownUntil).getTime();
    if (Date.now() < cooldown) return;
  }

  const newTask: SummarizerTask = {
    ...task,
    id: nanoid(),
    createdAt: new Date().toISOString(),
    status: 'pending',
  };

  summarizerQueueStore.setState((draft) => {
    const inserted = [...draft.tasks, newTask].sort((a, b) => a.priority - b.priority);
    draft.tasks = inserted as SummarizerTask[];
  });
}

export function dequeuePending(): SummarizerTask | null {
  const { tasks } = summarizerQueueStore.getState();
  return tasks.find((t) => t.status === 'pending') ?? null;
}

export function markRunning(taskId: string): void {
  summarizerQueueStore.setState((draft) => {
    const task = draft.tasks.find((t) => t.id === taskId);
    if (task) task.status = 'running';
  });
}

export function markDone(taskId: string): void {
  let completedType = '';
  summarizerQueueStore.setState((draft) => {
    const task = draft.tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = 'done';
      completedType = task.type;
    }
  });
  if (completedType) {
    eventBus.emit('summarizer_task_completed', { taskId, type: completedType });
  }
}

export function markFailed(taskId: string): void {
  summarizerQueueStore.setState((draft) => {
    const task = draft.tasks.find((t) => t.id === taskId);
    if (task) task.status = 'failed';
  });
}
