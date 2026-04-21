import { z } from 'zod';
import { nanoid } from 'nanoid';
import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';
import { gameStore } from './game-store';

export const QuestProgressSchema = z.object({
  status: z.enum(['unknown', 'active', 'completed', 'failed']),
  currentStageId: z.string().nullable(),
  completedObjectives: z.array(z.string()),
  discoveredClues: z.array(z.string()),
  flags: z.record(z.string(), z.unknown()),
  acceptedAt: z.number().nullable(),
  completedAt: z.number().nullable(),
});
export type QuestProgress = z.infer<typeof QuestProgressSchema>;

export const QuestStateSchema = z.object({
  quests: z.record(z.string(), QuestProgressSchema),
});
export type QuestState = z.infer<typeof QuestStateSchema>;

export const QuestEventSchema = z.object({
  id: z.string(),
  questId: z.string(),
  type: z.enum([
    'quest_started',
    'objective_completed',
    'clue_discovered',
    'stage_advanced',
    'quest_completed',
    'quest_failed',
  ]),
  turnNumber: z.number(),
  timestamp: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type QuestEvent = z.infer<typeof QuestEventSchema>;

export function getDefaultQuestState(): QuestState {
  return { quests: {} };
}

export let questEventLog: QuestEvent[] = [];

export function appendQuestEvent(
  event: Omit<QuestEvent, 'id' | 'timestamp'>,
): void {
  questEventLog = [
    ...questEventLog,
    {
      ...event,
      id: nanoid(),
      timestamp: new Date().toISOString(),
    },
  ];
}

export function resetQuestEventLog(): void {
  questEventLog = [];
}

export function restoreQuestEventLog(events: QuestEvent[]): void {
  questEventLog = [...events];
}

export const questStore = createStore<QuestState>(
  getDefaultQuestState(),
  ({ newState, oldState }) => {
    const turnNumber = gameStore.getState().turnCount;

    for (const questId of Object.keys(newState.quests)) {
      const newProgress = newState.quests[questId]!;
      const oldProgress = oldState.quests[questId];

      if (!oldProgress) {
        if (newProgress.status === 'active') {
          eventBus.emit('quest_started', {
            questId,
            questTitle: questId,
            turnNumber,
          });
        }
        continue;
      }

      if (oldProgress.status !== 'active' && newProgress.status === 'active') {
        eventBus.emit('quest_started', {
          questId,
          questTitle: questId,
          turnNumber,
        });
        continue;
      }

      if (oldProgress.status === 'active' && newProgress.status === 'completed') {
        eventBus.emit('quest_completed', {
          questId,
          rewards: null,
        });
        continue;
      }

      if (oldProgress.status === 'active' && newProgress.status === 'failed') {
        eventBus.emit('quest_failed', {
          questId,
          reason: 'Quest failed',
        });
        continue;
      }

      if (
        oldProgress.currentStageId !== newProgress.currentStageId &&
        newProgress.currentStageId !== null
      ) {
        eventBus.emit('quest_stage_advanced', {
          questId,
          newStageId: newProgress.currentStageId,
          turnNumber,
        });
      }
    }
  },
);
