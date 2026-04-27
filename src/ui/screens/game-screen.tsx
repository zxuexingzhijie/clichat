import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';

import { useScreenSize } from 'fullscreen-ink';
import { Divider } from '../components/divider';
import { TitleBar } from '../panels/title-bar';
import { PanelRouter } from '../panels/panel-router';
import { type QuestDisplayEntry } from '../panels/journal-panel';
import { StatusBar } from '../panels/status-bar';
import { CombatStatusBar } from '../panels/combat-status-bar';
import { ActionsPanel } from '../panels/actions-panel';
import { CombatActionsPanel } from '../panels/combat-actions-panel';
import { InputArea } from '../panels/input-area';
import { InlineConfirm } from '../components/inline-confirm';
import { useGameInput, getPanelActionForKey } from '../hooks/use-game-input';
import { useGameEventToasts } from '../hooks/use-game-event-toasts';
import { useTimedEffect } from '../hooks/use-timed-effect';
import { GameStoreCtx, PlayerStoreCtx, SceneStoreCtx, DialogueStoreCtx, CombatStoreCtx, QuestStoreCtx } from '../../app';
import { eventBus } from '../../events/event-bus';
import { getRecentChapterSummaries } from '../../ai/summarizer/summarizer-worker';
import { TIME_OF_DAY_LABELS } from '../../types/common';
import { gameStore, type GameState } from '../../state/game-store';
import { costSessionStore } from '../../state/cost-session-store';
import { getLastReplayEntries } from '../../game-loop';
import { useAiNarration } from '../hooks/use-ai-narration';
import { useNpcDialogue } from '../hooks/use-npc-dialogue';
import { sceneStore } from '../../state/scene-store';
import { createGameScreenController } from '../../engine/game-screen-controller';
import type { GameLoop } from '../../game-loop';
import type { DialogueManager } from '../../engine/dialogue-manager';
import type { CombatLoop } from '../../engine/combat-loop';
import type { QuestTemplate } from '../../codex/schemas/entry-types';
import type { LocationMapData } from '../panels/map-panel';
import type { CodexDisplayEntry } from '../panels/codex-panel';
import type { BranchDisplayNode } from '../panels/branch-tree-panel';
import type { BranchDiffResult } from '../../engine/branch-diff';

const OVERLAY_PHASES = new Set(['journal', 'map', 'codex', 'branch_tree', 'compare', 'shortcuts', 'replay', 'chapter_summary']);

