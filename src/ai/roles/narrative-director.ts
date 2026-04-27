import { getRoleConfig } from '../providers';
import { callGenerateText, callStreamText } from '../utils/ai-caller';
import {
  buildNarrativeSystemPrompt,
  buildNarrativeUserPrompt,
  type SceneType,
  type NarrativeUserPromptContext,
} from '../prompts/narrative-system';
import { getFallbackNarration } from '../utils/fallback';

export type NarrativeContext = {
  readonly sceneType: SceneType;
  readonly codexEntries: ReadonlyArray<{ readonly id: string; readonly description: string }>;
  readonly checkResult?: { readonly display: string };
  readonly playerAction: string;
  readonly recentNarration: readonly string[];
  readonly sceneContext: string;
};

export type NarrativeOptions = {
  readonly maxRetries?: number;
};

export async function* streamNarration(
  context: NarrativeContext,
  options?: NarrativeOptions,
): AsyncGenerator<string> {
  const config = getRoleConfig('narrative-director');
  const system = buildNarrativeSystemPrompt(context.sceneType);
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
  const system = buildNarrativeSystemPrompt(context.sceneType);
  const prompt = buildNarrativeUserPrompt(context as NarrativeUserPromptContext);

  try {
    const { text } = await callGenerateText({
      role: 'narrative-director',
      providerName: config.providerName,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      system,
      prompt,
      maxRetries: options?.maxRetries,
    });
    if (text.length > 300) return text.slice(0, 300);
    if (text.length < 10) return getFallbackNarration(context.sceneType);
    return text;
  } catch {
    return getFallbackNarration(context.sceneType);
  }
}
