import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import figlet from 'figlet';
import gradientString from 'gradient-string';

type TitleScreenProps = {
  readonly onStart: () => void;
};

function generateTitleArt(): string | null {
  try {
    return figlet.textSync('CHRONICLE', { font: 'ANSI Shadow' });
  } catch {
    return null;
  }
}

export function TitleScreen({ onStart }: TitleScreenProps): React.ReactNode {
  const [titleArt] = useState<string | null>(() => generateTitleArt());

  const handleInput = useCallback(() => {
    onStart();
  }, [onStart]);

  useInput(handleInput);

  const gradient = gradientString('cyan', 'magenta');

  return (
    <Box
      flexGrow={1}
      justifyContent="center"
      alignItems="center"
      flexDirection="column"
    >
      {titleArt ? (
        <Text>{gradient.multiline(titleArt)}</Text>
      ) : (
        <Text bold color="cyan">
          CHRONICLE
        </Text>
      )}

      <Box marginTop={1}>
        <Text dimColor>{'— AI \u9a71\u52a8\u7684\u547d\u4ee4\u884c\u4e92\u52a8\u5c0f\u8bf4 —'}</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>{'\u6309\u4efb\u610f\u952e\u5f00\u59cb / Press any key'}</Text>
      </Box>
    </Box>
  );
}
