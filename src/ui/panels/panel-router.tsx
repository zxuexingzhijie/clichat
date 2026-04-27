import React from 'react';
import { Box, Text } from 'ink';
import { ScenePanel } from './scene-panel';
import { DialoguePanel } from './dialogue-panel';
import { JournalPanel, type QuestDisplayEntry } from './journal-panel';
import { MapPanel } from './map-panel';
import { CodexPanel } from './codex-panel';
import { BranchTreePanel } from './branch-tree-panel';
import { ComparePanel } from './compare-panel';
import { ShortcutHelpPanel } from './shortcut-help-panel';
import { ReplayPanel } from './replay-panel';
import { ChapterSummaryPanel } from './chapter-summary-panel';
import { CheckResultLine } from './check-result-line';
import type { GameState } from '../../state/game-store';
import type { DialogueState } from '../../state/dialogue-store';
import type { CombatState } from '../../state/combat-store';
import type { LocationMapData } from './map-panel';
import type { CodexDisplayEntry } from './codex-panel';
import type { BranchDisplayNode } from './branch-tree-panel';
import type { BranchDiffResult } from '../../engine/branch-diff';
import type { ToastData } from '../hooks/use-toast';
import type { SpinnerContext } from '../components/scene-spinner';
import type { TurnLogEntry } from '../../state/serializer';

type PanelRouterProps = {
  readonly phase: GameState['phase'];
  readonly onClose: () => void;
  readonly onPhaseSwitch: (phase: GameState['phase']) => void;

  readonly isInCombat: boolean;
  readonly isInDialogueMode: boolean;

  readonly combatLastCheckResult: CombatState['lastCheckResult'];
  readonly combatLastNarration: CombatState['lastNarration'];

  readonly dialogueState: DialogueState;
  readonly dialogueSelectedIndex: number;
  readonly onDialogueSelect: (index: number) => void;
  readonly onDialogueExecute: (index: number) => void;
  readonly onDialogueEscape: () => void;

  readonly activeQuests: readonly QuestDisplayEntry[];
  readonly completedQuests: readonly QuestDisplayEntry[];
  readonly failedQuests: readonly QuestDisplayEntry[];

  readonly mapData?: {
    readonly locations: readonly LocationMapData[];
    readonly currentLocationId: string;
    readonly regionName: string;
  };

  readonly codexEntries?: readonly CodexDisplayEntry[];

  readonly branchTree?: readonly BranchDisplayNode[];
  readonly currentBranchId?: string;

  readonly branchDiffResult?: BranchDiffResult;
  readonly compareBranchNames?: { readonly source: string; readonly target: string };

  readonly replayEntries: readonly TurnLogEntry[];
  readonly chapterSummaries: readonly string[];

  readonly width: number;

  readonly sceneLines: readonly string[];
  readonly streamingText?: string;
  readonly isStreaming?: boolean;
  readonly showSpinner?: boolean;
  readonly spinnerContext?: SpinnerContext;
  readonly toast?: ToastData | null;
  readonly isDimmed?: boolean;
  readonly isSpinnerDimming?: boolean;
};

export function PanelRouter({
  phase,
  onClose,
  onPhaseSwitch,
  isInCombat,
  isInDialogueMode,
  combatLastCheckResult,
  combatLastNarration,
  dialogueState,
  dialogueSelectedIndex,
  onDialogueSelect,
  onDialogueExecute,
  onDialogueEscape,
  activeQuests,
  completedQuests,
  failedQuests,
  mapData,
  codexEntries,
  branchTree,
  currentBranchId,
  branchDiffResult,
  compareBranchNames,
  replayEntries,
  chapterSummaries,
  width,
  sceneLines,
  streamingText,
  isStreaming,
  showSpinner,
  spinnerContext,
  toast,
  isDimmed,
  isSpinnerDimming,
}: PanelRouterProps): React.ReactNode {
  if (isInCombat) {
    return (
      <Box flexDirection="column" paddingX={1}>
        {combatLastCheckResult && (
          <CheckResultLine checkResult={combatLastCheckResult} />
        )}
        {combatLastNarration ? (
          <Text>{combatLastNarration}</Text>
        ) : (
          <Text bold color="cyan">⚔ 战斗！</Text>
        )}
      </Box>
    );
  }

  if (isInDialogueMode) {
    return (
      <DialoguePanel
        npcName={dialogueState.npcName}
        dialogueHistory={dialogueState.dialogueHistory}
        relationshipValue={dialogueState.relationshipValue}
        emotionHint={dialogueState.emotionHint}
        responseOptions={dialogueState.availableResponses}
        selectedIndex={dialogueSelectedIndex}
        onSelect={onDialogueSelect}
        onExecute={onDialogueExecute}
        isActive={true}
        onEscape={onDialogueEscape}
      />
    );
  }

  const panelMap: Record<string, React.ReactNode> = {
    journal: (
      <JournalPanel
        activeQuests={activeQuests}
        completedQuests={completedQuests}
        failedQuests={failedQuests}
        onClose={onClose}
      />
    ),
    map: mapData ? (
      <MapPanel
        locations={mapData.locations}
        currentLocationId={mapData.currentLocationId}
        regionName={mapData.regionName}
        onClose={onClose}
      />
    ) : null,
    codex: codexEntries ? (
      <CodexPanel
        entries={codexEntries}
        onClose={onClose}
      />
    ) : null,
    branch_tree: branchTree ? (
      <BranchTreePanel
        tree={branchTree}
        currentBranchId={currentBranchId ?? 'main'}
        onClose={onClose}
        onCompare={() => { onPhaseSwitch('compare'); }}
        onSwitch={() => {}}
        width={width}
      />
    ) : null,
    compare: branchDiffResult && compareBranchNames ? (
      <ComparePanel
        sourceBranchName={compareBranchNames.source}
        targetBranchName={compareBranchNames.target}
        diffResult={branchDiffResult}
        narrativeSummary=""
        onClose={onClose}
        width={width}
      />
    ) : null,
    shortcuts: <ShortcutHelpPanel onClose={onClose} />,
    replay: <ReplayPanel entries={[...replayEntries]} onClose={onClose} />,
    chapter_summary: <ChapterSummaryPanel summaries={[...chapterSummaries]} onClose={onClose} />,
  };

  const panel = panelMap[phase];
  if (panel !== undefined && panel !== null) {
    return panel;
  }

  return (
    <ScenePanel
      lines={sceneLines}
      streamingText={streamingText}
      isStreaming={isStreaming}
      showSpinner={showSpinner}
      spinnerContext={spinnerContext}
      toast={toast}
      isDimmed={isDimmed}
      isSpinnerDimming={isSpinnerDimming}
    />
  );
}
