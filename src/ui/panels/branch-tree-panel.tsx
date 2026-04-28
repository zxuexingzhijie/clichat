import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import type { BranchMeta } from '../../state/branch-store';

type BranchSaveInfo = {
  readonly saveId: string;
  readonly saveName: string;
  readonly gameTime: string;
  readonly location: string;
  readonly questStage: string;
};

type BranchDisplayNode = {
  readonly branchMeta: BranchMeta;
  readonly saves: readonly BranchSaveInfo[];
  readonly children: readonly BranchDisplayNode[];
};

type BranchTreePanelProps = {
  readonly tree: readonly BranchDisplayNode[];
  readonly currentBranchId: string;
  readonly onClose: () => void;
  readonly onCompare: (branchId: string) => void;
  readonly onSwitch: (branchId: string) => void;
  readonly width?: number;
  readonly switchMessage?: string;
};

export type { BranchSaveInfo, BranchDisplayNode, BranchTreePanelProps };

type FlatLine = {
  readonly branchId: string;
  readonly saveId: string | null;
  readonly text: React.ReactNode;
};

function buildTreeLines(
  nodes: readonly BranchDisplayNode[],
  currentBranchId: string,
  prefix: string,
  isLast: boolean,
  isRoot: boolean,
): FlatLine[] {
  const lines: FlatLine[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const isLastChild = i === nodes.length - 1;
    const connector = isRoot ? '' : (isLastChild ? '└── ' : '├── ');
    const continuation = isRoot ? '' : (isLastChild ? '    ' : '│   ');
    const isCurrent = node.branchMeta.id === currentBranchId;
    const branchName = node.branchMeta.name;

    const headSaveId = node.branchMeta.headSaveId;
    const headSave = node.saves.find(s => s.saveId === headSaveId);
    const otherSaves = node.saves.filter(s => s.saveId !== headSaveId);

    const branchLine = (
      <Box flexDirection="row">
        <Text dimColor={!isRoot && !isCurrent}>{prefix}{connector}</Text>
        <Text bold={isCurrent} color={isCurrent ? 'cyan' : undefined}>{branchName}</Text>
        {headSave && (
          <>
            <Text> ──● </Text>
            <Text>{headSave.saveName} ({headSave.gameTime}, {headSave.location})</Text>
          </>
        )}
        {isCurrent && <Text color="cyan">    ← 当前</Text>}
      </Box>
    );

    lines.push({ branchId: node.branchMeta.id, saveId: null, text: branchLine });

    const savePrefix = prefix + continuation;
    for (const save of otherSaves) {
      const isLastSave = save === otherSaves[otherSaves.length - 1] && node.children.length === 0;
      const saveConnector = isLastSave ? '└── ' : '    ';
      lines.push({
        branchId: node.branchMeta.id,
        saveId: save.saveId,
        text: (
          <Box flexDirection="row">
            <Text dimColor>{savePrefix}{saveConnector}</Text>
            <Text>○ {save.saveName} ({save.gameTime}, {save.location})</Text>
          </Box>
        ),
      });
    }

    if (node.children.length > 0) {
      const childLines = buildTreeLines(
        node.children,
        currentBranchId,
        prefix + continuation,
        isLastChild,
        false,
      );
      lines.push(...childLines);
    }
  }

  return lines;
}

function DetailPane({ node, save, tree }: {
  readonly node: BranchDisplayNode;
  readonly save: BranchSaveInfo | undefined;
  readonly tree: readonly BranchDisplayNode[];
}): React.ReactNode {
  const displaySave = save ?? (node.saves.length > 0 ? node.saves[0] : undefined);

  function findNode(nodes: readonly BranchDisplayNode[], id: string): BranchDisplayNode | undefined {
    for (const n of nodes) {
      if (n.branchMeta.id === id) return n;
      const found = findNode(n.children, id);
      if (found) return found;
    }
    return undefined;
  }

  const parentName = node.branchMeta.parentBranchId
    ? (findNode(tree, node.branchMeta.parentBranchId)?.branchMeta.name ?? node.branchMeta.parentBranchId)
    : null;

  return (
    <Box flexDirection="column" paddingX={1} borderStyle="single" borderColor="gray">
      <Text bold>{node.branchMeta.name}</Text>
      {node.branchMeta.description.length > 0 && (
        <Text dimColor>{node.branchMeta.description}</Text>
      )}
      {displaySave ? (
        <>
          <Text> </Text>
          <Text>存档: {displaySave.saveName}</Text>
          <Text>时间: {displaySave.gameTime}</Text>
          <Text>位置: {displaySave.location}</Text>
          {displaySave.questStage.length > 0 && (
            <Text>任务: {displaySave.questStage}</Text>
          )}
        </>
      ) : (
        <Text dimColor>当前分支尚无存档。游戏会自动保存，或使用 /save 手动存档。</Text>
      )}
      {parentName && (
        <Text dimColor>从 {parentName} 分出</Text>
      )}
    </Box>
  );
}

