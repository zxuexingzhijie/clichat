import { Command } from 'commander';
import type { GameAction } from '../types/game-action';
import { registerCommands } from './command-registry';

export type CommandParser = {
  readonly parse: (input: string) => GameAction | null;
};

export function createCommandParser(): CommandParser {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({
    writeOut: () => {},
    writeErr: () => {},
  });

  let result: GameAction | null = null;
  const setResult = (action: GameAction): void => {
    result = action;
  };

  registerCommands(program, setResult);

  return {
    parse(input: string): GameAction | null {
      result = null;
      const cleaned = input.replace(/^\//, '').trim();
      if (!cleaned) return null;
      const args = cleaned.split(/\s+/);
      try {
        program.parse(args, { from: 'user' });
      } catch {
        return null;
      }
      return result;
    },
  };
}
