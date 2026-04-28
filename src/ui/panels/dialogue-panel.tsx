import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

type ResponseOption = {
  readonly id: string;
  readonly label: string;
  readonly requiresCheck: boolean;
  readonly checkAttribute?: string;
  readonly checkDc?: number;
};

type DialogueEntry = {
  readonly speaker: string;
  readonly text: string;
};

type DialoguePanelProps = {
  readonly npcName: string;
  readonly dialogueHistory: readonly DialogueEntry[];
  readonly relationshipValue: number;
  readonly emotionHint: string | null;
  readonly responseOptions: readonly ResponseOption[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  readonly onExecute: (index: number) => void;
  readonly isActive: boolean;
  readonly onEscape: () => void;
};

function relationshipLabel(value: number): string {
  if (value < -0.5) return '敌对';
  if (value < -0.1) return '冷淡';
  if (value <= 0.1) return '中立';
  if (value <= 0.5) return '友好';
  return '信任';
}

export function DialoguePanel({
  npcName,
  dialogueHistory,
  relationshipValue,
  emotionHint,
  responseOptions,
  selectedIndex,
  onSelect,
  onExecute,
  isActive,
  onEscape,
}: DialoguePanelProps): React.ReactNode {
  const handleInput = useCallback(
    (input: string, key: { upArrow?: boolean; downArrow?: boolean; return?: boolean; escape?: boolean }) => {
      if (key.escape) {
        onEscape();
        return;
      }
      if (key.upArrow) {
        const next = selectedIndex <= 0 ? responseOptions.length - 1 : selectedIndex - 1;
        onSelect(next);
      } else if (key.downArrow) {
        const next = selectedIndex >= responseOptions.length - 1 ? 0 : selectedIndex + 1;
        onSelect(next);
      } else if (key.return) {
        onExecute(selectedIndex);
      } else {
        const num = parseInt(input, 10);
        if (num >= 1 && num <= responseOptions.length) {
          onSelect(num - 1);
          onExecute(num - 1);
        }
      }
    },
    [responseOptions.length, selectedIndex, onSelect, onExecute, onEscape],
  );

  useInput(handleInput, { isActive });

  const relLabel = relationshipLabel(relationshipValue);
  const recentHistory = dialogueHistory.slice(-4);

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color="cyan">【{npcName}】</Text>
        <Text dimColor>关系: {relLabel}</Text>
      </Box>
      <Text> </Text>
      {recentHistory.length === 0 && (
        <Text dimColor>......</Text>
      )}
      {recentHistory.map((entry, i) => (
        <Text key={i} dimColor={entry.speaker !== 'npc'}>
          {entry.speaker === 'npc' ? `"${entry.text}"` : `你："${entry.text}"`}
        </Text>
      ))}
      {emotionHint && (
        <>
          <Text> </Text>
          <Text dimColor italic>（{emotionHint}）</Text>
        </>
      )}
      <Text> </Text>
      <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
        <Text> </Text>
      </Box>
      <Text> </Text>
      {responseOptions.map((option, i) => {
        const isSelected = i === selectedIndex;
        return (
          <Box key={option.id} flexDirection="row">
            {option.requiresCheck && option.checkAttribute && option.checkDc ? (
              <Text
                bold={isSelected}
                color={isSelected ? 'cyan' : undefined}
                dimColor={!isSelected}
              >
                {isSelected ? '❯ ' : '  '}
                {i + 1}. <Text color="yellow">[{option.checkAttribute}检定 DC {option.checkDc}]</Text> {option.label.replace(/\[.*?\]\s*/, '')}
              </Text>
            ) : (
              <Text
                bold={isSelected}
                color={isSelected ? 'cyan' : undefined}
                dimColor={!isSelected}
              >
                {isSelected ? '❯ ' : '  '}
                {i + 1}. {option.label}
              </Text>
            )}
          </Box>
        );
      })}
      <Text> </Text>
      <Text dimColor>↑↓ 选择    Enter 确认    Esc 结束对话</Text>
    </Box>
  );
}
