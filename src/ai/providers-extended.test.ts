import { describe, it, expect } from 'bun:test';
import { buildRoleConfigs } from './providers';
import type { AiConfig } from './config/ai-config-schema';

describe('provider config — extended', () => {
  it('empty profile inherits from default_profile', () => {
    const config = {
      default_profile: 'balanced',
      profiles: {
        balanced: {
          roles: {
            'narrative-director': { provider: 'deepseek', model: 'deepseek-v4-flash', temperature: 0.7, maxTokens: 512 },
          },
        },
        cheap: { roles: {} },
      },
    } as unknown as AiConfig;

    const result = buildRoleConfigs(config, 'cheap');
    expect(result['narrative-director'].providerName).toBe('deepseek');
  });

  it('alibaba provider is supported', () => {
    const config = {
      default_profile: 'test',
      profiles: {
        test: {
          roles: {
            'npc-actor': { provider: 'alibaba', model: 'qwen-plus', temperature: 0.8, maxTokens: 400 },
          },
        },
      },
    } as unknown as AiConfig;

    const result = buildRoleConfigs(config, 'test');
    expect(result['npc-actor'].providerName).toBe('alibaba');
  });

  it('openai-compatible provider is supported', () => {
    const config = {
      default_profile: 'test',
      profiles: {
        test: {
          roles: {
            'safety-filter': { provider: 'openai-compatible', model: 'local-model', temperature: 0, maxTokens: 50 },
          },
        },
      },
    } as unknown as AiConfig;

    const result = buildRoleConfigs(config, 'test');
    expect(result['safety-filter'].providerName).toBe('openai-compatible');
  });
});
