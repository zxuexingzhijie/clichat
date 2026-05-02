import { z } from 'zod';

export const NpcDialogueSchema = z.object({
  dialogue: z.string().min(10).max(300).describe('NPC对白，自然口语'),
  emotionTag: z.enum(['neutral', 'happy', 'angry', 'sad', 'fearful', 'amused', 'suspicious']),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'hostile']).describe('NPC对玩家的态度倾向'),
  memoryNote: z.string().nullable().describe('值得记住的事，用第一人称简短描述；若无则 null'),
});

export type NpcDialogue = z.infer<typeof NpcDialogueSchema>;
export type NpcSentiment = NpcDialogue['sentiment'];
