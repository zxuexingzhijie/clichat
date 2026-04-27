import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text } from 'ink';
import { createStoreContext } from './ui/hooks/use-store';
import { gameStore, type GameState } from './state/game-store';
import { playerStore, type PlayerState } from './state/player-store';
import { sceneStore, type SceneState } from './state/scene-store';
import { dialogueStore, type DialogueState } from './state/dialogue-store';
import { combatStore, type CombatState } from './state/combat-store';
import { questStore, type QuestState } from './state/quest-store';
import { npcMemoryStore } from './state/npc-memory-store';
import { relationStore } from './state/relation-store';
import { eventBus } from './events/event-bus';
import { TitleScreen } from './ui/screens/title-screen';
import { GameScreen } from './ui/screens/game-screen';
import { SizeGuard } from './ui/components/size-guard';
import { GameErrorBoundary } from './ui/components/error-boundary';
import { initRoleConfigs } from './ai/providers';
import { createGameLoop } from './game-loop';
import { createSceneManager } from './engine/scene-manager';
import { createDialogueManager } from './engine/dialogue-manager';
import { createCombatLoop } from './engine/combat-loop';
import { NarrativeCreationScreen } from './ui/screens/narrative-creation-screen';
import { resolveDataDir, resolveConfigPath } from './paths';
import { loadAllCodex } from './codex/loader';
import type { CodexEntry, QuestTemplate } from './codex/schemas/entry-types';

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

  const [allCodexEntries, setAllCodexEntries] = useState<ReadonlyMap<string, CodexEntry>>(new Map());
  const [codexLoadError, setCodexLoadError] = useState<string | null>(null);

  useEffect(() => {
    const dataDir = process.env.__CHRONICLE_DATA_DIR || resolveDataDir();
    const codexDir = `${dataDir}/codex`;
    loadAllCodex(codexDir).then((entries) => {
      setAllCodexEntries(entries);
    }).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Codex] Failed to load codex:', msg);
      setCodexLoadError(msg);
    });
  }, []);

  const questTemplates = useMemo(() => {
    const templates = new Map<string, QuestTemplate>();
    for (const [id, entry] of allCodexEntries) {
      if (entry.type === 'quest') {
        templates.set(id, entry as QuestTemplate);
      }
    }
    return templates;
  }, [allCodexEntries]);

  const sceneManager = useMemo(
    () => createSceneManager({ scene: sceneStore, eventBus }, allCodexEntries as Map<string, CodexEntry>),
    [allCodexEntries],
  );

  const dialogueManager = useMemo(
    () => createDialogueManager(
      { dialogue: dialogueStore, npcMemory: npcMemoryStore, scene: sceneStore, game: gameStore, player: playerStore, relation: relationStore },
      allCodexEntries as Map<string, CodexEntry>,
    ),
    [allCodexEntries],
  );

  const combatLoop = useMemo(
    () => createCombatLoop(
      { combat: combatStore, player: playerStore, game: gameStore },
      allCodexEntries as Map<string, CodexEntry>,
    ),
    [allCodexEntries],
  );

  const gameLoop = useMemo(
    () => createGameLoop(
      { player: playerStore, scene: sceneStore, game: gameStore, combat: combatStore },
      eventBus,
      { sceneManager, dialogueManager, combatLoop },
    ),
    [sceneManager, dialogueManager, combatLoop],
  );

  const handleStart = useCallback(() => {
    setGameState((draft) => {
      draft.phase = 'narrative_creation';
    });
  }, [setGameState]);

  const handleCharacterCreated = useCallback(async (newPlayerState: PlayerState) => {
    playerStore.setState((draft) => {
      Object.assign(draft, newPlayerState);
    });
    await sceneManager.loadScene('loc_north_gate');
    setGameState((draft) => {
      draft.phase = 'game';
    });
  }, [setGameState, sceneManager]);

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
          dialogueManager={dialogueManager}
          combatLoop={combatLoop}
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
