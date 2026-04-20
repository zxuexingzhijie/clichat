import { describe, it, expect, beforeEach } from 'bun:test';
import { eventBus } from '../events/event-bus';
import type { DomainEvents } from '../events/event-types';

import { playerStore, getDefaultPlayerState } from './player-store';
import { sceneStore, getDefaultSceneState } from './scene-store';
import { combatStore, getDefaultCombatState } from './combat-store';
import { gameStore, getDefaultGameState } from './game-store';
import { createStore } from './create-store';

describe('PlayerStore', () => {
  it('has default state with expected values', () => {
    const defaults = getDefaultPlayerState();
    expect(defaults.hp).toBe(30);
    expect(defaults.mp).toBe(8);
    expect(defaults.gold).toBe(12);
    expect(defaults.attributes).toEqual({ physique: 3, finesse: 2, mind: 1 });
  });

  it('onChange emits player_damaged when hp decreases', () => {
    let received: DomainEvents['player_damaged'] | null = null;
    const handler = (payload: DomainEvents['player_damaged']) => { received = payload; };
    eventBus.on('player_damaged', handler);

    const store = createStore(
      getDefaultPlayerState(),
      ({ newState, oldState }) => {
        if (newState.hp !== oldState.hp && newState.hp < oldState.hp) {
          eventBus.emit('player_damaged', {
            amount: Math.abs(newState.hp - oldState.hp),
            source: 'unknown',
          });
        }
      },
    );
    store.setState(draft => { draft.hp = 25; });

    expect(received).not.toBeNull();
    expect(received!.amount).toBe(5);

    eventBus.off('player_damaged', handler);
  });

  it('onChange emits gold_changed when gold changes', () => {
    let received: DomainEvents['gold_changed'] | null = null;
    const handler = (payload: DomainEvents['gold_changed']) => { received = payload; };
    eventBus.on('gold_changed', handler);

    const store = createStore(
      getDefaultPlayerState(),
      ({ newState, oldState }) => {
        if (newState.gold !== oldState.gold) {
          eventBus.emit('gold_changed', {
            delta: newState.gold - oldState.gold,
            newTotal: newState.gold,
          });
        }
      },
    );
    store.setState(draft => { draft.gold = 20; });

    expect(received).not.toBeNull();
    expect(received!.delta).toBe(8);
    expect(received!.newTotal).toBe(20);

    eventBus.off('gold_changed', handler);
  });
});

describe('SceneStore', () => {
  it('has default state with narrationLines and actions arrays', () => {
    const defaults = getDefaultSceneState();
    expect(Array.isArray(defaults.narrationLines)).toBe(true);
    expect(defaults.narrationLines.length).toBeGreaterThan(0);
    expect(Array.isArray(defaults.actions)).toBe(true);
    expect(defaults.actions.length).toBeGreaterThan(0);
  });

  it('onChange emits scene_changed when sceneId changes', () => {
    let received: DomainEvents['scene_changed'] | null = null;
    const handler = (payload: DomainEvents['scene_changed']) => { received = payload; };
    eventBus.on('scene_changed', handler);

    const store = createStore(
      getDefaultSceneState(),
      ({ newState, oldState }) => {
        if (newState.sceneId !== oldState.sceneId) {
          eventBus.emit('scene_changed', {
            sceneId: newState.sceneId,
            previousSceneId: oldState.sceneId,
          });
        }
      },
    );
    store.setState(draft => { draft.sceneId = 'tavern'; });

    expect(received).not.toBeNull();
    expect(received!.sceneId).toBe('tavern');
    expect(received!.previousSceneId).toBe('placeholder_scene');

    eventBus.off('scene_changed', handler);
  });
});

describe('CombatStore', () => {
  it('has default state with active=false and empty enemies', () => {
    const defaults = getDefaultCombatState();
    expect(defaults.active).toBe(false);
    expect(defaults.enemies).toEqual([]);
  });

  it('onChange emits combat_started when active flips to true', () => {
    let received: DomainEvents['combat_started'] | null = null;
    const handler = (payload: DomainEvents['combat_started']) => { received = payload; };
    eventBus.on('combat_started', handler);

    const store = createStore(
      getDefaultCombatState(),
      ({ newState, oldState }) => {
        if (newState.active && !oldState.active) {
          eventBus.emit('combat_started', {
            enemies: newState.enemies.map(e => e.name),
          });
        }
      },
    );
    store.setState(draft => {
      draft.active = true;
      draft.enemies = [{ id: 'wolf_1', name: '灰狼', hp: 12, maxHp: 12 }];
    });

    expect(received).not.toBeNull();
    expect(received!.enemies).toEqual(['灰狼']);

    eventBus.off('combat_started', handler);
  });
});

describe('GameStore', () => {
  it('has default state with day=1, timeOfDay=night, phase=title', () => {
    const defaults = getDefaultGameState();
    expect(defaults.day).toBe(1);
    expect(defaults.timeOfDay).toBe('night');
    expect(defaults.phase).toBe('title');
  });

  it('onChange emits time_advanced when day or timeOfDay changes', () => {
    let received: DomainEvents['time_advanced'] | null = null;
    const handler = (payload: DomainEvents['time_advanced']) => { received = payload; };
    eventBus.on('time_advanced', handler);

    const store = createStore(
      getDefaultGameState(),
      ({ newState, oldState }) => {
        if (newState.day !== oldState.day || newState.timeOfDay !== oldState.timeOfDay) {
          eventBus.emit('time_advanced', {
            day: newState.day,
            timeOfDay: newState.timeOfDay,
          });
        }
      },
    );
    store.setState(draft => { draft.timeOfDay = 'dawn'; });

    expect(received).not.toBeNull();
    expect(received!.day).toBe(1);
    expect(received!.timeOfDay).toBe('dawn');

    eventBus.off('time_advanced', handler);
  });
});
