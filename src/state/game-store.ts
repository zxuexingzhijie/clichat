import { z } from 'zod';
import { createStore, type Store } from './create-store';
import { eventBus } from '../events/event-bus';
import type { EventBus } from '../events/event-bus';
import { TimeOfDaySchema } from '../types/common';

export const GamePhaseSchema = z.enum(['title', 'narrative_creation', 'game', 'combat', 'dialogue', 'journal', 'map', 'codex', 'branch_tree', 'compare', 'shortcuts', 'replay', 'cost', 'chapter_summary']);

export const GameStateSchema = z.object({
  day: z.number().int().min(1),
  timeOfDay: TimeOfDaySchema,
  phase: z.preprocess(
    (val) => (val === 'character_creation' ? 'title' : val),
    GamePhaseSchema,
  ),
  turnCount: z.number().int().min(0),
  isDarkTheme: z.boolean(),
  pendingQuit: z.boolean(),
});
export type GameState = z.infer<typeof GameStateSchema>;

export function getDefaultGameState(): GameState {
  return {
    day: 1,
    timeOfDay: 'night',
    phase: 'title',
    turnCount: 0,
    isDarkTheme: true,
    pendingQuit: false,
  };
}

export function createGameStore(bus: EventBus): Store<GameState> {
  return createStore<GameState>(
    getDefaultGameState(),
    ({ newState, oldState }) => {
      if (newState.day !== oldState.day || newState.timeOfDay !== oldState.timeOfDay) {
        bus.emit('time_advanced', { day: newState.day, timeOfDay: newState.timeOfDay });
      }
      if (newState.phase !== oldState.phase) {
        bus.emit('game_phase_changed', { phase: newState.phase });
      }
    },
  );
}

export const gameStore = createGameStore(eventBus);
