import { describe, it, expect } from 'bun:test';
import { createStore } from './create-store';

describe('createStore', () => {
  it('returns object with getState, setState, subscribe', () => {
    const store = createStore({ count: 0 });
    expect(typeof store.getState).toBe('function');
    expect(typeof store.setState).toBe('function');
    expect(typeof store.subscribe).toBe('function');
  });

  it('getState returns initial state', () => {
    const store = createStore({ count: 0, name: 'test' });
    expect(store.getState()).toEqual({ count: 0, name: 'test' });
  });

  it('setState with immer recipe mutates draft and produces new immutable state', () => {
    const store = createStore({ count: 0, items: ['a'] });
    const before = store.getState();
    store.setState(draft => {
      draft.count = 5;
      draft.items.push('b');
    });
    const after = store.getState();
    expect(after.count).toBe(5);
    expect(after.items).toEqual(['a', 'b']);
    expect(before.count).toBe(0);
    expect(before.items).toEqual(['a']);
    expect(before).not.toBe(after);
  });

  it('subscribe listener fires on state change', () => {
    const store = createStore({ value: 0 });
    let callCount = 0;
    store.subscribe(() => { callCount++; });
    store.setState(draft => { draft.value = 1; });
    expect(callCount).toBe(1);
    store.setState(draft => { draft.value = 2; });
    expect(callCount).toBe(2);
  });

  it('subscribe returns unsubscribe function that stops notifications', () => {
    const store = createStore({ value: 0 });
    let callCount = 0;
    const unsub = store.subscribe(() => { callCount++; });
    store.setState(draft => { draft.value = 1; });
    expect(callCount).toBe(1);
    unsub();
    store.setState(draft => { draft.value = 2; });
    expect(callCount).toBe(1);
  });

  it('setState is no-op when immer produce returns identical state', () => {
    const store = createStore({ value: 42 });
    let callCount = 0;
    store.subscribe(() => { callCount++; });
    store.setState(_draft => {
      // no mutations -- immer returns same reference
    });
    expect(callCount).toBe(0);
    expect(store.getState().value).toBe(42);
  });

  it('onChange callback receives { newState, oldState } with correct values', () => {
    let captured: { newState: { value: number }; oldState: { value: number } } | null = null;
    const store = createStore(
      { value: 10 },
      (args) => { captured = args; },
    );
    store.setState(draft => { draft.value = 20; });
    expect(captured).not.toBeNull();
    expect(captured!.oldState.value).toBe(10);
    expect(captured!.newState.value).toBe(20);
  });

  it('onChange is not called when state does not change', () => {
    let called = false;
    const store = createStore(
      { value: 10 },
      () => { called = true; },
    );
    store.setState(_draft => {});
    expect(called).toBe(false);
  });
});
