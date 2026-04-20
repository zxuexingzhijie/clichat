import { generateObject } from 'ai';
import { getRoleConfig } from '../providers';
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
      const { object } = await generateObject({
        model: config.model(),
        schema: NpcDialogueSchema,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        system,
        prompt,
      });
      return object;
    } catch (err) {
      lastError = err;
    }
  }

  return getFallbackDialogue(npcProfile.name);
}
