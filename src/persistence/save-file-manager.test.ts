import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import path from 'node:path';
import { _fs, getSaveDir, ensureSaveDirExists, quickSave, saveGame, loadGame, listSaves } from './save-file-manager';

const mockBunWrite = mock(() => Promise.resolve(0));
const mockBunFile = mock((filePath: string) => ({
  text: mock(() => Promise.resolve(JSON.stringify({
    meta: {
      saveName: 'Test Save',
      timestamp: '2024-01-01T00:00:00.000Z',
      character: { name: 'Hero', race: 'Human', profession: 'Warrior' },
      playtime: 100,
      locationName: 'town_square',
    },
  }))),
  exists: mock(() => Promise.resolve(true)),
}));

let mkdirSpy: ReturnType<typeof spyOn>;
let readdirSpy: ReturnType<typeof spyOn>;
const originalBunWrite = (globalThis as Record<string, unknown>).Bun?.write;
const originalBunFile = (globalThis as Record<string, unknown>).Bun?.file;

beforeEach(() => {
  mkdirSpy = spyOn(_fs, 'mkdirSync').mockImplementation(() => undefined as unknown as ReturnType<typeof _fs.mkdirSync>);
  readdirSpy = spyOn(_fs, 'readdirSync').mockImplementation(() => ['quicksave.json', 'hero_2024-01-01T00-00.json', 'notes.txt'] as unknown as ReturnType<typeof _fs.readdirSync>);
  if (typeof Bun !== 'undefined') {
    (Bun as unknown as Record<string, unknown>).write = mockBunWrite;
    (Bun as unknown as Record<string, unknown>).file = mockBunFile;
  }
  mockBunWrite.mockClear();
  mockBunFile.mockClear();
});

afterEach(() => {
  mkdirSpy.mockRestore();
  readdirSpy.mockRestore();
  if (typeof Bun !== 'undefined' && originalBunWrite) {
    (Bun as unknown as Record<string, unknown>).write = originalBunWrite;
  }
  if (typeof Bun !== 'undefined' && originalBunFile) {
    (Bun as unknown as Record<string, unknown>).file = originalBunFile;
  }
});

describe('getSaveDir', () => {
  it('returns platform-aware path ending in /saves', () => {
    const dir = getSaveDir();
    expect(dir).toEndWith('/saves');
    expect(dir.length).toBeGreaterThan('/saves'.length);
  });

  it('returns ./saves when portable: true', () => {
    expect(getSaveDir({ portable: true })).toBe('./saves');
  });

  it('returns the customDir when provided', () => {
    expect(getSaveDir({ customDir: '/tmp/mysaves' })).toBe('/tmp/mysaves');
  });

  it('customDir takes precedence over portable', () => {
    expect(getSaveDir({ portable: true, customDir: '/tmp/mysaves' })).toBe('/tmp/mysaves');
  });
});

describe('ensureSaveDirExists', () => {
  it('calls mkdirSync with recursive: true', async () => {
    await ensureSaveDirExists('/tmp/test-saves');
    expect(mkdirSpy).toHaveBeenCalledWith('/tmp/test-saves', { recursive: true });
  });
});

describe('quickSave', () => {
  it('calls Bun.write with path containing quicksave.json', async () => {
    const mockSerializer = {
      snapshot: mock(() => '{"version":2,"meta":{}}'),
      restore: mock(() => undefined),
    };

    await quickSave(mockSerializer, '/tmp/saves');

    expect(mockBunWrite).toHaveBeenCalled();
    const [filePath] = mockBunWrite.mock.calls[0] as [string, string];
    expect(filePath).toContain('quicksave.json');
  });

  it('writes the serializer.snapshot() output', async () => {
    const snapshotData = '{"version":2,"meta":{"saveName":"Quick Save"}}';
    const mockSerializer = {
      snapshot: mock(() => snapshotData),
      restore: mock(() => undefined),
    };

    await quickSave(mockSerializer, '/tmp/saves');

    const [, content] = mockBunWrite.mock.calls[0] as [string, string];
    expect(content).toBe(snapshotData);
  });

  it('returns the file path', async () => {
    const mockSerializer = {
      snapshot: mock(() => '{}'),
      restore: mock(() => undefined),
    };

    const result = await quickSave(mockSerializer, '/tmp/saves');
    expect(result).toContain('quicksave.json');
  });
});

