import type { Command } from 'commander';
import type { GameAction } from '../types/game-action';

export function registerCommands(
  program: Command,
  setResult: (action: GameAction) => void,
): void {
  program
    .command('look')
    .argument('[target]', 'what to look at')
    .action((target?: string) => {
      setResult({ type: 'look', target: target ?? null, modifiers: {}, source: 'command' });
    });

  program
    .command('go')
    .argument('<direction>', 'direction to move')
    .action((direction: string) => {
      setResult({ type: 'move', target: direction, modifiers: {}, source: 'command' });
    });

  program
    .command('talk')
    .argument('<npc>', 'NPC to talk to')
    .action((npc: string) => {
      setResult({ type: 'talk', target: npc, modifiers: {}, source: 'command' });
    });

  program
    .command('attack')
    .argument('<target>', 'target to attack')
    .action((target: string) => {
      setResult({ type: 'attack', target, modifiers: {}, source: 'command' });
    });

  program
    .command('inspect')
    .argument('<target>', 'object to inspect')
    .action((target: string) => {
      setResult({ type: 'inspect', target, modifiers: {}, source: 'command' });
    });

  program
    .command('use_item')
    .argument('<item>', 'item to use')
    .action((item: string) => {
      setResult({ type: 'use_item', target: item, modifiers: {}, source: 'command' });
    });

  program
    .command('cast')
    .argument('<spell>', 'spell to cast')
    .argument('[target]', 'target of spell')
    .action((spell: string, target?: string) => {
      setResult({
        type: 'cast',
        target: spell,
        modifiers: target ? { target } : {},
        source: 'command',
      });
    });

  program
    .command('guard')
    .action(() => {
      setResult({ type: 'guard', target: null, modifiers: {}, source: 'command' });
    });

  program
    .command('flee')
    .action(() => {
      setResult({ type: 'flee', target: null, modifiers: {}, source: 'command' });
    });

  program
    .command('trade')
    .argument('<npc>', 'NPC to trade with')
    .action((npc: string) => {
      setResult({ type: 'trade', target: npc, modifiers: {}, source: 'command' });
    });

  program
    .command('help')
    .action(() => {
      setResult({ type: 'help', target: null, modifiers: {}, source: 'command' });
    });

  program
    .command('save')
    .argument('[name]', 'save name')
    .action((name?: string) => {
      setResult({ type: 'save', target: name ?? null, modifiers: {}, source: 'command' });
    });

  program
    .command('load')
    .argument('[name]', 'save file name or path')
    .action((name?: string) => {
      setResult({ type: 'load', target: name ?? null, modifiers: {}, source: 'command' });
    });

  program
    .command('journal')
    .action(() => {
      setResult({ type: 'journal', target: null, modifiers: {}, source: 'command' });
    });

  program
    .command('quest')
    .argument('<action>', 'accept|list|abandon')
    .argument('[id]', 'quest id')
    .action((action: string, id?: string) => {
      setResult({
        type: 'quest',
        target: action,
        modifiers: id ? { id } : {},
        source: 'command',
      });
    });

  program
    .command('branch')
    .argument('[action]', 'create|switch|tree|delete')
    .argument('[name]', 'branch name')
    .action((action?: string, name?: string) => {
      setResult({
        type: 'branch',
        target: action ?? 'tree',
        modifiers: name ? { name } : {},
        source: 'command',
      });
    });

  program
    .command('compare')
    .argument('[spec]', 'branch comparison spec e.g. main..rescue')
    .action((spec?: string) => {
      setResult({
        type: 'compare',
        target: spec ?? null,
        modifiers: {},
        source: 'command',
      });
    });

  program
    .command('map')
    .action(() => {
      setResult({ type: 'map', target: null, modifiers: {}, source: 'command' });
    });

  program
    .command('codex')
    .argument('[query]', 'search query')
    .action((query?: string) => {
      setResult({
        type: 'codex',
        target: query ?? null,
        modifiers: {},
        source: 'command',
      });
    });

  program
    .command('replay')
    .argument('[count]', 'number of turns to replay')
    .action((count?: string) => {
      setResult({
        type: 'replay',
        target: count ?? '10',
        modifiers: {},
        source: 'command',
      });
    });

  program
    .command('cost')
    .action(() => {
      setResult({ type: 'cost', target: null, modifiers: {}, source: 'command' });
    });

  program
    .command('quit')
    .action(() => {
      setResult({ type: 'quit', target: null, modifiers: {}, source: 'command' });
    });

  program
    .command('exit')
    .action(() => {
      setResult({ type: 'quit', target: null, modifiers: {}, source: 'command' });
    });
}
