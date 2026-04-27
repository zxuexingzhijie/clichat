import type { ActionHandler } from './types';
import type { TurnLogEntry } from '../../state/serializer';

let lastReplayEntries: readonly TurnLogEntry[] = [];

export function getLastReplayEntries(): readonly TurnLogEntry[] {
  return lastReplayEntries;
}

export const handleJournal: ActionHandler = async (action, ctx) => {
  ctx.stores.game.setState(draft => { draft.phase = 'journal'; });
  return { status: 'action_executed', action, narration: [] };
};

export const handleMap: ActionHandler = async (action, ctx) => {
  ctx.stores.game.setState(draft => { draft.phase = 'map'; });
  return { status: 'action_executed', action, narration: [] };
};

export const handleCodex: ActionHandler = async (action, ctx) => {
  ctx.stores.game.setState(draft => { draft.phase = 'codex'; });
  return { status: 'action_executed', action, narration: [] };
};

export const handleCompare: ActionHandler = async (action, ctx) => {
  ctx.stores.game.setState(draft => { draft.phase = 'compare'; });
  return { status: 'action_executed', action, narration: [] };
};

export const handleReplay: ActionHandler = async (action, ctx) => {
  const count = parseInt(action.target ?? '10', 10);
  if (!ctx.turnLog) return { status: 'error', message: '回放系统未初始化' };
  const entries = ctx.turnLog.replayTurns(isNaN(count) ? 10 : count);
  lastReplayEntries = [...entries];
  ctx.stores.game.setState(draft => { draft.phase = 'replay'; });
  return { status: 'action_executed', action, narration: [] };
};
