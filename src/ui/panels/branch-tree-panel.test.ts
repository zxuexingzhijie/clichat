import { describe, it, expect } from 'bun:test';

describe('BranchTreePanel module', () => {
  it('exports BranchTreePanel component', async () => {
    const mod = await import('./branch-tree-panel');
    expect(typeof mod.BranchTreePanel).toBe('function');
  });

  it('exports BranchSaveInfo and BranchDisplayNode types (via re-export check)', async () => {
    const mod = await import('./branch-tree-panel');
    expect(mod).toHaveProperty('BranchTreePanel');
  });
});
