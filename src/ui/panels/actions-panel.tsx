import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

type Action = {
  readonly id: string;
  readonly label: string;
};

type ActionsPanelProps = {
  readonly actions: readonly Action[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  readonly onExecute: (index: number) => void;
  readonly isActive: boolean;
};

export function ActionsPanel({
  actions,
  selectedIndex,
  onSelect,
  onExecute,
  isActive,
}: ActionsPanelProps): React.ReactNode {
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
      <Text bold>可选行动</Text>
      {actions.map((action, i) => {
        const isSelected = i === selectedIndex;
        return (
          <Text
            key={action.id}
            bold={isSelected}
            color={isSelected ? 'cyan' : undefined}
            dimColor={!isSelected}
          >
            {isSelected ? '❯ ' : '  '}
            {i + 1}. {action.label}
          </Text>
        );
      })}
      <Text dimColor>↑↓ 选择    Enter 确认    / 输入自定义行动</Text>
    </Box>
  );
}
