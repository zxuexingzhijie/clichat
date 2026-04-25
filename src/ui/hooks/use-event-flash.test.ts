import { describe, it, expect } from 'bun:test';
import { useEventFlash } from './use-event-flash';

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
    const { createEventFlash } = require('./use-event-flash');
    const flash = createEventFlash('player_damaged', 100);
    expect(flash.isActive()).toBe(false);
    flash.cleanup();
  });

  it('returns true after subscribed event fires, then false after duration', async () => {
    const { createEventFlash } = require('./use-event-flash');
    const { eventBus } = require('../../events/event-bus');
    const flash = createEventFlash('player_damaged', 50);
    eventBus.emit('player_damaged', { amount: 5, source: 'test' });
    expect(flash.isActive()).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(flash.isActive()).toBe(false);
    flash.cleanup();
  });

  it('cleanup removes event listener', () => {
    const { createEventFlash } = require('./use-event-flash');
    const { eventBus } = require('../../events/event-bus');
    const flash = createEventFlash('player_healed', 100);
    flash.cleanup();
    eventBus.emit('player_healed', { amount: 10, source: 'test' });
    expect(flash.isActive()).toBe(false);
  });
});
