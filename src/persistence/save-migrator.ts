import { getDefaultQuestState } from '../state/quest-store';
import { getDefaultRelationState } from '../state/relation-store';
import { getDefaultNpcMemoryState } from '../state/npc-memory-store';
import { getDefaultNarrativeState } from '../state/narrative-state';
import type { SaveDataV6 } from '../state/serializer';

function buildMetaFromV1(data: Record<string, unknown>): unknown {
  const player = data['player'] as Record<string, unknown> | undefined;
  const scene = data['scene'] as Record<string, unknown> | undefined;
  return {
    saveName: 'Migrated Save',
    timestamp: (data['timestamp'] as string) ?? new Date().toISOString(),
    character: {
      name: (player?.['name'] as string) ?? 'Unknown',
      race: (player?.['race'] as string) ?? 'Unknown',
      profession: (player?.['profession'] as string) ?? 'Unknown',
    },
    playtime: 0,
    locationName: (scene?.['currentSceneId'] as string) ?? 'Unknown',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function dedupeMemoriesById(memories: unknown[]): unknown[] {
  const seenIds = new Set<string>();
  return memories.filter(memory => {
    if (!isRecord(memory) || typeof memory['id'] !== 'string') return true;
    const id = memory['id'];
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });
}

function normalizeNpcMemorySnapshot(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const snapshot = raw['npcMemorySnapshot'];
  if (!isRecord(snapshot)) return raw;
  const memories = snapshot['memories'];
  if (!isRecord(memories)) return raw;

  const normalizedMemories = Object.fromEntries(
    Object.entries(memories).map(([npcId, value]) => {
      if (!isRecord(value)) return [npcId, value];

      const allMemories = Array.isArray(value['allMemories']) ? value['allMemories'] : [];
      const recentMemories = Array.isArray(value['recentMemories']) ? value['recentMemories'] : [];
      const salientMemories = Array.isArray(value['salientMemories']) ? value['salientMemories'] : [];
      const rawSource = allMemories.length > 0 ? allMemories : [...salientMemories, ...recentMemories];

      return [
        npcId,
        {
          ...value,
          allMemories: dedupeMemoriesById(rawSource),
          archiveSourceIds: Array.isArray(value['archiveSourceIds']) ? value['archiveSourceIds'] : [],
        },
      ];
    }),
  );

  return {
    ...raw,
    npcMemorySnapshot: {
      ...snapshot,
      memories: normalizedMemories,
    },
  };
}

export function migrateV2ToV3(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const data = raw as Record<string, unknown>;
  if (data['version'] !== 2) return raw;
  return {
    ...data,
    version: 3,
    branchId: 'main',
    parentSaveId: null,
    exploration: { locations: {} },
    playerKnowledge: { entries: {} },
    turnLog: [],
  };
}

export function migrateV3ToV4(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const data = raw as Record<string, unknown>;
  if (data['version'] !== 3) return raw;
  return {
    ...data,
    version: 4,
  };
}

export function migrateV4ToV5(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const data = raw as Record<string, unknown>;
  if (data['version'] !== 4) return raw;
  return {
    ...data,
    version: 5,
    narrativeState: getDefaultNarrativeState(),
  };
}

export function migrateV5ToV6(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const data = raw as Record<string, unknown>;
  if (data['version'] !== 5) return raw;
  const scene = (data['scene'] as Record<string, unknown> | undefined) ?? {};
  return {
    ...data,
    version: 6,
    scene: {
      ...scene,
      droppedItems: scene['droppedItems'] ?? [],
    },
  };
}

export function migrateV1ToV2(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const data = raw as Record<string, unknown>;
  if (data['version'] !== 1) return raw;
  const npcMemory = data['npcMemory'];
  return {
    ...data,
    version: 2,
    meta: buildMetaFromV1(data),
    quest: getDefaultQuestState(),
    relations: getDefaultRelationState(),
    npcMemorySnapshot:
      npcMemory !== undefined && npcMemory !== null
        ? npcMemory
        : getDefaultNpcMemoryState(),
    questEventLog: [],
  };
}

export function migrateToLatest(raw: unknown): SaveDataV6 {
  const v2 = migrateV1ToV2(raw);
  const v3 = migrateV2ToV3(v2);
  const v4 = migrateV3ToV4(v3);
  const v5 = migrateV4ToV5(v4);
  const v6 = migrateV5ToV6(v5);
  return normalizeNpcMemorySnapshot(v6) as SaveDataV6;
}
