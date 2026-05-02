import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner } from '@inkjs/ui';
import { GameStoreCtx } from '../../app';
import type { BranchMeta } from '../../state/branch-store';
import type { SaveDataV7 } from '../../state/serializer';
import { compareBranches } from '../../engine/branch-diff';
import type { DiffCategory, DiffItem, BranchDiffResult } from '../../engine/branch-diff';
import { generateBranchNarrative } from '../../ai/roles/branch-narrator';
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

export type ComparePanelProps = {
  readonly branches: Record<string, BranchMeta>;
  readonly readSaveData: (fileName: string, saveDir: string) => Promise<SaveDataV7>;
  readonly saveDir: string;
  readonly onClose: () => void;
  readonly width?: number;
};

type SelectingState = { stage: 'selecting'; leftFocus: boolean; leftIdx: number; rightIdx: number; confirmedSource: string | null; confirmedTarget: string | null };

type CompareState =
  | SelectingState
  | { stage: 'loading' }
  | { stage: 'summarizing'; diffResult: BranchDiffResult }
  | { stage: 'ready'; diffResult: BranchDiffResult; narrativeSummary: string; sourceName: string; targetName: string }
  | { stage: 'error'; message: string; lastSource?: string; lastTarget?: string };

export type { SelectingState };

export function buildInitialState(compareSpec: { source: string; target: string } | null | undefined): CompareState {
  if (compareSpec) {
    return { stage: 'loading' };
  }
  return {
    stage: 'selecting',
    leftFocus: true,
    leftIdx: 0,
    rightIdx: 0,
    confirmedSource: null,
    confirmedTarget: null,
  };
}

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
  branches,
  readSaveData,
  saveDir,
  onClose,
  width = 80,
}: ComparePanelProps): React.ReactNode {
  const compareSpec = GameStoreCtx.useStoreState(s => s.compareSpec);
  const isWide = width >= 100;

  const branchList = useMemo(
    () => Object.values(branches).sort((a, b) => a.name.localeCompare(b.name)),
    [branches],
  );

  const [state, setState] = useState<CompareState>(() => buildInitialState(compareSpec));

  const [viewMode, setViewMode] = useState<ViewMode>('unified');

  const runCompare = useCallback(async (sourceName: string, targetName: string) => {
    setState({ stage: 'loading' });

    const sourceMeta = branchList.find(b => b.name === sourceName);
    const targetMeta = branchList.find(b => b.name === targetName);

    if (!sourceMeta) {
      setState({ stage: 'error', message: `未找到分支: ${sourceName}`, lastSource: sourceName, lastTarget: targetName });
      return;
    }
    if (!targetMeta) {
      setState({ stage: 'error', message: `未找到分支: ${targetName}`, lastSource: sourceName, lastTarget: targetName });
      return;
    }
    if (!sourceMeta.headSaveId) {
      setState({ stage: 'error', message: `分支 ${sourceName} 没有存档`, lastSource: sourceName, lastTarget: targetName });
      return;
    }
    if (!targetMeta.headSaveId) {
      setState({ stage: 'error', message: `分支 ${targetName} 没有存档`, lastSource: sourceName, lastTarget: targetName });
      return;
    }

    let sourceData: SaveDataV7;
    let targetData: SaveDataV7;

    try {
      [sourceData, targetData] = await Promise.all([
        readSaveData(sourceMeta.headSaveId, saveDir),
        readSaveData(targetMeta.headSaveId, saveDir),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState({ stage: 'error', message: `加载存档失败: ${msg}`, lastSource: sourceName, lastTarget: targetName });
      return;
    }

    const diffResult = compareBranches(sourceData, targetData);
    setState({ stage: 'summarizing', diffResult });

    let narrativeSummary = '';
    try {
      narrativeSummary = await generateBranchNarrative(sourceName, targetName, diffResult);
    } catch {
      // narrative is optional; proceed with empty summary
    }

    setState({ stage: 'ready', diffResult, narrativeSummary, sourceName, targetName });
  }, [branchList, readSaveData, saveDir]);

  useEffect(() => {
    if (compareSpec) {
      void runCompare(compareSpec.source, compareSpec.target);
    }
  }, [compareSpec, runCompare]);

  useInput((input: string, key: {
    escape: boolean;
    tab: boolean;
    upArrow: boolean;
    downArrow: boolean;
    leftArrow: boolean;
    rightArrow: boolean;
    return: boolean;
  }) => {
    if (state.stage === 'selecting') {
      if (key.escape) {
        onClose();
      } else if (key.leftArrow || key.rightArrow) {
        setState(prev => {
          if (prev.stage !== 'selecting') return prev;
          return { ...prev, leftFocus: !prev.leftFocus };
        });
      } else if (key.upArrow) {
        setState(prev => {
          if (prev.stage !== 'selecting') return prev;
          if (prev.leftFocus) {
            return { ...prev, leftIdx: Math.max(0, prev.leftIdx - 1) };
          }
          return { ...prev, rightIdx: Math.max(0, prev.rightIdx - 1) };
        });
      } else if (key.downArrow) {
        setState(prev => {
          if (prev.stage !== 'selecting') return prev;
          const maxIdx = branchList.length - 1;
          if (prev.leftFocus) {
            return { ...prev, leftIdx: Math.min(maxIdx, prev.leftIdx + 1) };
          }
          return { ...prev, rightIdx: Math.min(maxIdx, prev.rightIdx + 1) };
        });
      } else if (key.return) {
        if (state.leftFocus) {
          const newConfirmedSource = branchList[state.leftIdx]?.name ?? null;
          setState({ ...state, confirmedSource: newConfirmedSource, leftFocus: false });
        } else {
          const newConfirmedTarget = branchList[state.rightIdx]?.name ?? null;
          setState({ ...state, confirmedTarget: newConfirmedTarget });
          if (state.confirmedSource && newConfirmedTarget) {
            void runCompare(state.confirmedSource, newConfirmedTarget);
          }
        }
      }
    } else if (state.stage === 'ready') {
      if (key.escape) {
        onClose();
      } else if (key.tab && isWide) {
        setViewMode(prev => prev === 'unified' ? 'side-by-side' : 'unified');
      }
    } else if (state.stage === 'error') {
      if (key.escape) {
        onClose();
      } else if (input === 'r' || input === 'R') {
        if (state.lastSource && state.lastTarget) {
          void runCompare(state.lastSource, state.lastTarget);
        } else {
          setState({
            stage: 'selecting',
            leftFocus: true,
            leftIdx: 0,
            rightIdx: 0,
            confirmedSource: null,
            confirmedTarget: null,
          });
        }
      }
    }
  });

  if (state.stage === 'selecting') {
    const { leftFocus, leftIdx, rightIdx, confirmedSource } = state;
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <Text bold color="cyan">【选择要比较的分支】</Text>
        <Box flexDirection="row" marginTop={1}>
          <Box flexDirection="column" borderStyle="single" paddingX={1} width={20}>
            <Text bold color={leftFocus ? 'cyan' : undefined}>源分支</Text>
            {branchList.map((b, idx) => (
              <Box key={b.id}>
                <Text color={confirmedSource === b.name ? 'green' : undefined}>
                  {idx === leftIdx && leftFocus ? '▶ ' : '  '}{b.name}
                </Text>
              </Box>
            ))}
          </Box>
          <Box flexDirection="column" borderStyle="single" paddingX={1} width={20}>
            <Text bold color={!leftFocus ? 'cyan' : undefined}>目标分支</Text>
            {branchList.map((b, idx) => (
              <Box key={b.id}>
                <Text>
                  {idx === rightIdx && !leftFocus ? '▶ ' : '  '}{b.name}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>←→ 切换列  ↑↓ 选择  Enter 确认  Esc 取消</Text>
        </Box>
      </Box>
    );
  }

  if (state.stage === 'loading') {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1} justifyContent="center">
        <Spinner label="正在加载存档数据..." />
      </Box>
    );
  }

  if (state.stage === 'summarizing') {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1} justifyContent="center">
        <Spinner label="正在生成时间线对比..." />
      </Box>
    );
  }

  if (state.stage === 'error') {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <Text bold color="red">⚠ {state.message}</Text>
        <Box marginTop={1}>
          <Text dimColor>[R] 重试  [Esc] 取消</Text>
        </Box>
      </Box>
    );
  }

  const { diffResult, narrativeSummary, sourceName, targetName } = state;
  const grouped = groupByCategory(diffResult.diffs);
  const isEmpty = diffResult.diffs.length === 0;

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Box>
          <Text bold color="cyan">【分支对比】</Text>
          <Text>{sourceName} ↔ {targetName}</Text>
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

          {narrativeSummary.length > 0 && (
            <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="yellow" paddingX={1}>
              <Text bold color="yellow">── 叙事影响 ──</Text>
              <Text>{narrativeSummary}</Text>
            </Box>
          )}

          {viewMode === 'unified' || !isWide ? (
            <UnifiedView grouped={grouped} />
          ) : (
            <SideBySideView
              grouped={grouped}
              sourceBranchName={sourceName}
              targetBranchName={targetName}
            />
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>↑↓ 滚动    {isWide ? 'Tab 切换并排/列表    ' : ''}Esc 返回</Text>
      </Box>
    </Box>
  );
}
