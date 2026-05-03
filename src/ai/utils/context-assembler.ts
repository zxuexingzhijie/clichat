import type { CodexEntry } from '../../codex/schemas/entry-types';
import type { NpcProfile } from '../prompts/npc-system';
import {
  tagContextChunk,
  buildCognitiveEnvelope,
  filterForNpcActor,
  filterForNarrativeDirector,
  type CognitiveContextEnvelope,
  type TaggedContextChunk,
} from './epistemic-tagger';
import type { NpcFilterContext } from './npc-knowledge-filter';
import { playerKnowledgeStore } from '../../state/player-knowledge-store';

export type NpcMemory = {
  readonly npcId: string;
  readonly content: string;
  readonly timestamp: number;
};

export type SceneState = {
  readonly narrationLines: readonly string[];
  readonly sceneDescription: string;
};

export type PromptAiGrounding = {
  readonly mustKnow?: readonly string[];
  readonly mustNotInvent?: readonly string[];
  readonly tone?: readonly string[];
  readonly revealPolicy?: Record<string, string | { readonly response: string }>;
};

export type AssembledCodexEntry = {
  readonly id: string;
  readonly description: string;
  readonly aiGrounding?: PromptAiGrounding;
};

export type AssembledContext = {
  readonly codexEntries: ReadonlyArray<AssembledCodexEntry>;
  readonly npcMemories: readonly string[];
  readonly recentNarration: readonly string[];
  readonly sceneContext: string;
  readonly playerAction: string;
  readonly checkResult?: { readonly display: string };
};

export type NpcContext = {
  readonly npc: NpcProfile;
  readonly memories: readonly string[];
  readonly scene: string;
  readonly playerAction: string;
};

function mapAiGrounding(entry: CodexEntry): PromptAiGrounding | undefined {
  if (!entry.ai_grounding) return undefined;
  return {
    mustKnow: entry.ai_grounding.must_know,
    mustNotInvent: entry.ai_grounding.must_not_invent,
    tone: entry.ai_grounding.tone,
    revealPolicy: entry.ai_grounding.reveal_policy,
  };
}

export function assembleNarrativeContext(
  retrievalPlan: { readonly codexIds: readonly string[]; readonly npcIds: readonly string[] },
  codexEntries: Map<string, CodexEntry>,
  npcMemories: readonly NpcMemory[],
  sceneState: SceneState,
  action: string,
  checkResult?: { readonly display: string },
): AssembledContext {
  const resolvedCodex = retrievalPlan.codexIds
    .map((id) => codexEntries.get(id))
    .filter((entry): entry is CodexEntry => entry !== undefined)
    .slice(0, 3)
    .map((entry) => ({
      id: entry.id,
      description: entry.description.slice(0, 200),
      aiGrounding: mapAiGrounding(entry),
    }));

  const resolvedMemories = npcMemories
    .filter((m) => retrievalPlan.npcIds.includes(m.npcId))
    .slice(0, 3)
    .map((m) => m.content);

  const recentNarration = sceneState.narrationLines.slice(-3);

  return {
    codexEntries: resolvedCodex,
    npcMemories: resolvedMemories,
    recentNarration,
    sceneContext: sceneState.sceneDescription,
    playerAction: action,
    checkResult,
  };
}

// Dead code: assembleNpcContext and assembleFilteredNpcContext have no production callers.
// assembleNpcContext also has a stale .slice(0,3) cap. Do not wire these without updating
// the cap and ensuring the return type aligns with the NpcActorOptions-based dialogue path.
export function assembleNpcContext(
  npcProfile: NpcProfile,
  memories: readonly NpcMemory[],
  sceneDescription: string,
  playerAction: string,
): NpcContext {
  const filtered = memories
    .filter((m) => m.npcId === npcProfile.id)
    .slice(0, 3)
    .map((m) => m.content);

  return {
    npc: npcProfile,
    memories: filtered,
    scene: sceneDescription,
    playerAction,
  };
}

export function assembleFilteredNpcContext(
  npcProfile: NpcProfile,
  npcFilterCtx: NpcFilterContext,
  memories: readonly NpcMemory[],
  codexEntries: Map<string, CodexEntry>,
  sceneDescription: string,
  playerAction: string,
): { readonly npcContext: NpcContext; readonly filteredChunks: readonly TaggedContextChunk[] } {
  const npcContext = assembleNpcContext(npcProfile, memories, sceneDescription, playerAction);

  const chunks: TaggedContextChunk[] = [];

  for (const entry of codexEntries.values()) {
    chunks.push(tagContextChunk(entry.description, 'world_truth', entry.id, 'codex'));
  }

  for (const memory of memories.filter(m => m.npcId === npcProfile.id)) {
    chunks.push(tagContextChunk(memory.content, 'npc_memory', npcProfile.id, 'memory'));
  }

  chunks.push(tagContextChunk(sceneDescription, 'scene_visible', 'scene', 'scene'));

  const envelope = buildCognitiveEnvelope(chunks);
  const filteredChunks = filterForNpcActor(envelope, npcFilterCtx.npcId);

  return { npcContext, filteredChunks };
}

export function assembleNarrativeContextWithEnvelope(
  retrievalPlan: { readonly codexIds: readonly string[]; readonly npcIds: readonly string[] },
  codexEntries: Map<string, CodexEntry>,
  npcMemories: readonly NpcMemory[],
  sceneState: SceneState,
  action: string,
  checkResult?: { readonly display: string },
): { readonly context: AssembledContext; readonly envelope: CognitiveContextEnvelope } {
  const context = assembleNarrativeContext(
    retrievalPlan, codexEntries, npcMemories, sceneState, action, checkResult,
  );

  const chunks: TaggedContextChunk[] = [];

  for (const entry of context.codexEntries) {
    chunks.push(tagContextChunk(entry.description, 'world_truth', entry.id, 'codex'));
  }

  for (const memory of context.npcMemories) {
    chunks.push(tagContextChunk(memory, 'npc_memory', 'npc', 'memory'));
  }

  chunks.push(tagContextChunk(sceneState.sceneDescription, 'scene_visible', 'scene', 'scene'));

  const knowledgeEntries = Object.values(playerKnowledgeStore.getState().entries);
  for (const entry of knowledgeEntries) {
    chunks.push(tagContextChunk(entry.description, 'player_knowledge', entry.id, 'knowledge'));
  }

  const envelope = buildCognitiveEnvelope(chunks);
  return { context, envelope };
}
