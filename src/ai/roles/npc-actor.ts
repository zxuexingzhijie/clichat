import { generateObject, streamText } from 'ai';
import { getRoleConfig } from '../providers';
import { recordUsage } from '../../state/cost-session-store';
import { eventBus } from '../../events/event-bus';
import { NpcDialogueSchema, type NpcDialogue } from '../schemas/npc-dialogue';
import { buildNpcSystemPrompt, buildNpcUserPrompt, type NpcProfile } from '../prompts/npc-system';
import { getFallbackDialogue } from '../utils/fallback';

export type NpcActorOptions = {
  readonly maxRetries?: number;
};

export async function generateNpcDialogue(
  npcProfile: NpcProfile,
  scene: string,
  playerAction: string,
  memories: readonly string[],
  options?: NpcActorOptions,
): Promise<NpcDialogue> {
  const config = getRoleConfig('npc-actor');
  const maxRetries = options?.maxRetries ?? 2;
  const system = buildNpcSystemPrompt(npcProfile);
  const prompt = buildNpcUserPrompt({ scene, playerAction, memories });
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      let object: NpcDialogue;
      let usage: { inputTokens: number | undefined; outputTokens: number | undefined; totalTokens: number | undefined };

      if (config.providerName === 'anthropic') {
        const result = await generateObject({
          model: config.model(),
          schema: NpcDialogueSchema,
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
        object = result.object as NpcDialogue;
        usage = result.usage;
      } else {
        const result = await generateObject({
          model: config.model(),
          schema: NpcDialogueSchema,
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens,
          system,
          prompt,
        });
        object = result.object as NpcDialogue;
        usage = result.usage;
      }

      recordUsage('npc-actor', { inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0, totalTokens: usage.totalTokens ?? 0 });
      return object;
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) {
        eventBus.emit('ai_call_failed', {
          role: 'npc-actor',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  void lastError;
  return getFallbackDialogue(npcProfile.name);
}

export async function* streamNpcDialogue(
  npcProfile: NpcProfile,
  scene: string,
  playerAction: string,
  memories: readonly string[],
  options?: NpcActorOptions,
): AsyncGenerator<string> {
  const config = getRoleConfig('npc-actor');
  const maxRetries = options?.maxRetries ?? 2;
  const system = buildNpcSystemPrompt(npcProfile);
  const prompt = buildNpcUserPrompt({ scene, playerAction, memories });

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
      recordUsage('npc-actor', {
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
      });
      return;
    } catch (err) {
      if (attempt === maxRetries) {
        eventBus.emit('ai_call_failed', {
          role: 'npc-actor',
          error: err instanceof Error ? err.message : String(err),
        });
        recordUsage('npc-actor', { inputTokens: 0, outputTokens: 0, totalTokens: 0 });
        yield getFallbackDialogue(npcProfile.name).dialogue;
        return;
      }
    }
  }
}
