import { resolveNormalCheck } from './adjudication';
import { GAME_CONSTANTS } from './game-constants';
import { calculateDamage } from './damage';
import { rollD20 } from './dice';
import { handleUseItem } from './action-handlers/use-item-handler';
import type { Store } from '../state/create-store';
import type { CombatState } from '../state/combat-store';
import type { PlayerState } from '../state/player-store';
import type { GameState } from '../state/game-store';
import type { SceneState } from '../state/scene-store';
import type { CheckResult } from '../types/common';
import type { CodexEntry, Enemy, Spell } from '../codex/schemas/entry-types';
import type { NarrativeContext } from '../ai/roles/narrative-director';
import type { EventBus } from '../events/event-bus';

export type CombatActionType = 'attack' | 'cast' | 'guard' | 'use_item' | 'flee';

export type CombatActionOptions = {
  readonly targetIndex?: number;
  readonly spellId?: string;
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
  readonly sceneStore?: Store<SceneState>;
  readonly eventBus?: EventBus;
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
  const sceneStore = options?.sceneStore;
  const combatEventBus = options?.eventBus;

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
      if (sceneStore && combatEventBus) {
        let itemId = options?.spellId;
        if (!itemId) {
          const tags = stores.player.getState().tags;
          const itemTag = tags.find(t => t.startsWith('item:'));
          itemId = itemTag ? itemTag.slice('item:'.length) : undefined;
        }
        if (!itemId) {
          stores.combat.setState(draft => { draft.phase = 'player_turn'; });
          return { status: 'error', message: '请指定要使用的物品。' };
        }
        const useItemCtx = {
          stores: { ...stores, scene: sceneStore },
          eventBus: combatEventBus,
          codexEntries,
        };
        const itemAction = { type: 'use_item' as const, target: itemId, modifiers: {}, source: 'command' as const };
        const result = await handleUseItem(
          itemAction,
          useItemCtx as Parameters<typeof handleUseItem>[1],
        );
        stores.combat.setState(draft => { draft.phase = 'enemy_turn'; });
        if (result.status === 'error') {
          stores.combat.setState(draft => { draft.phase = 'player_turn'; });
          return { status: 'error', message: result.message };
        }
        const narrationLines = result.status === 'action_executed' ? result.narration : [];
        return { status: 'ok', narration: narrationLines[narrationLines.length - 1] ?? '使用了物品。' };
      }
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
      const spellId = options?.spellId;
      if (!spellId) {
        stores.combat.setState(draft => { draft.phase = 'player_turn'; });
        return { status: 'error', message: '请指定法术名称。' };
      }
      const spellEntry = spellId ? codexEntries.get(spellId) : null;
      const spell = spellEntry?.type === 'spell' ? (spellEntry as Spell) : null;

      if (spellId && !spell) {
        stores.combat.setState(draft => { draft.phase = 'player_turn'; });
        return { status: 'error', message: '未知法术。' };
      }

      const spellMpCost = spell?.mp_cost ?? GAME_CONSTANTS.CAST_MP_COST;
      if (player.mp < spellMpCost) {
        stores.combat.setState(draft => { draft.phase = 'player_turn'; });
        return { status: 'error', message: '魔力不足！无法施法。' };
      }
      stores.player.setState(draft => {
        draft.mp = draft.mp - spellMpCost;
      });

      if (spell?.effect_type === 'heal') {
        const healAmount = spell.base_value ?? 3;
        const currentPlayer = stores.player.getState();
        const newHp = Math.min(currentPlayer.maxHp, currentPlayer.hp + healAmount);
        stores.player.setState(draft => { draft.hp = newHp; });
        const spellName = spell.name;
        const narration = await doGenerateNarration(`施放${spellName}，恢复了生命值`, undefined);
        stores.combat.setState(draft => {
          draft.lastNarration = narration;
          draft.phase = 'enemy_turn';
        });
        return { status: 'ok', narration };
      }
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
        stores.player.setState(draft => {
          draft.poisonStacks = 0;
        });
        return { status: 'ok', checkResult, narration: '你成功逃脱了战斗！', outcome: 'flee' };
      }
    }

    if (isSuccess && (actionType === 'attack' || actionType === 'cast')) {
      const weaponBase = actionType === 'attack'
        ? getWeaponBase(player.equipment, codexEntries)
        : (() => {
            const spellId = options?.spellId;
            const spellEntry = spellId ? codexEntries.get(spellId) : null;
            const spell = spellEntry?.type === 'spell' ? (spellEntry as Spell) : null;
            return spell?.base_value ?? GAME_CONSTANTS.CAST_WEAPON_BASE;
          })();
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

    const actionLabel = actionType === 'attack'
      ? '攻击'
      : actionType === 'cast'
        ? (() => {
            const spellId = options?.spellId;
            const spellEntry = spellId ? codexEntries.get(spellId) : null;
            const spell = spellEntry?.type === 'spell' ? (spellEntry as Spell) : null;
            return spell ? `施放${spell.name}` : '施法';
          })()
        : '逃跑';
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
    const guardActive = state.guardActive;
    const howlActive = state.howlActive;
    const playerAC = getPlayerAC()
      + (guardActive ? GAME_CONSTANTS.GUARD_AC_BONUS : 0)
      - (howlActive ? 2 : 0);

    stores.combat.setState(draft => {
      draft.guardActive = false;
      draft.howlActive = false;
    });

    const poisonStacks = stores.player.getState().poisonStacks ?? 0;
    if (poisonStacks > 0) {
      stores.player.setState(draft => {
        draft.hp = Math.max(0, draft.hp - poisonStacks);
      });
    }

    const aliveEnemyCount = state.enemies.filter(e => e.hp > 0).length;

    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) continue;

      const enemyEntry = codexEntries.get(enemy.id);
      const enemyData = enemyEntry?.type === 'enemy' ? (enemyEntry as Enemy) : null;
      const baseAttackMod = enemyData?.attack ?? 0;
      const enemyDamageBase = enemyData?.damage_base ?? 3;
      const abilities: string[] = enemyData?.abilities ?? [];

      let abilityAttackBonus = 0;
      let forceFirstCrit = false;
      let shouldVanish = false;

      for (const ability of abilities) {
        switch (ability) {
          case 'pack_tactics': {
            if (aliveEnemyCount >= 2) {
              abilityAttackBonus += 2;
            }
            break;
          }
          case 'howl': {
            stores.combat.setState(draft => { draft.howlActive = true; });
            break;
          }
          case 'backstab': {
            if (state.roundNumber === 1) {
              forceFirstCrit = true;
            }
            break;
          }
          case 'poison_blade':
            break;
          case 'vanish': {
            shouldVanish = true;
            break;
          }
          case 'bite':
          case 'slash':
          case 'dirty_trick':
          case 'ranged_shot': {
            abilityAttackBonus += 1;
            break;
          }
          case 'pack_leader': {
            abilityAttackBonus += 3;
            break;
          }
          case 'retreat': {
            stores.combat.setState(draft => {
              const idx = draft.enemies.findIndex(e => e.id === enemy.id);
              if (idx >= 0) draft.enemies[idx]!.hp = 0;
            });
            shouldVanish = true;
            break;
          }
          default:
            break;
        }
      }

      if (shouldVanish) {
        stores.combat.setState(draft => {
          const idx = draft.enemies.findIndex(e => e.id === enemy.id);
          if (idx >= 0) draft.enemies[idx]!.hp = 0;
        });
        continue;
      }

      const enemyAttackMod = baseAttackMod + abilityAttackBonus;

      stores.combat.setState(draft => {
        draft.phase = 'resolving';
      });

      let checkResult: CheckResult;
      if (forceFirstCrit) {
        checkResult = {
          roll: 20,
          total: 20 + enemyAttackMod,
          dc: playerAC,
          grade: 'critical_success',
          attributeName: 'physique',
          attributeModifier: enemyAttackMod,
          skillModifier: 0,
          environmentModifier: 0,
          display: '暴击！',
        };
      } else {
        const roll = rollD20(rng);
        checkResult = resolveNormalCheck({
          roll,
          attributeName: 'physique',
          attributeModifier: enemyAttackMod,
          skillModifier: 0,
          environmentModifier: 0,
          dc: playerAC,
        });
      }

      stores.combat.setState(draft => {
        draft.lastCheckResult = checkResult;
      });

      const isHit = checkResult.grade !== 'failure' && checkResult.grade !== 'critical_failure';

      if (isHit) {
        const player = stores.player.getState();
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

        if (abilities.includes('poison_blade')) {
          stores.player.setState(draft => {
            draft.poisonStacks = (draft.poisonStacks ?? 0) + 1;
          });
        }
      }

      stores.combat.setState(draft => {
        draft.phase = 'narrating';
      });

      const actionLabel = `${enemy.name}攻击`;
      const narration = await doGenerateNarration(actionLabel, checkResult);
      stores.combat.setState(draft => {
        draft.lastNarration = narration;
      });

      if (stores.player.getState().hp <= 0) {
        break;
      }
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
    if (!stores.combat.getState().active) return { ended: false };
    const player = stores.player.getState();

    if (allEnemiesDead()) {
      const defeatedEnemies = stores.combat.getState().enemies;
      const narration = defeatedEnemies
        .map(e => `${e.name}被击败了。`)
        .join('') + '战斗胜利！';

      for (const combatEnemy of defeatedEnemies) {
        const enemyEntry = codexEntries.get(combatEnemy.id);
        const enemyData = enemyEntry?.type === 'enemy' ? (enemyEntry as Enemy) : null;
        const lootItems = enemyData?.loot_table ?? [];
        for (const itemId of lootItems) {
          sceneStore?.setState(draft => {
            draft.droppedItems = [...draft.droppedItems, itemId];
          });
        }
      }

      stores.combat.setState(draft => {
        draft.outcome = 'victory';
        draft.active = false;
        draft.phase = 'ended';
        draft.lastNarration = narration;
      });
      stores.game.setState(draft => {
        draft.phase = 'game';
      });
      stores.player.setState(draft => {
        draft.poisonStacks = 0;
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
      stores.player.setState(draft => {
        draft.poisonStacks = 0;
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
