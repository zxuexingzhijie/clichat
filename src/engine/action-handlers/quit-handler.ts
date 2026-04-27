import type { ActionHandler } from './types';

export const handleQuit: ActionHandler = async (action, ctx) => {
  ctx.stores.game.setState(draft => { draft.pendingQuit = true; });
  return { status: 'action_executed', action, narration: [] };
};
