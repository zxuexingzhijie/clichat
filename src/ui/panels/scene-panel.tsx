import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';
import { useScreenSize } from 'fullscreen-ink';
import { getAttitudeLabel } from '../../engine/reputation-system';
import { SceneSpinner } from '../components/scene-spinner';
import { ToastBanner } from '../components/toast-banner';
import { CheckResultLine } from './check-result-line';
import type { CombatState } from '../../state/combat-store';
import type { DialogueState } from '../../state/dialogue-store';
import type { ToastData } from '../hooks/use-toast';
import type { SpinnerContext } from '../components/scene-spinner';

// lines reserved for: toast(1) + streaming(2) + scroll hint(1) + padding
const RESERVED_ROWS = 5;
const RECENT_HISTORY_COUNT = 4;

export type ParsedSceneLine =
  | { readonly type: 'dialogue'; readonly speaker: string; readonly text: string }
  | { readonly type: 'system'; readonly text: string }
  | { readonly type: 'narration'; readonly text: string };

export type NarrativeMode = 'exploration' | 'dialogue' | 'combat';

export type DialogueHistoryEntry = DialogueState['dialogueHistory'][number];

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

export function getDialogueHistoryView(
  dialogueHistory: DialogueState['dialogueHistory'],
  showFullHistory: boolean,
): {
  readonly visibleHistory: DialogueState['dialogueHistory'];
  readonly hiddenEarlierCount: number;
  readonly hasMoreHistory: boolean;
} {
  const nonGreetHistory = dialogueHistory.filter((entry) => !(entry.role === 'user' && entry.content === 'greet'));

  if (showFullHistory) {
    return {
      visibleHistory: nonGreetHistory,
      hiddenEarlierCount: 0,
      hasMoreHistory: false,
    };
  }

  const hiddenEarlierCount = Math.max(0, nonGreetHistory.length - RECENT_HISTORY_COUNT);
  return {
    visibleHistory: nonGreetHistory.slice(-RECENT_HISTORY_COUNT),
    hiddenEarlierCount,
    hasMoreHistory: hiddenEarlierCount > 0,
  };
}

