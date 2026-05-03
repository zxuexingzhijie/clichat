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
import type { EcologicalMemoryContext } from '../utils/ecological-memory-retriever';

export type NarrativeContext = {
  readonly sceneType: SceneType;
  readonly codexEntries: NarrativeUserPromptContext['codexEntries'];
  readonly checkResult?: { readonly display: string };
  readonly playerAction: string;
  readonly recentNarration: readonly string[];
  readonly sceneContext: string;
  readonly narrativeContext?: NarrativePromptContext;
  readonly ecologicalMemory?: EcologicalMemoryContext;
};

export type NarrativeOptions = {
  readonly maxRetries?: number;
};

function getNarrativePromptContext(context: NarrativeContext): NarrativePromptContext | undefined {
  if (!context.ecologicalMemory) return context.narrativeContext;
  if (context.narrativeContext) {
    return { ...context.narrativeContext, ecologicalMemory: context.ecologicalMemory };
  }
  return {
    storyAct: 'act1',
    atmosphereTags: [],
    ecologicalMemory: context.ecologicalMemory,
  };
}

export async function* streamNarration(
  context: NarrativeContext,
  options?: NarrativeOptions,
): AsyncGenerator<string> {
  const config = getRoleConfig('narrative-director');
  const system = buildNarrativeSystemPrompt(context.sceneType, getNarrativePromptContext(context));
  const prompt = buildNarrativeUserPrompt(context);

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
  const system = buildNarrativeSystemPrompt(context.sceneType, getNarrativePromptContext(context));
  const prompt = buildNarrativeUserPrompt(context);

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
