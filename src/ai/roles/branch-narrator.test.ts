import { describe, it, expect, mock } from 'bun:test';
import type { BranchDiffResult } from '../../engine/branch-diff';

mock.module('../providers', () => ({
  getRoleConfig: () => ({
    providerName: 'google',
    model: () => ({}),
    temperature: 0.7,
    maxTokens: 200,
  }),
}));

mock.module('../utils/ai-caller', () => ({
  callGenerateText: async () => ({ text: '在这条支线中，你选择了帮助猎人，声望更高但错过了暗影刺客的线索。' }),
}));

import { generateBranchNarrative } from './branch-narrator';

const mockDiff: BranchDiffResult = {
  diffs: [
    { category: 'quest', marker: '+', key: 'quest_wolf_bounty', description: '完成狼群悬赏', isHighImpact: true },
    { category: 'npc_relation', marker: '~', key: 'npc_hunter', description: '与猎人关系改善', isHighImpact: false },
  ],
  totalCount: 2,
  highImpactCount: 1,
  summary: '2 differences',
};

describe('generateBranchNarrative', () => {
  it('returns LLM-generated narrative string', async () => {
    const result = await generateBranchNarrative('main', 'hunter-path', mockDiff);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty string on LLM error', async () => {
    mock.module('../utils/ai-caller', () => ({
      callGenerateText: async () => { throw new Error('LLM timeout'); },
    }));
    const { generateBranchNarrative: gen } = await import('./branch-narrator?t=' + Date.now());
    const result = await gen('main', 'hunter-path', mockDiff);
    expect(result).toBe('');
  });
});
