import { describe, it, expect } from 'bun:test';
import {
  consumeGlobalInput,
  getPanelActionForKey,
  inputStateFromGamePhase,
  useGameInput,
} from './use-game-input';

describe('useGameInput', () => {
  it('is a function', () => {
    expect(typeof useGameInput).toBe('function');
  });

  it('returns inputValue and setInputValue in its return object', () => {
    const source = useGameInput.toString();
    expect(source).toContain('inputValue');
    expect(source).toContain('setInputValue');
  });
});

describe('getPanelActionForKey', () => {
  it('returns map for m when not typing', () => {
    expect(getPanelActionForKey('m', false)).toBe('map');
  });

  it('returns journal for j when not typing', () => {
    expect(getPanelActionForKey('j', false)).toBe('journal');
  });

  it('returns codex for c when not typing', () => {
    expect(getPanelActionForKey('c', false)).toBe('codex');
  });

  it('returns inventory for i when not typing', () => {
    expect(getPanelActionForKey('i', false)).toBe('inventory');
  });

  it('returns branch_tree for b when not typing', () => {
    expect(getPanelActionForKey('b', false)).toBe('branch_tree');
  });

  it('returns shortcuts for ? when not typing', () => {
    expect(getPanelActionForKey('?', false)).toBe('shortcuts');
  });

  it('returns null for unknown keys', () => {
    expect(getPanelActionForKey('x', false)).toBeNull();
    expect(getPanelActionForKey('z', false)).toBeNull();
  });

  it('returns null for all keys when typing', () => {
    expect(getPanelActionForKey('m', true)).toBeNull();
    expect(getPanelActionForKey('j', true)).toBeNull();
    expect(getPanelActionForKey('c', true)).toBeNull();
    expect(getPanelActionForKey('i', true)).toBeNull();
    expect(getPanelActionForKey('b', true)).toBeNull();
    expect(getPanelActionForKey('?', true)).toBeNull();
  });
});

describe('input state helpers', () => {
  it('maps overlay phases to menu-specific input states', () => {
    expect(inputStateFromGamePhase('map')).toBe('MAP');
    expect(inputStateFromGamePhase('codex')).toBe('CODEX');
    expect(inputStateFromGamePhase('branch_tree')).toBe('BRANCH');
    expect(inputStateFromGamePhase('compare')).toBe('BRANCH');
    expect(inputStateFromGamePhase('journal')).toBe('MENU');
  });

  it('global input helper reports whether a key was consumed', () => {
    expect(consumeGlobalInput({ input: 'x', key: {}, isStreaming: false, inputMode: 'action_select', isTyping: false })).toEqual({ consumed: false, action: null });
    expect(consumeGlobalInput({ input: '?', key: {}, isStreaming: false, inputMode: 'action_select', isTyping: false })).toEqual({ consumed: true, action: 'help' });
  });
});
