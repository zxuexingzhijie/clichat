import type { ActionHandler } from './types';

export const handleTalk: ActionHandler = async (action, ctx) => {
  if (ctx.dialogueManager) {
    const dialogueResult = await ctx.dialogueManager.startDialogue(action.target ?? '');
    if (dialogueResult.error) {
      return { status: 'error', message: dialogueResult.error };
    }
    ctx.stores.game.setState(draft => {
      draft.phase = 'dialogue';
    });
    const currentLines = ctx.stores.scene.getState().narrationLines;
    return {
      status: 'action_executed',
      action,
      narration: currentLines,
    };
  }
  return { status: 'error', message: '对话系统未初始化' };
};
