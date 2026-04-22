import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

type InlineConfirmProps = {
  readonly message: string;
  readonly defaultOption: 'y' | 'n';
  readonly onConfirm: (confirmed: boolean) => void;
};

export function InlineConfirm({
  message,
  defaultOption,
  onConfirm,
}: InlineConfirmProps): React.ReactNode {
  const optionText = defaultOption === 'y' ? '(Y/n)' : '(y/N)';

  useInput(useCallback((input: string, key: { return: boolean }) => {
    const lower = input.toLowerCase();
    if (lower === 'y') {
      onConfirm(true);
    } else if (lower === 'n') {
      onConfirm(false);
    } else if (key.return) {
      onConfirm(defaultOption === 'y');
    }
  }, [onConfirm, defaultOption]));

  return (
    <Box>
      <Text>{message} </Text>
      <Text color="yellow">{optionText}</Text>
    </Box>
  );
}
