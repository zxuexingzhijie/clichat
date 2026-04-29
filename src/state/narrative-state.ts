import { z } from 'zod';
import { createStore, type Store } from './create-store';

export const NarrativeActSchema = z.enum(['act1', 'act2', 'act3']);
export type NarrativeAct = z.infer<typeof NarrativeActSchema>;

export const NarrativeStateSchema = z.object({
  currentAct: NarrativeActSchema.default('act1'),
  atmosphereTags: z.array(z.string()).default(['mundane', 'curious']),
  worldFlags: z.record(z.string(), z.boolean()).default({}),
  playerKnowledgeLevel: z.number().int().min(0).max(5).default(0),
});
export type NarrativeState = z.infer<typeof NarrativeStateSchema>;

export function getDefaultNarrativeState(): NarrativeState {
  return NarrativeStateSchema.parse({});
}

export type NarrativeStore = Store<NarrativeState> & {
  restoreState: (data: NarrativeState) => void;
};

export function createNarrativeStore(): NarrativeStore {
  const store = createStore<NarrativeState>(getDefaultNarrativeState(), () => {});

  function restoreState(data: NarrativeState): void {
    store.setState(draft => { Object.assign(draft, data); });
  }

  return { ...store, restoreState };
}

export const narrativeStore = createNarrativeStore();
