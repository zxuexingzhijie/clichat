import { describe, it, expect } from 'bun:test';
import { useTimedEffect } from './use-timed-effect';

describe('useTimedEffect', () => {
  it('is a function', () => {
    expect(typeof useTimedEffect).toBe('function');
  });

  it('exports UseTimedEffectReturn type via readonly fields in return type', () => {
    const source = useTimedEffect.toString();
    expect(source).toContain('active');
    expect(source).toContain('trigger');
  });
});

describe('useTimedEffect logic (extracted)', () => {
  it('createTimedEffect returns active=false initially', () => {
    const { createTimedEffect } = require('./use-timed-effect');
    const effect = createTimedEffect(100);
    expect(effect.isActive()).toBe(false);
  });

  it('trigger sets active to true', () => {
    const { createTimedEffect } = require('./use-timed-effect');
    const effect = createTimedEffect(100);
    effect.trigger();
    expect(effect.isActive()).toBe(true);
  });

  it('active reverts to false after durationMs', async () => {
    const { createTimedEffect } = require('./use-timed-effect');
    const effect = createTimedEffect(50);
    effect.trigger();
    expect(effect.isActive()).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(effect.isActive()).toBe(false);
  });

  it('trigger while active resets timer (does not stack)', async () => {
    const { createTimedEffect } = require('./use-timed-effect');
    const effect = createTimedEffect(60);
    effect.trigger();
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(effect.isActive()).toBe(true);
    effect.trigger();
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(effect.isActive()).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(effect.isActive()).toBe(false);
  });

  it('cleanup clears timer', async () => {
    const { createTimedEffect } = require('./use-timed-effect');
    const effect = createTimedEffect(50);
    effect.trigger();
    effect.cleanup();
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(effect.isActive()).toBe(false);
  });
});
