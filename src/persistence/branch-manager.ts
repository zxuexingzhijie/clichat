import * as nodeFs from 'node:fs';
import { mkdir as fsMkdir } from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { branchStore, BranchStateSchema, type BranchMeta } from '../state/branch-store';

export const _fs = {
  ...nodeFs,
  mkdir: fsMkdir,
};

export type BranchTreeNode = {
  readonly branch: BranchMeta;
  readonly children: readonly BranchTreeNode[];
};

function sanitizeBranchName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '-');
}

function guardPathTraversal(filePath: string, baseDir: string): void {
  const resolved = path.resolve(filePath);
  const resolvedBase = path.resolve(baseDir);
  if (!resolved.startsWith(resolvedBase + path.sep) && resolved !== resolvedBase) {
    throw new Error(`Path traversal detected: ${filePath} is outside save directory`);
  }
}

export function createBranch(name: string, description?: string): BranchMeta {
  const safeName = sanitizeBranchName(name);
  const id = nanoid();
  const state = branchStore.getState();
  const currentBranch = state.branches[state.currentBranchId];

  const newBranch: BranchMeta = {
    id,
    name: safeName,
    parentBranchId: state.currentBranchId,
    parentSaveId: currentBranch?.headSaveId ?? null,
    headSaveId: null,
    createdAt: new Date().toISOString(),
    description: description ?? '',
  };

  branchStore.setState(draft => {
    draft.branches[id] = newBranch;
    draft.currentBranchId = id;
  });

  return newBranch;
}

export function switchBranch(branchId: string): void {
  const state = branchStore.getState();
  if (!state.branches[branchId]) {
    throw new Error('分支不存在');
  }
  branchStore.setState(draft => {
    draft.currentBranchId = branchId;
  });
}

export function deleteBranch(branchId: string): void {
  const state = branchStore.getState();
  if (!state.branches[branchId]) {
    throw new Error('分支不存在');
  }
  if (branchId === state.currentBranchId) {
    throw new Error('无法删除当前所在分支');
  }
  const hasChildren = Object.values(state.branches).some(b => b.parentBranchId === branchId);
  if (hasChildren) {
    throw new Error('无法删除含有子分支的分支；请先删除或合并子分支');
  }
  branchStore.setState(draft => {
    delete draft.branches[branchId];
  });
}

export function listBranches(): readonly BranchMeta[] {
  return Object.values(branchStore.getState().branches);
}

export function getBranchTree(): BranchTreeNode[] {
  const state = branchStore.getState();
  const branches = Object.values(state.branches);

  function buildSubtree(parentId: string | null): BranchTreeNode[] {
    return branches
      .filter(b => b.parentBranchId === parentId)
      .map(branch => ({
        branch,
        children: buildSubtree(branch.id),
      }));
  }

  return buildSubtree(null);
}

export function updateBranchHead(branchId: string, saveId: string): void {
  const state = branchStore.getState();
  if (!state.branches[branchId]) {
    throw new Error('分支不存在');
  }
  branchStore.setState(draft => {
    draft.branches[branchId]!.headSaveId = saveId;
  });
}

export async function saveBranchRegistry(saveDir: string): Promise<void> {
  const registryPath = path.join(saveDir, 'branches.json');
  guardPathTraversal(registryPath, saveDir);
  await _fs.mkdir(saveDir, { recursive: true });
  await Bun.write(registryPath, JSON.stringify(branchStore.getState()));
}

export async function loadBranchRegistry(saveDir: string): Promise<void> {
  const registryPath = path.join(saveDir, 'branches.json');
  guardPathTraversal(registryPath, saveDir);

  try {
    const file = Bun.file(registryPath);
    const text = await file.text();
    const parsed = JSON.parse(text);
    const result = BranchStateSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Invalid branch registry: ${result.error.message}`);
    }
    branchStore.setState(draft => {
      Object.assign(draft, result.data);
    });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Invalid branch registry')) {
      throw err;
    }
    const isFileNotFound = err instanceof Error &&
      (err.message.includes('ENOENT') || err.message.includes('No such file'));
    if (!isFileNotFound) {
      throw err;
    }
  }
}
