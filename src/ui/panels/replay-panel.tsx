import React, { useCallback, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useScreenSize } from 'fullscreen-ink';
import type { TurnLogEntry } from '../../state/serializer';

type ReplayPanelProps = {
  readonly entries: readonly TurnLogEntry[];
  readonly onClose: () => void;
};

const PAGE_SIZE = 5;
const VISIBLE_COUNT_WIDE = 8;
const VISIBLE_COUNT_NARROW = 4;

function formatTurnLabel(entry: TurnLogEntry): string {
  return `[T${entry.turnNumber}] ${entry.action.slice(0, 45)}`;
}

function TurnDetail({
  entry,
  expanded,
}: {
  readonly entry: TurnLogEntry;
  readonly expanded: boolean;
}): React.ReactNode {
  return (
    <Box flexDirection="column">
      <Text dimColor>{'▶ 玩家输入: '}{entry.action}</Text>
      <Box marginTop={1} flexDirection="column">
        <Text bold>{'📖 叙事:'}</Text>
        {entry.narrationLines.map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>
      {entry.checkResult !== null && (
        <Box marginTop={1}>
          <Text color="yellow">{'⚙ 裁决: '}{entry.checkResult}</Text>
        </Box>
      )}
      {entry.npcDialogue !== undefined && entry.npcDialogue.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text bold>{'💬 NPC:'}</Text>
          {entry.npcDialogue.map((line, i) => (
            <Text key={i} color="green">{line}</Text>
          ))}
        </Box>
      )}
      <Box marginTop={1}>
        {expanded ? (
          <Box flexDirection="column">
            <Text dimColor>{'回合: '}{entry.turnNumber}</Text>
            <Text dimColor>{'时间: '}{entry.timestamp}</Text>
          </Box>
        ) : (
          <Text dimColor>{'[Enter 展开细节]'}</Text>
        )}
      </Box>
    </Box>
  );
}

export function ReplayPanel({ entries, onClose }: ReplayPanelProps): React.ReactNode {
  const { width } = useScreenSize();
  const isWide = width >= 100;

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [detailExpanded, setDetailExpanded] = useState(false);

  useInput(useCallback((input: string, key: {
    upArrow: boolean;
    downArrow: boolean;
    escape: boolean;
    return: boolean;
    pageUp?: boolean;
    pageDown?: boolean;
  }) => {
    if (key.escape) { onClose(); return; }
    if (key.upArrow || input === 'p') {
      setSelectedIndex(i => Math.max(0, i - 1));
    }
    if (key.downArrow || input === 'n') {
      setSelectedIndex(i => Math.min(entries.length - 1, i + 1));
    }
    if (key.pageUp) {
      setSelectedIndex(i => Math.max(0, i - PAGE_SIZE));
    }
    if (key.pageDown) {
      setSelectedIndex(i => Math.min(entries.length - 1, i + PAGE_SIZE));
    }
    if (key.return || input === ' ') {
      setDetailExpanded(v => !v);
    }
  }, [onClose, entries.length]));

  if (entries.length === 0) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <Box justifyContent="space-between">
          <Text bold color="cyan">{'【回放】'}</Text>
          <Text dimColor>Esc 返回</Text>
        </Box>
        <Box marginTop={1} justifyContent="center">
          <Text dimColor>{'暂无回放记录'}</Text>
        </Box>
      </Box>
    );
  }

  const visibleCount = isWide ? VISIBLE_COUNT_WIDE : VISIBLE_COUNT_NARROW;
  const visibleStart = Math.max(
    0,
    Math.min(
      selectedIndex - Math.floor(visibleCount / 2),
      entries.length - visibleCount,
    ),
  );
  const visibleEntries = entries.slice(visibleStart, visibleStart + visibleCount);

  const selectedEntry = entries[selectedIndex] ?? null;

  const turnListContent = (
    <Box flexDirection="column">
      {visibleEntries.map((entry, i) => {
        const absoluteIndex = visibleStart + i;
        const isSelected = absoluteIndex === selectedIndex;
        return (
          <Box key={entry.turnNumber}>
            <Text bold={isSelected} color={isSelected ? 'cyan' : undefined}>
              {isSelected ? '❯ ' : '  '}{formatTurnLabel(entry)}
            </Text>
          </Box>
        );
      })}
    </Box>
  );

  const detailContent = selectedEntry
    ? <TurnDetail entry={selectedEntry} expanded={detailExpanded} />
    : null;

  const hintBar = (
    <Text dimColor>
      {'↑↓/p/n 选择  PgUp/PgDn 翻页  Enter/空格 展开细节  Esc 返回'}
    </Text>
  );

  if (isWide) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <Box justifyContent="space-between">
          <Text bold color="cyan">{'【回放】'}</Text>
          <Text dimColor>Esc 返回</Text>
        </Box>
        <Box flexGrow={1} marginTop={1}>
          <Box flexDirection="column" width="40%">
            {turnListContent}
          </Box>
          <Text>{'│'}</Text>
          <Box flexDirection="column" width="60%" paddingLeft={1}>
            {detailContent}
          </Box>
        </Box>
        {hintBar}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="cyan">{'【回放】'}</Text>
        <Text dimColor>Esc 返回</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {turnListContent}
      </Box>
      {detailContent && (
        <Box marginTop={1} flexDirection="column">
          <Text>{'─'.repeat(20)}</Text>
          {detailContent}
        </Box>
      )}
      <Box marginTop={1}>{hintBar}</Box>
    </Box>
  );
}

export type { ReplayPanelProps };
