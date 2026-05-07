import { useState, useCallback, useRef, useEffect } from 'react';

import { systemClock, type Clock, type TimeoutId } from '../../time/clock';

export type ToastData = {
  readonly message: string;
  readonly color: string;
  readonly icon: string;
};

export type UseToastReturn = {
  readonly toast: ToastData | null;
  readonly showToast: (data: ToastData) => void;
};

export function useToast(dismissMs: number = 2000, clock: Clock = systemClock): UseToastReturn {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timerRef = useRef<TimeoutId | null>(null);

  const showToast = useCallback((data: ToastData) => {
    if (timerRef.current !== null) {
      clock.clearTimeout(timerRef.current);
    }
    setToast(data);
    timerRef.current = clock.setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, dismissMs);
  }, [clock, dismissMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clock.clearTimeout(timerRef.current);
      }
    };
  }, [clock]);

  return { toast, showToast };
}

export type ToastManagerInstance = {
  readonly getToast: () => ToastData | null;
  readonly showToast: (data: ToastData) => void;
  readonly cleanup: () => void;
};

export function createToastManager(dismissMs: number = 2000, clock: Clock = systemClock): ToastManagerInstance {
  let toast: ToastData | null = null;
  let timer: TimeoutId | null = null;

  const getToast = (): ToastData | null => toast;

  const showToast = (data: ToastData): void => {
    if (timer !== null) {
      clock.clearTimeout(timer);
    }
    toast = data;
    timer = clock.setTimeout(() => {
      toast = null;
      timer = null;
    }, dismissMs);
  };

  const cleanup = (): void => {
    if (timer !== null) {
      clock.clearTimeout(timer);
      timer = null;
    }
    toast = null;
  };

  return { getToast, showToast, cleanup };
}
