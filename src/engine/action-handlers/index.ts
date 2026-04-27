import type { GameAction } from '../../types/game-action';
import type { ProcessResult } from '../../game-loop';
import type { ActionContext, ActionHandler } from './types';
import { handleLook } from './look-handler';
import { handleMove } from './move-handler';
import { handleInspect } from './inspect-handler';
import { handleTalk } from './talk-handler';
import { handleCombat } from './combat-handler';
import { handleSave } from './save-handler';
import { handleLoad } from './load-handler';
import { handleBranch } from './branch-handler';
import { handleJournal, handleMap, handleCodex, handleCompare, handleReplay } from './phase-handlers';
import { handleQuest } from './quest-handler';
import { handleCost } from './cost-handler';
import { handleQuit } from './quit-handler';
import { handleDefault } from './default-handler';

export type { ActionContext, ActionHandler };
export { getLastReplayEntries } from './phase-handlers';

export type ActionRegistry = {
  readonly dispatch: (action: GameAction, ctx: ActionContext) => Promise<ProcessResult>;
};

export function createActionRegistry(
  handlers: Partial<Record<string, ActionHandler>>,
): ActionRegistry {
  return {
    async dispatch(action, ctx) {
      const handler = handlers[action.type];
      if (!handler) {
        return { status: 'error', message: `未知指令: ${action.type}` };
      }
      return handler(action, ctx);
    },
  };
}

const COMBAT_ACTIONS = new Set(['attack', 'cast', 'guard', 'flee']);

const HANDLER_MAP: Record<string, ActionHandler> = {
  look: handleLook,
  move: handleMove,
  inspect: handleInspect,
  talk: handleTalk,
  save: handleSave,
  load: handleLoad,
  branch: handleBranch,
  journal: handleJournal,
  map: handleMap,
  codex: handleCodex,
  compare: handleCompare,
  replay: handleReplay,
  quest: handleQuest,
  cost: handleCost,
  quit: handleQuit,
  attack: handleDefault,
  cast: handleDefault,
  guard: handleDefault,
  flee: handleDefault,
  trade: handleDefault,
  use_item: handleDefault,
};

export function createDefaultRegistry(): ActionRegistry {
  return {
    async dispatch(action, ctx) {
      // Combat intercept: when combat is active, route combat actions to combatLoop
      if (ctx.stores.combat.getState().active && ctx.combatLoop) {
        if (COMBAT_ACTIONS.has(action.type)) {
          return handleCombat(action, ctx);
        }
        return { status: 'error', message: '战斗中只能进行战斗行动！' };
      }

      const handler = HANDLER_MAP[action.type];
      if (!handler) {
        return handleDefault(action, ctx);
      }
      return handler(action, ctx);
    },
  };
}
