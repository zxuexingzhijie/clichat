import { describe, it, expect } from 'bun:test';
import { eventBus } from '../../events/event-bus';
import { useEventFlash, createEventFlash } from './use-event-flash';
import { createManualClock } from '../../time/manual-clock';

describe('useEventFlash', () => {
  it('is a function', () => {
    expect(typeof useEventFlash).toBe('function');
  });

  it('source contains eventBus subscription pattern', () => {
    const source = useEventFlash.toString();
    expect(source).toContain('useTimedEffect');
  });
});

describe('useEventFlash integration', () => {
  it('returns false initially via createEventFlash', () => {
    const clock = createManualClock();
    const flash = createEventFlash('player_damaged', 100, eventBus, clock);
    expect(flash.isActive()).toBe(false);
    flash.cleanup();
  });

  it('returns true after subscribed event fires, then false after ManualClock duration', () => {
    const clock = createManualClock();
    const flash = createEventFlash('player_damaged', 50, eventBus, clock);

    eventBus.emit('player_damaged', { amount: 5, source: 'test' });
    expect(flash.isActive()).toBe(true);
    expect(clock.pendingCount()).toBe(1);

    clock.advanceBy(49);
    expect(flash.isActive()).toBe(true);

    clock.advanceBy(1);
    expect(flash.isActive()).toBe(false);
    expect(clock.pendingCount()).toBe(0);

    flash.cleanup();
  });

  it('cleanup removes event listener and clears pending timer', () => {
    const clock = createManualClock();
    const flash = createEventFlash('player_healed', 100, eventBus, clock);

    eventBus.emit('player_healed', { amount: 10, source: 'test' });
    expect(flash.isActive()).toBe(true);
    expect(clock.pendingCount()).toBe(1);

    flash.cleanup();
    expect(flash.isActive()).toBe(false);
    expect(clock.pendingCount()).toBe(0);

    eventBus.emit('player_healed', { amount: 10, source: 'test' });
    expect(flash.isActive()).toBe(false);
    expect(clock.pendingCount()).toBe(0);
  });
});
