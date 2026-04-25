import { useState, useCallback, useRef, useEffect } from 'react';

export type UseTimedEffectReturn = {
  readonly active: boolean;
  readonly trigger: () => void;
};

export function useTimedEffect(durationMs: number): UseTimedEffectReturn {
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    setActive(true);
    timerRef.current = setTimeout(() => {
      setActive(false);
      timerRef.current = null;
    }, durationMs);
  }, [durationMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { active, trigger };
}

export type TimedEffectInstance = {
  readonly isActive: () => boolean;
  readonly trigger: () => void;
  readonly cleanup: () => void;
};

export function createTimedEffect(durationMs: number): TimedEffectInstance {
  let active = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const trigger = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    active = true;
    timer = setTimeout(() => {
      active = false;
      timer = null;
    }, durationMs);
  };

  const cleanup = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    active = false;
  };

  const isActive = (): boolean => active;

  return { isActive, trigger, cleanup };
}
