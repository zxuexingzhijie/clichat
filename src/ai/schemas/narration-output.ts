import { z } from 'zod';

export const NarrationOutputSchema = z.object({
  text: z.string().min(10).max(300).describe('场景叙述文字，不超过300字'),
});

export type NarrationOutput = z.infer<typeof NarrationOutputSchema>;
