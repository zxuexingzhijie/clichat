import { describe, it, expect } from 'bun:test';

const source = await Bun.file(new URL('./dialogue-options-generator.ts', import.meta.url)).text();

describe('generateDialogueOptions', () => {
  it('uses full history instead of fixed last 4 messages', () => {
    expect(source).toContain('recentHistory');
    expect(source).toContain('?.map((m) =>');
    expect(source).not.toContain('slice(-4)');
    expect(source).not.toContain('.slice(-4)');
  });
});
