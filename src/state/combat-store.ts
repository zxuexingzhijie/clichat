import { z } from 'zod';
import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';

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
});
export type CombatState = z.infer<typeof CombatStateSchema>;

export function getDefaultCombatState(): CombatState {
  return {
    active: false,
    turnOrder: [],
    currentTurnIndex: 0,
    enemies: [],
    roundNumber: 0,
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
      eventBus.emit('combat_ended', { outcome: 'victory' });
    }
  },
);
