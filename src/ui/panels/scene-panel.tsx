import React from 'react';
import { Box, Text } from 'ink';
import { SceneSpinner } from '../components/scene-spinner';
import { ToastBanner } from '../components/toast-banner';
import type { ToastData } from '../hooks/use-toast';
import type { SpinnerContext } from '../components/scene-spinner';

type ScenePanelProps = {
  readonly lines: readonly string[];
  readonly streamingText?: string;
  readonly isStreaming?: boolean;
  readonly showSpinner?: boolean;
  readonly spinnerContext?: SpinnerContext;
  readonly toast?: ToastData | null;
  readonly isDimmed?: boolean;
  readonly isSpinnerDimming?: boolean;
};

export function ScenePanel({
  lines,
  streamingText,
  isStreaming,
  showSpinner,
  spinnerContext,
  toast,
  isDimmed,
  isSpinnerDimming,
}: ScenePanelProps): React.ReactNode {
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {toast && <ToastBanner toast={toast} />}
      {showSpinner && !streamingText ? (
        <Text dimColor={isSpinnerDimming}>
          <SceneSpinner context={spinnerContext ?? 'narration'} />
        </Text>
      ) : lines.length === 0 && !streamingText ? (
        <Text dimColor>周围一片寂静，什么也没有发生。</Text>
      ) : (
        <>
          {lines.map((line, i) => (
            <Text key={i} dimColor={isDimmed}>{line}</Text>
          ))}
          {isStreaming && (
            <Text dimColor={isDimmed}>
              {streamingText}
              <Text dimColor>...</Text>
            </Text>
          )}
        </>
      )}
    </Box>
  );
}
