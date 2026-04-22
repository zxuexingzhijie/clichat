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
