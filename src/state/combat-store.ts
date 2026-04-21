import { z } from 'zod';
import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';
import { CheckResultSchema } from '../types/common';

export const CombatStateSchema = z.object({
  active: z.boolean(),
  turnOrder: z.array(z.string()),
  currentTurnIndex: z.number(),
  enemies: z.array(z.object({
    id: z.string(),
    name: z.string(),
    hp: z.number(),
    maxHp: z.number(),
  })),
  roundNumber: z.number(),
  phase: z.enum(['init', 'player_turn', 'resolving', 'narrating', 'enemy_turn', 'check_end', 'ended']),
  lastCheckResult: CheckResultSchema.nullable(),
  lastNarration: z.string(),
  guardActive: z.boolean(),
});
export type CombatState = z.infer<typeof CombatStateSchema>;

export function getDefaultCombatState(): CombatState {
  return {
    active: false,
    turnOrder: [],
    currentTurnIndex: 0,
    enemies: [],
    roundNumber: 0,
    phase: 'init',
    lastCheckResult: null,
    lastNarration: '',
    guardActive: false,
  };
}

export const combatStore = createStore<CombatState>(
  getDefaultCombatState(),
  ({ newState, oldState }) => {
    if (newState.active && !oldState.active) {
      eventBus.emit('combat_started', {
        enemies: newState.enemies.map(e => e.name),
      });
    }
    if (!newState.active && oldState.active) {
      const outcome = newState.phase === 'ended' ? 'ended' : 'victory';
      eventBus.emit('combat_ended', { outcome });
    }
    if (newState.currentTurnIndex !== oldState.currentTurnIndex) {
      eventBus.emit('combat_turn_advanced', {
        currentTurnIndex: newState.currentTurnIndex,
        turnOrder: newState.turnOrder,
      });
    }
  },
);
