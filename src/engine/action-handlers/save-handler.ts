import type { ActionHandler } from './types';

export const handleSave: ActionHandler = async (action, ctx) => {
  if (ctx.saveFileManager && ctx.serializer && ctx.saveDir) {
    const filePath = action.target
      ? await ctx.saveFileManager.saveGame(action.target, ctx.serializer, ctx.saveDir)
      : await ctx.saveFileManager.quickSave(ctx.serializer, ctx.saveDir);
    return { status: 'action_executed', action, narration: [`游戏已保存: ${filePath}`] };
  }
  return { status: 'error', message: '存档系统未初始化' };
};
