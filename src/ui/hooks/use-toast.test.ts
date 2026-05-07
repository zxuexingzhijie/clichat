import { describe, expect, it } from 'bun:test';
import { createManualClock } from '../../time/manual-clock';
import { createToastManager, useToast } from './use-toast';

describe('useToast', () => {
  it('is a function', () => {
    expect(typeof useToast).toBe('function');
  });

  it('source uses the injected clock clearTimeout path', () => {
    const source = useToast.toString();
    expect(source).toContain('clock.clearTimeout');
  });

  it('defaults to the system clock without requiring caller changes', () => {
    const manager = createToastManager(100);
    expect(manager.getToast()).toBeNull();
    manager.cleanup();
  });
});

describe('useToast logic (extracted)', () => {
  it('toast is null initially', () => {
    const clock = createManualClock();
    const manager = createToastManager(100, clock);
    expect(manager.getToast()).toBeNull();
    manager.cleanup();
  });

  it('showToast sets toast to provided data', () => {
    const clock = createManualClock();
    const manager = createToastManager(100, clock);
    const data = { message: 'Test', color: 'green', icon: '+' };
    manager.showToast(data);
    expect(manager.getToast()).toEqual(data);
    manager.cleanup();
  });

  it('toast auto-dismisses to null only after dismissMs advances on the injected clock', () => {
    const clock = createManualClock();
    const manager = createToastManager(2000, clock);
    manager.showToast({ message: 'Test', color: 'green', icon: '+' });
    expect(manager.getToast()).not.toBeNull();

    clock.advanceBy(1999);
    expect(manager.getToast()).not.toBeNull();

    clock.advanceBy(1);
    expect(manager.getToast()).toBeNull();
    manager.cleanup();
  });

  it('showToast while active replaces existing toast (single-replacement)', () => {
    const clock = createManualClock();
    const manager = createToastManager(200, clock);
    manager.showToast({ message: 'First', color: 'green', icon: '+' });
    manager.showToast({ message: 'Second', color: 'red', icon: '-' });
    expect(manager.getToast()).toEqual({ message: 'Second', color: 'red', icon: '-' });
    manager.cleanup();
  });

  it('cleanup clears timer', () => {
    const clock = createManualClock();
    const manager = createToastManager(50, clock);
    manager.showToast({ message: 'Test', color: 'green', icon: '+' });
    manager.cleanup();
    clock.advanceBy(50);
    expect(manager.getToast()).toBeNull();
  });
});
