import React from 'react';
import { Text } from 'ink';
import type { ExplorationLevel } from '../../state/exploration-store';

type MapNodeProps = {
  readonly icon: string;
  readonly explorationLevel: ExplorationLevel;
  readonly isCurrentLocation: boolean;
  readonly isQuestRelated: boolean;
  readonly isSelected: boolean;
};

export function MapNode({
  icon,
  explorationLevel,
  isCurrentLocation,
  isQuestRelated,
  isSelected,
}: MapNodeProps): React.ReactNode {
  if (explorationLevel === 'unknown') return null;

  const displayIcon = explorationLevel === 'rumored' ? '?' : icon;
  const nodeText = `[${displayIcon}]`;

  if (isCurrentLocation) return <Text color="cyan" bold>{nodeText}</Text>;
  if (isSelected) return <Text color="cyan">{nodeText}</Text>;
  if (isQuestRelated) return <Text color="magenta">{nodeText}</Text>;

  switch (explorationLevel) {
    case 'rumored':
      return <Text dimColor>{nodeText}</Text>;
    case 'known':
      return <Text dimColor>{nodeText}</Text>;
    case 'visited':
      return <Text>{nodeText}</Text>;
    case 'surveyed':
      return <Text bold>{nodeText}</Text>;
    default:
      return <Text>{nodeText}</Text>;
  }
}
