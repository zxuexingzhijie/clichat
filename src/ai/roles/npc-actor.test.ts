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

const { generateNpcDialogue, streamNpcDialogue } = await import('./npc-actor');

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

describe('generateNpcDialogue — history forwarding', () => {
  const npcProfile = {
    id: 'npc_test_history',
    name: '历史测试NPC',
    personality_tags: ['neutral'],
    goals: ['test'],
    backstory: '测试用',
  };

  beforeEach(() => {
    mockGenerateObject.mockReset();
    mockGenerateObject.mockResolvedValue({
      object: {
        dialogue: '...',
        emotionTag: 'neutral',
        shouldRemember: false,
        sentiment: 'neutral',
      },
      usage: mockUsage,
    });
  });

  it('forwards conversationHistory as messages[] (not prompt) to generateObject', async () => {
    await generateNpcDialogue(
      npcProfile,
      '测试场景',
      '问候',
      [],
      {
        conversationHistory: [
          { role: 'user', content: 'q' },
          { role: 'assistant', content: 'a' },
        ],
      },
    );
    const callArgs = (mockGenerateObject.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(callArgs).toHaveProperty('messages');
    expect(callArgs).not.toHaveProperty('prompt');
  });
});

describe('narrativeContext forwarding', () => {
  const npcProfile = {
    id: 'npc_test',
    name: '测试NPC',
    personality_tags: ['cautious'],
    goals: ['survive'],
    backstory: '一个普通的商人',
    knowledgeProfile: {
      trust_gates: [{ min_trust: 5, reveals: '将军的秘密' }],
    },
  };

  beforeEach(() => {
    mockGenerateObject.mockReset();
    mockGenerateObject.mockResolvedValue({ object: {
      dialogue: '...',
      emotionTag: 'neutral',
      shouldRemember: false,
      sentiment: 'neutral',
    }, usage: mockUsage });
  });

  it('generateNpcDialogue with narrativeContext — system arg contains act/atmosphere text', async () => {
    await generateNpcDialogue(
      npcProfile,
      '铁匠铺内',
      '打招呼',
      [],
      undefined,
      { storyAct: 'act3', atmosphereTags: ['沉重', '末日'] },
      0,
    );
    const callArgs = (mockGenerateObject.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(callArgs.system).toContain('当前故事阶段：act3');
    expect(callArgs.system).toContain('沉重、末日');
  });

  it('generateNpcDialogue without narrativeContext — system arg does NOT contain 当前故事阶段', async () => {
    await generateNpcDialogue(
      npcProfile,
      '铁匠铺内',
      '打招呼',
      [],
    );
    const callArgs = (mockGenerateObject.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(callArgs.system).not.toContain('当前故事阶段');
  });

  it('streamNpcDialogue with trustLevel=7 and narrativeContext — streamText system contains trust-gate and act paragraph', async () => {
    const mockStreamText = (await import('ai')).streamText as ReturnType<typeof mock>;
    mockStreamText.mockReturnValueOnce({ textStream: (async function* () {})() });

    const chunks: string[] = [];
    for await (const chunk of streamNpcDialogue(
      npcProfile,
      '铁匠铺内',
      '打招呼',
      [],
      undefined,
      { storyAct: 'act1', atmosphereTags: ['紧张'] },
      7,
    )) {
      chunks.push(chunk);
    }

    const streamCalls = mockStreamText.mock.calls;
    const lastCallArgs = (streamCalls[streamCalls.length - 1] as unknown as [Record<string, unknown>])[0];
    expect(lastCallArgs.system).toContain('将军的秘密');
    expect(lastCallArgs.system).toContain('当前故事阶段：act1');
  });
});
