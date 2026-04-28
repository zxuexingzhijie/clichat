import { describe, it, expect, mock } from 'bun:test';
import { handleCombat } from './combat-handler';
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
    processPlayerAction: mock(async () => ({ status: 'ok' as const, narration: '攻击' })),
    processEnemyTurn: mock(async () => {}),
    checkCombatEnd: mock(async () => ({ ended: false as const })),
    getCombatPhase: mock(() => 'player_turn'),
    ...overrides,
  };
}

function makeCtx(
  combatLoop: CombatLoop | undefined,
  combatStore: ReturnType<typeof makeCombatStore>,
  codexEntries?: Map<string, CodexEntry>,
): ActionContext {
  return {
    combatLoop,
    codexEntries,
    stores: {
      combat: combatStore,
    },
  } as unknown as ActionContext;
}

const enemyEntry: CodexEntry = {
  id: 'enemy_wolf',
  name: '狼',
  type: 'enemy',
  tags: ['beast'],
  description: '一只饥饿的狼',
  epistemic: validEpistemic,
  hp: 10,
  maxHp: 10,
  attack: 5,
  defense: 2,
  dc: 12,
  damage_base: 3,
  abilities: [],
  danger_level: 3,
};

const npcEntry: CodexEntry = {
  id: 'npc_bartender',
  name: '酒馆老板',
  type: 'npc',
  tags: ['merchant'],
  description: '友善的酒馆老板',
  epistemic: validEpistemic,
  location_id: 'loc_tavern',
  personality_tags: ['friendly'],
  goals: ['run_business'],
  backstory: '继承了父亲的酒馆',
  initial_disposition: 0.3,
};

describe('handleCombat — existing in-combat behavior', () => {
  it('does NOT call processEnemyTurn when processPlayerAction returns ok', async () => {
    const combatStore = makeCombatStore({ active: true, lastNarration: '攻击成功', lastCheckResult: null });
    const combatLoop = makeCombatLoop({
      processPlayerAction: mock(async () => ({ status: 'ok' as const, narration: '攻击成功' })),
    });
    const ctx = makeCtx(combatLoop, combatStore);

    await handleCombat({ type: 'attack', target: null, modifiers: {}, source: 'command' }, ctx);

    expect(combatLoop.processEnemyTurn).not.toHaveBeenCalled();
  });

  it('does NOT call processEnemyTurn when processPlayerAction returns error', async () => {
    const combatStore = makeCombatStore({ active: true });
    const combatLoop = makeCombatLoop({
      processPlayerAction: mock(async () => ({ status: 'error' as const, message: '无效行动' })),
    });
    const ctx = makeCtx(combatLoop, combatStore);

    await handleCombat({ type: 'attack', target: null, modifiers: {}, source: 'command' }, ctx);

    expect(combatLoop.processEnemyTurn).not.toHaveBeenCalled();
  });

  it('returns action_executed status with narration from combat store', async () => {
    const combatStore = makeCombatStore({ active: true, lastNarration: '命中！', lastCheckResult: null });
    const combatLoop = makeCombatLoop({
      processPlayerAction: mock(async () => ({ status: 'ok' as const, narration: '命中！' })),
    });
    const ctx = makeCtx(combatLoop, combatStore);

    const result = await handleCombat({ type: 'attack', target: null, modifiers: {}, source: 'command' }, ctx);

    expect(result.status).toBe('action_executed');
    if (result.status === 'action_executed') {
      expect(result.narration).toContain('命中！');
    }
  });

  it('returns error when combatLoop is not present', async () => {
    const combatStore = makeCombatStore();
    const ctx = makeCtx(undefined, combatStore);

    const result = await handleCombat({ type: 'attack', target: null, modifiers: {}, source: 'command' }, ctx);

    expect(result.status).toBe('error');
  });
});

describe('handleCombat — explicit :attack NPC initiation (COMBAT-03)', () => {
  it('calls startCombat when target is an enemy type and combat not active', async () => {
    const combatStore = makeCombatStore({ active: false });
    const combatLoop = makeCombatLoop();
    const codexEntries = new Map<string, CodexEntry>([['enemy_wolf', enemyEntry]]);
    const ctx = makeCtx(combatLoop, combatStore, codexEntries);

    const result = await handleCombat(
      { type: 'attack', target: 'enemy_wolf', modifiers: {}, source: 'command' },
      ctx,
    );

    expect(combatLoop.startCombat).toHaveBeenCalledWith(['enemy_wolf']);
    expect(result.status).toBe('action_executed');
  });

  it('returns error when target is npc type (not enemy)', async () => {
    const combatStore = makeCombatStore({ active: false });
    const combatLoop = makeCombatLoop();
    const codexEntries = new Map<string, CodexEntry>([['npc_bartender', npcEntry]]);
    const ctx = makeCtx(combatLoop, combatStore, codexEntries);

    const result = await handleCombat(
      { type: 'attack', target: 'npc_bartender', modifiers: {}, source: 'command' },
      ctx,
    );

    expect(combatLoop.startCombat).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('该目标无法发起战斗。');
    }
  });

  it('uses processPlayerAction (in-combat flow) when combat is already active, even with enemy target', async () => {
    const combatStore = makeCombatStore({ active: true, lastNarration: '攻击', lastCheckResult: null });
    const combatLoop = makeCombatLoop();
    const codexEntries = new Map<string, CodexEntry>([['enemy_wolf', enemyEntry]]);
    const ctx = makeCtx(combatLoop, combatStore, codexEntries);

    await handleCombat(
      { type: 'attack', target: 'enemy_wolf', modifiers: {}, source: 'command' },
      ctx,
    );

    expect(combatLoop.startCombat).not.toHaveBeenCalled();
    expect(combatLoop.processPlayerAction).toHaveBeenCalled();
  });

  it('uses processPlayerAction when no target (in-combat flow)', async () => {
    const combatStore = makeCombatStore({ active: true, lastNarration: '攻击', lastCheckResult: null });
    const combatLoop = makeCombatLoop();
    const ctx = makeCtx(combatLoop, combatStore);

    await handleCombat(
      { type: 'attack', target: null, modifiers: {}, source: 'command' },
      ctx,
    );

    expect(combatLoop.processPlayerAction).toHaveBeenCalled();
    expect(combatLoop.startCombat).not.toHaveBeenCalled();
  });
});
