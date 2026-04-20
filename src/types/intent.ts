import { z } from 'zod';

export const IntentActionSchema = z.enum([
  'move', 'look', 'talk', 'attack', 'use_item',
  'cast', 'guard', 'flee', 'inspect', 'trade',
]);

export const IntentSchema = z.object({
  action: IntentActionSchema,
  target: z.string().nullable(),
  modifiers: z.record(z.string(), z.string()).optional(),
  confidence: z.number().min(0).max(1),
  raw_interpretation: z.string(),
});
export type Intent = z.infer<typeof IntentSchema>;
