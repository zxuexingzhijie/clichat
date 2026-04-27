import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { NpcDialogue } from '../schemas/npc-dialogue';

const mockUsage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };
const mockGenerateObject = mock(() => Promise.resolve({ object: {}, usage: mockUsage }));

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
    temperature: 0.8,
    maxTokens: 400,
  }),
}));

const { generateNpcDialogue } = await import('./npc-actor');

describe('generateNpcDialogue', () => {
  beforeEach(() => {
    mockGenerateObject.mockReset();
  });

  const npcProfile = {
    id: 'npc_old_blacksmith',
    name: '老铁匠',
    personality_tags: ['沉默寡言', '固执', '善良'],
    goals: ['守护黑松镇', '传承手艺'],
    backstory: '一个在黑松镇生活了四十年的老铁匠',
  };

  it('returns valid NpcDialogue object on success', async () => {
    const expected: NpcDialogue = {
      dialogue: '嗯？你要打什么？说吧，别浪费我时间。',
      emotionTag: 'neutral',
      shouldRemember: false,
      sentiment: 'neutral',
    };
    mockGenerateObject.mockResolvedValueOnce({ object: expected, usage: mockUsage });

    const result = await generateNpcDialogue(
      npcProfile,
      '铁匠铺内',
      '和铁匠说话',
      ['上次帮忙修了剑'],
    );
    expect(result).toEqual(expected);
    expect(result.emotionTag).toBe('neutral');
  });

  it('returns fallback dialogue on failure', async () => {
    mockGenerateObject
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'));

    const result = await generateNpcDialogue(
      npcProfile,
      '铁匠铺内',
      '和铁匠说话',
      [],
      { maxRetries: 2 },
    );
    expect(result.dialogue).toContain('老铁匠');
    expect(result.emotionTag).toBe('neutral');
    expect(result.shouldRemember).toBe(false);
    expect(result.sentiment).toBe('neutral');
  });

  it('retries on first failure then succeeds', async () => {
    const expected: NpcDialogue = {
      dialogue: '今天天气不错。',
      emotionTag: 'happy',
      shouldRemember: true,
      sentiment: 'positive',
    };
    mockGenerateObject
      .mockRejectedValueOnce(new Error('Schema validation failed'))
      .mockResolvedValueOnce({ object: expected, usage: mockUsage });

    const result = await generateNpcDialogue(
      npcProfile,
      '铁匠铺内',
      '打招呼',
      [],
      { maxRetries: 2 },
    );
    expect(result).toEqual(expected);
    expect(mockGenerateObject).toHaveBeenCalledTimes(2);
  });
});
