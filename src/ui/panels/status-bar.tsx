import React from 'react';
import { Box, Text } from 'ink';
import stringWidth from 'string-width';

type StatusBarProps = {
  readonly hp: number;
  readonly maxHp: number;
  readonly mp: number;
  readonly maxMp: number;
  readonly gold: number;
  readonly location: string;
  readonly quest: string | null;
  readonly width: number;
};

function truncateLocation(name: string, maxWidth: number): string {
  let currentWidth = 0;
  for (let i = 0; i < name.length; i++) {
    const charWidth = stringWidth(name[i]!);
    if (currentWidth + charWidth + 3 > maxWidth) {
      return name.slice(0, i) + '...';
    }
    currentWidth += charWidth;
  }
  return name;
}

export function StatusBar({
  hp,
  maxHp,
  mp,
  maxMp,
  gold,
  location,
  quest,
  width,
}: StatusBarProps): React.ReactNode {
  const hpRatio = maxHp > 0 ? hp / maxHp : 1;
  const hpColor = hpRatio < 0.1 ? 'red' : hpRatio < 0.25 ? 'yellow' : undefined;
  const hpBold = hpRatio < 0.1;

  const fields: React.ReactNode[] = [];

  fields.push(
    <Text key="hp" color={hpColor} bold={hpBold}>
      HP {hp}/{maxHp}
    </Text>,
  );

  fields.push(<Text key="mp">  MP {mp}/{maxMp}</Text>);

  if (width >= 45) {
    fields.push(<Text key="gold">  Gold {gold}</Text>);
  }

  if (width >= 55) {
    const locDisplay = width < 65
      ? truncateLocation(location, 10)
      : location;
    fields.push(<Text key="loc">  Location: {locDisplay}</Text>);
  }

  if (width >= 65) {
    const questDisplay = quest ?? 'None';
    fields.push(
      <Text key="quest" dimColor={!quest}>
        {'  Quest: '}{questDisplay}
      </Text>,
    );
  }

  return (
    <Box paddingX={1}>
      {fields}
    </Box>
  );
}
