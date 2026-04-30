import { describe, it, expect, mock, beforeEach } from 'bun:test';

const mockUsage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };
const mockGenerateText = mock(() => Promise.resolve({ text: '', usage: mockUsage }));
const mockStreamText = mock(() => ({
  textStream: (async function* (): AsyncGenerator<string> {
    yield '月光';
    yield '洒落';
  })(),
  usage: Promise.resolve(mockUsage),
}));

mock.module('@ai-sdk/google', () => ({
  google: () => 'mock-model',
}));

const mockGenerateObject = mock(() => Promise.resolve({ object: {}, usage: mockUsage }));

mock.module('ai', () => ({
  generateText: mockGenerateText,
  generateObject: mockGenerateObject,
  streamText: mockStreamText,
}));

mock.module('../providers', () => ({
  getRoleConfig: () => ({
    model: () => 'mock-model',
    temperature: 0.7,
    maxTokens: 512,
  }),
}));

const { generateNarration, streamNarration } = await import('./narrative-director');

describe('generateNarration', () => {
  beforeEach(() => {
    mockGenerateText.mockReset();
    mockGenerateObject.mockReset();
    mockStreamText.mockReset();
  });

  const baseContext = {
    sceneType: 'exploration' as const,
    codexEntries: [{ id: 'loc-001', description: '黑松镇是一个边境小镇' }],
    playerAction: '向北走',
    recentNarration: ['你站在镇中心的广场上。'],
    sceneContext: '黑松镇广场',
  };

  it('returns text on success', async () => {
    const narration = '月光从破碎的穹顶洒下，照亮满地的碎石。你踏入北方的小径，感受到夜风的凉意。';
    mockGenerateObject.mockResolvedValueOnce({ object: { text: narration }, usage: mockUsage });
    const result = await generateNarration(baseContext);
    expect(result).toBe(narration);
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
  });

  it('returns fallback on failure after retries', async () => {
    mockGenerateObject
      .mockRejectedValueOnce(new Error('API error'))
      .mockRejectedValueOnce(new Error('API error'))
      .mockRejectedValueOnce(new Error('API error'));
    const result = await generateNarration(baseContext, { maxRetries: 2 });
    expect(result).toBe('你环顾四周，一切似乎很平静。');
    expect(mockGenerateObject).toHaveBeenCalledTimes(3);
  });

  it('returns fallback when schema rejects long text', async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error('Zod validation failed: text too long'));
    const result = await generateNarration(baseContext, { maxRetries: 0 });
    expect(result).toBe('你环顾四周，一切似乎很平静。');
  });

  it('returns fallback when schema rejects short text', async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error('Zod validation failed: text too short'));
    const result = await generateNarration(baseContext, { maxRetries: 0 });
    expect(result).toBe('你环顾四周，一切似乎很平静。');
  });
});

describe('streamNarration', () => {
  beforeEach(() => {
    mockGenerateText.mockReset();
    mockStreamText.mockReset();
  });

  const baseContext = {
    sceneType: 'combat' as const,
    codexEntries: [],
    playerAction: '攻击',
    recentNarration: [],
    sceneContext: '森林空地',
  };

  it('yields chunks from stream', async () => {
    mockStreamText.mockReturnValueOnce({
      textStream: (async function* () {
        yield '长剑';
        yield '划过';
      })(),
      usage: Promise.resolve(mockUsage),
    });

    const chunks: string[] = [];
    for await (const chunk of streamNarration(baseContext)) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['长剑', '划过']);
  });

  it('yields fallback on stream failure after retries', async () => {
    mockStreamText
      .mockImplementationOnce(() => {
        throw new Error('Stream error');
      })
      .mockImplementationOnce(() => {
        throw new Error('Stream error');
      })
      .mockImplementationOnce(() => {
        throw new Error('Stream error');
      });

    const chunks: string[] = [];
    for await (const chunk of streamNarration(baseContext, { maxRetries: 2 })) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['战斗继续进行着。']);
  });
});
