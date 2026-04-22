import { parse as parseYaml } from 'yaml';
import { AiConfigSchema, type AiConfig } from './ai-config-schema';

export async function loadAiConfig(configPath: string): Promise<AiConfig> {
  const file = Bun.file(configPath);
  const text = await file.text();
  const parsed = parseYaml(text) as unknown;
  const result = AiConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`ai-config.yaml validation failed:\n${issues}`);
  }
  return result.data;
}
