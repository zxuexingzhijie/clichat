import { z } from 'zod';
import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';

export const BranchMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentBranchId: z.string().nullable(),
  parentSaveId: z.string().nullable(),
  headSaveId: z.string().nullable(),
  createdAt: z.string(),
  description: z.string(),
});
export type BranchMeta = z.infer<typeof BranchMetaSchema>;

export const BranchStateSchema = z.object({
  branches: z.record(z.string(), BranchMetaSchema),
  currentBranchId: z.string(),
});
export type BranchState = z.infer<typeof BranchStateSchema>;

export function getDefaultBranchState(): BranchState {
  return {
    branches: {
      main: {
        id: 'main',
        name: 'main',
        parentBranchId: null,
        parentSaveId: null,
        headSaveId: null,
        createdAt: new Date().toISOString(),
        description: '主线剧情',
      },
    },
    currentBranchId: 'main',
  };
}

export const branchStore = createStore<BranchState>(
  getDefaultBranchState(),
  ({ newState, oldState }) => {
    for (const branchId of Object.keys(newState.branches)) {
      if (!oldState.branches[branchId]) {
        const branch = newState.branches[branchId]!;
        eventBus.emit('branch_created', {
          branchId,
          branchName: branch.name,
          parentBranchId: branch.parentBranchId,
        });
      }
    }

    for (const branchId of Object.keys(oldState.branches)) {
      if (!newState.branches[branchId]) {
        const branch = oldState.branches[branchId]!;
        eventBus.emit('branch_deleted', {
          branchId,
          branchName: branch.name,
        });
      }
    }

    if (newState.currentBranchId !== oldState.currentBranchId) {
      eventBus.emit('branch_switched', {
        fromBranchId: oldState.currentBranchId,
        toBranchId: newState.currentBranchId,
      });
    }
  },
);
