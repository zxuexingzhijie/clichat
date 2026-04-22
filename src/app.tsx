import React, { useCallback, useEffect } from 'react';
import path from 'node:path';
import { createStoreContext } from './ui/hooks/use-store';
import { gameStore, type GameState } from './state/game-store';
import { playerStore, type PlayerState } from './state/player-store';
import { sceneStore, type SceneState } from './state/scene-store';
import { TitleScreen } from './ui/screens/title-screen';
import { GameScreen } from './ui/screens/game-screen';
import { CharacterCreationScreen } from './ui/screens/character-creation-screen';
import { SizeGuard } from './ui/components/size-guard';
import { initRoleConfigs } from './ai/providers';

const GameStoreCtx = createStoreContext<GameState>();
const PlayerStoreCtx = createStoreContext<PlayerState>();
const SceneStoreCtx = createStoreContext<SceneState>();

export { GameStoreCtx, PlayerStoreCtx, SceneStoreCtx };

function AppInner(): React.ReactNode {
  const phase = GameStoreCtx.useStoreState((s) => s.phase);
  const setGameState = GameStoreCtx.useSetState();

  const gameState = GameStoreCtx.useStoreState((s) => s);
  const playerState = PlayerStoreCtx.useStoreState((s) => s);
  const sceneState = SceneStoreCtx.useStoreState((s) => s);

  const handleStart = useCallback(() => {
    setGameState((draft) => {
      draft.phase = 'character_creation';
    });
  }, [setGameState]);

  const handleCharacterCreated = useCallback((newPlayerState: PlayerState) => {
    playerStore.setState((draft) => {
      Object.assign(draft, newPlayerState);
    });
    setGameState((draft) => {
      draft.phase = 'game';
    });
  }, [setGameState]);

  if (phase === 'title') {
    return <TitleScreen onStart={handleStart} />;
  }

  if (phase === 'character_creation') {
    return (
      <SizeGuard>
        <CharacterCreationScreen onComplete={handleCharacterCreated} />
      </SizeGuard>
    );
  }

  return (
    <SizeGuard>
      <GameScreen
        gameState={gameState}
        playerState={playerState}
        sceneState={sceneState}
        onSetGamePhase={setGameState}
      />
    </SizeGuard>
  );
}

export function App(): React.ReactNode {
  useEffect(() => {
    initRoleConfigs(path.join(process.cwd(), 'ai-config.yaml')).catch((err) => {
      console.error('[AI Config] Failed to load ai-config.yaml, using defaults:', err instanceof Error ? err.message : String(err));
    });
  }, []);

  return (
    <GameStoreCtx.Provider store={gameStore}>
      <PlayerStoreCtx.Provider store={playerStore}>
        <SceneStoreCtx.Provider store={sceneStore}>
          <AppInner />
        </SceneStoreCtx.Provider>
      </PlayerStoreCtx.Provider>
    </GameStoreCtx.Provider>
  );
}
