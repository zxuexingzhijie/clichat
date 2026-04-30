import { npcMemoryStore } from '../../state/npc-memory-store';
import { sceneStore } from '../../state/scene-store';
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

const recentChapterSummaries: string[] = [];
const recentTurnCompressBlocks: string[] = [];

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
  const record = npcMemoryStore.getState().memories[task.targetId];
  if (!record || record.version !== task.baseVersion) {
    return 'conflict';
  }

  npcMemoryStore.setState((draft) => {
    const r = draft.memories[task.targetId];
    if (r) {
      r.archiveSummary = result;
      r.recentMemories = r.recentMemories.slice(task.entryIds.length) as typeof r.recentMemories;
      r.version += 1;
    }
  });

  return 'applied';
}

async function dispatchTask(task: SummarizerTask): Promise<void> {
  if (task.type === 'npc_memory_compress') {
    const record = npcMemoryStore.getState().memories[task.targetId];
    if (!record) {
      throw new Error(`NPC record not found for targetId: ${task.targetId}`);
    }
    const result = await generateNpcMemorySummary(task.targetId, record.recentMemories);
    const applyResult = await applyNpcMemoryCompression(task, result);
    if (applyResult === 'conflict') {
      throw new Error('Version conflict during npc_memory_compress');
    }
    return;
  }

  if (task.type === 'chapter_summary') {
    const narrationLines = sceneStore.getState().narrationLines;
    const result = await generateChapterSummary(narrationLines);
    recentChapterSummaries.push(result);
    return;
  }

  if (task.type === 'turn_log_compress') {
    const allEntries = getTurnLog();
    const entries = task.entryIds.length > 0
      ? allEntries.filter(e => task.entryIds.includes(String(e.turnNumber)))
      : allEntries.slice(-20);
    const result = await generateTurnLogCompress(entries);
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
      await new Promise<void>((r) => setTimeout(r, 5000));
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
