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
import { selectContextItems } from './context-budget';

export type NpcMemory = {
  readonly id?: string;
  readonly npcId: string;
  readonly content: string;
  readonly timestamp: number;
};

export type SceneState = {
  readonly narrationLines: readonly string[];
  readonly sceneDescription: string;
};

export type OmittedNarrativeContext = {
  readonly codexIds: readonly string[];
  readonly memoryIds: readonly string[];
  readonly narrationIndexes: readonly number[];
};

export type AssembledContext = {
  readonly codexEntries: ReadonlyArray<{ readonly id: string; readonly description: string }>;
  readonly npcMemories: readonly string[];
  readonly recentNarration: readonly string[];
  readonly sceneContext: string;
  readonly playerAction: string;
  readonly checkResult?: { readonly display: string };
  readonly omittedContext: OmittedNarrativeContext;
};

export type AssembleNarrativeContextOptions = {
  readonly maxBudget?: number;
  readonly estimate?: (text: string) => number;
};

export type NpcContext = {
  readonly npc: NpcProfile;
  readonly memories: readonly string[];
  readonly scene: string;
  readonly playerAction: string;
};

type CodexBudgetItem = { readonly kind: 'codex'; readonly id: string; readonly description: string };
type MemoryBudgetItem = { readonly kind: 'memory'; readonly id: string; readonly content: string };
type NarrationBudgetItem = { readonly kind: 'narration'; readonly index: number; readonly content: string };

type NarrativeBudgetItem = CodexBudgetItem | MemoryBudgetItem | NarrationBudgetItem;

function estimateText(text: string): number {
  return text.length;
}

function getMemoryId(memory: NpcMemory, fallbackIndex: number): string {
  return memory.id ?? `${memory.npcId}@${memory.timestamp}@${fallbackIndex}`;
}

export function assembleNarrativeContext(
  retrievalPlan: { readonly codexIds: readonly string[]; readonly npcIds: readonly string[] },
  codexEntries: Map<string, CodexEntry>,
  npcMemories: readonly NpcMemory[],
  sceneState: SceneState,
  action: string,
  checkResult?: { readonly display: string },
  options: AssembleNarrativeContextOptions = {},
): AssembledContext {
  const codexItems: CodexBudgetItem[] = retrievalPlan.codexIds
    .map((id) => codexEntries.get(id))
    .filter((entry): entry is CodexEntry => entry !== undefined)
    .map((entry) => ({ kind: 'codex' as const, id: entry.id, description: entry.description }));

  const memoryItems: MemoryBudgetItem[] = npcMemories
    .map((memory, index) => ({ memory, index }))
    .filter(({ memory }) => retrievalPlan.npcIds.includes(memory.npcId))
    .map(({ memory, index }) => ({
      kind: 'memory' as const,
      id: getMemoryId(memory, index),
      content: memory.content,
    }));

  const narrationItems: NarrationBudgetItem[] = sceneState.narrationLines.map((content, index) => ({
    kind: 'narration' as const,
    index,
    content,
  }));

  const allItems = [...codexItems, ...memoryItems, ...narrationItems];
  const estimator = options.estimate ?? estimateText;
  const selectedItems = options.maxBudget === undefined
    ? allItems
    : selectContextItems(allItems, {
      maxBudget: options.maxBudget,
      estimate: (item) => {
        if (item.kind === 'codex') return estimator(item.description);
        return estimator(item.content);
      },
      getId: (item) => {
        if (item.kind === 'codex') return item.id;
        if (item.kind === 'memory') return item.id;
        return String(item.index);
      },
      getPriority: (item) => item.kind === 'narration' ? 3 : item.kind === 'memory' ? 2 : 1,
    }).selectedItems;
  const selectedSet = new Set(selectedItems);

  const resolvedCodex = codexItems
    .filter((item) => selectedSet.has(item))
    .map((entry) => ({ id: entry.id, description: entry.description }));

  const resolvedMemories = memoryItems
    .filter((item) => selectedSet.has(item))
    .map((memory) => memory.content);

  const recentNarration = narrationItems
    .filter((item) => selectedSet.has(item))
    .map((item) => item.content);

  const omittedContext: OmittedNarrativeContext = {
    codexIds: codexItems.filter((item) => !selectedSet.has(item)).map((item) => item.id),
    memoryIds: memoryItems.filter((item) => !selectedSet.has(item)).map((item) => item.id),
    narrationIndexes: narrationItems.filter((item) => !selectedSet.has(item)).map((item) => item.index),
  };

  return {
    codexEntries: resolvedCodex,
    npcMemories: resolvedMemories,
    recentNarration,
    sceneContext: sceneState.sceneDescription,
    playerAction: action,
    checkResult,
    omittedContext,
  };
}

// Dead code: assembleNpcContext and assembleFilteredNpcContext have no production callers.
// Do not wire these without ensuring the return type aligns with the
// NpcActorOptions-based dialogue path.
export function assembleNpcContext(
  npcProfile: NpcProfile,
  memories: readonly NpcMemory[],
  sceneDescription: string,
  playerAction: string,
): NpcContext {
  const filtered = memories
    .filter((m) => m.npcId === npcProfile.id)
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
