import { getRoleConfig } from '../providers';
import { callGenerateObject, callStreamText } from '../utils/ai-caller';
import { NpcDialogueSchema, type NpcDialogue } from '../schemas/npc-dialogue';
import { buildNpcSystemPrompt, buildNpcUserPrompt, type NpcProfile } from '../prompts/npc-system';
import { getFallbackDialogue } from '../utils/fallback';
import type { NarrativePromptContext } from '../prompts/narrative-system';
import type { EcologicalMemoryContext } from '../utils/ecological-memory-retriever';

export type NpcActorOptions = {
  readonly maxRetries?: number;
  readonly archiveSummary?: string;
  readonly relevantCodex?: readonly string[];
  readonly encounterCount?: number;
  readonly conversationHistory?: readonly { readonly role: 'user' | 'assistant'; readonly content: string }[];
  readonly ecologicalMemory?: EcologicalMemoryContext;
};

export async function generateNpcDialogue(
  npcProfile: NpcProfile,
  scene: string,
  playerAction: string,
  memories: readonly string[],
  options?: NpcActorOptions,
  narrativeContext?: NarrativePromptContext,
  trustLevel: number = 0,
): Promise<NpcDialogue> {
  const config = getRoleConfig('npc-actor');
  const system = buildNpcSystemPrompt(npcProfile, trustLevel, narrativeContext);
  const prompt = buildNpcUserPrompt({
    scene,
    playerAction,
    memories,
    encounterCount: options?.encounterCount,
    archiveSummary: options?.archiveSummary,
    relevantCodex: options?.relevantCodex,
    ecologicalMemory: options?.ecologicalMemory,
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
      history: options?.conversationHistory,
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
  narrativeContext?: NarrativePromptContext,
  trustLevel: number = 0,
): AsyncGenerator<string> {
  const config = getRoleConfig('npc-actor');
  const system = buildNpcSystemPrompt(npcProfile, trustLevel, narrativeContext);
  const prompt = buildNpcUserPrompt({
    scene,
    playerAction,
    memories,
    encounterCount: options?.encounterCount,
    archiveSummary: options?.archiveSummary,
    relevantCodex: options?.relevantCodex,
    ecologicalMemory: options?.ecologicalMemory,
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
      history: options?.conversationHistory,
    });
  } catch {
    yield getFallbackDialogue(npcProfile.name).dialogue;
  }
}
