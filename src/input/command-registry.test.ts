import { describe, it, expect } from 'bun:test';
import { Command } from 'commander';
import { registerCommands } from './command-registry';
import type { GameAction } from '../types/game-action';

function parseCommand(input: string): GameAction | null {
  let result: GameAction | null = null;
  const program = new Command();
  program.exitOverride();
  program.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  registerCommands(program, (action) => { result = action; });
  try {
    program.parse(input.split(' '), { from: 'user' });
  } catch {
    // commander throws on exit override
  }
  return result;
}

describe('registerCommands — Phase 3 additions', () => {
  it('load command with name produces { type: load, target: name }', () => {
    const action = parseCommand('load mysave');
    expect(action?.type).toBe('load');
    expect(action?.target).toBe('mysave');
  });

  it('load command without name produces { type: load, target: null }', () => {
    const action = parseCommand('load');
    expect(action?.type).toBe('load');
    expect(action?.target).toBeNull();
  });

  it('journal command produces { type: journal, target: null }', () => {
    const action = parseCommand('journal');
    expect(action?.type).toBe('journal');
    expect(action?.target).toBeNull();
  });

  it('quest accept quest_main_01 produces { type: quest, target: accept, modifiers: { id: quest_main_01 } }', () => {
    const action = parseCommand('quest accept quest_main_01');
    expect(action?.type).toBe('quest');
    expect(action?.target).toBe('accept');
    expect((action?.modifiers as Record<string, string>)?.['id']).toBe('quest_main_01');
  });

  it('quest list produces { type: quest, target: list, modifiers: {} }', () => {
    const action = parseCommand('quest list');
    expect(action?.type).toBe('quest');
    expect(action?.target).toBe('list');
    expect(action?.modifiers).toEqual({});
  });
});