type NarrativeRendererProps = {
  readonly mode: NarrativeMode;
  readonly lines: readonly string[];
  readonly streamingText?: string;
  readonly isStreaming?: boolean;
  readonly showSpinner?: boolean;
  readonly spinnerContext?: SpinnerContext;
  readonly toast?: ToastData | null;
  readonly isDimmed?: boolean;
  readonly isSpinnerDimming?: boolean;
  readonly isInputActive?: boolean;
  readonly dialogue?: {
    readonly npcName: string | null;
    readonly npcGlyph?: string | null;
    readonly dialogueHistory: DialogueState['dialogueHistory'];
    readonly relationshipValue: number | null;
    readonly emotionHint: string | null;
    readonly responseOptions: DialogueState['availableResponses'];
    readonly selectedIndex: number;
    readonly onSelect: (index: number) => void;
    readonly onExecute: (index: number) => void;
    readonly onEscape: () => void;
    readonly onFreeTextSubmit: (text: string) => void;
    readonly isNpcThinking?: boolean;
  };
  readonly combat?: {
    readonly lastCheckResult: CombatState['lastCheckResult'];
    readonly lastNarration: CombatState['lastNarration'];
  };
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

function DialogueView({
  npcName,
  npcGlyph,
  dialogueHistory,
  relationshipValue,
  emotionHint,
  responseOptions,
  selectedIndex,
  onSelect,
  onExecute,
  onEscape,
  onFreeTextSubmit,
  isNpcThinking = false,
}: NonNullable<NarrativeRendererProps['dialogue']>): React.ReactNode {
  const [isFreeTextMode, setIsFreeTextMode] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const isFreeTextModeRef = useRef(false);

  const setFreeTextMode = useCallback((value: boolean) => {
    isFreeTextModeRef.current = value;
    setIsFreeTextMode(value);
  }, []);

  const handleInput = useCallback(
    (input: string, key: { upArrow?: boolean; downArrow?: boolean; return?: boolean; escape?: boolean; tab?: boolean }) => {
      if (key.escape) {
        if (isFreeTextModeRef.current) {
          setFreeTextMode(false);
          return;
        }
        onEscape();
        return;
      }
      if (input === '\t' || key.tab) {
        setShowFullHistory((value) => !value);
      } else if (key.upArrow) {
        const next = selectedIndex <= 0 ? responseOptions.length - 1 : selectedIndex - 1;
        onSelect(next);
      } else if (key.downArrow) {
        const next = selectedIndex >= responseOptions.length - 1 ? 0 : selectedIndex + 1;
        onSelect(next);
      } else if (key.return) {
        onExecute(selectedIndex);
      } else {
        const num = parseInt(input, 10);
        if (num >= 1 && num <= responseOptions.length) {
          onSelect(num - 1);
          onExecute(num - 1);
        }
      }
    },
    [responseOptions.length, selectedIndex, onSelect, onExecute, onEscape, setFreeTextMode],
  );

  useInput(handleInput, { isActive: !isFreeTextMode });

  const relLabel = getAttitudeLabel(relationshipValue ?? 0);
  const { visibleHistory, hiddenEarlierCount, hasMoreHistory } = getDialogueHistoryView(dialogueHistory, showFullHistory);
  const speakerLabel = `${npcGlyph ?? '○'} ${npcName ?? '未知来客'}`;

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color="cyan">【{speakerLabel}】</Text>
        <Text dimColor>关系: {relLabel}</Text>
      </Box>
      <Text> </Text>
      {hasMoreHistory && (
        <Text dimColor>  ↑ 还有 {hiddenEarlierCount} 条早期对话...（按 Tab 查看全部）</Text>
      )}
      {showFullHistory && (
        <Text dimColor>  已显示全部对话（按 Tab 返回最近）</Text>
      )}
      {visibleHistory.length === 0 && (
        <Text dimColor>......</Text>
      )}
      {visibleHistory.map((entry, i) => (
        <Text key={i} dimColor={entry.role !== 'assistant'}>
          {entry.role === 'assistant' ? `"${entry.content}"` : `你："${entry.content}"`}
        </Text>
      ))}
      {emotionHint && (
        <>
          <Text> </Text>
          <Text dimColor italic>（{emotionHint}）</Text>
        </>
      )}
      <Text> </Text>
      <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
        <Text> </Text>
      </Box>
      <Text> </Text>
      {isNpcThinking && (
        <Text dimColor>（思考中...）</Text>
      )}
      {responseOptions.map((option, i) => {
        const isSelected = i === selectedIndex;
        return (
          <Box key={option.id} flexDirection="row">
            {option.requiresCheck && option.checkAttribute && option.checkDc ? (
              <Text
                bold={isSelected}
                color={isSelected ? 'cyan' : undefined}
                dimColor={!isSelected}
              >
                {isSelected ? '❯ ' : '  '}
                {i + 1}. <Text color="yellow">[{option.checkAttribute}检定 DC {option.checkDc}]</Text> {option.label.replace(/\[.*?\]\s*/, '')}
              </Text>
            ) : (
              <Text
                bold={isSelected}
                color={isSelected ? 'cyan' : undefined}
                dimColor={!isSelected}
              >
                {isSelected ? '❯ ' : '  '}
                {i + 1}. {option.label}
              </Text>
            )}
          </Box>
        );
      })}
      <Text> </Text>
      <TextInput
        placeholder="直接输入你的回应…"
        isDisabled={isNpcThinking}
        onChange={(value) => {
          if (value.length > 0 && !isFreeTextModeRef.current) {
            setFreeTextMode(true);
          } else if (value.length === 0 && isFreeTextModeRef.current) {
            setFreeTextMode(false);
          }
        }}
        onSubmit={(text) => {
          if (text.trim()) {
            setFreeTextMode(false);
            onFreeTextSubmit(text.trim());
          }
        }}
      />
      <Text dimColor>↑↓ 选择    Enter 确认    Tab {showFullHistory ? '最近' : '全部'}对话    直接输入 与NPC对话    Esc {isFreeTextMode ? '退出输入' : '结束对话'}</Text>
    </Box>
  );
}

export function NarrativeRenderer({
  mode,
  lines,
  streamingText,
  isStreaming,
  showSpinner,
  spinnerContext,
  toast,
  isDimmed,
  isSpinnerDimming,
  isInputActive = true,
  dialogue,
  combat,
}: NarrativeRendererProps): React.ReactNode {
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

  function renderExplorationView(): React.ReactNode {
    return (
      <>
        {toast && <ToastBanner toast={toast} />}
        {canScrollUp && (
          <Text dimColor>PgUp 查看历史  ({totalLines - maxVisible - scrollOffset + 1}–{totalLines - scrollOffset} / {totalLines})</Text>
        )}
        {showSpinner && !streamingText ? (
          <SceneSpinner context={spinnerContext ?? 'narration'} isDimming={isSpinnerDimming} />
        ) : lines.length === 0 && !streamingText ? (
          <>
            <Text dimColor>周围一片寂静。</Text>
            <Text dimColor>还没有新的叙述。输入行动，或按 ? 查看可用快捷键。</Text>
          </>
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
      </>
    );
  }

  if (mode === 'dialogue') {
    if (!dialogue) {
      return (
        <Box flexDirection="column" flexGrow={1} paddingX={1}>
          <Text color="red">界面状态暂时失同步。请按 Esc 返回上一层，或重启游戏继续。</Text>
        </Box>
      );
    }
    return <DialogueView {...dialogue} />;
  }

  if (mode === 'combat') {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {combat?.lastCheckResult && <CheckResultLine checkResult={combat.lastCheckResult} />}
        {combat?.lastNarration ? (
          <Text>{combat.lastNarration}</Text>
        ) : (
          <Text bold color="cyan">⚔ 战斗！</Text>
        )}
        {isStreaming && streamingText && (
          <Text dimColor={isDimmed}>{streamingText}<Text dimColor>...</Text></Text>
        )}
      </Box>
    );
  }

  return renderExplorationView();
}
