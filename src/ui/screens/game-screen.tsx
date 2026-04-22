import React, { useCallback, useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useScreenSize } from 'fullscreen-ink';
import { Divider } from '../components/divider';
import { TitleBar } from '../panels/title-bar';
import { ScenePanel } from '../panels/scene-panel';
import { DialoguePanel } from '../panels/dialogue-panel';
import { JournalPanel, type QuestDisplayEntry } from '../panels/journal-panel';
import { MapPanel } from '../panels/map-panel';
import { CodexPanel } from '../panels/codex-panel';
import { BranchTreePanel } from '../panels/branch-tree-panel';
import { ComparePanel } from '../panels/compare-panel';
import { ShortcutHelpPanel } from '../panels/shortcut-help-panel';
import { ReplayPanel } from '../panels/replay-panel';
import { StatusBar } from '../panels/status-bar';
import { CombatStatusBar } from '../panels/combat-status-bar';
import { ActionsPanel } from '../panels/actions-panel';
import { CombatActionsPanel } from '../panels/combat-actions-panel';
import { CheckResultLine } from '../panels/check-result-line';
import { InputArea } from '../panels/input-area';
import { useGameInput, getPanelActionForKey } from '../hooks/use-game-input';
import { TIME_OF_DAY_LABELS } from '../../types/common';
import { gameStore, type GameState } from '../../state/game-store';
import { costSessionStore } from '../../state/cost-session-store';
import { getLastReplayEntries } from '../../game-loop';
import type { PlayerState } from '../../state/player-store';
import type { SceneState } from '../../state/scene-store';
import type { DialogueState } from '../../state/dialogue-store';
import type { CombatState } from '../../state/combat-store';
import type { DialogueManager } from '../../engine/dialogue-manager';
import type { CombatLoop, CombatActionType } from '../../engine/combat-loop';
import type { QuestState } from '../../state/quest-store';
import type { QuestTemplate } from '../../codex/schemas/entry-types';
import type { LocationMapData } from '../panels/map-panel';
import type { CodexDisplayEntry } from '../panels/codex-panel';
import type { BranchDisplayNode } from '../panels/branch-tree-panel';
import type { BranchDiffResult } from '../../engine/branch-diff';

type GameScreenProps = {
  readonly gameState: GameState;
  readonly playerState: PlayerState;
  readonly sceneState: SceneState;
  readonly dialogueState: DialogueState;
  readonly combatState: CombatState;
  readonly questState: QuestState;
  readonly questTemplates: ReadonlyMap<string, QuestTemplate>;
  readonly onSetGamePhase: (recipe: (draft: GameState) => void) => void;
  readonly dialogueManager?: DialogueManager;
  readonly combatLoop?: CombatLoop;
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
};

const COMBAT_ACTION_TYPES: readonly CombatActionType[] = ['attack', 'cast', 'guard', 'flee'];

