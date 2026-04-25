import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import path from 'node:path';

describe('resolveDataDir', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.CHRONICLE_WORLD_DIR;
    delete process.env.CHRONICLE_WORLD_DIR;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CHRONICLE_WORLD_DIR = originalEnv;
    } else {
      delete process.env.CHRONICLE_WORLD_DIR;
    }
  });

  it('returns CLI arg path when worldDir is provided', async () => {
    const { resolveDataDir } = await import('./paths');
    const result = resolveDataDir({ worldDir: '/custom/path' });
    expect(result).toBe('/custom/path');
  });

  it('returns CHRONICLE_WORLD_DIR env var when set and no CLI arg', async () => {
    process.env.CHRONICLE_WORLD_DIR = '/env/path';
    const { resolveDataDir } = await import('./paths');
    const result = resolveDataDir();
    expect(result).toBe('/env/path');
  });

  it('without arguments returns a path ending in world-data', async () => {
    const { resolveDataDir } = await import('./paths');
    const result = resolveDataDir();
    expect(result).toEndWith('world-data');
  });
});

describe('guardWorldDirPath', () => {
  it('does not throw for a safe path', async () => {
    const { guardWorldDirPath } = await import('./paths');
    expect(() => guardWorldDirPath('/safe/world-data')).not.toThrow();
  });

  it('throws for path containing ".."', async () => {
    const { guardWorldDirPath } = await import('./paths');
    expect(() => guardWorldDirPath('/safe/../etc/passwd')).toThrow('Path traversal detected');
  });

  it('throws for path with encoded traversal after normalization', async () => {
    const { guardWorldDirPath } = await import('./paths');
    expect(() => guardWorldDirPath('/safe/world-data/../../secret')).toThrow('Path traversal detected');
  });
});

describe('resolveConfigPath', () => {
  it('returns path ending in ai-config.yaml inside the data dir', async () => {
    const { resolveConfigPath } = await import('./paths');
    const result = resolveConfigPath('/some/data-dir');
    expect(result).toBe(path.join('/some/data-dir', 'ai-config.yaml'));
  });
});
