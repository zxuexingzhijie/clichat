import type { CodexEntry } from '../codex/schemas/entry-types';
import type { EventBus } from '../events/event-bus';
import type { DomainEvents } from '../events/event-types';
import type { Store } from '../state/create-store';
import type { DialogueState } from '../state/dialogue-store';
import type { GameState } from '../state/game-store';
import type { SceneState } from '../state/scene-store';
import {
  appendWorldEvent,
  upsertNpcBelief,
  upsertWorldFact,
  type NpcBelief,
  type WorldEvent,
  type WorldFact,
  type WorldMemoryState,
} from '../state/world-memory-store';

type WorldMemoryStoreLike = Store<WorldMemoryState>;
type GameStoreLike = Store<GameState>;
type SceneStoreLike = Store<SceneState>;
type DialogueStoreLike = Store<DialogueState>;

export type WorldEventRecorderStores = {
  readonly worldMemory: WorldMemoryStoreLike;
  readonly game: GameStoreLike;
  readonly scene: SceneStoreLike;
  readonly dialogue: DialogueStoreLike;
};

function subscribe<K extends keyof DomainEvents>(
  eventBus: EventBus,
  eventName: K,
  handler: (payload: DomainEvents[K]) => void,
): () => void {
  eventBus.on(eventName, handler);
  return () => eventBus.off(eventName, handler);
}

export function recordWorldEvent(store: WorldMemoryStoreLike, event: WorldEvent): boolean {
  return appendWorldEvent(store, event);
}

export function recordWorldEventWithDerivations(stores: WorldEventRecorderStores, event: WorldEvent): boolean {
  const appended = recordWorldEvent(stores.worldMemory, event);
  if (appended) applyFirstPassDerivations(stores, event);
  return appended;
}

