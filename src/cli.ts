#!/usr/bin/env bun
import { Command } from 'commander';
import { resolveDataDir, guardWorldDirPath } from './paths';

const program = new Command()
  .name('chronicle')
  .description('AI-driven CLI interactive novel game')
  .version('1.1.0')
  .option('--world-dir <path>', 'Custom world data directory')
  .action(async (opts: { worldDir?: string }) => {
    if (opts.worldDir) {
      guardWorldDirPath(opts.worldDir);
    }
    const dataDir = resolveDataDir({ worldDir: opts.worldDir });
    process.env.__CHRONICLE_DATA_DIR = dataDir;

    await import('./index');
  });

program.parse();
