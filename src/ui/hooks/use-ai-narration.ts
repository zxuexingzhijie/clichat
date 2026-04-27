import { useCallback } from 'react';
import type { NarrativeContext } from '../../ai/roles/narrative-director';
import { streamNarration } from '../../ai/roles/narrative-director';
import { useStreamingText } from './use-streaming-text';
import { eventBus } from '../../events/event-bus';

export type UseAiNarrationReturn = {
  readonly streamingText: string;
  readonly isStreaming: boolean;
  readonly error: Error | null;
  readonly startNarration: (context: NarrativeContext) => void;
  readonly skipToEnd: () => void;
  readonly reset: () => void;
};

export function useAiNarration(): UseAiNarrationReturn {
  const streaming = useStreamingText();

  const startNarration = useCallback((context: NarrativeContext) => {
    eventBus.emit('narration_streaming_started', { sceneType: context.sceneType });
    streaming.start(streamNarration(context));
  }, [streaming.start]);

  return {
    streamingText: streaming.streamingText,
    isStreaming: streaming.isStreaming,
    error: streaming.error,
    startNarration,
    skipToEnd: streaming.skipToEnd,
    reset: streaming.reset,
  };
}
