import { eventBus } from '../events/event-bus';
import { explorationStore, type ExplorationLevel } from '../state/exploration-store';
import { gameStore } from '../state/game-store';

const LEVEL_ORDER: readonly ExplorationLevel[] = ['unknown', 'rumored', 'known', 'visited', 'surveyed'];

function getLevelRank(level: ExplorationLevel): number {
  return LEVEL_ORDER.indexOf(level);
}

export function initExplorationTracker(): () => void {
  const handler = ({ sceneId }: { sceneId: string; previousSceneId: string | null }) => {
    const current = explorationStore.getState().locations[sceneId];
    const currentLevel = current?.level ?? 'unknown';
    const visitedRank = getLevelRank('visited');
    const currentRank = getLevelRank(currentLevel);

    if (currentRank >= visitedRank) return;

    const turnNumber = gameStore.getState().turnCount;

    explorationStore.setState(draft => {
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
  locationId: string,
  level: ExplorationLevel,
  source: string,
  credibility: number = 0.5,
): void {
  const current = explorationStore.getState().locations[locationId];
  const currentRank = getLevelRank(current?.level ?? 'unknown');
  const newRank = getLevelRank(level);

  if (newRank <= currentRank) return;

  const turnNumber = gameStore.getState().turnCount;
  explorationStore.setState(draft => {
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
