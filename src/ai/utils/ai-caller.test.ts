import { describe, it, expect, mock, beforeEach } from 'bun:test';

const mockUsage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };
const mockGenerateText = mock(() => Promise.resolve({ text: 'response', usage: mockUsage }));
const mockGenerateObject = mock(() => Promise.resolve({ object: { foo: 1 }, usage: mockUsage }));
const mockStreamText = mock(() => ({
  textStream: (async function* () { yield 'chunk'; })(),
  usage: Promise.resolve(mockUsage),
}));

mock.module('ai', () => ({
  generateText: mockGenerateText,
  generateObject: mockGenerateObject,
  streamText: mockStreamText,
}));

const mockRecordUsage = mock(() => {});
mock.module('../../state/cost-session-store', () => ({
  recordUsage: mockRecordUsage,
}));

const mockEventBus = { emit: mock(() => {}) };
mock.module('../../events/event-bus', () => ({
  eventBus: mockEventBus,
}));

const { buildAiCallMessages, callGenerateText, callGenerateObject, callStreamText } = await import('./ai-caller');

describe('buildAiCallMessages', () => {
  it('builds standard messages for non-anthropic provider', () => {
    const result = buildAiCallMessages('google', 'system text', 'user text');
    expect(result.mode).toBe('standard');
    expect(result.options).toHaveProperty('system', 'system text');
    expect(result.options).toHaveProperty('prompt', 'user text');
  });

  it('builds cache-control messages for anthropic provider', () => {
    const result = buildAiCallMessages('anthropic', 'system text', 'user text');
    expect(result.mode).toBe('anthropic_cache');
    expect(result.options).toHaveProperty('messages');
    expect(result.options).not.toHaveProperty('system');
    const messages = (result.options as any).messages;
    expect(messages[0].role).toBe('user');
    expect(messages[0].content[0].providerOptions.anthropic.cacheControl.type).toBe('ephemeral');
  });
});

describe('callGenerateText', () => {
  beforeEach(() => {
    mockGenerateText.mockReset();
    mockRecordUsage.mockReset();
    mockEventBus.emit.mockReset();
    mockGenerateText.mockResolvedValue({ text: 'hello', usage: mockUsage });
  });

  it('returns text on success', async () => {
    const result = await callGenerateText({
      role: 'narrative-director',
      providerName: 'google',
      model: () => 'mock-model' as any,
      temperature: 0.7,
      maxTokens: 512,
      system: 'sys',
      prompt: 'usr',
    });
    expect(result.text).toBe('hello');
  });

  it('records usage on success', async () => {
    await callGenerateText({
      role: 'narrative-director',
      providerName: 'google',
      model: () => 'mock-model' as any,
      temperature: 0.7,
      maxTokens: 512,
      system: 'sys',
      prompt: 'usr',
    });
    expect(mockRecordUsage).toHaveBeenCalledWith('narrative-director', {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });
  });

  it('retries on failure then succeeds', async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ text: 'ok', usage: mockUsage });
    const result = await callGenerateText({
      role: 'narrative-director',
      providerName: 'google',
      model: () => 'mock-model' as any,
      temperature: 0.7,
      maxTokens: 512,
      system: 'sys',
      prompt: 'usr',
      maxRetries: 2,
    });
    expect(result.text).toBe('ok');
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
  });

  it('emits ai_call_failed after all retries exhausted', async () => {
    mockGenerateText.mockRejectedValue(new Error('boom'));
    try {
      await callGenerateText({
        role: 'narrative-director',
        providerName: 'google',
        model: () => 'mock-model' as any,
        temperature: 0.7,
        maxTokens: 512,
        system: 'sys',
        prompt: 'usr',
        maxRetries: 1,
      });
    } catch { /* expected */ }
    expect(mockEventBus.emit).toHaveBeenCalledWith('ai_call_failed', {
      role: 'narrative-director',
      error: 'boom',
    });
  });
});

describe('callGenerateObject', () => {
  beforeEach(() => {
    mockGenerateObject.mockReset();
    mockRecordUsage.mockReset();
    mockGenerateObject.mockResolvedValue({ object: { val: 42 }, usage: mockUsage });
  });

  it('returns parsed object on success', async () => {
    const result = await callGenerateObject({
      role: 'npc-actor',
      providerName: 'google',
      model: () => 'mock-model' as any,
      temperature: 0.8,
      maxTokens: 400,
      system: 'sys',
      prompt: 'usr',
      schema: {} as any,
    });
    expect(result.object).toEqual({ val: 42 });
  });

  it('records usage on success', async () => {
    await callGenerateObject({
      role: 'npc-actor',
      providerName: 'google',
      model: () => 'mock-model' as any,
      temperature: 0.8,
      maxTokens: 400,
      system: 'sys',
      prompt: 'usr',
      schema: {} as any,
    });
    expect(mockRecordUsage).toHaveBeenCalledWith('npc-actor', expect.objectContaining({ totalTokens: 150 }));
  });
});

describe('callStreamText', () => {
  beforeEach(() => {
    mockStreamText.mockReset();
    mockRecordUsage.mockReset();
    mockStreamText.mockReturnValue({
      textStream: (async function* () { yield 'a'; yield 'b'; })(),
      usage: Promise.resolve(mockUsage),
    });
  });

  it('yields chunks from stream', async () => {
    const gen = callStreamText({
      role: 'narrative-director',
      providerName: 'google',
      model: () => 'mock-model' as any,
      temperature: 0.7,
      maxTokens: 512,
      system: 'sys',
      prompt: 'usr',
    });
    const chunks: string[] = [];
    for await (const c of gen) {
      chunks.push(c);
    }
    expect(chunks).toEqual(['a', 'b']);
  });

  it('records usage after stream completes', async () => {
    const gen = callStreamText({
      role: 'narrative-director',
      providerName: 'google',
      model: () => 'mock-model' as any,
      temperature: 0.7,
      maxTokens: 512,
      system: 'sys',
      prompt: 'usr',
    });
    for await (const _ of gen) { /* consume */ }
    expect(mockRecordUsage).toHaveBeenCalledWith('narrative-director', expect.objectContaining({ totalTokens: 150 }));
  });
});
