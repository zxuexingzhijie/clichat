import React, { useCallback } from 'react';
import { createStoreContext } from './ui/hooks/use-store';
import { gameStore, type GameState } from './state/game-store';
import { playerStore, type PlayerState } from './state/player-store';
import { sceneStore, type SceneState } from './state/scene-store';
import { TitleScreen } from './ui/screens/title-screen';
import { GameScreen } from './ui/screens/game-screen';
import { SizeGuard } from './ui/components/size-guard';

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
      draft.phase = 'game';
    });
  }, [setGameState]);

  if (phase === 'title') {
    return <TitleScreen onStart={handleStart} />;
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
