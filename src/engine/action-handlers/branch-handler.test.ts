import { describe, it, expect, mock } from 'bun:test';
import { handleBranch } from './branch-handler';
import type { ActionContext } from './types';
import type { GameAction } from '../../types/game-action';
import type { BranchMeta } from '../../state/branch-store';
import { createStore } from '../../state/create-store';
import { getDefaultGameState } from '../../state/game-store';
import { getDefaultPlayerState } from '../../state/player-store';
import { getDefaultSceneState } from '../../state/scene-store';
import { getDefaultCombatState } from '../../state/combat-store';
import { eventBus } from '../../events/event-bus';

function makeStores() {
  return {
    game: createStore(getDefaultGameState()),
    player: createStore(getDefaultPlayerState()),
    scene: createStore(getDefaultSceneState()),
    combat: createStore(getDefaultCombatState()),
  };
}

function makeSwitchAction(name: string): GameAction {
  return { type: 'branch', target: 'switch', modifiers: { name }, source: 'command' };
}

function makeBaseMeta(overrides: Partial<BranchMeta> = {}): BranchMeta {
  return {
    id: 'branch-1', name: 'branch-1', parentBranchId: null,
    parentSaveId: null, headSaveId: null, createdAt: '', description: '',
    ...overrides,
  };
}

describe('handleBranch switch (SAVE-02)', () => {
  it('returns error "该分支没有存档可恢复" when headSaveId is null', async () => {
    const ctx: ActionContext = {
      stores: makeStores(),
      eventBus,
      branchManager: {
        createBranch: () => makeBaseMeta(),
        switchBranch: () => {},
        deleteBranch: () => {},
        getBranchMeta: () => makeBaseMeta({ headSaveId: null }),
      },
    };

    const result = await handleBranch(makeSwitchAction('branch-1'), ctx);
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('该分支没有存档可恢复');
    }
  });

  it('calls loadGame with correct filePath when headSaveId is set', async () => {
    const loadGameMock = mock(async () => {});
    const ctx: ActionContext = {
      stores: makeStores(),
      eventBus,
      branchManager: {
        createBranch: () => makeBaseMeta(),
        switchBranch: () => {},
        deleteBranch: () => {},
        getBranchMeta: () => makeBaseMeta({ headSaveId: 'save-abc.json' }),
      },
      saveFileManager: {
        quickSave: async () => '',
        saveGame: async () => '',
        loadGame: loadGameMock,
      },
      serializer: { snapshot: (_saveName?: string): string => '{}', restore: () => {} },
      saveDir: '/test/saves',
    };

    await handleBranch(makeSwitchAction('branch-1'), ctx);

    expect(loadGameMock).toHaveBeenCalledTimes(1);
    const callArgs = (loadGameMock.mock.calls as unknown as unknown[][])[0] as unknown[];
    expect(callArgs[0]).toBe('/test/saves/save-abc.json');
    expect(callArgs[2]).toBe('/test/saves');
  });

  it('returns action_executed with success narration when headSaveId is set', async () => {
    const ctx: ActionContext = {
      stores: makeStores(),
      eventBus,
      branchManager: {
        createBranch: () => makeBaseMeta(),
        switchBranch: () => {},
        deleteBranch: () => {},
        getBranchMeta: () => makeBaseMeta({ headSaveId: 'save-abc.json' }),
      },
      saveFileManager: {
        quickSave: async () => '',
        saveGame: async () => '',
        loadGame: async () => {},
      },
      serializer: { snapshot: (_saveName?: string): string => '{}', restore: () => {} },
      saveDir: '/test/saves',
    };

    const result = await handleBranch(makeSwitchAction('branch-1'), ctx);
    expect(result.status).toBe('action_executed');
    if (result.status === 'action_executed') {
      expect(result.narration[0]).toBe('已切换至分支「branch-1」并恢复存档。');
    }
  });

  it('returns error when switchBranch throws (branch not found)', async () => {
    const ctx: ActionContext = {
      stores: makeStores(),
      eventBus,
      branchManager: {
        createBranch: () => makeBaseMeta(),
        switchBranch: () => { throw new Error('not found'); },
        deleteBranch: () => {},
        getBranchMeta: () => undefined,
      },
    };

    const result = await handleBranch(makeSwitchAction('nonexistent'), ctx);
    expect(result.status).toBe('error');
  });
});
