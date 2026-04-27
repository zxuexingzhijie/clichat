import React from 'react';
import { Box, Text } from 'ink';

type Props = { children: React.ReactNode; onReset?: () => void };
type State = { error: Error | null };

export class GameErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <Box flexDirection="column" paddingX={1}>
          <Text color="red" bold>发生错误</Text>
          <Text color="red">{this.state.error.message}</Text>
          <Text dimColor>按 Esc 返回</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}
