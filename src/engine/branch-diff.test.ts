import { describe, it, expect } from 'bun:test';
import { compareBranches, type DiffItem } from './branch-diff';
import type { SaveDataV4 } from '../state/serializer';

function makeMinimalSave(overrides: Partial<SaveDataV4> = {}): SaveDataV4 {
  return {
    version: 4,
    meta: {
      saveName: 'test',
      timestamp: '2026-01-01T00:00:00Z',
      character: { name: 'Hero', race: 'Human', profession: 'Warrior' },
      playtime: 0,
      locationName: 'town',
    },
    branchId: 'branch-1',
    parentSaveId: null,
    player: {
      name: 'Hero',
      race: 'Human',
      profession: 'Warrior',
      hp: 30,
      maxHp: 30,
      mp: 8,
      maxMp: 8,
      gold: 12,
      attributes: { physique: 3, finesse: 2, mind: 1 },
      tags: [],
      equipment: { weapon: null, armor: null, accessory: null },
    },
    scene: {
      sceneId: 'town_square',
      locationName: 'Town Square',
      narrationLines: [],
      actions: [],
      npcsPresent: [],
      exits: [],
      objects: [],
    },
    combat: {
      active: false,
      turnOrder: [],
      currentTurnIndex: 0,
      enemies: [],
      roundNumber: 0,
      phase: 'init',
      lastCheckResult: null,
      lastNarration: '',
      guardActive: false,
    },
    game: {
      day: 1,
      timeOfDay: 'night',
      phase: 'game',
      turnCount: 0,
      isDarkTheme: true,
    },
    quest: { quests: {} },
    relations: { npcDispositions: {}, factionReputations: {} },
    npcMemorySnapshot: { memories: {} },
    questEventLog: [],
    exploration: { locations: {} },
    playerKnowledge: { entries: {} },
    turnLog: [],
    ...overrides,
  } as SaveDataV4;
}

