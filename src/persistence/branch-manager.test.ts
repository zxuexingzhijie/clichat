import { describe, it, expect, beforeEach } from 'bun:test';
import { branchStore, getDefaultBranchState } from '../state/branch-store';
import {
  createBranch,
  switchBranch,
  deleteBranch,
  listBranches,
  getBranchTree,
  updateBranchHead,
  saveBranchRegistry,
  loadBranchRegistry,
} from './branch-manager';
import * as nodeFs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function resetBranchStore(): void {
  branchStore.setState(draft => {
    Object.assign(draft, getDefaultBranchState());
  });
}

describe('BranchManager', () => {
  beforeEach(() => {
    resetBranchStore();
  });

  describe('createBranch', () => {
    it('creates a branch with correct parentBranchId and switches to it', () => {
      const branch = createBranch('side-quest');
      expect(branch.name).toBe('side-quest');
      expect(branch.parentBranchId).toBe('main');
      expect(branch.parentSaveId).toBe(null);
      expect(branch.headSaveId).toBe(null);
      expect(branchStore.getState().currentBranchId).toBe(branch.id);
    });

    it('uses parent branch headSaveId as parentSaveId', () => {
      updateBranchHead('main', 'save-123');
      const branch = createBranch('from-save');
      expect(branch.parentSaveId).toBe('save-123');
    });

    it('generates unique id for each branch', () => {
      const b1 = createBranch('branch-a');
      resetBranchStore();
      const b2 = createBranch('branch-b');
      expect(b1.id).not.toBe(b2.id);
    });

    it('sanitizes branch name (strips special chars, preserves CJK)', () => {
      const branch = createBranch('my branch/恶魔@城堡!');
      expect(branch.name).toBe('my-branch-恶魔-城堡-');
    });

    it('stores description when provided', () => {
      const branch = createBranch('evil-path', '选择邪恶路线');
      expect(branch.description).toBe('选择邪恶路线');
    });

    it('uses empty string as default description', () => {
      const branch = createBranch('no-desc');
      expect(branch.description).toBe('');
    });
  });

  describe('switchBranch', () => {
    it('changes currentBranchId', () => {
      const branch = createBranch('side-quest');
      switchBranch('main');
      expect(branchStore.getState().currentBranchId).toBe('main');
      switchBranch(branch.id);
      expect(branchStore.getState().currentBranchId).toBe(branch.id);
    });

    it('throws for non-existent branch', () => {
      expect(() => switchBranch('non-existent')).toThrow('分支不存在');
    });
  });

  describe('deleteBranch', () => {
    it('removes branch from registry', () => {
      const branch = createBranch('temp-branch');
      switchBranch('main');
      deleteBranch(branch.id);
      expect(branchStore.getState().branches[branch.id]).toBeUndefined();
    });

    it('throws when trying to delete current branch', () => {
      const branch = createBranch('active-branch');
      expect(() => deleteBranch(branch.id)).toThrow('无法删除当前所在分支');
    });

    it('throws for non-existent branch', () => {
      expect(() => deleteBranch('non-existent')).toThrow('分支不存在');
    });
  });

  describe('listBranches', () => {
    it('returns all branches', () => {
      createBranch('branch-a');
      createBranch('branch-b');
      const branches = listBranches();
      expect(branches.length).toBe(3);
    });

    it('returns only main branch initially', () => {
      const branches = listBranches();
      expect(branches.length).toBe(1);
      expect(branches[0]!.name).toBe('main');
    });
  });

  describe('getBranchTree', () => {
    it('returns correct tree structure', () => {
      const tree = getBranchTree();
      expect(tree.length).toBe(1);
      expect(tree[0]!.branch.name).toBe('main');
      expect(tree[0]!.children.length).toBe(0);
    });

    it('nests child branches under parent', () => {
      const child = createBranch('child-branch');
      switchBranch('main');
      const tree = getBranchTree();
      expect(tree.length).toBe(1);
      expect(tree[0]!.branch.name).toBe('main');
      expect(tree[0]!.children.length).toBe(1);
      expect(tree[0]!.children[0]!.branch.id).toBe(child.id);
    });

    it('handles multi-level nesting', () => {
      const child = createBranch('child');
      const grandchild = createBranch('grandchild');
      switchBranch('main');
      const tree = getBranchTree();
      expect(tree[0]!.children.length).toBe(1);
      expect(tree[0]!.children[0]!.children.length).toBe(1);
      expect(tree[0]!.children[0]!.children[0]!.branch.id).toBe(grandchild.id);
    });
  });

  describe('updateBranchHead', () => {
    it('updates headSaveId for the given branch', () => {
      updateBranchHead('main', 'save-456');
      expect(branchStore.getState().branches['main']!.headSaveId).toBe('save-456');
    });

    it('throws for non-existent branch', () => {
      expect(() => updateBranchHead('non-existent', 'save-1')).toThrow('分支不存在');
    });
  });

  describe('saveBranchRegistry / loadBranchRegistry', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = nodeFs.mkdtempSync(path.join(os.tmpdir(), 'branch-test-'));
    });

    it('saves and loads branch registry roundtrip', async () => {
      createBranch('persist-me');
      await saveBranchRegistry(tmpDir);

      resetBranchStore();
      expect(listBranches().length).toBe(1);

      await loadBranchRegistry(tmpDir);
      expect(listBranches().length).toBe(2);
    });

    it('load keeps default state if file does not exist', async () => {
      const emptyDir = nodeFs.mkdtempSync(path.join(os.tmpdir(), 'branch-empty-'));
      await loadBranchRegistry(emptyDir);
      expect(branchStore.getState().currentBranchId).toBe('main');
      expect(listBranches().length).toBe(1);
    });
  });

  describe('branch name sanitization', () => {
    it('preserves alphanumeric and CJK characters', () => {
      const branch = createBranch('abc-123_中文');
      expect(branch.name).toBe('abc-123_中文');
    });

    it('replaces special characters with hyphens', () => {
      const branch = createBranch('bad name!@#$%');
      expect(branch.name).toBe('bad-name-----');
    });

    it('replaces spaces with hyphens', () => {
      const branch = createBranch('my branch name');
      expect(branch.name).toBe('my-branch-name');
    });
  });
});
