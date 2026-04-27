import { describe, it, expect } from 'bun:test';
import mitt from 'mitt';
import type { DomainEvents } from '../../events/event-types';
import { createPlayerStore, getDefaultPlayerState } from '../player-store';
import { createSceneStore, getDefaultSceneState } from '../scene-store';
import { createGameStore, getDefaultGameState } from '../game-store';
import { createDialogueStore, getDefaultDialogueState } from '../dialogue-store';
import { createCombatStore, getDefaultCombatState } from '../combat-store';
import { createQuestStore, getDefaultQuestState } from '../quest-store';
import { createRelationStore, getDefaultRelationState } from '../relation-store';
import { createExplorationStore, getDefaultExplorationState } from '../exploration-store';
import { createNpcMemoryStore, getDefaultNpcMemoryState } from '../npc-memory-store';
import { createPlayerKnowledgeStore, getDefaultPlayerKnowledgeState } from '../player-knowledge-store';
import { createBranchStore, getDefaultBranchState } from '../branch-store';
import { createCostSessionStore, getDefaultCostSessionState } from '../cost-session-store';
import type { GameState } from '../game-store';

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

describe('createSceneStore', () => {
  it('creates with default state', () => {
    const bus = mitt<DomainEvents>();
    const store = createSceneStore(bus);
    expect(store.getState()).toEqual(getDefaultSceneState());
  });

  it('emits scene_changed on the injected bus', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('scene_changed', (e) => events.push(e));
    const store = createSceneStore(bus);
    store.setState((draft) => { draft.sceneId = 'new_scene'; });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ sceneId: 'new_scene', previousSceneId: 'placeholder_scene' });
  });

  it('isolates instances', () => {
    const bus1 = mitt<DomainEvents>();
    const bus2 = mitt<DomainEvents>();
    const store1 = createSceneStore(bus1);
    const store2 = createSceneStore(bus2);
    store1.setState((draft) => { draft.sceneId = 'changed'; });
    expect(store2.getState().sceneId).toBe('placeholder_scene');
  });
});

describe('createGameStore', () => {
  it('creates with default state', () => {
    const bus = mitt<DomainEvents>();
    const store = createGameStore(bus);
    expect(store.getState()).toEqual(getDefaultGameState());
  });

  it('emits time_advanced on the injected bus', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('time_advanced', (e) => events.push(e));
    const store = createGameStore(bus);
    store.setState((draft) => { draft.day = 2; });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ day: 2, timeOfDay: 'night' });
  });

  it('emits game_phase_changed on the injected bus', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('game_phase_changed', (e) => events.push(e));
    const store = createGameStore(bus);
    store.setState((draft) => { draft.phase = 'game'; });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ phase: 'game' });
  });
});

describe('createDialogueStore', () => {
  it('creates with default state', () => {
    const bus = mitt<DomainEvents>();
    const store = createDialogueStore(bus);
    expect(store.getState()).toEqual(getDefaultDialogueState());
  });

  it('emits dialogue_started on the injected bus', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('dialogue_started', (e) => events.push(e));
    const store = createDialogueStore(bus);
    store.setState((draft) => { draft.active = true; draft.npcId = 'npc1'; draft.npcName = 'Guard'; draft.mode = 'inline'; });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ npcId: 'npc1', npcName: 'Guard', mode: 'inline' });
  });

  it('emits dialogue_ended on the injected bus', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('dialogue_ended', (e) => events.push(e));
    const store = createDialogueStore(bus);
    store.setState((draft) => { draft.active = true; draft.npcId = 'npc1'; });
    store.setState((draft) => { draft.active = false; });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ npcId: 'npc1' });
  });
});

describe('createCombatStore', () => {
  it('creates with default state', () => {
    const bus = mitt<DomainEvents>();
    const store = createCombatStore(bus);
    expect(store.getState()).toEqual(getDefaultCombatState());
  });

  it('emits combat_started on the injected bus', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('combat_started', (e) => events.push(e));
    const store = createCombatStore(bus);
    store.setState((draft) => {
      draft.active = true;
      draft.enemies = [{ id: 'e1', name: 'Goblin', hp: 10, maxHp: 10 }];
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ enemies: ['Goblin'] });
  });

  it('emits combat_ended on the injected bus', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('combat_ended', (e) => events.push(e));
    const store = createCombatStore(bus);
    store.setState((draft) => { draft.active = true; });
    store.setState((draft) => { draft.active = false; });
    expect(events).toHaveLength(1);
  });
});

