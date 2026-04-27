import { describe, it, expect } from 'bun:test';
import mitt from 'mitt';
import type { DomainEvents } from '../../events/event-types';
import { createQuestStore } from '../quest-store';
import { createGameStore } from '../game-store';

describe('questEventLog in store', () => {
  it('appends events into store state', () => {
    const bus = mitt<DomainEvents>();
    const gameStore = createGameStore(bus);
    const store = createQuestStore(bus, { getGameState: () => gameStore.getState() });

    store.setState((d) => {
      d.eventLog = [
        ...d.eventLog,
        {
          id: 'e1',
          questId: 'q1',
          type: 'quest_started',
          turnNumber: 1,
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      ];
    });

    expect(store.getState().eventLog).toHaveLength(1);
    expect(store.getState().eventLog[0]!.questId).toBe('q1');
  });

  it('is isolated per store instance', () => {
    const bus = mitt<DomainEvents>();
    const gameStore = createGameStore(bus);
    const store1 = createQuestStore(bus, { getGameState: () => gameStore.getState() });
    const store2 = createQuestStore(bus, { getGameState: () => gameStore.getState() });

    store1.setState((d) => {
      d.eventLog = [{
        id: 'e1', questId: 'q1', type: 'quest_started',
        turnNumber: 1, timestamp: '',
      }];
    });

    expect(store2.getState().eventLog).toHaveLength(0);
  });
});
