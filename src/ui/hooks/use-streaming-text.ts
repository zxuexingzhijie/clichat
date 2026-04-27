import { useState, useCallback, useRef } from 'react';
import { createSentenceBuffer } from '../../ai/utils/sentence-buffer';
import type { SentenceBuffer } from '../../ai/utils/sentence-buffer';

export type StreamingTextOptions = {
  readonly stream: AsyncGenerator<string>;
  readonly onChunk: (chunk: string) => void;
  readonly onDone: (fullText: string) => void;
  readonly onError?: (error: Error) => void;
};

export type StreamingTextController = {
  readonly promise: Promise<void>;
  readonly cancel: () => void;
  readonly skip: () => void;
  readonly getFullText: () => string;
};

export function createStreamingText(opts: StreamingTextOptions): StreamingTextController {
  const { stream, onChunk, onDone, onError } = opts;
  let cancelled = false;
  let skipped = false;
  let fullText = '';

  const promise = (async () => {
    try {
      for await (const chunk of stream) {
        if (cancelled) break;
        fullText += chunk;
        if (!skipped) {
          onChunk(chunk);
        }
      }
      if (!cancelled) {
        onDone(fullText);
      }
    } catch (err) {
      if (!cancelled) {
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    }
  })();

  return {
    promise,
    cancel: () => { cancelled = true; },
    skip: () => {
      if (!skipped) {
        skipped = true;
      }
    },
    getFullText: () => fullText,
  };
}

export type UseStreamingTextReturn = {
  readonly streamingText: string;
  readonly isStreaming: boolean;
  readonly error: Error | null;
  readonly fullTextRef: React.RefObject<string>;
  readonly start: (stream: AsyncGenerator<string>) => void;
  readonly skipToEnd: () => void;
  readonly reset: () => void;
};

export function useStreamingText(): UseStreamingTextReturn {
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cancelledRef = useRef(false);
  const skippedRef = useRef(false);
  const fullTextRef = useRef('');
  const bufferRef = useRef<SentenceBuffer | null>(null);

  const start = useCallback((stream: AsyncGenerator<string>) => {
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

    (async () => {
      try {
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
    fullTextRef,
    start,
    skipToEnd,
    reset,
  };
}
