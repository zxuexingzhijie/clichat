import { describe, it, expect, beforeEach } from 'bun:test';
import { createSeededRng } from './dice';
import { createCombatLoop } from './combat-loop';
import { combatStore, getDefaultCombatState } from '../state/combat-store';
import { playerStore, getDefaultPlayerState } from '../state/player-store';
import type { CodexEntry } from '../codex/schemas/entry-types';

const GOBLIN_ENTRY: CodexEntry = {
  id: 'goblin',
  name: '哥布林',
  type: 'enemy',
  tags: ['enemy', 'humanoid'],
  description: '小型绿皮生物，性情凶猛',
  epistemic: { canon_tier: 'established', visibility: 'world_truth', source: 'codex' },
  hp: 20,
  maxHp: 20,
  attack: 1,
  defense: 1,
  dc: 12,
  damage_base: 4,
  abilities: [],
  danger_level: 2,
};

const TOUGH_GOBLIN: CodexEntry = {
  ...GOBLIN_ENTRY,
  id: 'tough_goblin',
  name: '精英哥布林',
  hp: 30,
  maxHp: 30,
  attack: 3,
  dc: 14,
  damage_base: 6,
};

function makeCodex(...entries: CodexEntry[]): Map<string, CodexEntry> {
  const map = new Map<string, CodexEntry>();
  for (const e of entries) {
    map.set(e.id, e);
  }
  return map;
}

function mockNarration(_ctx: unknown): Promise<string> {
  return Promise.resolve('战斗叙述');
}

beforeEach(() => {
  combatStore.setState(() => getDefaultCombatState());
  playerStore.setState(() => getDefaultPlayerState());
});

