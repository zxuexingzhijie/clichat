import type { Item } from '../../codex/schemas/entry-types';
import type { ActionHandler } from './types';

export const handleTake: ActionHandler = async (action, ctx) => {
  if (!ctx.codexEntries) {
    return { status: 'error', message: '世界数据未加载。' };
  }

  const sceneState = ctx.stores.scene.getState();
  const droppedItems = sceneState.droppedItems;

  let itemId: string | undefined = action.target;

  if (!itemId) {
    if (droppedItems.length === 0) {
      return { status: 'error', message: '地上没有可拾取的物品。' };
    }
    if (droppedItems.length === 1) {
      itemId = droppedItems[0];
    } else {
      const names = droppedItems.map(id => {
        const e = ctx.codexEntries!.get(id);
        return (e as Item | undefined)?.name ?? id;
      }).join('、');
      return { status: 'error', message: `地上有多个物品：${names}。请指定要拾取的物品。` };
    }
  }

  if (!droppedItems.includes(itemId)) {
    return { status: 'error', message: '地上没有该物品。' };
  }

  const entry = ctx.codexEntries.get(itemId);
  const itemName = (entry as Item | undefined)?.name ?? itemId;

  const pickedId = itemId;

  ctx.stores.scene.setState(draft => {
    draft.droppedItems = draft.droppedItems.filter(id => id !== pickedId);
  });

  ctx.stores.player.setState(draft => {
    draft.tags = [...draft.tags, `item:${pickedId}`];
  });

  const narrationLine = `你拾起了${itemName}。`;
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
