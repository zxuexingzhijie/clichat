import { nanoid } from 'nanoid';
import { type KnowledgeStatus } from '../state/player-knowledge-store';
import type { Store } from '../state/create-store';
import type { PlayerKnowledgeState } from '../state/player-knowledge-store';
import type { GameState } from '../state/game-store';
import type { EventBus } from '../events/event-bus';

const STATUS_RANK: Record<KnowledgeStatus, number> = {
  heard: 0,
  suspected: 1,
  confirmed: 2,
  contradicted: 3,
};

export function addKnowledge(
  stores: { playerKnowledge: Store<PlayerKnowledgeState>; game: Store<GameState> },
  opts: {
  codexEntryId: string | null;
  source: string;
  knowledgeStatus: KnowledgeStatus;
  description: string;
  credibility: number;
  relatedQuestId?: string | null;
}): void {
  const turnNumber = stores.game.getState().turnCount;
  const existingEntries = stores.playerKnowledge.getState().entries;

  const existingByCodex = opts.codexEntryId
    ? Object.values(existingEntries).find(e => e.codexEntryId === opts.codexEntryId)
    : null;

  if (existingByCodex) {
    const existingRank = STATUS_RANK[existingByCodex.knowledgeStatus] ?? 0;
    const newRank = STATUS_RANK[opts.knowledgeStatus] ?? 0;
    if (newRank <= existingRank && opts.knowledgeStatus !== 'contradicted') return;

    stores.playerKnowledge.setState(draft => {
      draft.entries[existingByCodex.id] = {
        ...draft.entries[existingByCodex.id]!,
        knowledgeStatus: opts.knowledgeStatus,
        credibility: opts.credibility,
        source: opts.source,
        turnNumber,
      };
    });
    return;
  }

  const id = nanoid();
  stores.playerKnowledge.setState(draft => {
    draft.entries[id] = {
      id,
      codexEntryId: opts.codexEntryId,
      source: opts.source,
      turnNumber,
      credibility: opts.credibility,
      knowledgeStatus: opts.knowledgeStatus,
      description: opts.description,
      relatedQuestId: opts.relatedQuestId ?? null,
    };
  });
}

export function initKnowledgeTracker(
  stores: { playerKnowledge: Store<PlayerKnowledgeState>; game: Store<GameState> },
  eventBus: EventBus,
): () => void {
  const onDialogueEnded = ({ npcId }: { npcId: string }) => {
    addKnowledge(stores, {
      codexEntryId: npcId,
      source: 'dialogue',
      knowledgeStatus: 'heard',
      description: `与 ${npcId} 的对话`,
      credibility: 0.6,
    });
  };

  const onQuestStageAdvanced = ({ questId, newStageId }: { questId: string; newStageId: string }) => {
    addKnowledge(stores, {
      codexEntryId: null,
      source: 'quest_progress',
      knowledgeStatus: 'suspected',
      description: `任务 ${questId} 进展至 ${newStageId}`,
      credibility: 0.8,
      relatedQuestId: questId,
    });
  };

  const onQuestCompleted = ({ questId }: { questId: string }) => {
    addKnowledge(stores, {
      codexEntryId: null,
      source: 'quest_completion',
      knowledgeStatus: 'confirmed',
      description: `任务 ${questId} 完成`,
      credibility: 1.0,
      relatedQuestId: questId,
    });
  };

  const onSceneChanged = ({ sceneId }: { sceneId: string }) => {
    addKnowledge(stores, {
      codexEntryId: sceneId,
      source: 'exploration',
      knowledgeStatus: 'confirmed',
      description: `探索了 ${sceneId}`,
      credibility: 1.0,
    });
  };

  eventBus.on('dialogue_ended', onDialogueEnded);
  eventBus.on('quest_stage_advanced', onQuestStageAdvanced);
  eventBus.on('quest_completed', onQuestCompleted);
  eventBus.on('scene_changed', onSceneChanged);

  return () => {
    eventBus.off('dialogue_ended', onDialogueEnded);
    eventBus.off('quest_stage_advanced', onQuestStageAdvanced);
    eventBus.off('quest_completed', onQuestCompleted);
    eventBus.off('scene_changed', onSceneChanged);
  };
}
