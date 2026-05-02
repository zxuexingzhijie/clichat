import { npcMemoryStore, type NpcMemoryEntry, type NpcMemoryState } from '../../state/npc-memory-store';
import { sceneStore, type SceneState } from '../../state/scene-store';
import { getTurnLog } from '../../engine/turn-log';
import {
  dequeuePending,
  markRunning,
  markDone,
  markFailed,
  type SummarizerTask,
} from './summarizer-queue';
import {
  generateNpcMemorySummary,
  generateChapterSummary,
  generateTurnLogCompress,
} from '../roles/memory-summarizer';

type RuntimeNpcMemoryStore = {
  readonly getState: () => NpcMemoryState;
  readonly setState: (recipe: (draft: NpcMemoryState) => void) => void;
};

type RuntimeSceneStore = {
  readonly getState: () => SceneState;
};

let runtimeNpcMemoryStore: RuntimeNpcMemoryStore = npcMemoryStore;
let runtimeSceneStore: RuntimeSceneStore = sceneStore;

const recentChapterSummaries: string[] = [];
const recentTurnCompressBlocks: string[] = [];

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

export function configureSummarizerWorkerStores(stores: {
  readonly npcMemory?: RuntimeNpcMemoryStore;
  readonly scene?: RuntimeSceneStore;
}): () => void {
  const previousNpcMemoryStore = runtimeNpcMemoryStore;
  const previousSceneStore = runtimeSceneStore;
  runtimeNpcMemoryStore = stores.npcMemory ?? runtimeNpcMemoryStore;
  runtimeSceneStore = stores.scene ?? runtimeSceneStore;
  return () => {
    runtimeNpcMemoryStore = previousNpcMemoryStore;
    runtimeSceneStore = previousSceneStore;
  };
}

export function getRecentChapterSummaries(): readonly string[] {
  return recentChapterSummaries;
}

export function getRecentTurnCompressBlocks(): readonly string[] {
  return recentTurnCompressBlocks;
}

export async function applyNpcMemoryCompression(
  task: SummarizerTask,
  result: string,
): Promise<'applied' | 'conflict'> {
  const record = runtimeNpcMemoryStore.getState().memories[task.targetId];
  if (!record || record.version !== task.baseVersion) {
    return 'conflict';
  }

  runtimeNpcMemoryStore.setState((draft) => {
    const r = draft.memories[task.targetId];
    if (r) {
      r.archiveSummary = result;
      r.archiveSourceIds = Array.from(new Set([...(r.archiveSourceIds ?? []), ...task.entryIds]));
      r.version += 1;
    }
  });

  return 'applied';
}

async function dispatchTask(task: SummarizerTask): Promise<void> {
  if (task.type === 'npc_memory_compress') {
    const record = runtimeNpcMemoryStore.getState().memories[task.targetId];
    if (!record) {
      throw new Error(`NPC record not found for targetId: ${task.targetId}`);
    }
    const rawSource = getRawMemorySource(record);
    const entriesById = new Map(rawSource.map((memory) => [memory.id, memory]));
    const entries = task.entryIds
      .map((entryId) => entriesById.get(entryId))
      .filter((memory): memory is NpcMemoryEntry => Boolean(memory));
    const result = await generateNpcMemorySummary(task.targetId, entries);
    const applyResult = await applyNpcMemoryCompression({
      ...task,
      entryIds: entries.map((memory) => memory.id),
    }, result);
    if (applyResult === 'conflict') {
      throw new Error('Version conflict during npc_memory_compress');
    }
    return;
  }

  if (task.type === 'chapter_summary') {
    const narrationLines = runtimeSceneStore.getState().narrationLines;
    const result = await generateChapterSummary(narrationLines);
    recentChapterSummaries.push(result);
    return;
  }

  if (task.type === 'turn_log_compress') {
    const allEntries = getTurnLog();
    const entries = task.entryIds.length > 0
      ? allEntries.filter(e => task.entryIds.includes(String(e.turnNumber)))
      : allEntries.slice(-20);
    const result = await generateTurnLogCompress(
      entries.map(e => ({ turnNumber: e.turnNumber, action: e.action, narration: e.narrationLines.join(' ') }))
    );
    recentTurnCompressBlocks.push(result);
    return;
  }
}

export async function runNextTask(): Promise<boolean> {
  const task = dequeuePending();
  if (!task) {
    return false;
  }

  markRunning(task.id);
  try {
    await dispatchTask(task);
    markDone(task.id);
  } catch {
    markFailed(task.id);
  }
  return true;
}

export async function runSummarizerLoop(signal: AbortSignal): Promise<void> {
  while (true) {
    if (signal.aborted) {
      console.error('[summarizer] received abort signal — shutting down');
      return;
    }

    const task = dequeuePending();
    if (!task) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 5000);
        signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
      });
      if (signal.aborted) {
        console.error('[summarizer] received abort signal — shutting down');
        return;
      }
      continue;
    }

    markRunning(task.id);
    try {
      await dispatchTask(task);
      if (signal.aborted) {
        console.error('[summarizer] received abort signal — shutting down');
        return;
      }
      markDone(task.id);
    } catch {
      markFailed(task.id);
    }
  }
}
