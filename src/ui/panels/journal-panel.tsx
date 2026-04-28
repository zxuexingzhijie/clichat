import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { QuestTemplate } from '../../codex/schemas/entry-types';
import type { QuestProgress } from '../../state/quest-store';

export type QuestDisplayEntry = {
  readonly progress: QuestProgress;
  readonly template: QuestTemplate;
};

type JournalPanelProps = {
  readonly activeQuests: readonly QuestDisplayEntry[];
  readonly completedQuests: readonly QuestDisplayEntry[];
  readonly failedQuests: readonly QuestDisplayEntry[];
  readonly onClose: () => void;
};

function renderQuestEntry(entry: QuestDisplayEntry): React.ReactNode {
  const { progress, template } = entry;
  const currentStage = template.stages.find(s => s.id === progress.currentStageId);
  const pendingObjectives = currentStage?.objectives.filter(
    o => !progress.completedObjectives.includes(o.id)
  ) ?? [];

  return (
    <Box key={template.id} flexDirection="column" marginBottom={1}>
      <Text bold>{template.name}</Text>
      {currentStage && <Text dimColor>  {currentStage.description}</Text>}
      {progress.discoveredClues.map(clue => (
        <Text key={clue} color="green">  ✓ {clue}</Text>
      ))}
      {pendingObjectives.map(obj => (
        <Text key={obj.id} dimColor>  □ {obj.description}</Text>
      ))}
    </Box>
  );
}

export function JournalPanel({
  activeQuests,
  completedQuests,
  failedQuests,
  onClose,
}: JournalPanelProps): React.ReactNode {
  useInput(useCallback((_input: string, key: { escape: boolean }) => {
    if (key.escape) onClose();
  }, [onClose]));

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color="cyan">【任务日志】</Text>
        <Text dimColor>Esc 关闭</Text>
      </Box>
      <Text> </Text>
      <Text bold color="yellow">进行中</Text>
      {activeQuests.length === 0
        ? <Text dimColor>  {'<无>'}</Text>
        : activeQuests.map(renderQuestEntry)}
      <Text bold color="green">已完成</Text>
      {completedQuests.length === 0
        ? <Text dimColor>  {'<无>'}</Text>
        : completedQuests.map(renderQuestEntry)}
      <Text bold color="red" dimColor>已失败</Text>
      {failedQuests.length === 0
        ? <Text dimColor>  {'<无>'}</Text>
        : failedQuests.map(renderQuestEntry)}
      <Text> </Text>
      <Text dimColor>Esc 关闭日志</Text>
    </Box>
  );
}
