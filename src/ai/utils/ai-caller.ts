import { generateText, generateObject, streamText } from 'ai';
import type { LanguageModel } from 'ai';
import { recordUsage } from '../../state/cost-session-store';
import { eventBus } from '../../events/event-bus';
import type { AiRole } from '../providers';

type MessageMode =
  | { readonly mode: 'standard'; readonly options: { readonly system: string; readonly prompt: string } }
  | { readonly mode: 'anthropic_cache'; readonly options: { readonly messages: Array<Record<string, unknown>> } };

export function buildAiCallMessages(
  providerName: string,
  system: string,
  prompt: string,
): MessageMode {
  if (providerName === 'anthropic') {
    return {
      mode: 'anthropic_cache',
      options: {
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
      },
    };
  }
  return { mode: 'standard', options: { system, prompt } };
}

type BaseCallOptions = {
  readonly role: AiRole;
  readonly providerName: string;
  readonly model: () => LanguageModel;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly system: string;
  readonly prompt: string;
  readonly maxRetries?: number;
};

type GenerateObjectOptions<T> = BaseCallOptions & {
  readonly schema: unknown;
};

function normalizeUsage(usage?: { inputTokens?: number | undefined; outputTokens?: number | undefined; totalTokens?: number | undefined }) {
  return {
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    totalTokens: usage?.totalTokens ?? 0,
  };
}

function emitFailure(role: AiRole, err: unknown): void {
  eventBus.emit('ai_call_failed', {
    role,
    error: err instanceof Error ? err.message : String(err),
  });
}

export async function callGenerateText(
  opts: BaseCallOptions,
): Promise<{ readonly text: string }> {
  const { role, providerName, model, temperature, maxTokens, system, prompt } = opts;
  const maxRetries = opts.maxRetries ?? 2;
  const msgOpts = buildAiCallMessages(providerName, system, prompt);
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await generateText({
        model: model(),
        temperature,
        maxOutputTokens: maxTokens,
        ...msgOpts.options,
      } as any);
      recordUsage(role, normalizeUsage(result.usage));
      return { text: result.text };
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) {
        emitFailure(role, err);
      }
    }
  }
  throw lastError;
}

export async function callGenerateObject<T>(
  opts: GenerateObjectOptions<T>,
): Promise<{ readonly object: T }> {
  const { role, providerName, model, temperature, maxTokens, system, prompt, schema } = opts;
  const maxRetries = opts.maxRetries ?? 2;
  const msgOpts = buildAiCallMessages(providerName, system, prompt);
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await generateObject({
        model: model(),
        schema,
        temperature,
        maxOutputTokens: maxTokens,
        ...msgOpts.options,
      } as any);
      recordUsage(role, normalizeUsage(result.usage));
      return { object: result.object as T };
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) {
        emitFailure(role, err);
      }
    }
  }
  throw lastError;
}

export async function* callStreamText(
  opts: BaseCallOptions,
): AsyncGenerator<string> {
  const { role, providerName, model, temperature, maxTokens, system, prompt } = opts;
  const maxRetries = opts.maxRetries ?? 2;
  const msgOpts = buildAiCallMessages(providerName, system, prompt);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = streamText({
        model: model(),
        temperature,
        maxOutputTokens: maxTokens,
        ...msgOpts.options,
      } as any);
      for await (const chunk of result.textStream) {
        yield chunk;
      }
      const usage = await result.usage;
      recordUsage(role, normalizeUsage(usage));
      return;
    } catch (err) {
      if (attempt === maxRetries) {
        emitFailure(role, err);
        recordUsage(role, { inputTokens: 0, outputTokens: 0, totalTokens: 0 });
        throw err;
      }
    }
  }
}
