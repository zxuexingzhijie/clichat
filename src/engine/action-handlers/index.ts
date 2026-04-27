import type { GameAction } from '../../types/game-action';
import type { ProcessResult } from '../../game-loop';
import type { ActionContext, ActionHandler } from './types';

export type { ActionContext, ActionHandler };

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
