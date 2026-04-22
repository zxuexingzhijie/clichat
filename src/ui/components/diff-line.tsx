import React from 'react';
import { Box, Text } from 'ink';
import type { DiffMarker } from '../../engine/branch-diff';

type DiffLineProps = {
  readonly marker: DiffMarker;
  readonly content: string;
  readonly isHighImpact: boolean;
};

function getMarkerColor(marker: DiffMarker): string {
  switch (marker) {
    case '+': return 'green';
    case '-': return 'red';
    case '~': return 'yellow';
  }
}

export function DiffLine({ marker, content, isHighImpact }: DiffLineProps): React.ReactNode {
  const markerColor = getMarkerColor(marker);
  return (
    <Box flexDirection="row">
      <Text color={markerColor}>{marker} </Text>
      <Text>{content}</Text>
      {isHighImpact && <Text color="yellow" bold>  !高影响</Text>}
    </Box>
  );
}
