import { z } from 'zod';
import { createStore, type Store } from './create-store';
import { eventBus } from '../events/event-bus';
import type { EventBus } from '../events/event-bus';
import { AttributeNameSchema } from '../types/common';

export const PlayerStateSchema = z.object({
  name: z.string(),
  race: z.string(),
  profession: z.string(),
  hp: z.number(),
  maxHp: z.number(),
  mp: z.number(),
  maxMp: z.number(),
  gold: z.number(),
  attributes: z.record(AttributeNameSchema, z.number()),
  tags: z.array(z.string()),
  equipment: z.record(z.string(), z.string().nullable()),
  poisonStacks: z.number().default(0),
});
export type PlayerState = z.infer<typeof PlayerStateSchema>;

export function getDefaultPlayerState(): PlayerState {
  return {
    name: '旅人',
    race: '人类',
    profession: '冒险者',
    hp: 30,
    maxHp: 30,
    mp: 8,
    maxMp: 8,
    gold: 12,
    attributes: { physique: 3, finesse: 2, mind: 1 },
    tags: ['newcomer', 'item:item_healing_potion'],
    equipment: { weapon: null, armor: null, accessory: null },
    poisonStacks: 0,
  };
}

export function createPlayerStore(bus: EventBus): Store<PlayerState> {
  return createStore<PlayerState>(
    getDefaultPlayerState(),
    ({ newState, oldState }) => {
      if (newState.hp !== oldState.hp) {
        const delta = newState.hp - oldState.hp;
        if (delta < 0) {
          bus.emit('player_damaged', { amount: Math.abs(delta), source: 'unknown' });
        } else {
          bus.emit('player_healed', { amount: delta, source: 'unknown' });
        }
      }
      if (newState.gold !== oldState.gold) {
        bus.emit('gold_changed', { delta: newState.gold - oldState.gold, newTotal: newState.gold });
      }
    },
  );
}

export const playerStore = createPlayerStore(eventBus);
