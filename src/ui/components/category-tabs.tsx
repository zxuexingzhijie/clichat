import React from 'react';
import { Box, Text } from 'ink';

type CategoryTab = {
  readonly name: string;
  readonly count: number;
};

type CategoryTabsProps = {
  readonly categories: readonly CategoryTab[];
  readonly activeIndex: number;
  readonly onSelect: (index: number) => void;
};

export function CategoryTabs({ categories, activeIndex }: CategoryTabsProps): React.ReactNode {
  return (
    <Box flexDirection="row" gap={1}>
      {categories.map((cat, i) => (
        <Text
          key={cat.name}
          bold={i === activeIndex}
          color={i === activeIndex ? 'yellow' : undefined}
          dimColor={i !== activeIndex}
        >
          {cat.name}({cat.count})
        </Text>
      ))}
    </Box>
  );
}

export type { CategoryTab, CategoryTabsProps };
