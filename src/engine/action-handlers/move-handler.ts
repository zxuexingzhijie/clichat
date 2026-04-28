import type { ActionHandler } from './types';
import type { Location } from '../../codex/schemas/entry-types';

export const handleMove: ActionHandler = async (action, ctx) => {
  if (!ctx.sceneManager) {
    return { status: 'error', message: '场景系统未初始化' };
  }
  const result = await ctx.sceneManager.handleGo(action.target ?? '');
  if (result.status !== 'success') {
    return { status: 'error', message: result.message };
  }

  if (ctx.combatLoop && ctx.codexEntries) {
    const newSceneId = ctx.sceneManager.getCurrentScene();
    if (newSceneId) {
      const entry = ctx.codexEntries.get(newSceneId);
      const location = entry?.type === 'location' ? (entry as Location) : null;
      const enemies = location?.enemies ?? [];
      const alreadyInCombat = ctx.stores.combat.getState().active;
      if (enemies.length > 0 && !alreadyInCombat) {
        await ctx.combatLoop.startCombat(enemies);
      }
    }
  }

  return { status: 'action_executed', action, narration: result.narration };
};
