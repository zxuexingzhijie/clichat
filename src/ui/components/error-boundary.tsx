import React from 'react';
import { Box, Text } from 'ink';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class GameErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[GameErrorBoundary] Caught error:', error.message, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Box flexDirection="column" paddingX={1}>
          <Text color="red" bold>发生错误</Text>
          <Text color="red">{this.state.error.message}</Text>
          <Text dimColor>请重启游戏</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}
