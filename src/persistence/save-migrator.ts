import { getDefaultQuestState } from '../state/quest-store';
import { getDefaultRelationState } from '../state/relation-store';
import { getDefaultNpcMemoryState } from '../state/npc-memory-store';
import { getDefaultNarrativeState } from '../state/narrative-state';

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
