import { describe, it, expect } from 'bun:test';
import { DialoguePanel, getDialogueHistoryView } from './dialogue-panel';

describe('DialoguePanel: onFreeTextSubmit prop', () => {
  it('DialoguePanel function source accepts onFreeTextSubmit prop', () => {
    const source = DialoguePanel.toString();
    expect(source).toContain('onFreeTextSubmit');
  });

  it('DialoguePanel function source renders TextInput component', () => {
    const source = DialoguePanel.toString();
    expect(source).toContain('TextInput');
  });

  it('DialoguePanel function source has isFreeTextMode state', () => {
    const source = DialoguePanel.toString();
    expect(source).toContain('isFreeTextMode');
  });
});

describe('DialoguePanel: TextInput mode control', () => {
  it('DialoguePanel useInput isActive is negated by isFreeTextMode', () => {
    const source = DialoguePanel.toString();
    expect(source).toMatch(/isActive.*isFreeTextMode|isFreeTextMode.*isActive/);
  });

  it('DialoguePanel escape in text mode exits text mode without calling onEscape', () => {
    const source = DialoguePanel.toString();
    expect(source).toContain('setIsFreeTextMode');
    expect(source).toContain('isFreeTextMode');
  });

  it('DialoguePanel TextInput onSubmit calls onFreeTextSubmit with trimmed text', () => {
    const source = DialoguePanel.toString();
    expect(source).toContain('onFreeTextSubmit');
    expect(source).toContain('trim');
  });
});

describe('DialoguePanel: hint text updated', () => {
  it('DialoguePanel hint text includes free text entry instruction', () => {
    const source = DialoguePanel.toString();
    expect(source).toMatch(/直接输入|\u76F4\u63A5\u8F93\u5165|\\u76F4/);
  });
});

describe('DialoguePanel: reversible history preview', () => {
  const history = [
    { role: 'user', content: 'greet' },
    { role: 'assistant', content: '欢迎。' },
    { role: 'user', content: '第一句' },
    { role: 'assistant', content: '第二句' },
    { role: 'user', content: 'greet' },
    { role: 'user', content: '第三句' },
    { role: 'assistant', content: '第四句' },
    { role: 'user', content: '第五句' },
  ];

  it('recent view counts hidden earlier dialogue from filtered non-greet history only', () => {
    const view = getDialogueHistoryView(history, false);
    expect(view.visibleHistory.map((entry) => entry.content)).toEqual(['第一句', '第二句', '第三句', '第四句', '第五句'].slice(-4));
    expect(view.hiddenEarlierCount).toBe(2);
    expect(view.hasMoreHistory).toBe(true);
  });

  it('full view returns all non-greet history without dropping underlying dialogue', () => {
    const view = getDialogueHistoryView(history, true);
    expect(view.visibleHistory.map((entry) => entry.content)).toEqual(['欢迎。', '第一句', '第二句', '第三句', '第四句', '第五句']);
    expect(view.hiddenEarlierCount).toBe(0);
    expect(view.hasMoreHistory).toBe(false);
  });

  it('DialoguePanel source exposes Tab full-history toggle and hint without hijacking text input h', () => {
    const source = DialoguePanel.toString();
    expect(source).toContain('showFullHistory');
    expect(source).toMatch(/input === ["']\\t["']|key\.tab/);
    expect(source).not.toMatch(/input === ["']h["']/);
    expect(source).toMatch(/Tab|\\u21E5/);
    expect(source).toMatch(/全部|\\u5168\\u90E8/);
  });
});
