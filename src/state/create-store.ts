import { produce, type Draft } from 'immer';

type Listener = () => void;
type OnChange<T> = (args: { newState: T; oldState: T }) => void;

export type Store<T> = {
  getState: () => T;
  setState: (recipe: (draft: Draft<T>) => void) => void;
  subscribe: (listener: Listener) => () => void;
};

export function createStore<T>(
  initialState: T,
  onChange?: OnChange<T>,
): Store<T> {
  let state = initialState;
  const listeners = new Set<Listener>();

  return {
    getState: () => state,

    setState: (recipe: (draft: Draft<T>) => void) => {
      const prev = state;
      const next = produce(prev, recipe);
      if (Object.is(next, prev)) return;
      state = next;
      onChange?.({ newState: next, oldState: prev });
      for (const listener of listeners) listener();
    },

    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
