import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { RetrievalPlan } from '../schemas/retrieval-plan';

const mockGenerateObject = mock(() => Promise.resolve({ object: {} }));

mock.module('@ai-sdk/google', () => ({
  google: () => 'mock-model',
}));

mock.module('ai', () => ({
  generateObject: mockGenerateObject,
  generateText: mock(() => Promise.resolve({ text: '' })),
  streamText: mock(() => ({ textStream: (async function* () {})() })),
}));

mock.module('../providers', () => ({
  getRoleConfig: () => ({
    model: () => 'mock-model',
    temperature: 0.1,
    maxTokens: 200,
  }),
}));

const { generateRetrievalPlan } = await import('./retrieval-planner');

describe('generateRetrievalPlan', () => {
  beforeEach(() => {
    mockGenerateObject.mockReset();
  });

  const baseContext = {
    sceneId: 'scene-001',
    locationName: '黑松镇广场',
    playerIntent: '和铁匠交谈',
    activeNpcIds: ['npc-blacksmith'],
    activeQuestIds: ['quest-001'],
  };

  it('returns valid retrieval plan on success', async () => {
    const expected: RetrievalPlan = {
      codexIds: ['loc-blackpine', 'npc-blacksmith'],
      npcIds: ['npc-blacksmith'],
      questIds: ['quest-001'],
      reasoning: '玩家要和铁匠交谈，需要铁匠信息和当前地点信息',
    };
    mockGenerateObject.mockResolvedValueOnce({ object: expected });

    const result = await generateRetrievalPlan(baseContext);
    expect(result).toEqual(expected);
    expect(result.codexIds).toHaveLength(2);
    expect(result.npcIds).toEqual(['npc-blacksmith']);
  });

  it('returns default plan on failure', async () => {
    mockGenerateObject
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'));

    const result = await generateRetrievalPlan(baseContext, { maxRetries: 2 });
    expect(result.codexIds).toEqual([]);
    expect(result.npcIds).toEqual([]);
    expect(result.questIds).toEqual([]);
    expect(result.reasoning).toBe('fallback');
  });

  it('retries on first failure then succeeds', async () => {
    const expected: RetrievalPlan = {
      codexIds: ['loc-blackpine'],
      npcIds: [],
      questIds: [],
      reasoning: '只需要地点信息',
    };
    mockGenerateObject
      .mockRejectedValueOnce(new Error('Schema error'))
      .mockResolvedValueOnce({ object: expected });

    const result = await generateRetrievalPlan(baseContext, { maxRetries: 1 });
    expect(result).toEqual(expected);
    expect(mockGenerateObject).toHaveBeenCalledTimes(2);
  });
});
