import { generateObject } from 'ai';
import { getRoleConfig } from '../providers';
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
  const maxRetries = options?.maxRetries ?? 2;
  const prompt = buildRetrievalPrompt(context);
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { object } = await generateObject({
        model: config.model(),
        schema: RetrievalPlanSchema,
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
        system: RETRIEVAL_PLANNER_SYSTEM,
        prompt,
      });
      return object;
    } catch (err) {
      lastError = err;
    }
  }

  return FALLBACK_PLAN;
}
