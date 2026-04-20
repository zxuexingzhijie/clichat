import { describe, it, expect } from 'bun:test';
import { createCommandParser } from './command-parser';

describe('CommandParser', () => {
  const parser = createCommandParser();

  it('parses /look with no target', () => {
    const result = parser.parse('/look');
    expect(result).toEqual({
      type: 'look',
      target: null,
      modifiers: {},
      source: 'command',
    });
  });

  it('parses /look with target', () => {
    const result = parser.parse('/look notice_board');
    expect(result).toEqual({
      type: 'look',
      target: 'notice_board',
      modifiers: {},
      source: 'command',
    });
  });

  it('parses /go north', () => {
    const result = parser.parse('/go north');
    expect(result).toEqual({
      type: 'move',
      target: 'north',
      modifiers: {},
      source: 'command',
    });
  });

  it('parses /talk guard', () => {
    const result = parser.parse('/talk guard');
    expect(result).toEqual({
      type: 'talk',
      target: 'guard',
      modifiers: {},
      source: 'command',
    });
  });

  it('parses /attack wolf', () => {
    const result = parser.parse('/attack wolf');
    expect(result).toEqual({
      type: 'attack',
      target: 'wolf',
      modifiers: {},
      source: 'command',
    });
  });

  it('parses /help without calling process.exit', () => {
    const result = parser.parse('/help');
    expect(result).toEqual({
      type: 'help',
      target: null,
      modifiers: {},
      source: 'command',
    });
  });

  it('returns null for unknown command /xyz', () => {
    const result = parser.parse('/xyz');
    expect(result).toBeNull();
  });

  it('parses /inspect chest', () => {
    const result = parser.parse('/inspect chest');
    expect(result).toEqual({
      type: 'inspect',
      target: 'chest',
      modifiers: {},
      source: 'command',
    });
  });

  it('parses /use_item potion', () => {
    const result = parser.parse('/use_item potion');
    expect(result).toEqual({
      type: 'use_item',
      target: 'potion',
      modifiers: {},
      source: 'command',
    });
  });

  it('parses /cast fireball wolf with spell target modifier', () => {
    const result = parser.parse('/cast fireball wolf');
    expect(result).toEqual({
      type: 'cast',
      target: 'fireball',
      modifiers: { target: 'wolf' },
      source: 'command',
    });
  });

  it('parses /guard with no target', () => {
    const result = parser.parse('/guard');
    expect(result).toEqual({
      type: 'guard',
      target: null,
      modifiers: {},
      source: 'command',
    });
  });

  it('parses /flee with no target', () => {
    const result = parser.parse('/flee');
    expect(result).toEqual({
      type: 'flee',
      target: null,
      modifiers: {},
      source: 'command',
    });
  });

  it('parses /trade merchant', () => {
    const result = parser.parse('/trade merchant');
    expect(result).toEqual({
      type: 'trade',
      target: 'merchant',
      modifiers: {},
      source: 'command',
    });
  });

  it('parses /save with no name', () => {
    const result = parser.parse('/save');
    expect(result).toEqual({
      type: 'save',
      target: null,
      modifiers: {},
      source: 'command',
    });
  });

  it('returns null for empty input after slash', () => {
    const result = parser.parse('/');
    expect(result).toBeNull();
  });

  it('is reusable across multiple calls', () => {
    const r1 = parser.parse('/look');
    const r2 = parser.parse('/go north');
    expect(r1?.type).toBe('look');
    expect(r2?.type).toBe('move');
    expect(r2?.target).toBe('north');
  });
});
