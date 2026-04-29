import envPaths from 'env-paths';
import * as nodeFs from 'node:fs';
import { mkdir as fsMkdir, readdir as fsReaddir } from 'node:fs/promises';
import path from 'node:path';
import { eventBus } from '../events/event-bus';
import { SaveDataV3Schema, SaveDataV4Schema, type SaveDataV3, type SaveDataV4, type Serializer } from '../state/serializer';
import type { SaveMeta } from '../state/serializer';

export type SaveListEntry = {
  filePath: string;
  meta: SaveMeta;
};

// Injected fs — allows tests to override without mock.module
export const _fs = {
  ...nodeFs,
  mkdir: fsMkdir,
  readdir: fsReaddir,
};

export function getSaveDir(opts?: { portable?: boolean; customDir?: string }): string {
  if (opts?.customDir) return path.resolve(opts.customDir);
  if (opts?.portable) return './saves';
  const paths = envPaths('Chronicle', { suffix: '' });
  return `${paths.data}/saves`;
}

export async function ensureSaveDirExists(saveDir: string): Promise<void> {
  await _fs.mkdir(saveDir, { recursive: true });
}

function formatTimestamp(): string {
  return new Date().toISOString().slice(0, 16).replace(/:/g, '-');
}

export async function quickSave(serializer: Serializer, saveDir: string): Promise<string> {
  await ensureSaveDirExists(saveDir);
  const filePath = `${saveDir}/quicksave.json`;
  const json = serializer.snapshot('Quick Save');
  await Bun.write(filePath, json);
  return filePath;
}

export async function saveGame(name: string, serializer: Serializer, saveDir: string): Promise<string> {
  await ensureSaveDirExists(saveDir);
  const safeName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '-');
  const filePath = `${saveDir}/${safeName}_${formatTimestamp()}.json`;
  const json = serializer.snapshot(name);
  await Bun.write(filePath, json);
  return filePath;
}

export async function loadGame(filePath: string, serializer: Serializer, saveDir?: string): Promise<void> {
  const resolvedPath = path.resolve(filePath);
  if (saveDir) {
    const resolvedSaveDir = path.resolve(saveDir);
    if (!resolvedPath.startsWith(resolvedSaveDir + path.sep) && resolvedPath !== resolvedSaveDir) {
      throw new Error(`Path traversal detected: ${filePath} is outside save directory`);
    }
  }
  const file = Bun.file(resolvedPath);
  const json = await file.text();
  serializer.restore(json);
  eventBus.emit('state_restored', undefined);
}

export async function listSaves(saveDir: string): Promise<SaveListEntry[]> {
  const allFiles = await _fs.readdir(saveDir);
  const files = allFiles.filter((f: string) => f.endsWith('.json'));
  const entries: SaveListEntry[] = [];

  for (const fileName of files) {
    const filePath = `${saveDir}/${fileName}`;
    try {
      const file = Bun.file(filePath);
      const text = await file.text();
      const parsed = JSON.parse(text);
      const meta = parsed?.meta as SaveMeta | undefined;
      if (meta) {
        entries.push({ filePath, meta });
      }
    } catch (err) {
      if (fileName !== 'branches.json') {
        console.error(`[SaveManager] Failed to read save file ${fileName}:`, err instanceof Error ? err.message : String(err));
      }
    }
  }

  return entries.sort((a, b) =>
    new Date(b.meta.timestamp).getTime() - new Date(a.meta.timestamp).getTime()
  );
}

export async function readSaveData(fileName: string, saveDir: string): Promise<SaveDataV4> {
  const resolvedDir = path.resolve(saveDir);
  const resolved = path.isAbsolute(fileName) ? path.resolve(fileName) : path.resolve(resolvedDir, fileName);
  if (!resolved.startsWith(resolvedDir + path.sep) && resolved !== resolvedDir) {
    throw new Error('Invalid save file path: path traversal detected');
  }
  const raw = await Bun.file(resolved).json();
  return SaveDataV4Schema.parse(raw);
}
