import { describe, it, expect } from 'bun:test';
import { migrateV1ToV2, migrateV2ToV3, migrateV4ToV5, migrateV5ToV6 } from './save-migrator';
import { getDefaultQuestState } from '../state/quest-store';
import { getDefaultRelationState } from '../state/relation-store';
import { getDefaultNpcMemoryState } from '../state/npc-memory-store';
import { getDefaultNarrativeState } from '../state/narrative-state';

const validV1 = {
  version: 1,
  timestamp: '2026-01-01T00:00:00.000Z',
  player: { name: 'Hero', race: 'Human', profession: 'Warrior', hp: 30, maxHp: 30, mp: 8, maxMp: 8, gold: 12, attributes: {}, tags: [], equipment: {} },
  scene: { currentSceneId: 'village_square', sceneId: 'village_square', description: '', characters: [], exits: [] },
  combat: { active: false, roundNumber: 0, enemies: [], turnOrder: [], currentTurnIndex: 0, log: [] },
  game: { day: 1, timeOfDay: 'morning', phase: 'game', turnCount: 0, isDarkTheme: true },
};

describe('migrateV1ToV2', () => {
  it('returns object with version: 2 for valid v1 input', () => {
    const result = migrateV1ToV2(validV1) as Record<string, unknown>;
    expect(result['version']).toBe(2);
  });

  it('injects meta object with saveName: Migrated Save', () => {
    const result = migrateV1ToV2(validV1) as Record<string, unknown>;
    const meta = result['meta'] as Record<string, unknown>;
    expect(meta).toBeDefined();
    expect(meta['saveName']).toBe('Migrated Save');
  });

  it('injects meta timestamp from original v1 timestamp', () => {
    const result = migrateV1ToV2(validV1) as Record<string, unknown>;
    const meta = result['meta'] as Record<string, unknown>;
    expect(meta['timestamp']).toBe('2026-01-01T00:00:00.000Z');
  });

  it('injects meta character from player fields', () => {
    const result = migrateV1ToV2(validV1) as Record<string, unknown>;
    const meta = result['meta'] as Record<string, unknown>;
    const character = meta['character'] as Record<string, unknown>;
    expect(character['name']).toBe('Hero');
    expect(character['race']).toBe('Human');
    expect(character['profession']).toBe('Warrior');
  });

  it('injects quest: getDefaultQuestState()', () => {
    const result = migrateV1ToV2(validV1) as Record<string, unknown>;
    expect(result['quest']).toEqual(getDefaultQuestState());
  });

  it('injects relations: getDefaultRelationState()', () => {
    const result = migrateV1ToV2(validV1) as Record<string, unknown>;
    expect(result['relations']).toEqual(getDefaultRelationState());
  });

  it('injects npcMemorySnapshot: getDefaultNpcMemoryState() when npcMemory absent from v1', () => {
    const result = migrateV1ToV2(validV1) as Record<string, unknown>;
    expect(result['npcMemorySnapshot']).toEqual(getDefaultNpcMemoryState());
  });

  it('preserves existing npcMemory if present in v1', () => {
    const v1WithMemory = { ...validV1, npcMemory: { memories: { npc1: { npcId: 'npc1', recentMemories: [], salientMemories: [], archiveSummary: '', lastUpdated: '' } } } };
    const result = migrateV1ToV2(v1WithMemory) as Record<string, unknown>;
    expect(result['npcMemorySnapshot']).toEqual(v1WithMemory.npcMemory);
  });

  it('injects questEventLog: []', () => {
    const result = migrateV1ToV2(validV1) as Record<string, unknown>;
    expect(result['questEventLog']).toEqual([]);
  });

  it('returns non-v1 object unchanged (identity)', () => {
    const v2obj = { version: 2, someField: 'value' };
    const result = migrateV1ToV2(v2obj);
    expect(result).toBe(v2obj);
  });

  it('returns null input unchanged', () => {
    const result = migrateV1ToV2(null);
    expect(result).toBe(null);
  });

  it('returns primitive input unchanged', () => {
    const result = migrateV1ToV2('string');
    expect(result).toBe('string');
  });
});

const validV2 = {
  version: 2,
  meta: {
    saveName: 'Test Save',
    timestamp: '2026-02-01T00:00:00.000Z',
    character: { name: 'Hero', race: 'Human', profession: 'Warrior' },
    playtime: 120,
    locationName: 'village_square',
  },
  player: { name: 'Hero', race: 'Human', profession: 'Warrior', hp: 30, maxHp: 30, mp: 8, maxMp: 8, gold: 12, attributes: {}, tags: [], equipment: {} },
  scene: { sceneId: 'village_square', description: '', characters: [], exits: [] },
  combat: { active: false, roundNumber: 0, enemies: [], turnOrder: [], currentTurnIndex: 0, log: [] },
  game: { day: 1, timeOfDay: 'morning', phase: 'game', turnCount: 0, isDarkTheme: true },
  quest: { quests: {}, activeQuestId: null },
  relations: { npcRelations: {}, factionRelations: {} },
  npcMemorySnapshot: { memories: {} },
  questEventLog: [],
};

