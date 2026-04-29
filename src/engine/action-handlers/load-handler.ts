import { listSaves } from '../../persistence/save-file-manager';
import type { ActionHandler } from './types';

export const handleLoad: ActionHandler = async (action, ctx) => {
  if (!ctx.saveDir) return { status: 'error', message: '存档系统未初始化' };

  if (action.target === 'list') {
    try {
      const saves = await listSaves(ctx.saveDir);
      if (saves.length === 0) {
        return { status: 'action_executed', action, narration: ['📁 存档列表: 暂无存档。'] };
      }
      const lines = ['📁 存档列表:'];
      for (const entry of saves) {
        const ts = new Date(entry.meta.timestamp).toLocaleString('zh-CN');
        const name = entry.meta.saveName;
        const char = entry.meta.character.name;
        const loc = entry.meta.locationName;
        lines.push(`  · ${name}  [${char}]  ${loc}  ${ts}`);
      }
      return { status: 'action_executed', action, narration: lines };
    } catch {
      return { status: 'error', message: '无法读取存档列表。' };
    }
  }

  if (ctx.saveFileManager && ctx.serializer) {
    const fileName = action.target ?? 'quicksave.json';
    const filePath = fileName.includes('/') ? fileName : `${ctx.saveDir}/${fileName}`;
    await ctx.saveFileManager.loadGame(filePath, ctx.serializer, ctx.saveDir);
    return { status: 'action_executed', action, narration: ['游戏已加载。'] };
  }
  return { status: 'error', message: '存档系统未初始化' };
};
