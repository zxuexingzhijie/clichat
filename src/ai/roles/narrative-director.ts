import { generateText, streamText } from 'ai';
import { getRoleConfig } from '../providers';
import { recordUsage } from '../../state/cost-session-store';
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
  const maxRetries = options?.maxRetries ?? 2;
  const system = buildNarrativeSystemPrompt(context.sceneType);
  const prompt = buildNarrativeUserPrompt(context as NarrativeUserPromptContext);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = streamText({
        model: config.model(),
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        system,
        prompt,
      });

      for await (const chunk of result.textStream) {
        yield chunk;
      }
      const usage = await result.usage;
      recordUsage('narrative-director', usage);
      return;
    } catch (err) {
      if (attempt === maxRetries) {
        yield getFallbackNarration(context.sceneType);
        return;
      }
    }
  }
}

export async function generateNarration(
  context: NarrativeContext,
  options?: NarrativeOptions,
): Promise<string> {
  const config = getRoleConfig('narrative-director');
  const maxRetries = options?.maxRetries ?? 2;
  const system = buildNarrativeSystemPrompt(context.sceneType);
  const prompt = buildNarrativeUserPrompt(context as NarrativeUserPromptContext);
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { text, usage } = await generateText({
        model: config.model(),
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        system,
        prompt,
      });
      recordUsage('narrative-director', usage);

      if (text.length > 300) {
        return text.slice(0, 300);
      }
      if (text.length < 10) {
        return getFallbackNarration(context.sceneType);
      }
      return text;
    } catch (err) {
      lastError = err;
    }
  }

  return getFallbackNarration(context.sceneType);
}
