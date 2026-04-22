import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { eventBus } from '../events/event-bus';
import {
  ExplorationLevelSchema,
  LocationExplorationSchema,
  ExplorationStateSchema,
  explorationStore,
  getDefaultExplorationState,
} from './exploration-store';

describe('ExplorationLevelSchema', () => {
  test('validates all 5 exploration levels', () => {
    for (const level of ['unknown', 'rumored', 'known', 'visited', 'surveyed'] as const) {
      const parsed = ExplorationLevelSchema.parse(level);
      expect(parsed).toBe(level);
    }
  });

  test('rejects invalid level', () => {
    expect(() => ExplorationLevelSchema.parse('mythical')).toThrow();
  });
});

describe('LocationExplorationSchema', () => {
  test('validates a correct LocationExploration object', () => {
    const loc = {
      locationId: 'loc_01',
      level: 'visited',
      discoveredAt: 5,
      discoverySource: 'exploration',
      credibility: 0.8,
      description: '一座古老的神殿',
      discoveredPOIs: ['poi_01', 'poi_02'],
    };
    const parsed = LocationExplorationSchema.parse(loc);
    expect(parsed.locationId).toBe('loc_01');
    expect(parsed.level).toBe('visited');
    expect(parsed.credibility).toBe(0.8);
    expect(parsed.discoveredPOIs).toHaveLength(2);
  });

  test('rejects credibility out of range', () => {
    expect(() => LocationExplorationSchema.parse({
      locationId: 'loc_01',
      level: 'known',
      discoveredAt: 1,
      discoverySource: 'npc',
      credibility: 1.5,
      description: 'test',
      discoveredPOIs: [],
    })).toThrow();
  });

  test('rejects negative credibility', () => {
    expect(() => LocationExplorationSchema.parse({
      locationId: 'loc_01',
      level: 'known',
      discoveredAt: 1,
      discoverySource: 'npc',
      credibility: -0.1,
      description: 'test',
      discoveredPOIs: [],
    })).toThrow();
  });
});

describe('ExplorationStateSchema', () => {
  test('validates empty locations record', () => {
    const parsed = ExplorationStateSchema.parse({ locations: {} });
    expect(parsed.locations).toEqual({});
  });

  test('validates populated locations record', () => {
    const state = {
      locations: {
        loc_01: {
          locationId: 'loc_01',
          level: 'surveyed',
          discoveredAt: 3,
          discoverySource: 'map',
          credibility: 1.0,
          description: '主城广场',
          discoveredPOIs: ['poi_fountain'],
        },
      },
    };
    const parsed = ExplorationStateSchema.parse(state);
    expect(parsed.locations['loc_01']?.level).toBe('surveyed');
  });
});

describe('explorationStore', () => {
  beforeEach(() => {
    explorationStore.setState(() => getDefaultExplorationState());
  });

  test('default state has empty locations', () => {
    const state = explorationStore.getState();
    expect(state.locations).toEqual({});
  });

  test('default state validates against ExplorationStateSchema', () => {
    const state = getDefaultExplorationState();
    const parsed = ExplorationStateSchema.parse(state);
    expect(parsed.locations).toEqual({});
  });

  test('emits location_explored when a new location key appears', () => {
    const handler = mock(() => {});
    eventBus.on('location_explored', handler);

    explorationStore.setState(draft => {
      draft.locations['loc_01'] = {
        locationId: 'loc_01',
        level: 'rumored',
        discoveredAt: 1,
        discoverySource: 'npc_bartender',
        credibility: 0.5,
        description: '据说北方有一座废弃的塔楼',
        discoveredPOIs: [],
      };
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const call = handler.mock.calls[0][0] as { locationId: string; newLevel: string; previousLevel: string | null };
    expect(call.locationId).toBe('loc_01');
    expect(call.newLevel).toBe('rumored');
    expect(call.previousLevel).toBeNull();

    eventBus.off('location_explored', handler);
  });

  test('emits location_discovery_level_changed when level changes on existing location', () => {
    explorationStore.setState(draft => {
      draft.locations['loc_01'] = {
        locationId: 'loc_01',
        level: 'rumored',
        discoveredAt: 1,
        discoverySource: 'npc',
        credibility: 0.5,
        description: '传闻中的地点',
        discoveredPOIs: [],
      };
    });

    const handler = mock(() => {});
    eventBus.on('location_discovery_level_changed', handler);

    explorationStore.setState(draft => {
      draft.locations['loc_01']!.level = 'visited';
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const call = handler.mock.calls[0][0] as { locationId: string; oldLevel: string; newLevel: string };
    expect(call.locationId).toBe('loc_01');
    expect(call.oldLevel).toBe('rumored');
    expect(call.newLevel).toBe('visited');

    eventBus.off('location_discovery_level_changed', handler);
  });

  test('does not emit when level stays the same', () => {
    explorationStore.setState(draft => {
      draft.locations['loc_01'] = {
        locationId: 'loc_01',
        level: 'known',
        discoveredAt: 1,
        discoverySource: 'map',
        credibility: 0.7,
        description: '已知地点',
        discoveredPOIs: [],
      };
    });

    const handler = mock(() => {});
    eventBus.on('location_discovery_level_changed', handler);

    explorationStore.setState(draft => {
      draft.locations['loc_01']!.credibility = 0.9;
    });

    expect(handler).not.toHaveBeenCalled();
    eventBus.off('location_discovery_level_changed', handler);
  });
});
