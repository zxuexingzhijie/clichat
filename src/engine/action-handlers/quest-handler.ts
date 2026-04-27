import type { ActionHandler } from './types';

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
  return { status: 'error', message: '未知任务指令' };
};
