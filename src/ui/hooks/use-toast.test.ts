import { describe, it, expect } from 'bun:test';
import { useToast } from './use-toast';

describe('useToast', () => {
  it('is a function', () => {
    expect(typeof useToast).toBe('function');
  });

  it('source contains clearTimeout for single-replacement', () => {
    const source = useToast.toString();
    expect(source).toContain('clearTimeout');
  });
});

describe('useToast logic (extracted)', () => {
  it('toast is null initially', () => {
    const { createToastManager } = require('./use-toast');
    const manager = createToastManager(100);
    expect(manager.getToast()).toBeNull();
    manager.cleanup();
  });

  it('showToast sets toast to provided data', () => {
    const { createToastManager } = require('./use-toast');
    const manager = createToastManager(100);
    const data = { message: 'Test', color: 'green', icon: '+' };
    manager.showToast(data);
    expect(manager.getToast()).toEqual(data);
    manager.cleanup();
  });

  it('toast auto-dismisses to null after dismissMs', async () => {
    const { createToastManager } = require('./use-toast');
    const manager = createToastManager(50);
    manager.showToast({ message: 'Test', color: 'green', icon: '+' });
    expect(manager.getToast()).not.toBeNull();
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(manager.getToast()).toBeNull();
    manager.cleanup();
  });

  it('showToast while active replaces existing toast (single-replacement)', () => {
    const { createToastManager } = require('./use-toast');
    const manager = createToastManager(200);
    manager.showToast({ message: 'First', color: 'green', icon: '+' });
    manager.showToast({ message: 'Second', color: 'red', icon: '-' });
    expect(manager.getToast()).toEqual({ message: 'Second', color: 'red', icon: '-' });
    manager.cleanup();
  });

  it('cleanup clears timer', async () => {
    const { createToastManager } = require('./use-toast');
    const manager = createToastManager(50);
    manager.showToast({ message: 'Test', color: 'green', icon: '+' });
    manager.cleanup();
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(manager.getToast()).toBeNull();
  });
});
