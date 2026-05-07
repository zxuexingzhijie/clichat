import type { Clock, TimeoutId } from './clock';

type ManualTimer = {
  readonly id: TimeoutId;
  readonly dueAt: number;
  readonly order: number;
  readonly fn: () => void;
};

export class ManualClock implements Clock {
  #now: number;
  #nextId = 1;
  #nextOrder = 1;
  #timers: ManualTimer[] = [];

  constructor(startMs: number = 0) {
    this.#now = startMs;
  }

  now(): number {
    return this.#now;
  }

  setTimeout(fn: () => void, ms: number): TimeoutId {
    const delay = Math.max(0, ms);
    const id = this.#nextId as unknown as TimeoutId;
    this.#nextId += 1;
    this.#timers.push({ id, dueAt: this.#now + delay, order: this.#nextOrder, fn });
    this.#nextOrder += 1;
    return id;
  }

  clearTimeout(id: TimeoutId): void {
    this.#timers = this.#timers.filter((timer) => timer.id !== id);
  }

  advanceBy(ms: number): void {
    this.advanceTo(this.#now + Math.max(0, ms));
  }

  advanceTo(ms: number): void {
    const target = Math.max(this.#now, ms);

    while (true) {
      const next = this.#nextDueTimer(target);
      if (!next) {
        break;
      }

      this.#timers = this.#timers.filter((timer) => timer.id !== next.id);
      this.#now = next.dueAt;
      next.fn();
    }

    this.#now = target;
  }

  pendingCount(): number {
    return this.#timers.length;
  }

  #nextDueTimer(target: number): ManualTimer | null {
    const dueTimers = this.#timers.filter((timer) => timer.dueAt <= target);
    if (dueTimers.length === 0) {
      return null;
    }

    return dueTimers.sort((a, b) => a.dueAt - b.dueAt || a.order - b.order)[0] ?? null;
  }
}

export function createManualClock(startMs: number = 0): ManualClock {
  return new ManualClock(startMs);
}
