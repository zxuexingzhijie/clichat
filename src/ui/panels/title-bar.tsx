import React from 'react';
import { Box, Text } from 'ink';

type TitleBarProps = {
  readonly gameName?: string;
  readonly day: number;
  readonly timeOfDay: string;
};

export function TitleBar({
  gameName = 'Chronicle CLI',
  day,
  timeOfDay,
}: TitleBarProps): React.ReactNode {
  return (
    <Box justifyContent="space-between" paddingX={1}>
      <Text bold color="cyan">{gameName}</Text>
      <Text dimColor>Day {day} / {timeOfDay}</Text>
    </Box>
  );
}
