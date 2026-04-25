import { useState, useCallback, useRef, useEffect } from 'react';

export type ToastData = {
  readonly message: string;
  readonly color: string;
  readonly icon: string;
};

export type UseToastReturn = {
  readonly toast: ToastData | null;
  readonly showToast: (data: ToastData) => void;
};

export function useToast(dismissMs: number = 2000): UseToastReturn {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((data: ToastData) => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    setToast(data);
    timerRef.current = setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, dismissMs);
  }, [dismissMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { toast, showToast };
}

export type ToastManagerInstance = {
  readonly getToast: () => ToastData | null;
  readonly showToast: (data: ToastData) => void;
  readonly cleanup: () => void;
};

export function createToastManager(dismissMs: number = 2000): ToastManagerInstance {
  let toast: ToastData | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const getToast = (): ToastData | null => toast;

  const showToast = (data: ToastData): void => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    toast = data;
    timer = setTimeout(() => {
      toast = null;
      timer = null;
    }, dismissMs);
  };

  const cleanup = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    toast = null;
  };

  return { getToast, showToast, cleanup };
}
