import { getRoleConfig } from '../providers';
import { callGenerateObject } from '../utils/ai-caller';
import { RetrievalPlanSchema, type RetrievalPlan } from '../schemas/retrieval-plan';
import { RETRIEVAL_PLANNER_SYSTEM, buildRetrievalPrompt, type RetrievalPromptContext } from '../prompts/retrieval-system';

export type RetrievalPlannerOptions = {
  readonly maxRetries?: number;
};

const FALLBACK_PLAN: RetrievalPlan = {
  codexIds: [],
  npcIds: [],
  questIds: [],
  reasoning: 'fallback',
};

export async function generateRetrievalPlan(
  context: RetrievalPromptContext,
  options?: RetrievalPlannerOptions,
): Promise<RetrievalPlan> {
  const config = getRoleConfig('retrieval-planner');
  const prompt = buildRetrievalPrompt(context);

  try {
    const { object } = await callGenerateObject<RetrievalPlan>({
      role: 'retrieval-planner',
      providerName: config.providerName,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      system: RETRIEVAL_PLANNER_SYSTEM,
      prompt,
      schema: RetrievalPlanSchema,
      maxRetries: options?.maxRetries,
    });
    return object;
  } catch {
    return FALLBACK_PLAN;
  }
}
