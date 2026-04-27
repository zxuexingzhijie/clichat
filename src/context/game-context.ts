import mitt from 'mitt';
import type { DomainEvents } from '../events/event-types';
import type { EventBus } from '../events/event-bus';
import type { Store } from '../state/create-store';
import { createPlayerStore, type PlayerState } from '../state/player-store';
import { createSceneStore, type SceneState } from '../state/scene-store';
import { createGameStore, type GameState } from '../state/game-store';
import { createCombatStore, type CombatState } from '../state/combat-store';
import { createDialogueStore, type DialogueState } from '../state/dialogue-store';
import { createQuestStore, type QuestState } from '../state/quest-store';
import { createRelationStore, type RelationState } from '../state/relation-store';
import { createExplorationStore, type ExplorationState } from '../state/exploration-store';
import { createNpcMemoryStore, type NpcMemoryState } from '../state/npc-memory-store';
import { createPlayerKnowledgeStore, type PlayerKnowledgeState } from '../state/player-knowledge-store';
import { createBranchStore, type BranchState } from '../state/branch-store';
import { createCostSessionStore, type CostSessionState } from '../state/cost-session-store';
import { createTurnLogStore, type TurnLogState } from '../state/turn-log-store';

export type GameStores = {
  readonly player: Store<PlayerState>;
  readonly scene: Store<SceneState>;
  readonly game: Store<GameState>;
  readonly combat: Store<CombatState>;
  readonly dialogue: Store<DialogueState>;
  readonly quest: Store<QuestState>;
  readonly relation: Store<RelationState>;
  readonly exploration: Store<ExplorationState>;
  readonly npcMemory: Store<NpcMemoryState>;
  readonly playerKnowledge: Store<PlayerKnowledgeState>;
  readonly branch: Store<BranchState>;
  readonly costSession: Store<CostSessionState>;
  readonly turnLog: Store<TurnLogState>;
};

export type GameContext = {
  readonly stores: GameStores;
  readonly eventBus: EventBus;
};

export function createGameContext(): GameContext {
  const eventBus: EventBus = mitt<DomainEvents>();

  const gameStore = createGameStore(eventBus);
  const stores: GameStores = {
    player: createPlayerStore(eventBus),
    scene: createSceneStore(eventBus),
    game: gameStore,
    combat: createCombatStore(eventBus),
    dialogue: createDialogueStore(eventBus),
    quest: createQuestStore(eventBus, { getGameState: () => gameStore.getState() }),
    relation: createRelationStore(eventBus),
    exploration: createExplorationStore(eventBus),
    npcMemory: createNpcMemoryStore(eventBus),
    playerKnowledge: createPlayerKnowledgeStore(eventBus),
    branch: createBranchStore(eventBus),
    costSession: createCostSessionStore(eventBus),
    turnLog: createTurnLogStore(eventBus),
  };

  return { stores, eventBus };
}
