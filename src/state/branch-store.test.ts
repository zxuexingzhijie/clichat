import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { eventBus } from '../events/event-bus';
import {
  BranchMetaSchema,
  BranchStateSchema,
  branchStore,
  getDefaultBranchState,
} from './branch-store';

describe('BranchMetaSchema', () => {
  test('validates a correct BranchMeta object', () => {
    const meta = {
      id: 'branch_01',
      name: 'alternate',
      parentBranchId: 'main',
      parentSaveId: 'save_01',
      headSaveId: 'save_02',
      createdAt: '2026-04-22T10:00:00.000Z',
      description: '备用分支',
    };
    const parsed = BranchMetaSchema.parse(meta);
    expect(parsed.id).toBe('branch_01');
    expect(parsed.name).toBe('alternate');
    expect(parsed.parentBranchId).toBe('main');
    expect(parsed.description).toBe('备用分支');
  });

  test('accepts nullable fields as null', () => {
    const meta = {
      id: 'main',
      name: 'main',
      parentBranchId: null,
      parentSaveId: null,
      headSaveId: null,
      createdAt: '2026-04-22T10:00:00.000Z',
      description: '主线剧情',
    };
    const parsed = BranchMetaSchema.parse(meta);
    expect(parsed.parentBranchId).toBeNull();
    expect(parsed.parentSaveId).toBeNull();
    expect(parsed.headSaveId).toBeNull();
  });

  test('rejects missing required fields', () => {
    expect(() => BranchMetaSchema.parse({ id: 'x' })).toThrow();
  });
});

describe('BranchStateSchema', () => {
  test('validates a branches record with currentBranchId', () => {
    const state = {
      branches: {
        main: {
          id: 'main',
          name: 'main',
          parentBranchId: null,
          parentSaveId: null,
          headSaveId: null,
          createdAt: '2026-04-22T10:00:00.000Z',
          description: '主线剧情',
        },
      },
      currentBranchId: 'main',
    };
    const parsed = BranchStateSchema.parse(state);
    expect(parsed.currentBranchId).toBe('main');
    expect(parsed.branches['main']?.name).toBe('main');
  });

  test('rejects missing currentBranchId', () => {
    expect(() => BranchStateSchema.parse({
      branches: {},
    })).toThrow();
  });
});

describe('branchStore', () => {
  beforeEach(() => {
    branchStore.setState(() => getDefaultBranchState());
  });

  test('default state has main branch with currentBranchId main', () => {
    const state = branchStore.getState();
    expect(state.currentBranchId).toBe('main');
    expect(state.branches['main']).toBeDefined();
    expect(state.branches['main']!.name).toBe('main');
    expect(state.branches['main']!.parentBranchId).toBeNull();
    expect(state.branches['main']!.description).toBe('主线剧情');
  });

  test('default state validates against BranchStateSchema', () => {
    const state = getDefaultBranchState();
    const parsed = BranchStateSchema.parse(state);
    expect(parsed.currentBranchId).toBe('main');
  });

  test('emits branch_created when a new branch key appears', () => {
    const handler = mock(() => {});
    eventBus.on('branch_created', handler);

    branchStore.setState(draft => {
      draft.branches['alt'] = {
        id: 'alt',
        name: 'alternate',
        parentBranchId: 'main',
        parentSaveId: 'save_01',
        headSaveId: null,
        createdAt: new Date().toISOString(),
        description: '分支路线',
      };
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const call = handler.mock.calls[0][0] as { branchId: string; branchName: string; parentBranchId: string | null };
    expect(call.branchId).toBe('alt');
    expect(call.branchName).toBe('alternate');
    expect(call.parentBranchId).toBe('main');

    eventBus.off('branch_created', handler);
  });

  test('emits branch_switched when currentBranchId changes', () => {
    branchStore.setState(draft => {
      draft.branches['alt'] = {
        id: 'alt',
        name: 'alternate',
        parentBranchId: 'main',
        parentSaveId: null,
        headSaveId: null,
        createdAt: new Date().toISOString(),
        description: '分支路线',
      };
    });

    const handler = mock(() => {});
    eventBus.on('branch_switched', handler);

    branchStore.setState(draft => {
      draft.currentBranchId = 'alt';
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const call = handler.mock.calls[0][0] as { fromBranchId: string; toBranchId: string };
    expect(call.fromBranchId).toBe('main');
    expect(call.toBranchId).toBe('alt');

    eventBus.off('branch_switched', handler);
  });

  test('emits branch_deleted when a branch key is removed', () => {
    branchStore.setState(draft => {
      draft.branches['alt'] = {
        id: 'alt',
        name: 'alternate',
        parentBranchId: 'main',
        parentSaveId: null,
        headSaveId: null,
        createdAt: new Date().toISOString(),
        description: '分支路线',
      };
    });

    const handler = mock(() => {});
    eventBus.on('branch_deleted', handler);

    branchStore.setState(draft => {
      delete draft.branches['alt'];
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const call = handler.mock.calls[0][0] as { branchId: string; branchName: string };
    expect(call.branchId).toBe('alt');
    expect(call.branchName).toBe('alternate');

    eventBus.off('branch_deleted', handler);
  });

  test('does not emit branch_switched when currentBranchId stays the same', () => {
    const handler = mock(() => {});
    eventBus.on('branch_switched', handler);

    branchStore.setState(draft => {
      draft.branches['main']!.headSaveId = 'save_99';
    });

    expect(handler).not.toHaveBeenCalled();
    eventBus.off('branch_switched', handler);
  });
});
