import { describe, test, expect } from 'bun:test';
import { getRoleConfig, getModel, type AiRole, type RoleConfig } from './providers';

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
