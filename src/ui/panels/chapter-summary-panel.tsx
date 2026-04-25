import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

type ChapterSummaryPanelProps = {
  readonly summaries: readonly string[];
  readonly onClose: () => void;
};

export function ChapterSummaryPanel({ summaries, onClose }: ChapterSummaryPanelProps): React.ReactNode {
  useInput(useCallback((_input: string, key: { escape: boolean }) => {
    if (key.escape) { onClose(); return; }
  }, [onClose]));

  if (summaries.length === 0) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <Box justifyContent="space-between">
          <Text bold color="cyan">{'【章节总结】'}</Text>
          <Text dimColor>Esc 返回</Text>
        </Box>
        <Box marginTop={1} justifyContent="center">
          <Text dimColor>{'暂无章节总结。继续冒险以生成总结。'}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="cyan">{'【章节总结】'}</Text>
        <Text dimColor>Esc 返回</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {summaries.map((summary, i) => (
          <Box key={i} flexDirection="column" marginBottom={1}>
            <Text bold dimColor>{'━━━ 第'}{i + 1}{'章 ━━━'}</Text>
            <Text>{summary}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export type { ChapterSummaryPanelProps };
