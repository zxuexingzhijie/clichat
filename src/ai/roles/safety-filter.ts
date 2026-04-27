import { getRoleConfig } from '../providers';
import { callGenerateObject } from '../utils/ai-caller';
import { SafetyFilterResultSchema, type SafetyFilterResult } from '../schemas/safety-filter';
import { SAFETY_SYSTEM_PROMPT } from '../prompts/safety-system';

const STATE_OVERRIDE_PATTERN = /(获得|失去|HP|MP|金币|等级|升级|gained|lost|level\s*up|gold|experience)\s*[+\-]?\d+/i;

export type SafetyFilterOptions = {
  readonly maxRetries?: number;
};

export async function checkSafety(
  text: string,
  options?: SafetyFilterOptions,
): Promise<SafetyFilterResult> {
  if (STATE_OVERRIDE_PATTERN.test(text)) {
    return {
      safe: false,
      reason: 'state_override_detected',
      category: 'state_override',
    };
  }

  const config = getRoleConfig('safety-filter');

  try {
    const { object } = await callGenerateObject<SafetyFilterResult>({
      role: 'safety-filter',
      providerName: config.providerName,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      system: SAFETY_SYSTEM_PROMPT,
      prompt: text,
      schema: SafetyFilterResultSchema,
      maxRetries: options?.maxRetries ?? 1,
    });
    return object;
  } catch {
    return { safe: false, reason: 'safety_check_unavailable', category: 'error' };
  }
}
