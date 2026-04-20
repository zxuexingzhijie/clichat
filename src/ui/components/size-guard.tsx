import React from 'react';
import { Box, Text } from 'ink';
import { useScreenSize } from 'fullscreen-ink';

type SizeGuardProps = {
  readonly minWidth?: number;
  readonly minHeight?: number;
  readonly children: React.ReactNode;
};

export function SizeGuard({
  minWidth = 80,
  minHeight = 24,
  children,
}: SizeGuardProps): React.ReactNode {
  const { width, height } = useScreenSize();

  if (width < minWidth || height < minHeight) {
    return (
      <Box
        justifyContent="center"
        alignItems="center"
        width={width}
        height={height}
      >
        <Text color="yellow">
          终端窗口过小，请调整至 {minWidth}x{minHeight} 以上
        </Text>
      </Box>
    );
  }

  return <>{children}</>;
}
