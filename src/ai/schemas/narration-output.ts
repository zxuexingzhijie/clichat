import { z } from 'zod';

export const NarrationOutputSchema = z.object({
  narration: z.string().min(10).max(300).describe('80-180字中文场景叙述'),
  sceneType: z.enum(['exploration', 'combat', 'dialogue', 'lore', 'horror', 'check_result']),
  suggestedActions: z.array(z.string()).max(4).describe('建议的下一步行动'),
});

export type NarrationOutput = z.infer<typeof NarrationOutputSchema>;
