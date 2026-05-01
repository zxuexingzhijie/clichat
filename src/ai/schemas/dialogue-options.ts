import { z } from 'zod';

export const DialogueOptionsSchema = z.object({
  options: z
    .array(z.string().min(4).max(60))
    .min(2)
    .max(3)
    .describe('2-3个跟进选项，每项简短口语化，直接回应NPC刚才说的内容'),
});

export type DialogueOptions = z.infer<typeof DialogueOptionsSchema>;
