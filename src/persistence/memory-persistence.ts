import { mkdirSync } from 'node:fs';
import { eventBus } from '../events/event-bus';
import { npcMemoryStore, NpcMemoryRecordSchema, type NpcMemoryRecord } from '../state/npc-memory-store';

const DEFAULT_REGION = 'blackpine_town';

export function applyRetention(record: NpcMemoryRecord): NpcMemoryRecord {
  let recent = [...record.recentMemories];
  let salient = [...record.salientMemories];
  let archive = record.archiveSummary;

  if (recent.length >= 15) {
    const promoted = recent[0]!;
    recent = recent.slice(1);
    salient = [...salient, promoted];
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

async function writeMemoryToDisk(npcId: string, memoryDir: string): Promise<void> {
  const storeRecord = npcMemoryStore.getState().memories[npcId];
  if (!storeRecord) return;

  const region = DEFAULT_REGION;
  const regionDir = `${memoryDir}/${region}`;
  const npcFilePath = `${regionDir}/${npcId}.json`;
  const indexPath = `${memoryDir}/index.json`;

  mkdirSync(regionDir, { recursive: true });

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

export function initMemoryPersistence(memoryDir: string): void {
  eventBus.on('npc_memory_written', ({ npcId }) => {
    writeMemoryToDisk(npcId, memoryDir).catch(err => {
      console.error(`[memory-persistence] write failed for ${npcId}:`, err);
    });
  });
}
