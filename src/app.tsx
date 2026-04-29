import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text } from 'ink';
import { createStoreContext } from './ui/hooks/use-store';
import type { GameState } from './state/game-store';
import type { PlayerState } from './state/player-store';
import type { SceneState } from './state/scene-store';
import type { DialogueState } from './state/dialogue-store';
import type { CombatState } from './state/combat-store';
import type { QuestState } from './state/quest-store';
import { TitleScreen } from './ui/screens/title-screen';
import { GameScreen } from './ui/screens/game-screen';
import { SizeGuard } from './ui/components/size-guard';
import { GameErrorBoundary } from './ui/components/error-boundary';
import { initRoleConfigs } from './ai/providers';
import { createGameLoop } from './game-loop';
import { createSceneManager } from './engine/scene-manager';
import { createDialogueManager } from './engine/dialogue-manager';
import { createCombatLoop } from './engine/combat-loop';
import { generateNarration } from './ai/roles/narrative-director';
import { NarrativeCreationScreen } from './ui/screens/narrative-creation-screen';
import { resolveDataDir, resolveConfigPath } from './paths';
import { loadAllCodex } from './codex/loader';
import { DEFAULT_START_LOCATION } from './engine/game-constants';
import type { CodexEntry, QuestTemplate } from './codex/schemas/entry-types';
import type { CodexDisplayEntry } from './ui/panels/codex-panel';
import { createGameContext } from './context/game-context';
import type { GameContext } from './context/game-context';
import { quickSave, saveGame, loadGame, readSaveData, getSaveDir } from './persistence/save-file-manager';
import { createSerializer } from './state/serializer';
import { createQuestSystem } from './engine/quest-system';
import { createBranch, switchBranch, deleteBranch } from './persistence/branch-manager';
import { branchStore } from './state/branch-store';
import { replayTurns } from './engine/turn-log';
import { generateRetrievalPlan } from './ai/roles/retrieval-planner';
import type { LocationMapData } from './ui/panels/map-panel';
import type { BranchDisplayNode } from './ui/panels/branch-tree-panel';
import type { ExplorationState } from './state/exploration-store';
import type { BranchState } from './state/branch-store';
import type { PlayerKnowledgeState } from './state/player-knowledge-store';
import { runSummarizerLoop } from './ai/summarizer/summarizer-worker';
import { initExplorationTracker } from './engine/exploration-tracker';
import { initKnowledgeTracker } from './engine/knowledge-tracker';

const GameStoreCtx = createStoreContext<GameState>();
const PlayerStoreCtx = createStoreContext<PlayerState>();
const SceneStoreCtx = createStoreContext<SceneState>();
const DialogueStoreCtx = createStoreContext<DialogueState>();
const CombatStoreCtx = createStoreContext<CombatState>();
const QuestStoreCtx = createStoreContext<QuestState>();

export { GameStoreCtx, PlayerStoreCtx, SceneStoreCtx, DialogueStoreCtx, CombatStoreCtx, QuestStoreCtx };

const saveDir = `${process.env.__CHRONICLE_DATA_DIR || resolveDataDir()}/saves`;

interface AppInnerProps {
  readonly ctx: GameContext;
}

