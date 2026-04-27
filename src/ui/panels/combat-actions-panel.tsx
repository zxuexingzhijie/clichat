import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { GAME_CONSTANTS } from '../../engine/game-constants';

type CombatActionsPanelProps = {
  readonly playerMp: number;
  readonly canFlee: boolean;
  readonly hasItems: boolean;
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  readonly onExecute: (index: number) => void;
  readonly isActive: boolean;
};

type CombatAction = {
  readonly label: string;
  readonly disabled: boolean;
  readonly disabledReason?: string;
};

function buildCombatActions(playerMp: number, canFlee: boolean, hasItems: boolean): CombatAction[] {
  return [
    {
      label: '⚔ 攻击 — 挥剑斩击',
      disabled: false,
    },
    {
      label: `✦ 施法 — 火球术 (消耗 ${GAME_CONSTANTS.CAST_MP_COST} MP)`,
      disabled: playerMp < GAME_CONSTANTS.CAST_MP_COST,
      disabledReason: '魔力不足！',
    },
    {
      label: '🛡 防御 — 提高闪避，下回合 AC+2',
      disabled: false,
    },
    {
      label: '🎒 物品 — 使用背包中的物品',
      disabled: !hasItems,
      disabledReason: '背包空空如也。',
    },
    {
      label: '🏃 逃跑 — [技巧检定 DC 10]',
      disabled: !canFlee,
    },
  ];
}

export function CombatActionsPanel({
  playerMp,
  canFlee,
  hasItems,
  selectedIndex,
  onSelect,
  onExecute,
  isActive,
}: CombatActionsPanelProps): React.ReactNode {
  const actions = buildCombatActions(playerMp, canFlee, hasItems);

  const handleInput = useCallback(
    (input: string, key: { upArrow?: boolean; downArrow?: boolean; return?: boolean }) => {
      if (key.upArrow) {
        const next = selectedIndex <= 0 ? actions.length - 1 : selectedIndex - 1;
        onSelect(next);
      } else if (key.downArrow) {
        const next = selectedIndex >= actions.length - 1 ? 0 : selectedIndex + 1;
        onSelect(next);
      } else if (key.return) {
        onExecute(selectedIndex);
      } else {
        const num = parseInt(input, 10);
        if (num >= 1 && num <= actions.length) {
          onSelect(num - 1);
          onExecute(num - 1);
        }
      }
    },
    [actions.length, selectedIndex, onSelect, onExecute],
  );

  useInput(handleInput, { isActive });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>战斗行动</Text>
      {actions.map((action, i) => {
        const isSelected = i === selectedIndex;
        return (
          <Text
            key={`combat-action-${i}`}
            bold={isSelected && !action.disabled}
            color={isSelected && !action.disabled ? 'cyan' : undefined}
            dimColor={action.disabled || (!isSelected)}
          >
            {isSelected ? '❯ ' : '  '}
            {i + 1}. {action.label}
            {i === 4 && !action.disabled ? <Text color="yellow"> DC 10</Text> : null}
          </Text>
        );
      })}
      <Text dimColor>↑↓ 选择    Enter 确认    / 输入自定义行动</Text>
    </Box>
  );
}
