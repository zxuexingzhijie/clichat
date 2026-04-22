import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { IntentSchema, type Intent } from '../types/intent';

const INTENT_SYSTEM_PROMPT = `You are an intent classifier for a Chinese fantasy RPG game.
Classify the player's input into a structured game action.
Available actions: move, look, talk, attack, use_item, cast, guard, flee, inspect, trade.
Respond with the action type, target (if any), and your confidence level.
If the input is ambiguous, set confidence below 0.5 and provide your best interpretation.`;

export type ClassifyIntentOptions = {
  readonly maxRetries?: number;
  readonly model?: Parameters<typeof generateObject>[0]['model'];
};

export async function classifyIntent(
  input: string,
  sceneContext: string,
  options?: ClassifyIntentOptions,
): Promise<Intent> {
  const maxRetries = options?.maxRetries ?? 1;
  const model = (options?.model ?? openai('gpt-4o-mini')) as import('ai').LanguageModel;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { object } = await generateObject({
        model,
        schema: IntentSchema,
        system: INTENT_SYSTEM_PROMPT,
        prompt: `Current scene: ${sceneContext}\nPlayer input: ${input}\n\nClassify the player's intent.`,
      });
      return object;
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    `Intent classification failed after ${maxRetries + 1} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}
