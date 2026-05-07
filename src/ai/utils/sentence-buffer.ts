import { systemClock, type Clock, type TimeoutId } from '../../time/clock';

export type SentenceBufferOptions = {
  readonly onFlush: (text: string) => void;
  readonly timeoutMs?: number;
  readonly clock?: Clock;
};

export type SentenceBuffer = {
  readonly push: (chunk: string) => void;
  readonly flush: () => void;
  readonly dispose: () => void;
};

const SENTENCE_END_PATTERN = /[。！？…\n]/;

const DEFAULT_TIMEOUT_MS = 500;

export function createSentenceBuffer(options: SentenceBufferOptions): SentenceBuffer {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const clock = options.clock ?? systemClock;
  let buffer = '';
  let timerId: TimeoutId | null = null;

  const clearTimer = (): void => {
    if (timerId !== null) {
      clock.clearTimeout(timerId);
      timerId = null;
    }
  };

  const doFlush = (): void => {
    clearTimer();
    if (buffer.length > 0) {
      const text = buffer;
      buffer = '';
      options.onFlush(text);
    }
  };

  const resetTimer = (): void => {
    clearTimer();
    timerId = clock.setTimeout(doFlush, timeoutMs);
  };

  return {
    push(chunk: string): void {
      if (chunk.length === 0) {
        return;
      }
      buffer += chunk;
      if (SENTENCE_END_PATTERN.test(chunk)) {
        doFlush();
      } else {
        resetTimer();
      }
    },
    flush: doFlush,
    dispose(): void {
      clearTimer();
      buffer = '';
    },
  };
}
