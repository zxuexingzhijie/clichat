import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';

type GuardNameInputProps = {
  readonly guardName: string;
  readonly streamingText: string;
  readonly isStreaming: boolean;
  readonly isNameInputActive: boolean;
  readonly namePool: readonly string[];
  readonly onNameSubmitted: (name: string) => void;
  readonly onSkipStreaming: () => void;
  readonly helpText: string;
};

export function GuardNameInput({
  guardName,
  streamingText,
  isStreaming,
  isNameInputActive,
  namePool,
  onNameSubmitted,
  onSkipStreaming,
  helpText,
}: GuardNameInputProps): React.ReactNode {
  const [nameValue, setNameValue] = useState('');
  const [nameKey, setNameKey] = useState(0);

  const handleSubmit = useCallback(
    (val: string) => {
      const trimmed = val.trim();
      onNameSubmitted(trimmed || '\u65c5\u4eba');
    },
    [onNameSubmitted],
  );

  useInput(
    (input, key) => {
      if (isNameInputActive && key.tab) {
        const randomName = namePool[Math.floor(Math.random() * namePool.length)];
        setNameValue(randomName);
        setNameKey((k) => k + 1);
      } else if (isStreaming && !isNameInputActive) {
        if (key.return || input === ' ') {
          onSkipStreaming();
        }
      }
    },
    { isActive: isNameInputActive || isStreaming },
  );

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

      {isNameInputActive && (
        <>
          <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
            <Text> </Text>
          </Box>
          <Text> </Text>
          <Box>
            <Text bold color="cyan">{'> '}</Text>
            <TextInput
              key={nameKey}
              placeholder={'\u8f93\u5165\u4f60\u7684\u540d\u5b57...'}
              defaultValue={nameValue}
              onSubmit={handleSubmit}
            />
          </Box>
          <Text> </Text>
          <Text dimColor>{'Enter 确认    Tab 随机名字    留空为\'旅人\''}</Text>
        </>
      )}

      <Text> </Text>
      <Text dimColor>{'\u547d\u540d'}</Text>
      <Text dimColor>{helpText}</Text>
    </Box>
  );
}
