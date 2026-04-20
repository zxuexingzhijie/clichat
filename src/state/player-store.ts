import { z } from 'zod';
import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';
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
    tags: ['newcomer'],
    equipment: { weapon: null, armor: null, accessory: null },
  };
}

export const playerStore = createStore<PlayerState>(
  getDefaultPlayerState(),
  ({ newState, oldState }) => {
    if (newState.hp !== oldState.hp) {
      const delta = newState.hp - oldState.hp;
      if (delta < 0) {
        eventBus.emit('player_damaged', { amount: Math.abs(delta), source: 'unknown' });
      } else {
        eventBus.emit('player_healed', { amount: delta, source: 'unknown' });
      }
    }
    if (newState.gold !== oldState.gold) {
      eventBus.emit('gold_changed', { delta: newState.gold - oldState.gold, newTotal: newState.gold });
    }
  },
);
