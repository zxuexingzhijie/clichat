import React, { useCallback, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';
import { getAttitudeLabel } from '../../engine/reputation-system';

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
  readonly isNpcThinking?: boolean;
  readonly onFreeTextSubmit: (text: string) => void;
};

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
  isNpcThinking = false,
  onFreeTextSubmit,
}: DialoguePanelProps): React.ReactNode {
  const [isFreeTextMode, setIsFreeTextMode] = useState(false);

  const handleInput = useCallback(
    (input: string, key: { upArrow?: boolean; downArrow?: boolean; return?: boolean; escape?: boolean }) => {
      if (key.escape) {
        if (isFreeTextMode) {
          setIsFreeTextMode(false);
          return;
        }
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
    [responseOptions.length, selectedIndex, onSelect, onExecute, onEscape, isFreeTextMode],
  );

  useInput(handleInput, { isActive: isActive && !isFreeTextMode });

  const relLabel = getAttitudeLabel(relationshipValue);
  const recentHistory = dialogueHistory.slice(-4);
  const hasMoreHistory = dialogueHistory.length > 4;

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color="cyan">【{npcName}】</Text>
        <Text dimColor>关系: {relLabel}</Text>
      </Box>
      <Text> </Text>
      {hasMoreHistory && (
        <Text dimColor>  ↑ 还有 {dialogueHistory.length - 4} 条早期对话...</Text>
      )}
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
      {isNpcThinking && (
        <Text dimColor>（思考中...）</Text>
      )}
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
      <TextInput
        placeholder="直接输入你的回应…"
        isDisabled={isNpcThinking}
        onChange={(value) => {
          if (value.length > 0 && !isFreeTextMode) {
            setIsFreeTextMode(true);
          } else if (value.length === 0 && isFreeTextMode) {
            setIsFreeTextMode(false);
          }
        }}
        onSubmit={(text) => {
          if (text.trim()) {
            setIsFreeTextMode(false);
            onFreeTextSubmit(text.trim());
          }
        }}
      />
      <Text dimColor>↑↓ 选择    Enter 确认    直接输入文字 回复NPC    Esc {isFreeTextMode ? '退出输入' : '结束对话'}</Text>
    </Box>
  );
}
