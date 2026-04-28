import { resolveNormalCheck } from './adjudication';
import { GAME_CONSTANTS } from './game-constants';
import { calculateDamage } from './damage';
import { rollD20 } from './dice';
import type { Store } from '../state/create-store';
import type { CombatState } from '../state/combat-store';
import type { PlayerState } from '../state/player-store';
import type { GameState } from '../state/game-store';
import type { CheckResult } from '../types/common';
import type { CodexEntry, Enemy } from '../codex/schemas/entry-types';
import type { NarrativeContext } from '../ai/roles/narrative-director';

export type CombatActionType = 'attack' | 'cast' | 'guard' | 'use_item' | 'flee';

export type CombatActionOptions = {
  readonly targetIndex?: number;
};

export type CombatActionResult =
  | { readonly status: 'ok'; readonly checkResult?: CheckResult; readonly narration: string; readonly outcome?: 'flee' | 'victory' | 'defeat' }
  | { readonly status: 'error'; readonly message: string };

export type CombatEndResult =
  | { readonly ended: true; readonly outcome: 'victory' | 'defeat' | 'flee'; readonly narration: string }
  | { readonly ended: false };

export interface CombatLoop {
  readonly startCombat: (enemyIds: string[]) => Promise<void>;
  readonly processPlayerAction: (actionType: CombatActionType, options?: CombatActionOptions) => Promise<CombatActionResult>;
  readonly processEnemyTurn: () => Promise<void>;
  readonly checkCombatEnd: () => Promise<CombatEndResult>;
  readonly getCombatPhase: () => string;
}

export type CombatLoopOptions = {
  readonly rng?: () => number;
  readonly generateNarrationFn?: (context: NarrativeContext) => Promise<string>;
};

const FALLBACK_NARRATION = '战斗继续......';

function getPlayerAC(): number {
  return GAME_CONSTANTS.BASE_AC;
}

