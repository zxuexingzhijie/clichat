import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { BranchDiffResult } from '../../engine/branch-diff';

const mockUsage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };
const mockGenerateText = mock(() => Promise.resolve({ text: '在这条支线中，你选择了帮助猎人，声望更高但错过了暗影刺客的线索。', usage: mockUsage }));

mock.module('ai', () => ({
  generateText: mockGenerateText,
  generateObject: mock(() => Promise.resolve({ object: {}, usage: mockUsage })),
  streamText: mock(() => ({ textStream: (async function* () {})(), usage: Promise.resolve(mockUsage) })),
}));

mock.module('../providers', () => ({
  getRoleConfig: () => ({
    providerName: 'google',
    model: () => ({}),
    temperature: 0.7,
    maxTokens: 200,
  }),
}));

mock.module('../../state/cost-session-store', () => ({ recordUsage: mock(() => {}) }));
mock.module('../../events/event-bus', () => ({ eventBus: { emit: mock(() => {}) } }));

const { generateBranchNarrative } = await import('./branch-narrator');

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
  beforeEach(() => {
    mockGenerateText.mockReset();
    mockGenerateText.mockImplementation(() => Promise.resolve({ text: '在这条支线中，你选择了帮助猎人，声望更高但错过了暗影刺客的线索。', usage: mockUsage }));
  });

  it('returns LLM-generated narrative string', async () => {
    const result = await generateBranchNarrative('main', 'hunter-path', mockDiff);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty string on LLM error', async () => {
    mockGenerateText.mockImplementation(() => Promise.reject(new Error('LLM timeout')));
    const result = await generateBranchNarrative('main', 'hunter-path', mockDiff);
    expect(result).toBe('');
  });
});
