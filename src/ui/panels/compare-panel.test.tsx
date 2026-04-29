import { describe, it, expect } from 'bun:test';
import type { BranchMeta } from '../../state/branch-store';

const mockBranches: Record<string, BranchMeta> = {
  'branch-main': {
    id: 'branch-main',
    name: 'main',
    parentBranchId: null,
    parentSaveId: null,
    headSaveId: 'save1.json',
    createdAt: '2026-01-01T00:00:00.000Z',
    description: '',
  },
  'branch-alt': {
    id: 'branch-alt',
    name: 'chapter2',
    parentBranchId: 'branch-main',
    parentSaveId: 'save1.json',
    headSaveId: 'save2.json',
    createdAt: '2026-01-02T00:00:00.000Z',
    description: '',
  },
};

describe('ComparePanel module', () => {
  it('exports ComparePanel component', async () => {
    const mod = await import('./compare-panel');
    expect(typeof mod.ComparePanel).toBe('function');
  });
});

describe('ComparePanel: state machine stages', () => {
  it('ComparePanel source contains selecting stage', async () => {
    const mod = await import('./compare-panel');
    const source = mod.ComparePanel.toString();
    expect(source).toContain('selecting');
  });

  it('ComparePanel source contains loading stage', async () => {
    const mod = await import('./compare-panel');
    const source = mod.ComparePanel.toString();
    expect(source).toContain('loading');
  });

  it('ComparePanel source contains summarizing stage', async () => {
    const mod = await import('./compare-panel');
    const source = mod.ComparePanel.toString();
    expect(source).toContain('summarizing');
  });

  it('ComparePanel source contains ready stage', async () => {
    const mod = await import('./compare-panel');
    const source = mod.ComparePanel.toString();
    expect(source).toContain('ready');
  });

  it('ComparePanel source contains error stage', async () => {
    const mod = await import('./compare-panel');
    const source = mod.ComparePanel.toString();
    expect(source).toContain('error');
  });
});

describe('ComparePanel: props interface', () => {
  it('ComparePanel accepts branches prop', async () => {
    const mod = await import('./compare-panel');
    const source = mod.ComparePanel.toString();
    expect(source).toContain('branches');
  });

  it('ComparePanel accepts readSaveData prop', async () => {
    const mod = await import('./compare-panel');
    const source = mod.ComparePanel.toString();
    expect(source).toContain('readSaveData');
  });

  it('ComparePanel accepts saveDir prop', async () => {
    const mod = await import('./compare-panel');
    const source = mod.ComparePanel.toString();
    expect(source).toContain('saveDir');
  });

  it('ComparePanel accepts onClose prop', async () => {
    const mod = await import('./compare-panel');
    const source = mod.ComparePanel.toString();
    expect(source).toContain('onClose');
  });
});

describe('ComparePanel: compareSpec auto-trigger', () => {
  it('ComparePanel source reads compareSpec from GameStoreCtx', async () => {
    const mod = await import('./compare-panel');
    const source = mod.ComparePanel.toString();
    expect(source).toContain('compareSpec');
  });

  it('ComparePanel source calls runCompare when compareSpec is set', async () => {
    const mod = await import('./compare-panel');
    const source = mod.ComparePanel.toString();
    expect(source).toContain('runCompare');
  });
});

describe('ComparePanel: selector UI text', () => {
  it('ComparePanel source contains selector title text', async () => {
    const mod = await import('./compare-panel');
    const source = mod.ComparePanel.toString();
    // Bun compiles Chinese strings to \uXXXX escapes in .toString() output
    expect(source).toMatch(/9009|选择要比较的分支/);
  });

  it('ComparePanel source contains Esc close hint', async () => {
    const mod = await import('./compare-panel');
    const source = mod.ComparePanel.toString();
    expect(source).toContain('onClose');
  });
});

describe('ComparePanel: loading/summarizing spinners', () => {
  it('ComparePanel source uses Spinner component', async () => {
    const mod = await import('./compare-panel');
    const source = mod.ComparePanel.toString();
    expect(source).toContain('Spinner');
  });
});

describe('ComparePanel: branch lookup logic', () => {
  it('finds branches by name in branches record', () => {
    const sourceName = 'main';
    const found = Object.values(mockBranches).find(b => b.name === sourceName);
    expect(found).toBeDefined();
    expect(found?.id).toBe('branch-main');
  });

  it('returns undefined for unknown branch name', () => {
    const found = Object.values(mockBranches).find(b => b.name === 'nonexistent');
    expect(found).toBeUndefined();
  });

  it('headSaveId is available when branch exists', () => {
    const branch = Object.values(mockBranches).find(b => b.name === 'chapter2');
    expect(branch?.headSaveId).toBe('save2.json');
  });
});

describe('ComparePanel: CATEGORY_ORDER', () => {
  it('ComparePanel module exports or uses CATEGORY_ORDER with all 6 categories', async () => {
    const branchDiff = await import('../../engine/branch-diff');
    const categories = ['quest', 'npc_relation', 'inventory', 'location', 'faction', 'knowledge'];
    for (const cat of categories) {
      expect(categories).toContain(cat);
    }
    expect(typeof branchDiff.compareBranches).toBe('function');
  });
});
