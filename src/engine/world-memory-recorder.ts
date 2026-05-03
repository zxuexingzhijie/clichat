import type { Ecology, WorldEffects } from '../codex/schemas/authoring-v2';
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
  seedStaticWorldData(stores, codexEntries);
  const record = (event: WorldEvent): boolean => recordWorldEventWithDerivations(stores, event);

  const cleanups = [
    subscribe(eventBus, 'quest_stage_advanced', (payload) => {
      const questName = displayName(codexEntries, payload.questId);
      const event: WorldEvent = {
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
      };
      if (record(event)) applyQuestStageWorldEffects(stores, codexEntries, event, payload.questId, payload.newStageId);
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

type Present<T> = T extends null | undefined ? never : T;
type EcologyFactSeed = Present<Present<Ecology>['facts_seeded']>[number];
type EcologyRumorSeed = Present<Present<Ecology>['rumors_seeded']>[number];
type WorldEffectsStage = Present<Present<WorldEffects>['on_stage_enter']>[string];
type EcologyBeliefSeed = Present<WorldEffectsStage['beliefs_created']>[number];

function seedStaticWorldData(
  stores: WorldEventRecorderStores,
  codexEntries: ReadonlyMap<string, CodexEntry>,
): void {
  for (const entry of codexEntries.values()) {
    for (const seed of entry.ecology?.facts_seeded ?? []) {
      seedWorldFact(stores, entry, seed, 'fact');
    }

    for (const seed of entry.ecology?.rumors_seeded ?? []) {
      seedWorldFact(stores, entry, seed, 'rumor');
    }
  }
}

function seedWorldFact(
  stores: WorldEventRecorderStores,
  entry: CodexEntry,
  seed: EcologyFactSeed | EcologyRumorSeed,
  kind: 'fact' | 'rumor',
): void {
  const idempotencyKey = `world_data_seed:${entry.id}:${seed.id}`;
  const timestamp = nowIso();
  const event: WorldEvent = {
    id: eventId(idempotencyKey),
    idempotencyKey,
    turnNumber: stores.game.getState().turnCount,
    timestamp,
    type: 'world_state',
    actorIds: ['system'],
    subjectIds: [entry.id, seed.id],
    locationId: seed.scope === 'location' ? (seed.scope_id ?? entry.id) : null,
    factionIds: seed.scope === 'faction' && seed.scope_id ? [seed.scope_id] : [],
    summary: `Seeded ${kind} ${seed.id} from ${entry.id}.`,
    rawPayload: { entryId: entry.id, seedId: seed.id, kind },
    sourceDomainEvent: 'world_data_seed',
    visibility: kind === 'rumor' ? 'same_location' : 'public',
    importance: 'low',
    tags: ['world_data_seed', entry.id, seed.id, kind],
    source: 'system',
  };

  if (!appendWorldEvent(stores.worldMemory, event)) return;
  upsertWorldFact(stores.worldMemory, mergeFactProvenance(stores.worldMemory, factFromSeed(seed, event, kind), event));
}

function applyQuestStageWorldEffects(
  stores: WorldEventRecorderStores,
  codexEntries: ReadonlyMap<string, CodexEntry>,
  event: WorldEvent,
  questId: string,
  stageId: string,
): void {
  const quest = codexEntries.get(questId);
  if (quest?.type !== 'quest') return;

  const stageEffects = quest.world_effects?.on_stage_enter?.[stageId];
  if (!stageEffects) return;

  for (const seed of stageEffects.facts_created ?? []) {
    if (typeof seed === 'string') continue;
    upsertWorldFact(stores.worldMemory, mergeFactProvenance(stores.worldMemory, factFromSeed(seed, event, 'fact'), event));
  }

  for (const seed of stageEffects.rumors_created ?? []) {
    if (typeof seed === 'string') continue;
    upsertWorldFact(stores.worldMemory, mergeFactProvenance(stores.worldMemory, factFromSeed(seed, event, 'rumor'), event));
  }

  for (const seed of stageEffects.beliefs_created ?? []) {
    upsertNpcBelief(stores.worldMemory, mergeBeliefProvenance(stores.worldMemory, beliefFromSeed(seed, event)));
  }
}

function factFromSeed(
  seed: EcologyFactSeed | EcologyRumorSeed,
  event: WorldEvent,
  kind: 'fact' | 'rumor',
): WorldFact {
  return {
    id: seed.id,
    statement: seed.statement,
    scope: seed.scope,
    scopeId: seed.scope_id ?? null,
    truthStatus: kind === 'rumor' ? 'rumor' : (seed.truth_status ?? 'confirmed'),
    confidence: seed.confidence,
    sourceEventIds: [event.id],
    tags: factSeedTags(seed, kind),
    createdAt: event.timestamp,
    updatedAt: event.timestamp,
  };
}

function factSeedTags(seed: EcologyFactSeed | EcologyRumorSeed, kind: 'fact' | 'rumor'): string[] {
  const tags = [...(seed.tags ?? [])];
  if (kind === 'rumor' && 'spread' in seed) {
    tags.push(...(seed.spread ?? []).map((locationId) => `spread:${locationId}`));
  }
  if (kind === 'rumor' && 'starts_at_stage' in seed && seed.starts_at_stage) {
    tags.push(`starts_at_stage:${seed.starts_at_stage}`);
  }
  return tags;
}

function beliefFromSeed(seed: EcologyBeliefSeed, event: WorldEvent): NpcBelief {
  const subjectId = seed.subject_id ?? null;
  const factId = seed.fact_id ?? null;
  return {
    id: `belief:${seed.holder_type}:${seed.holder_id}:${subjectId ?? 'none'}:${factId ?? 'none'}`,
    holderId: seed.holder_id,
    holderType: seed.holder_type,
    subjectId,
    factId,
    statement: seed.statement,
    stance: seed.stance,
    confidence: seed.confidence,
    sourceEventIds: [event.id],
    lastReinforcedTurn: event.turnNumber,
    decay: seed.decay ?? 'normal',
    tags: seed.tags ?? [],
  };
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

function mergeBeliefProvenance(
  store: WorldMemoryStoreLike,
  belief: NpcBelief,
): NpcBelief {
  const previous = store.getState().beliefs[belief.id];
  if (!previous) return belief;

  return {
    ...belief,
    sourceEventIds: Array.from(new Set([...previous.sourceEventIds, ...belief.sourceEventIds])),
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
