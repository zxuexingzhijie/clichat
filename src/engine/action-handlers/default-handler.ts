import { resolveNormalCheck } from '../adjudication';
import { GAME_CONSTANTS } from '../game-constants';
import { rollD20 } from '../dice';
import type { ActionHandler } from './types';

function getRelevantAttribute(actionType: string): 'physique' | 'finesse' | 'mind' {
  switch (actionType) {
    case 'attack':
    case 'guard':
    case 'flee':
      return 'physique';
    case 'inspect':
    case 'use_item':
    case 'trade':
      return 'finesse';
    case 'talk':
    case 'cast':
      return 'mind';
    default:
      return 'physique';
  }
}

export const handleDefault: ActionHandler = async (action, ctx) => {
  const player = ctx.stores.player.getState();
  const attributeName = getRelevantAttribute(action.type);
  const attrMod = player.attributes[attributeName] ?? 0;
  const roll = rollD20(ctx.rng);
  const dc = GAME_CONSTANTS.DEFAULT_DC;

  const checkResult = resolveNormalCheck({
    roll,
    attributeName,
    attributeModifier: attrMod,
    skillModifier: 0,
    environmentModifier: 0,
    dc,
  });

  ctx.eventBus.emit('action_resolved', { action, result: checkResult });

  const currentLines = ctx.stores.scene.getState().narrationLines;
  const newNarration = [...currentLines, checkResult.display];
  ctx.stores.scene.setState(draft => {
    draft.narrationLines = newNarration;
  });

  ctx.stores.game.setState(draft => {
    draft.turnCount += 1;
  });

  return {
    status: 'action_executed',
    action,
    checkResult,
    narration: newNarration,
  };
};
