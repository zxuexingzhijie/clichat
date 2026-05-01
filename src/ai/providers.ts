import type { LanguageModel } from 'ai';
import { google } from '@ai-sdk/google';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { loadAiConfig } from './config/ai-config-loader';
import type { AiConfig } from './config/ai-config-schema';

export type AiRole =
  | 'narrative-director'
  | 'npc-actor'
  | 'retrieval-planner'
  | 'safety-filter'
  | 'summarizer'
  | 'quest-planner'
  | 'branch-narrator'
  | 'dialogue-options';

export type ModelPricing = {
  readonly price_per_1k_input_tokens?: number;
  readonly price_per_1k_output_tokens?: number;
};

export type RoleConfig = {
  readonly model: () => LanguageModel;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly providerName: string;
  readonly pricing?: ModelPricing;
};

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const openaiCompatible = createOpenAICompatible({
  name: 'custom',
  baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL ?? 'http://localhost:11434/v1',
  apiKey: process.env.OPENAI_COMPATIBLE_API_KEY ?? 'not-needed',
});

const alibaba = createOpenAI({
  baseURL: process.env.ALIBABA_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: process.env.ALIBABA_API_KEY ?? '',
});

const PROVIDER_FACTORIES: Record<string, (modelId: string) => LanguageModel> = {
  google: (id) => google(id) as unknown as LanguageModel,
  openai: (id) => openai(id) as unknown as LanguageModel,
  anthropic: (id) => anthropic(id) as unknown as LanguageModel,
  deepseek: (id) => deepseek(id) as unknown as LanguageModel,
  alibaba: (id) => alibaba(id) as unknown as LanguageModel,
  'openai-compatible': (id) => openaiCompatible(id) as unknown as LanguageModel,
};

const DEFAULT_ROLE_CONFIGS: Record<AiRole, RoleConfig> = {
  'narrative-director': { model: () => google('gemini-2.0-flash') as unknown as LanguageModel, temperature: 0.7, maxTokens: 512, providerName: 'google' },
  'npc-actor': { model: () => google('gemini-2.0-flash') as unknown as LanguageModel, temperature: 0.8, maxTokens: 400, providerName: 'google' },
  'retrieval-planner': { model: () => google('gemini-2.0-flash') as unknown as LanguageModel, temperature: 0.1, maxTokens: 200, providerName: 'google' },
  'safety-filter': { model: () => google('gemini-2.0-flash') as unknown as LanguageModel, temperature: 0.0, maxTokens: 50, providerName: 'google' },
  'summarizer': { model: () => google('gemini-2.0-flash') as unknown as LanguageModel, temperature: 0.3, maxTokens: 800, providerName: 'google' },
  'quest-planner': { model: () => google('gemini-2.0-flash') as unknown as LanguageModel, temperature: 0.6, maxTokens: 2000, providerName: 'google' },
  'branch-narrator': { model: () => google('gemini-2.0-flash') as unknown as LanguageModel, temperature: 0.7, maxTokens: 200, providerName: 'google' },
  'dialogue-options': { model: () => google('gemini-2.0-flash') as unknown as LanguageModel, temperature: 0.7, maxTokens: 200, providerName: 'google' },
};

let runtimeRoleConfigs: Record<AiRole, RoleConfig> = { ...DEFAULT_ROLE_CONFIGS };

export function buildRoleConfigs(config: AiConfig, profile: string): Record<AiRole, RoleConfig> {
  const profileData = config.profiles[profile] ?? config.profiles[config.default_profile];
  if (!profileData) {
    throw new Error(
      `Profile '${profile}' not found in ai-config.yaml and no default_profile fallback`,
    );
  }
  const defaultProfileData = config.profiles[config.default_profile];
  return Object.fromEntries(
    (Object.keys(DEFAULT_ROLE_CONFIGS) as AiRole[]).map((role) => {
      const entry = profileData.roles[role] ?? defaultProfileData?.roles[role];
      if (!entry) return [role, DEFAULT_ROLE_CONFIGS[role]!];
      const factory = PROVIDER_FACTORIES[entry.provider];
      if (!factory) {
        throw new Error(
          `Unknown provider '${entry.provider}' for role '${role}'. Supported: ${Object.keys(PROVIDER_FACTORIES).join(', ')}`,
        );
      }
      return [
        role,
        {
          model: () => factory(entry.model),
          temperature: entry.temperature ?? DEFAULT_ROLE_CONFIGS[role]!.temperature,
          maxTokens: entry.maxTokens ?? DEFAULT_ROLE_CONFIGS[role]!.maxTokens,
          providerName: entry.provider,
          pricing: entry.pricing,
        } satisfies RoleConfig,
      ];
    }),
  ) as Record<AiRole, RoleConfig>;
}

export async function initRoleConfigs(configPath: string): Promise<void> {
  const config = await loadAiConfig(configPath);
  runtimeRoleConfigs = buildRoleConfigs(config, config.default_profile);
}

export function getRoleConfig(role: AiRole): RoleConfig {
  return runtimeRoleConfigs[role] ?? DEFAULT_ROLE_CONFIGS[role];
}

export function getModel(role: AiRole): LanguageModel {
  return getRoleConfig(role).model();
}