export function BranchTreePanel({
  tree,
  currentBranchId,
  onClose,
  onCompare,
  onSwitch,
  width = 80,
  switchMessage,
}: BranchTreePanelProps): React.ReactNode {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmPending, setConfirmPending] = useState(false);

  const flatLines = useMemo(
    () => buildTreeLines(tree, currentBranchId, '', true, true),
    [tree, currentBranchId],
  );

  const hasOnlyMain = tree.length === 1
    && tree[0]!.children.length === 0
    && tree[0]!.branchMeta.name === 'main';

  const isEmpty = tree.length === 0;
  const isWide = width >= 100;

  const selectedLine = flatLines[selectedIndex];
  const selectedNode = useMemo(() => {
    if (!selectedLine) return undefined;
    function findNode(nodes: readonly BranchDisplayNode[], branchId: string): BranchDisplayNode | undefined {
      for (const n of nodes) {
        if (n.branchMeta.id === branchId) return n;
        const found = findNode(n.children, branchId);
        if (found) return found;
      }
      return undefined;
    }
    return findNode(tree, selectedLine.branchId);
  }, [tree, selectedLine]);

  const selectedSave = useMemo(() => {
    if (!selectedLine?.saveId || !selectedNode) return undefined;
    return selectedNode.saves.find(s => s.saveId === selectedLine.saveId);
  }, [selectedLine, selectedNode]);

  useInput(useCallback((input: string, key: {
    escape: boolean;
    upArrow: boolean;
    downArrow: boolean;
    return: boolean;
  }) => {
    if (key.escape) {
      if (confirmPending) { setConfirmPending(false); return; }
      onClose();
    } else if (key.upArrow) {
      setConfirmPending(false);
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setConfirmPending(false);
      setSelectedIndex(prev => Math.min(flatLines.length - 1, prev + 1));
    } else if (input === 'c' && selectedLine) {
      onCompare(selectedLine.branchId);
    } else if (key.return && selectedLine) {
      if (!confirmPending) {
        setConfirmPending(true);
      } else {
        setConfirmPending(false);
        onSwitch(selectedLine.branchId);
      }
    }
  }, [onClose, onCompare, onSwitch, flatLines.length, selectedLine, confirmPending]));

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color="cyan">【分支树】</Text>
        <Text dimColor>Esc 返回</Text>
      </Box>

      {(isEmpty || hasOnlyMain) ? (
        <Box marginTop={1}>
          <Text dimColor>目前只有主线剧情。使用 /branch {'{'+'name'+'}'} 在关键抉择前创建分支，探索不同命运。</Text>
        </Box>
      ) : isWide ? (
        <Box flexDirection="row" marginTop={1} flexGrow={1}>
          <Box flexDirection="column" width="60%">
            {flatLines.map((line, idx) => (
              <Box key={`line-${idx}`}>
                {idx === selectedIndex ? (
                  <Text bold color="cyan">{' > '}</Text>
                ) : (
                  <Text>{'   '}</Text>
                )}
                {line.text}
              </Box>
            ))}
          </Box>
          <Box width="40%">
            {selectedNode && (
              <DetailPane node={selectedNode} save={selectedSave} tree={tree} />
            )}
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {flatLines.map((line, idx) => (
            <Box key={`line-${idx}`}>
              {idx === selectedIndex ? (
                <Text bold color="cyan">{' > '}</Text>
              ) : (
                <Text>{'   '}</Text>
              )}
              {line.text}
            </Box>
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        {confirmPending
          ? <Text color="yellow">再按 Enter 确认切换分支，Esc 取消</Text>
          : <Text dimColor>↑↓ 选择节点    Enter 切换分支    c 对比    Esc 返回</Text>
        }
      </Box>
      {switchMessage && (
        <Box marginTop={1}>
          <Text color="yellow">{switchMessage}</Text>
        </Box>
      )}
    </Box>
  );
}
