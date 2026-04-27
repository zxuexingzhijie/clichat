import type { ActionHandler } from './types';

export const handleCombat: ActionHandler = async (action, ctx) => {
  if (!ctx.combatLoop) {
    return { status: 'error', message: '战斗系统未初始化' };
  }

  const COMBAT_ACTIONS = new Set(['attack', 'cast', 'guard', 'flee']);
  if (!COMBAT_ACTIONS.has(action.type)) {
    return { status: 'error', message: '战斗中只能进行战斗行动！' };
  }

  const combatResult = await ctx.combatLoop.processPlayerAction(
    action.type as 'attack' | 'cast' | 'guard' | 'flee',
  );
  if (combatResult.status === 'error') {
    return { status: 'error', message: combatResult.message };
  }
  await ctx.combatLoop.processEnemyTurn();
  await ctx.combatLoop.checkCombatEnd();
  const narration = ctx.stores.combat.getState().lastNarration
    ? [ctx.stores.combat.getState().lastNarration]
    : [];
  return {
    status: 'action_executed',
    action,
    checkResult: ctx.stores.combat.getState().lastCheckResult ?? undefined,
    narration,
  };
};
