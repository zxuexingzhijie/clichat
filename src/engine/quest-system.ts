import { queryById } from '../codex/query';
import { questStore, appendQuestEvent } from '../state/quest-store';
import { relationStore } from '../state/relation-store';
import { gameStore } from '../state/game-store';
import type { CodexEntry, QuestTemplate } from '../codex/schemas/entry-types';

export type QuestResult =
  | { readonly status: 'ok' }
  | { readonly status: 'gated'; readonly reason: string }
  | { readonly status: 'error'; readonly reason: string };

export interface QuestSystem {
  readonly acceptQuest: (questId: string) => QuestResult;
  readonly completeObjective: (questId: string, objectiveId: string) => void;
  readonly advanceStage: (questId: string, stageId: string) => void;
  readonly failQuest: (questId: string) => void;
}

export function createQuestSystem(codexEntries: Map<string, CodexEntry>): QuestSystem {
  function getTemplate(questId: string): QuestTemplate | null {
    const entry = queryById(codexEntries, questId);
    return entry?.type === 'quest' ? (entry as QuestTemplate) : null;
  }

  function acceptQuest(questId: string): QuestResult {
    const template = getTemplate(questId);
    if (!template) return { status: 'error', reason: `找不到任务: ${questId}` };

    const currentProgress = questStore.getState().quests[questId];
    if (currentProgress?.status === 'active') return { status: 'ok' };

    if (template.min_reputation !== undefined && template.required_npc_id) {
      const npcId = template.required_npc_id;
      const disposition = relationStore.getState().npcDispositions[npcId]?.value ?? 0;
      if (disposition < template.min_reputation) {
        return { status: 'gated', reason: '声望不足' };
      }
    }

    const turnNumber = gameStore.getState().turnCount;
    const firstStageId = template.stages[0]?.id ?? null;

    questStore.setState(draft => {
      draft.quests[questId] = {
        status: 'active',
        currentStageId: firstStageId,
        completedObjectives: [],
        discoveredClues: [],
        flags: {},
        acceptedAt: turnNumber,
        completedAt: null,
      };
    });

    appendQuestEvent({ questId, type: 'quest_started', turnNumber, details: { questTitle: template.name } });
    return { status: 'ok' };
  }

  function completeObjective(questId: string, objectiveId: string): void {
    questStore.setState(draft => {
      const progress = draft.quests[questId];
      if (progress && !progress.completedObjectives.includes(objectiveId)) {
        progress.completedObjectives = [...progress.completedObjectives, objectiveId];
      }
    });
    appendQuestEvent({
      questId,
      type: 'objective_completed',
      turnNumber: gameStore.getState().turnCount,
      details: { objectiveId },
    });
  }

  function advanceStage(questId: string, stageId: string): void {
    questStore.setState(draft => {
      const progress = draft.quests[questId];
      if (progress) progress.currentStageId = stageId;
    });
    appendQuestEvent({
      questId,
      type: 'stage_advanced',
      turnNumber: gameStore.getState().turnCount,
      details: { stageId },
    });
  }

  function failQuest(questId: string): void {
    const turnNumber = gameStore.getState().turnCount;
    questStore.setState(draft => {
      const progress = draft.quests[questId];
      if (progress) progress.status = 'failed';
    });
    appendQuestEvent({ questId, type: 'quest_failed', turnNumber });
  }

  return { acceptQuest, completeObjective, advanceStage, failQuest };
}
