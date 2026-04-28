import { describe, it, expect, mock } from 'bun:test';
import { handleCombat } from './combat-handler';
import type { ActionContext } from './types';
import type { CombatLoop } from '../combat-loop';
import { createStore } from '../../state/create-store';
import type { CombatState } from '../../state/combat-store';
import { getDefaultCombatState } from '../../state/combat-store';

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

function makeCtx(combatLoop: CombatLoop | undefined, combatStore: ReturnType<typeof makeCombatStore>): ActionContext {
  return {
    combatLoop,
    stores: {
      combat: combatStore,
    },
  } as unknown as ActionContext;
}

describe('handleCombat', () => {
  it('does NOT call processEnemyTurn when processPlayerAction returns ok', async () => {
    const combatStore = makeCombatStore({ lastNarration: '攻击成功', lastCheckResult: null });
    const combatLoop = makeCombatLoop({
      processPlayerAction: mock(async () => ({ status: 'ok' as const, narration: '攻击成功' })),
    });
    const ctx = makeCtx(combatLoop, combatStore);

    await handleCombat({ type: 'attack', target: null, modifiers: {}, source: 'command' }, ctx);

    expect(combatLoop.processEnemyTurn).not.toHaveBeenCalled();
  });

  it('does NOT call processEnemyTurn when processPlayerAction returns error', async () => {
    const combatStore = makeCombatStore();
    const combatLoop = makeCombatLoop({
      processPlayerAction: mock(async () => ({ status: 'error' as const, message: '无效行动' })),
    });
    const ctx = makeCtx(combatLoop, combatStore);

    await handleCombat({ type: 'attack', target: null, modifiers: {}, source: 'command' }, ctx);

    expect(combatLoop.processEnemyTurn).not.toHaveBeenCalled();
  });

  it('returns action_executed status with narration from combat store', async () => {
    const combatStore = makeCombatStore({ lastNarration: '命中！', lastCheckResult: null });
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
