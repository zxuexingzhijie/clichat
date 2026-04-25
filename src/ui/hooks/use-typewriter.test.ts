import { describe, it, expect } from 'bun:test';
import { useTypewriter } from './use-typewriter';

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
});

describe('useTypewriter logic (extracted)', () => {
  it('displayText starts as empty string', () => {
    const { createTypewriter } = require('./use-typewriter');
    const tw = createTypewriter('Hello', 50);
    expect(tw.getDisplayText()).toBe('');
    tw.cleanup();
  });

  it('displayText accumulates characters over time', async () => {
    const { createTypewriter } = require('./use-typewriter');
    const tw = createTypewriter('Hi', 30);
    tw.start();
    await new Promise(resolve => setTimeout(resolve, 50));
    const text = tw.getDisplayText();
    expect(text.length).toBeGreaterThan(0);
    expect(text.length).toBeLessThanOrEqual(2);
    tw.cleanup();
  });

  it('isComplete becomes true when all characters revealed', async () => {
    const { createTypewriter } = require('./use-typewriter');
    const tw = createTypewriter('AB', 20);
    tw.start();
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(tw.getIsComplete()).toBe(true);
    expect(tw.getDisplayText()).toBe('AB');
    tw.cleanup();
  });

  it('skip immediately sets displayText to full text and isComplete to true', () => {
    const { createTypewriter } = require('./use-typewriter');
    const tw = createTypewriter('Hello World', 50);
    tw.start();
    tw.skip();
    expect(tw.getDisplayText()).toBe('Hello World');
    expect(tw.getIsComplete()).toBe(true);
    tw.cleanup();
  });

  it('skip while already complete is a no-op', async () => {
    const { createTypewriter } = require('./use-typewriter');
    const tw = createTypewriter('AB', 20);
    tw.start();
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(tw.getIsComplete()).toBe(true);
    tw.skip();
    expect(tw.getDisplayText()).toBe('AB');
    expect(tw.getIsComplete()).toBe(true);
    tw.cleanup();
  });
});
