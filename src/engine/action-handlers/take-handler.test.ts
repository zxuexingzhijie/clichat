import { describe, it, expect } from 'bun:test';
import { handleTake } from './take-handler';
import { createStore } from '../../state/create-store';
import { getDefaultSceneState } from '../../state/scene-store';
import { getDefaultPlayerState } from '../../state/player-store';
import { getDefaultGameState } from '../../state/game-store';
import { getDefaultCombatState } from '../../state/combat-store';
import type { SceneState } from '../../state/scene-store';
import type { PlayerState } from '../../state/player-store';
import type { ActionContext } from './types';
import type { CodexEntry } from '../../codex/schemas/entry-types';

const EPISTEMIC = {
  authority: 'established_canon' as const,
  truth_status: 'true' as const,
  scope: 'global' as const,
  visibility: 'public' as const,
  confidence: 1,
  source_type: 'authorial' as const,
  known_by: [],
  contradicts: [],
  volatility: 'stable' as const,
};

const WOLF_PELT_ENTRY: CodexEntry = {
  id: 'item_wolf_pelt',
  name: '灰狼皮',
  type: 'item',
  tags: ['item', 'material'],
  description: '一张完整的灰狼皮毛',
  epistemic: EPISTEMIC,
  item_type: 'material',
  value: 15,
};

const BOW_ENTRY: CodexEntry = {
  id: 'item_short_bow',
  name: '短弓',
  type: 'item',
  tags: ['item', 'weapon'],
  description: '一把轻便的短弓',
  epistemic: EPISTEMIC,
  item_type: 'weapon',
  value: 30,
};

function makeMockCtx(opts: {
  droppedItems?: string[];
  playerTags?: string[];
  codexEntries?: Map<string, CodexEntry> | null;
}): ActionContext {
  const sceneStore = createStore<SceneState>({
    ...getDefaultSceneState(),
    droppedItems: opts.droppedItems ?? [],
    narrationLines: [],
  });
  const playerStore = createStore<PlayerState>({
    ...getDefaultPlayerState(),
    tags: opts.playerTags ?? [],
  });
  const gameStore = createStore(getDefaultGameState());
  const combatStore = createStore(getDefaultCombatState());

  const resolvedCodex = opts.codexEntries === null || opts.codexEntries === undefined
    ? ('codexEntries' in opts ? undefined : new Map([[WOLF_PELT_ENTRY.id, WOLF_PELT_ENTRY]]))
    : opts.codexEntries;

  return {
    stores: {
      scene: sceneStore,
      player: playerStore,
      game: gameStore,
      combat: combatStore,
    },
    codexEntries: resolvedCodex,
    eventBus: { emit: () => {}, on: () => () => {} } as unknown as ActionContext['eventBus'],
  } as ActionContext;
}

describe('handleTake', () => {
  it('picks up item by target id, removes from droppedItems, adds to player.tags', async () => {
    const ctx = makeMockCtx({ droppedItems: ['item_wolf_pelt'] });
    const result = await handleTake({ type: 'take', target: 'item_wolf_pelt' }, ctx);

    expect(result.status).toBe('action_executed');
    expect(ctx.stores.scene.getState().droppedItems).not.toContain('item_wolf_pelt');
    expect(ctx.stores.player.getState().tags).toContain('item:item_wolf_pelt');
  });

  it('returns error when target item is not in droppedItems', async () => {
    const ctx = makeMockCtx({ droppedItems: [] });
    const result = await handleTake({ type: 'take', target: 'item_wolf_pelt' }, ctx);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('地上没有该物品。');
    }
  });

  it('auto-picks single item when no target given', async () => {
    const ctx = makeMockCtx({ droppedItems: ['item_wolf_pelt'] });
    const result = await handleTake({ type: 'take' }, ctx);

    expect(result.status).toBe('action_executed');
    expect(ctx.stores.scene.getState().droppedItems).toEqual([]);
    expect(ctx.stores.player.getState().tags).toContain('item:item_wolf_pelt');
  });

  it('returns error listing items when no target and multiple droppedItems', async () => {
    const codex = new Map<string, CodexEntry>([
      [WOLF_PELT_ENTRY.id, WOLF_PELT_ENTRY],
      [BOW_ENTRY.id, BOW_ENTRY],
    ]);
    const ctx = makeMockCtx({ droppedItems: ['item_wolf_pelt', 'item_short_bow'], codexEntries: codex });
    const result = await handleTake({ type: 'take' }, ctx);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toContain('灰狼皮');
      expect(result.message).toContain('短弓');
      expect(result.message).toContain('请指定');
    }
  });

  it('returns error when no target and droppedItems is empty', async () => {
    const ctx = makeMockCtx({ droppedItems: [] });
    const result = await handleTake({ type: 'take' }, ctx);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('地上没有可拾取的物品。');
    }
  });

  it('returns error when codexEntries is not loaded', async () => {
    const ctx = makeMockCtx({ droppedItems: ['item_wolf_pelt'], codexEntries: undefined });
    const result = await handleTake({ type: 'take', target: 'item_wolf_pelt' }, ctx);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('世界数据未加载。');
    }
  });
});
