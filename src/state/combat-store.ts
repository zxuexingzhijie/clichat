import { z } from 'zod';
import { createStore, type Store } from './create-store';
import { eventBus } from '../events/event-bus';
import type { EventBus } from '../events/event-bus';
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
  howlActive: z.boolean(),
  outcome: z.enum(['victory', 'defeat', 'flee']).nullable(),
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
    howlActive: false,
    outcome: null,
  };
}

export function createCombatStore(bus: EventBus): Store<CombatState> {
  return createStore<CombatState>(
    getDefaultCombatState(),
    ({ newState, oldState }) => {
      if (newState.active && !oldState.active) {
        bus.emit('combat_started', {
          enemies: newState.enemies.map(e => e.name),
        });
      }
      if (!newState.active && oldState.active) {
        bus.emit('combat_ended', { outcome: newState.outcome ?? 'victory', enemyIds: newState.enemies.map(e => e.id) });
      }
      if (newState.currentTurnIndex !== oldState.currentTurnIndex) {
        const currentActorId = newState.turnOrder[newState.currentTurnIndex] ?? 'player';
        bus.emit('combat_turn_advanced', {
          currentActorId,
          roundNumber: newState.roundNumber,
        });
      }
    },
  );
}

export const combatStore = createCombatStore(eventBus);
