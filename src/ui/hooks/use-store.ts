import React, { createContext, useContext, useSyncExternalStore } from 'react';
import type { Store } from '../../state/create-store';

export function createStoreContext<T>() {
  const Context = createContext<Store<T> | null>(null);

  function Provider({ store, children }: { store: Store<T>; children: React.ReactNode }) {
    return React.createElement(Context.Provider, { value: store }, children);
  }

  function useStoreState<S>(selector: (state: T) => S): S {
    const store = useContext(Context);
    if (!store) {
      throw new ReferenceError('useStoreState must be used within a StoreProvider');
    }
    const get = () => selector(store.getState());
    return useSyncExternalStore(store.subscribe, get, get);
  }

  function useSetState() {
    const store = useContext(Context);
    if (!store) {
      throw new ReferenceError('useSetState must be used within a StoreProvider');
    }
    return store.setState;
  }

  return { Provider, useStoreState, useSetState, Context };
}
