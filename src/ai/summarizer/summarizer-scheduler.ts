import { npcMemoryStore } from '../../state/npc-memory-store';
import { combatStore } from '../../state/combat-store';
import { eventBus } from '../../events/event-bus';
import { enqueueTask } from './summarizer-queue';

const NPC_MEMORY_THRESHOLD = 10;
const DEBOUNCE_MS = 5000;

let lastEvaluatedAt = 0;

export type TriggerSource =
  | 'npc_memory_written'
  | 'save_game_completed'
  | 'quest_stage_advanced'
  | 'combat_ended'
  | 'interval';

export function evaluateTriggers(
  triggerSource: TriggerSource,
  context?: { npcId?: string },
): void {
  const now = Date.now();
  if (triggerSource === 'interval' && now - lastEvaluatedAt < DEBOUNCE_MS) {
    return;
  }
  lastEvaluatedAt = now;

  const combatActive = combatStore.getState().active;

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
    const record = npcMemoryStore.getState().memories[npcId];
    if (!record) return;

    if (record.recentMemories.length >= NPC_MEMORY_THRESHOLD) {
      const taskPriority = 2 as const;
      if (combatActive && taskPriority >= 2) return;

      enqueueTask({
        type: 'npc_memory_compress',
        targetId: npcId,
        entryIds: record.recentMemories.map((m) => m.id),
        baseVersion: record.version,
        priority: taskPriority,
        triggerReason: 'npc_memory_written',
      });
    }
    return;
  }

  if (triggerSource === 'interval') {
    const memories = npcMemoryStore.getState().memories;
    for (const [npcId, record] of Object.entries(memories)) {
      if (!record) continue;
      if (record.recentMemories.length >= NPC_MEMORY_THRESHOLD) {
        const taskPriority = 3 as const;
        if (combatActive && taskPriority >= 3) continue;

        enqueueTask({
          type: 'npc_memory_compress',
          targetId: npcId,
          entryIds: record.recentMemories.map((m) => m.id),
          baseVersion: record.version,
          priority: taskPriority,
          triggerReason: 'interval',
        });
      }
    }
  }
}

eventBus.on('npc_memory_written', ({ npcId }) => {
  evaluateTriggers('npc_memory_written', { npcId });
});

eventBus.on('save_game_completed', () => {
  evaluateTriggers('save_game_completed');
});

eventBus.on('combat_ended', () => {
  evaluateTriggers('combat_ended');
});
