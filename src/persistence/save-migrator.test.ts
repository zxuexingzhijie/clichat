import { describe, it, expect } from 'bun:test';
import { migrateV1ToV2 } from './save-migrator';
import { getDefaultQuestState } from '../state/quest-store';
import { getDefaultRelationState } from '../state/relation-store';
import { getDefaultNpcMemoryState } from '../state/npc-memory-store';

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
