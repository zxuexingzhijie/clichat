if (typeof Bun === 'undefined') {
  console.error('Chronicle requires Bun runtime. Install: https://bun.sh');
  process.exit(1);
}

import path from 'node:path';

export function resolveDataDir(options?: { worldDir?: string }): string {
  if (options?.worldDir) {
    return path.resolve(options.worldDir);
  }
  if (process.env.CHRONICLE_WORLD_DIR) {
    return path.resolve(process.env.CHRONICLE_WORLD_DIR);
  }
  return path.resolve(import.meta.dir, '..', 'world-data');
}

export function resolveConfigPath(dataDir: string): string {
  return path.join(dataDir, 'ai-config.yaml');
}

export function guardWorldDirPath(dirPath: string): void {
  const segments = dirPath.split(path.sep).concat(dirPath.split('/'));
  if (segments.includes('..')) {
    throw new Error(`Path traversal detected: ${dirPath}`);
  }
}
