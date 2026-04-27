import { createCommandParser, type CommandParser } from './input/command-parser';
import { routeInput, type RouteInputOptions } from './input/input-router';
import { resolveNormalCheck } from './engine/adjudication';
import { GAME_CONSTANTS } from './engine/game-constants';
import { rollD20 } from './engine/dice';
import { getCostSummary } from './state/cost-session-store';
import type { Store } from './state/create-store';
import type { PlayerState } from './state/player-store';
import type { SceneState } from './state/scene-store';
import type { GameState } from './state/game-store';
import type { CombatState } from './state/combat-store';
import type { EventBus } from './events/event-bus';
import type { GameAction } from './types/game-action';
import type { CheckResult } from './types/common';
import type { SceneManager } from './engine/scene-manager';
import type { DialogueManager } from './engine/dialogue-manager';
import type { CombatLoop } from './engine/combat-loop';
import type { Serializer } from './state/serializer';
import type { QuestSystem } from './engine/quest-system';
import type { BranchMeta } from './state/branch-store';
import type { TurnLogEntry } from './state/serializer';

let lastReplayEntries: readonly TurnLogEntry[] = [];

export function getLastReplayEntries(): readonly TurnLogEntry[] {
  return lastReplayEntries;
}

export interface GameLoop {
  readonly processInput: (input: string, options?: RouteInputOptions) => Promise<ProcessResult>;
  readonly executeAction: (action: GameAction) => Promise<ProcessResult>;
  readonly getCommandParser: () => CommandParser;
}

export type ProcessResult =
  | { readonly status: 'action_executed'; readonly action: GameAction; readonly checkResult?: CheckResult; readonly narration: readonly string[] }
  | { readonly status: 'help'; readonly commands: readonly string[] }
  | { readonly status: 'clarification'; readonly message: string }
  | { readonly status: 'error'; readonly message: string };

const HELP_COMMANDS: readonly string[] = [
  '/look [target] — 观察周围或特定目标',
  '/go <direction> — 向指定方向移动',
  '/talk <npc> — 与NPC对话',
  '/attack <target> — 攻击目标',
  '/inspect <target> — 检查物品',
  '/use_item <item> — 使用物品',
  '/cast <spell> [target] — 施放法术',
  '/guard — 防御',
  '/flee — 逃跑',
  '/trade <npc> — 与NPC交易',
  '/save [name] — 保存游戏',
  '/branch [create|switch|tree|delete] [name] — 分支管理',
  '/compare [spec] — 对比分支差异',
  '/map — 查看地图',
  '/codex [query] — 浏览知识典籍',
  '/replay [N] — 回放最近N回合',
  '/help — 显示此帮助',
];

const PASSTHROUGH_ACTIONS = new Set(['look', 'help']);

export type GameLoopOptions = {
  readonly rng?: () => number;
  readonly sceneManager?: SceneManager;
  readonly dialogueManager?: DialogueManager;
  readonly combatLoop?: CombatLoop;
  readonly saveFileManager?: {
    quickSave: (serializer: Serializer, saveDir: string) => Promise<string>;
    saveGame: (name: string, serializer: Serializer, saveDir: string) => Promise<string>;
    loadGame: (filePath: string, serializer: Serializer) => Promise<void>;
  };
  readonly serializer?: Serializer;
  readonly saveDir?: string;
  readonly questSystem?: QuestSystem;
  readonly branchManager?: {
    readonly createBranch: (name: string) => BranchMeta;
    readonly switchBranch: (branchId: string) => void;
    readonly deleteBranch: (branchId: string) => void;
  };
  readonly turnLog?: {
    readonly replayTurns: (count: number) => readonly TurnLogEntry[];
  };
};

export type GameLoopStores = {
  player: Store<PlayerState>;
  scene: Store<SceneState>;
  game: Store<GameState>;
  combat: Store<CombatState>;
};