describe('saveGame', () => {
  it('calls Bun.write with path matching name_YYYY-MM-DDTHH-MM.json pattern', async () => {
    const mockSerializer = {
      snapshot: mock(() => '{"version":2}'),
      restore: mock(() => undefined),
    };

    await saveGame('hero', mockSerializer, '/tmp/saves');

    expect(mockBunWrite).toHaveBeenCalled();
    const [filePath] = mockBunWrite.mock.calls[0] as [string, string];
    expect(filePath).toMatch(/hero_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}\.json$/);
  });

  it('sanitizes special characters in the name', async () => {
    const mockSerializer = {
      snapshot: mock(() => '{}'),
      restore: mock(() => undefined),
    };

    await saveGame('my save!', mockSerializer, '/tmp/saves');

    const [filePath] = mockBunWrite.mock.calls[0] as [string, string];
    expect(filePath).not.toContain(' ');
    expect(filePath).not.toContain('!');
  });

  it('returns the file path', async () => {
    const mockSerializer = {
      snapshot: mock(() => '{}'),
      restore: mock(() => undefined),
    };

    const result = await saveGame('hero', mockSerializer, '/tmp/saves');
    expect(result).toMatch(/hero_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}\.json$/);
  });
});

describe('loadGame', () => {
  it('calls Bun.file(filePath).text() then serializer.restore(json)', async () => {
    const mockSerializer = {
      snapshot: mock(() => '{}'),
      restore: mock(() => undefined),
    };

    await loadGame('/tmp/saves/quicksave.json', mockSerializer);

    expect(mockBunFile).toHaveBeenCalledWith('/tmp/saves/quicksave.json');
    expect(mockSerializer.restore).toHaveBeenCalled();
    const restoredJson = mockSerializer.restore.mock.calls[0]?.[0];
    expect(typeof restoredJson).toBe('string');
  });
});

describe('listSaves', () => {
  it('returns an array of SaveListEntry sorted by timestamp desc', async () => {
    readdirSpy.mockImplementation(() => ['quicksave.json', 'hero_2024-01-01T00-00.json'] as unknown as ReturnType<typeof _fs.readdirSync>);

    const results = await listSaves('/tmp/saves');

    expect(Array.isArray(results)).toBe(true);
  });

  it('reads only .json files (ignores .txt and other extensions)', async () => {
    readdirSpy.mockImplementation(() => ['save.json', 'readme.txt', 'save2.json'] as unknown as ReturnType<typeof _fs.readdirSync>);

    await listSaves('/tmp/saves');

    expect(mockBunFile).toHaveBeenCalledTimes(2);
  });

  it('each entry has filePath and meta fields', async () => {
    readdirSpy.mockImplementation(() => ['quicksave.json'] as unknown as ReturnType<typeof _fs.readdirSync>);

    const results = await listSaves('/tmp/saves');
    expect(results.length).toBe(1);
    expect(results[0]).toHaveProperty('filePath');
    expect(results[0]).toHaveProperty('meta');
  });

  it('sorts results by meta.timestamp descending', async () => {
    const fileWithOldTimestamp = {
      text: mock(() => Promise.resolve(JSON.stringify({
        meta: {
          saveName: 'Old Save',
          timestamp: '2023-01-01T00:00:00.000Z',
          character: { name: 'Hero', race: 'Human', profession: 'Warrior' },
          playtime: 0,
          locationName: 'town',
        },
      }))),
      exists: mock(() => Promise.resolve(true)),
    };
    const fileWithNewTimestamp = {
      text: mock(() => Promise.resolve(JSON.stringify({
        meta: {
          saveName: 'New Save',
          timestamp: '2024-06-01T00:00:00.000Z',
          character: { name: 'Hero', race: 'Human', profession: 'Warrior' },
          playtime: 50,
          locationName: 'forest',
        },
      }))),
      exists: mock(() => Promise.resolve(true)),
    };

    readdirSpy.mockImplementation(() => ['old.json', 'new.json'] as unknown as ReturnType<typeof _fs.readdirSync>);
    mockBunFile
      .mockReturnValueOnce(fileWithOldTimestamp as unknown as ReturnType<typeof mockBunFile>)
      .mockReturnValueOnce(fileWithNewTimestamp as unknown as ReturnType<typeof mockBunFile>);

    const results = await listSaves('/tmp/saves');
    expect(results[0]?.meta.saveName).toBe('New Save');
    expect(results[1]?.meta.saveName).toBe('Old Save');
  });
});