export function createCombatLoop(
  stores: {
    combat: Store<CombatState>;
    player: Store<PlayerState>;
    game: Store<GameState>;
  },
  codexEntries: Map<string, CodexEntry>,
  options?: CombatLoopOptions,
): CombatLoop {
  function getFirstAliveEnemyIndex(): number {
    const enemies = stores.combat.getState().enemies;
    return enemies.findIndex(e => e.hp > 0);
  }

  function allEnemiesDead(): boolean {
    return stores.combat.getState().enemies.every(e => e.hp <= 0);
  }
  const rng = options?.rng;
  const generateNarrationFn = options?.generateNarrationFn;

  async function doGenerateNarration(playerAction: string, checkResult?: CheckResult): Promise<string> {
    if (!generateNarrationFn) return FALLBACK_NARRATION;
    try {
      const context: NarrativeContext = {
        sceneType: 'combat',
        codexEntries: [],
        checkResult,
        playerAction,
        recentNarration: stores.combat.getState().lastNarration ? [stores.combat.getState().lastNarration] : [],
        sceneContext: '战斗中',
      };
      return await generateNarrationFn(context);
    } catch {
      return FALLBACK_NARRATION;
    }
  }

  async function startCombat(enemyIds: string[]): Promise<void> {
    const enemies = enemyIds.map(id => {
      const entry = codexEntries.get(id);
      if (!entry || entry.type !== 'enemy') {
        return { id, name: '未知敌人', hp: 10, maxHp: 10 };
      }
      const enemy = entry as Enemy;
      return { id, name: enemy.name, hp: enemy.maxHp, maxHp: enemy.maxHp };
    });

    stores.combat.setState(draft => {
      draft.active = true;
      draft.phase = 'player_turn';
      draft.enemies = enemies;
      draft.turnOrder = ['player', ...enemyIds];
      draft.roundNumber = 1;
      draft.currentTurnIndex = 0;
      draft.lastCheckResult = null;
      draft.lastNarration = '';
      draft.guardActive = false;
      draft.outcome = null;
    });

    stores.game.setState(draft => {
      draft.phase = 'combat';
    });

    const narration = await doGenerateNarration('战斗开始');
    stores.combat.setState(draft => {
      draft.lastNarration = narration;
    });
  }

  async function processPlayerAction(
    actionType: CombatActionType,
    options?: CombatActionOptions,
  ): Promise<CombatActionResult> {
    stores.combat.setState(draft => {
      draft.phase = 'resolving';
    });
    try {

    const player = stores.player.getState();
    const targetIdx = options?.targetIndex ?? getFirstAliveEnemyIndex();
    const enemies = stores.combat.getState().enemies;
    const target = enemies[targetIdx >= 0 ? targetIdx : 0];

    if (!target || target.hp <= 0) {
      return { status: 'error', message: '没有可攻击的目标！' };
    }

    const enemyEntry = codexEntries.get(target.id);
    const enemy = enemyEntry?.type === 'enemy' ? (enemyEntry as Enemy) : null;
    const enemyDc = enemy?.dc ?? GAME_CONSTANTS.DEFAULT_DC;
    const enemyDefense = enemy?.defense ?? 0;

    if (actionType === 'use_item') {
      stores.combat.setState(draft => { draft.phase = 'player_turn'; });
      return { status: 'error', message: '背包里没有可用的物品。' };
    }

    if (actionType === 'guard') {
      stores.combat.setState(draft => {
        draft.guardActive = true;
        draft.phase = 'narrating';
      });
      const narration = await doGenerateNarration('防御');
      stores.combat.setState(draft => {
        draft.lastNarration = narration;
        draft.phase = 'enemy_turn';
      });
      return { status: 'ok', narration };
    }

    if (actionType === 'cast') {
      if (player.mp < GAME_CONSTANTS.CAST_MP_COST) {
        stores.combat.setState(draft => {
          draft.phase = 'player_turn';
        });
        return { status: 'error', message: '魔力不足！无法施法。' };
      }
      stores.player.setState(draft => {
        draft.mp = draft.mp - GAME_CONSTANTS.CAST_MP_COST;
      });
    }

    let attributeName: 'physique' | 'finesse' | 'mind';
    if (actionType === 'attack') {
      attributeName = 'physique';
    } else if (actionType === 'cast') {
      attributeName = 'mind';
    } else {
      attributeName = 'finesse';
    }

    const attrMod = player.attributes[attributeName] ?? 0;
    const roll = rollD20(rng);

    const checkResult = resolveNormalCheck({
      roll,
      attributeName,
      attributeModifier: attrMod,
      skillModifier: 0,
      environmentModifier: 0,
      dc: actionType === 'flee' ? GAME_CONSTANTS.FLEE_DC : enemyDc,
    });

    stores.combat.setState(draft => {
      draft.lastCheckResult = checkResult;
    });

    const isSuccess = checkResult.grade !== 'failure' && checkResult.grade !== 'critical_failure';

    if (actionType === 'flee') {
      if (isSuccess) {
        stores.combat.setState(draft => {
          draft.outcome = 'flee';
          draft.active = false;
          draft.phase = 'ended';
          draft.lastNarration = '你成功逃脱了战斗！';
        });
        stores.game.setState(draft => {
          draft.phase = 'game';
        });
        return { status: 'ok', checkResult, narration: '你成功逃脱了战斗！', outcome: 'flee' };
      }
    }

    if (isSuccess && (actionType === 'attack' || actionType === 'cast')) {
      const weaponBase = actionType === 'attack'
        ? getWeaponBase(player.equipment, codexEntries)
        : GAME_CONSTANTS.CAST_WEAPON_BASE;
      const damage = calculateDamage({
        weaponBase,
        attributeModifier: attrMod,
        grade: checkResult.grade,
        armorReduction: enemyDefense,
      });

      const newHp = Math.max(0, target.hp - damage.total);
      stores.combat.setState(draft => {
        const idx = draft.enemies.findIndex(e => e.id === target.id);
        if (idx >= 0) {
          draft.enemies[idx]!.hp = newHp;
        }
      });
    }

    stores.combat.setState(draft => {
      draft.phase = 'narrating';
    });

    const actionLabel = actionType === 'attack' ? '攻击' : actionType === 'cast' ? '施法' : '逃跑';
    const narration = await doGenerateNarration(actionLabel, checkResult);

    stores.combat.setState(draft => {
      draft.lastNarration = narration;
      draft.phase = 'enemy_turn';
    });

    const endResult = await checkCombatEnd();
    if (endResult.ended) {
      return { status: 'ok', checkResult, narration, outcome: endResult.outcome };
    }

    return { status: 'ok', checkResult, narration };
    } catch (err: unknown) {
      stores.combat.setState(draft => {
        draft.phase = 'player_turn';
      });
      const msg = err instanceof Error ? err.message : String(err);
      return { status: 'error', message: `战斗处理出错: ${msg}` };
    }
  }

  async function processEnemyTurn(): Promise<void> {
    const state = stores.combat.getState();
    const player = stores.player.getState();
    const guardActive = state.guardActive;
    const playerAC = getPlayerAC() + (guardActive ? GAME_CONSTANTS.GUARD_AC_BONUS : 0);

    stores.combat.setState(draft => {
      draft.guardActive = false;
    });

    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) continue;

      const enemyEntry = codexEntries.get(enemy.id);
      const enemyData = enemyEntry?.type === 'enemy' ? (enemyEntry as Enemy) : null;
      const enemyAttackMod = enemyData?.attack ?? 0;
      const enemyDamageBase = enemyData?.damage_base ?? 3;

      stores.combat.setState(draft => {
        draft.phase = 'resolving';
      });

      const roll = rollD20(rng);
      const checkResult = resolveNormalCheck({
        roll,
        attributeName: 'physique',
        attributeModifier: enemyAttackMod,
        skillModifier: 0,
        environmentModifier: 0,
        dc: playerAC,
      });

      stores.combat.setState(draft => {
        draft.lastCheckResult = checkResult;
      });

      const isHit = checkResult.grade !== 'failure' && checkResult.grade !== 'critical_failure';

      if (isHit) {
        const damage = calculateDamage({
          weaponBase: enemyDamageBase,
          attributeModifier: enemyAttackMod,
          grade: checkResult.grade,
          armorReduction: 0,
        });

        const newHp = Math.max(0, player.hp - damage.total);
        stores.player.setState(draft => {
          draft.hp = newHp;
        });
      }

      stores.combat.setState(draft => {
        draft.phase = 'narrating';
      });

      const actionLabel = `${enemy.name}攻击`;
      const narration = await doGenerateNarration(actionLabel, checkResult);
      stores.combat.setState(draft => {
        draft.lastNarration = narration;
      });
    }

    stores.combat.setState(draft => {
      draft.phase = 'check_end';
    });

    const endResult = await checkCombatEnd();
    if (!endResult.ended) {
      stores.combat.setState(draft => {
        draft.phase = 'player_turn';
        draft.roundNumber += 1;
      });
    }
  }

  async function checkCombatEnd(): Promise<CombatEndResult> {
    const player = stores.player.getState();

    if (allEnemiesDead()) {
      const narration = stores.combat.getState().enemies
        .map(e => `${e.name}被击败了。`)
        .join('') + '战斗胜利！';

      stores.combat.setState(draft => {
        draft.outcome = 'victory';
        draft.active = false;
        draft.phase = 'ended';
        draft.lastNarration = narration;
      });
      stores.game.setState(draft => {
        draft.phase = 'game';
      });
      return { ended: true, outcome: 'victory', narration };
    }

    if (player.hp <= 0) {
      const narration = '你倒下了...... 世界在眼前逐渐模糊。';
      stores.combat.setState(draft => {
        draft.outcome = 'defeat';
        draft.active = false;
        draft.phase = 'ended';
        draft.lastNarration = narration;
      });
      stores.game.setState(draft => {
        draft.phase = 'game_over';
      });
      return { ended: true, outcome: 'defeat', narration };
    }

    return { ended: false };
  }

  function getCombatPhase(): string {
    return stores.combat.getState().phase;
  }

  return { startCombat, processPlayerAction, processEnemyTurn, checkCombatEnd, getCombatPhase };
}

function getWeaponBase(
  equipment: Record<string, string | null>,
  codexEntries: Map<string, CodexEntry>,
): number {
  const weaponId = equipment['weapon'];
  if (!weaponId) return GAME_CONSTANTS.DEFAULT_WEAPON_BASE;
  const entry = codexEntries.get(weaponId);
  if (!entry || entry.type !== 'item') return GAME_CONSTANTS.DEFAULT_WEAPON_BASE;
  return entry.base_damage ?? GAME_CONSTANTS.DEFAULT_WEAPON_BASE;
}
