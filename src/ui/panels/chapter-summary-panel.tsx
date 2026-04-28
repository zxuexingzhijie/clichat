import React, { useCallback, useState } from 'react';
import { Box, Text, useInput } from 'ink';

const PAGE_SIZE = 3;

type ChapterSummaryPanelProps = {
  readonly summaries: readonly string[];
  readonly onClose: () => void;
};

export function ChapterSummaryPanel({ summaries, onClose }: ChapterSummaryPanelProps): React.ReactNode {
  const [scrollOffset, setScrollOffset] = useState(0);
  const visibleSummaries = summaries.slice(scrollOffset, scrollOffset + PAGE_SIZE);
  const canScrollUp = scrollOffset > 0;
  const canScrollDown = scrollOffset + PAGE_SIZE < summaries.length;

  useInput(useCallback((_input: string, key: { escape: boolean; pageUp?: boolean; pageDown?: boolean }) => {
    if (key.escape) { onClose(); return; }
    if (key.pageUp) setScrollOffset(prev => Math.max(0, prev - PAGE_SIZE));
    if (key.pageDown) setScrollOffset(prev => canScrollDown ? prev + PAGE_SIZE : prev);
  }, [onClose, canScrollDown]));

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
      {canScrollUp && <Text dimColor>PgUp 查看更早章节</Text>}
      <Box marginTop={1} flexDirection="column">
        {visibleSummaries.map((summary, i) => (
          <Box key={scrollOffset + i} flexDirection="column" marginBottom={1}>
            <Text bold dimColor>{'━━━ 第'}{scrollOffset + i + 1}{'章 ━━━'}</Text>
            <Text>{summary}</Text>
          </Box>
        ))}
      </Box>
      {canScrollDown && <Text dimColor>PgDn 查看更多章节</Text>}
    </Box>
  );
}

export type { ChapterSummaryPanelProps };
