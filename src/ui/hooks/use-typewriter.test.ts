import { describe, it, expect } from 'bun:test';
import { useTypewriter, createTypewriter } from './use-typewriter';
import { createManualClock } from '../../time/manual-clock';

describe('useTypewriter', () => {
  it('is a function', () => {
    expect(typeof useTypewriter).toBe('function');
  });

  it('exports UseTypewriterReturn type via readonly fields in return type', () => {
    const source = useTypewriter.toString();
    expect(source).toContain('displayText');
    expect(source).toContain('isComplete');
    expect(source).toContain('skip');
  });

  it('defaults public hook timing to systemClock-compatible runtime behavior', () => {
    const source = useTypewriter.toString();
    expect(source).toContain('createTypewriter');
  });
});

describe('useTypewriter logic (extracted)', () => {
  it('displayText starts as empty string', () => {
    const clock = createManualClock();
    const tw = createTypewriter('Hello', 50, clock);
    expect(tw.getDisplayText()).toBe('');
    tw.cleanup();
  });

  it('displayText accumulates characters through ManualClock advancement', () => {
    const clock = createManualClock();
    const tw = createTypewriter('Hi', 30, clock);
    tw.start();

    expect(tw.getDisplayText()).toBe('');
    expect(clock.pendingCount()).toBe(1);

    clock.advanceBy(29);
    expect(tw.getDisplayText()).toBe('');

    clock.advanceBy(1);
    expect(tw.getDisplayText()).toBe('H');
    expect(tw.getIsComplete()).toBe(false);

    tw.cleanup();
  });

  it('isComplete becomes true when all characters are revealed by ManualClock', () => {
    const clock = createManualClock();
    const tw = createTypewriter('AB', 20, clock);
    tw.start();

    clock.advanceBy(20);
    expect(tw.getDisplayText()).toBe('A');
    expect(tw.getIsComplete()).toBe(false);

    clock.advanceBy(20);
    expect(tw.getIsComplete()).toBe(true);
    expect(tw.getDisplayText()).toBe('AB');
    expect(clock.pendingCount()).toBe(0);

    tw.cleanup();
  });

  it('skip immediately sets displayText to full text and clears pending timer', () => {
    const clock = createManualClock();
    const tw = createTypewriter('Hello World', 50, clock);
    tw.start();

    expect(clock.pendingCount()).toBe(1);
    tw.skip();

    expect(tw.getDisplayText()).toBe('Hello World');
    expect(tw.getIsComplete()).toBe(true);
    expect(clock.pendingCount()).toBe(0);

    tw.cleanup();
  });

  it('skip while already complete is a no-op', () => {
    const clock = createManualClock();
    const tw = createTypewriter('AB', 20, clock);
    tw.start();

    clock.advanceBy(40);
    expect(tw.getIsComplete()).toBe(true);
    tw.skip();

    expect(tw.getDisplayText()).toBe('AB');
    expect(tw.getIsComplete()).toBe(true);
    expect(clock.pendingCount()).toBe(0);

    tw.cleanup();
  });
});