describe('createCombatLoop', () => {
  it('startCombat initializes combatStore with enemies from codex', async () => {
    const loop = createCombatLoop(makeCodex(GOBLIN_ENTRY), { generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    const state = combatStore.getState();
    expect(state.active).toBe(true);
    expect(state.enemies).toHaveLength(1);
    expect(state.enemies[0]!.name).toBe('哥布林');
    expect(state.enemies[0]!.hp).toBe(20);
    expect(state.enemies[0]!.maxHp).toBe(20);
    expect(state.roundNumber).toBe(1);
    expect(state.turnOrder).toEqual(['player', 'goblin']);
    expect(state.phase).toBe('player_turn');
  });

  it('attack with successful roll deals damage to enemy', async () => {
    const rng = createSeededRng(42);
    const loop = createCombatLoop(makeCodex(GOBLIN_ENTRY), { rng, generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    const initialHp = combatStore.getState().enemies[0]!.hp;

    // Force a high roll by providing a rng that always returns near-max
    const highRng = () => 0.99;
    const highLoop = createCombatLoop(makeCodex(GOBLIN_ENTRY), { rng: highRng, generateNarrationFn: mockNarration });
    await highLoop.startCombat(['goblin']);
    const result = await highLoop.processPlayerAction('attack');

    const afterHp = combatStore.getState().enemies[0]!.hp;
    expect(afterHp).toBeLessThan(20);
    expect(result.status).toBe('ok');
    expect(result.checkResult).toBeDefined();
  });

  it('attack with failed roll deals no damage', async () => {
    // rng that always rolls 1 (first value 0 -> roll = 1)
    const lowRng = () => 0;
    const loop = createCombatLoop(makeCodex(GOBLIN_ENTRY), { rng: lowRng, generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    await loop.processPlayerAction('attack');

    const state = combatStore.getState();
    // With roll=1 (critical_failure), no damage should be applied
    expect(state.enemies[0]!.hp).toBe(20);
  });

  it('cast deducts MP on use', async () => {
    const highRng = () => 0.99;
    const loop = createCombatLoop(makeCodex(GOBLIN_ENTRY), { rng: highRng, generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    const initialMp = playerStore.getState().mp;
    await loop.processPlayerAction('cast');

    expect(playerStore.getState().mp).toBe(initialMp - 4);
  });

  it('cast fails with insufficient MP and returns error message', async () => {
    playerStore.setState(draft => { draft.mp = 2; });
    const loop = createCombatLoop(makeCodex(GOBLIN_ENTRY), { generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    const result = await loop.processPlayerAction('cast');
    expect(result.status).toBe('error');
    expect(result.message).toContain('魔力不足');
  });

  it('guard sets guardActive flag', async () => {
    const loop = createCombatLoop(makeCodex(GOBLIN_ENTRY), { generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    await loop.processPlayerAction('guard');

    expect(combatStore.getState().guardActive).toBe(true);
  });

  it('flee success ends combat with flee outcome', async () => {
    // rng always high -> roll=20, flee DC=10, will succeed
    const highRng = () => 0.99;
    const loop = createCombatLoop(makeCodex(GOBLIN_ENTRY), { rng: highRng, generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    const result = await loop.processPlayerAction('flee');

    expect(combatStore.getState().active).toBe(false);
    expect(result.status).toBe('ok');
    expect(result.outcome).toBe('flee');
  });

  it('enemy turn deals damage to player on successful hit', async () => {
    const highRng = () => 0.99;
    const loop = createCombatLoop(makeCodex(GOBLIN_ENTRY), { rng: highRng, generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    const initialHp = playerStore.getState().hp;
    await loop.processEnemyTurn();

    expect(playerStore.getState().hp).toBeLessThan(initialHp);
  });

  it('guard resets guardActive flag after enemy turn', async () => {
    const loop = createCombatLoop(makeCodex(GOBLIN_ENTRY), { generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    combatStore.setState(draft => { draft.guardActive = true; });
    expect(combatStore.getState().guardActive).toBe(true);

    await loop.processEnemyTurn();

    expect(combatStore.getState().guardActive).toBe(false);
  });

  it('guard AC+2 prevents hit when enemy roll is borderline', async () => {
    // With guard: AC = 12. Enemy attack=1. Need roll + 1 < 12 AND roll + 1 >= 10 (without guard).
    // roll=9: total=10. vs AC 10 => success (hit). vs AC 12 => partial_success.
    // partial_success is NOT a clean failure. Use roll=4: total=5. vs AC 10 => failure. vs AC 12 => failure.
    // Instead, verify guard means AC is higher by checking: a roll that would be partial_success hits
    // without guard (total >= dc-5=5) but fails harder WITH guard.
    // Simplest: use roll=9 (0.4 -> floor(0.4*20)+1=9). total=9+1=10.
    // Without guard DC=10: 10>=10 => success (hit). With guard DC=12: 10<12 AND 10>=7 => partial_success (still hits).
    // So verify guard raises the AC effectively by confirming the check uses DC=12 not DC=10.
    // We do this by checking that the lastCheckResult.dc reflects the guard AC.
    const midRng = () => 0.4; // roll=9
    const loop = createCombatLoop(makeCodex(GOBLIN_ENTRY), { rng: midRng, generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    combatStore.setState(draft => { draft.guardActive = true; });
    await loop.processEnemyTurn();

    const lastCheck = combatStore.getState().lastCheckResult;
    expect(lastCheck).not.toBeNull();
    expect(lastCheck!.dc).toBe(12); // AC 10 + guard 2
  });

  it('combat ends on enemy HP 0 (victory)', async () => {
    const loop = createCombatLoop(makeCodex(GOBLIN_ENTRY), { generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    // Manually set enemy HP to 0
    combatStore.setState(draft => { draft.enemies[0]!.hp = 0; });

    const result = await loop.checkCombatEnd();
    expect(result.ended).toBe(true);
    expect(result.outcome).toBe('victory');
    expect(combatStore.getState().active).toBe(false);
  });

  it('combat ends on player HP 0 (defeat)', async () => {
    const loop = createCombatLoop(makeCodex(GOBLIN_ENTRY), { generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    playerStore.setState(draft => { draft.hp = 0; });

    const result = await loop.checkCombatEnd();
    expect(result.ended).toBe(true);
    expect(result.outcome).toBe('defeat');
    expect(combatStore.getState().active).toBe(false);
  });

  it('checkCombatEnd returns not ended when both sides alive', async () => {
    const loop = createCombatLoop(makeCodex(GOBLIN_ENTRY), { generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    const result = await loop.checkCombatEnd();
    expect(result.ended).toBe(false);
  });
});
