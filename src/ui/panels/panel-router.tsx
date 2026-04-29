import React, { useMemo, useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { GameErrorBoundary } from '../components/error-boundary';
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
import { InventoryPanel } from './inventory-panel';
import { CheckResultLine } from './check-result-line';
import { switchBranch } from '../../persistence/branch-manager';
import type { GameState } from '../../state/game-store';
import type { DialogueState } from '../../state/dialogue-store';
import type { CombatState } from '../../state/combat-store';
import type { LocationMapData } from './map-panel';
import type { CodexDisplayEntry } from './codex-panel';
import type { BranchDisplayNode } from './branch-tree-panel';
import type { BranchMeta } from '../../state/branch-store';
import type { SaveDataV3 } from '../../state/serializer';
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
  readonly onDialogueFreeText: (text: string) => void;

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

  readonly branches?: Record<string, BranchMeta>;
  readonly readSaveData?: (fileName: string, saveDir: string) => Promise<SaveDataV3>;
  readonly saveDir?: string;

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
  onDialogueFreeText,
  activeQuests,
  completedQuests,
  failedQuests,
  mapData,
  codexEntries,
  branchTree,
  currentBranchId,
  branches,
  readSaveData,
  saveDir,
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
  const [switchMessage, setSwitchMessage] = useState<string | null>(null);

  const handleSwitchBranch = useCallback((branchId: string) => {
    try {
      switchBranch(branchId);
      setSwitchMessage('分支已切换。重新加载存档以继续。');
    } catch (err) {
      setSwitchMessage(err instanceof Error ? err.message : '切换分支失败。');
    }
  }, []);

  const panelMap = useMemo((): Record<string, React.ReactNode> => ({
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
        onSwitch={handleSwitchBranch}
        width={width}
        switchMessage={switchMessage ?? undefined}
      />
    ) : null,
    compare: branches && readSaveData && saveDir ? (
      <ComparePanel
        branches={branches}
        readSaveData={readSaveData}
        saveDir={saveDir}
        onClose={onClose}
        width={width}
      />
    ) : <Box><Text dimColor>正在初始化...</Text></Box>,
    inventory: <InventoryPanel onClose={onClose} />,
    shortcuts: <ShortcutHelpPanel onClose={onClose} />,
    replay: <ReplayPanel entries={[...replayEntries]} onClose={onClose} />,
    chapter_summary: <ChapterSummaryPanel summaries={[...chapterSummaries]} onClose={onClose} isActive={phase === 'chapter_summary'} />,
  }), [
    activeQuests, completedQuests, failedQuests, onClose,
    mapData, codexEntries,
    branchTree, currentBranchId, onPhaseSwitch,
    branches, readSaveData, saveDir,
    replayEntries, chapterSummaries,
    width, handleSwitchBranch, switchMessage,
  ]);

  if (isInCombat) {
    return (
      <GameErrorBoundary>
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
      </GameErrorBoundary>
    );
  }

  if (isInDialogueMode) {
    return (
      <GameErrorBoundary>
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
          onFreeTextSubmit={onDialogueFreeText}
          isNpcThinking={showSpinner}
        />
      </GameErrorBoundary>
    );
  }

  const panel = panelMap[phase];
  if (panel !== undefined && panel !== null) {
    return <GameErrorBoundary>{panel}</GameErrorBoundary>;
  }

  return (
    <GameErrorBoundary>
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
    </GameErrorBoundary>
  );
}
