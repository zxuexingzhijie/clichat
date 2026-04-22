import { describe, it, expect } from 'bun:test';
import {
  tagContextChunk,
  buildCognitiveEnvelope,
  filterForNpcActor,
  filterForNarrativeDirector,
  type EpistemicLevel,
  type TaggedContextChunk,
  type CognitiveContextEnvelope,
} from './epistemic-tagger';
import { filterCodexForNpc, type NpcFilterContext } from './npc-knowledge-filter';
import type { CodexEntry } from '../../codex/schemas/entry-types';
import type { EpistemicMetadata } from '../../codex/schemas/epistemic';

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

function makeCodexEntry(id: string, epistemicOverrides: Partial<EpistemicMetadata> = {}): CodexEntry {
  return {
    id,
    name: `Entry ${id}`,
    tags: ['test'],
    description: `Description of ${id}`,
    type: 'item' as const,
    item_type: 'misc' as const,
    value: 0,
    epistemic: makeEpistemic(epistemicOverrides),
  };
}

const defaultNpc: NpcFilterContext = {
  npcId: 'npc_bartender',
  npcFactionIds: ['guild_merchants'],
  npcProfession: 'bartender',
  npcLocationId: 'loc_tavern',
  npcRegion: 'region_silverwood',
};

describe('filterCodexForNpc', () => {
  it('returns entries where NPC id is in known_by', () => {
    const entries: CodexEntry[] = [
      makeCodexEntry('secret-recipe', { known_by: ['npc_bartender'], visibility: 'secret' }),
      makeCodexEntry('unrelated', { known_by: ['npc_guard'], visibility: 'secret' }),
    ];

    const result = filterCodexForNpc(entries, defaultNpc);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('secret-recipe');
  });

  it('returns entries where visibility is public', () => {
    const entries: CodexEntry[] = [
      makeCodexEntry('public-info', { visibility: 'public', scope: 'regional' }),
      makeCodexEntry('other-public', { visibility: 'public', scope: 'global' }),
    ];

    const result = filterCodexForNpc(entries, defaultNpc);
    expect(result).toHaveLength(2);
  });

  it('excludes entries where visibility is forbidden', () => {
    const entries: CodexEntry[] = [
      makeCodexEntry('forbidden-lore', { visibility: 'forbidden' }),
      makeCodexEntry('public-info', { visibility: 'public', scope: 'regional' }),
    ];

    const result = filterCodexForNpc(entries, defaultNpc);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('public-info');
  });

  it('excludes entries where visibility is secret and NPC not in known_by', () => {
    const entries: CodexEntry[] = [
      makeCodexEntry('dark-secret', { visibility: 'secret', known_by: ['npc_wizard'] }),
    ];

    const result = filterCodexForNpc(entries, defaultNpc);
    expect(result).toHaveLength(0);
  });

  it('includes entries where scope is regional and NPC location matches entry region', () => {
    const entries: CodexEntry[] = [
      makeCodexEntry('regional-news', { scope: 'regional', visibility: 'public' }),
      makeCodexEntry('local-only', { scope: 'local', visibility: 'public' }),
    ];

    const result = filterCodexForNpc(entries, defaultNpc);
    const ids = result.map(e => e.id);
    expect(ids).toContain('regional-news');
  });

  it('includes entries where NPC faction is in known_by', () => {
    const entries: CodexEntry[] = [
      makeCodexEntry('guild-intel', { known_by: ['guild_merchants'], visibility: 'hidden' }),
    ];

    const result = filterCodexForNpc(entries, defaultNpc);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('guild-intel');
  });

  it('includes entries where NPC profession is in known_by', () => {
    const entries: CodexEntry[] = [
      makeCodexEntry('bartender-gossip', { known_by: ['bartender'], visibility: 'hidden' }),
    ];

    const result = filterCodexForNpc(entries, defaultNpc);
    expect(result).toHaveLength(1);
  });

  it('excludes forbidden entries even if NPC is NOT in known_by', () => {
    const entries: CodexEntry[] = [
      makeCodexEntry('forbidden-truth', { visibility: 'forbidden', known_by: [] }),
    ];

    const result = filterCodexForNpc(entries, defaultNpc);
    expect(result).toHaveLength(0);
  });

  it('includes forbidden entries if NPC is explicitly in known_by', () => {
    const entries: CodexEntry[] = [
      makeCodexEntry('forbidden-but-known', { visibility: 'forbidden', known_by: ['npc_bartender'] }),
    ];

    const result = filterCodexForNpc(entries, defaultNpc);
    expect(result).toHaveLength(1);
  });
});

describe('tagContextChunk', () => {
  it('creates correct TaggedContextChunk with epistemicLevel', () => {
    const chunk = tagContextChunk('The king is dead', 'world_truth', 'codex_01', 'codex');
    expect(chunk).toEqual({
      content: 'The king is dead',
      epistemicLevel: 'world_truth',
      sourceId: 'codex_01',
      sourceType: 'codex',
    });
  });
});

