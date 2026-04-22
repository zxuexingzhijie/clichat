import { describe, test, expect } from 'bun:test';
import { loadAiConfig } from './ai-config-loader';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const TMP_DIR = '/tmp';

function writeTmpYaml(name: string, content: string): string {
  const filePath = join(TMP_DIR, `${name}-${Date.now()}.yaml`);
  writeFileSync(filePath, content);
  return filePath;
}

describe('loadAiConfig', () => {
  test('valid YAML with all required fields parses successfully and returns typed AiConfig', async () => {
    const yamlContent = `
default_profile: balanced
profiles:
  balanced:
    roles:
      narrative-director:
        provider: google
        model: gemini-2.0-flash
        temperature: 0.7
        maxTokens: 512
`;
    const filePath = writeTmpYaml('valid', yamlContent);
    try {
      const config = await loadAiConfig(filePath);
      expect(config.default_profile).toBe('balanced');
      expect(config.profiles['balanced']).toBeDefined();
      expect(config.profiles['balanced']!.roles['narrative-director']).toBeDefined();
      expect(config.profiles['balanced']!.roles['narrative-director']!.provider).toBe('google');
      expect(config.profiles['balanced']!.roles['narrative-director']!.model).toBe('gemini-2.0-flash');
    } finally {
      unlinkSync(filePath);
    }
  });

  test('YAML with unknown provider string passes (provider validated later in buildRoleConfigs)', async () => {
    const yamlContent = `
default_profile: balanced
profiles:
  balanced:
    roles:
      narrative-director:
        provider: unknown-future-provider
        model: some-model
`;
    const filePath = writeTmpYaml('unknown-provider', yamlContent);
    try {
      const config = await loadAiConfig(filePath);
      expect(config.profiles['balanced']!.roles['narrative-director']!.provider).toBe('unknown-future-provider');
    } finally {
      unlinkSync(filePath);
    }
  });

  test('YAML missing profiles key throws with "ai-config.yaml validation failed"', async () => {
    const yamlContent = `
default_profile: balanced
`;
    const filePath = writeTmpYaml('missing-profiles', yamlContent);
    try {
      await expect(loadAiConfig(filePath)).rejects.toThrow('ai-config.yaml validation failed');
    } finally {
      unlinkSync(filePath);
    }
  });

  test('YAML with temperature > 2 throws with "ai-config.yaml validation failed"', async () => {
    const yamlContent = `
default_profile: balanced
profiles:
  balanced:
    roles:
      narrative-director:
        provider: google
        model: gemini-2.0-flash
        temperature: 3.5
`;
    const filePath = writeTmpYaml('bad-temperature', yamlContent);
    try {
      await expect(loadAiConfig(filePath)).rejects.toThrow('ai-config.yaml validation failed');
    } finally {
      unlinkSync(filePath);
    }
  });

  test('default_profile defaults to "balanced" when absent', async () => {
    const yamlContent = `
profiles:
  balanced:
    roles:
      narrative-director:
        provider: google
        model: gemini-2.0-flash
`;
    const filePath = writeTmpYaml('no-default-profile', yamlContent);
    try {
      const config = await loadAiConfig(filePath);
      expect(config.default_profile).toBe('balanced');
    } finally {
      unlinkSync(filePath);
    }
  });
});