describe('compareBranches', () => {
  it('returns empty diffs for identical snapshots', () => {
    const save = makeMinimalSave();
    const result = compareBranches(save, save);
    expect(result.diffs).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.highImpactCount).toBe(0);
  });

  it('detects quest status change with marker ~', () => {
    const source = makeMinimalSave({
      quest: {
        quests: {
          quest_1: {
            status: 'active',
            currentStageId: 'stage_1',
            completedObjectives: [],
            discoveredClues: [],
            flags: {},
            acceptedAt: 1,
            completedAt: null,
          },
        },
        eventLog: [],
      },
    });
    const target = makeMinimalSave({
      quest: {
        quests: {
          quest_1: {
            status: 'completed',
            currentStageId: 'stage_2',
            completedObjectives: ['obj_1'],
            discoveredClues: [],
            flags: {},
            acceptedAt: 1,
            completedAt: 10,
          },
        },
        eventLog: [],
      },
    });
    const result = compareBranches(source, target);
    const questDiff = result.diffs.find(d => d.category === 'quest' && d.key === 'quest_1');
    expect(questDiff).toBeDefined();
    expect(questDiff!.marker).toBe('~');
  });

  it('detects quest only in source as marker -', () => {
    const source = makeMinimalSave({
      quest: {
        quests: {
          quest_only_src: {
            status: 'active',
            currentStageId: null,
            completedObjectives: [],
            discoveredClues: [],
            flags: {},
            acceptedAt: 1,
            completedAt: null,
          },
        },
        eventLog: [],
      },
    });
    const target = makeMinimalSave();
    const result = compareBranches(source, target);
    const diff = result.diffs.find(d => d.key === 'quest_only_src');
    expect(diff).toBeDefined();
    expect(diff!.marker).toBe('-');
  });

  it('detects quest only in target as marker +', () => {
    const source = makeMinimalSave();
    const target = makeMinimalSave({
      quest: {
        quests: {
          quest_only_tgt: {
            status: 'active',
            currentStageId: null,
            completedObjectives: [],
            discoveredClues: [],
            flags: {},
            acceptedAt: 5,
            completedAt: null,
          },
        },
        eventLog: [],
      },
    });
    const result = compareBranches(source, target);
    const diff = result.diffs.find(d => d.key === 'quest_only_tgt');
    expect(diff).toBeDefined();
    expect(diff!.marker).toBe('+');
  });

  it('detects NPC relation diff with marker ~ and high impact for delta >= 20', () => {
    const source = makeMinimalSave({
      relations: {
        npcDispositions: {
          npc_1: { value: 10, publicReputation: 0, personalTrust: 0, fear: 0, infamy: 0, credibility: 0 },
        },
        factionReputations: {},
      },
    });
    const target = makeMinimalSave({
      relations: {
        npcDispositions: {
          npc_1: { value: 35, publicReputation: 0, personalTrust: 0, fear: 0, infamy: 0, credibility: 0 },
        },
        factionReputations: {},
      },
    });
    const result = compareBranches(source, target);
    const diff = result.diffs.find(d => d.category === 'npc_relation' && d.key === 'npc_1');
    expect(diff).toBeDefined();
    expect(diff!.marker).toBe('~');
    expect(diff!.isHighImpact).toBe(true);
  });

  it('detects inventory item removed as marker -', () => {
    const source = makeMinimalSave({
      player: {
        name: 'Hero',
        race: 'Human',
        profession: 'Warrior',
        hp: 30,
        maxHp: 30,
        mp: 8,
        maxMp: 8,
        gold: 12,
        attributes: { physique: 3, finesse: 2, mind: 1 },
        tags: ['sword_equipped'],
        equipment: { weapon: 'iron_sword', armor: null, accessory: null },
        poisonStacks: 0,
      },
    });
    const target = makeMinimalSave({
      player: {
        name: 'Hero',
        race: 'Human',
        profession: 'Warrior',
        hp: 30,
        maxHp: 30,
        mp: 8,
        maxMp: 8,
        gold: 12,
        attributes: { physique: 3, finesse: 2, mind: 1 },
        tags: [],
        equipment: { weapon: null, armor: null, accessory: null },
        poisonStacks: 0,
      },
    });
    const result = compareBranches(source, target);
    const diff = result.diffs.find(d => d.category === 'inventory' && d.marker === '-');
    expect(diff).toBeDefined();
    expect(diff!.key).toContain('iron_sword');
  });

  it('detects location diff with marker ~', () => {
    const source = makeMinimalSave({
      scene: {
        sceneId: 'town_square',
        locationName: 'Town Square',
        narrationLines: [],
        actions: [],
        npcsPresent: [],
        exits: [],
        exitMap: {},
        objects: [],
      },
    });
    const target = makeMinimalSave({
      scene: {
        sceneId: 'dark_forest',
        locationName: 'Dark Forest',
        narrationLines: [],
        actions: [],
        npcsPresent: [],
        exits: [],
        exitMap: {},
        objects: [],
      },
    });
    const result = compareBranches(source, target);
    const diff = result.diffs.find(d => d.category === 'location');
    expect(diff).toBeDefined();
    expect(diff!.marker).toBe('~');
    expect(diff!.isHighImpact).toBe(false);
  });

  it('detects faction reputation diff with marker ~', () => {
    const source = makeMinimalSave({
      relations: {
        npcDispositions: {},
        factionReputations: { guild_a: 50 },
      },
    });
    const target = makeMinimalSave({
      relations: {
        npcDispositions: {},
        factionReputations: { guild_a: 30 },
      },
    });
    const result = compareBranches(source, target);
    const diff = result.diffs.find(d => d.category === 'faction' && d.key === 'guild_a');
    expect(diff).toBeDefined();
    expect(diff!.marker).toBe('~');
  });

  it('detects player knowledge in target not in source as marker +', () => {
    const source = makeMinimalSave();
    const target = makeMinimalSave({
      playerKnowledge: {
        entries: {
          k_1: {
            id: 'k_1',
            codexEntryId: null,
            source: 'npc_bartender',
            turnNumber: 5,
            credibility: 0.8,
            knowledgeStatus: 'confirmed',
            description: 'General X betrayed the kingdom',
            relatedQuestId: null,
          },
        },
      },
    });
    const result = compareBranches(source, target);
    const diff = result.diffs.find(d => d.category === 'knowledge' && d.key === 'k_1');
    expect(diff).toBeDefined();
    expect(diff!.marker).toBe('+');
  });

  it('marks isHighImpact true for quest status active->completed/failed', () => {
    const source = makeMinimalSave({
      quest: {
        quests: {
          q_a: {
            status: 'active',
            currentStageId: null,
            completedObjectives: [],
            discoveredClues: [],
            flags: {},
            acceptedAt: 1,
            completedAt: null,
          },
          q_b: {
            status: 'active',
            currentStageId: null,
            completedObjectives: [],
            discoveredClues: [],
            flags: {},
            acceptedAt: 2,
            completedAt: null,
          },
        },
        eventLog: [],
      },
    });
    const target = makeMinimalSave({
      quest: {
        quests: {
          q_a: {
            status: 'completed',
            currentStageId: null,
            completedObjectives: ['all'],
            discoveredClues: [],
            flags: {},
            acceptedAt: 1,
            completedAt: 10,
          },
          q_b: {
            status: 'failed',
            currentStageId: null,
            completedObjectives: [],
            discoveredClues: [],
            flags: {},
            acceptedAt: 2,
            completedAt: 10,
          },
        },
        eventLog: [],
      },
    });
    const result = compareBranches(source, target);
    const qA = result.diffs.find(d => d.key === 'q_a');
    const qB = result.diffs.find(d => d.key === 'q_b');
    expect(qA).toBeDefined();
    expect(qA!.isHighImpact).toBe(true);
    expect(qB).toBeDefined();
    expect(qB!.isHighImpact).toBe(true);
  });

  it('marks NPC relation delta < 20 as not high impact', () => {
    const source = makeMinimalSave({
      relations: {
        npcDispositions: {
          npc_2: { value: 10, publicReputation: 0, personalTrust: 0, fear: 0, infamy: 0, credibility: 0 },
        },
        factionReputations: {},
      },
    });
    const target = makeMinimalSave({
      relations: {
        npcDispositions: {
          npc_2: { value: 20, publicReputation: 0, personalTrust: 0, fear: 0, infamy: 0, credibility: 0 },
        },
        factionReputations: {},
      },
    });
    const result = compareBranches(source, target);
    const diff = result.diffs.find(d => d.category === 'npc_relation' && d.key === 'npc_2');
    expect(diff).toBeDefined();
    expect(diff!.isHighImpact).toBe(false);
  });

  it('detects knowledge status change heard->confirmed as high impact', () => {
    const source = makeMinimalSave({
      playerKnowledge: {
        entries: {
          k_2: {
            id: 'k_2',
            codexEntryId: null,
            source: 'rumor',
            turnNumber: 3,
            credibility: 0.3,
            knowledgeStatus: 'heard',
            description: 'Secret passage exists',
            relatedQuestId: null,
          },
        },
      },
    });
    const target = makeMinimalSave({
      playerKnowledge: {
        entries: {
          k_2: {
            id: 'k_2',
            codexEntryId: null,
            source: 'investigation',
            turnNumber: 8,
            credibility: 0.9,
            knowledgeStatus: 'confirmed',
            description: 'Secret passage exists',
            relatedQuestId: null,
          },
        },
      },
    });
    const result = compareBranches(source, target);
    const diff = result.diffs.find(d => d.category === 'knowledge' && d.key === 'k_2');
    expect(diff).toBeDefined();
    expect(diff!.marker).toBe('~');
    expect(diff!.isHighImpact).toBe(true);
  });
});
