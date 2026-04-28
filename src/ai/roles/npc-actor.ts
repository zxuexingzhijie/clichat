import { getRoleConfig } from '../providers';
import { callGenerateObject, callStreamText } from '../utils/ai-caller';
import { NpcDialogueSchema, type NpcDialogue } from '../schemas/npc-dialogue';
import { buildNpcSystemPrompt, buildNpcUserPrompt, type NpcProfile } from '../prompts/npc-system';
import { getFallbackDialogue } from '../utils/fallback';

export type NpcActorOptions = {
  readonly maxRetries?: number;
  readonly archiveSummary?: string;
  readonly relevantCodex?: readonly string[];
  readonly conversationHistory?: readonly { readonly speaker: string; readonly text: string }[];
};

export async function generateNpcDialogue(
  npcProfile: NpcProfile,
  scene: string,
  playerAction: string,
  memories: readonly string[],
  options?: NpcActorOptions,
): Promise<NpcDialogue> {
  const config = getRoleConfig('npc-actor');
  const system = buildNpcSystemPrompt(npcProfile);
  const prompt = buildNpcUserPrompt({
    scene,
    playerAction,
    memories,
    archiveSummary: options?.archiveSummary,
    relevantCodex: options?.relevantCodex,
    conversationHistory: options?.conversationHistory,
  });

  try {
    const { object } = await callGenerateObject<NpcDialogue>({
      role: 'npc-actor',
      providerName: config.providerName,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      system,
      prompt,
      schema: NpcDialogueSchema,
      maxRetries: options?.maxRetries,
    });
    return object;
  } catch {
    return getFallbackDialogue(npcProfile.name);
  }
}

export async function* streamNpcDialogue(
  npcProfile: NpcProfile,
  scene: string,
  playerAction: string,
  memories: readonly string[],
  options?: NpcActorOptions,
): AsyncGenerator<string> {
  const config = getRoleConfig('npc-actor');
  const system = buildNpcSystemPrompt(npcProfile);
  const prompt = buildNpcUserPrompt({
    scene,
    playerAction,
    memories,
    archiveSummary: options?.archiveSummary,
    relevantCodex: options?.relevantCodex,
    conversationHistory: options?.conversationHistory,
  });

  try {
    yield* callStreamText({
      role: 'npc-actor',
      providerName: config.providerName,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      system,
      prompt,
      maxRetries: options?.maxRetries,
    });
  } catch {
    yield getFallbackDialogue(npcProfile.name).dialogue;
  }
}
