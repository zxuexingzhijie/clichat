import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { TextInput } from '@inkjs/ui';

type InputAreaProps = {
  readonly onSubmit: (text: string) => void;
  readonly isActive: boolean;
  readonly mode: 'action' | 'nl' | 'command';
};

export function InputArea({
  onSubmit,
  isActive,
  mode,
}: InputAreaProps): React.ReactNode {
  const [value, setValue] = useState('');

  const handleSubmit = useCallback(
    (text: string) => {
      if (text.trim().length > 0) {
        onSubmit(text.trim());
      }
      setValue('');
    },
    [onSubmit],
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
        onChange={setValue}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}
