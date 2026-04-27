import type { ActionHandler } from './types';

export const handleMove: ActionHandler = async (action, ctx) => {
  if (ctx.sceneManager) {
    const result = await ctx.sceneManager.handleGo(action.target ?? '');
    if (result.status === 'success') {
      return { status: 'action_executed', action, narration: result.narration };
    }
    return { status: 'error', message: result.message };
  }
  return { status: 'error', message: '场景系统未初始化' };
};
