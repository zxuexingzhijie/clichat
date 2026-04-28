import type { ActionHandler } from './types';
import type { QuestTemplate } from '../../codex/schemas/entry-types';

export const handleQuest: ActionHandler = async (action, ctx) => {
  if (action.target === 'accept' && ctx.questSystem) {
    const questId = (action.modifiers as Record<string, string>)['id'] ?? '';
    const result = ctx.questSystem.acceptQuest(questId);
    if (result.status === 'gated') {
      return { status: 'error', message: result.reason };
    }
    if (result.status === 'error') {
      return { status: 'error', message: result.reason };
    }
    return { status: 'action_executed', action, narration: [`任务已接受: ${questId}`] };
  }

  if (action.target === 'status') {
    if (!ctx.questSystem || !ctx.questStore) {
      return { status: 'error', message: '任务系统不可用' };
    }
    const quests = ctx.questStore.getState().quests;
    const activeQuests = Object.entries(quests).filter(([, p]) => p.status === 'active');
    if (activeQuests.length === 0) {
      return { status: 'action_executed', action, narration: ['当前没有进行中的任务。'] };
    }
    const lines: string[] = ['进行中的任务：'];
    for (const [questId, progress] of activeQuests) {
      const template = ctx.codexEntries?.get(questId) as QuestTemplate | undefined;
      const questName = template?.name ?? questId;
      const stageDesc = progress.currentStageId
        ? (template?.stages.find(s => s.id === progress.currentStageId)?.description ?? progress.currentStageId)
        : '未知阶段';
      lines.push(`• ${questName}: ${stageDesc}`);
    }
    return { status: 'action_executed', action, narration: lines };
  }

  if (action.target === 'journal') {
    if (!ctx.questSystem || !ctx.questStore) {
      return { status: 'error', message: '任务系统不可用' };
    }
    const quests = ctx.questStore.getState().quests;
    const journalEntries = Object.entries(quests).filter(
      ([, p]) => p.status === 'active' || p.status === 'completed',
    );
    if (journalEntries.length === 0) {
      return { status: 'action_executed', action, narration: ['任务日志为空。'] };
    }
    const lines: string[] = ['任务日志：'];
    for (const [questId, progress] of journalEntries) {
      const template = ctx.codexEntries?.get(questId) as QuestTemplate | undefined;
      const questName = template?.name ?? questId;
      if (progress.status === 'completed') {
        lines.push(`• ${questName} (已完成)`);
      } else {
        const stageDesc = progress.currentStageId
          ? (template?.stages.find(s => s.id === progress.currentStageId)?.description ?? progress.currentStageId)
          : '未知阶段';
        lines.push(`• ${questName}: ${stageDesc}`);
      }
    }
    return { status: 'action_executed', action, narration: lines };
  }

  return { status: 'error', message: '未知任务指令' };
};
