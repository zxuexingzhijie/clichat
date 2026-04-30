import { getRoleConfig } from '../providers';
import { callGenerateObject, callStreamText } from '../utils/ai-caller';
import { NarrationOutputSchema } from '../schemas/narration-output';
import {
  buildNarrativeSystemPrompt,
  buildNarrativeUserPrompt,
  type SceneType,
  type NarrativeUserPromptContext,
  type NarrativePromptContext,
} from '../prompts/narrative-system';
import { getFallbackNarration } from '../utils/fallback';

export type NarrativeContext = {
  readonly sceneType: SceneType;
  readonly codexEntries: ReadonlyArray<{ readonly id: string; readonly description: string }>;
  readonly checkResult?: { readonly display: string };
  readonly playerAction: string;
  readonly recentNarration: readonly string[];
  readonly sceneContext: string;
  readonly narrativeContext?: NarrativePromptContext;
};

export type NarrativeOptions = {
  readonly maxRetries?: number;
};

export async function* streamNarration(
  context: NarrativeContext,
  options?: NarrativeOptions,
): AsyncGenerator<string> {
  const config = getRoleConfig('narrative-director');
  const system = buildNarrativeSystemPrompt(context.sceneType, context.narrativeContext);
  const prompt = buildNarrativeUserPrompt(context as NarrativeUserPromptContext);

  try {
    yield* callStreamText({
      role: 'narrative-director',
      providerName: config.providerName,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      system,
      prompt,
      maxRetries: options?.maxRetries,
    });
  } catch {
    yield getFallbackNarration(context.sceneType);
  }
}

export async function generateNarration(
  context: NarrativeContext,
  options?: NarrativeOptions,
): Promise<string> {
  const config = getRoleConfig('narrative-director');
  const system = buildNarrativeSystemPrompt(context.sceneType, context.narrativeContext);
  const prompt = buildNarrativeUserPrompt(context as NarrativeUserPromptContext);

  try {
    const { object } = await callGenerateObject<{ text: string }>({
      role: 'narrative-director',
      providerName: config.providerName,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      system,
      prompt,
      maxRetries: options?.maxRetries,
      schema: NarrationOutputSchema,
    });
    return object.text;
  } catch {
    return getFallbackNarration(context.sceneType);
  }
}
