import type { NpcMemoryEntry } from '../../state/npc-memory-store';

export type PromptPair = {
  readonly system: string;
  readonly prompt: string;
};

export function buildNpcMemoryCompressPrompt(
  npcId: string,
  memories: readonly NpcMemoryEntry[],
): PromptPair {
  const system =
    '你是一个记忆压缩助手。将NPC的记忆条目压缩为简洁的存档摘要，使用中文，不超过200字。只输出摘要文本，不要有任何前缀或说明。';
  const memoriesText = memories
    .map((m) => `[第${m.turnNumber}回合] ${m.event} (重要性:${m.importance})`)
    .join('\n');
  const prompt = `NPC ID: ${npcId}\n\n以下是需要压缩的记忆条目：\n${memoriesText}\n\n请生成一段简洁的存档摘要（不超过200字）：`;
  return { system, prompt };
}

export function buildChapterSummaryPrompt(recentNarration: readonly string[]): PromptPair {
  const system =
    '你是一个叙事摘要助手。将最近的游戏叙述压缩为章节摘要，使用中文，不超过300字。只输出摘要文本，不要有任何前缀或说明。';
  const narrationText = recentNarration.join('\n');
  const prompt = `以下是最近的游戏叙述内容：\n${narrationText}\n\n请生成一段章节摘要（不超过300字）：`;
  return { system, prompt };
}

export type TurnLogEntry = {
  readonly turnNumber: number;
  readonly action: string;
  readonly narration: string;
};

export function buildTurnLogCompressPrompt(turns: readonly TurnLogEntry[]): PromptPair {
  const system =
    '你是一个回合日志压缩助手。将多个游戏回合的记录压缩为简洁摘要，使用中文，100-200字之间。只输出摘要文本，不要有任何前缀或说明。';
  const turnsText = turns
    .map((t) => `[第${t.turnNumber}回合] 行动：${t.action} / 叙述：${t.narration}`)
    .join('\n');
  const prompt = `以下是需要压缩的回合记录：\n${turnsText}\n\n请生成一段简洁摘要（100-200字）：`;
  return { system, prompt };
}
