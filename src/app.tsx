import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text } from 'ink';
import { createStoreContext } from './ui/hooks/use-store';
import { gameStore, type GameState } from './state/game-store';
import { playerStore, type PlayerState } from './state/player-store';
import { sceneStore, type SceneState } from './state/scene-store';
import { dialogueStore, type DialogueState } from './state/dialogue-store';
import { combatStore, type CombatState } from './state/combat-store';
import { questStore, type QuestState } from './state/quest-store';
import { eventBus } from './events/event-bus';
import { TitleScreen } from './ui/screens/title-screen';
import { GameScreen } from './ui/screens/game-screen';
import { SizeGuard } from './ui/components/size-guard';
import { GameErrorBoundary } from './ui/components/error-boundary';
import { initRoleConfigs } from './ai/providers';
import { createGameLoop } from './game-loop';
import { NarrativeCreationScreen } from './ui/screens/narrative-creation-screen';
import { resolveDataDir, resolveConfigPath } from './paths';
import { loadAllCodex } from './codex/loader';
import type { QuestTemplate } from './codex/schemas/entry-types';

const GameStoreCtx = createStoreContext<GameState>();
const PlayerStoreCtx = createStoreContext<PlayerState>();
const SceneStoreCtx = createStoreContext<SceneState>();
const DialogueStoreCtx = createStoreContext<DialogueState>();
const CombatStoreCtx = createStoreContext<CombatState>();
const QuestStoreCtx = createStoreContext<QuestState>();

export { GameStoreCtx, PlayerStoreCtx, SceneStoreCtx, DialogueStoreCtx, CombatStoreCtx, QuestStoreCtx };

function AppInner(): React.ReactNode {
  const phase = GameStoreCtx.useStoreState((s) => s.phase);
  const setGameState = GameStoreCtx.useSetState();
  const gameLoop = useMemo(
    () => createGameLoop(
      { player: playerStore, scene: sceneStore, game: gameStore, combat: combatStore },
      eventBus,
    ),
    [],
  );

  const [questTemplates, setQuestTemplates] = useState<ReadonlyMap<string, QuestTemplate>>(new Map());
  const [codexLoadError, setCodexLoadError] = useState<string | null>(null);

  useEffect(() => {
    const dataDir = process.env.__CHRONICLE_DATA_DIR || resolveDataDir();
    const codexDir = `${dataDir}/codex`;
    loadAllCodex(codexDir).then((entries) => {
      const templates = new Map<string, QuestTemplate>();
      for (const [id, entry] of entries) {
        if (entry.type === 'quest') {
          templates.set(id, entry);
        }
      }
      setQuestTemplates(templates);
    }).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Codex] Failed to load quest templates:', msg);
      setCodexLoadError(msg);
    });
  }, []);

  const handleStart = useCallback(() => {
    setGameState((draft) => {
      draft.phase = 'narrative_creation';
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
    return (
      <GameErrorBoundary>
        <TitleScreen onStart={handleStart} />
        {codexLoadError && <Text color="red">[Codex] {codexLoadError}</Text>}
      </GameErrorBoundary>
    );
  }

  if (phase === 'narrative_creation') {
    return (
      <GameErrorBoundary>
        <SizeGuard>
          <NarrativeCreationScreen onComplete={handleCharacterCreated} />
        </SizeGuard>
      </GameErrorBoundary>
    );
  }

  return (
    <GameErrorBoundary>
      <SizeGuard>
        <GameScreen
          questTemplates={questTemplates}
          gameLoop={gameLoop}
        />
      </SizeGuard>
    </GameErrorBoundary>
  );
}

export function App(): React.ReactNode {
  useEffect(() => {
    initRoleConfigs(resolveConfigPath(process.env.__CHRONICLE_DATA_DIR || resolveDataDir())).catch((err) => {
      console.error('[AI Config] Failed to load ai-config.yaml, using defaults:', err instanceof Error ? err.message : String(err));
    });
  }, []);

  return (
    <GameStoreCtx.Provider store={gameStore}>
      <PlayerStoreCtx.Provider store={playerStore}>
        <SceneStoreCtx.Provider store={sceneStore}>
          <DialogueStoreCtx.Provider store={dialogueStore}>
            <CombatStoreCtx.Provider store={combatStore}>
              <QuestStoreCtx.Provider store={questStore}>
                <AppInner />
              </QuestStoreCtx.Provider>
            </CombatStoreCtx.Provider>
          </DialogueStoreCtx.Provider>
        </SceneStoreCtx.Provider>
      </PlayerStoreCtx.Provider>
    </GameStoreCtx.Provider>
  );
}
