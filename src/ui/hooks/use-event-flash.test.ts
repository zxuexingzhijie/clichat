import { describe, it, expect } from 'bun:test';
import mitt from 'mitt';
import { useEventFlash, createEventFlash } from './use-event-flash';
import type { DomainEvents } from '../../events/event-types';

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
    const bus = mitt<DomainEvents>();
    const flash = createEventFlash('player_damaged', 100, bus);
    expect(flash.isActive()).toBe(false);
    flash.cleanup();
  });

  it('returns true after subscribed event fires, then false after duration', async () => {
    const bus = mitt<DomainEvents>();
    const flash = createEventFlash('player_damaged', 50, bus);
    bus.emit('player_damaged', { amount: 5, source: 'test' });
    expect(flash.isActive()).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(flash.isActive()).toBe(false);
    flash.cleanup();
  });

  it('cleanup removes event listener', () => {
    const bus = mitt<DomainEvents>();
    const flash = createEventFlash('player_healed', 100, bus);
    flash.cleanup();
    bus.emit('player_healed', { amount: 10, source: 'test' });
    expect(flash.isActive()).toBe(false);
  });
});
