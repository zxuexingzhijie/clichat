export type TimeoutId = ReturnType<typeof setTimeout>;

export type Clock = {
  readonly now: () => number;
  readonly setTimeout: (fn: () => void, ms: number) => TimeoutId;
  readonly clearTimeout: (id: TimeoutId) => void;
};

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
};
