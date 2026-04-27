import type { ActionHandler } from './types';

export const handleLook: ActionHandler = async (action, ctx) => {
  if (ctx.sceneManager) {
    const result = await ctx.sceneManager.handleLook(action.target ?? undefined);
    if (result.status === 'success') {
      return { status: 'action_executed', action, narration: result.narration };
    }
    return { status: 'error', message: result.message };
  }
  return {
    status: 'action_executed',
    action,
    narration: ctx.stores.scene.getState().narrationLines,
  };
};