type GameScreenProps = {
  readonly questTemplates: ReadonlyMap<string, QuestTemplate>;
  readonly dialogueManager?: DialogueManager;
  readonly combatLoop?: CombatLoop;
  readonly gameLoop?: GameLoop;
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

export function GameScreen({
  questTemplates,
  dialogueManager,
  combatLoop,
  gameLoop,
  mapData,
  codexEntries,
  branchTree,
  currentBranchId,
  branchDiffResult,
  compareBranchNames,
}: GameScreenProps): React.ReactNode {
  const gameState = GameStoreCtx.useStoreState((s) => s);
  const playerState = PlayerStoreCtx.useStoreState((s) => s);
  const sceneState = SceneStoreCtx.useStoreState((s) => s);
  const dialogueState = DialogueStoreCtx.useStoreState((s) => s);
  const combatState = CombatStoreCtx.useStoreState((s) => s);
  const questState = QuestStoreCtx.useStoreState((s) => s);

  const { width, height } = useScreenSize();
  const { exit } = useApp();
  const {
    inputMode,
    setInputMode,
    selectedActionIndex,
    setSelectedActionIndex,
    isTyping,
    inputValue,
    setInputValue,
  } = useGameInput();

  const {
    streamingText,
    isStreaming: isNarrationStreaming,
    error: narrationError,
    startNarration,
    skipToEnd: skipNarration,
    reset: resetNarration,
  } = useAiNarration();

  const {
    streamingText: npcStreamingText,
    isStreaming: isNpcStreaming,
    metadata: npcMetadata,
    skipToEnd: skipNpcDialogue,
    reset: resetNpcDialogue,
  } = useNpcDialogue();

  const isAnyStreaming = isNarrationStreaming || isNpcStreaming;

  const { toast } = useGameEventToasts();

  const { active: isSpinnerDimming, trigger: triggerSpinnerDimout } = useTimedEffect(150);
  const [spinnerDimoutComplete, setSpinnerDimoutComplete] = useState(false);
  const wasProcessingRef = useRef(false);

  const controller = useMemo(
    () => createGameScreenController(
      { game: gameStore, scene: sceneStore },
      eventBus,
      { gameLoop, dialogueManager, combatLoop, setInputMode, startNarration, resetNarration, resetNpcDialogue },
    ),
    [gameLoop, dialogueManager, combatLoop, setInputMode, startNarration, resetNarration, resetNpcDialogue],
  );

  useEffect(() => {
    const isProcessing = inputMode === 'processing' && !isAnyStreaming;

    if (wasProcessingRef.current && isAnyStreaming) {
      triggerSpinnerDimout();
      setSpinnerDimoutComplete(false);
    }

    if (!isAnyStreaming && !isProcessing) {
      setSpinnerDimoutComplete(false);
    }

    wasProcessingRef.current = isProcessing;
  }, [inputMode, isAnyStreaming, triggerSpinnerDimout]);

  useEffect(() => {
    if (!isSpinnerDimming && wasProcessingRef.current === false && isAnyStreaming) {
      setSpinnerDimoutComplete(true);
    }
  }, [isSpinnerDimming, isAnyStreaming]);

  const showSpinner = inputMode === 'processing' && !isAnyStreaming && !spinnerDimoutComplete;
  const showSpinnerWithDim = showSpinner || (isSpinnerDimming && isAnyStreaming);

  const { active: isSceneDimmed, trigger: triggerSceneFade } = useTimedEffect(500);

  useEffect(() => {
    const handler = () => { triggerSceneFade(); };
    eventBus.on('scene_changed', handler);
    return () => { eventBus.off('scene_changed', handler); };
  }, [triggerSceneFade]);

  const [dialogueSelectedIndex, setDialogueSelectedIndex] = useState(0);
  const [combatSelectedIndex, setCombatSelectedIndex] = useState(0);
  const [lastTurnTokens, setLastTurnTokens] = useState(0);

  useEffect(() => {
    return costSessionStore.subscribe(() => {
      setLastTurnTokens(costSessionStore.getState().lastTurnTokens);
    });
  }, []);

  useEffect(() => {
    if (!isNarrationStreaming && streamingText.length > 0) {
      controller.handleNarrationComplete(streamingText);
    }
  }, [isNarrationStreaming, streamingText, controller]);

  useEffect(() => {
    if (narrationError) {
      controller.handleNarrationError(narrationError);
    }
  }, [narrationError, controller]);

  useEffect(() => {
    if (!isNpcStreaming && npcMetadata && npcStreamingText.length > 0) {
      controller.handleNpcDialogueComplete(dialogueState.npcName, npcMetadata.dialogue, inputMode);
    }
  }, [isNpcStreaming, npcMetadata, npcStreamingText, controller, dialogueState.npcName, inputMode]);

  const innerWidth = width - 2;
  const timeLabel = TIME_OF_DAY_LABELS[gameState.timeOfDay] ?? gameState.timeOfDay;

  const isInCombat = combatState.active;
  const isInDialogueMode = dialogueState.active && dialogueState.mode === 'full';
  const spinnerContext = isInCombat ? 'combat' as const
    : (isInDialogueMode || dialogueState.active) ? 'npc_dialogue' as const
    : 'narration' as const;
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
    (index: number) => { void controller.handleActionExecute(index); },
    [controller],
  );

  const handleInputSubmit = useCallback(
    (_text: string) => { setInputMode('action_select'); },
    [setInputMode],
  );

  const handleDialogueExecute = useCallback(
    (index: number) => {
      controller.handleDialogueExecute(index);
      setDialogueSelectedIndex(0);
    },
    [controller],
  );

  const handleDialogueEscape = useCallback(() => {
    controller.handleDialogueEscape();
    setDialogueSelectedIndex(0);
  }, [controller]);

  const handleCombatExecute = useCallback(
    (index: number) => {
      controller.handleCombatExecute(index);
      setCombatSelectedIndex(0);
    },
    [controller],
  );

  const isInOverlayPanel = OVERLAY_PHASES.has(gameState.phase);

  useInput(useCallback((input: string, key: { escape: boolean; tab?: boolean; return?: boolean }) => {
    if (inputMode === 'processing' && isAnyStreaming && (key.return || input === ' ')) {
      if (isNarrationStreaming) skipNarration();
      if (isNpcStreaming) skipNpcDialogue();
      return;
    }
    if ((input === '/' || key.tab) && !isTyping && !isInCombat && !isInDialogueMode && !isInOverlayPanel) {
      setInputMode('input_active');
      return;
    }
    if (key.escape && inputMode === 'input_active' && !isInOverlayPanel) {
      if (inputValue.trim().length === 0) {
        setInputMode('action_select');
      } else {
        setInputValue('');
      }
      return;
    }
    if (key.escape && isInOverlayPanel) {
      controller.handlePanelClose();
      return;
    }
    const panelAction = getPanelActionForKey(input, isTyping);
    const validPhases = new Set<string>(['map', 'journal', 'codex', 'branch_tree', 'compare', 'shortcuts']);
    if (panelAction && validPhases.has(panelAction) && !isInCombat && !isInDialogueMode && !isInOverlayPanel) {
      controller.handlePhaseSwitch(panelAction as GameState['phase']);
    }
    if (input === 'S' && !isTyping && !isInCombat && !isInDialogueMode && !isInOverlayPanel) {
      controller.handlePhaseSwitch('chapter_summary');
      return;
    }
  }, [isTyping, isInCombat, isInDialogueMode, isInOverlayPanel, inputMode, inputValue, setInputValue, setInputMode, isNarrationStreaming, skipNarration, isNpcStreaming, skipNpcDialogue, isAnyStreaming]));

  const sceneLines = dialogueState.active && dialogueState.mode === 'inline'
    ? [
        ...sceneState.narrationLines,
        ...dialogueState.dialogueHistory
          .filter((e) => e.speaker === 'npc')
          .map((e) => `${dialogueState.npcName}："${e.text}"`),
      ]
    : [...sceneState.narrationLines];

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
      isActive={!isTyping && !isInDialogueMode && !isAnyStreaming}
      isStreaming={isAnyStreaming}
    />
  );

  const scenePanelNode = (
    <PanelRouter
      phase={gameState.phase}
      onClose={controller.handlePanelClose}
      onPhaseSwitch={controller.handlePhaseSwitch}
      isInCombat={isInCombat}
      isInDialogueMode={isInDialogueMode}
      combatLastCheckResult={combatState.lastCheckResult}
      combatLastNarration={combatState.lastNarration}
      dialogueState={dialogueState}
      dialogueSelectedIndex={dialogueSelectedIndex}
      onDialogueSelect={setDialogueSelectedIndex}
      onDialogueExecute={handleDialogueExecute}
      onDialogueEscape={handleDialogueEscape}
      activeQuests={activeQuests}
      completedQuests={completedQuests}
      failedQuests={failedQuests}
      mapData={mapData}
      codexEntries={codexEntries}
      branchTree={branchTree}
      currentBranchId={currentBranchId}
      branchDiffResult={branchDiffResult}
      compareBranchNames={compareBranchNames}
      replayEntries={getLastReplayEntries()}
      chapterSummaries={getRecentChapterSummaries()}
      width={width}
      sceneLines={sceneLines}
      streamingText={isNarrationStreaming ? streamingText : isNpcStreaming ? `${dialogueState.npcName}\uFF1A\u201C${npcStreamingText}` : undefined}
      isStreaming={isAnyStreaming}
      showSpinner={showSpinnerWithDim}
      spinnerContext={spinnerContext}
      toast={toast}
      isDimmed={isSceneDimmed}
      isSpinnerDimming={isSpinnerDimming}
    />
  );

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
          value={inputValue}
          onChange={setInputValue}
        />
        {gameState.pendingQuit && (
          <InlineConfirm
            message="确定要退出吗？"
            defaultOption="n"
            onConfirm={(confirmed) => {
              if (confirmed) {
                exit();
              } else {
                gameStore.setState(draft => { draft.pendingQuit = false; });
              }
            }}
          />
        )}
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
        value={inputValue}
        onChange={setInputValue}
      />
      {gameState.pendingQuit && (
        <InlineConfirm
          message="确定要退出吗？"
          defaultOption="n"
          onConfirm={(confirmed) => {
            if (confirmed) {
              exit();
            } else {
              gameStore.setState(draft => { draft.pendingQuit = false; });
            }
          }}
        />
      )}
    </Box>
  );
}
