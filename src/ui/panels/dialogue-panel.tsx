import React, { useCallback, useState, useRef } from 'react';
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
  readonly role: string;
  readonly content: string;
};

const RECENT_HISTORY_COUNT = 4;

export function getDialogueHistoryView(
  dialogueHistory: readonly DialogueEntry[],
  showFullHistory: boolean,
): {
  readonly visibleHistory: readonly DialogueEntry[];
  readonly hiddenEarlierCount: number;
  readonly hasMoreHistory: boolean;
} {
  const nonGreetHistory = dialogueHistory.filter((entry) => !(entry.role === 'user' && entry.content === 'greet'));

  if (showFullHistory) {
    return {
      visibleHistory: nonGreetHistory,
      hiddenEarlierCount: 0,
      hasMoreHistory: false,
    };
  }

  const hiddenEarlierCount = Math.max(0, nonGreetHistory.length - RECENT_HISTORY_COUNT);
  return {
    visibleHistory: nonGreetHistory.slice(-RECENT_HISTORY_COUNT),
    hiddenEarlierCount,
    hasMoreHistory: hiddenEarlierCount > 0,
  };
}

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
  const [showFullHistory, setShowFullHistory] = useState(false);
  const isFreeTextModeRef = useRef(false);

  const setFreeTextMode = useCallback((value: boolean) => {
    isFreeTextModeRef.current = value;
    setIsFreeTextMode(value);
  }, []);

  const handleInput = useCallback(
    (input: string, key: { upArrow?: boolean; downArrow?: boolean; return?: boolean; escape?: boolean; tab?: boolean }) => {
      if (key.escape) {
        if (isFreeTextModeRef.current) {
          setFreeTextMode(false);
          return;
        }
        onEscape();
        return;
      }
      if (input === '\t' || key.tab) {
        setShowFullHistory((value) => !value);
      } else if (key.upArrow) {
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
    [responseOptions.length, selectedIndex, onSelect, onExecute, onEscape, setFreeTextMode],
  );

  useInput(handleInput, { isActive: isActive && !isFreeTextMode });

  const relLabel = getAttitudeLabel(relationshipValue);
  const { visibleHistory, hiddenEarlierCount, hasMoreHistory } = getDialogueHistoryView(dialogueHistory, showFullHistory);

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color="cyan">【{npcName}】</Text>
        <Text dimColor>关系: {relLabel}</Text>
      </Box>
      <Text> </Text>
      {hasMoreHistory && (
        <Text dimColor>  ↑ 还有 {hiddenEarlierCount} 条早期对话...（按 Tab 查看全部）</Text>
      )}
      {showFullHistory && (
        <Text dimColor>  已显示全部对话（按 Tab 返回最近）</Text>
      )}
      {visibleHistory.length === 0 && (
        <Text dimColor>......</Text>
      )}
      {visibleHistory.map((entry, i) => (
        <Text key={i} dimColor={entry.role !== 'assistant'}>
          {entry.role === 'assistant' ? `"${entry.content}"` : `你："${entry.content}"`}
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
          if (value.length > 0 && !isFreeTextModeRef.current) {
            setFreeTextMode(true);
          } else if (value.length === 0 && isFreeTextModeRef.current) {
            setFreeTextMode(false);
          }
        }}
        onSubmit={(text) => {
          if (text.trim()) {
            setFreeTextMode(false);
            onFreeTextSubmit(text.trim());
          }
        }}
      />
      <Text dimColor>↑↓ 选择    Enter 确认    Tab {showFullHistory ? '最近' : '全部'}对话    直接输入 与NPC对话    Esc {isFreeTextMode ? '退出输入' : '结束对话'}</Text>
    </Box>
  );
}
