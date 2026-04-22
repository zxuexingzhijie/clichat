import { generateText, streamText } from 'ai';
import { getRoleConfig } from '../providers';
import { recordUsage } from '../../state/cost-session-store';
import { eventBus } from '../../events/event-bus';
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
      let result: ReturnType<typeof streamText>;

      if (config.providerName === 'anthropic') {
        result = streamText({
          model: config.model(),
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: system,
                  providerOptions: {
                    anthropic: { cacheControl: { type: 'ephemeral' } },
                  },
                },
                { type: 'text', text: prompt },
              ],
            },
          ],
        });
      } else {
        result = streamText({
          model: config.model(),
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens,
          system,
          prompt,
        });
      }

      for await (const chunk of result.textStream) {
        yield chunk;
      }
      const usage = await result.usage;
      recordUsage('narrative-director', { inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0, totalTokens: usage.totalTokens ?? 0 });
      return;
    } catch (err) {
      if (attempt === maxRetries) {
        eventBus.emit('ai_call_failed', {
          role: 'narrative-director',
          error: err instanceof Error ? err.message : String(err),
        });
        recordUsage('narrative-director', { inputTokens: 0, outputTokens: 0, totalTokens: 0 });
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
      let text: string;
      let usage: { inputTokens: number | undefined; outputTokens: number | undefined; totalTokens: number | undefined };

      if (config.providerName === 'anthropic') {
        const result = await generateText({
          model: config.model(),
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: system,
                  providerOptions: {
                    anthropic: { cacheControl: { type: 'ephemeral' } },
                  },
                },
                { type: 'text', text: prompt },
              ],
            },
          ],
        });
        text = result.text;
        usage = result.usage;
      } else {
        const result = await generateText({
          model: config.model(),
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens,
          system,
          prompt,
        });
        text = result.text;
        usage = result.usage;
      }

      recordUsage('narrative-director', { inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0, totalTokens: usage.totalTokens ?? 0 });

      if (text.length > 300) {
        return text.slice(0, 300);
      }
      if (text.length < 10) {
        return getFallbackNarration(context.sceneType);
      }
      return text;
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) {
        eventBus.emit('ai_call_failed', {
          role: 'narrative-director',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  void lastError;
  return getFallbackNarration(context.sceneType);
}
