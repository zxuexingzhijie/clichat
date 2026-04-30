import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import path from 'node:path';
import { _fs, getSaveDir, ensureSaveDirExists, quickSave, saveGame, loadGame, listSaves, readSaveData } from './save-file-manager';

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
const originalBunWrite = ((globalThis as Record<string, unknown>).Bun as Record<string, unknown> | undefined)?.write;
const originalBunFile = ((globalThis as Record<string, unknown>).Bun as Record<string, unknown> | undefined)?.file;

beforeEach(() => {
  mkdirSpy = spyOn(_fs, 'mkdir').mockImplementation(() => Promise.resolve(undefined));
  readdirSpy = spyOn(_fs, 'readdir').mockImplementation((() => Promise.resolve(['quicksave.json', 'hero_2024-01-01T00-00.json', 'notes.txt'])) as unknown as typeof _fs.readdir);
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
  it('calls mkdir with recursive: true', async () => {
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
    const [filePath] = (mockBunWrite.mock.calls as unknown as [string, string][])[0]!;
    expect(filePath).toContain('quicksave.json');
  });

  it('writes the serializer.snapshot() output', async () => {
    const snapshotData = '{"version":2,"meta":{"saveName":"Quick Save"}}';
    const mockSerializer = {
      snapshot: mock(() => snapshotData),
      restore: mock(() => undefined),
    };

    await quickSave(mockSerializer, '/tmp/saves');

    const [, content] = (mockBunWrite.mock.calls as unknown as [string, string][])[0]!;
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
    const [filePath] = (mockBunWrite.mock.calls as unknown as [string, string][])[0]!;
    expect(filePath).toMatch(/hero_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}\.json$/);
  });

  it('sanitizes special characters in the name', async () => {
    const mockSerializer = {
      snapshot: mock(() => '{}'),
      restore: mock(() => undefined),
    };

    await saveGame('my save!', mockSerializer, '/tmp/saves');

    const [filePath] = (mockBunWrite.mock.calls as unknown as [string, string][])[0]!;
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
    const restoredJson = (mockSerializer.restore.mock.calls as unknown as unknown[][])[0]?.[0];
    expect(typeof restoredJson).toBe('string');
  });
});

describe('listSaves', () => {
  it('returns an array of SaveListEntry sorted by timestamp desc', async () => {
    readdirSpy.mockImplementation((() => Promise.resolve(['quicksave.json', 'hero_2024-01-01T00-00.json'])) as unknown as typeof _fs.readdir);

    const results = await listSaves('/tmp/saves');

    expect(Array.isArray(results)).toBe(true);
  });

  it('reads only .json files (ignores .txt and other extensions)', async () => {
    readdirSpy.mockImplementation((() => Promise.resolve(['save.json', 'readme.txt', 'save2.json'])) as unknown as typeof _fs.readdir);

    await listSaves('/tmp/saves');

    expect(mockBunFile).toHaveBeenCalledTimes(2);
  });

  it('each entry has filePath and meta fields', async () => {
    readdirSpy.mockImplementation((() => Promise.resolve(['quicksave.json'])) as unknown as typeof _fs.readdir);

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

    readdirSpy.mockImplementation((() => Promise.resolve(['old.json', 'new.json'])) as unknown as typeof _fs.readdir);
    mockBunFile
      .mockReturnValueOnce(fileWithOldTimestamp as unknown as ReturnType<typeof mockBunFile>)
      .mockReturnValueOnce(fileWithNewTimestamp as unknown as ReturnType<typeof mockBunFile>);

    const results = await listSaves('/tmp/saves');
    expect(results[0]?.meta.saveName).toBe('New Save');
    expect(results[1]?.meta.saveName).toBe('Old Save');
  });
});

describe('readSaveData', () => {
  const mockSaveData = {
    version: 6,
    meta: { saveName: 'Test', timestamp: '2026-01-01T00:00:00.000Z', character: { name: 'Hero', race: 'Human', profession: 'Warrior' }, playtime: 0, locationName: 'North Gate' },
    branchId: 'main',
    parentSaveId: null,
    player: { name: 'Hero', race: 'human', profession: 'warrior', hp: 100, maxHp: 100, mp: 50, maxMp: 50, gold: 0, attributes: { physique: 3, finesse: 2, mind: 1 }, tags: [], equipment: { weapon: null, armor: null, accessory: null }, poisonStacks: 0 },
    scene: { sceneId: 'north_gate', locationName: 'North Gate', narrationLines: [], actions: [], npcsPresent: [], exits: [], exitMap: {}, objects: [], droppedItems: [] },
    combat: { active: false, turnOrder: [], currentTurnIndex: 0, enemies: [], roundNumber: 0, phase: 'init', lastCheckResult: null, lastNarration: '', guardActive: false, howlActive: false, outcome: null },
    game: { day: 1, timeOfDay: 'night', phase: 'game', turnCount: 0, isDarkTheme: true, pendingQuit: false, revealedNpcs: [] },
    quest: { quests: {}, eventLog: [] },
    relations: { npcDispositions: {}, factionReputations: {} },
    npcMemorySnapshot: { memories: {} },
    questEventLog: [],
    exploration: { locations: {} },
    playerKnowledge: { entries: {} },
    turnLog: [],
    narrativeState: { currentAct: 'act1', atmosphereTags: ['mundane', 'curious'], worldFlags: {}, playerKnowledgeLevel: 0 },
  };

  beforeEach(() => {
    if (typeof Bun !== 'undefined') {
      (Bun as unknown as Record<string, unknown>).file = mock((_path: string) => ({
        json: async () => mockSaveData,
      }));
    }
  });

  afterEach(() => {
    if (typeof Bun !== 'undefined' && originalBunFile) {
      (Bun as unknown as Record<string, unknown>).file = originalBunFile;
    }
  });

  it('returns parsed SaveDataV6 without calling serializer.restore', async () => {
    const saveDir = '/tmp/saves';
    const result = await readSaveData('test-save.json', saveDir);
    expect(result.version).toBe(6);
    expect(result.branchId).toBe('main');
  });

  it('migrates older save data to SaveDataV6 before returning it', async () => {
    const v5SaveData = {
      ...mockSaveData,
      version: 5,
      scene: { ...mockSaveData.scene, droppedItems: undefined },
    };
    delete (v5SaveData.scene as Record<string, unknown>)['droppedItems'];
    if (typeof Bun !== 'undefined') {
      (Bun as unknown as Record<string, unknown>).file = mock((_path: string) => ({
        json: async () => v5SaveData,
      }));
    }

    const result = await readSaveData('old-save.json', '/tmp/saves');

    expect(result.version).toBe(6);
    expect(result.scene.droppedItems).toEqual([]);
  });

  it('rejects path traversal attempts', async () => {
    const saveDir = '/tmp/saves';
    await expect(readSaveData('../../../etc/passwd', saveDir)).rejects.toThrow('path traversal');
  });
});
