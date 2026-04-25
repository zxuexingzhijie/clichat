import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

type DialogueOptionView = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
};

type GuardDialoguePanelProps = {
  readonly guardName: string;
  readonly streamingText: string;
  readonly isStreaming: boolean;
  readonly options: readonly DialogueOptionView[];
  readonly showOptions: boolean;
  readonly isActive: boolean;
  readonly onOptionSelected: (optionId: string, optionLabel: string) => void;
  readonly onSkipStreaming: () => void;
  readonly roundNumber: number;
  readonly totalRounds: number;
  readonly helpText: string;
};

export function GuardDialoguePanel({
  guardName,
  streamingText,
  isStreaming,
  options,
  showOptions,
  isActive,
  onOptionSelected,
  onSkipStreaming,
  roundNumber,
  totalRounds,
  helpText,
}: GuardDialoguePanelProps): React.ReactNode {
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    setCursor(0);
  }, [options]);

  const handleInput = useCallback(
    (input: string, key: { upArrow?: boolean; downArrow?: boolean; return?: boolean; space?: boolean }) => {
      if (showOptions) {
        if (key.upArrow) {
          setCursor((c) => (c <= 0 ? options.length - 1 : c - 1));
        } else if (key.downArrow) {
          setCursor((c) => (c >= options.length - 1 ? 0 : c + 1));
        } else if (key.return) {
          const opt = options[cursor];
          if (opt) onOptionSelected(opt.id, opt.label);
        } else {
          const num = parseInt(input, 10);
          if (num >= 1 && num <= options.length) {
            const idx = num - 1;
            const opt = options[idx];
            if (opt) onOptionSelected(opt.id, opt.label);
          }
        }
      } else if (isStreaming) {
        if (key.return || input === ' ') {
          onSkipStreaming();
        }
      }
    },
    [showOptions, isStreaming, options, cursor, onOptionSelected, onSkipStreaming],
  );

  useInput(handleInput, { isActive });

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Text bold color="cyan">{'\u3010'}{guardName}{'\u3011'}</Text>
      <Text> </Text>

      <Box flexDirection="column" flexGrow={1}>
        {streamingText ? (
          <Text>
            {streamingText}
            {isStreaming ? <Text dimColor>...</Text> : null}
          </Text>
        ) : isStreaming ? (
          <Text dimColor>...</Text>
        ) : null}
      </Box>

      {showOptions && (
        <>
          <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
            <Text> </Text>
          </Box>
          <Text> </Text>
          {options.map((opt, i) => {
            const isSelected = i === cursor;
            return (
              <Box key={opt.id} flexDirection="column">
                <Text
                  bold={isSelected}
                  color={isSelected ? 'cyan' : undefined}
                  dimColor={!isSelected}
                >
                  {isSelected ? '\u276f ' : '  '}{i + 1}. {opt.label}
                </Text>
                {isSelected && (
                  <Text dimColor>    {opt.description}</Text>
                )}
              </Box>
            );
          })}
        </>
      )}

      <Text> </Text>
      <Text dimColor>{'\u8f6e\u6b21'} {roundNumber}/{totalRounds}</Text>
      <Text dimColor>{helpText}</Text>
    </Box>
  );
}
