import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

export const ACTION_PANEL_HINT = '数字/↑↓/Enter　自定义输入在底部';

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
  readonly isStreaming?: boolean;
};

export function ActionsPanel({
  actions,
  selectedIndex,
  onSelect,
  onExecute,
  isActive,
  isStreaming,
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
      <Text dimColor>
        {isStreaming ? 'Enter/Space 跳过动画' : ACTION_PANEL_HINT}
      </Text>
    </Box>
  );
}
