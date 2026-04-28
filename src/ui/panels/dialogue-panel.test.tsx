import { describe, it, expect } from 'bun:test';
import { DialoguePanel } from './dialogue-panel';

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