describe('migrateV2ToV3', () => {
  it('returns object with version: 3 for valid v2 input', () => {
    const result = migrateV2ToV3(validV2) as Record<string, unknown>;
    expect(result['version']).toBe(3);
  });

  it('injects branchId: main and parentSaveId: null', () => {
    const result = migrateV2ToV3(validV2) as Record<string, unknown>;
    expect(result['branchId']).toBe('main');
    expect(result['parentSaveId']).toBe(null);
  });

  it('injects empty exploration state', () => {
    const result = migrateV2ToV3(validV2) as Record<string, unknown>;
    expect(result['exploration']).toEqual({ locations: {} });
  });

  it('injects empty playerKnowledge state', () => {
    const result = migrateV2ToV3(validV2) as Record<string, unknown>;
    expect(result['playerKnowledge']).toEqual({ entries: {} });
  });

  it('injects empty turnLog', () => {
    const result = migrateV2ToV3(validV2) as Record<string, unknown>;
    expect(result['turnLog']).toEqual([]);
  });

  it('preserves all existing V2 fields', () => {
    const result = migrateV2ToV3(validV2) as Record<string, unknown>;
    expect(result['meta']).toEqual(validV2.meta);
    expect(result['player']).toEqual(validV2.player);
    expect(result['scene']).toEqual(validV2.scene);
    expect(result['combat']).toEqual(validV2.combat);
    expect(result['game']).toEqual(validV2.game);
    expect(result['quest']).toEqual(validV2.quest);
    expect(result['relations']).toEqual(validV2.relations);
    expect(result['npcMemorySnapshot']).toEqual(validV2.npcMemorySnapshot);
    expect(result['questEventLog']).toEqual(validV2.questEventLog);
  });

  it('returns non-V2 object unchanged (identity)', () => {
    const v3obj = { version: 3, someField: 'value' };
    const result = migrateV2ToV3(v3obj);
    expect(result).toBe(v3obj);
  });

  it('returns null input unchanged', () => {
    const result = migrateV2ToV3(null);
    expect(result).toBe(null);
  });

  it('returns primitive input unchanged', () => {
    const result = migrateV2ToV3('string');
    expect(result).toBe('string');
  });
});

const validV4 = {
  version: 4,
  meta: {
    saveName: 'V4 Save',
    timestamp: '2026-03-01T00:00:00.000Z',
    character: { name: 'Hero', race: 'Human', profession: 'Warrior' },
    playtime: 60,
    locationName: 'village_square',
  },
  branchId: 'main',
  parentSaveId: null,
  player: { name: 'Hero', race: 'Human', profession: 'Warrior', hp: 30, maxHp: 30, mp: 8, maxMp: 8, gold: 12, attributes: {}, tags: [], equipment: {} },
  scene: { sceneId: 'village_square', description: '', characters: [], exits: [] },
  combat: { active: false, roundNumber: 0, enemies: [], turnOrder: [], currentTurnIndex: 0, log: [] },
  game: { day: 1, timeOfDay: 'morning', phase: 'game', turnCount: 0, isDarkTheme: true },
  quest: { quests: {}, activeQuestId: null },
  relations: { npcRelations: {}, factionRelations: {} },
  npcMemorySnapshot: { memories: {} },
  questEventLog: [],
  exploration: { locations: {} },
  playerKnowledge: { entries: {} },
  turnLog: [],
};

describe('migrateV4ToV5', () => {
  it('returns object with version: 5 for valid v4 input', () => {
    const result = migrateV4ToV5(validV4) as Record<string, unknown>;
    expect(result['version']).toBe(5);
  });

  it('adds narrativeState with default currentAct: act1', () => {
    const result = migrateV4ToV5(validV4) as Record<string, unknown>;
    const narrativeState = result['narrativeState'] as Record<string, unknown>;
    expect(narrativeState).toBeDefined();
    expect(narrativeState['currentAct']).toBe('act1');
  });

  it('adds narrativeState matching getDefaultNarrativeState()', () => {
    const result = migrateV4ToV5(validV4) as Record<string, unknown>;
    expect(result['narrativeState']).toEqual(getDefaultNarrativeState());
  });

  it('preserves all existing V4 fields', () => {
    const result = migrateV4ToV5(validV4) as Record<string, unknown>;
    expect(result['meta']).toEqual(validV4.meta);
    expect(result['branchId']).toBe('main');
    expect(result['player']).toEqual(validV4.player);
    expect(result['turnLog']).toEqual([]);
  });

  it('returns non-v4 object unchanged (identity)', () => {
    const v5obj = { version: 5, someField: 'value' };
    const result = migrateV4ToV5(v5obj);
    expect(result).toBe(v5obj);
  });

  it('returns null input unchanged', () => {
    const result = migrateV4ToV5(null);
    expect(result).toBe(null);
  });

  it('returns primitive input unchanged', () => {
    const result = migrateV4ToV5('string');
    expect(result).toBe('string');
  });
});

describe('migrateV5ToV6', () => {
  it('upgrades version 5 to 6 and adds droppedItems default []', () => {
    const v5 = { version: 5, scene: { sceneId: 'town', objects: [] } };
    const result = migrateV5ToV6(v5) as Record<string, unknown>;
    expect(result['version']).toBe(6);
    const scene = result['scene'] as Record<string, unknown>;
    expect(scene['droppedItems']).toEqual([]);
  });

  it('preserves existing droppedItems when already present', () => {
    const v5 = { version: 5, scene: { sceneId: 'town', droppedItems: ['item_wolf_pelt'] } };
    const result = migrateV5ToV6(v5) as Record<string, unknown>;
    const scene = result['scene'] as Record<string, unknown>;
    expect(scene['droppedItems']).toEqual(['item_wolf_pelt']);
  });

  it('returns non-version-5 objects unchanged', () => {
    const v4 = { version: 4 };
    expect(migrateV5ToV6(v4)).toEqual(v4);
  });

  it('returns null unchanged', () => {
    expect(migrateV5ToV6(null)).toBeNull();
  });
});