export function GameScreen({
  gameState,
  playerState,
  sceneState,
  dialogueState,
  combatState,
  questState,
  questTemplates,
  onSetGamePhase,
  dialogueManager,
  combatLoop,
  mapData,
  codexEntries,
  branchTree,
  currentBranchId,
  branchDiffResult,
  compareBranchNames,
}: GameScreenProps): React.ReactNode {
  const { width, height } = useScreenSize();
  const {
    inputMode,
    setInputMode,
    selectedActionIndex,
    setSelectedActionIndex,
    isTyping,
  } = useGameInput();

  const [dialogueSelectedIndex, setDialogueSelectedIndex] = useState(0);
  const [combatSelectedIndex, setCombatSelectedIndex] = useState(0);
  const [lastTurnTokens, setLastTurnTokens] = useState(0);

  useEffect(() => {
    return costSessionStore.subscribe(() => {
      setLastTurnTokens(costSessionStore.getState().lastTurnTokens);
    });
  }, []);

  const innerWidth = width - 2;
  const timeLabel = TIME_OF_DAY_LABELS[gameState.timeOfDay] ?? gameState.timeOfDay;

  const isInCombat = combatState.active;
  const isInDialogueMode = dialogueState.active && dialogueState.mode === 'full';
  const isInJournal = gameState.phase === 'journal';
  const isInMap = gameState.phase === 'map';
  const isInCodex = gameState.phase === 'codex';
  const isInBranchTree = gameState.phase === 'branch_tree';
  const isInCompare = gameState.phase === 'compare';
  const isInShortcuts = gameState.phase === 'shortcuts';
  const isInReplay = gameState.phase === 'replay';
  const isWide = width >= 100;

  const allQuestEntries: QuestDisplayEntry[] = Object.entries(questState.quests)
    .map(([questId, progress]) => {
      const template = questTemplates.get(questId);
      return template ? { progress, template } : null;
    })
    .filter((e): e is QuestDisplayEntry => e !== null);

  const activeQuests = allQuestEntries.filter(e => e.progress.status === 'active');
  const completedQuests = allQuestEntries.filter(e => e.progress.status === 'completed');
  const failedQuests = allQuestEntries.filter(e => e.progress.status === 'failed');

  const activeQuestName = activeQuests[0]?.template.name ?? null;

  const handleActionExecute = useCallback(
    (_index: number) => {
      // Phase 1 stub: future phases route to rules engine
    },
    [],
  );

  const handleInputSubmit = useCallback(
    (_text: string) => {
      setInputMode('action_select');
    },
    [setInputMode],
  );

  const handleDialogueExecute = useCallback(
    (index: number) => {
      if (dialogueManager) {
        dialogueManager.processPlayerResponse(index).catch(() => {});
        setDialogueSelectedIndex(0);
      }
    },
    [dialogueManager],
  );

  const handleDialogueEscape = useCallback(() => {
    if (dialogueManager) {
      dialogueManager.endDialogue();
    }
    setDialogueSelectedIndex(0);
  }, [dialogueManager]);

  const handleCombatExecute = useCallback(
    (index: number) => {
      if (!combatLoop) return;
      const actionType = COMBAT_ACTION_TYPES[index] ?? 'attack';
      combatLoop.processPlayerAction(actionType).catch(() => {});
      setCombatSelectedIndex(0);
    },
    [combatLoop],
  );

  const handleJournalClose = useCallback(() => {
    gameStore.setState(draft => { draft.phase = 'game'; });
  }, []);

  const handlePanelClose = useCallback(() => {
    gameStore.setState(draft => { draft.phase = 'game'; });
  }, []);

  const isInOverlayPanel = isInMap || isInCodex || isInBranchTree || isInCompare || isInShortcuts || isInReplay;

  useInput(useCallback((input: string, key: { escape: boolean }) => {
    if (key.escape && isInOverlayPanel) {
      gameStore.setState(draft => { draft.phase = 'game'; });
      return;
    }
    const panelAction = getPanelActionForKey(input, isTyping);
    const validPhases = new Set<string>(['map', 'journal', 'codex', 'branch_tree', 'compare', 'shortcuts']);
    if (panelAction && validPhases.has(panelAction) && !isInCombat && !isInDialogueMode && !isInOverlayPanel) {
      gameStore.setState(draft => { draft.phase = panelAction as GameState['phase']; });
    }
  }, [isTyping, isInCombat, isInDialogueMode, isInOverlayPanel]));

  const inlineDialogueLines = dialogueState.active && dialogueState.mode === 'inline'
    ? [
        ...sceneState.narrationLines,
        ...dialogueState.dialogueHistory
          .filter((e) => e.speaker === 'npc')
          .map((e) => `${dialogueState.npcName}："${e.text}"`),
      ]
    : [...sceneState.narrationLines];

  const sceneLines = dialogueState.active && dialogueState.mode === 'inline'
    ? inlineDialogueLines
    : [...sceneState.narrationLines];

  const combatSceneContent = (
    <Box flexDirection="column" paddingX={1}>
      {combatState.lastCheckResult && (
        <CheckResultLine checkResult={combatState.lastCheckResult} />
      )}
      {combatState.lastNarration ? (
        <Text>{combatState.lastNarration}</Text>
      ) : (
        <Text bold color="cyan">⚔ 战斗！</Text>
      )}
    </Box>
  );

  const statusBarNode = isInCombat ? (
    <CombatStatusBar
      playerHp={playerState.hp}
      playerMaxHp={playerState.maxHp}
      playerMp={playerState.mp}
      playerMaxMp={playerState.maxMp}
      enemies={combatState.enemies}
      roundNumber={combatState.roundNumber}
      isPlayerTurn={combatState.phase === 'player_turn'}
      width={innerWidth}
    />
  ) : (
    <StatusBar
      hp={playerState.hp}
      maxHp={playerState.maxHp}
      mp={playerState.mp}
      maxMp={playerState.maxMp}
      gold={playerState.gold}
      location={sceneState.locationName}
      quest={activeQuestName}
      width={innerWidth}
      lastTurnTokens={lastTurnTokens}
    />
  );

  const actionsNode = isInCombat ? (
    <CombatActionsPanel
      playerMp={playerState.mp}
      canFlee={true}
      selectedIndex={combatSelectedIndex}
      onSelect={setCombatSelectedIndex}
      onExecute={handleCombatExecute}
      isActive={!isTyping && combatState.phase === 'player_turn'}
    />
  ) : (
    <ActionsPanel
      actions={[...sceneState.actions]}
      selectedIndex={selectedActionIndex}
      onSelect={setSelectedActionIndex}
      onExecute={handleActionExecute}
      isActive={!isTyping && !isInDialogueMode}
    />
  );

  const scenePanelNode = isInCombat
    ? combatSceneContent
    : isInDialogueMode
      ? (
        <DialoguePanel
          npcName={dialogueState.npcName}
          dialogueHistory={dialogueState.dialogueHistory}
          relationshipValue={dialogueState.relationshipValue}
          emotionHint={dialogueState.emotionHint}
          responseOptions={dialogueState.availableResponses}
          selectedIndex={dialogueSelectedIndex}
          onSelect={setDialogueSelectedIndex}
          onExecute={handleDialogueExecute}
          isActive={true}
          onEscape={handleDialogueEscape}
        />
      )
      : isInJournal
        ? (
          <JournalPanel
            activeQuests={activeQuests}
            completedQuests={completedQuests}
            failedQuests={failedQuests}
            onClose={handleJournalClose}
          />
        )
        : isInMap && mapData
          ? (
            <MapPanel
              locations={mapData.locations}
              currentLocationId={mapData.currentLocationId}
              regionName={mapData.regionName}
              onClose={handlePanelClose}
            />
          )
          : isInCodex && codexEntries
            ? (
              <CodexPanel
                entries={codexEntries}
                onClose={handlePanelClose}
              />
            )
            : isInBranchTree && branchTree
              ? (
                <BranchTreePanel
                  tree={branchTree}
                  currentBranchId={currentBranchId ?? 'main'}
                  onClose={handlePanelClose}
                  onCompare={() => {
                    gameStore.setState(draft => { draft.phase = 'compare'; });
                  }}
                  onSwitch={() => {}}
                  width={width}
                />
              )
              : isInCompare && branchDiffResult && compareBranchNames
                ? (
                  <ComparePanel
                    sourceBranchName={compareBranchNames.source}
                    targetBranchName={compareBranchNames.target}
                    diffResult={branchDiffResult}
                    narrativeSummary=""
                    onClose={handlePanelClose}
                    width={width}
                  />
                )
                : isInShortcuts
                  ? <ShortcutHelpPanel onClose={handlePanelClose} />
                  : isInReplay
                    ? <ReplayPanel entries={[...getLastReplayEntries()]} onClose={handlePanelClose} />
                    : <ScenePanel lines={sceneLines} />;

  if (isWide) {
    const sceneWidth = Math.floor(innerWidth * 0.6);
    const actionsWidth = innerWidth - sceneWidth - 1;

    return (
      <Box
        flexDirection="column"
        width={width}
        height={height}
        borderStyle="single"
      >
        <TitleBar
          gameName="Chronicle CLI"
          day={gameState.day}
          timeOfDay={timeLabel}
        />
        <Divider width={innerWidth} />
        <Box flexGrow={1}>
          <Box width={sceneWidth} flexDirection="column">
            {scenePanelNode}
          </Box>
          <Text>{'│'}</Text>
          <Box width={actionsWidth} flexDirection="column">
            {actionsNode}
          </Box>
        </Box>
        <Divider width={innerWidth} />
        {statusBarNode}
        <Divider width={innerWidth} />
        <InputArea
          onSubmit={handleInputSubmit}
          isActive={isTyping && !isInDialogueMode}
          mode={isTyping ? 'nl' : 'action'}
        />
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="single"
    >
      <TitleBar
        gameName="Chronicle CLI"
        day={gameState.day}
        timeOfDay={timeLabel}
      />
      <Divider width={innerWidth} />
      {scenePanelNode}
      <Divider width={innerWidth} />
      {statusBarNode}
      <Divider width={innerWidth} />
      {actionsNode}
      <Divider width={innerWidth} />
      <InputArea
        onSubmit={handleInputSubmit}
        isActive={isTyping && !isInDialogueMode}
        mode={isTyping ? 'nl' : 'action'}
      />
    </Box>
  );
}
