import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useScreenSize } from 'fullscreen-ink';
import { SceneSpinner } from '../components/scene-spinner';
import { ToastBanner } from '../components/toast-banner';
import type { ToastData } from '../hooks/use-toast';
import type { SpinnerContext } from '../components/scene-spinner';

// lines reserved for: toast(1) + streaming(2) + scroll hint(1) + padding
const RESERVED_ROWS = 5;

export type ParsedSceneLine =
  | { readonly type: 'dialogue'; readonly speaker: string; readonly text: string }
  | { readonly type: 'system'; readonly text: string }
  | { readonly type: 'narration'; readonly text: string };

export function parseSceneLine(line: string): ParsedSceneLine {
  const dialogueMatch = line.match(/^([^：:]{1,24})[：:]\s*["“](.+)["”]$/);
  if (dialogueMatch) {
    return {
      type: 'dialogue',
      speaker: dialogueMatch[1]!.trim(),
      text: dialogueMatch[2]!.trim(),
    };
  }

  if (/^\[[^\]]+\]/.test(line) || /^【[^】]+】/.test(line)) {
    return { type: 'system', text: line };
  }

  return { type: 'narration', text: line };
}

type ScenePanelProps = {
  readonly lines: readonly string[];
  readonly streamingText?: string;
  readonly isStreaming?: boolean;
  readonly showSpinner?: boolean;
  readonly spinnerContext?: SpinnerContext;
  readonly toast?: ToastData | null;
  readonly isDimmed?: boolean;
  readonly isSpinnerDimming?: boolean;
  readonly isInputActive?: boolean;
};

function SceneLine({ line, dimmed }: { readonly line: string; readonly dimmed?: boolean }): React.ReactNode {
  const parsed = parseSceneLine(line);

  if (parsed.type === 'dialogue') {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1} marginY={0}>
        <Text bold color="cyan" dimColor={dimmed}>{parsed.speaker}</Text>
        <Text dimColor={dimmed}>“{parsed.text}”</Text>
      </Box>
    );
  }

  if (parsed.type === 'system') {
    return <Text color="yellow" dimColor={dimmed}>{parsed.text}</Text>;
  }

  return <Text dimColor={dimmed}>{parsed.text}</Text>;
}

export function ScenePanel({
  lines,
  streamingText,
  isStreaming,
  showSpinner,
  spinnerContext,
  toast,
  isDimmed,
  isSpinnerDimming,
  isInputActive = true,
}: ScenePanelProps): React.ReactNode {
  const { height } = useScreenSize();
  const maxVisible = Math.max(3, height - RESERVED_ROWS);

  // scrollOffset: 0 = bottom (newest), positive = scrolled up
  const [scrollOffset, setScrollOffset] = useState(0);
  const prevLinesLen = useRef(lines.length);

  // auto-scroll to bottom when new lines arrive, preserving position if user scrolled up
  useEffect(() => {
    if (lines.length !== prevLinesLen.current) {
      const diff = lines.length - prevLinesLen.current;
      prevLinesLen.current = lines.length;
      setScrollOffset(prev => prev === 0 ? 0 : prev + diff);
    }
  }, [lines.length]);

  const totalLines = lines.length;
  const maxOffset = Math.max(0, totalLines - maxVisible);

  const handleInput = useCallback(
    (_input: string, key: { pageUp?: boolean; pageDown?: boolean }) => {
      if (key.pageUp) {
        setScrollOffset(prev => Math.min(prev + Math.floor(maxVisible / 2), maxOffset));
      } else if (key.pageDown) {
        setScrollOffset(prev => Math.max(prev - Math.floor(maxVisible / 2), 0));
      }
    },
    [maxVisible, maxOffset],
  );

  useInput(handleInput, { isActive: isInputActive && totalLines > maxVisible });

  const visibleLines = scrollOffset === 0
    ? lines.slice(-maxVisible)
    : lines.slice(Math.max(0, totalLines - maxVisible - scrollOffset), totalLines - scrollOffset);

  const canScrollUp = scrollOffset < maxOffset;
  const canScrollDown = scrollOffset > 0;

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {toast && <ToastBanner toast={toast} />}
      {canScrollUp && (
        <Text dimColor>PgUp 查看历史  ({totalLines - maxVisible - scrollOffset + 1}–{totalLines - scrollOffset} / {totalLines})</Text>
      )}
      {showSpinner && !streamingText ? (
        <SceneSpinner context={spinnerContext ?? 'narration'} isDimming={isSpinnerDimming} />
      ) : lines.length === 0 && !streamingText ? (
        <Text dimColor>周围一片寂静，什么也没有发生。</Text>
      ) : (
        <>
          {visibleLines.map((line, i) => (
            <SceneLine key={i} line={line} dimmed={isDimmed} />
          ))}
          {isStreaming && (
            <Text dimColor={isDimmed}>
              {streamingText}
              <Text dimColor>...</Text>
            </Text>
          )}
        </>
      )}
      {canScrollDown && (
        <Text dimColor>↓ PgDn 向下滚动</Text>
      )}
    </Box>
  );
}