export function createGameLoop(
  stores: GameLoopStores,
  eventBus: EventBus,
  options?: GameLoopOptions,
): GameLoop {
  const commandParser = createCommandParser();
  const rng = options?.rng;
  const sceneManager = options?.sceneManager;
  const dialogueManager = options?.dialogueManager;
  const combatLoop = options?.combatLoop;
  const saveFileManager = options?.saveFileManager;
  const serializer = options?.serializer;
  const saveDir = options?.saveDir;
  const questSystem = options?.questSystem;
  const branchManager = options?.branchManager;
  const turnLog = options?.turnLog;

  async function processInput(input: string, routeOptions?: RouteInputOptions): Promise<ProcessResult> {
    const sceneContext = stores.scene.getState().narrationLines.join(' ');
    const routeResult = await routeInput(input, commandParser, sceneContext, routeOptions);

    if (routeResult.status === 'error') {
      return { status: 'error', message: routeResult.message };
    }
    if (routeResult.status === 'clarification') {
      return { status: 'clarification', message: routeResult.message };
    }

    return executeAction(routeResult.action);
  }

  async function executeAction(action: GameAction): Promise<ProcessResult> {
    if (action.type === 'help') {
      return { status: 'help', commands: HELP_COMMANDS };
    }

    // Combat routing: when in combat, route combat actions to combatLoop
    if (stores.combat.getState().active && combatLoop) {
      const COMBAT_ACTIONS = new Set(['attack', 'cast', 'guard', 'flee']);
      if (COMBAT_ACTIONS.has(action.type)) {
        const combatResult = await combatLoop.processPlayerAction(
          action.type as 'attack' | 'cast' | 'guard' | 'flee',
        );
        if (combatResult.status === 'error') {
          return { status: 'error', message: combatResult.message };
        }
        await combatLoop.processEnemyTurn();
        await combatLoop.checkCombatEnd();
        const narration = stores.combat.getState().lastNarration
          ? [stores.combat.getState().lastNarration]
          : [];
        return {
          status: 'action_executed',
          action,
          checkResult: stores.combat.getState().lastCheckResult ?? undefined,
          narration,
        };
      }
      return { status: 'error', message: '战斗中只能进行战斗行动！' };
    }

    if (action.type === 'look') {
      if (sceneManager) {
        const result = await sceneManager.handleLook(action.target ?? undefined);
        if (result.status === 'success') {
          return { status: 'action_executed', action, narration: result.narration };
        }
        return { status: 'error', message: result.message };
      }
      return {
        status: 'action_executed',
        action,
        narration: stores.scene.getState().narrationLines,
      };
    }

    if (action.type === 'inspect' && sceneManager) {
      const result = await sceneManager.handleInspect(action.target ?? '');
      if (result.status === 'success') {
        return { status: 'action_executed', action, narration: result.narration };
      }
      return { status: 'error', message: result.message };
    }

    if (action.type === 'move' && sceneManager) {
      const result = await sceneManager.handleGo(action.target ?? '');
      if (result.status === 'success') {
        return { status: 'action_executed', action, narration: result.narration };
      }
      return { status: 'error', message: result.message };
    }

    if (action.type === 'talk' && dialogueManager) {
      const dialogueResult = await dialogueManager.startDialogue(action.target ?? '');
      if (dialogueResult.error) {
        return { status: 'error', message: dialogueResult.error };
      }
      stores.game.setState(draft => {
        draft.phase = 'dialogue';
      });
      const currentLines = stores.scene.getState().narrationLines;
      return {
        status: 'action_executed',
        action,
        narration: currentLines,
      };
    }

    if (action.type === 'save') {
      if (saveFileManager && serializer && saveDir) {
        const filePath = action.target
          ? await saveFileManager.saveGame(action.target, serializer, saveDir)
          : await saveFileManager.quickSave(serializer, saveDir);
        return { status: 'action_executed', action, narration: [`游戏已保存: ${filePath}`] };
      }
      return { status: 'error', message: '存档系统未初始化' };
    }

    if (action.type === 'load') {
      if (saveFileManager && serializer && saveDir) {
        const fileName = action.target ?? 'quicksave.json';
        const filePath = fileName.includes('/') ? fileName : `${saveDir}/${fileName}`;
        await saveFileManager.loadGame(filePath, serializer);
        return { status: 'action_executed', action, narration: ['游戏已加载。'] };
      }
      return { status: 'error', message: '存档系统未初始化' };
    }

    if (action.type === 'journal') {
      stores.game.setState(draft => { draft.phase = 'journal'; });
      return { status: 'action_executed', action, narration: [] };
    }

    if (action.type === 'map') {
      stores.game.setState(draft => { draft.phase = 'map'; });
      return { status: 'action_executed', action, narration: [] };
    }

    if (action.type === 'codex') {
      stores.game.setState(draft => { draft.phase = 'codex'; });
      return { status: 'action_executed', action, narration: [] };
    }

    if (action.type === 'branch') {
      const subAction = action.target ?? 'tree';
      if (subAction === 'tree') {
        stores.game.setState(draft => { draft.phase = 'branch_tree'; });
        return { status: 'action_executed', action, narration: [] };
      }
      if (subAction === 'create') {
        const name = (action.modifiers as Record<string, string>)['name'];
        if (!name) return { status: 'error', message: '请指定分支名称。用法: /branch create <name>' };
        if (!branchManager) return { status: 'error', message: '分支系统未初始化' };
        const branch = branchManager.createBranch(name);
        return { status: 'action_executed', action, narration: [`分支「${branch.name}」已创建。当前位于新分支。`] };
      }
      if (subAction === 'switch') {
        const name = (action.modifiers as Record<string, string>)['name'];
        if (!name) return { status: 'error', message: '请指定分支名称。' };
        if (!branchManager) return { status: 'error', message: '分支系统未初始化' };
        try {
          branchManager.switchBranch(name);
          return { status: 'action_executed', action, narration: [`已切换至分支「${name}」。`] };
        } catch (e) {
          return { status: 'error', message: `分支「${name}」不存在。使用 /branch tree 查看所有分支。` };
        }
      }
      if (subAction === 'delete') {
        const name = (action.modifiers as Record<string, string>)['name'];
        if (!name) return { status: 'error', message: '请指定要删除的分支名称。' };
        if (!branchManager) return { status: 'error', message: '分支系统未初始化' };
        try {
          branchManager.deleteBranch(name);
          return { status: 'action_executed', action, narration: [`分支「${name}」已删除。`] };
        } catch (e) {
          return { status: 'error', message: (e as Error).message };
        }
      }
      return { status: 'error', message: '未知分支指令。用法: /branch create|switch|tree|delete <name>' };
    }

    if (action.type === 'compare') {
      stores.game.setState(draft => { draft.phase = 'compare'; });
      return { status: 'action_executed', action, narration: [] };
    }

    if (action.type === 'replay') {
      const count = parseInt(action.target ?? '10', 10);
      if (!turnLog) return { status: 'error', message: '回放系统未初始化' };
      const entries = turnLog.replayTurns(isNaN(count) ? 10 : count);
      lastReplayEntries = [...entries];
      stores.game.setState(draft => { draft.phase = 'replay'; });
      return { status: 'action_executed', action, narration: [] };
    }

    if (action.type === 'cost') {
      const summary = getCostSummary();
      const lines: string[] = [
        `【本次冒险消耗】`,
        `  总 Input: ${summary.totalInputTokens} tokens`,
        `  总 Output: ${summary.totalOutputTokens} tokens`,
        `  估算费用: $${summary.totalEstimatedCost.toFixed(6)}`,
        ``,
        `【各 AI 角色消耗】`,
        ...Object.entries(summary.byRole).map(([role, entry]) =>
          entry ? `  ${role}: in=${entry.inputTokens} out=${entry.outputTokens} $${entry.estimatedCost.toFixed(6)}` : ''
        ).filter(Boolean),
      ];
      return { status: 'action_executed', action, narration: lines };
    }

    if (action.type === 'quest') {
      if (action.target === 'accept' && questSystem) {
        const questId = (action.modifiers as Record<string, string>)['id'] ?? '';
        const result = questSystem.acceptQuest(questId);
        if (result.status === 'gated') {
          return { status: 'error', message: result.reason };
        }
        if (result.status === 'error') {
          return { status: 'error', message: result.reason };
        }
        return { status: 'action_executed', action, narration: [`任务已接受: ${questId}`] };
      }
      return { status: 'error', message: '未知任务指令' };
    }

    if (action.type === 'quit') {
      stores.game.setState(draft => { draft.pendingQuit = true; });
      return { status: 'action_executed', action, narration: [] };
    }

    const checkResult = adjudicate(action);

    eventBus.emit('action_resolved', { action, result: checkResult });

    const currentLines = stores.scene.getState().narrationLines;
    const newNarration = [...currentLines, checkResult.display];
    stores.scene.setState(draft => {
      draft.narrationLines = newNarration;
    });

    stores.game.setState(draft => {
      draft.turnCount += 1;
    });

    return {
      status: 'action_executed',
      action,
      checkResult,
      narration: newNarration,
    };
  }

  function adjudicate(action: GameAction): CheckResult {
    const player = stores.player.getState();
    const attributeName = getRelevantAttribute(action.type);
    const attrMod = player.attributes[attributeName] ?? 0;
    const roll = rollD20(rng);
    const dc = GAME_CONSTANTS.DEFAULT_DC;

    return resolveNormalCheck({
      roll,
      attributeName,
      attributeModifier: attrMod,
      skillModifier: 0,
      environmentModifier: 0,
      dc,
    });
  }

  return {
    processInput,
    executeAction,
    getCommandParser: () => commandParser,
  };
}

function getRelevantAttribute(actionType: string): 'physique' | 'finesse' | 'mind' {
  switch (actionType) {
    case 'attack':
    case 'guard':
    case 'flee':
      return 'physique';
    case 'inspect':
    case 'use_item':
    case 'trade':
      return 'finesse';
    case 'talk':
    case 'cast':
      return 'mind';
    default:
      return 'physique';
  }
}
