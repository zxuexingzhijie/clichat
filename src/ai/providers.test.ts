import { describe, test, expect } from 'bun:test';
import { getRoleConfig, getModel, buildRoleConfigs, type AiRole, type RoleConfig } from './providers';
import type { AiConfig } from './config/ai-config-schema';

describe('AI providers', () => {
  const roles: AiRole[] = [
    'narrative-director',
    'npc-actor',
    'retrieval-planner',
    'safety-filter',
    'summarizer',
    'quest-planner',
  ];

  test('getRoleConfig returns config for all roles', () => {
    for (const role of roles) {
      const config = getRoleConfig(role);
      expect(config).toBeDefined();
      expect(typeof config.temperature).toBe('number');
      expect(typeof config.maxTokens).toBe('number');
      expect(typeof config.model).toBe('function');
    }
  });

  test('getModel returns a LanguageModel for all roles', () => {
    for (const role of roles) {
      const model = getModel(role);
      expect(model).toBeDefined();
    }
  });

  test('narrative-director has correct config', () => {
    const config = getRoleConfig('narrative-director');
    expect(config.temperature).toBe(0.7);
    expect(config.maxTokens).toBe(512);
  });

  test('npc-actor has correct config', () => {
    const config = getRoleConfig('npc-actor');
    expect(config.temperature).toBe(0.8);
    expect(config.maxTokens).toBe(400);
  });

  test('retrieval-planner has correct config', () => {
    const config = getRoleConfig('retrieval-planner');
    expect(config.temperature).toBe(0.1);
    expect(config.maxTokens).toBe(200);
  });

  test('safety-filter has correct config', () => {
    const config = getRoleConfig('safety-filter');
    expect(config.temperature).toBe(0.0);
    expect(config.maxTokens).toBe(50);
  });

  test('summarizer has correct config', () => {
    const config = getRoleConfig('summarizer');
    expect(config.temperature).toBe(0.3);
    expect(config.maxTokens).toBe(800);
  });

  test('quest-planner has correct config', () => {
    const config = getRoleConfig('quest-planner');
    expect(config.temperature).toBe(0.6);
    expect(config.maxTokens).toBe(2000);
  });

  test('all roles have maxTokens explicitly set (T-02-02 mitigation)', () => {
    for (const role of roles) {
      const config = getRoleConfig(role);
      expect(config.maxTokens).toBeGreaterThan(0);
    }
  });
});

describe('buildRoleConfigs', () => {
  const allRoles: AiRole[] = [
    'narrative-director',
    'npc-actor',
    'retrieval-planner',
    'safety-filter',
    'summarizer',
    'quest-planner',
  ];

  const validConfig: AiConfig = {
    default_profile: 'balanced',
    profiles: {
      balanced: {
        roles: {
          'narrative-director': { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.7, maxTokens: 512 },
          'npc-actor': { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.8, maxTokens: 400 },
          'retrieval-planner': { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.1, maxTokens: 200 },
          'safety-filter': { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.0, maxTokens: 50 },
          'summarizer': { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.3, maxTokens: 800 },
          'quest-planner': { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.6, maxTokens: 2000 },
        },
      },
    },
  };

  test('buildRoleConfigs with valid AiConfig returns all 6 AiRoles', () => {
    const configs = buildRoleConfigs(validConfig, 'balanced');
    for (const role of allRoles) {
      expect(configs[role]).toBeDefined();
      expect(typeof configs[role]!.model).toBe('function');
      expect(typeof configs[role]!.temperature).toBe('number');
      expect(typeof configs[role]!.maxTokens).toBe('number');
    }
  });

  test('buildRoleConfigs with unknown provider throws Error containing provider name', () => {
    const configWithBadProvider: AiConfig = {
      default_profile: 'balanced',
      profiles: {
        balanced: {
          roles: {
            'narrative-director': { provider: 'nonexistent-provider', model: 'some-model' },
          },
        },
      },
    };
    expect(() => buildRoleConfigs(configWithBadProvider, 'balanced')).toThrow('nonexistent-provider');
  });

  test('buildRoleConfigs falls back to DEFAULT_ROLE_CONFIGS for roles absent from profile', () => {
    const sparseConfig: AiConfig = {
      default_profile: 'balanced',
      profiles: {
        balanced: {
          roles: {
            'narrative-director': { provider: 'google', model: 'gemini-2.0-flash' },
          },
        },
      },
    };
    const configs = buildRoleConfigs(sparseConfig, 'balanced');
    for (const role of allRoles) {
      expect(configs[role]).toBeDefined();
    }
    expect(configs['npc-actor']!.temperature).toBe(0.8);
    expect(configs['npc-actor']!.maxTokens).toBe(400);
  });

  test('getRoleConfig returns a valid config when initRoleConfigs not yet called (DEFAULT_ROLE_CONFIGS fallback)', () => {
    const config = getRoleConfig('narrative-director');
    expect(config).toBeDefined();
    expect(config.temperature).toBe(0.7);
    expect(config.maxTokens).toBe(512);
    expect(typeof config.model).toBe('function');
  });
});
