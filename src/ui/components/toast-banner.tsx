import React from 'react';
import { Box, Text } from 'ink';
import type { ToastData } from '../hooks/use-toast';

type ToastBannerProps = {
  readonly toast: ToastData;
};

export function ToastBanner({ toast }: ToastBannerProps): React.ReactNode {
  return (
    <Box paddingX={1}>
      <Text color={toast.color} bold>
        {toast.icon} {toast.message}
      </Text>
    </Box>
  );
}
