import type { GameAction } from '../types/game-action';
import type { CommandParser } from './command-parser';
import { classifyIntent, type ClassifyIntentOptions } from './intent-classifier';

export type InputResult =
  | { readonly status: 'success'; readonly action: GameAction }
  | { readonly status: 'clarification'; readonly message: string; readonly candidates: readonly GameAction[] }
  | { readonly status: 'error'; readonly message: string };

const CONFIDENCE_THRESHOLD = 0.3;

export type RouteInputOptions = {
  readonly classifyOptions?: ClassifyIntentOptions;
};

export async function routeInput(
  input: string,
  commandParser: CommandParser,
  sceneContext: string,
  options?: RouteInputOptions,
): Promise<InputResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { status: 'error', message: '请输入命令或描述你想做的事。' };
  }

  if (trimmed.startsWith('/')) {
    const action = commandParser.parse(trimmed);
    if (action) {
      return { status: 'success', action };
    }
    return {
      status: 'error',
      message: '未知命令。输入 /help 查看可用命令。',
    };
  }

  try {
    const intent = await classifyIntent(trimmed, sceneContext, options?.classifyOptions);

    if (intent.confidence < CONFIDENCE_THRESHOLD) {
      return {
        status: 'clarification',
        message: '无法理解你的意图。试试选择下方的推荐行动，或用 /help 查看命令。',
        candidates: [],
      };
    }

    const action: GameAction = {
      type: intent.action,
      target: intent.target,
      modifiers: intent.modifiers ?? {},
      source: 'intent',
    };
    return { status: 'success', action };
  } catch {
    return {
      status: 'error',
      message: '无法理解你的意图。试试选择下方的推荐行动，或用 /help 查看命令。',
    };
  }
}
