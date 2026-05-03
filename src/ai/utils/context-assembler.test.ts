import { describe, it, expect, beforeEach } from 'bun:test';
import {
  assembleNarrativeContext,
  assembleNpcContext,
  assembleFilteredNpcContext,
  assembleNarrativeContextWithEnvelope,
  type NpcMemory,
  type SceneState,
} from './context-assembler';
import type { CodexEntry } from '../../codex/schemas/entry-types';
import type { NpcProfile } from '../prompts/npc-system';
import type { NpcFilterContext } from './npc-knowledge-filter';
import type { EpistemicMetadata } from '../../codex/schemas/epistemic';
import { playerKnowledgeStore } from '../../state/player-knowledge-store';

function makeEpistemic(overrides: Partial<EpistemicMetadata> = {}): EpistemicMetadata {
  return {
    authority: 'established_canon',
    truth_status: 'true',
    scope: 'regional',
    visibility: 'public',
    confidence: 1,
    source_type: 'authorial',
    known_by: [],
    contradicts: [],
    volatility: 'stable',
    ...overrides,
  };
}

function makeCodexEntry(id: string, description: string): CodexEntry {
  return {
    id,
    name: `Entry ${id}`,
    tags: ['test'],
    description,
    type: 'item' as const,
    item_type: 'misc' as const,
    value: 0,
    epistemic: makeEpistemic(),
  };
}

const testNpcProfile: NpcProfile = {
  id: 'npc_bartender',
  name: 'npc_bartender',
  personality_tags: ['friendly', 'gossip'],
  goals: ['sell drinks', 'gather rumors'],
  backstory: 'A seasoned bartender in Silverwood tavern.',
};

const testNpcFilterCtx: NpcFilterContext = {
  npcId: 'npc_bartender',
  npcFactionIds: ['guild_merchants'],
  npcProfession: 'bartender',
  npcLocationId: 'loc_tavern',
  npcRegion: 'region_silverwood',
};

const testMemories: NpcMemory[] = [
  { npcId: 'npc_bartender', content: 'Player asked about the old mine', timestamp: 100 },
  { npcId: 'npc_bartender', content: 'Player helped fix the sign', timestamp: 200 },
  { npcId: 'npc_guard', content: 'Player was suspicious', timestamp: 150 },
];

const testSceneState: SceneState = {
  narrationLines: ['You enter the tavern.', 'The fire crackles.', 'A bard plays softly.'],
  sceneDescription: 'A warm tavern with wooden tables and a crackling fireplace.',
};

describe('assembleNarrativeContext (backward compatibility)', () => {
  it('still works with original signature', () => {
    const codexMap = new Map<string, CodexEntry>();
    codexMap.set('loc_tavern', makeCodexEntry('loc_tavern', 'The Silverwood Tavern'));
    codexMap.set('npc_bartender', makeCodexEntry('npc_bartender', 'The bartender'));

    const result = assembleNarrativeContext(
      { codexIds: ['loc_tavern', 'npc_bartender'], npcIds: ['npc_bartender'] },
      codexMap,
      testMemories,
      testSceneState,
      'look around',
    );

    expect(result.codexEntries).toHaveLength(2);
    expect(result.npcMemories).toHaveLength(2);
    expect(result.recentNarration).toHaveLength(3);
    expect(result.sceneContext).toBe(testSceneState.sceneDescription);
    expect(result.playerAction).toBe('look around');
    expect(result.omittedContext).toEqual({ codexIds: [], memoryIds: [], narrationIndexes: [] });
  });

  it('under budget returns all codex, memory, narration and full descriptions', () => {
    const codexMap = new Map<string, CodexEntry>();
    const longDescription = '长'.repeat(250);
    codexMap.set('c1', makeCodexEntry('c1', longDescription));
    codexMap.set('c2', makeCodexEntry('c2', 'Second codex'));
    codexMap.set('c3', makeCodexEntry('c3', 'Third codex'));
    codexMap.set('c4', makeCodexEntry('c4', 'Fourth codex'));

    const memories: NpcMemory[] = [
      { npcId: 'npc_bartender', content: 'm1', timestamp: 1 },
      { npcId: 'npc_bartender', content: 'm2', timestamp: 2 },
      { npcId: 'npc_bartender', content: 'm3', timestamp: 3 },
      { npcId: 'npc_bartender', content: 'm4', timestamp: 4 },
    ];
    const sceneState: SceneState = {
      narrationLines: ['n1', 'n2', 'n3', 'n4'],
      sceneDescription: 'scene',
    };

    const result = assembleNarrativeContext(
      { codexIds: ['c1', 'c2', 'c3', 'c4'], npcIds: ['npc_bartender'] },
      codexMap,
      memories,
      sceneState,
      'look around',
      undefined,
      { maxBudget: 10_000 },
    );

    expect(result.codexEntries.map((entry) => entry.id)).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(result.codexEntries[0]?.description).toBe(longDescription);
    expect(result.npcMemories).toEqual(['m1', 'm2', 'm3', 'm4']);
    expect(result.recentNarration).toEqual(['n1', 'n2', 'n3', 'n4']);
    expect(result.omittedContext).toEqual({ codexIds: [], memoryIds: [], narrationIndexes: [] });
  });

  it('over budget fills omitted metadata', () => {
    const codexMap = new Map<string, CodexEntry>();
    codexMap.set('c1', makeCodexEntry('c1', 'codex-one'));
    codexMap.set('c2', makeCodexEntry('c2', 'codex-two'));
    const memories: NpcMemory[] = [
      { npcId: 'npc_bartender', content: 'memory-one', timestamp: 1 },
      { npcId: 'npc_bartender', content: 'memory-two', timestamp: 2 },
    ];
    const sceneState: SceneState = {
      narrationLines: ['narration-one', 'narration-two'],
      sceneDescription: 'scene',
    };

    const result = assembleNarrativeContext(
      { codexIds: ['c1', 'c2'], npcIds: ['npc_bartender'] },
      codexMap,
      memories,
      sceneState,
      'look around',
      undefined,
      { maxBudget: 15 },
    );

    const omittedCount =
      result.omittedContext.codexIds.length +
      result.omittedContext.memoryIds.length +
      result.omittedContext.narrationIndexes.length;
    expect(omittedCount).toBeGreaterThan(0);
    expect(result.codexEntries.length + result.npcMemories.length + result.recentNarration.length).toBeLessThan(6);
  });
});

