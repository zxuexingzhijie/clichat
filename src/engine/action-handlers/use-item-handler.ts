import type { Item } from '../../codex/schemas/entry-types';
import type { ActionHandler } from './types';

const ITEM_TAG_PREFIX = 'item:';

function findItemTag(tags: readonly string[], itemId: string): string | undefined {
  return tags.find(t => t === `${ITEM_TAG_PREFIX}${itemId}`);
}

function removeItemTag(tags: readonly string[], itemId: string): string[] {
  return tags.filter(t => t !== `${ITEM_TAG_PREFIX}${itemId}`);
}

export const handleUseItem: ActionHandler = async (action, ctx) => {
  const itemId = action.target;
  if (!itemId) {
    return { status: 'error', message: '请指定要使用的物品。' };
  }

  const playerState = ctx.stores.player.getState();

  const hasItem = findItemTag(playerState.tags, itemId);
  if (!hasItem) {
    return { status: 'error', message: `背包里没有 ${itemId}。` };
  }

  if (!ctx.codexEntries) {
    return { status: 'error', message: '世界数据未加载。' };
  }

  const entry = ctx.codexEntries.get(itemId);
  if (!entry || entry.type !== 'item') {
    return { status: 'error', message: `未知物品: ${itemId}。` };
  }

  const item = entry as Item;

  if (item.item_type !== 'consumable') {
    return { status: 'error', message: `${item.name} 无法直接使用。` };
  }

  const healAmount = item.heal_amount ?? 0;

  if (healAmount <= 0) {
    return { status: 'error', message: `${item.name} 目前无法使用。` };
  }

  const newHp = Math.min(playerState.maxHp, playerState.hp + healAmount);
  const actualHeal = newHp - playerState.hp;

  ctx.stores.player.setState(draft => {
    draft.hp = newHp;
    draft.tags = removeItemTag(draft.tags, itemId);
  });

  const narrationLine = `你使用了${item.name}，恢复了 ${actualHeal} 点生命值。（HP: ${newHp}/${playerState.maxHp}）`;

  const currentLines = ctx.stores.scene.getState().narrationLines;
  const newLines = [...currentLines, narrationLine];
  ctx.stores.scene.setState(draft => {
    draft.narrationLines = newLines;
  });

  ctx.stores.game.setState(draft => {
    draft.turnCount += 1;
  });

  return { status: 'action_executed', action, narration: newLines };
};
