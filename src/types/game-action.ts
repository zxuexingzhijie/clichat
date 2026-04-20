import { z } from 'zod';

export const GameActionTypeSchema = z.enum([
  'move', 'look', 'talk', 'attack', 'use_item',
  'cast', 'guard', 'flee', 'inspect', 'trade',
  'help', 'save', 'unknown',
]);
export type GameActionType = z.infer<typeof GameActionTypeSchema>;

export const GameActionSchema = z.object({
  type: GameActionTypeSchema,
  target: z.string().nullable(),
  modifiers: z.record(z.string(), z.string()).default({}),
  source: z.enum(['command', 'intent', 'action_select']).default('command'),
});
export type GameAction = z.infer<typeof GameActionSchema>;
