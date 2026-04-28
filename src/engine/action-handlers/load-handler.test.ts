import { describe, it, expect, mock } from 'bun:test';
import { handleLoad } from './load-handler';
import type { ActionContext } from './types';
import type { GameAction } from '../../types/game-action';
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

function makeLoadAction(target?: string): GameAction {
  return { type: 'load', target: target ?? null, modifiers: {}, source: 'command' };
}

describe('handleLoad (SAVE-03)', () => {
  it('calls loadGame with saveDir as third argument', async () => {
    const loadGameMock = mock(async () => {});
    const ctx: ActionContext = {
      stores: makeStores(),
      eventBus,
      saveFileManager: {
        quickSave: async () => '',
        saveGame: async () => '',
        loadGame: loadGameMock,
      },
      serializer: { snapshot: (_saveName?: string): string => '{}', restore: () => {} },
      saveDir: '/test/saves',
    };

    await handleLoad(makeLoadAction('mysave.json'), ctx);

    expect(loadGameMock).toHaveBeenCalledTimes(1);
    const callArgs = (loadGameMock.mock.calls as unknown as unknown[][])[0] as unknown[];
    expect(callArgs[0]).toBe('/test/saves/mysave.json');
    expect(callArgs[2]).toBe('/test/saves');
  });

  it('returns action_executed on success', async () => {
    const ctx: ActionContext = {
      stores: makeStores(),
      eventBus,
      saveFileManager: {
        quickSave: async () => '',
        saveGame: async () => '',
        loadGame: async () => {},
      },
      serializer: { snapshot: (_saveName?: string): string => '{}', restore: () => {} },
      saveDir: '/test/saves',
    };

    const result = await handleLoad(makeLoadAction(), ctx);
    expect(result.status).toBe('action_executed');
  });

  it('returns error when saveFileManager is missing', async () => {
    const ctx: ActionContext = {
      stores: makeStores(),
      eventBus,
    };

    const result = await handleLoad(makeLoadAction(), ctx);
    expect(result.status).toBe('error');
  });
});
