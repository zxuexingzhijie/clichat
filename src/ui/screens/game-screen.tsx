import React, { useCallback, useState } from 'react';
import { Box, Text } from 'ink';
import { useScreenSize } from 'fullscreen-ink';
import { Divider } from '../components/divider';
import { TitleBar } from '../panels/title-bar';
import { ScenePanel } from '../panels/scene-panel';
import { DialoguePanel } from '../panels/dialogue-panel';
import { StatusBar } from '../panels/status-bar';
import { ActionsPanel } from '../panels/actions-panel';
import { InputArea } from '../panels/input-area';
import { useGameInput } from '../hooks/use-game-input';
import { TIME_OF_DAY_LABELS } from '../../types/common';
import type { GameState } from '../../state/game-store';
import type { PlayerState } from '../../state/player-store';
import type { SceneState } from '../../state/scene-store';
import type { DialogueState } from '../../state/dialogue-store';
import type { DialogueManager } from '../../engine/dialogue-manager';

type GameScreenProps = {
  readonly gameState: GameState;
  readonly playerState: PlayerState;
  readonly sceneState: SceneState;
  readonly dialogueState: DialogueState;
  readonly onSetGamePhase: (recipe: (draft: GameState) => void) => void;
  readonly dialogueManager?: DialogueManager;
};

export function GameScreen({
  gameState,
  playerState,
  sceneState,
  dialogueState,
  onSetGamePhase,
  dialogueManager,
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

  const innerWidth = width - 2;

  const timeLabel = TIME_OF_DAY_LABELS[gameState.timeOfDay] ?? gameState.timeOfDay;

  const handleActionExecute = useCallback(
    (index: number) => {
      const action = sceneState.actions[index];
      if (action) {
        // Phase 1: log to console, future phases will route to rules engine
      }
    },
    [sceneState.actions],
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

  const isWide = width >= 100;
  const isInDialogueMode = dialogueState.active && dialogueState.mode === 'full';

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
            {isInDialogueMode ? (
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
            ) : (
              <ScenePanel lines={sceneLines} />
            )}
          </Box>
          <Text>{'│'}</Text>
          <Box width={actionsWidth} flexDirection="column">
            <ActionsPanel
              actions={[...sceneState.actions]}
              selectedIndex={selectedActionIndex}
              onSelect={setSelectedActionIndex}
              onExecute={handleActionExecute}
              isActive={!isTyping && !isInDialogueMode}
            />
          </Box>
        </Box>
        <Divider width={innerWidth} />
        <StatusBar
          hp={playerState.hp}
          maxHp={playerState.maxHp}
          mp={playerState.mp}
          maxMp={playerState.maxMp}
          gold={playerState.gold}
          location={sceneState.locationName}
          quest={null}
          width={innerWidth}
        />
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
      {isInDialogueMode ? (
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
      ) : (
        <ScenePanel lines={sceneLines} />
      )}
      <Divider width={innerWidth} />
      <StatusBar
        hp={playerState.hp}
        maxHp={playerState.maxHp}
        mp={playerState.mp}
        maxMp={playerState.maxMp}
        gold={playerState.gold}
        location={sceneState.locationName}
        quest={null}
        width={innerWidth}
      />
      <Divider width={innerWidth} />
      <ActionsPanel
        actions={[...sceneState.actions]}
        selectedIndex={selectedActionIndex}
        onSelect={setSelectedActionIndex}
        onExecute={handleActionExecute}
        isActive={!isTyping && !isInDialogueMode}
      />
      <Divider width={innerWidth} />
      <InputArea
        onSubmit={handleInputSubmit}
        isActive={isTyping && !isInDialogueMode}
        mode={isTyping ? 'nl' : 'action'}
      />
    </Box>
  );
}
