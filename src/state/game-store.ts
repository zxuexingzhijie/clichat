import { z } from 'zod';
import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';
import { TimeOfDaySchema } from '../types/common';

export const GamePhaseSchema = z.enum(['title', 'character_creation', 'game', 'combat', 'dialogue', 'journal', 'map', 'codex', 'branch_tree', 'compare', 'shortcuts']);

export const GameStateSchema = z.object({
  day: z.number().int().min(1),
  timeOfDay: TimeOfDaySchema,
  phase: GamePhaseSchema,
  turnCount: z.number().int().min(0),
  isDarkTheme: z.boolean(),
});
export type GameState = z.infer<typeof GameStateSchema>;

export function getDefaultGameState(): GameState {
  return {
    day: 1,
    timeOfDay: 'night',
    phase: 'title',
    turnCount: 0,
    isDarkTheme: true,
  };
}

export const gameStore = createStore<GameState>(
  getDefaultGameState(),
  ({ newState, oldState }) => {
    if (newState.day !== oldState.day || newState.timeOfDay !== oldState.timeOfDay) {
      eventBus.emit('time_advanced', { day: newState.day, timeOfDay: newState.timeOfDay });
    }
    if (newState.phase !== oldState.phase) {
      eventBus.emit('game_phase_changed', { phase: newState.phase });
    }
  },
);