describe('createQuestStore', () => {
  it('creates with default state', () => {
    const bus = mitt<DomainEvents>();
    const mockDeps = { getGameState: (): GameState => getDefaultGameState() };
    const store = createQuestStore(bus, mockDeps);
    expect(store.getState()).toEqual(getDefaultQuestState());
  });

  it('emits quest_started on the injected bus', () => {
    const bus = mitt<DomainEvents>();
    const mockDeps = { getGameState: (): GameState => ({ ...getDefaultGameState(), turnCount: 5 }) };
    const events: unknown[] = [];
    bus.on('quest_started', (e) => events.push(e));
    const store = createQuestStore(bus, mockDeps);
    store.setState((draft) => {
      draft.quests['q1'] = {
        status: 'active', currentStageId: null, completedObjectives: [],
        discoveredClues: [], flags: {}, acceptedAt: 5, completedAt: null,
      };
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ questId: 'q1', questTitle: 'q1', turnNumber: 5 });
  });
});

describe('createRelationStore', () => {
  it('creates with default state', () => {
    const bus = mitt<DomainEvents>();
    const store = createRelationStore(bus);
    expect(store.getState()).toEqual(getDefaultRelationState());
  });

  it('emits reputation_changed on the injected bus', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('reputation_changed', (e) => events.push(e));
    const store = createRelationStore(bus);
    store.setState((draft) => {
      draft.npcDispositions['npc1'] = { value: 10, publicReputation: 0, personalTrust: 0, fear: 0, infamy: 0, credibility: 0 };
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ targetId: 'npc1', targetType: 'npc', delta: 10, newValue: 10 });
  });
});

describe('createExplorationStore', () => {
  it('creates with default state', () => {
    const bus = mitt<DomainEvents>();
    const store = createExplorationStore(bus);
    expect(store.getState()).toEqual(getDefaultExplorationState());
  });

  it('emits location_explored on the injected bus', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('location_explored', (e) => events.push(e));
    const store = createExplorationStore(bus);
    store.setState((draft) => {
      draft.locations['loc1'] = {
        locationId: 'loc1', level: 'visited', discoveredAt: 1,
        discoverySource: 'player', credibility: 1, description: 'A place', discoveredPOIs: [],
      };
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ locationId: 'loc1', newLevel: 'visited', previousLevel: null });
  });
});

describe('createNpcMemoryStore', () => {
  it('creates with default state', () => {
    const bus = mitt<DomainEvents>();
    const store = createNpcMemoryStore(bus);
    expect(store.getState()).toEqual(getDefaultNpcMemoryState());
  });

  it('emits npc_memory_written on the injected bus', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('npc_memory_written', (e) => events.push(e));
    const store = createNpcMemoryStore(bus);
    store.setState((draft) => {
      draft.memories['npc1'] = {
        npcId: 'npc1', recentMemories: [{
          id: 'm1', npcId: 'npc1', event: 'met player', turnNumber: 1,
          importance: 'medium', emotionalValence: 0.5, participants: ['player'],
        }],
        salientMemories: [], archiveSummary: '', lastUpdated: '', version: 0,
      };
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ npcId: 'npc1', event: 'met player', turnNumber: 1 });
  });
});

describe('createPlayerKnowledgeStore', () => {
  it('creates with default state', () => {
    const bus = mitt<DomainEvents>();
    const store = createPlayerKnowledgeStore(bus);
    expect(store.getState()).toEqual(getDefaultPlayerKnowledgeState());
  });

  it('emits knowledge_discovered on the injected bus', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('knowledge_discovered', (e) => events.push(e));
    const store = createPlayerKnowledgeStore(bus);
    store.setState((draft) => {
      draft.entries['k1'] = {
        id: 'k1', codexEntryId: null, source: 'npc', turnNumber: 3,
        credibility: 0.8, knowledgeStatus: 'heard', description: 'A rumor', relatedQuestId: null,
      };
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ entryId: 'k1', codexEntryId: null, knowledgeStatus: 'heard', turnNumber: 3 });
  });
});

describe('createBranchStore', () => {
  it('creates with default state', () => {
    const bus = mitt<DomainEvents>();
    const store = createBranchStore(bus);
    const state = store.getState();
    expect(state.currentBranchId).toBe('main');
    expect(state.branches['main']).toBeDefined();
  });

  it('emits branch_created on the injected bus', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('branch_created', (e) => events.push(e));
    const store = createBranchStore(bus);
    store.setState((draft) => {
      draft.branches['b2'] = {
        id: 'b2', name: 'side-quest', parentBranchId: 'main',
        parentSaveId: null, headSaveId: null, createdAt: '2026-01-01', description: 'test',
      };
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ branchId: 'b2', branchName: 'side-quest', parentBranchId: 'main' });
  });
});

describe('createCostSessionStore', () => {
  it('creates with default state', () => {
    const bus = mitt<DomainEvents>();
    const store = createCostSessionStore(bus);
    expect(store.getState()).toEqual(getDefaultCostSessionState());
  });

  it('emits token_usage_updated on the injected bus', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('token_usage_updated', (e) => events.push(e));
    const store = createCostSessionStore(bus);
    store.setState((draft) => { draft.lastTurnTokens = 100; });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ lastTurnTokens: 100 });
  });
});
