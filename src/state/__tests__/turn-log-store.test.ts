import { describe, it, expect } from 'bun:test';
import mitt from 'mitt';
import type { DomainEvents } from '../../events/event-types';
import { createTurnLogStore } from '../turn-log-store';

describe('TurnLogStore', () => {
  it('appends entries to store state', () => {
    const bus = mitt<DomainEvents>();
    const store = createTurnLogStore(bus);

    store.setState((d) => {
      d.entries = [...d.entries, {
        turnNumber: 1,
        action: 'look',
        checkResult: null,
        narrationLines: ['You look around.'],
        timestamp: '2026-01-01T00:00:00.000Z',
      }];
    });

    expect(store.getState().entries).toHaveLength(1);
  });

  it('is isolated per instance', () => {
    const bus = mitt<DomainEvents>();
    const s1 = createTurnLogStore(bus);
    const s2 = createTurnLogStore(bus);

    s1.setState((d) => {
      d.entries = [{ turnNumber: 1, action: 'look', checkResult: null, narrationLines: [], timestamp: '' }];
    });

    expect(s2.getState().entries).toHaveLength(0);
  });
});
