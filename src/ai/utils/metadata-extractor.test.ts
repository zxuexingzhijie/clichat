import { describe, test, expect } from 'bun:test';
import { extractNpcMetadata } from './metadata-extractor';

describe('extractNpcMetadata', () => {
  test('detects angry emotion from 怒', () => {
    const result = extractNpcMetadata('他怒视着你，握紧了拳头。');
    expect(result.emotionTag).toBe('angry');
  });

  test('detects happy emotion from 笑', () => {
    const result = extractNpcMetadata('她笑着递过一杯热茶。');
    expect(result.emotionTag).toBe('happy');
  });

  test('detects sad emotion from 哭', () => {
    const result = extractNpcMetadata('孩子在角落里哭泣。');
    expect(result.emotionTag).toBe('sad');
  });

  test('detects fearful emotion from 怕', () => {
    const result = extractNpcMetadata('他害怕地后退了一步。');
    expect(result.emotionTag).toBe('fearful');
  });

  test('detects suspicious emotion from 疑', () => {
    const result = extractNpcMetadata('她疑惑地打量着你。');
    expect(result.emotionTag).toBe('suspicious');
  });

  test('detects amused emotion from 哈', () => {
    const result = extractNpcMetadata('哈哈哈，真是有趣！');
    expect(result.emotionTag).toBe('amused');
  });

  test('returns neutral when no emotion keywords present', () => {
    const result = extractNpcMetadata('今天天气不错。');
    expect(result.emotionTag).toBe('neutral');
  });

  test('returns shouldRemember true for text longer than 50 chars', () => {
    const longText = '这是一段很长的对话文本，讲述了一个关于远古传说的故事，涉及到许多重要的角色和地点，需要被记住。';
    expect(longText.length).toBeGreaterThan(50);
    const result = extractNpcMetadata(longText);
    expect(result.shouldRemember).toBe(true);
  });

  test('returns shouldRemember false for text 50 chars or fewer', () => {
    const shortText = '你好。';
    expect(shortText.length).toBeLessThanOrEqual(50);
    const result = extractNpcMetadata(shortText);
    expect(result.shouldRemember).toBe(false);
  });

  test('relationshipDelta is always 0', () => {
    const result = extractNpcMetadata('他怒视着你，握紧了拳头。');
    expect(result.relationshipDelta).toBe(0);
  });

  test('returns all defaults for empty string', () => {
    const result = extractNpcMetadata('');
    expect(result.emotionTag).toBe('neutral');
    expect(result.shouldRemember).toBe(false);
    expect(result.relationshipDelta).toBe(0);
  });

  test('emotionTag is always a valid NpcDialogueSchema enum value', () => {
    const validTags = ['neutral', 'happy', 'angry', 'sad', 'fearful', 'amused', 'suspicious'];
    const testTexts = [
      '怒火中烧',
      '笑逐颜开',
      '悲伤至极',
      '恐惧万分',
      '疑神疑鬼',
      '哈哈大笑',
      '平静如水',
      '',
    ];
    for (const text of testTexts) {
      const result = extractNpcMetadata(text);
      expect(validTags).toContain(result.emotionTag);
    }
  });
});