describe('buildCognitiveEnvelope', () => {
  it('correctly partitions chunks by epistemic level', () => {
    const chunks: TaggedContextChunk[] = [
      tagContextChunk('fact', 'world_truth', 'c1', 'codex'),
      tagContextChunk('belief', 'npc_belief', 'npc1', 'belief'),
      tagContextChunk('known', 'player_knowledge', 'pk1', 'journal'),
      tagContextChunk('visible', 'scene_visible', 'scene1', 'scene'),
      tagContextChunk('memory', 'npc_memory', 'npc1', 'memory'),
    ];

    const envelope = buildCognitiveEnvelope(chunks);
    expect(envelope.worldTruth).toHaveLength(1);
    expect(envelope.npcBelief).toHaveLength(1);
    expect(envelope.playerKnowledge).toHaveLength(1);
    expect(envelope.sceneVisible).toHaveLength(1);
    expect(envelope.npcMemory).toHaveLength(1);
  });
});

describe('filterForNpcActor', () => {
  const chunks: TaggedContextChunk[] = [
    tagContextChunk('world fact', 'world_truth', 'c1', 'codex'),
    tagContextChunk('player info', 'player_knowledge', 'pk1', 'journal'),
    tagContextChunk('npc belief', 'npc_belief', 'npc_bartender', 'belief'),
    tagContextChunk('other npc belief', 'npc_belief', 'npc_guard', 'belief'),
    tagContextChunk('scene desc', 'scene_visible', 'scene1', 'scene'),
    tagContextChunk('bartender memory', 'npc_memory', 'npc_bartender', 'memory'),
    tagContextChunk('guard memory', 'npc_memory', 'npc_guard', 'memory'),
  ];

  const envelope = buildCognitiveEnvelope(chunks);

  it('returns only npc_belief, npc_memory, scene_visible chunks', () => {
    const result = filterForNpcActor(envelope, 'npc_bartender');
    const levels = result.map(c => c.epistemicLevel);
    expect(levels).not.toContain('world_truth');
    expect(levels).not.toContain('player_knowledge');
  });

  it('returns zero chunks with epistemicLevel world_truth', () => {
    const result = filterForNpcActor(envelope, 'npc_bartender');
    const worldTruthChunks = result.filter(c => c.epistemicLevel === 'world_truth');
    expect(worldTruthChunks).toHaveLength(0);
  });

  it('returns zero chunks with epistemicLevel player_knowledge', () => {
    const result = filterForNpcActor(envelope, 'npc_bartender');
    const playerChunks = result.filter(c => c.epistemicLevel === 'player_knowledge');
    expect(playerChunks).toHaveLength(0);
  });

  it('includes scene_visible chunks', () => {
    const result = filterForNpcActor(envelope, 'npc_bartender');
    const sceneChunks = result.filter(c => c.epistemicLevel === 'scene_visible');
    expect(sceneChunks).toHaveLength(1);
  });

  it('includes only the matching NPC npc_memory', () => {
    const result = filterForNpcActor(envelope, 'npc_bartender');
    const memoryChunks = result.filter(c => c.epistemicLevel === 'npc_memory');
    expect(memoryChunks).toHaveLength(1);
    expect(memoryChunks[0]!.sourceId).toBe('npc_bartender');
  });

  it('includes only the matching NPC npc_belief', () => {
    const result = filterForNpcActor(envelope, 'npc_bartender');
    const beliefChunks = result.filter(c => c.epistemicLevel === 'npc_belief');
    expect(beliefChunks).toHaveLength(1);
    expect(beliefChunks[0]!.sourceId).toBe('npc_bartender');
  });
});

describe('filterForNarrativeDirector', () => {
  it('includes world_truth but excludes npc_memory', () => {
    const chunks: TaggedContextChunk[] = [
      tagContextChunk('world fact', 'world_truth', 'c1', 'codex'),
      tagContextChunk('npc memory', 'npc_memory', 'npc1', 'memory'),
      tagContextChunk('scene desc', 'scene_visible', 'scene1', 'scene'),
      tagContextChunk('player info', 'player_knowledge', 'pk1', 'journal'),
      tagContextChunk('npc belief', 'npc_belief', 'npc1', 'belief'),
    ];

    const envelope = buildCognitiveEnvelope(chunks);
    const result = filterForNarrativeDirector(envelope);

    const levels = result.map(c => c.epistemicLevel);
    expect(levels).toContain('world_truth');
    expect(levels).toContain('scene_visible');
    expect(levels).toContain('player_knowledge');
    expect(levels).not.toContain('npc_memory');
    expect(levels).not.toContain('npc_belief');
  });
});
