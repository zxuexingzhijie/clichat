import React from 'react';
import { Text } from 'ink';

type DividerProps = {
  readonly width: number;
};

export function Divider({ width }: DividerProps): React.ReactNode {
  const inner = '─'.repeat(Math.max(0, width - 2));
  return <Text>{'├' + inner + '┤'}</Text>;
}
