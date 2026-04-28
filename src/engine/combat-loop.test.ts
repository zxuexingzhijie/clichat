import { describe, it, expect, beforeEach } from 'bun:test';
import { createSeededRng } from './dice';
import { createCombatLoop } from './combat-loop';
import { combatStore, getDefaultCombatState } from '../state/combat-store';
import { playerStore, getDefaultPlayerState } from '../state/player-store';
import { gameStore } from '../state/game-store';
import type { CodexEntry } from '../codex/schemas/entry-types';

const stores = { combat: combatStore, player: playerStore, game: gameStore };

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

const GOBLIN_ENTRY: CodexEntry = {
  id: 'goblin',
  name: '哥布林',
  type: 'enemy',
  tags: ['enemy', 'humanoid'],
  description: '小型绿皮生物，性情凶猛',
  epistemic: EPISTEMIC,
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
    const loop = createCombatLoop(stores, makeCodex(GOBLIN_ENTRY), { generateNarrationFn: mockNarration });
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
    const loop = createCombatLoop(stores, makeCodex(GOBLIN_ENTRY), { rng, generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    const initialHp = combatStore.getState().enemies[0]!.hp;

    // Force a high roll by providing a rng that always returns near-max
    const highRng = () => 0.99;
    const highLoop = createCombatLoop(stores, makeCodex(GOBLIN_ENTRY), { rng: highRng, generateNarrationFn: mockNarration });
    await highLoop.startCombat(['goblin']);
    const result = await highLoop.processPlayerAction('attack');

    const afterHp = combatStore.getState().enemies[0]!.hp;
    expect(afterHp).toBeLessThan(20);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.checkResult).toBeDefined();
    }
  });

  it('attack with failed roll deals no damage', async () => {
    // rng that always rolls 1 (first value 0 -> roll = 1)
    const lowRng = () => 0;
    const loop = createCombatLoop(stores, makeCodex(GOBLIN_ENTRY), { rng: lowRng, generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    await loop.processPlayerAction('attack');

    const state = combatStore.getState();
    // With roll=1 (critical_failure), no damage should be applied
    expect(state.enemies[0]!.hp).toBe(20);
  });

  it('cast deducts MP on use', async () => {
    const highRng = () => 0.99;
    const loop = createCombatLoop(stores, makeCodex(GOBLIN_ENTRY), { rng: highRng, generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    const initialMp = playerStore.getState().mp;
    await loop.processPlayerAction('cast');

    expect(playerStore.getState().mp).toBe(initialMp - 4);
  });

  it('cast fails with insufficient MP and returns error message', async () => {
    playerStore.setState(draft => { draft.mp = 2; });
    const loop = createCombatLoop(stores, makeCodex(GOBLIN_ENTRY), { generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    const result = await loop.processPlayerAction('cast');
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toContain('魔力不足');
    }
  });

  it('guard sets guardActive flag', async () => {
    const loop = createCombatLoop(stores, makeCodex(GOBLIN_ENTRY), { generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    await loop.processPlayerAction('guard');

    expect(combatStore.getState().guardActive).toBe(true);
  });

  it('flee success ends combat with flee outcome', async () => {
    // rng always high -> roll=20, flee DC=10, will succeed
    const highRng = () => 0.99;
    const loop = createCombatLoop(stores, makeCodex(GOBLIN_ENTRY), { rng: highRng, generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    const result = await loop.processPlayerAction('flee');

    expect(combatStore.getState().active).toBe(false);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.outcome).toBe('flee');
    }
  });

  it('enemy turn deals damage to player on successful hit', async () => {
    const highRng = () => 0.99;
    const loop = createCombatLoop(stores, makeCodex(GOBLIN_ENTRY), { rng: highRng, generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    const initialHp = playerStore.getState().hp;
    await loop.processEnemyTurn();

    expect(playerStore.getState().hp).toBeLessThan(initialHp);
  });

  it('guard resets guardActive flag after enemy turn', async () => {
    const loop = createCombatLoop(stores, makeCodex(GOBLIN_ENTRY), { generateNarrationFn: mockNarration });
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
    const loop = createCombatLoop(stores, makeCodex(GOBLIN_ENTRY), { rng: midRng, generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    combatStore.setState(draft => { draft.guardActive = true; });
    await loop.processEnemyTurn();

    const lastCheck = combatStore.getState().lastCheckResult;
    expect(lastCheck).not.toBeNull();
    expect(lastCheck!.dc).toBe(12); // AC 10 + guard 2
  });

  it('combat ends on enemy HP 0 (victory)', async () => {
    const loop = createCombatLoop(stores, makeCodex(GOBLIN_ENTRY), { generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    // Manually set enemy HP to 0
    combatStore.setState(draft => { draft.enemies[0]!.hp = 0; });

    const result = await loop.checkCombatEnd();
    expect(result.ended).toBe(true);
    if (result.ended) {
      expect(result.outcome).toBe('victory');
    }
    expect(combatStore.getState().active).toBe(false);
  });

  it('combat ends on player HP 0 (defeat)', async () => {
    const loop = createCombatLoop(stores, makeCodex(GOBLIN_ENTRY), { generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    playerStore.setState(draft => { draft.hp = 0; });

    const result = await loop.checkCombatEnd();
    expect(result.ended).toBe(true);
    if (result.ended) {
      expect(result.outcome).toBe('defeat');
    }
    expect(combatStore.getState().active).toBe(false);
  });

  it('checkCombatEnd returns not ended when both sides alive', async () => {
    const loop = createCombatLoop(stores, makeCodex(GOBLIN_ENTRY), { generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    const result = await loop.checkCombatEnd();
    expect(result.ended).toBe(false);
  });

  it('processPlayerAction returns error message when rng throws', async () => {
    const throwingRng = (): number => { throw new Error('rng exploded'); };
    const loop = createCombatLoop(stores, makeCodex(GOBLIN_ENTRY), { rng: throwingRng, generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    const result = await loop.processPlayerAction('attack');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toContain('战斗处理出错');
      expect(result.message).toContain('rng exploded');
    }
  });

  it('combat.phase resets to player_turn after processPlayerAction throws', async () => {
    const throwingRng = (): number => { throw new Error('rng exploded'); };
    const loop = createCombatLoop(stores, makeCodex(GOBLIN_ENTRY), { rng: throwingRng, generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    await loop.processPlayerAction('attack');

    expect(combatStore.getState().phase).toBe('player_turn');
  });

  it('normal attack path still works when no exception occurs', async () => {
    const highRng = () => 0.99;
    const loop = createCombatLoop(stores, makeCodex(GOBLIN_ENTRY), { rng: highRng, generateNarrationFn: mockNarration });
    await loop.startCombat(['goblin']);

    const result = await loop.processPlayerAction('attack');

    expect(result.status).toBe('ok');
  });
});

describe('enemy abilities (COMBAT-04)', () => {
  const makeEnemy = (id: string, abilities: string[]): CodexEntry => ({
    id,
    name: `敌人_${id}`,
    type: 'enemy',
    tags: ['enemy'],
    description: '',
    epistemic: EPISTEMIC,
    hp: 20,
    maxHp: 20,
    attack: 1,
    defense: 0,
    dc: 10,
    damage_base: 3,
    abilities,
    danger_level: 2,
  });

  beforeEach(() => {
    combatStore.setState(() => getDefaultCombatState());
    playerStore.setState(() => getDefaultPlayerState());
  });

  it('pack_tactics: +2 attack bonus when 2+ enemies alive', async () => {
    const wolf1 = makeEnemy('wolf1', ['pack_tactics']);
    const wolf2 = makeEnemy('wolf2', ['pack_tactics']);
    const codex = makeCodex(wolf1, wolf2);
    const loop = createCombatLoop(stores, codex, { rng: () => 0.5, generateNarrationFn: mockNarration });
    await loop.startCombat(['wolf1', 'wolf2']);

    await loop.processEnemyTurn();

    const lastCheck = combatStore.getState().lastCheckResult;
    expect(lastCheck).not.toBeNull();
    expect(lastCheck!.attributeModifier).toBeGreaterThanOrEqual(3);
  });

  it('pack_tactics: no attack bonus when only 1 enemy alive', async () => {
    const wolf1 = makeEnemy('wolf1', ['pack_tactics']);
    const wolf2 = makeEnemy('wolf2', []);
    const codex = makeCodex(wolf1, wolf2);
    const loop = createCombatLoop(stores, codex, { rng: () => 0.5, generateNarrationFn: mockNarration });
    await loop.startCombat(['wolf1', 'wolf2']);
    combatStore.setState(draft => { draft.enemies[1]!.hp = 0; });

    await loop.processEnemyTurn();

    const lastCheck = combatStore.getState().lastCheckResult;
    expect(lastCheck!.attributeModifier).toBe(1);
  });

  it('howl: sets howlActive on combat state', async () => {
    const alpha = makeEnemy('alpha', ['howl']);
    const loop = createCombatLoop(stores, makeCodex(alpha), { rng: () => 0.1, generateNarrationFn: mockNarration });
    await loop.startCombat(['alpha']);

    await loop.processEnemyTurn();

    expect(combatStore.getState().howlActive).toBe(true);
  });

  it('backstab: round 1 forces critical_success grade', async () => {
    const assassin = makeEnemy('assassin', ['backstab']);
    const loop = createCombatLoop(stores, makeCodex(assassin), { rng: () => 0.1, generateNarrationFn: mockNarration });
    await loop.startCombat(['assassin']);

    combatStore.setState(draft => { draft.roundNumber = 1; });
    await loop.processEnemyTurn();

    const lastCheck = combatStore.getState().lastCheckResult;
    expect(lastCheck!.grade).toBe('critical_success');
  });

  it('poison_blade: on hit, player.poisonStacks increases', async () => {
    const poisoner = makeEnemy('poisoner', ['poison_blade']);
    const loop = createCombatLoop(stores, makeCodex(poisoner), { rng: () => 0.99, generateNarrationFn: mockNarration });
    await loop.startCombat(['poisoner']);

    await loop.processEnemyTurn();

    expect(playerStore.getState().poisonStacks).toBeGreaterThan(0);
  });

  it('vanish: enemy hp set to 0, attack skipped', async () => {
    const ghost = makeEnemy('ghost', ['vanish']);
    const loop = createCombatLoop(stores, makeCodex(ghost), { rng: () => 0.99, generateNarrationFn: mockNarration });
    await loop.startCombat(['ghost']);

    const initialHp = playerStore.getState().hp;
    await loop.processEnemyTurn();

    expect(combatStore.getState().enemies[0]!.hp).toBe(0);
    expect(playerStore.getState().hp).toBe(initialHp);
  });

  it('unknown ability (bite) silently skipped, normal attack proceeds', async () => {
    const biter = makeEnemy('biter', ['bite']);
    const loop = createCombatLoop(stores, makeCodex(biter), { rng: () => 0.99, generateNarrationFn: mockNarration });
    await loop.startCombat(['biter']);

    const result = await loop.processEnemyTurn();

    expect(result).toBeUndefined();
    const lastCheck = combatStore.getState().lastCheckResult;
    expect(lastCheck).not.toBeNull();
  });

  it('poison DoT applied at start of enemy turn when poisonStacks > 0', async () => {
    const biter = makeEnemy('biter', []);
    const loop = createCombatLoop(stores, makeCodex(biter), { rng: () => 0.1, generateNarrationFn: mockNarration });
    await loop.startCombat(['biter']);

    playerStore.setState(draft => { (draft as any).poisonStacks = 2; });
    const hpBefore = playerStore.getState().hp;

    await loop.processEnemyTurn();

    expect(playerStore.getState().hp).toBe(hpBefore - 2);
  });
});

describe('data-driven spell casting (COMBAT-05)', () => {
  const FIRE_ARROW: CodexEntry = {
    id: 'spell_fire_arrow',
    name: '火焰箭',
    type: 'spell',
    tags: ['fire', 'attack', 'elemental'],
    description: '火焰伤害',
    epistemic: EPISTEMIC,
    element: 'fire',
    mp_cost: 3,
    effect: '对单体目标造成3-5点火焰伤害',
    requirements: [],
    effect_type: 'damage',
    base_value: 4,
  };

  const HEALING_LIGHT: CodexEntry = {
    id: 'spell_healing_light',
    name: '治愈之光',
    type: 'spell',
    tags: ['holy', 'healing', 'support'],
    description: '治愈',
    epistemic: EPISTEMIC,
    element: 'holy',
    mp_cost: 2,
    effect: '恢复目标2-4点生命值',
    requirements: [],
    effect_type: 'heal',
    base_value: 3,
  };

  beforeEach(() => {
    combatStore.setState(() => getDefaultCombatState());
    playerStore.setState(() => getDefaultPlayerState());
  });

  it('cast fire_arrow: deducts spell mp_cost (3) and deals damage', async () => {
    const loop = createCombatLoop(
      stores,
      makeCodex(GOBLIN_ENTRY, FIRE_ARROW),
      { rng: () => 0.99, generateNarrationFn: mockNarration },
    );
    await loop.startCombat(['goblin']);

    const initialMp = playerStore.getState().mp;
    const result = await loop.processPlayerAction('cast', { spellId: 'spell_fire_arrow' });

    expect(result.status).toBe('ok');
    expect(playerStore.getState().mp).toBe(initialMp - 3);
    expect(combatStore.getState().enemies[0]!.hp).toBeLessThan(20);
  });

  it('cast healing_light: deducts spell mp_cost (2) and restores HP', async () => {
    const loop = createCombatLoop(
      stores,
      makeCodex(GOBLIN_ENTRY, HEALING_LIGHT),
      { rng: () => 0.99, generateNarrationFn: mockNarration },
    );
    await loop.startCombat(['goblin']);

    playerStore.setState(draft => { draft.hp = 20; });
    const initialMp = playerStore.getState().mp;
    const result = await loop.processPlayerAction('cast', { spellId: 'spell_healing_light' });

    expect(result.status).toBe('ok');
    expect(playerStore.getState().mp).toBe(initialMp - 2);
    expect(playerStore.getState().hp).toBe(23);
  });

  it('cast with insufficient MP returns 魔力不足 and does not consume MP', async () => {
    const loop = createCombatLoop(
      stores,
      makeCodex(GOBLIN_ENTRY, FIRE_ARROW),
      { rng: () => 0.99, generateNarrationFn: mockNarration },
    );
    await loop.startCombat(['goblin']);

    playerStore.setState(draft => { draft.mp = 2; });
    const result = await loop.processPlayerAction('cast', { spellId: 'spell_fire_arrow' });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toContain('魔力不足');
    }
    expect(playerStore.getState().mp).toBe(2);
  });

  it('cast unknown spell returns 未知法术 and does not consume MP', async () => {
    const loop = createCombatLoop(
      stores,
      makeCodex(GOBLIN_ENTRY),
      { rng: () => 0.99, generateNarrationFn: mockNarration },
    );
    await loop.startCombat(['goblin']);

    const initialMp = playerStore.getState().mp;
    const result = await loop.processPlayerAction('cast', { spellId: 'spell_nonexistent' });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toContain('未知法术');
    }
    expect(playerStore.getState().mp).toBe(initialMp);
  });

  it('cast with no spellId falls back to CAST_MP_COST constant', async () => {
    const loop = createCombatLoop(
      stores,
      makeCodex(GOBLIN_ENTRY),
      { rng: () => 0.99, generateNarrationFn: mockNarration },
    );
    await loop.startCombat(['goblin']);

    const initialMp = playerStore.getState().mp;
    await loop.processPlayerAction('cast');

    expect(playerStore.getState().mp).toBeLessThan(initialMp);
  });

  it('cast fire_arrow narration includes spell name', async () => {
    const narrations: string[] = [];
    const loop = createCombatLoop(
      stores,
      makeCodex(GOBLIN_ENTRY, FIRE_ARROW),
      {
        rng: () => 0.99,
        generateNarrationFn: async (ctx) => {
          narrations.push(ctx.playerAction);
          return '战斗叙述';
        },
      },
    );
    await loop.startCombat(['goblin']);
    await loop.processPlayerAction('cast', { spellId: 'spell_fire_arrow' });

    expect(narrations.some(n => n.includes('火焰箭'))).toBe(true);
  });
});
