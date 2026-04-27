import { z } from 'zod';
import { createStore, type Store } from './create-store';
import type { EventBus } from '../events/event-bus';
import { TurnLogEntrySchema } from './serializer';

export const MAX_TURN_LOG_SIZE = 50;

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
