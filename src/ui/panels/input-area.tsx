import React, { useCallback } from 'react';
import { Box, Text } from 'ink';
import { TextInput } from '@inkjs/ui';

type InputAreaProps = {
  readonly onSubmit: (text: string) => void;
  readonly isActive: boolean;
  readonly mode: 'action' | 'nl' | 'command';
  readonly value: string;
  readonly onChange: (value: string) => void;
};

export function InputArea({
  onSubmit,
  isActive,
  mode,
  value,
  onChange,
}: InputAreaProps): React.ReactNode {
  const handleSubmit = useCallback(
    (text: string) => {
      if (text.trim().length > 0) {
        onSubmit(text.trim());
      }
      onChange('');
    },
    [onSubmit, onChange],
  );

  if (mode === 'action') {
    return (
      <Box paddingX={1}>
        <Text dimColor>{'> '}</Text>
      </Box>
    );
  }

  const prompt = mode === 'command' ? '/ ' : '> ';

  return (
    <Box paddingX={1}>
      <Text color="cyan">{prompt}</Text>
      <TextInput
        isDisabled={!isActive}
        onChange={onChange}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}
