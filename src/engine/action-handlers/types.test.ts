import { describe, it, expect } from 'bun:test';
import type { ActionContext } from './types';
import type { BranchMeta } from '../../state/branch-store';
import type { Serializer } from '../../state/serializer';

describe('ActionContext type contracts (SAVE-02, SAVE-03)', () => {
  it('saveFileManager.loadGame accepts 3rd saveDir argument', () => {
    const mockSfm: NonNullable<ActionContext['saveFileManager']> = {
      quickSave: async () => '',
      saveGame: async () => '',
      loadGame: async (_filePath: string, _serializer: Serializer, _saveDir?: string) => {},
    };
    expect(typeof mockSfm.loadGame).toBe('function');
  });

  it('branchManager has getBranchMeta returning BranchMeta | undefined', () => {
    const mockBm: NonNullable<ActionContext['branchManager']> = {
      createBranch: (_name: string): BranchMeta => ({
        id: 'test', name: 'test', parentBranchId: null, parentSaveId: null,
        headSaveId: null, createdAt: '', description: '',
      }),
      switchBranch: (_branchId: string) => {},
      deleteBranch: (_branchId: string) => {},
      getBranchMeta: (_branchId: string): BranchMeta | undefined => undefined,
    };
    expect(typeof mockBm.getBranchMeta).toBe('function');
    expect(mockBm.getBranchMeta('nonexistent')).toBeUndefined();
  });
});
