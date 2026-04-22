import { describe, it, expect, beforeEach } from 'bun:test';
import { createStore } from './create-store';
import { getDefaultPlayerState, type PlayerState } from './player-store';
import { getDefaultSceneState, type SceneState } from './scene-store';
import { getDefaultCombatState, type CombatState } from './combat-store';
import { getDefaultGameState, type GameState } from './game-store';
import { getDefaultQuestState, resetQuestEventLog, type QuestState, type QuestEvent } from './quest-store';
import { getDefaultRelationState, type RelationState } from './relation-store';
import { getDefaultNpcMemoryState, type NpcMemoryState } from './npc-memory-store';
import { getDefaultExplorationState, type ExplorationState } from './exploration-store';
import { getDefaultPlayerKnowledgeState, type PlayerKnowledgeState } from './player-knowledge-store';
import { createSerializer, SaveDataV2Schema, SaveDataV3Schema, SaveDataV4Schema, SaveMetaSchema, TurnLogEntrySchema } from './serializer';

function freshStores() {
  return {
    player: createStore<PlayerState>(getDefaultPlayerState()),
    scene: createStore<SceneState>(getDefaultSceneState()),
    combat: createStore<CombatState>(getDefaultCombatState()),
    game: createStore<GameState>(getDefaultGameState()),
    quest: createStore<QuestState>(getDefaultQuestState()),
    relations: createStore<RelationState>(getDefaultRelationState()),
    npcMemory: createStore<NpcMemoryState>(getDefaultNpcMemoryState()),
    exploration: createStore<ExplorationState>(getDefaultExplorationState()),
    playerKnowledge: createStore<PlayerKnowledgeState>(getDefaultPlayerKnowledgeState()),
  };
}

function freshSerializer() {
  return createSerializer(freshStores(), () => [], () => [], () => 'main', () => null);
}

describe('createSerializer', () => {
  beforeEach(() => {
    resetQuestEventLog();
  });

  it('snapshot returns JSON with required v3 keys', () => {
    const serializer = freshSerializer();
    const parsed = JSON.parse(serializer.snapshot());

    expect(parsed).toHaveProperty('version', 3);
    expect(parsed).toHaveProperty('meta');
    expect(parsed).toHaveProperty('branchId');
    expect(parsed).toHaveProperty('parentSaveId');
    expect(parsed).toHaveProperty('player');
    expect(parsed).toHaveProperty('scene');
    expect(parsed).toHaveProperty('combat');
    expect(parsed).toHaveProperty('game');
    expect(parsed).toHaveProperty('quest');
    expect(parsed).toHaveProperty('relations');
    expect(parsed).toHaveProperty('npcMemorySnapshot');
    expect(parsed).toHaveProperty('questEventLog');
    expect(parsed).toHaveProperty('exploration');
    expect(parsed).toHaveProperty('playerKnowledge');
    expect(parsed).toHaveProperty('turnLog');
  });

  it('snapshot reflects modified store state', () => {
    const stores = freshStores();
    const serializer = createSerializer(stores, () => [], () => [], () => 'main', () => null);

    stores.player.setState(draft => { draft.hp = 20; });

    const parsed = JSON.parse(serializer.snapshot());
    expect(parsed.player.hp).toBe(20);
  });

  it('restore sets stores back to snapshot state', () => {
    const stores = freshStores();
    const serializer = createSerializer(stores, () => [], () => [], () => 'main', () => null);
    const snap = serializer.snapshot();

    stores.player.setState(draft => { draft.hp = 1; });
    stores.game.setState(draft => { draft.day = 99; });

    serializer.restore(snap);

    expect(stores.player.getState().hp).toBe(30);
    expect(stores.game.getState().day).toBe(1);
  });

  it('roundtrip: snapshot -> modify -> restore preserves original state', () => {
    const stores = freshStores();
    const serializer = createSerializer(stores, () => [], () => [], () => 'main', () => null);

    const originalHp = stores.player.getState().hp;
    const snap = serializer.snapshot();

    stores.player.setState(draft => { draft.hp = 5; });
    expect(stores.player.getState().hp).toBe(5);

    serializer.restore(snap);
    expect(stores.player.getState().hp).toBe(originalHp);
  });

  it('restore throws on invalid JSON', () => {
    const serializer = freshSerializer();
    expect(() => serializer.restore('not json{')).toThrow('Invalid save data: malformed JSON');
  });

  it('restore throws on invalid player state (hp as string)', () => {
    const serializer = freshSerializer();
    const snap = JSON.parse(serializer.snapshot());

    snap.player.hp = 'not-a-number';
    const bad = JSON.stringify(snap);

    expect(() => serializer.restore(bad)).toThrow('Invalid save data');
  });

  it('roundtrip: snapshot -> parse -> stringify -> restore produces identical state', () => {
    const stores = freshStores();
    const serializer = createSerializer(stores, () => [], () => [], () => 'main', () => null);

    stores.player.setState(draft => { draft.gold = 999; });
    stores.scene.setState(draft => { draft.sceneId = 'tavern_01'; });
    stores.combat.setState(draft => { draft.active = true; draft.roundNumber = 3; });
    stores.game.setState(draft => { draft.day = 7; draft.timeOfDay = 'dusk'; });

    const snap = serializer.snapshot();
    const repacked = JSON.stringify(JSON.parse(snap));

    const stores2 = freshStores();
    const serializer2 = createSerializer(stores2, () => [], () => [], () => 'main', () => null);
    serializer2.restore(repacked);

    expect(stores2.player.getState().gold).toBe(999);
    expect(stores2.scene.getState().sceneId).toBe('tavern_01');
    expect(stores2.combat.getState().active).toBe(true);
    expect(stores2.combat.getState().roundNumber).toBe(3);
    expect(stores2.game.getState().day).toBe(7);
    expect(stores2.game.getState().timeOfDay).toBe('dusk');
  });
});

