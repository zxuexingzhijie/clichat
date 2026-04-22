import { npcMemoryStore } from '../../state/npc-memory-store';
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
    const result = await generateChapterSummary([]);
    recentChapterSummaries.push(result);
    return;
  }

  if (task.type === 'turn_log_compress') {
    const result = await generateTurnLogCompress([]);
    recentTurnCompressBlocks.push(result);
    return;
  }
}

export async function runSummarizerLoop(): Promise<void> {
  while (true) {
    const task = dequeuePending();
    if (!task) {
      await new Promise<void>((r) => setTimeout(r, 5000));
      continue;
    }

    markRunning(task.id);
    try {
      await dispatchTask(task);
      markDone(task.id);
    } catch {
      markFailed(task.id);
    }
  }
}
