import { useState, useCallback, useEffect, useRef } from 'react';

export type UseTypewriterReturn = {
  readonly displayText: string;
  readonly isComplete: boolean;
  readonly skip: () => void;
};

export function useTypewriter(fullText: string, charIntervalMs: number): UseTypewriterReturn {
  const [charCount, setCharCount] = useState(0);
  const fullTextRef = useRef(fullText);

  fullTextRef.current = fullText;

  const isComplete = charCount >= fullText.length;
  const displayText = fullText.slice(0, charCount);

  useEffect(() => {
    if (isComplete || fullText.length === 0) return;

    const interval = setInterval(() => {
      setCharCount(prev => {
        const next = prev + 1;
        if (next >= fullTextRef.current.length) {
          clearInterval(interval);
        }
        return next;
      });
    }, charIntervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [charIntervalMs, fullText, isComplete]);

  const skip = useCallback(() => {
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

export function createTypewriter(fullText: string, charIntervalMs: number): TypewriterInstance {
  let charCount = 0;
  let interval: ReturnType<typeof setInterval> | null = null;

  const getDisplayText = (): string => fullText.slice(0, charCount);
  const getIsComplete = (): boolean => charCount >= fullText.length;

  const start = (): void => {
    if (interval !== null) return;
    interval = setInterval(() => {
      charCount += 1;
      if (charCount >= fullText.length) {
        if (interval !== null) {
          clearInterval(interval);
          interval = null;
        }
      }
    }, charIntervalMs);
  };

  const skip = (): void => {
    if (interval !== null) {
      clearInterval(interval);
      interval = null;
    }
    charCount = fullText.length;
  };

  const cleanup = (): void => {
    if (interval !== null) {
      clearInterval(interval);
      interval = null;
    }
  };

  return { getDisplayText, getIsComplete, skip, start, cleanup };
}
