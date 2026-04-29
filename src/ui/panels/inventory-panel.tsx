import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { PlayerStoreCtx } from '../../app';

type InventoryPanelProps = {
  readonly onClose: () => void;
};

function parseItemTags(tags: readonly string[]): readonly { id: string; quantity: number }[] {
  const counts = new Map<string, number>();
  for (const tag of tags) {
    if (tag.startsWith('item:')) {
      const itemId = tag.slice('item:'.length);
      counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries()).map(([id, quantity]) => ({ id, quantity }));
}

function formatItemName(id: string): string {
  return id.replace(/^item_/, '').replace(/_/g, ' ');
}

export function InventoryPanel({ onClose }: InventoryPanelProps): React.ReactNode {
  const playerState = PlayerStoreCtx.useStoreState((s) => s);

  useInput(useCallback((_input: string, key: { escape: boolean }) => {
    if (key.escape) onClose();
  }, [onClose]));

  const items = parseItemTags(playerState.tags);

  const equipmentEntries = Object.entries(playerState.equipment).filter(
    ([, value]) => value !== null,
  ) as [string, string][];

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color="cyan">【物品栏】</Text>
        <Text dimColor>Esc 关闭</Text>
      </Box>
      <Text> </Text>

      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color="yellow">携带物品</Text>
        <Text dimColor>金币: {playerState.gold}</Text>
      </Box>
      {items.length === 0 ? (
        <Text dimColor>  背包空空如也</Text>
      ) : (
        items.map(({ id, quantity }) => (
          <Box key={id} flexDirection="row">
            <Text>  {formatItemName(id)}</Text>
            {quantity > 1 && <Text dimColor> ×{quantity}</Text>}
          </Box>
        ))
      )}

      <Text> </Text>
      <Text bold color="yellow">装备</Text>
      {equipmentEntries.length === 0 ? (
        <Text dimColor>  {'<无装备>'}</Text>
      ) : (
        equipmentEntries.map(([slot, itemId]) => (
          <Box key={slot} flexDirection="row">
            <Text dimColor>  [{slot}] </Text>
            <Text>{formatItemName(itemId)}</Text>
          </Box>
        ))
      )}

      <Text> </Text>
      <Text dimColor>Esc 关闭物品栏</Text>
    </Box>
  );
}
