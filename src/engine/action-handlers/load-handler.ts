import type { ActionHandler } from './types';

export const handleLoad: ActionHandler = async (action, ctx) => {
  if (ctx.saveFileManager && ctx.serializer && ctx.saveDir) {
    const fileName = action.target ?? 'quicksave.json';
    const filePath = fileName.includes('/') ? fileName : `${ctx.saveDir}/${fileName}`;
    await ctx.saveFileManager.loadGame(filePath, ctx.serializer);
    return { status: 'action_executed', action, narration: ['游戏已加载。'] };
  }
  return { status: 'error', message: '存档系统未初始化' };
};
