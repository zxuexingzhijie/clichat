import { describe, it, expect, mock } from 'bun:test';
import { handleMove } from './move-handler';
import type { ActionContext } from './types';
import type { CombatLoop } from '../combat-loop';
import { createStore } from '../../state/create-store';
import type { CombatState } from '../../state/combat-store';
import { getDefaultCombatState } from '../../state/combat-store';
import type { CodexEntry } from '../../codex/schemas/entry-types';

const validEpistemic = {
  authority: 'canonical_truth' as const,
  truth_status: 'true' as const,
  scope: 'regional' as const,
  visibility: 'public' as const,
  confidence: 1.0,
  source_type: 'authorial' as const,
  known_by: [],
  contradicts: [],
  volatility: 'stable' as const,
};

function makeCombatStore(overrides: Partial<CombatState> = {}) {
  return createStore<CombatState>({ ...getDefaultCombatState(), ...overrides });
}

function makeCombatLoop(overrides: Partial<CombatLoop> = {}): CombatLoop {
  return {
    startCombat: mock(async () => {}),
    processPlayerAction: mock(async () => ({ status: 'ok' as const, narration: '' })),
    processEnemyTurn: mock(async () => {}),
    checkCombatEnd: mock(async () => ({ ended: false as const })),
    getCombatPhase: mock(() => 'player_turn'),
    ...overrides,
  };
}

function makeSceneManager(successSceneId: string | null, error?: string) {
  return {
    handleGo: mock(async (direction: string) => {
      if (error) return { status: 'error' as const, message: error };
      return { status: 'success' as const, narration: [`移动到 ${direction}`] };
    }),
    getCurrentScene: mock(() => successSceneId),
  };
}

function makeCtx(opts: {
  sceneManager?: ReturnType<typeof makeSceneManager>;
  combatLoop?: CombatLoop;
  combatStore?: ReturnType<typeof makeCombatStore>;
  codexEntries?: Map<string, CodexEntry>;
}): ActionContext {
  return {
    sceneManager: opts.sceneManager,
    combatLoop: opts.combatLoop,
    codexEntries: opts.codexEntries,
    stores: {
      combat: opts.combatStore ?? makeCombatStore(),
    },
  } as unknown as ActionContext;
}

const locationWithEnemies: CodexEntry = {
  id: 'loc_dark_cave',
  name: '黑暗洞穴',
  type: 'location',
  tags: ['dungeon'],
  description: '危险洞穴',
  epistemic: validEpistemic,
  region: '荒野',
  danger_level: 7,
  exits: [],
  notable_npcs: [],
  objects: [],
  enemies: ['enemy_wolf'],
};

const locationWithoutEnemies: CodexEntry = {
  id: 'loc_tavern',
  name: '酒馆',
  type: 'location',
  tags: [],
  description: '安全地点',
  epistemic: validEpistemic,
  region: '黑松镇',
  danger_level: 0,
  exits: [],
  notable_npcs: [],
  objects: [],
};

const locationWithEmptyEnemies: CodexEntry = {
  ...locationWithoutEnemies,
  id: 'loc_empty_cave',
  enemies: [],
};

describe('handleMove', () => {
  it('calls startCombat when new scene has enemies and combat is not active', async () => {
    const combatStore = makeCombatStore({ active: false });
    const combatLoop = makeCombatLoop();
    const sceneManager = makeSceneManager('loc_dark_cave');
    const codexEntries = new Map<string, CodexEntry>([
      ['loc_dark_cave', locationWithEnemies],
    ]);
    const ctx = makeCtx({ sceneManager, combatLoop, combatStore, codexEntries });

    const result = await handleMove({ type: 'move', target: 'north', modifiers: {}, source: 'command' }, ctx);

    expect(combatLoop.startCombat).toHaveBeenCalledWith(['enemy_wolf']);
    expect(result.status).toBe('action_executed');
  });

  it('does NOT call startCombat when combat is already active', async () => {
    const combatStore = makeCombatStore({ active: true });
    const combatLoop = makeCombatLoop();
    const sceneManager = makeSceneManager('loc_dark_cave');
    const codexEntries = new Map<string, CodexEntry>([
      ['loc_dark_cave', locationWithEnemies],
    ]);
    const ctx = makeCtx({ sceneManager, combatLoop, combatStore, codexEntries });

    await handleMove({ type: 'move', target: 'north', modifiers: {}, source: 'command' }, ctx);

    expect(combatLoop.startCombat).not.toHaveBeenCalled();
  });

  it('does NOT call startCombat when new scene has no enemies field', async () => {
    const combatLoop = makeCombatLoop();
    const sceneManager = makeSceneManager('loc_tavern');
    const codexEntries = new Map<string, CodexEntry>([
      ['loc_tavern', locationWithoutEnemies],
    ]);
    const ctx = makeCtx({ sceneManager, combatLoop, codexEntries });

    await handleMove({ type: 'move', target: 'south', modifiers: {}, source: 'command' }, ctx);

    expect(combatLoop.startCombat).not.toHaveBeenCalled();
  });

  it('does NOT call startCombat when enemies is empty array', async () => {
    const combatLoop = makeCombatLoop();
    const sceneManager = makeSceneManager('loc_empty_cave');
    const codexEntries = new Map<string, CodexEntry>([
      ['loc_empty_cave', locationWithEmptyEnemies],
    ]);
    const ctx = makeCtx({ sceneManager, combatLoop, codexEntries });

    await handleMove({ type: 'move', target: 'east', modifiers: {}, source: 'command' }, ctx);

    expect(combatLoop.startCombat).not.toHaveBeenCalled();
  });

  it('returns error and does NOT call startCombat when handleGo fails', async () => {
    const combatLoop = makeCombatLoop();
    const sceneManager = makeSceneManager(null, '出口不存在');
    const ctx = makeCtx({ sceneManager, combatLoop });

    const result = await handleMove({ type: 'move', target: 'west', modifiers: {}, source: 'command' }, ctx);

    expect(result.status).toBe('error');
    expect(combatLoop.startCombat).not.toHaveBeenCalled();
  });

  it('returns error when sceneManager is not present', async () => {
    const ctx = makeCtx({});

    const result = await handleMove({ type: 'move', target: 'north', modifiers: {}, source: 'command' }, ctx);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('场景系统未初始化');
    }
  });
});