export function initWorldEventRecorder(
  stores: WorldEventRecorderStores,
  eventBus: EventBus,
  codexEntries: ReadonlyMap<string, CodexEntry>,
): () => void {
  const record = (event: WorldEvent): boolean => recordWorldEventWithDerivations(stores, event);

  const cleanups = [
    subscribe(eventBus, 'quest_stage_advanced', (payload) => {
      const questName = displayName(codexEntries, payload.questId);
      record({
        id: eventId(`quest_stage_advanced:${payload.questId}:${payload.newStageId}:${payload.turnNumber}`),
        idempotencyKey: `quest_stage_advanced:${payload.questId}:${payload.newStageId}:${payload.turnNumber}`,
        turnNumber: payload.turnNumber,
        timestamp: nowIso(),
        type: 'quest',
        actorIds: ['player'],
        subjectIds: [payload.questId, payload.newStageId],
        locationId: stores.scene.getState().sceneId,
        factionIds: [],
        summary: `Quest ${questName} advanced to stage ${payload.newStageId}.`,
        rawPayload: { ...payload },
        sourceDomainEvent: 'quest_stage_advanced',
        visibility: 'public',
        importance: 'high',
        tags: ['quest', payload.questId, payload.newStageId],
        source: 'quest_system',
      });
    }),
    subscribe(eventBus, 'item_acquired', (payload) => {
      const turnNumber = stores.game.getState().turnCount;
      record({
        id: eventId(`item_acquired:${payload.itemId}:${payload.quantity}:${turnNumber}`),
        idempotencyKey: `item_acquired:${payload.itemId}:${payload.quantity}:${turnNumber}`,
        turnNumber,
        timestamp: nowIso(),
        type: 'item',
        actorIds: ['player'],
        subjectIds: [payload.itemId],
        locationId: stores.scene.getState().sceneId,
        factionIds: [],
        summary: `Player acquired ${payload.quantity} x ${payload.itemName}.`,
        rawPayload: { ...payload },
        sourceDomainEvent: 'item_acquired',
        visibility: 'private',
        importance: 'low',
        tags: ['item', payload.itemId],
        source: 'player_action',
      });
    }),
    subscribe(eventBus, 'scene_changed', (payload) => {
      const turnNumber = stores.game.getState().turnCount;
      record({
        id: eventId(`scene_changed:${payload.sceneId}:turn:${turnNumber}`),
        idempotencyKey: `scene_changed:${payload.sceneId}:turn:${turnNumber}`,
        turnNumber,
        timestamp: nowIso(),
        type: 'movement',
        actorIds: ['player'],
        subjectIds: [payload.sceneId],
        locationId: payload.sceneId,
        factionIds: [],
        summary: `Player moved to ${displayName(codexEntries, payload.sceneId)}.`,
        rawPayload: { ...payload },
        sourceDomainEvent: 'scene_changed',
        visibility: 'same_location',
        importance: 'low',
        tags: ['movement', payload.sceneId],
        source: 'scene_manager',
      });
    }),
    subscribe(eventBus, 'knowledge_discovered', (payload) => {
      const subjectIds = payload.codexEntryId ? [payload.entryId, payload.codexEntryId] : [payload.entryId];
      record({
        id: eventId(`knowledge_discovered:${payload.entryId}:${payload.codexEntryId ?? 'none'}:${payload.turnNumber}`),
        idempotencyKey: `knowledge_discovered:${payload.entryId}:${payload.codexEntryId ?? 'none'}:${payload.turnNumber}`,
        turnNumber: payload.turnNumber,
        timestamp: nowIso(),
        type: 'discovery',
        actorIds: ['player'],
        subjectIds,
        locationId: stores.scene.getState().sceneId,
        factionIds: [],
        summary: `Player discovered knowledge ${payload.entryId}.`,
        rawPayload: { ...payload },
        sourceDomainEvent: 'knowledge_discovered',
        visibility: 'private',
        importance: 'medium',
        tags: ['discovery', 'knowledge', payload.entryId],
        source: 'rules_engine',
      });
    }),
    subscribe(eventBus, 'location_explored', (payload) => {
      const turnNumber = stores.game.getState().turnCount;
      record({
        id: eventId(`location_explored:${payload.locationId}:${payload.newLevel}:${turnNumber}`),
        idempotencyKey: `location_explored:${payload.locationId}:${payload.newLevel}:${turnNumber}`,
        turnNumber,
        timestamp: nowIso(),
        type: 'discovery',
        actorIds: ['player'],
        subjectIds: [payload.locationId],
        locationId: payload.locationId,
        factionIds: [],
        summary: `Player explored ${displayName(codexEntries, payload.locationId)} to ${payload.newLevel}.`,
        rawPayload: { ...payload },
        sourceDomainEvent: 'location_explored',
        visibility: 'private',
        importance: 'medium',
        tags: ['discovery', 'location', payload.locationId, payload.newLevel],
        source: 'rules_engine',
      });
    }),
    subscribe(eventBus, 'reputation_changed', (payload) => {
      const turnNumber = stores.game.getState().turnCount;
      record({
        id: eventId(`reputation_changed:${payload.targetType}:${payload.targetId}:${payload.delta}:${payload.newValue}:${turnNumber}`),
        idempotencyKey: `reputation_changed:${payload.targetType}:${payload.targetId}:${payload.delta}:${payload.newValue}:${turnNumber}`,
        turnNumber,
        timestamp: nowIso(),
        type: 'reputation',
        actorIds: ['player'],
        subjectIds: ['player', payload.targetId],
        locationId: stores.scene.getState().sceneId,
        factionIds: payload.targetType === 'faction' ? [payload.targetId] : [],
        summary: `${payload.targetType} ${displayName(codexEntries, payload.targetId)} reputation toward player changed by ${payload.delta} to ${payload.newValue}.`,
        rawPayload: { ...payload },
        sourceDomainEvent: 'reputation_changed',
        visibility: payload.targetType === 'faction' ? 'faction' : 'private',
        importance: 'medium',
        tags: ['reputation', payload.targetType, payload.targetId, 'player'],
        source: 'rules_engine',
      });
    }),
    subscribe(eventBus, 'combat_ended', (payload) => {
      const turnNumber = stores.game.getState().turnCount;
      const enemyIds = payload.enemyIds ?? [];
      record({
        id: eventId(`combat_ended:${payload.outcome}:${enemyIds.join(',')}:${turnNumber}`),
        idempotencyKey: `combat_ended:${payload.outcome}:${enemyIds.join(',')}:${turnNumber}`,
        turnNumber,
        timestamp: nowIso(),
        type: 'combat',
        actorIds: ['player'],
        subjectIds: enemyIds,
        locationId: stores.scene.getState().sceneId,
        factionIds: [],
        summary: `Combat ended with ${payload.outcome}.`,
        rawPayload: { ...payload },
        sourceDomainEvent: 'combat_ended',
        visibility: 'same_location',
        importance: payload.outcome === 'victory' ? 'medium' : 'high',
        tags: ['combat', payload.outcome, ...enemyIds],
        source: 'rules_engine',
      });
    }),
  ];

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}

function applyFirstPassDerivations(stores: WorldEventRecorderStores, event: WorldEvent): void {
  applyDerivedMemory(stores.worldMemory, event, {
    fact: deriveFactFromEvent(event),
    beliefs: deriveBeliefsFromEvent(event, stores),
  });
}

