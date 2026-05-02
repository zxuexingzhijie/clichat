import { describe, test, expect } from 'bun:test';
import { NpcDialogueSchema, type NpcDialogue } from './npc-dialogue';
import { RetrievalPlanSchema, type RetrievalPlan } from './retrieval-plan';
import { SafetyFilterResultSchema, type SafetyFilterResult } from './safety-filter';

describe('NpcDialogueSchema', () => {
  test('validates a correct NPC dialogue', () => {
    const valid: NpcDialogue = {
      dialogue: '你这家伙，又来了？上次欠我的酒钱还没还呢！',
      emotionTag: 'amused',
      memoryNote: '我记得玩家又来找我要酒钱。',
      sentiment: 'positive',
    };
    const result = NpcDialogueSchema.parse(valid);
    expect(result.emotionTag).toBe('amused');
    expect(result.memoryNote).toBe('我记得玩家又来找我要酒钱。');
    expect(result.sentiment).toBe('positive');
  });

  test('rejects invalid sentiment value', () => {
    expect(() => NpcDialogueSchema.parse({
      dialogue: '这是一段有效的NPC对话文本内容。',
      emotionTag: 'neutral',
      memoryNote: null,
      sentiment: 'invalid',
    })).toThrow();
  });

  test('accepts all valid sentiment values', () => {
    const sentiments = ['positive', 'neutral', 'negative', 'hostile'] as const;
    for (const sentiment of sentiments) {
      const result = NpcDialogueSchema.parse({
        dialogue: '这是一段有效的NPC对话文本内容。',
        emotionTag: 'neutral',
        memoryNote: null,
        sentiment,
      });
      expect(result.sentiment).toBe(sentiment);
    }
  });

  test('accepts all valid emotion tags', () => {
    const tags = ['neutral', 'happy', 'angry', 'sad', 'fearful', 'amused', 'suspicious'] as const;
    for (const emotionTag of tags) {
      const result = NpcDialogueSchema.parse({
        dialogue: '这是一段有效的NPC对话文本内容。',
        emotionTag,
        memoryNote: null,
        sentiment: 'neutral',
      });
      expect(result.emotionTag).toBe(emotionTag);
    }
  });
});

describe('RetrievalPlanSchema', () => {
  test('validates a correct retrieval plan', () => {
    const valid: RetrievalPlan = {
      codexIds: ['loc_heisong', 'npc_guard'],
      npcIds: ['guard_01'],
      questIds: [],
      reasoning: 'Player is exploring Heisong town entrance, need location and NPC data',
    };
    const result = RetrievalPlanSchema.parse(valid);
    expect(result.codexIds).toHaveLength(2);
    expect(result.npcIds).toHaveLength(1);
    expect(result.questIds).toHaveLength(0);
  });

  test('rejects more than 3 codex IDs', () => {
    expect(() => RetrievalPlanSchema.parse({
      codexIds: ['a', 'b', 'c', 'd'],
      npcIds: [],
      questIds: [],
      reasoning: 'too many',
    })).toThrow();
  });

  test('rejects more than 2 NPC IDs', () => {
    expect(() => RetrievalPlanSchema.parse({
      codexIds: [],
      npcIds: ['a', 'b', 'c'],
      questIds: [],
      reasoning: 'too many',
    })).toThrow();
  });

  test('rejects more than 1 quest ID', () => {
    expect(() => RetrievalPlanSchema.parse({
      codexIds: [],
      npcIds: [],
      questIds: ['q1', 'q2'],
      reasoning: 'too many',
    })).toThrow();
  });
});

describe('SafetyFilterResultSchema', () => {
  test('validates a safe result', () => {
    const result = SafetyFilterResultSchema.parse({ safe: true });
    expect(result.safe).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.category).toBeUndefined();
  });

  test('validates an unsafe result with reason and category', () => {
    const result = SafetyFilterResultSchema.parse({
      safe: false,
      reason: '玩家尝试操控系统提示',
      category: 'prompt_injection',
    });
    expect(result.safe).toBe(false);
    expect(result.reason).toBe('玩家尝试操控系统提示');
    expect(result.category).toBe('prompt_injection');
  });

  test('accepts all safety categories', () => {
    const categories = ['safe', 'state_override', 'inappropriate_content', 'prompt_injection', 'error'] as const;
    for (const category of categories) {
      const result = SafetyFilterResultSchema.parse({ safe: false, category });
      expect(result.category).toBe(category);
    }
  });
});
