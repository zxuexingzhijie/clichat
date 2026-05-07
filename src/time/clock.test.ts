import { describe, expect, it } from 'bun:test';
import { systemClock } from './clock';
import { ManualClock } from './manual-clock';

describe('systemClock', () => {
  it('returns current time and can create and clear runtime timers', () => {
    const now = systemClock.now();
    expect(typeof now).toBe('number');

    let fired = false;
    const id = systemClock.setTimeout(() => {
      fired = true;
    }, 10_000);
    systemClock.clearTimeout(id);

    expect(fired).toBe(false);
  });
});

describe('ManualClock', () => {
  it('does not fire a timeout until advanced to its due time', () => {
    const clock = new ManualClock();
    let fired = false;

    clock.setTimeout(() => {
      fired = true;
    }, 100);

    clock.advanceBy(99);
    expect(fired).toBe(false);

    clock.advanceBy(1);
    expect(fired).toBe(true);
  });

  it('clearTimeout prevents a timeout from firing', () => {
    const clock = new ManualClock();
    let fired = false;

    const id = clock.setTimeout(() => {
      fired = true;
    }, 100);
    clock.clearTimeout(id);
    clock.advanceBy(100);

    expect(fired).toBe(false);
    expect(clock.pendingCount()).toBe(0);
  });

  it('fires timers in chronological order and preserves callback-scheduled timers for eligible advances', () => {
    const clock = new ManualClock();
    const events: string[] = [];

    clock.setTimeout(() => events.push('second'), 20);
    clock.setTimeout(() => {
      events.push('first');
      clock.setTimeout(() => events.push('nested'), 5);
    }, 10);
    clock.setTimeout(() => events.push('third'), 30);

    clock.advanceBy(10);
    expect(events).toEqual(['first']);
    expect(clock.pendingCount()).toBe(3);

    clock.advanceBy(5);
    expect(events).toEqual(['first', 'nested']);

    clock.advanceTo(30);
    expect(events).toEqual(['first', 'nested', 'second', 'third']);
    expect(clock.pendingCount()).toBe(0);
  });
});
