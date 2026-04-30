import { callGenerateObject } from '../ai/utils/ai-caller';
import { getRoleConfig } from '../ai/providers';
import { IntentSchema, type Intent } from '../types/intent';

const INTENT_SYSTEM_PROMPT = `You are an intent classifier for a Chinese fantasy RPG game.
Classify the player's input into a structured game action.
Available actions: move, look, talk, attack, use_item, cast, guard, flee, inspect, trade.
Respond with the action type, target (if any), and your confidence level.
If the input is ambiguous, set confidence below 0.5 and provide your best interpretation.`;

export type ClassifyIntentOptions = {
  readonly maxRetries?: number;
};

export async function classifyIntent(
  input: string,
  sceneContext: string,
  options?: ClassifyIntentOptions,
): Promise<Intent> {
  const config = getRoleConfig('retrieval-planner');
  const { object } = await callGenerateObject<Intent>({
    role: 'retrieval-planner',
    providerName: config.providerName,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    system: INTENT_SYSTEM_PROMPT,
    prompt: `Current scene: ${sceneContext}\nPlayer input: ${input}\n\nClassify the player's intent.`,
    maxRetries: options?.maxRetries ?? 1,
    schema: IntentSchema,
  });
  return object;
}
