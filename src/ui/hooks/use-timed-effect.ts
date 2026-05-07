import { useState, useCallback, useRef, useEffect } from 'react';

import { systemClock, type Clock, type TimeoutId } from '../../time/clock';

export type UseTimedEffectReturn = {
  readonly active: boolean;
  readonly trigger: () => void;
};

export function useTimedEffect(durationMs: number, clock: Clock = systemClock): UseTimedEffectReturn {
  const [active, setActive] = useState(false);
  const timerRef = useRef<TimeoutId | null>(null);

  const trigger = useCallback(() => {
    if (timerRef.current !== null) {
      clock.clearTimeout(timerRef.current);
    }
    setActive(true);
    timerRef.current = clock.setTimeout(() => {
      setActive(false);
      timerRef.current = null;
    }, durationMs);
  }, [clock, durationMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clock.clearTimeout(timerRef.current);
      }
    };
  }, [clock]);

  return { active, trigger };
}

export type TimedEffectInstance = {
  readonly isActive: () => boolean;
  readonly trigger: () => void;
  readonly cleanup: () => void;
};

export function createTimedEffect(durationMs: number, clock: Clock = systemClock): TimedEffectInstance {
  let active = false;
  let timer: TimeoutId | null = null;

  const trigger = (): void => {
    if (timer !== null) {
      clock.clearTimeout(timer);
    }
    active = true;
    timer = clock.setTimeout(() => {
      active = false;
      timer = null;
    }, durationMs);
  };

  const cleanup = (): void => {
    if (timer !== null) {
      clock.clearTimeout(timer);
      timer = null;
    }
    active = false;
  };

  const isActive = (): boolean => active;

  return { isActive, trigger, cleanup };
}
