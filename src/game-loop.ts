import { createCommandParser, type CommandParser } from './input/command-parser';
import { routeInput, type RouteInputOptions } from './input/input-router';
import { resolveNormalCheck } from './engine/adjudication';
import { rollD20 } from './engine/dice';
import { playerStore } from './state/player-store';
import { sceneStore } from './state/scene-store';
import { gameStore } from './state/game-store';
import { eventBus } from './events/event-bus';
import type { GameAction } from './types/game-action';
import type { CheckResult } from './types/common';
import type { SceneManager } from './engine/scene-manager';
import type { DialogueManager } from './engine/dialogue-manager';

export interface GameLoop {
  readonly processInput: (input: string, options?: RouteInputOptions) => Promise<ProcessResult>;
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
  '/help — 显示此帮助',
];

const PASSTHROUGH_ACTIONS = new Set(['look', 'help']);

export type GameLoopOptions = {
  readonly rng?: () => number;
  readonly sceneManager?: SceneManager;
  readonly dialogueManager?: DialogueManager;
};

export function createGameLoop(options?: GameLoopOptions): GameLoop {
  const commandParser = createCommandParser();
  const rng = options?.rng;
  const sceneManager = options?.sceneManager;
  const dialogueManager = options?.dialogueManager;

  async function processInput(input: string, routeOptions?: RouteInputOptions): Promise<ProcessResult> {
    const sceneContext = sceneStore.getState().narrationLines.join(' ');
    const routeResult = await routeInput(input, commandParser, sceneContext, routeOptions);

    if (routeResult.status === 'error') {
      return { status: 'error', message: routeResult.message };
    }
    if (routeResult.status === 'clarification') {
      return { status: 'clarification', message: routeResult.message };
    }

    const action = routeResult.action;

    if (action.type === 'help') {
      return { status: 'help', commands: HELP_COMMANDS };
    }

    if (action.type === 'look') {
      if (sceneManager) {
        const result = await sceneManager.handleLook(action.target);
        if (result.status === 'success') {
          return { status: 'action_executed', action, narration: result.narration };
        }
        return { status: 'error', message: result.message };
      }
      return {
        status: 'action_executed',
        action,
        narration: sceneStore.getState().narrationLines,
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
      gameStore.setState(draft => {
        draft.phase = 'dialogue';
      });
      const currentLines = sceneStore.getState().narrationLines;
      return {
        status: 'action_executed',
        action,
        narration: currentLines,
      };
    }

    const checkResult = adjudicate(action);

    eventBus.emit('action_resolved', { action, result: checkResult });

    const currentLines = sceneStore.getState().narrationLines;
    const newNarration = [...currentLines, checkResult.display];
    sceneStore.setState(draft => {
      draft.narrationLines = newNarration;
    });

    gameStore.setState(draft => {
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
    const player = playerStore.getState();
    const attributeName = getRelevantAttribute(action.type);
    const attrMod = player.attributes[attributeName] ?? 0;
    const roll = rollD20(rng);
    const dc = 12;

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
