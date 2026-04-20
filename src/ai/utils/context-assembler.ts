import type { CodexEntry } from '../../codex/schemas/entry-types';
import type { NpcProfile } from '../prompts/npc-system';

export type NpcMemory = {
  readonly npcId: string;
  readonly content: string;
  readonly timestamp: number;
};

export type SceneState = {
  readonly narrationLines: readonly string[];
  readonly sceneDescription: string;
};

export type AssembledContext = {
  readonly codexEntries: ReadonlyArray<{ readonly id: string; readonly description: string }>;
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

export function assembleNpcContext(
  npcProfile: NpcProfile,
  memories: readonly NpcMemory[],
  sceneDescription: string,
  playerAction: string,
): NpcContext {
  const filtered = memories
    .filter((m) => m.npcId === npcProfile.name)
    .slice(0, 3)
    .map((m) => m.content);

  return {
    npc: npcProfile,
    memories: filtered,
    scene: sceneDescription,
    playerAction,
  };
}