describe('SaveDataV2Schema', () => {
  it('validates a valid v2 object', () => {
    const valid = {
      version: 2,
      meta: {
        saveName: 'Test Save',
        timestamp: '2026-01-01T00:00:00.000Z',
        character: { name: 'Hero', race: 'Human', profession: 'Warrior' },
        playtime: 0,
        locationName: 'Town',
      },
      player: getDefaultPlayerState(),
      scene: getDefaultSceneState(),
      combat: getDefaultCombatState(),
      game: getDefaultGameState(),
      quest: getDefaultQuestState(),
      relations: getDefaultRelationState(),
      npcMemorySnapshot: getDefaultNpcMemoryState(),
      questEventLog: [],
    };
    const result = SaveDataV2Schema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('fails on object with version: 1', () => {
    const v1 = {
      version: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      player: getDefaultPlayerState(),
      scene: getDefaultSceneState(),
      combat: getDefaultCombatState(),
      game: getDefaultGameState(),
    };
    const result = SaveDataV2Schema.safeParse(v1);
    expect(result.success).toBe(false);
  });
});

describe('createSerializer v2 specific', () => {
  beforeEach(() => {
    resetQuestEventLog();
  });

  it('snapshot produces JSON parseable to v3 schema', () => {
    const serializer = freshSerializer();
    const parsed = JSON.parse(serializer.snapshot());
    const result = SaveDataV3Schema.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it('restore with valid v2 JSON restores questStore to saved quest state', () => {
    const stores = freshStores();
    const serializer = createSerializer(stores, () => [], () => [], () => 'main', () => null);

    stores.quest.setState(draft => {
      draft.quests['quest_001'] = {
        status: 'active',
        currentStageId: 'stage_1',
        completedObjectives: [],
        discoveredClues: [],
        flags: {},
        acceptedAt: 100,
        completedAt: null,
      };
    });

    const snap = serializer.snapshot();
    const stores2 = freshStores();
    const serializer2 = createSerializer(stores2, () => [], () => [], () => 'main', () => null);
    serializer2.restore(snap);

    expect(stores2.quest.getState().quests['quest_001']).toBeDefined();
    expect(stores2.quest.getState().quests['quest_001']!.status).toBe('active');
  });

  it('restore with valid v2 JSON restores relationStore to saved relations state', () => {
    const stores = freshStores();
    const serializer = createSerializer(stores, () => [], () => [], () => 'main', () => null);

    stores.relations.setState(draft => {
      draft.factionReputations['merchants_guild'] = 50;
    });

    const snap = serializer.snapshot();
    const stores2 = freshStores();
    const serializer2 = createSerializer(stores2, () => [], () => [], () => 'main', () => null);
    serializer2.restore(snap);

    expect(stores2.relations.getState().factionReputations['merchants_guild']).toBe(50);
  });

  it('restore calls migrateV1ToV2 when input has version: 1 then restores quest and relations', () => {
    const v1SaveJson = JSON.stringify({
      version: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      player: getDefaultPlayerState(),
      scene: getDefaultSceneState(),
      combat: getDefaultCombatState(),
      game: getDefaultGameState(),
    });

    const stores = freshStores();
    const serializer = createSerializer(stores, () => [], () => [], () => 'main', () => null);
    serializer.restore(v1SaveJson);

    expect(stores.quest.getState()).toEqual(getDefaultQuestState());
    expect(stores.relations.getState()).toEqual(getDefaultRelationState());
  });

  it('restore throws on malformed JSON', () => {
    const serializer = freshSerializer();
    expect(() => serializer.restore('{invalid')).toThrow('Invalid save data: malformed JSON');
  });
});

describe('SaveMetaSchema', () => {
  it('validates meta with all required fields', () => {
    const meta = {
      saveName: 'My Save',
      timestamp: '2026-01-01T00:00:00.000Z',
      character: { name: 'Hero', race: 'Elf', profession: 'Mage' },
      playtime: 120,
      locationName: 'Forest',
    };
    const result = SaveMetaSchema.safeParse(meta);
    expect(result.success).toBe(true);
  });
});

describe('TurnLogEntrySchema with npcDialogue', () => {
  const baseTurnEntry = {
    turnNumber: 1,
    action: 'look',
    checkResult: null,
    narrationLines: ['You see a tavern.'],
    timestamp: '2026-01-01T00:00:00.000Z',
  };

  it('accepts entry without npcDialogue (backward compatibility)', () => {
    const result = TurnLogEntrySchema.safeParse(baseTurnEntry);
    expect(result.success).toBe(true);
  });

  it('accepts entry with npcDialogue as string array', () => {
    const result = TurnLogEntrySchema.safeParse({
      ...baseTurnEntry,
      npcDialogue: ['Hello, traveler!', 'What brings you here?'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.npcDialogue).toEqual(['Hello, traveler!', 'What brings you here?']);
    }
  });

  it('accepts entry with npcDialogue as empty array', () => {
    const result = TurnLogEntrySchema.safeParse({ ...baseTurnEntry, npcDialogue: [] });
    expect(result.success).toBe(true);
  });

  it('rejects entry with npcDialogue containing non-strings', () => {
    const result = TurnLogEntrySchema.safeParse({ ...baseTurnEntry, npcDialogue: [42] });
    expect(result.success).toBe(false);
  });
});

describe('SaveDataV4Schema', () => {
  it('validates a v4 save object (version literal 4)', () => {
    const v4 = {
      version: 4,
      meta: {
        saveName: 'V4 Save',
        timestamp: '2026-01-01T00:00:00.000Z',
        character: { name: 'Hero', race: 'Human', profession: 'Warrior' },
        playtime: 0,
        locationName: 'town',
      },
      branchId: 'main',
      parentSaveId: null,
      player: getDefaultPlayerState(),
      scene: getDefaultSceneState(),
      combat: getDefaultCombatState(),
      game: getDefaultGameState(),
      quest: getDefaultQuestState(),
      relations: getDefaultRelationState(),
      npcMemorySnapshot: getDefaultNpcMemoryState(),
      questEventLog: [],
      exploration: getDefaultExplorationState(),
      playerKnowledge: getDefaultPlayerKnowledgeState(),
      turnLog: [],
    };
    const result = SaveDataV4Schema.safeParse(v4);
    expect(result.success).toBe(true);
  });

  it('rejects a v3 object against SaveDataV4Schema', () => {
    const v3 = {
      version: 3,
      meta: {
        saveName: 'V3 Save',
        timestamp: '2026-01-01T00:00:00.000Z',
        character: { name: 'Hero', race: 'Human', profession: 'Warrior' },
        playtime: 0,
        locationName: 'town',
      },
      branchId: 'main',
      parentSaveId: null,
      player: getDefaultPlayerState(),
      scene: getDefaultSceneState(),
      combat: getDefaultCombatState(),
      game: getDefaultGameState(),
      quest: getDefaultQuestState(),
      relations: getDefaultRelationState(),
      npcMemorySnapshot: getDefaultNpcMemoryState(),
      questEventLog: [],
      exploration: getDefaultExplorationState(),
      playerKnowledge: getDefaultPlayerKnowledgeState(),
      turnLog: [],
    };
    const result = SaveDataV4Schema.safeParse(v3);
    expect(result.success).toBe(false);
  });
});

describe('createSerializer v4 migration', () => {
  beforeEach(() => {
    resetQuestEventLog();
  });

  it('snapshot produces JSON with version: 4', () => {
    const serializer = freshSerializer();
    const parsed = JSON.parse(serializer.snapshot());
    expect(parsed).toHaveProperty('version', 4);
  });

  it('restore accepts a v3 save and migrates it to v4', () => {
    const v3Json = JSON.stringify({
      version: 3,
      meta: {
        saveName: 'Old Save',
        timestamp: '2026-01-01T00:00:00.000Z',
        character: { name: 'Hero', race: 'Human', profession: 'Warrior' },
        playtime: 0,
        locationName: 'village_square',
      },
      branchId: 'main',
      parentSaveId: null,
      player: getDefaultPlayerState(),
      scene: getDefaultSceneState(),
      combat: getDefaultCombatState(),
      game: getDefaultGameState(),
      quest: getDefaultQuestState(),
      relations: getDefaultRelationState(),
      npcMemorySnapshot: getDefaultNpcMemoryState(),
      questEventLog: [],
      exploration: getDefaultExplorationState(),
      playerKnowledge: getDefaultPlayerKnowledgeState(),
      turnLog: [],
    });

    const stores = freshStores();
    const serializer = createSerializer(stores, () => [], () => [], () => 'main', () => null);
    expect(() => serializer.restore(v3Json)).not.toThrow();
    expect(stores.player.getState().hp).toBe(30);
  });
});
