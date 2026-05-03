import { npcMemoryStore, type NpcMemoryEntry, type NpcMemoryState } from '../../state/npc-memory-store';
import { combatStore, type CombatState } from '../../state/combat-store';
import { eventBus } from '../../events/event-bus';
import type { EventBus } from '../../events/event-bus';
import { enqueueTask } from './summarizer-queue';

const NPC_MEMORY_THRESHOLD = 10;
const DEBOUNCE_MS = 5000;

let lastEvaluatedAt = 0;

function getRawMemorySource(record: {
  readonly allMemories?: readonly NpcMemoryEntry[];
  readonly salientMemories?: readonly NpcMemoryEntry[];
  readonly recentMemories?: readonly NpcMemoryEntry[];
}): NpcMemoryEntry[] {
  const source = record.allMemories && record.allMemories.length > 0
    ? record.allMemories
    : [...(record.salientMemories ?? []), ...(record.recentMemories ?? [])];
  const seenIds = new Set<string>();
  return source.filter((memory) => {
    if (seenIds.has(memory.id)) return false;
    seenIds.add(memory.id);
    return true;
  });
}

export type TriggerSource =
  | 'npc_memory_written'
  | 'save_game_completed'
  | 'quest_stage_advanced'
  | 'combat_ended'
  | 'interval';

type SummarizerSchedulerStores = {
  readonly npcMemory: { readonly getState: () => NpcMemoryState };
  readonly combat: { readonly getState: () => CombatState };
};

const defaultStores: SummarizerSchedulerStores = {
  npcMemory: npcMemoryStore,
  combat: combatStore,
};

export function evaluateTriggers(
  triggerSource: TriggerSource,
  context?: { npcId?: string },
  stores: SummarizerSchedulerStores = defaultStores,
): void {
  const now = Date.now();
  if (triggerSource === 'interval' && now - lastEvaluatedAt < DEBOUNCE_MS) {
    return;
  }
  lastEvaluatedAt = now;

  const combatActive = stores.combat.getState().active;

  if (triggerSource === 'save_game_completed') {
    enqueueTask({
      type: 'chapter_summary',
      targetId: `chapter_${Date.now()}`,
      entryIds: [],
      baseVersion: 0,
      priority: 1,
      triggerReason: 'save_game_completed',
    });
    return;
  }

  if (triggerSource === 'combat_ended') {
    return;
  }

  if (triggerSource === 'npc_memory_written' && context?.npcId) {
    const { npcId } = context;
    const record = stores.npcMemory.getState().memories[npcId];
    if (!record) return;

    const source = getRawMemorySource(record);
    const archiveSourceIds = record.archiveSourceIds ?? [];
    const unsummarized = source.filter((memory) => !archiveSourceIds.includes(memory.id));

    if (unsummarized.length >= NPC_MEMORY_THRESHOLD) {
      const taskPriority = 2 as const;
      if (combatActive && taskPriority >= 2) return;

      enqueueTask({
        type: 'npc_memory_compress',
        targetId: npcId,
        entryIds: unsummarized.map((memory) => memory.id),
        baseVersion: record.version,
        priority: taskPriority,
        triggerReason: 'npc_memory_written',
      });
    }
    return;
  }

  if (triggerSource === 'interval') {
    const memories = stores.npcMemory.getState().memories;
    for (const [npcId, record] of Object.entries(memories)) {
      if (!record) continue;
      const source = getRawMemorySource(record);
      const archiveSourceIds = record.archiveSourceIds ?? [];
      const unsummarized = source.filter((memory) => !archiveSourceIds.includes(memory.id));

      if (unsummarized.length >= NPC_MEMORY_THRESHOLD) {
        const taskPriority = 3 as const;
        if (combatActive && taskPriority >= 3) continue;

        enqueueTask({
          type: 'npc_memory_compress',
          targetId: npcId,
          entryIds: unsummarized.map((memory) => memory.id),
          baseVersion: record.version,
          priority: taskPriority,
          triggerReason: 'interval',
        });
      }
    }
  }
}

export function initSummarizerScheduler(
  bus: EventBus = eventBus,
  stores: SummarizerSchedulerStores = defaultStores,
): () => void {
  const handleNpcMemoryWritten = ({ npcId }: { npcId: string }) => {
    evaluateTriggers('npc_memory_written', { npcId }, stores);
  };
  const handleSaveGameCompleted = () => {
    evaluateTriggers('save_game_completed', undefined, stores);
  };
  const handleCombatEnded = () => {
    evaluateTriggers('combat_ended', undefined, stores);
  };

  bus.on('npc_memory_written', handleNpcMemoryWritten);
  bus.on('save_game_completed', handleSaveGameCompleted);
  bus.on('combat_ended', handleCombatEnded);

  return () => {
    bus.off('npc_memory_written', handleNpcMemoryWritten);
    bus.off('save_game_completed', handleSaveGameCompleted);
    bus.off('combat_ended', handleCombatEnded);
  };
}
