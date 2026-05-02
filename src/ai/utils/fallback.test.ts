import { describe, test, expect } from 'bun:test';
import { getFallbackNarration, getFallbackDialogue } from './fallback';

describe('getFallbackNarration', () => {
  test('returns exploration fallback', () => {
    expect(getFallbackNarration('exploration')).toBe('你环顾四周，一切似乎很平静。');
  });

  test('returns combat fallback', () => {
    expect(getFallbackNarration('combat')).toBe('战斗继续进行着。');
  });

  test('returns dialogue fallback', () => {
    expect(getFallbackNarration('dialogue')).toBe('对方沉默了一会儿。');
  });

  test('returns lore fallback', () => {
    expect(getFallbackNarration('lore')).toBe('古老的记载如此描述......');
  });

  test('returns horror fallback', () => {
    expect(getFallbackNarration('horror')).toBe('一股寒意袭来。');
  });

  test('returns default for unknown scene type', () => {
    expect(getFallbackNarration('unknown')).toBe('什么也没有发生。');
  });
});

describe('getFallbackDialogue', () => {
  test('returns a valid NpcDialogue object', () => {
    const result = getFallbackDialogue('老铁匠');
    expect(result.dialogue).toContain('老铁匠');
    expect(result.emotionTag).toBe('neutral');
    expect(result.memoryNote).toBeNull();
    expect(result.sentiment).toBe('neutral');
  });

  test('includes the NPC name in the dialogue', () => {
    const result = getFallbackDialogue('酒馆老板');
    expect(result.dialogue).toContain('酒馆老板');
  });
});
