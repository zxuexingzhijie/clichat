import { describe, it, expect } from 'bun:test';
import { getPanelActionForKey } from './use-game-input';

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
