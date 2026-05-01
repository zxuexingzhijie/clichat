import { describe, expect, it } from 'bun:test';
import { parseSceneLine } from './scene-panel';

describe('parseSceneLine', () => {
  it('classifies NPC dialogue lines with Chinese quote syntax', () => {
    const result = parseSceneLine('猎人·阿虎："北林最近不太平，你最好别单独走夜路。"');

    expect(result).toEqual({
      type: 'dialogue',
      speaker: '猎人·阿虎',
      text: '北林最近不太平，你最好别单独走夜路。',
    });
  });

  it('classifies bracketed system/error lines separately from narration', () => {
    expect(parseSceneLine('[错误] 无法执行此操作').type).toBe('system');
  });

  it('keeps normal scene prose as narration', () => {
    expect(parseSceneLine('你踏入黑松镇北门。')).toEqual({
      type: 'narration',
      text: '你踏入黑松镇北门。',
    });
  });
});