function AppInner({ ctx }: AppInnerProps): React.ReactNode {
  const phase = GameStoreCtx.useStoreState((s) => s.phase);
  const setGameState = GameStoreCtx.useSetState();

  const [allCodexEntries, setAllCodexEntries] = useState<ReadonlyMap<string, CodexEntry>>(new Map());
  const [codexLoadError, setCodexLoadError] = useState<string | null>(null);

  const [playerKnowledgeState, setPlayerKnowledgeState] = useState<PlayerKnowledgeState>(
    () => ctx.stores.playerKnowledge.getState(),
  );
  useEffect(() => {
    return ctx.stores.playerKnowledge.subscribe(() => {
      setPlayerKnowledgeState(ctx.stores.playerKnowledge.getState());
    });
  }, [ctx]);

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

  const codexDisplayEntries = useMemo<CodexDisplayEntry[]>(() => {
    return Array.from(allCodexEntries.values()).map(entry => ({
      id: entry.id,
      name: entry.name,
      type: entry.type,
      description: entry.description,
      visibility: entry.epistemic.visibility,
      authority: entry.epistemic.authority,
      confidence: entry.epistemic.confidence,
      sourceType: entry.epistemic.source_type,
      tags: entry.tags,
      relatedIds: [],
      knowledgeStatus: Object.values(playerKnowledgeState.entries)
        .find(e => e.codexEntryId === entry.id)?.knowledgeStatus ?? null,
    }));
  }, [allCodexEntries, playerKnowledgeState]);

  const questTemplates = useMemo(() => {
    const templates = new Map<string, QuestTemplate>();
    for (const [id, entry] of allCodexEntries) {
      if (entry.type === 'quest') {
        templates.set(id, entry as QuestTemplate);
      }
    }
    return templates;
  }, [allCodexEntries]);

  const serializer = useMemo(
    () => {
      const sessionStart = Date.now();
      return createSerializer(
        {
          player: ctx.stores.player,
          scene: ctx.stores.scene,
          combat: ctx.stores.combat,
          game: ctx.stores.game,
          quest: ctx.stores.quest,
          relations: ctx.stores.relation,
          npcMemory: ctx.stores.npcMemory,
          exploration: ctx.stores.exploration,
          playerKnowledge: ctx.stores.playerKnowledge,
          turnLog: ctx.stores.turnLog,
        },
        () => ctx.stores.branch.getState().currentBranchId,
        () => null,
        () => Math.floor((Date.now() - sessionStart) / 1000),
      );
    },
    [ctx],
  );

  const questSystem = useMemo(
    () => createQuestSystem(
      { quest: ctx.stores.quest, relation: ctx.stores.relation, game: ctx.stores.game, player: ctx.stores.player },
      allCodexEntries as Map<string, CodexEntry>,
      ctx.eventBus,
    ),
    [ctx, allCodexEntries],
  );

  const sceneManager = useMemo(
    () => createSceneManager(
      { scene: ctx.stores.scene, game: ctx.stores.game, player: ctx.stores.player, eventBus: ctx.eventBus },
      allCodexEntries as Map<string, CodexEntry>,
      {
        generateNarrationFn: generateNarration,
        generateRetrievalPlanFn: (context) => generateRetrievalPlan({
          sceneId: context.currentScene,
          locationName: context.currentScene,
          playerIntent: context.playerAction,
          activeNpcIds: context.activeNpcs,
          activeQuestIds: context.activeQuests,
        }),
      },
    ),
    [ctx, allCodexEntries],
  );

  const dialogueManager = useMemo(
    () => createDialogueManager(
      {
        dialogue: ctx.stores.dialogue,
        npcMemory: ctx.stores.npcMemory,
        scene: ctx.stores.scene,
        game: ctx.stores.game,
        player: ctx.stores.player,
        relation: ctx.stores.relation,
      },
      allCodexEntries as Map<string, CodexEntry>,
    ),
    [ctx, allCodexEntries],
  );

  const combatLoop = useMemo(
    () => createCombatLoop(
      { combat: ctx.stores.combat, player: ctx.stores.player, game: ctx.stores.game },
      allCodexEntries as Map<string, CodexEntry>,
      { generateNarrationFn: generateNarration, sceneStore: ctx.stores.scene, eventBus: ctx.eventBus },
    ),
    [ctx, allCodexEntries],
  );

  const gameLoop = useMemo(
    () => createGameLoop(
      {
        player: ctx.stores.player,
        scene: ctx.stores.scene,
        game: ctx.stores.game,
        combat: ctx.stores.combat,
      },
      ctx.eventBus,
      {
        sceneManager,
        dialogueManager,
        combatLoop,
        saveFileManager: { quickSave, saveGame, loadGame },
        serializer,
        saveDir,
        questSystem,
        questStore: ctx.stores.quest,
        branchManager: {
          createBranch,
          switchBranch,
          deleteBranch,
          getBranchMeta: (branchId: string) => branchStore.getState().branches[branchId],
        },
        turnLog: { replayTurns },
        codexEntries: allCodexEntries as Map<string, CodexEntry>,
      },
    ),
    [sceneManager, dialogueManager, combatLoop, serializer, questSystem, ctx, allCodexEntries],
  );

  const currentSceneId = SceneStoreCtx.useStoreState((s) => s.sceneId);

  const [explorationState, setExplorationState] = useState<ExplorationState>(
    () => ctx.stores.exploration.getState(),
  );
  useEffect(() => {
    return ctx.stores.exploration.subscribe(() => {
      setExplorationState(ctx.stores.exploration.getState());
    });
  }, [ctx]);

  const [branchState, setBranchState] = useState<BranchState>(
    () => ctx.stores.branch.getState(),
  );
  useEffect(() => {
    return ctx.stores.branch.subscribe(() => {
      setBranchState(ctx.stores.branch.getState());
    });
  }, [ctx]);

  const mapData = useMemo(() => {
    const locationEntries = Array.from(allCodexEntries.values()).filter(e => e.type === 'location');
    const locations: LocationMapData[] = locationEntries.map(entry => ({
      id: entry.id,
      name: entry.name,
      mapIcon: (entry as any).map_icon ?? '',
      coordinates: (entry as any).coordinates ?? { x: 0, y: 0 },
      exits: ((entry as any).exits ?? []).map((ex: any) => ({
        direction: ex.direction,
        targetId: ex.targetId,
      })),
      dangerLevel: (entry as any).danger_level ?? 0,
      region: (entry as any).region ?? '',
      explorationLevel: explorationState.locations[entry.id]?.level ?? 'unknown',
      isQuestRelated: entry.tags?.includes('quest_related') ?? false,
    }));
    const regionName = locations[0]?.region ?? '';
    return { locations, currentLocationId: currentSceneId, regionName };
  }, [allCodexEntries, explorationState, currentSceneId]);

  const branchTree = useMemo((): readonly BranchDisplayNode[] => {
    const { branches } = branchState;
    function buildNodes(parentId: string | null): BranchDisplayNode[] {
      return Object.values(branches)
        .filter(b => b.parentBranchId === parentId)
        .map(b => ({ branchMeta: b, saves: [], children: buildNodes(b.id) }));
    }
    return buildNodes(null);
  }, [branchState]);

  useEffect(() => {
    runSummarizerLoop().catch((err) => {
      console.error('[Summarizer] loop error:', err instanceof Error ? err.message : String(err));
    });
  }, []);

  useEffect(() => {
    const cleanup = initExplorationTracker(
      { exploration: ctx.stores.exploration, game: ctx.stores.game },
      ctx.eventBus,
    );
    return cleanup;
  }, [ctx]);

  useEffect(() => {
    if (allCodexEntries.size === 0) return;
    const cleanup = initKnowledgeTracker(
      { playerKnowledge: ctx.stores.playerKnowledge, game: ctx.stores.game },
      ctx.eventBus,
    );
    return cleanup;
  }, [ctx, allCodexEntries]);

  const handleStart = useCallback(() => {
    setGameState((draft) => {
      draft.phase = 'narrative_creation';
    });
  }, [setGameState]);

  const handleCharacterCreated = useCallback(async (newPlayerState: PlayerState) => {
    ctx.stores.player.setState((draft) => {
      Object.assign(draft, newPlayerState);
    });
    await sceneManager.loadScene(DEFAULT_START_LOCATION);
    setGameState((draft) => {
      draft.phase = 'game';
    });
  }, [setGameState, sceneManager, ctx]);

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
          codexEntries={codexDisplayEntries}
          mapData={mapData}
          branchTree={branchTree}
          currentBranchId={branchState.currentBranchId}
          branches={branchState.branches}
          readSaveData={readSaveData}
          saveDir={saveDir}
        />
      </SizeGuard>
    </GameErrorBoundary>
  );
}

export function App(): React.ReactNode {
  const ctx = useMemo(() => createGameContext(), []);

  useEffect(() => {
    initRoleConfigs(resolveConfigPath(process.env.__CHRONICLE_DATA_DIR || resolveDataDir())).catch((err) => {
      console.error('[AI Config] Failed to load ai-config.yaml, using defaults:', err instanceof Error ? err.message : String(err));
    });
  }, []);

  return (
    <GameStoreCtx.Provider store={ctx.stores.game}>
      <PlayerStoreCtx.Provider store={ctx.stores.player}>
        <SceneStoreCtx.Provider store={ctx.stores.scene}>
          <DialogueStoreCtx.Provider store={ctx.stores.dialogue}>
            <CombatStoreCtx.Provider store={ctx.stores.combat}>
              <QuestStoreCtx.Provider store={ctx.stores.quest}>
                <AppInner ctx={ctx} />
              </QuestStoreCtx.Provider>
            </CombatStoreCtx.Provider>
          </DialogueStoreCtx.Provider>
        </SceneStoreCtx.Provider>
      </PlayerStoreCtx.Provider>
    </GameStoreCtx.Provider>
  );
}
