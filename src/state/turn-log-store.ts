import { z } from 'zod';
import { createStore, type Store } from './create-store';
import type { EventBus } from '../events/event-bus';

// View-size compatibility only; storage must retain all turn-log entries.
export const MAX_TURN_LOG_SIZE = 50;

export const TurnLogEntrySchema = z.object({
  turnNumber: z.number(),
  action: z.string(),
  checkResult: z.string().nullable(),
  narrationLines: z.array(z.string()),
  npcDialogue: z.array(z.string()).optional(),
  timestamp: z.string(),
});

export const TurnLogStateSchema = z.object({
  entries: z.array(TurnLogEntrySchema),
});
export type TurnLogState = z.infer<typeof TurnLogStateSchema>;

export function getDefaultTurnLogState(): TurnLogState {
  return { entries: [] };
}

export function createTurnLogStore(_bus: EventBus): Store<TurnLogState> {
  return createStore<TurnLogState>(getDefaultTurnLogState());
}