describe('assembleNpcContext (backward compatibility)', () => {
  it('still works with original signature', () => {
    const result = assembleNpcContext(
      testNpcProfile,
      testMemories,
      'A warm tavern',
      'greet bartender',
    );

    expect(result.npc).toBe(testNpcProfile);
    expect(result.memories).toHaveLength(2);
    expect(result.scene).toBe('A warm tavern');
    expect(result.playerAction).toBe('greet bartender');
  });
});

describe('assembleFilteredNpcContext', () => {
  const codexMap = new Map<string, CodexEntry>();
  codexMap.set('loc_tavern', makeCodexEntry('loc_tavern', 'The Silverwood Tavern'));
  codexMap.set('secret_lore', makeCodexEntry('secret_lore', 'Ancient dragon secret'));

  it('returns no world_truth chunks in filteredChunks', () => {
    const result = assembleFilteredNpcContext(
      testNpcProfile,
      testNpcFilterCtx,
      testMemories,
      codexMap,
      testSceneState.sceneDescription,
      'ask about rumors',
    );

    const worldTruthChunks = result.filteredChunks.filter(
      c => c.epistemicLevel === 'world_truth',
    );
    expect(worldTruthChunks).toHaveLength(0);
  });

  it('returns scene_visible chunks', () => {
    const result = assembleFilteredNpcContext(
      testNpcProfile,
      testNpcFilterCtx,
      testMemories,
      codexMap,
      testSceneState.sceneDescription,
      'ask about rumors',
    );

    const sceneChunks = result.filteredChunks.filter(
      c => c.epistemicLevel === 'scene_visible',
    );
    expect(sceneChunks.length).toBeGreaterThan(0);
  });

  it('returns npc_memory only for the matching NPC', () => {
    const result = assembleFilteredNpcContext(
      testNpcProfile,
      testNpcFilterCtx,
      testMemories,
      codexMap,
      testSceneState.sceneDescription,
      'ask about rumors',
    );

    const memoryChunks = result.filteredChunks.filter(
      c => c.epistemicLevel === 'npc_memory',
    );
    for (const chunk of memoryChunks) {
      expect(chunk.sourceId).toBe('npc_bartender');
    }
  });

  it('also returns the backward-compatible npcContext', () => {
    const result = assembleFilteredNpcContext(
      testNpcProfile,
      testNpcFilterCtx,
      testMemories,
      codexMap,
      testSceneState.sceneDescription,
      'ask about rumors',
    );

    expect(result.npcContext.npc).toBe(testNpcProfile);
    expect(result.npcContext.memories).toHaveLength(2);
  });
});

describe('assembleNarrativeContextWithEnvelope', () => {
  beforeEach(() => {
    playerKnowledgeStore.setState((draft) => {
      draft.entries = {
        pk1: {
          id: 'pk1',
          codexEntryId: 'loc_tavern',
          source: 'exploration',
          turnNumber: 5,
          credibility: 0.9,
          knowledgeStatus: 'confirmed',
          description: 'Player knows about the tavern layout',
          relatedQuestId: null,
        },
      };
    });
  });

  it('builds valid envelope with all 5 categories', () => {
    const codexMap = new Map<string, CodexEntry>();
    codexMap.set('loc_tavern', makeCodexEntry('loc_tavern', 'The Silverwood Tavern'));

    const result = assembleNarrativeContextWithEnvelope(
      { codexIds: ['loc_tavern'], npcIds: ['npc_bartender'] },
      codexMap,
      testMemories,
      testSceneState,
      'look around',
    );

    expect(result.context).toBeDefined();
    expect(result.envelope).toBeDefined();

    expect(result.envelope.worldTruth.length).toBeGreaterThan(0);
    expect(result.envelope.sceneVisible.length).toBeGreaterThan(0);
    expect(result.envelope.playerKnowledge.length).toBeGreaterThan(0);
  });

  it('envelope worldTruth comes from codex entries', () => {
    const codexMap = new Map<string, CodexEntry>();
    codexMap.set('loc_tavern', makeCodexEntry('loc_tavern', 'The Silverwood Tavern'));

    const result = assembleNarrativeContextWithEnvelope(
      { codexIds: ['loc_tavern'], npcIds: [] },
      codexMap,
      [],
      testSceneState,
      'look around',
    );

    expect(result.envelope.worldTruth).toHaveLength(1);
    expect(result.envelope.worldTruth[0]!.sourceType).toBe('codex');
  });

  it('returns backward-compatible AssembledContext', () => {
    const codexMap = new Map<string, CodexEntry>();
    codexMap.set('loc_tavern', makeCodexEntry('loc_tavern', 'The Silverwood Tavern'));

    const result = assembleNarrativeContextWithEnvelope(
      { codexIds: ['loc_tavern'], npcIds: ['npc_bartender'] },
      codexMap,
      testMemories,
      testSceneState,
      'look around',
    );

    expect(result.context.codexEntries).toHaveLength(1);
    expect(result.context.playerAction).toBe('look around');
    expect(result.context.sceneContext).toBe(testSceneState.sceneDescription);
  });
});
