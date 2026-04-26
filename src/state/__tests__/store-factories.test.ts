import { describe, it, expect } from 'bun:test';
import mitt from 'mitt';
import type { DomainEvents } from '../../events/event-types';
import { createPlayerStore, getDefaultPlayerState } from '../player-store';

describe('createPlayerStore', () => {
  it('creates an isolated store with default state', () => {
    const bus = mitt<DomainEvents>();
    const store = createPlayerStore(bus);
    expect(store.getState()).toEqual(getDefaultPlayerState());
  });

  it('emits player_damaged on the injected eventBus', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('player_damaged', (e) => events.push(e));

    const store = createPlayerStore(bus);
    store.setState((draft) => { draft.hp = 20; });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ amount: 10, source: 'unknown' });
  });

  it('emits player_healed when hp increases', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('player_healed', (e) => events.push(e));

    const store = createPlayerStore(bus);
    store.setState((draft) => { draft.hp = 30; draft.maxHp = 50; });

    expect(events).toHaveLength(0);

    store.setState((draft) => { draft.hp = 40; });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ amount: 10, source: 'unknown' });
  });

  it('emits gold_changed when gold changes', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('gold_changed', (e) => events.push(e));

    const store = createPlayerStore(bus);
    store.setState((draft) => { draft.gold = 20; });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ delta: 8, newTotal: 20 });
  });

  it('does not affect another store instance', () => {
    const bus1 = mitt<DomainEvents>();
    const bus2 = mitt<DomainEvents>();
    const store1 = createPlayerStore(bus1);
    const store2 = createPlayerStore(bus2);

    store1.setState((draft) => { draft.hp = 5; });
    expect(store2.getState().hp).toBe(getDefaultPlayerState().hp);
  });

  it('does not emit events on the other bus', () => {
    const bus1 = mitt<DomainEvents>();
    const bus2 = mitt<DomainEvents>();
    const events2: unknown[] = [];
    bus2.on('player_damaged', (e) => events2.push(e));

    const store1 = createPlayerStore(bus1);
    createPlayerStore(bus2);

    store1.setState((draft) => { draft.hp = 5; });
    expect(events2).toHaveLength(0);
  });
});
