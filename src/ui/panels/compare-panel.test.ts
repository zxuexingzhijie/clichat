import { describe, it, expect } from 'bun:test';

describe('DiffLine module', () => {
  it('exports DiffLine component', async () => {
    const mod = await import('../components/diff-line');
    expect(typeof mod.DiffLine).toBe('function');
  });
});

describe('ComparePanel module', () => {
  it('exports ComparePanel component', async () => {
    const mod = await import('./compare-panel');
    expect(typeof mod.ComparePanel).toBe('function');
  });
});
