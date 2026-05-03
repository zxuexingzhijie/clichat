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

  it('passes ecological memory into the narrative system prompt', async () => {
    mockGenerateObject.mockResolvedValueOnce({ object: { text: '北门的告示在风里轻响，你意识到传言并不可靠。' }, usage: mockUsage });

    await generateNarration({
      ...baseContext,
      narrativeContext: {
        storyAct: 'act2',
        atmosphereTags: ['dread'],
        ecologicalMemory: {
          playerKnowledge: [],
          omitted: [],
          beliefs: [],
          facts: [
            {
              id: 'fact-confirmed',
              statement: '北门告示确实存在。',
              scope: 'location',
              scopeId: 'loc_north_gate',
              truthStatus: 'confirmed',
              confidence: 1,
              sourceEventIds: ['event-confirmed'],
              tags: [],
              createdAt: '2026-05-02T00:00:00.000Z',
              updatedAt: '2026-05-02T00:00:00.000Z',
            },
            {
              id: 'fact-rumor',
              statement: '传言北门外有幽灵。',
              scope: 'location',
              scopeId: 'loc_north_gate',
              truthStatus: 'rumor',
              confidence: 0.3,
              sourceEventIds: ['event-rumor'],
              tags: [],
              createdAt: '2026-05-02T00:00:00.000Z',
              updatedAt: '2026-05-02T00:00:00.000Z',
            },
          ],
          events: [],
        },
      },
    });

    const calls = (mockGenerateObject as unknown as { mock: { calls: [{ system?: string }][] } }).mock.calls;
    const call = calls[0]?.[0];
    expect(call?.system).toContain('Runtime world memory:');
    expect(call?.system).toContain('Confirmed world facts:');
    expect(call?.system).toContain('北门告示确实存在。');
    expect(call?.system).toContain('Local rumors:');
    expect(call?.system).toContain('传言北门外有幽灵。');
  });

  it('forwards codexEntries aiGrounding into the narrative prompt', async () => {
    mockGenerateObject.mockResolvedValueOnce({ object: { text: '北门雨水顺着告示边缘滑落。' }, usage: mockUsage });

    await generateNarration({
      sceneType: 'exploration',
      codexEntries: [
        {
          id: 'loc_north_gate',
          description: '玩家可见的北门描述',
          aiGrounding: {
            mustKnow: ['守卫私下害怕北方森林。'],
            mustNotInvent: ['不要发明龙袭击北门。'],
            tone: ['克制', '潮湿寒冷'],
          },
        },
      ],
      playerAction: '查看北门',
      recentNarration: [],
      sceneContext: '北门雨夜',
    });

    const calls = (mockGenerateObject as unknown as { mock: { calls: [{ prompt?: string }][] } }).mock.calls;
    const call = calls[0]?.[0];
    expect(call?.prompt).toContain('AI grounding');
    expect(call?.prompt).toContain('守卫私下害怕北方森林。');
    expect(call?.prompt).toContain('不要发明龙袭击北门。');
    expect(call?.prompt).toContain('克制');
    expect(call?.prompt).toContain('潮湿寒冷');
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
