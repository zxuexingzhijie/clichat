import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { eventBus } from '../events/event-bus';
import { explorationStore, getDefaultExplorationState } from '../state/exploration-store';
import { gameStore, getDefaultGameState } from '../state/game-store';

describe('ExplorationTracker', () => {
  let cleanup: (() => void) | null = null;

  beforeEach(() => {
    explorationStore.setState(() => getDefaultExplorationState());
    gameStore.setState(() => getDefaultGameState());
    cleanup = null;
  });

  afterEach(() => {
    if (cleanup) cleanup();
    eventBus.all.clear();
  });

  test('initExplorationTracker registers a scene_changed listener', async () => {
    const { initExplorationTracker } = await import('./exploration-tracker');
    cleanup = initExplorationTracker();

    gameStore.setState(draft => { draft.turnCount = 1; });
    eventBus.emit('scene_changed', { sceneId: 'loc_test', previousSceneId: null });

    const state = explorationStore.getState();
    expect(state.locations['loc_test']).toBeDefined();
  });

  test('scene_changed for a new location adds it with level visited', async () => {
    const { initExplorationTracker } = await import('./exploration-tracker');
    cleanup = initExplorationTracker();

    gameStore.setState(draft => { draft.turnCount = 3; });
    eventBus.emit('scene_changed', { sceneId: 'loc_tavern', previousSceneId: null });

    const loc = explorationStore.getState().locations['loc_tavern'];
    expect(loc).toBeDefined();
    expect(loc!.level).toBe('visited');
  });

  test('scene_changed for an already-visited location does not downgrade level', async () => {
    const { initExplorationTracker } = await import('./exploration-tracker');
    cleanup = initExplorationTracker();

    explorationStore.setState(draft => {
      draft.locations['loc_tavern'] = {
        locationId: 'loc_tavern',
        level: 'surveyed',
        discoveredAt: 1,
        discoverySource: 'map',
        credibility: 1.0,
        description: 'A tavern',
        discoveredPOIs: [],
      };
    });

    gameStore.setState(draft => { draft.turnCount = 5; });
    eventBus.emit('scene_changed', { sceneId: 'loc_tavern', previousSceneId: null });

    const loc = explorationStore.getState().locations['loc_tavern'];
    expect(loc!.level).toBe('surveyed');
  });

  test('scene_changed for a rumored location upgrades it to visited', async () => {
    const { initExplorationTracker } = await import('./exploration-tracker');
    cleanup = initExplorationTracker();

    explorationStore.setState(draft => {
      draft.locations['loc_forest'] = {
        locationId: 'loc_forest',
        level: 'rumored',
        discoveredAt: 1,
        discoverySource: 'npc',
        credibility: 0.5,
        description: 'A forest',
        discoveredPOIs: [],
      };
    });

    gameStore.setState(draft => { draft.turnCount = 7; });
    eventBus.emit('scene_changed', { sceneId: 'loc_forest', previousSceneId: null });

    const loc = explorationStore.getState().locations['loc_forest'];
    expect(loc!.level).toBe('visited');
  });

  test('scene_changed for a known location upgrades it to visited', async () => {
    const { initExplorationTracker } = await import('./exploration-tracker');
    cleanup = initExplorationTracker();

    explorationStore.setState(draft => {
      draft.locations['loc_tower'] = {
        locationId: 'loc_tower',
        level: 'known',
        discoveredAt: 2,
        discoverySource: 'map',
        credibility: 0.7,
        description: 'A tower',
        discoveredPOIs: [],
      };
    });

    gameStore.setState(draft => { draft.turnCount = 10; });
    eventBus.emit('scene_changed', { sceneId: 'loc_tower', previousSceneId: null });

    const loc = explorationStore.getState().locations['loc_tower'];
    expect(loc!.level).toBe('visited');
  });

  test('exploration entry has correct discoverySource, discoveredAt, credibility', async () => {
    const { initExplorationTracker } = await import('./exploration-tracker');
    cleanup = initExplorationTracker();

    gameStore.setState(draft => { draft.turnCount = 42; });
    eventBus.emit('scene_changed', { sceneId: 'loc_plaza', previousSceneId: 'loc_gate' });

    const loc = explorationStore.getState().locations['loc_plaza'];
    expect(loc).toBeDefined();
    expect(loc!.discoverySource).toBe('scene_visit');
    expect(loc!.discoveredAt).toBe(42);
    expect(loc!.credibility).toBe(1.0);
  });

  test('markLocationLevel sets rumored for unknown location', async () => {
    const { markLocationLevel, initExplorationTracker } = await import('./exploration-tracker');
    cleanup = initExplorationTracker();

    gameStore.setState(draft => { draft.turnCount = 5; });
    markLocationLevel('loc_x', 'rumored', 'npc_dialogue', 0.5);

    const loc = explorationStore.getState().locations['loc_x'];
    expect(loc).toBeDefined();
    expect(loc!.level).toBe('rumored');
    expect(loc!.discoverySource).toBe('npc_dialogue');
    expect(loc!.credibility).toBe(0.5);
  });

  test('markLocationLevel does not downgrade visited to rumored', async () => {
    const { markLocationLevel, initExplorationTracker } = await import('./exploration-tracker');
    cleanup = initExplorationTracker();

    explorationStore.setState(draft => {
      draft.locations['loc_y'] = {
        locationId: 'loc_y',
        level: 'visited',
        discoveredAt: 1,
        discoverySource: 'scene_visit',
        credibility: 1.0,
        description: '',
        discoveredPOIs: [],
      };
    });

    markLocationLevel('loc_y', 'rumored', 'npc_dialogue', 0.5);

    const loc = explorationStore.getState().locations['loc_y'];
    expect(loc!.level).toBe('visited');
  });
});
