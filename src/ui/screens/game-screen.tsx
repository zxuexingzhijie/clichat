import React, { useMemo, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import { useScreenSize } from 'fullscreen-ink';

import { GameStoreCtx, PlayerStoreCtx, SceneStoreCtx, DialogueStoreCtx, CombatStoreCtx } from '../../app';
import { costSessionStore } from '../../state/cost-session-store';
import { getLastReplayEntries } from '../../game-loop';
import { getRecentChapterSummaries } from '../../ai/summarizer/summarizer-worker';
import { Divider } from '../components/divider';
import { InlineConfirm } from '../components/inline-confirm';
import { TitleBar } from '../panels/title-bar';
import { PanelRouter } from '../panels/panel-router';
import { StatusBar } from '../panels/status-bar';
import { CombatStatusBar } from '../panels/combat-status-bar';
import { ActionsPanel } from '../panels/actions-panel';
import { CombatActionsPanel } from '../panels/combat-actions-panel';
import { InputArea } from '../panels/input-area';
import { useActiveQuests, useAtmosphere, useToast } from '../providers/atmosphere-provider';
import { useIsStreaming, useNarrativeText } from '../providers/narrative-provider';
import { useCommandInput, useInputActions, useInputState, useOverlayPanelData, useSelectedAction } from '../providers/input-provider';
import type { InputProviderProps } from '../providers/input-provider';

const WIDE_ACTIONS_WIDTH = 36;

export type GameScreenProps = Omit<InputProviderProps, 'children'>;

export function GameScreen(_props: GameScreenProps): React.ReactNode {
  const gameStore = React.useContext(GameStoreCtx.Context);
  if (!gameStore) throw new ReferenceError('GameScreen must be used within game store providers');
  const gameState = GameStoreCtx.useStoreState((s) => s);
  const player = PlayerStoreCtx.useStoreState((s) => s);
  const scene = SceneStoreCtx.useStoreState((s) => s);
  const dialogue = DialogueStoreCtx.useStoreState((s) => s);
  const combat = CombatStoreCtx.useStoreState((s) => s);
  const { width, height } = useScreenSize();
  const { exit } = useApp();
  const { timeLabel, isSceneDimmed, isSpinnerDimming, spinnerDimoutComplete } = useAtmosphere();
  const { toast } = useToast();
  const quests = useActiveQuests();
  const narrative = useNarrativeText();
  const isStreaming = useIsStreaming();
  const { inputMode, isTyping } = useInputState();
  const actions = useInputActions();
  const selected = useSelectedAction();
  const command = useCommandInput();
  const overlay = useOverlayPanelData();
  const [lastTurnTokens] = useState(() => costSessionStore.getState().lastTurnTokens);
  const [chapterSummaries] = useState(() => getRecentChapterSummaries());
  const replayEntries = useMemo(() => getLastReplayEntries(), [gameState.phase]);
  const isCombat = combat.active;
  const isDialogue = dialogue.active && dialogue.mode === 'full';
  const innerWidth = width - 2;
  const spinnerContext = isCombat ? 'combat' : dialogue.active ? 'npc_dialogue' : 'narration';
  const showSpinner = inputMode === 'processing' && !isStreaming && !spinnerDimoutComplete;
  const sceneLines = dialogue.active && dialogue.mode === 'inline' ? [...narrative.sceneLines, ...dialogue.dialogueHistory.filter(e => e.role === 'assistant').map(e => `${dialogue.npcName}："${e.content}"`)] : [...narrative.sceneLines];
  const status = isCombat ? <CombatStatusBar playerHp={player.hp} playerMaxHp={player.maxHp} playerMp={player.mp} playerMaxMp={player.maxMp} enemies={combat.enemies} roundNumber={combat.roundNumber} isPlayerTurn={combat.phase === 'player_turn'} width={innerWidth} /> : <StatusBar hp={player.hp} maxHp={player.maxHp} mp={player.mp} maxMp={player.maxMp} gold={player.gold} location={scene.locationName} quest={quests.activeQuestName} width={innerWidth} lastTurnTokens={lastTurnTokens} />;
  const actionPanel = isCombat ? <CombatActionsPanel playerMp={player.mp} canFlee={combat.active && combat.outcome === null} selectedIndex={selected.combatSelectedIndex} onSelect={selected.setCombatSelectedIndex} onExecute={actions.handleCombatExecute} isActive={!isTyping && combat.phase === 'player_turn'} combatPhase={combat.phase} /> : <ActionsPanel actions={[...scene.actions]} selectedIndex={selected.selectedActionIndex} onSelect={selected.setSelectedActionIndex} onExecute={actions.handleActionExecute} isActive={!isTyping && !isDialogue && !isStreaming} isStreaming={isStreaming} />;
  const panel = <PanelRouter phase={gameState.phase} onClose={actions.handlePanelClose} onPhaseSwitch={actions.handlePhaseSwitch} isInCombat={isCombat} isInDialogueMode={isDialogue} combatLastCheckResult={combat.lastCheckResult} combatLastNarration={combat.lastNarration} dialogueState={dialogue} dialogueSelectedIndex={selected.dialogueSelectedIndex} onDialogueSelect={selected.setDialogueSelectedIndex} onDialogueExecute={actions.handleDialogueExecute} onDialogueEscape={actions.handleDialogueEscape} onDialogueFreeText={actions.handleDialogueFreeText} activeQuests={quests.activeQuests} completedQuests={quests.completedQuests} failedQuests={quests.failedQuests} mapData={overlay.mapData} codexEntries={overlay.codexEntries} branchTree={overlay.branchTree} currentBranchId={overlay.currentBranchId} branches={overlay.branches} readSaveData={overlay.readSaveData} saveDir={overlay.saveDir} replayEntries={replayEntries} chapterSummaries={chapterSummaries} width={width} sceneLines={sceneLines} streamingText={narrative.streamingText || undefined} isStreaming={isStreaming} showSpinner={showSpinner || (isSpinnerDimming && isStreaming)} spinnerContext={spinnerContext} toast={toast} isDimmed={isSceneDimmed} isSpinnerDimming={isSpinnerDimming} />;
  const input = <InputArea onSubmit={command.submit} isActive={isTyping && !isDialogue} mode={isTyping ? 'nl' : 'action'} value={command.inputValue} onChange={command.setInputValue} />;
  const confirm = gameState.pendingQuit && <InlineConfirm message="确定要退出吗？" defaultOption="n" onConfirm={(confirmed) => { if (confirmed) exit(); else gameStore.setState(d => { d.pendingQuit = false; }); }} />;

  if (gameState.phase === 'game_over') return <Box flexDirection="column" width={width} height={height} borderStyle="single" justifyContent="center" alignItems="center"><Text bold color="red">── 旅途终结 ──</Text><Text> </Text><Text>{combat.lastNarration || '你倒下了，生命就此走到了尽头。'}</Text><Text> </Text><Text dimColor>[R] 载入最近存档  [Q] 返回标题</Text></Box>;
  if (gameState.phase === 'victory') return <Box flexDirection="column" width={width} height={height} borderStyle="single" justifyContent="center" alignItems="center"><Text bold color="yellow">★ 黑松镇的秘密 ★</Text><Text> </Text><Text bold color="green">— 故事终章 —</Text><Text> </Text><Text>你揭露了黑松镇背后隐藏已久的真相，狼灾的根源终于大白于天下。</Text><Text dimColor>[任意键] 返回标题</Text></Box>;

  if (width >= 100) {
    const actionsWidth = Math.min(WIDE_ACTIONS_WIDTH, Math.max(28, innerWidth - 48));
    return <Box flexDirection="column" width={width} height={height} borderStyle="single"><TitleBar gameName="Chronicle CLI" day={gameState.day} timeOfDay={timeLabel} /><Divider width={innerWidth} /><Box flexGrow={1}><Box width={innerWidth - actionsWidth - 1} flexDirection="column">{panel}</Box><Text>{'│'}</Text><Box width={actionsWidth} flexDirection="column">{actionPanel}</Box></Box><Divider width={innerWidth} />{status}<Divider width={innerWidth} />{input}{confirm}</Box>;
  }
  return <Box flexDirection="column" width={width} height={height} borderStyle="single"><TitleBar gameName="Chronicle CLI" day={gameState.day} timeOfDay={timeLabel} /><Divider width={innerWidth} />{panel}<Divider width={innerWidth} />{status}<Divider width={innerWidth} />{actionPanel}<Divider width={innerWidth} />{input}{confirm}</Box>;
}
