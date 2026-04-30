import * as nodeFs from 'node:fs';
import { mkdir as fsMkdir } from 'node:fs/promises';
import { eventBus } from '../events/event-bus';
import type { EventBus } from '../events/event-bus';
import { npcMemoryStore, type NpcMemoryRecord, type NpcMemoryState } from '../state/npc-memory-store';
import type { Store } from '../state/create-store';

// Injected fs — allows tests to override without mock.module
export const _fs = {
  ...nodeFs,
  mkdir: fsMkdir,
};

const DEFAULT_REGION = 'blackpine_town';

export function applyRetention(record: NpcMemoryRecord): NpcMemoryRecord {
  let recent = [...record.recentMemories];
  let salient = [...record.salientMemories];
  let archive = record.archiveSummary;

  if (recent.length >= 15) {
    const importanceOrder = { low: 0, medium: 1, high: 2 };
    const sorted = [...recent].sort((a, b) => {
      const impDiff = importanceOrder[a.importance] - importanceOrder[b.importance];
      if (impDiff !== 0) return impDiff;
      return a.turnNumber - b.turnNumber;
    });
    const toEvict = sorted[0]!;
    const evictIndex = recent.findIndex(m => m.id === toEvict.id);
    recent = [...recent.slice(0, evictIndex), ...recent.slice(evictIndex + 1)];
    salient = [...salient, toEvict];
  }

  if (salient.length >= 50) {
    const archived = salient.slice(0, 25);
    salient = salient.slice(25);
    const archivedText = archived.map(m => m.event).join('；');
    archive = archive ? `${archive}；${archivedText}` : archivedText;
  }

  return {
    ...record,
    recentMemories: recent,
    salientMemories: salient,
    archiveSummary: archive,
    lastUpdated: new Date().toISOString(),
  };
}

async function writeMemoryToDisk(npcId: string, memoryDir: string, store: Store<NpcMemoryState>): Promise<void> {
  const storeRecord = store.getState().memories[npcId];
  if (!storeRecord) return;

  const region = DEFAULT_REGION;
  const regionDir = `${memoryDir}/${region}`;
  const npcFilePath = `${regionDir}/${npcId}.json`;
  const indexPath = `${memoryDir}/index.json`;

  await _fs.mkdir(regionDir, { recursive: true });

  const retained = applyRetention(storeRecord);

  await Bun.write(npcFilePath, JSON.stringify(retained, null, 2));

  const indexFile = Bun.file(indexPath);
  const indexExists = await indexFile.exists();
  let index: Record<string, unknown> = {};
  if (indexExists) {
    try {
      const rawText = await indexFile.text();
      const parsed = JSON.parse(rawText);
      if (typeof parsed === 'object' && parsed !== null) {
        index = parsed as Record<string, unknown>;
      }
    } catch {
      index = {};
    }
  }

  index[npcId] = {
    filePath: npcFilePath,
    region,
    updatedAt: new Date().toISOString(),
  };

  await Bun.write(indexPath, JSON.stringify(index, null, 2));
}

export function initMemoryPersistence(
  memoryDir: string,
  bus: EventBus = eventBus,
  store: Store<NpcMemoryState> = npcMemoryStore,
  options: { readonly debounceMs?: number } = {},
): () => void {
  const debounceMs = options.debounceMs ?? 500;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const flush = (npcId: string) => {
    writeMemoryToDisk(npcId, memoryDir, store).catch(err => {
      console.error(`[memory-persistence] write failed for ${npcId}:`, err);
    });
  };

  const handler = ({ npcId }: { npcId: string }) => {
    const existing = timers.get(npcId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      timers.delete(npcId);
      flush(npcId);
    }, debounceMs);
    timers.set(npcId, timer);
  };

  bus.on('npc_memory_written', handler);

  return () => {
    bus.off('npc_memory_written', handler);
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
  };
}
