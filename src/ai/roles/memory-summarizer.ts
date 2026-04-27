import { getRoleConfig } from '../providers';
import { callGenerateText } from '../utils/ai-caller';
import type { NpcMemoryEntry } from '../../state/npc-memory-store';
import {
  buildNpcMemoryCompressPrompt,
  buildChapterSummaryPrompt,
  buildTurnLogCompressPrompt,
  type TurnLogEntry,
} from '../summarizer/summarizer-prompts';

async function callSummarizer(system: string, prompt: string): Promise<string> {
  const config = getRoleConfig('summarizer');
  const { text } = await callGenerateText({
    role: 'summarizer',
    providerName: config.providerName,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    system,
    prompt,
  });
  return text;
}

export async function generateNpcMemorySummary(
  npcId: string,
  memories: readonly NpcMemoryEntry[],
): Promise<string> {
  const { system, prompt } = buildNpcMemoryCompressPrompt(npcId, memories);
  return callSummarizer(system, prompt);
}

export async function generateChapterSummary(
  narrationLines: readonly string[],
): Promise<string> {
  const { system, prompt } = buildChapterSummaryPrompt(narrationLines);
  return callSummarizer(system, prompt);
}

export async function generateTurnLogCompress(
  turns: readonly TurnLogEntry[],
): Promise<string> {
  const { system, prompt } = buildTurnLogCompressPrompt(turns);
  return callSummarizer(system, prompt);
}
