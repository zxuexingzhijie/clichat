import React from 'react';
import { Box, Text, useInput } from 'ink';

type VictoryScreenProps = {
  readonly onQuit: () => void;
};

export function VictoryScreen({ onQuit }: VictoryScreenProps): React.ReactNode {
  useInput((input, key) => {
    if (input === 'q' || input === 'Q' || key.escape) {
      onQuit();
    }
  });

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" padding={2}>
      <Box marginBottom={1}>
        <Text bold color="yellow">★ 黑松镇的秘密 ★</Text>
      </Box>
      <Box marginBottom={2}>
        <Text bold color="green">— 故事终章 —</Text>
      </Box>
      <Box flexDirection="column" alignItems="center" marginBottom={2}>
        <Text>你揭露了黑松镇背后隐藏已久的真相，</Text>
        <Text>狼灾的根源终于大白于天下。</Text>
        <Text>镇民们将永远记得这位勇敢的旅人。</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>[Q] 返回标题</Text>
      </Box>
    </Box>
  );
}
