import { describe, it, expect } from 'bun:test';
import { SceneSpinner, SPINNER_LABELS } from './scene-spinner';
import type { SpinnerContext } from './scene-spinner';

describe('SceneSpinner', () => {
  it('exports SceneSpinner as a function', () => {
    expect(typeof SceneSpinner).toBe('function');
  });

  it('exports SPINNER_LABELS with expected contexts', () => {
    const contexts: readonly SpinnerContext[] = ['narration', 'npc_dialogue', 'combat'];
    for (const ctx of contexts) {
      expect(SPINNER_LABELS[ctx]).toBeDefined();
      expect(SPINNER_LABELS[ctx].length).toBeGreaterThan(0);
    }
  });

  it('narration labels include atmosphere text', () => {
    expect(SPINNER_LABELS.narration).toContain('命运之轮转动中...');
    expect(SPINNER_LABELS.narration).toContain('史官正在记录...');
  });

  it('npc_dialogue labels include thinking text', () => {
    expect(SPINNER_LABELS.npc_dialogue).toContain('正在思考...');
  });

  it('combat labels include action text', () => {
    expect(SPINNER_LABELS.combat).toContain('攻击展开...');
    expect(SPINNER_LABELS.combat).toContain('局势变化...');
  });

  it('each context has only string labels', () => {
    for (const labels of Object.values(SPINNER_LABELS)) {
      for (const label of labels) {
        expect(typeof label).toBe('string');
      }
    }
  });
});
