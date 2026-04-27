import { z } from 'zod';
import { createStore, type Store } from './create-store';
import { eventBus } from '../events/event-bus';
import type { EventBus } from '../events/event-bus';

export const ExplorationLevelSchema = z.enum(['unknown', 'rumored', 'known', 'visited', 'surveyed']);
export type ExplorationLevel = z.infer<typeof ExplorationLevelSchema>;

export const LocationExplorationSchema = z.object({
  locationId: z.string(),
  level: ExplorationLevelSchema,
  discoveredAt: z.number(),
  discoverySource: z.string(),
  credibility: z.number().min(0).max(1),
  description: z.string(),
  discoveredPOIs: z.array(z.string()),
});
export type LocationExploration = z.infer<typeof LocationExplorationSchema>;

export const ExplorationStateSchema = z.object({
  locations: z.record(z.string(), LocationExplorationSchema),
});
export type ExplorationState = z.infer<typeof ExplorationStateSchema>;

export function getDefaultExplorationState(): ExplorationState {
  return { locations: {} };
}

export function createExplorationStore(bus: EventBus): Store<ExplorationState> {
  return createStore<ExplorationState>(
    getDefaultExplorationState(),
    ({ newState, oldState }) => {
      for (const locationId of Object.keys(newState.locations)) {
        const newLoc = newState.locations[locationId]!;
        const oldLoc = oldState.locations[locationId];

        if (!oldLoc) {
          bus.emit('location_explored', {
            locationId,
            newLevel: newLoc.level,
            previousLevel: null,
          });
        } else if (oldLoc.level !== newLoc.level) {
          bus.emit('location_discovery_level_changed', {
            locationId,
            oldLevel: oldLoc.level,
            newLevel: newLoc.level,
          });
        }
      }
    },
  );
}

export const explorationStore = createExplorationStore(eventBus);
