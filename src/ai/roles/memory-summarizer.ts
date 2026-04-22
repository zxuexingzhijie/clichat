import { generateText } from 'ai';
import { getRoleConfig } from '../providers';
import { recordUsage } from '../../state/cost-session-store';
import type { NpcMemoryEntry } from '../../state/npc-memory-store';
import {
  buildNpcMemoryCompressPrompt,
  buildChapterSummaryPrompt,
  buildTurnLogCompressPrompt,
  type TurnLogEntry,
} from '../summarizer/summarizer-prompts';

export async function generateNpcMemorySummary(
  npcId: string,
  memories: readonly NpcMemoryEntry[],
): Promise<string> {
  const config = getRoleConfig('summarizer');
  const { system, prompt } = buildNpcMemoryCompressPrompt(npcId, memories);
  const { text, usage } = await generateText({
    model: config.model(),
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    system,
    prompt,
  });
  recordUsage('summarizer', usage);
  return text;
}

export async function generateChapterSummary(
  narrationLines: readonly string[],
): Promise<string> {
  const config = getRoleConfig('summarizer');
  const { system, prompt } = buildChapterSummaryPrompt(narrationLines);
  const { text, usage } = await generateText({
    model: config.model(),
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    system,
    prompt,
  });
  recordUsage('summarizer', usage);
  return text;
}

export async function generateTurnLogCompress(
  turns: readonly TurnLogEntry[],
): Promise<string> {
  const config = getRoleConfig('summarizer');
  const { system, prompt } = buildTurnLogCompressPrompt(turns);
  const { text, usage } = await generateText({
    model: config.model(),
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    system,
    prompt,
  });
  recordUsage('summarizer', usage);
  return text;
}