function applyDerivedMemory(
  store: WorldMemoryStoreLike,
  event: WorldEvent,
  derived: { readonly fact: WorldFact | null; readonly beliefs: readonly NpcBelief[] },
): void {
  if (derived.fact) upsertWorldFact(store, mergeFactProvenance(store, derived.fact, event));

  for (const belief of derived.beliefs) {
    upsertNpcBelief(store, belief);
  }
}

function mergeFactProvenance(
  store: WorldMemoryStoreLike,
  fact: WorldFact,
  event: WorldEvent,
): WorldFact {
  const previous = store.getState().facts[fact.id];
  if (!previous) return fact;

  return {
    ...fact,
    sourceEventIds: Array.from(new Set([...previous.sourceEventIds, ...fact.sourceEventIds])),
    createdAt: previous.createdAt,
    updatedAt: event.timestamp,
  };
}

function deriveFactFromEvent(event: WorldEvent): WorldFact | null {
  if (event.sourceDomainEvent !== 'quest_stage_advanced') return null;

  const rawPayload = event.rawPayload ?? {};
  const questId = typeof rawPayload['questId'] === 'string' ? rawPayload['questId'] : event.subjectIds[0];
  const newStageId = typeof rawPayload['newStageId'] === 'string' ? rawPayload['newStageId'] : event.subjectIds[1];
  if (!questId || !newStageId) return null;

  return {
    id: `fact:quest_stage_advanced:${questId}:${newStageId}`,
    statement: `Quest ${questId} advanced to stage ${newStageId}.`,
    scope: 'quest',
    scopeId: questId,
    truthStatus: 'confirmed',
    confidence: 1,
    sourceEventIds: [event.id],
    tags: ['quest', questId, newStageId],
    createdAt: event.timestamp,
    updatedAt: event.timestamp,
  };
}

function deriveBeliefsFromEvent(
  event: WorldEvent,
  stores: WorldEventRecorderStores,
): NpcBelief[] {
  if (event.sourceDomainEvent === 'reputation_changed') {
    return deriveReputationBeliefs(event, stores.worldMemory.getState().beliefs);
  }

  if (event.visibility !== 'same_location') return [];

  const subjectId = event.subjectIds[0] ?? event.locationId;
  return stores.scene.getState().npcsPresent.map((npcId) => ({
    id: `belief:npc:${npcId}:${event.id}:witnessed`,
    holderId: npcId,
    holderType: 'npc',
    subjectId,
    factId: null,
    statement: event.summary,
    stance: 'knows',
    confidence: 0.8,
    sourceEventIds: [event.id],
    lastReinforcedTurn: event.turnNumber,
    decay: 'normal',
    tags: ['witnessed', event.type, ...event.subjectIds],
  }));
}

function deriveReputationBeliefs(
  event: WorldEvent,
  existingBeliefs: WorldMemoryState['beliefs'],
): NpcBelief[] {
  const rawPayload = event.rawPayload ?? {};
  const targetId = typeof rawPayload['targetId'] === 'string' ? rawPayload['targetId'] : null;
  const targetType = rawPayload['targetType'] === 'npc' || rawPayload['targetType'] === 'faction'
    ? rawPayload['targetType']
    : null;
  const delta = typeof rawPayload['delta'] === 'number' ? rawPayload['delta'] : null;
  const newValue = typeof rawPayload['newValue'] === 'number' ? rawPayload['newValue'] : null;
  if (!targetId || !targetType || delta === null || newValue === null) return [];

  const id = `belief:${targetType}:${targetId}:player:reputation`;
  const previous = existingBeliefs[id];
  const sourceEventIds = previous
    ? Array.from(new Set([...previous.sourceEventIds, event.id]))
    : [event.id];

  return [{
    id,
    holderId: targetId,
    holderType: targetType,
    subjectId: 'player',
    factId: null,
    statement: `${targetType} ${targetId} has reputation ${newValue} toward the player after a ${delta >= 0 ? '+' : ''}${delta} change.`,
    stance: 'believes',
    confidence: 1,
    sourceEventIds,
    lastReinforcedTurn: event.turnNumber,
    decay: 'slow',
    tags: ['reputation', 'player'],
  }];
}

function displayName(codexEntries: ReadonlyMap<string, CodexEntry>, id: string): string {
  return codexEntries.get(id)?.name ?? id;
}

function nowIso(): string {
  return new Date().toISOString();
}

function eventId(idempotencyKey: string): string {
  return `world-event:${idempotencyKey}`;
}
