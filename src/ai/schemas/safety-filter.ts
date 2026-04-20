import { z } from 'zod';

export const SafetyFilterResultSchema = z.object({
  safe: z.boolean().describe('是否安全'),
  reason: z.string().optional().describe('不安全原因'),
  category: z.enum(['safe', 'state_override', 'inappropriate_content', 'prompt_injection']).optional(),
});

export type SafetyFilterResult = z.infer<typeof SafetyFilterResultSchema>;
