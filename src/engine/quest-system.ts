import { queryById } from '../codex/query';
import { appendQuestEvent } from '../state/quest-store';
import { applyFactionReputationDelta, applyReputationDelta } from './reputation-system';
import { getDefaultNpcDisposition } from '../state/relation-store';
import type { Store } from '../state/create-store';
import type { QuestState } from '../state/quest-store';
import type { RelationState } from '../state/relation-store';
import type { PlayerState } from '../state/player-store';
import type { GameState } from '../state/game-store';
import type { CodexEntry, QuestTemplate } from '../codex/schemas/entry-types';
import type { EventBus } from '../events/event-bus';

export type QuestResult =
  | { readonly status: 'ok' }
  | { readonly status: 'gated'; readonly reason: string }
  | { readonly status: 'error'; readonly reason: string };

export interface QuestSystem {
  readonly acceptQuest: (questId: string) => QuestResult;
  readonly completeObjective: (questId: string, objectiveId: string) => void;
  readonly advanceStage: (questId: string, stageId: string) => void;
  readonly failQuest: (questId: string) => void;
  readonly completeQuest: (questId: string) => void;
}

export function createQuestSystem(
  stores: {
    quest: Store<QuestState>;
    relation: Store<RelationState>;
    player: Store<PlayerState>;
    game: Store<GameState>;
  },
  codexEntries: Map<string, CodexEntry>,
  bus?: EventBus,
): QuestSystem {
  function getTemplate(questId: string): QuestTemplate | null {
    const entry = queryById(codexEntries, questId);
    return entry?.type === 'quest' ? (entry as QuestTemplate) : null;
  }

  function acceptQuest(questId: string): QuestResult {
    const template = getTemplate(questId);
    if (!template) return { status: 'error', reason: `找不到任务: ${questId}` };

    const currentProgress = stores.quest.getState().quests[questId];
    if (currentProgress?.status === 'active') return { status: 'ok' };

    if (template.min_reputation !== undefined && template.required_npc_id) {
      const npcId = template.required_npc_id;
      const disposition = stores.relation.getState().npcDispositions[npcId]?.value ?? 0;
      if (disposition < template.min_reputation) {
        return { status: 'gated', reason: '声望不足' };
      }
    }

    const turnNumber = stores.game.getState().turnCount;
    const firstStageId = template.stages[0]?.id ?? null;

    stores.quest.setState(draft => {
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
    stores.quest.setState(draft => {
      const progress = draft.quests[questId];
      if (progress && !progress.completedObjectives.includes(objectiveId)) {
        progress.completedObjectives = [...progress.completedObjectives, objectiveId];
      }
    });
    appendQuestEvent({
      questId,
      type: 'objective_completed',
      turnNumber: stores.game.getState().turnCount,
      details: { objectiveId },
    });
  }

  function advanceStage(questId: string, stageId: string): void {
    stores.quest.setState(draft => {
      const progress = draft.quests[questId];
      if (progress) progress.currentStageId = stageId;
    });
    appendQuestEvent({
      questId,
      type: 'stage_advanced',
      turnNumber: stores.game.getState().turnCount,
      details: { stageId },
    });
  }

  function failQuest(questId: string): void {
    const turnNumber = stores.game.getState().turnCount;
    stores.quest.setState(draft => {
      const progress = draft.quests[questId];
      if (progress) progress.status = 'failed';
    });
    appendQuestEvent({ questId, type: 'quest_failed', turnNumber });
  }

  function completeQuest(questId: string): void {
    const turnNumber = stores.game.getState().turnCount;
    const template = getTemplate(questId);
    stores.quest.setState(draft => {
      const progress = draft.quests[questId];
      if (progress) {
        progress.status = 'completed';
        progress.completedAt = turnNumber;
      }
    });
    if (template?.rewards?.gold) {
      stores.player.setState(draft => {
        draft.gold += template.rewards!.gold!;
      });
    }
    if (template?.rewards?.reputation_delta) {
      for (const [factionId, delta] of Object.entries(template.rewards.reputation_delta)) {
        applyFactionReputationDelta(stores.relation, factionId, delta);
      }
    }
    if (template?.rewards?.relation_delta) {
      for (const [npcId, delta] of Object.entries(template.rewards.relation_delta)) {
        stores.relation.setState(draft => {
          const current = draft.npcDispositions[npcId] ?? getDefaultNpcDisposition();
          draft.npcDispositions = {
            ...draft.npcDispositions,
            [npcId]: applyReputationDelta(current, { value: delta }),
          };
        });
      }
    }
    appendQuestEvent({ questId, type: 'quest_completed', turnNumber });
  }

  const pendingConditions = new Map<string, Set<string>>();

  function checkAndAdvance(questId: string, conditionKey: 'primary' | 'secondary'): void {
    const progress = stores.quest.getState().quests[questId];
    if (!progress || progress.status !== 'active') return;
    const stageId = progress.currentStageId;
    if (!stageId) return;
    const template = getTemplate(questId);
    const stage = template?.stages.find(s => s.id === stageId);
    if (!stage?.trigger) return;
    const mapKey = `${questId}:${stageId}`;
    const pending = pendingConditions.get(mapKey) ?? new Set<string>();
    pending.add(conditionKey);
    pendingConditions.set(mapKey, pending);
    const needsBoth = !!stage.trigger.secondaryEvent;
    const canAdvance = needsBoth
      ? pending.has('primary') && pending.has('secondary')
      : pending.has('primary');
    if (canAdvance && stage.nextStageId) {
      pendingConditions.delete(mapKey);
      advanceStage(questId, stage.nextStageId);
    } else if (canAdvance && !stage.nextStageId) {
      pendingConditions.delete(mapKey);
      completeQuest(questId);
    }
  }

  if (bus) {
    bus.on('dialogue_ended', ({ npcId }) => {
      for (const [questId, entry] of codexEntries) {
        if (entry.type !== 'quest') continue;
        const template = entry as QuestTemplate;
        if (!template.auto_accept) continue;
        const progress = stores.quest.getState().quests[questId];
        if (progress) continue;
        const firstStage = template.stages[0];
        if (!firstStage?.trigger) continue;
        if (firstStage.trigger.event !== 'dialogue_ended') continue;
        if (firstStage.trigger.targetId && firstStage.trigger.targetId !== npcId) continue;
        acceptQuest(questId);
      }

      for (const [questId, progress] of Object.entries(stores.quest.getState().quests)) {
        if (progress.status !== 'active' || !progress.currentStageId) continue;
        const template = getTemplate(questId);
        const stage = template?.stages.find(s => s.id === progress.currentStageId);
        if (!stage?.trigger) continue;
        if (stage.trigger.event === 'dialogue_ended') {
          if (!stage.trigger.targetId || stage.trigger.targetId === npcId) {
            checkAndAdvance(questId, 'primary');
          }
        }
        if (stage.trigger.secondaryEvent === 'dialogue_ended') {
          if (!stage.trigger.secondaryTargetId || stage.trigger.secondaryTargetId === npcId) {
            checkAndAdvance(questId, 'secondary');
          }
        }
      }
    });

    bus.on('scene_changed', ({ sceneId }) => {
      for (const [questId, progress] of Object.entries(stores.quest.getState().quests)) {
        if (progress.status !== 'active' || !progress.currentStageId) continue;
        const template = getTemplate(questId);
        const stage = template?.stages.find(s => s.id === progress.currentStageId);
        if (!stage?.trigger) continue;
        if (stage.trigger.event === 'location_entered' && stage.trigger.targetId === sceneId) {
          checkAndAdvance(questId, 'primary');
        }
        if (stage.trigger.secondaryEvent === 'location_entered' && stage.trigger.secondaryTargetId === sceneId) {
          checkAndAdvance(questId, 'secondary');
        }
      }
    });

    bus.on('item_acquired', ({ itemId }) => {
      for (const [questId, progress] of Object.entries(stores.quest.getState().quests)) {
        if (progress.status !== 'active' || !progress.currentStageId) continue;
        const template = getTemplate(questId);
        const stage = template?.stages.find(s => s.id === progress.currentStageId);
        if (!stage?.trigger) continue;
        if (stage.trigger.event === 'item_found') {
          if (!stage.trigger.targetId || stage.trigger.targetId === itemId) {
            checkAndAdvance(questId, 'primary');
          }
        }
        if (stage.trigger.secondaryEvent === 'item_found') {
          if (!stage.trigger.secondaryTargetId || stage.trigger.secondaryTargetId === itemId) {
            checkAndAdvance(questId, 'secondary');
          }
        }
      }
    });

    bus.on('combat_ended', ({ outcome }) => {
      if (outcome !== 'victory') return;
      for (const [questId, progress] of Object.entries(stores.quest.getState().quests)) {
        if (progress.status !== 'active' || !progress.currentStageId) continue;
        const template = getTemplate(questId);
        const stage = template?.stages.find(s => s.id === progress.currentStageId);
        if (stage?.trigger?.event === 'combat_ended') {
          checkAndAdvance(questId, 'primary');
        }
      }
    });
  }

  return { acceptQuest, completeObjective, advanceStage, failQuest, completeQuest };
}
