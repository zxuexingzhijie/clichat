import React from 'react';
import { Text } from 'ink';
import { Spinner } from '@inkjs/ui';

export type SpinnerContext = 'narration' | 'npc_dialogue' | 'combat';

type SceneSpinnerProps = {
  readonly context: SpinnerContext;
  readonly isDimming?: boolean;
};

export const SPINNER_LABELS: Record<SpinnerContext, readonly string[]> = {
  narration: ['命运之轮转动中...', '史官正在记录...'],
  npc_dialogue: ['正在思考...'],
  combat: ['攻击展开...', '局势变化...'],
};

export function SceneSpinner({ context, isDimming }: SceneSpinnerProps): React.ReactNode {
  const labels = SPINNER_LABELS[context];
  const [label] = React.useState(() =>
    labels[Math.floor(Math.random() * labels.length)]!
  );
  if (isDimming) {
    return <Text dimColor>{label}</Text>;
  }
  return <Spinner type="dots" label={label} />;
}
