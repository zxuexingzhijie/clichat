import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import type { DiffCategory, DiffItem, BranchDiffResult } from '../../engine/branch-diff';
import { DiffLine } from '../components/diff-line';

const CATEGORY_LABELS: Record<DiffCategory, string> = {
  quest: '任务进度',
  npc_relation: 'NPC 关系',
  inventory: '背包',
  location: '位置',
  faction: '阵营声望',
  knowledge: '已发现真相',
};

const CATEGORY_ORDER: readonly DiffCategory[] = [
  'quest',
  'npc_relation',
  'inventory',
  'location',
  'faction',
  'knowledge',
];

type ViewMode = 'unified' | 'side-by-side';

type ComparePanelProps = {
  readonly sourceBranchName: string;
  readonly targetBranchName: string;
  readonly diffResult: BranchDiffResult;
  readonly narrativeSummary: string;
  readonly onClose: () => void;
  readonly width?: number;
};

function groupByCategory(diffs: readonly DiffItem[]): Map<DiffCategory, readonly DiffItem[]> {
  const groups = new Map<DiffCategory, DiffItem[]>();
  for (const diff of diffs) {
    const existing = groups.get(diff.category);
    if (existing) {
      existing.push(diff);
    } else {
      groups.set(diff.category, [diff]);
    }
  }
  return groups;
}

function UnifiedView({ grouped }: { readonly grouped: Map<DiffCategory, readonly DiffItem[]> }): React.ReactNode {
  return (
    <>
      {CATEGORY_ORDER.filter(cat => grouped.has(cat)).map(category => (
        <Box key={category} flexDirection="column" marginTop={1}>
          <Text bold dimColor>── {CATEGORY_LABELS[category]} ──</Text>
          {grouped.get(category)!.map((diff, idx) => (
            <DiffLine
              key={`${diff.key}-${idx}`}
              marker={diff.marker}
              content={diff.description}
              isHighImpact={diff.isHighImpact}
            />
          ))}
        </Box>
      ))}
    </>
  );
}

function SideBySideView({
  grouped,
  sourceBranchName,
  targetBranchName,
}: {
  readonly grouped: Map<DiffCategory, readonly DiffItem[]>;
  readonly sourceBranchName: string;
  readonly targetBranchName: string;
}): React.ReactNode {
  return (
    <>
      <Box flexDirection="row" marginTop={1}>
        <Box width="48%">
          <Text bold>{sourceBranchName}</Text>
        </Box>
        <Box width={1}><Text dimColor>│</Text></Box>
        <Box width="48%">
          <Text bold>{targetBranchName}</Text>
        </Box>
      </Box>
      {CATEGORY_ORDER.filter(cat => grouped.has(cat)).map(category => {
        const items = grouped.get(category)!;
        return (
          <Box key={category} flexDirection="column" marginTop={1}>
            <Text bold dimColor>── {CATEGORY_LABELS[category]} ──</Text>
            {items.map((diff, idx) => (
              <Box key={`${diff.key}-${idx}`} flexDirection="row">
                <Box width="48%">
                  {(diff.marker === '-' || diff.marker === '~') && (
                    <DiffLine
                      marker={diff.marker}
                      content={diff.sourceValue ?? diff.description}
                      isHighImpact={diff.isHighImpact}
                    />
                  )}
                </Box>
                <Box width={1}><Text dimColor>│</Text></Box>
                <Box width="48%">
                  {(diff.marker === '+' || diff.marker === '~') && (
                    <DiffLine
                      marker={diff.marker}
                      content={diff.targetValue ?? diff.description}
                      isHighImpact={diff.isHighImpact}
                    />
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        );
      })}
    </>
  );
}

export function ComparePanel({
  sourceBranchName,
  targetBranchName,
  diffResult,
  narrativeSummary,
  onClose,
  width = 80,
}: ComparePanelProps): React.ReactNode {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('unified');
  const isWide = width >= 100;

  const grouped = useMemo(
    () => groupByCategory(diffResult.diffs),
    [diffResult.diffs],
  );

  useInput(useCallback((_input: string, key: {
    escape: boolean;
    upArrow: boolean;
    downArrow: boolean;
    tab: boolean;
  }) => {
    if (key.escape) {
      onClose();
    } else if (key.upArrow) {
      setScrollOffset(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setScrollOffset(prev => prev + 1);
    } else if (key.tab && isWide) {
      setViewMode(prev => prev === 'unified' ? 'side-by-side' : 'unified');
    }
  }, [onClose, isWide]));

  const isEmpty = diffResult.diffs.length === 0;

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Box>
          <Text bold color="cyan">【分支对比】</Text>
          <Text>{sourceBranchName} ↔ {targetBranchName}</Text>
        </Box>
        <Text dimColor>Esc 返回</Text>
      </Box>

      {isEmpty ? (
        <Box marginTop={1}>
          <Text dimColor>两条分支目前没有差异。继续冒险，让命运分叉。</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Text>摘要: {diffResult.totalCount} 项差异，{diffResult.highImpactCount} 项高影响分歧</Text>

          {viewMode === 'unified' || !isWide ? (
            <UnifiedView grouped={grouped} />
          ) : (
            <SideBySideView
              grouped={grouped}
              sourceBranchName={sourceBranchName}
              targetBranchName={targetBranchName}
            />
          )}

          {narrativeSummary.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text bold dimColor>── 叙事影响 ──</Text>
              <Text>{narrativeSummary}</Text>
            </Box>
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>↑↓ 滚动    {isWide ? 'Tab 切换并排/列表    ' : ''}Esc 返回</Text>
      </Box>
    </Box>
  );
}
