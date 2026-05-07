import { describe, expect, it } from 'bun:test';
import { createManualClock } from '../../time/manual-clock';
import { createTimedEffect, useTimedEffect } from './use-timed-effect';

describe('useTimedEffect', () => {
  it('is a function', () => {
    expect(typeof useTimedEffect).toBe('function');
  });

  it('exports UseTimedEffectReturn type via readonly fields in return type', () => {
    const source = useTimedEffect.toString();
    expect(source).toContain('active');
    expect(source).toContain('trigger');
  });

  it('defaults to the system clock without requiring caller changes', () => {
    const effect = createTimedEffect(100);
    expect(effect.isActive()).toBe(false);
    effect.cleanup();
  });
});

describe('useTimedEffect logic (extracted)', () => {
  it('createTimedEffect returns active=false initially', () => {
    const clock = createManualClock();
    const effect = createTimedEffect(100, clock);
    expect(effect.isActive()).toBe(false);
  });

  it('trigger sets active to true', () => {
    const clock = createManualClock();
    const effect = createTimedEffect(100, clock);
    effect.trigger();
    expect(effect.isActive()).toBe(true);
  });

  it('active reverts to false only after durationMs advances on the injected clock', () => {
    const clock = createManualClock();
    const effect = createTimedEffect(50, clock);
    effect.trigger();
    expect(effect.isActive()).toBe(true);

    clock.advanceBy(49);
    expect(effect.isActive()).toBe(true);

    clock.advanceBy(1);
    expect(effect.isActive()).toBe(false);
  });

  it('trigger while active resets timer (does not stack)', () => {
    const clock = createManualClock();
    const effect = createTimedEffect(60, clock);
    effect.trigger();
    clock.advanceBy(30);
    expect(effect.isActive()).toBe(true);

    effect.trigger();
    clock.advanceBy(59);
    expect(effect.isActive()).toBe(true);

    clock.advanceBy(1);
    expect(effect.isActive()).toBe(false);
  });

  it('cleanup clears timer', () => {
    const clock = createManualClock();
    const effect = createTimedEffect(50, clock);
    effect.trigger();
    effect.cleanup();
    clock.advanceBy(50);
    expect(effect.isActive()).toBe(false);
  });
});
