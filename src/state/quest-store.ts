import { z } from 'zod';
import { nanoid } from 'nanoid';
import { createStore, type Store } from './create-store';
import { eventBus } from '../events/event-bus';
import type { EventBus } from '../events/event-bus';
import { gameStore, type GameState } from './game-store';

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

export const QuestStateSchema = z.object({
  quests: z.record(z.string(), QuestProgressSchema),
  eventLog: z.array(QuestEventSchema),
});
export type QuestState = z.infer<typeof QuestStateSchema>;

export function getDefaultQuestState(): QuestState {
  return { quests: {}, eventLog: [] };
}

export let questEventLog: QuestEvent[] = [];

export function appendQuestEvent(
  event: Omit<QuestEvent, 'id' | 'timestamp'>,
): void {
  const newEvent: QuestEvent = {
    ...event,
    id: nanoid(),
    timestamp: new Date().toISOString(),
  };
  questEventLog = [...questEventLog, newEvent];
  questStore.setState((d) => {
    d.eventLog = [...d.eventLog, newEvent];
  });
}

export function resetQuestEventLog(): void {
  questEventLog = [];
  questStore.setState((d) => {
    d.eventLog = [];
  });
}

export function restoreQuestEventLog(events: QuestEvent[]): void {
  questEventLog = [...events];
  questStore.setState((d) => {
    d.eventLog = [...events];
  });
}

export function createQuestStore(
  bus: EventBus,
  deps: { getGameState: () => GameState },
): Store<QuestState> {
  return createStore<QuestState>(
    getDefaultQuestState(),
    ({ newState, oldState }) => {
      const turnNumber = deps.getGameState().turnCount;

      for (const questId of Object.keys(newState.quests)) {
        const newProgress = newState.quests[questId]!;
        const oldProgress = oldState.quests[questId];

        if (!oldProgress) {
          if (newProgress.status === 'active') {
            bus.emit('quest_started', {
              questId,
              questTitle: questId,
              turnNumber,
            });
          }
          continue;
        }

        if (oldProgress.status !== 'active' && newProgress.status === 'active') {
          bus.emit('quest_started', {
            questId,
            questTitle: questId,
            turnNumber,
          });
          continue;
        }

        if (oldProgress.status === 'active' && newProgress.status === 'completed') {
          bus.emit('quest_completed', {
            questId,
            rewards: null,
          });
          continue;
        }

        if (oldProgress.status === 'active' && newProgress.status === 'failed') {
          bus.emit('quest_failed', {
            questId,
            reason: 'Quest failed',
          });
          continue;
        }

        if (
          oldProgress.currentStageId !== newProgress.currentStageId &&
          newProgress.currentStageId !== null
        ) {
          bus.emit('quest_stage_advanced', {
            questId,
            newStageId: newProgress.currentStageId,
            turnNumber,
          });
        }
      }
    },
  );
}

export const questStore = createQuestStore(eventBus, {
  getGameState: () => gameStore.getState(),
});
