import { type ExplorationLevel } from '../state/exploration-store';
import type { Store } from '../state/create-store';
import type { ExplorationState } from '../state/exploration-store';
import type { GameState } from '../state/game-store';
import type { EventBus } from '../events/event-bus';

const LEVEL_ORDER: readonly ExplorationLevel[] = ['unknown', 'rumored', 'known', 'visited', 'surveyed'];

function getLevelRank(level: ExplorationLevel): number {
  return LEVEL_ORDER.indexOf(level);
}

export function initExplorationTracker(
  stores: { exploration: Store<ExplorationState>; game: Store<GameState> },
  eventBus: EventBus,
): () => void {
  const handler = ({ sceneId }: { sceneId: string; previousSceneId: string | null }) => {
    const current = stores.exploration.getState().locations[sceneId];
    const currentLevel = current?.level ?? 'unknown';
    const visitedRank = getLevelRank('visited');
    const currentRank = getLevelRank(currentLevel);

    if (currentRank >= visitedRank) return;

    const turnNumber = stores.game.getState().turnCount;

    stores.exploration.setState(draft => {
      draft.locations[sceneId] = {
        locationId: sceneId,
        level: 'visited',
        discoveredAt: current?.discoveredAt ?? turnNumber,
        discoverySource: 'scene_visit',
        credibility: 1.0,
        description: current?.description ?? '',
        discoveredPOIs: current?.discoveredPOIs ?? [],
      };
    });
  };

  eventBus.on('scene_changed', handler);

  return () => {
    eventBus.off('scene_changed', handler);
  };
}

export function markLocationLevel(
  stores: { exploration: Store<ExplorationState>; game: Store<GameState> },
  locationId: string,
  level: ExplorationLevel,
  source: string,
  credibility: number = 0.5,
): void {
  const current = stores.exploration.getState().locations[locationId];
  const currentRank = getLevelRank(current?.level ?? 'unknown');
  const newRank = getLevelRank(level);

  if (newRank <= currentRank) return;

  const turnNumber = stores.game.getState().turnCount;
  stores.exploration.setState(draft => {
    draft.locations[locationId] = {
      locationId,
      level,
      discoveredAt: current?.discoveredAt ?? turnNumber,
      discoverySource: source,
      credibility,
      description: current?.description ?? '',
      discoveredPOIs: current?.discoveredPOIs ?? [],
    };
  });
}
