import { z } from 'zod';
import { createStore, type Store } from './create-store';
import { eventBus } from '../events/event-bus';
import type { EventBus } from '../events/event-bus';

export const NpcDispositionSchema = z.object({
  value: z.number().min(-100).max(100),
  publicReputation: z.number().min(-100).max(100),
  personalTrust: z.number().min(-100).max(100),
  fear: z.number().min(-100).max(100),
  infamy: z.number().min(-100).max(100),
  credibility: z.number().min(-100).max(100),
});
export type NpcDisposition = z.infer<typeof NpcDispositionSchema>;

export const RelationStateSchema = z.object({
  npcDispositions: z.record(z.string(), NpcDispositionSchema),
  factionReputations: z.record(z.string(), z.number().min(-100).max(100)),
});
export type RelationState = z.infer<typeof RelationStateSchema>;

export function getDefaultNpcDisposition(): NpcDisposition {
  return { value: 0, publicReputation: 0, personalTrust: 0, fear: 0, infamy: 0, credibility: 0 };
}

export function getDefaultRelationState(): RelationState {
  return { npcDispositions: {}, factionReputations: {} };
}

export function createRelationStore(bus: EventBus): Store<RelationState> {
  return createStore<RelationState>(
    getDefaultRelationState(),
    ({ newState, oldState }) => {
      const allNpcIds = new Set([
        ...Object.keys(newState.npcDispositions),
        ...Object.keys(oldState.npcDispositions),
      ]);
      for (const npcId of allNpcIds) {
        const newDisp = newState.npcDispositions[npcId];
        const oldDisp = oldState.npcDispositions[npcId];
        const newValue = newDisp?.value ?? 0;
        const oldValue = oldDisp?.value ?? 0;
        if (newValue !== oldValue) {
          bus.emit('reputation_changed', {
            targetId: npcId,
            targetType: 'npc',
            delta: newValue - oldValue,
            newValue,
          });
        }
      }

      const allFactionIds = new Set([
        ...Object.keys(newState.factionReputations),
        ...Object.keys(oldState.factionReputations),
      ]);
      for (const factionId of allFactionIds) {
        const newValue = newState.factionReputations[factionId] ?? 0;
        const oldValue = oldState.factionReputations[factionId] ?? 0;
        if (newValue !== oldValue) {
          bus.emit('reputation_changed', {
            targetId: factionId,
            targetType: 'faction',
            delta: newValue - oldValue,
            newValue,
          });
        }
      }
    },
  );
}

export const relationStore = createRelationStore(eventBus);
