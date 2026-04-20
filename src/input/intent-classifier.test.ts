import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { Intent } from '../types/intent';
import { createCommandParser } from './command-parser';

const mockGenerateObject = mock(() => Promise.resolve({ object: {} as Intent }));

mock.module('ai', () => ({
  generateObject: mockGenerateObject,
}));

mock.module('@ai-sdk/openai', () => ({
  openai: () => 'mock-model',
}));

const { classifyIntent } = await import('./intent-classifier');
const { routeInput } = await import('./input-router');

describe('classifyIntent', () => {
  beforeEach(() => {
    mockGenerateObject.mockReset();
  });

  it('classifies Chinese move intent', async () => {
    const expected: Intent = {
      action: 'move',
      target: 'north',
      confidence: 0.9,
      raw_interpretation: 'Player wants to go north',
    };
    mockGenerateObject.mockResolvedValueOnce({ object: expected });

    const result = await classifyIntent('向北走', 'A town square');
    expect(result).toEqual(expected);
    expect(result.action).toBe('move');
  });

  it('classifies Chinese look intent', async () => {
    const expected: Intent = {
      action: 'look',
      target: null,
      confidence: 0.85,
      raw_interpretation: 'Player wants to look around',
    };
    mockGenerateObject.mockResolvedValueOnce({ object: expected });

    const result = await classifyIntent('看看周围', 'A dark forest');
    expect(result).toEqual(expected);
    expect(result.action).toBe('look');
  });

  it('classifies Chinese talk intent', async () => {
    const expected: Intent = {
      action: 'talk',
      target: 'guard',
      confidence: 0.88,
      raw_interpretation: 'Player wants to talk to the guard',
    };
    mockGenerateObject.mockResolvedValueOnce({ object: expected });

    const result = await classifyIntent('和守卫说话', 'Castle entrance');
    expect(result).toEqual(expected);
    expect(result.action).toBe('talk');
  });

  it('returns Zod-validated Intent with confidence between 0-1', async () => {
    const expected: Intent = {
      action: 'attack',
      target: 'wolf',
      confidence: 0.75,
      raw_interpretation: 'Player wants to attack the wolf',
    };
    mockGenerateObject.mockResolvedValueOnce({ object: expected });

    const result = await classifyIntent('攻击狼', 'Forest clearing');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.action).toBe('attack');
  });

  it('retries on first failure then succeeds (D-26)', async () => {
    const expected: Intent = {
      action: 'look',
      target: null,
      confidence: 0.8,
      raw_interpretation: 'Player looks around',
    };
    mockGenerateObject
      .mockRejectedValueOnce(new Error('Schema validation failed'))
      .mockResolvedValueOnce({ object: expected });

    const result = await classifyIntent('看看', 'A room', { maxRetries: 1 });
    expect(result).toEqual(expected);
    expect(mockGenerateObject).toHaveBeenCalledTimes(2);
  });

  it('throws after all retries exhausted', async () => {
    mockGenerateObject
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'));

    await expect(
      classifyIntent('something', 'A room', { maxRetries: 1 }),
    ).rejects.toThrow('Intent classification failed after 2 attempts');
  });
});

describe('routeInput', () => {
  const commandParser = createCommandParser();

  beforeEach(() => {
    mockGenerateObject.mockReset();
  });

  it('routes /look to command parser and returns GameAction', async () => {
    const result = await routeInput('/look', commandParser, 'Town square');
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.action.type).toBe('look');
      expect(result.action.source).toBe('command');
    }
  });

  it('routes NL input to intent classifier', async () => {
    const intent: Intent = {
      action: 'look',
      target: null,
      confidence: 0.85,
      raw_interpretation: 'Look around',
    };
    mockGenerateObject.mockResolvedValueOnce({ object: intent });

    const result = await routeInput('看看周围', commandParser, 'Town square');
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.action.type).toBe('look');
      expect(result.action.source).toBe('intent');
    }
  });

  it('returns error for unknown command /invalid', async () => {
    const result = await routeInput('/invalid', commandParser, 'Town square');
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('未知命令。输入 /help 查看可用命令。');
    }
  });

  it('returns clarification on low confidence (< 0.3) per D-27', async () => {
    const intent: Intent = {
      action: 'look',
      target: null,
      confidence: 0.2,
      raw_interpretation: 'Unclear intent',
    };
    mockGenerateObject.mockResolvedValueOnce({ object: intent });

    const result = await routeInput('嗯嗯嗯', commandParser, 'Town square');
    expect(result.status).toBe('clarification');
    if (result.status === 'clarification') {
      expect(result.message).toContain('无法理解你的意图');
    }
  });

  it('returns error for empty input', async () => {
    const result = await routeInput('', commandParser, 'Town square');
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('请输入命令或描述你想做的事。');
    }
  });

  it('returns error when classifier throws', async () => {
    mockGenerateObject
      .mockRejectedValueOnce(new Error('API error'))
      .mockRejectedValueOnce(new Error('API error'));

    const result = await routeInput('随便', commandParser, 'Town square');
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toContain('无法理解你的意图');
    }
  });
});
