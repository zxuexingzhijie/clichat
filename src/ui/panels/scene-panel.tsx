import React from 'react';
import { Box, Text } from 'ink';

type ScenePanelProps = {
  readonly lines: readonly string[];
};

export function ScenePanel({ lines }: ScenePanelProps): React.ReactNode {
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {lines.length === 0 ? (
        <Text dimColor>周围一片寂静，什么也没有发生。</Text>
      ) : (
        lines.map((line, i) => <Text key={i}>{line}</Text>)
      )}
    </Box>
  );
}
