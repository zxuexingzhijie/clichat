import React, { useCallback } from 'react';
import { Box, Text } from 'ink';
import { useScreenSize } from 'fullscreen-ink';
import { Divider } from '../components/divider';
import { TitleBar } from '../panels/title-bar';
import { ScenePanel } from '../panels/scene-panel';
import { StatusBar } from '../panels/status-bar';
import { ActionsPanel } from '../panels/actions-panel';
import { InputArea } from '../panels/input-area';
import { useGameInput } from '../hooks/use-game-input';
import { TIME_OF_DAY_LABELS } from '../../types/common';
import type { GameState } from '../../state/game-store';
import type { PlayerState } from '../../state/player-store';
import type { SceneState } from '../../state/scene-store';

type GameScreenProps = {
  readonly gameState: GameState;
  readonly playerState: PlayerState;
  readonly sceneState: SceneState;
  readonly onSetGamePhase: (recipe: (draft: GameState) => void) => void;
};

export function GameScreen({
  gameState,
  playerState,
  sceneState,
  onSetGamePhase,
}: GameScreenProps): React.ReactNode {
  const { width, height } = useScreenSize();
  const {
    inputMode,
    setInputMode,
    selectedActionIndex,
    setSelectedActionIndex,
    isTyping,
  } = useGameInput();

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
    (text: string) => {
      setInputMode('action_select');
    },
    [setInputMode],
  );

  const handleSwitchToInput = useCallback(
    (_input: string, key: { return?: boolean; escape?: boolean }) => {
      if (key.escape) {
        setInputMode('action_select');
      }
    },
    [setInputMode],
  );

  const isWide = width >= 100;

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
            <ScenePanel lines={[...sceneState.narrationLines]} />
          </Box>
          <Text>{'│'}</Text>
          <Box width={actionsWidth} flexDirection="column">
            <ActionsPanel
              actions={[...sceneState.actions]}
              selectedIndex={selectedActionIndex}
              onSelect={setSelectedActionIndex}
              onExecute={handleActionExecute}
              isActive={!isTyping}
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
          isActive={isTyping}
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
      <ScenePanel lines={[...sceneState.narrationLines]} />
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
        isActive={!isTyping}
      />
      <Divider width={innerWidth} />
      <InputArea
        onSubmit={handleInputSubmit}
        isActive={isTyping}
        mode={isTyping ? 'nl' : 'action'}
      />
    </Box>
  );
}
