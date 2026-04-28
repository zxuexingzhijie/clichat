import { createCommandParser, type CommandParser } from './input/command-parser';
import { routeInput, type RouteInputOptions } from './input/input-router';
import { listSaves as defaultListSaves } from './persistence/save-file-manager';
import type { SaveListEntry } from './persistence/save-file-manager';
import type { Store } from './state/create-store';
import type { PlayerState } from './state/player-store';
import type { SceneState } from './state/scene-store';
import type { GameState } from './state/game-store';
import type { CombatState } from './state/combat-store';
import type { QuestState } from './state/quest-store';
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
import { createDefaultRegistry, type ActionContext } from './engine/action-handlers';
import type { CodexEntry } from './codex/schemas/entry-types';

export { getLastReplayEntries } from './engine/action-handlers';

export interface GameLoop {
  readonly processInput: (input: string, options?: RouteInputOptions) => Promise<ProcessResult>;
  readonly executeAction: (action: GameAction) => Promise<ProcessResult>;
  readonly getCommandParser: () => CommandParser;
  readonly loadLastSave: () => Promise<void>;
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

export type GameLoopOptions = {
  readonly rng?: () => number;
  readonly sceneManager?: SceneManager;
  readonly dialogueManager?: DialogueManager;
  readonly combatLoop?: CombatLoop;
  readonly saveFileManager?: {
    quickSave: (serializer: Serializer, saveDir: string) => Promise<string>;
    saveGame: (name: string, serializer: Serializer, saveDir: string) => Promise<string>;
    loadGame: (filePath: string, serializer: Serializer, saveDir?: string) => Promise<void>;
  };
  readonly serializer?: Serializer;
  readonly saveDir?: string;
  readonly questSystem?: QuestSystem;
  readonly questStore?: Store<QuestState>;
  readonly branchManager?: {
    readonly createBranch: (name: string) => BranchMeta;
    readonly switchBranch: (branchId: string) => void;
    readonly deleteBranch: (branchId: string) => void;
    readonly getBranchMeta: (branchId: string) => BranchMeta | undefined;
  };
  readonly turnLog?: {
    readonly replayTurns: (count: number) => readonly TurnLogEntry[];
  };
  readonly codexEntries?: Map<string, CodexEntry>;
  readonly listSavesFn?: (saveDir: string) => Promise<SaveListEntry[]>;
};

export type GameLoopStores = {
  readonly player: Store<PlayerState>;
  readonly scene: Store<SceneState>;
  readonly game: Store<GameState>;
  readonly combat: Store<CombatState>;
};

export function createGameLoop(
  stores: GameLoopStores,
  eventBus: EventBus,
  options?: GameLoopOptions,
): GameLoop {
  const commandParser = createCommandParser();
  const registry = createDefaultRegistry();

  const actionContext: ActionContext = {
    stores: stores,
    eventBus,
    sceneManager: options?.sceneManager,
    dialogueManager: options?.dialogueManager,
    combatLoop: options?.combatLoop,
    saveFileManager: options?.saveFileManager,
    serializer: options?.serializer,
    saveDir: options?.saveDir,
    questSystem: options?.questSystem,
    questStore: options?.questStore,
    branchManager: options?.branchManager,
    turnLog: options?.turnLog,
    rng: options?.rng,
    codexEntries: options?.codexEntries,
  };

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
    return registry.dispatch(action, actionContext);
  }

  async function loadLastSave(): Promise<void> {
    const sfm = options?.saveFileManager;
    const serializer = options?.serializer;
    const saveDir = options?.saveDir;
    if (!sfm || !serializer || !saveDir) return;
    const listFn = options?.listSavesFn ?? defaultListSaves;
    const saves = await listFn(saveDir);
    if (saves.length === 0) return;
    await sfm.loadGame(saves[0].filePath, serializer, saveDir);
    stores.game.setState(draft => { draft.phase = 'game'; });
  }

  return {
    processInput,
    executeAction,
    getCommandParser: () => commandParser,
    loadLastSave,
  };
}
