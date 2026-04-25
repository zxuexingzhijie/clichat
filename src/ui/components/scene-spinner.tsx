import React from 'react';
import { Spinner } from '@inkjs/ui';

export type SpinnerContext = 'narration' | 'npc_dialogue' | 'combat';

type SceneSpinnerProps = {
  readonly context: SpinnerContext;
};

export const SPINNER_LABELS: Record<SpinnerContext, readonly string[]> = {
  narration: ['命运之轮转动中...', '史官正在记录...'],
  npc_dialogue: ['正在思考...'],
  combat: ['攻击展开...', '局势变化...'],
};

export function SceneSpinner({ context }: SceneSpinnerProps): React.ReactNode {
  const labels = SPINNER_LABELS[context];
  const [label] = React.useState(() =>
    labels[Math.floor(Math.random() * labels.length)]!
  );
  return <Spinner type="dots" label={label} />;
}
