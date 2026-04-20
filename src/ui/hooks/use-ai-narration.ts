import { useState, useCallback, useRef } from 'react';
import type { NarrativeContext } from '../../ai/roles/narrative-director';
import { streamNarration } from '../../ai/roles/narrative-director';

export type UseAiNarrationReturn = {
  readonly narrationText: string;
  readonly isStreaming: boolean;
  readonly error: Error | null;
  readonly startNarration: (context: NarrativeContext) => void;
  readonly reset: () => void;
};

export function useAiNarration(): UseAiNarrationReturn {
  const [narrationText, setNarrationText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cancelledRef = useRef(false);

  const startNarration = useCallback((context: NarrativeContext) => {
    cancelledRef.current = false;
    setIsStreaming(true);
    setError(null);
    setNarrationText('');

    (async () => {
      try {
        const stream = streamNarration(context);
        for await (const chunk of stream) {
          if (cancelledRef.current) break;
          setNarrationText(prev => prev + chunk);
        }
      } catch (err) {
        if (!cancelledRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelledRef.current) {
          setIsStreaming(false);
        }
      }
    })();
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    setNarrationText('');
    setIsStreaming(false);
    setError(null);
  }, []);

  return {
    narrationText,
    isStreaming,
    error,
    startNarration,
    reset,
  };
}
