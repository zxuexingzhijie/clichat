import { z } from 'zod';

export const NpcDialogueSchema = z.object({
  dialogue: z.string().min(10).max(300).describe('NPC对白，自然口语'),
  emotionTag: z.enum(['neutral', 'happy', 'angry', 'sad', 'fearful', 'amused', 'suspicious']),
  shouldRemember: z.boolean().describe('是否将此次互动写入NPC长期记忆'),
  relationshipDelta: z.number().min(-0.5).max(0.5).describe('关系值变化建议'),
});

export type NpcDialogue = z.infer<typeof NpcDialogueSchema>;
