import envPaths from 'env-paths';
import * as nodeFs from 'node:fs';
import path from 'node:path';
import type { Serializer } from '../state/serializer';
import type { SaveMeta } from '../state/serializer';

export type SaveListEntry = {
  filePath: string;
  meta: SaveMeta;
};

// Injected fs — allows tests to override without mock.module
export const _fs = nodeFs;

export function getSaveDir(opts?: { portable?: boolean; customDir?: string }): string {
  if (opts?.customDir) return path.resolve(opts.customDir);
  if (opts?.portable) return './saves';
  const paths = envPaths('Chronicle', { suffix: '' });
  return `${paths.data}/saves`;
}

export async function ensureSaveDirExists(saveDir: string): Promise<void> {
  _fs.mkdirSync(saveDir, { recursive: true });
}

function formatTimestamp(): string {
  return new Date().toISOString().slice(0, 16).replace(/:/g, '-');
}

export async function quickSave(serializer: Serializer, saveDir: string): Promise<string> {
  await ensureSaveDirExists(saveDir);
  const filePath = `${saveDir}/quicksave.json`;
  const json = serializer.snapshot();
  await Bun.write(filePath, json);
  return filePath;
}

export async function saveGame(name: string, serializer: Serializer, saveDir: string): Promise<string> {
  await ensureSaveDirExists(saveDir);
  const safeName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '-');
  const filePath = `${saveDir}/${safeName}_${formatTimestamp()}.json`;
  const json = serializer.snapshot();
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
}

export async function listSaves(saveDir: string): Promise<SaveListEntry[]> {
  const files = _fs.readdirSync(saveDir).filter((f: string) => f.endsWith('.json'));
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
    } catch {
      // Skip files that cannot be parsed
    }
  }

  return entries.sort((a, b) =>
    new Date(b.meta.timestamp).getTime() - new Date(a.meta.timestamp).getTime()
  );
}
