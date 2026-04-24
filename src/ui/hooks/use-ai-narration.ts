import { useState, useCallback, useRef } from 'react';
import type { NarrativeContext } from '../../ai/roles/narrative-director';
import { streamNarration } from '../../ai/roles/narrative-director';
import { createSentenceBuffer } from '../../ai/utils/sentence-buffer';
import type { SentenceBuffer } from '../../ai/utils/sentence-buffer';
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
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cancelledRef = useRef(false);
  const skippedRef = useRef(false);
  const fullTextRef = useRef('');
  const bufferRef = useRef<SentenceBuffer | null>(null);

  const startNarration = useCallback((context: NarrativeContext) => {
    cancelledRef.current = false;
    skippedRef.current = false;
    fullTextRef.current = '';
    setStreamingText('');
    setIsStreaming(true);
    setError(null);

    bufferRef.current = createSentenceBuffer({
      onFlush: (text: string) => {
        setStreamingText(prev => prev + text);
      },
    });

    eventBus.emit('narration_streaming_started', { sceneType: context.sceneType });

    (async () => {
      try {
        const stream = streamNarration(context);
        for await (const chunk of stream) {
          if (cancelledRef.current) break;
          fullTextRef.current += chunk;
          if (!skippedRef.current) {
            bufferRef.current?.push(chunk);
          }
        }
      } catch (err) {
        if (!cancelledRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsStreaming(false);
          return;
        }
      } finally {
        if (!cancelledRef.current) {
          bufferRef.current?.flush();
          bufferRef.current?.dispose();
          setStreamingText(fullTextRef.current);
          setIsStreaming(false);
          eventBus.emit('narration_streaming_completed', { charCount: fullTextRef.current.length });
        }
      }
    })();
  }, []);

  const skipToEnd = useCallback(() => {
    if (!skippedRef.current && isStreaming) {
      skippedRef.current = true;
      bufferRef.current?.flush();
      bufferRef.current?.dispose();
      setStreamingText(fullTextRef.current);
    }
  }, [isStreaming]);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    bufferRef.current?.dispose();
    setStreamingText('');
    setIsStreaming(false);
    setError(null);
  }, []);

  return {
    streamingText,
    isStreaming,
    error,
    startNarration,
    skipToEnd,
    reset,
  };
}
