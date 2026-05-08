import { useState, useCallback, useEffect, useRef } from 'react';

import { systemClock, type Clock, type TimeoutId } from '../../time/clock';

export type UseTypewriterReturn = {
  readonly displayText: string;
  readonly isComplete: boolean;
  readonly skip: () => void;
};

export function useTypewriter(fullText: string, charIntervalMs: number): UseTypewriterReturn {
  const [charCount, setCharCount] = useState(0);
  const fullTextRef = useRef(fullText);
  const typewriterRef = useRef<TypewriterInstance | null>(null);

  fullTextRef.current = fullText;

  const isComplete = charCount >= fullText.length;
  const displayText = fullText.slice(0, charCount);

  useEffect(() => {
    const typewriter = createTypewriter(fullText, charIntervalMs, systemClock, setCharCount);
    typewriterRef.current = typewriter;
    typewriter.start();

    return () => {
      typewriter.cleanup();
      if (typewriterRef.current === typewriter) {
        typewriterRef.current = null;
      }
    };
  }, [charIntervalMs, fullText]);

  const skip = useCallback(() => {
    const typewriter = typewriterRef.current;
    if (typewriter) {
      typewriter.skip();
      setCharCount(fullTextRef.current.length);
      return;
    }
    setCharCount(fullTextRef.current.length);
  }, []);

  return { displayText, isComplete, skip };
}

export type TypewriterInstance = {
  readonly getDisplayText: () => string;
  readonly getIsComplete: () => boolean;
  readonly skip: () => void;
  readonly start: () => void;
  readonly cleanup: () => void;
};

export function createTypewriter(
  fullText: string,
  charIntervalMs: number,
  clock: Clock = systemClock,
  onCharCountChange?: (charCount: number) => void,
): TypewriterInstance {
  let charCount = 0;
  let timer: TimeoutId | null = null;

  const getDisplayText = (): string => fullText.slice(0, charCount);
  const getIsComplete = (): boolean => charCount >= fullText.length;

  const clearTimer = (): void => {
    if (timer !== null) {
      clock.clearTimeout(timer);
      timer = null;
    }
  };

  const notify = (): void => {
    onCharCountChange?.(charCount);
  };

  const scheduleNext = (): void => {
    clearTimer();
    if (getIsComplete() || fullText.length === 0) {
      return;
    }

    timer = clock.setTimeout(() => {
      timer = null;
      charCount = Math.min(charCount + 1, fullText.length);
      notify();
      scheduleNext();
    }, charIntervalMs);
  };

  const start = (): void => {
    if (timer !== null || getIsComplete() || fullText.length === 0) {
      return;
    }
    scheduleNext();
  };

  const skip = (): void => {
    clearTimer();
    charCount = fullText.length;
    notify();
  };

  const cleanup = (): void => {
    clearTimer();
  };

  return { getDisplayText, getIsComplete, skip, start, cleanup };
}
