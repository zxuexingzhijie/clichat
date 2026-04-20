import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { NpcDialogue } from '../schemas/npc-dialogue';

const mockGenerateObject = mock(() => Promise.resolve({ object: {} }));

mock.module('ai', () => ({
  generateObject: mockGenerateObject,
}));

mock.module('@ai-sdk/google', () => ({
  google: () => 'mock-model',
}));

const { generateNpcDialogue } = await import('./npc-actor');

describe('generateNpcDialogue', () => {
  beforeEach(() => {
    mockGenerateObject.mockReset();
  });

  const npcProfile = {
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
      relationshipDelta: 0,
    };
    mockGenerateObject.mockResolvedValueOnce({ object: expected });

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
    expect(result.relationshipDelta).toBe(0);
  });

  it('retries on first failure then succeeds', async () => {
    const expected: NpcDialogue = {
      dialogue: '今天天气不错。',
      emotionTag: 'happy',
      shouldRemember: true,
      relationshipDelta: 0.1,
    };
    mockGenerateObject
      .mockRejectedValueOnce(new Error('Schema validation failed'))
      .mockResolvedValueOnce({ object: expected });

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
