import { describe, expect, it } from 'bun:test';
import mitt from 'mitt';
import type { EventBus } from '../events/event-bus';
import type { CodexEntry } from '../codex/schemas/entry-types';
import { createDialogueStore } from '../state/dialogue-store';
import { createGameStore } from '../state/game-store';
import { createSceneStore } from '../state/scene-store';
import { createWorldMemoryStore, type WorldEvent } from '../state/world-memory-store';
import { initWorldEventRecorder, recordWorldEvent, recordWorldEventWithDerivations } from './world-memory-recorder';

function makeHarness() {
  const eventBus = mitt() as unknown as EventBus;
  const game = createGameStore(eventBus);
  const scene = createSceneStore(eventBus);
  const dialogue = createDialogueStore(eventBus);
  const worldMemory = createWorldMemoryStore(eventBus);
  const stores = { worldMemory, game, scene, dialogue };
  const codexEntries = new Map<string, CodexEntry>();
  return { eventBus, stores, codexEntries, worldMemory, game, scene, dialogue };
}

function setTurnCount(game: ReturnType<typeof createGameStore>, turnCount: number): void {
  game.setState((draft) => {
    draft.turnCount = turnCount;
  });
}

function setNpcsPresent(scene: ReturnType<typeof createSceneStore>, npcsPresent: string[]): void {
  scene.setState((draft) => {
    draft.npcsPresent = npcsPresent;
  });
}

function firstEvent(worldMemory: ReturnType<typeof createWorldMemoryStore>): WorldEvent {
  const event = worldMemory.getState().events[0];
  expect(event).toBeDefined();
  return event!;
}

describe('world-memory-recorder', () => {
  it('quest_stage_advanced records a quest WorldEvent', () => {
    const { eventBus, stores, codexEntries, worldMemory } = makeHarness();
    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    eventBus.emit('quest_stage_advanced', { questId: 'quest_main_01', newStageId: 'stage_2', turnNumber: 7 });

    expect(firstEvent(worldMemory)).toMatchObject({
      idempotencyKey: 'quest_stage_advanced:quest_main_01:stage_2:7',
      turnNumber: 7,
      type: 'quest',
      actorIds: ['player'],
      subjectIds: ['quest_main_01', 'stage_2'],
      sourceDomainEvent: 'quest_stage_advanced',
      source: 'quest_system',
      rawPayload: { questId: 'quest_main_01', newStageId: 'stage_2', turnNumber: 7 },
    });
    cleanup();
  });

  it('item_acquired records an item WorldEvent', () => {
    const { eventBus, stores, codexEntries, worldMemory, game } = makeHarness();
    setTurnCount(game, 12);
    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    eventBus.emit('item_acquired', { itemId: 'item_herb', itemName: 'Healing Herb', quantity: 3 });

    expect(firstEvent(worldMemory)).toMatchObject({
      idempotencyKey: 'item_acquired:item_herb:3:12',
      turnNumber: 12,
      type: 'item',
      actorIds: ['player'],
      subjectIds: ['item_herb'],
      sourceDomainEvent: 'item_acquired',
      source: 'player_action',
      rawPayload: { itemId: 'item_herb', itemName: 'Healing Herb', quantity: 3 },
    });
    cleanup();
  });

  it('combat_ended records one combat WorldEvent using rawPayload and canonical idempotency key', () => {
    const { eventBus, stores, codexEntries, worldMemory, game } = makeHarness();
    setTurnCount(game, 21);
    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    eventBus.emit('combat_ended', { outcome: 'victory', enemyIds: ['wolf_alpha', 'wolf_beta'] });
    eventBus.emit('combat_ended', { outcome: 'victory', enemyIds: ['wolf_alpha', 'wolf_beta'] });

    expect(worldMemory.getState().events).toHaveLength(1);
    expect(firstEvent(worldMemory)).toMatchObject({
      idempotencyKey: 'combat_ended:victory:wolf_alpha,wolf_beta:21',
      turnNumber: 21,
      type: 'combat',
      actorIds: ['player'],
      subjectIds: ['wolf_alpha', 'wolf_beta'],
      sourceDomainEvent: 'combat_ended',
      source: 'rules_engine',
      rawPayload: { outcome: 'victory', enemyIds: ['wolf_alpha', 'wolf_beta'] },
    });
    cleanup();
  });

  it('scene_changed records one movement WorldEvent using canonical idempotency key', () => {
    const { eventBus, stores, codexEntries, worldMemory, game } = makeHarness();
    setTurnCount(game, 5);
    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    eventBus.emit('scene_changed', { sceneId: 'loc_market', previousSceneId: 'loc_gate' });

    expect(firstEvent(worldMemory)).toMatchObject({
      idempotencyKey: 'scene_changed:loc_market:turn:5',
      turnNumber: 5,
      type: 'movement',
      actorIds: ['player'],
      subjectIds: ['loc_market'],
      locationId: 'loc_market',
      sourceDomainEvent: 'scene_changed',
      source: 'scene_manager',
      rawPayload: { sceneId: 'loc_market', previousSceneId: 'loc_gate' },
    });
    cleanup();
  });

  it('two scene_changed payloads with same sceneId in same turn but different previousSceneId create only one movement event', () => {
    const { eventBus, stores, codexEntries, worldMemory, game } = makeHarness();
    setTurnCount(game, 6);
    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    eventBus.emit('scene_changed', { sceneId: 'loc_market', previousSceneId: null });
    eventBus.emit('scene_changed', { sceneId: 'loc_market', previousSceneId: 'placeholder_scene' });

    expect(worldMemory.getState().events).toHaveLength(1);
    expect(worldMemory.getState().events[0]!.idempotencyKey).toBe('scene_changed:loc_market:turn:6');
    cleanup();
  });

  it('knowledge_discovered creates a discovery event with rawPayload.entryId and rawPayload.codexEntryId', () => {
    const { eventBus, stores, codexEntries, worldMemory } = makeHarness();
    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    eventBus.emit('knowledge_discovered', {
      entryId: 'knowledge_missing_miner',
      codexEntryId: 'codex_miner_wang',
      knowledgeStatus: 'learned',
      turnNumber: 9,
    });

    expect(firstEvent(worldMemory)).toMatchObject({
      idempotencyKey: 'knowledge_discovered:knowledge_missing_miner:codex_miner_wang:9',
      turnNumber: 9,
      type: 'discovery',
      subjectIds: ['knowledge_missing_miner', 'codex_miner_wang'],
      sourceDomainEvent: 'knowledge_discovered',
      rawPayload: {
        entryId: 'knowledge_missing_miner',
        codexEntryId: 'codex_miner_wang',
      },
    });
    cleanup();
  });

  it('location_explored creates a discovery event with rawPayload.locationId and rawPayload.newLevel', () => {
    const { eventBus, stores, codexEntries, worldMemory, game } = makeHarness();
    setTurnCount(game, 14);
    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    eventBus.emit('location_explored', { locationId: 'loc_forest', newLevel: 'visited', previousLevel: 'known' });

    expect(firstEvent(worldMemory)).toMatchObject({
      idempotencyKey: 'location_explored:loc_forest:visited:14',
      turnNumber: 14,
      type: 'discovery',
      subjectIds: ['loc_forest'],
      locationId: 'loc_forest',
      sourceDomainEvent: 'location_explored',
      rawPayload: {
        locationId: 'loc_forest',
        newLevel: 'visited',
      },
    });
    cleanup();
  });

  it('duplicate idempotency keys do not append duplicate events', () => {
    const { worldMemory } = makeHarness();
    const event: WorldEvent = {
      id: 'event-1',
      idempotencyKey: 'same-key',
      turnNumber: 1,
      timestamp: '2026-05-02T00:00:00.000Z',
      type: 'quest',
      actorIds: ['player'],
      subjectIds: ['quest_main_01'],
      locationId: null,
      factionIds: [],
      summary: 'Quest advanced',
      rawPayload: { questId: 'quest_main_01' },
      sourceDomainEvent: 'quest_stage_advanced',
      visibility: 'public',
      importance: 'medium',
      tags: ['quest'],
      source: 'quest_system',
    };

    expect(recordWorldEvent(worldMemory, event)).toBe(true);
    expect(recordWorldEvent(worldMemory, { ...event, id: 'event-2' })).toBe(false);

    expect(worldMemory.getState().events).toHaveLength(1);
    expect(worldMemory.getState().events[0]!.id).toBe('event-1');
  });

  it('recordWorldEventWithDerivations appends event, records idempotency key, and applies first-pass derivations', () => {
    const { stores, worldMemory } = makeHarness();
    const event: WorldEvent = {
      id: 'world-event:quest_stage_advanced:quest_main_01:stage_2:7',
      idempotencyKey: 'quest_stage_advanced:quest_main_01:stage_2:7',
      turnNumber: 7,
      timestamp: '2026-05-02T00:00:00.000Z',
      type: 'quest',
      actorIds: ['player'],
      subjectIds: ['quest_main_01', 'stage_2'],
      locationId: null,
      factionIds: [],
      summary: 'Quest advanced',
      rawPayload: { questId: 'quest_main_01', newStageId: 'stage_2', turnNumber: 7 },
      sourceDomainEvent: 'quest_stage_advanced',
      visibility: 'public',
      importance: 'medium',
      tags: ['quest'],
      source: 'quest_system',
    };

    expect(recordWorldEventWithDerivations(stores, event)).toBe(true);
    expect(recordWorldEventWithDerivations(stores, { ...event, id: 'duplicate-event' })).toBe(false);

    expect(worldMemory.getState().events).toHaveLength(1);
    expect(worldMemory.getState().processedIdempotencyKeys[event.idempotencyKey]).toBe(event.id);
    expect(worldMemory.getState().facts['fact:quest_stage_advanced:quest_main_01:stage_2']).toEqual(
      expect.objectContaining({ sourceEventIds: [event.id] }),
    );
  });

  it('cleanup unregisters handlers', () => {
    const { eventBus, stores, codexEntries, worldMemory } = makeHarness();
    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);
    cleanup();

    eventBus.emit('quest_stage_advanced', { questId: 'quest_main_01', newStageId: 'stage_2', turnNumber: 7 });

    expect(worldMemory.getState().events).toHaveLength(0);
  });

  it('quest_stage_advanced derives a quest-scoped WorldFact', () => {
    const { eventBus, stores, codexEntries, worldMemory } = makeHarness();
    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    eventBus.emit('quest_stage_advanced', { questId: 'quest_main_01', newStageId: 'stage_2', turnNumber: 7 });

    const event = firstEvent(worldMemory);
    expect(Object.values(worldMemory.getState().facts)).toEqual([
      expect.objectContaining({
        id: 'fact:quest_stage_advanced:quest_main_01:stage_2',
        scope: 'quest',
        scopeId: 'quest_main_01',
        truthStatus: 'confirmed',
        confidence: 1,
        sourceEventIds: [event.id],
        tags: ['quest', 'quest_main_01', 'stage_2'],
      }),
    ]);
    cleanup();
  });

  it('repeated quest_stage_advanced for the same quest stage preserves provenance and updates timestamp', () => {
    const { eventBus, stores, codexEntries, worldMemory } = makeHarness();
    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    eventBus.emit('quest_stage_advanced', { questId: 'quest_main_01', newStageId: 'stage_2', turnNumber: 7 });
    eventBus.emit('quest_stage_advanced', { questId: 'quest_main_01', newStageId: 'stage_2', turnNumber: 8 });

    const [first, second] = worldMemory.getState().events;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(worldMemory.getState().facts['fact:quest_stage_advanced:quest_main_01:stage_2']).toMatchObject({
      sourceEventIds: [first!.id, second!.id],
      createdAt: first!.timestamp,
      updatedAt: second!.timestamp,
    });
    cleanup();
  });

  it('item_acquired does not derive a fact by default', () => {
    const { eventBus, stores, codexEntries, worldMemory, game } = makeHarness();
    setTurnCount(game, 12);
    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    eventBus.emit('item_acquired', { itemId: 'item_herb', itemName: 'Healing Herb', quantity: 3 });

    expect(worldMemory.getState().events).toHaveLength(1);
    expect(worldMemory.getState().facts).toEqual({});
    cleanup();
  });

  it('reputation_changed derives a holder-scoped NpcBelief', () => {
    const { eventBus, stores, codexEntries, worldMemory, game } = makeHarness();
    setTurnCount(game, 17);
    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    eventBus.emit('reputation_changed', { targetId: 'npc_guard', targetType: 'npc', delta: 5, newValue: 12 });

    const event = firstEvent(worldMemory);
    expect(event).toMatchObject({
      idempotencyKey: 'reputation_changed:npc:npc_guard:5:12:17',
      type: 'reputation',
      subjectIds: ['player', 'npc_guard'],
      sourceDomainEvent: 'reputation_changed',
      rawPayload: { targetId: 'npc_guard', targetType: 'npc', delta: 5, newValue: 12 },
    });
    expect(Object.values(worldMemory.getState().beliefs)).toEqual([
      expect.objectContaining({
        id: 'belief:npc:npc_guard:player:reputation',
        holderId: 'npc_guard',
        holderType: 'npc',
        subjectId: 'player',
        factId: null,
        stance: 'believes',
        confidence: 1,
        sourceEventIds: [event.id],
        lastReinforcedTurn: 17,
        tags: ['reputation', 'player'],
      }),
    ]);
    cleanup();
  });

  it('repeated reputation_changed for the same target preserves provenance and refreshes belief details', () => {
    const { eventBus, stores, codexEntries, worldMemory, game } = makeHarness();
    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    setTurnCount(game, 17);
    eventBus.emit('reputation_changed', { targetId: 'npc_guard', targetType: 'npc', delta: 5, newValue: 12 });
    setTurnCount(game, 18);
    eventBus.emit('reputation_changed', { targetId: 'npc_guard', targetType: 'npc', delta: -2, newValue: 10 });

    const [first, second] = worldMemory.getState().events;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(worldMemory.getState().beliefs['belief:npc:npc_guard:player:reputation']).toMatchObject({
      statement: 'npc npc_guard has reputation 10 toward the player after a -2 change.',
      sourceEventIds: [first!.id, second!.id],
      lastReinforcedTurn: 18,
    });
    cleanup();
  });

  it('private events append only the raw event and do not create beliefs for bystanders', () => {
    const { eventBus, stores, codexEntries, worldMemory, game, scene } = makeHarness();
    setTurnCount(game, 18);
    setNpcsPresent(scene, ['npc_guard', 'npc_bartender']);
    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    eventBus.emit('item_acquired', { itemId: 'item_secret_letter', itemName: 'Secret Letter', quantity: 1 });

    expect(worldMemory.getState().events).toHaveLength(1);
    expect(firstEvent(worldMemory)).toMatchObject({
      type: 'item',
      visibility: 'private',
      rawPayload: { itemId: 'item_secret_letter', itemName: 'Secret Letter', quantity: 1 },
    });
    expect(worldMemory.getState().facts).toEqual({});
    expect(worldMemory.getState().beliefs).toEqual({});
    cleanup();
  });

  it('same-location events create beliefs for NPCs present in scene.npcsPresent', () => {
    const { eventBus, stores, codexEntries, worldMemory, game, scene } = makeHarness();
    setTurnCount(game, 19);
    setNpcsPresent(scene, ['npc_guard', 'npc_bartender']);
    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    eventBus.emit('scene_changed', { sceneId: 'loc_market', previousSceneId: 'loc_gate' });

    const event = firstEvent(worldMemory);
    expect(event).toMatchObject({ type: 'movement', visibility: 'same_location', locationId: 'loc_market' });
    expect(Object.values(worldMemory.getState().beliefs)).toEqual([
      expect.objectContaining({
        id: `belief:npc:npc_guard:${event.id}:witnessed`,
        holderId: 'npc_guard',
        holderType: 'npc',
        subjectId: 'loc_market',
        factId: null,
        statement: 'Player moved to loc_market.',
        stance: 'knows',
        confidence: 0.8,
        sourceEventIds: [event.id],
        lastReinforcedTurn: 19,
        tags: ['witnessed', 'movement', 'loc_market'],
      }),
      expect.objectContaining({
        id: `belief:npc:npc_bartender:${event.id}:witnessed`,
        holderId: 'npc_bartender',
        holderType: 'npc',
        subjectId: 'loc_market',
        factId: null,
        statement: 'Player moved to loc_market.',
        stance: 'knows',
        confidence: 0.8,
        sourceEventIds: [event.id],
        lastReinforcedTurn: 19,
        tags: ['witnessed', 'movement', 'loc_market'],
      }),
    ]);
    cleanup();
  });

  it('faction-scoped reputation events create a faction-held NpcBelief', () => {
    const { eventBus, stores, codexEntries, worldMemory, game } = makeHarness();
    setTurnCount(game, 20);
    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    eventBus.emit('reputation_changed', { targetId: 'faction_guard', targetType: 'faction', delta: 8, newValue: 18 });

    const event = firstEvent(worldMemory);
    expect(event).toMatchObject({
      type: 'reputation',
      visibility: 'faction',
      factionIds: ['faction_guard'],
      rawPayload: { targetId: 'faction_guard', targetType: 'faction', delta: 8, newValue: 18 },
    });
    expect(Object.values(worldMemory.getState().beliefs)).toEqual([
      expect.objectContaining({
        id: 'belief:faction:faction_guard:player:reputation',
        holderId: 'faction_guard',
        holderType: 'faction',
        subjectId: 'player',
        factId: null,
        stance: 'believes',
        confidence: 1,
        sourceEventIds: [event.id],
        lastReinforcedTurn: 20,
        tags: ['reputation', 'player'],
      }),
    ]);
    cleanup();
  });

  it('public quest events create a scoped WorldFact', () => {
    const { eventBus, stores, codexEntries, worldMemory } = makeHarness();
    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    eventBus.emit('quest_stage_advanced', { questId: 'quest_missing_miner', newStageId: 'stage_found_clue', turnNumber: 21 });

    const event = firstEvent(worldMemory);
    expect(event).toMatchObject({ type: 'quest', visibility: 'public' });
    expect(Object.values(worldMemory.getState().facts)).toEqual([
      expect.objectContaining({
        id: 'fact:quest_stage_advanced:quest_missing_miner:stage_found_clue',
        scope: 'quest',
        scopeId: 'quest_missing_miner',
        truthStatus: 'confirmed',
        sourceEventIds: [event.id],
        tags: ['quest', 'quest_missing_miner', 'stage_found_clue'],
      }),
    ]);
    cleanup();
  });

  it('ecology.facts_seeded inserts a WorldFact with generated system WorldEvent provenance', () => {
    const { eventBus, stores, codexEntries, worldMemory } = makeHarness();
    codexEntries.set('loc_seeded_gate', {
      id: 'loc_seeded_gate',
      name: 'Seeded Gate',
      type: 'location',
      ecology: {
        facts_seeded: [{
          id: 'fact_seeded_gate_open',
          statement: 'The seeded gate is open.',
          scope: 'location',
          scope_id: 'loc_seeded_gate',
          truth_status: 'confirmed',
          confidence: 0.95,
          tags: ['gate', 'seeded'],
        }],
      },
    } as CodexEntry);

    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    const seedEvent = firstEvent(worldMemory);
    expect(seedEvent).toMatchObject({
      id: 'world-event:world_data_seed:loc_seeded_gate:fact_seeded_gate_open',
      idempotencyKey: 'world_data_seed:loc_seeded_gate:fact_seeded_gate_open',
      type: 'world_state',
      sourceDomainEvent: 'world_data_seed',
      source: 'system',
      subjectIds: ['loc_seeded_gate', 'fact_seeded_gate_open'],
    });
    expect(worldMemory.getState().facts.fact_seeded_gate_open).toMatchObject({
      id: 'fact_seeded_gate_open',
      statement: 'The seeded gate is open.',
      scope: 'location',
      scopeId: 'loc_seeded_gate',
      truthStatus: 'confirmed',
      confidence: 0.95,
      sourceEventIds: [seedEvent.id],
      tags: ['gate', 'seeded'],
    });
    cleanup();
  });

  it('ecology.rumors_seeded inserts a rumor WorldFact with required confidence and seed provenance', () => {
    const { eventBus, stores, codexEntries, worldMemory } = makeHarness();
    codexEntries.set('loc_rumor_mill', {
      id: 'loc_rumor_mill',
      name: 'Rumor Mill',
      type: 'location',
      ecology: {
        rumors_seeded: [{
          id: 'rumor_hidden_cellar',
          statement: 'A hidden cellar lies beneath the old inn.',
          scope: 'location',
          scope_id: 'loc_rumor_mill',
          confidence: 0.42,
          spread: ['loc_rumor_mill'],
          tags: ['cellar'],
        }],
      },
    } as CodexEntry);

    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    const seedEvent = firstEvent(worldMemory);
    expect(seedEvent.idempotencyKey).toBe('world_data_seed:loc_rumor_mill:rumor_hidden_cellar');
    expect(worldMemory.getState().facts.rumor_hidden_cellar).toMatchObject({
      id: 'rumor_hidden_cellar',
      truthStatus: 'rumor',
      confidence: 0.42,
      sourceEventIds: [seedEvent.id],
      tags: ['cellar', 'spread:loc_rumor_mill'],
    });
    cleanup();
  });

  it('static seed idempotency uses world_data_seed entry and fact ids', () => {
    const { eventBus, stores, codexEntries, worldMemory } = makeHarness();
    codexEntries.set('loc_idempotent_seed', {
      id: 'loc_idempotent_seed',
      name: 'Idempotent Seed',
      type: 'location',
      ecology: {
        facts_seeded: [{
          id: 'fact_once',
          statement: 'This fact is seeded once.',
          scope: 'location',
          scope_id: 'loc_idempotent_seed',
          truth_status: 'confirmed',
          confidence: 1,
        }],
      },
    } as CodexEntry);

    const firstCleanup = initWorldEventRecorder(stores, eventBus, codexEntries);
    const secondCleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    expect(worldMemory.getState().events).toHaveLength(1);
    expect(worldMemory.getState().events[0]!.idempotencyKey).toBe('world_data_seed:loc_idempotent_seed:fact_once');
    expect(worldMemory.getState().processedIdempotencyKeys['world_data_seed:loc_idempotent_seed:fact_once']).toBe(
      'world-event:world_data_seed:loc_idempotent_seed:fact_once',
    );
    firstCleanup();
    secondCleanup();
  });

  it('multiple codex entries seeding the same fact id merge static fact provenance', () => {
    const { eventBus, stores, codexEntries, worldMemory } = makeHarness();
    codexEntries.set('loc_seed_origin', {
      id: 'loc_seed_origin',
      name: 'Seed Origin',
      type: 'location',
      ecology: {
        facts_seeded: [{
          id: 'fact_shared_seed',
          statement: 'The shared seed fact is known from the origin.',
          scope: 'global',
          truth_status: 'confirmed',
          confidence: 0.8,
          tags: ['origin'],
        }],
      },
    } as CodexEntry);
    codexEntries.set('npc_seed_witness', {
      id: 'npc_seed_witness',
      name: 'Seed Witness',
      type: 'npc',
      ecology: {
        facts_seeded: [{
          id: 'fact_shared_seed',
          statement: 'The shared seed fact is confirmed by the witness.',
          scope: 'global',
          truth_status: 'confirmed',
          confidence: 0.9,
          tags: ['witness'],
        }],
      },
    } as CodexEntry);

    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    const [firstSeedEvent, secondSeedEvent] = worldMemory.getState().events;
    expect(firstSeedEvent).toBeDefined();
    expect(secondSeedEvent).toBeDefined();
    expect(worldMemory.getState().facts.fact_shared_seed).toMatchObject({
      statement: 'The shared seed fact is confirmed by the witness.',
      sourceEventIds: [firstSeedEvent!.id, secondSeedEvent!.id],
      createdAt: firstSeedEvent!.timestamp,
      updatedAt: secondSeedEvent!.timestamp,
    });
    cleanup();
  });

  it('quest.world_effects.on_stage_enter creates facts rumors and beliefs with triggering quest-stage event provenance', () => {
    const { eventBus, stores, codexEntries, worldMemory } = makeHarness();
    codexEntries.set('quest_effects', {
      id: 'quest_effects',
      name: 'Effects Quest',
      type: 'quest',
      world_effects: {
        on_stage_enter: {
          stage_signal: {
            facts_created: [{
              id: 'fact_stage_signal_lit',
              statement: 'The signal fire has been lit.',
              scope: 'quest',
              scope_id: 'quest_effects',
              truth_status: 'confirmed',
              confidence: 1,
              tags: ['signal'],
            }],
            rumors_created: [{
              id: 'rumor_signal_seen',
              statement: 'People say the signal fire was seen from town.',
              scope: 'location',
              scope_id: 'loc_town',
              confidence: 0.6,
              spread: ['loc_town'],
            }],
            beliefs_created: [{
              holder_id: 'npc_watchman',
              holder_type: 'npc',
              subject_id: 'quest_effects',
              fact_id: 'fact_stage_signal_lit',
              stance: 'knows',
              statement: 'The watchman knows the signal fire has been lit.',
              confidence: 0.9,
              decay: 'slow',
              tags: ['signal'],
            }],
          },
        },
      },
    } as unknown as CodexEntry);
    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    eventBus.emit('quest_stage_advanced', { questId: 'quest_effects', newStageId: 'stage_signal', turnNumber: 30 });

    const questEvent = firstEvent(worldMemory);
    expect(questEvent).toMatchObject({
      id: 'world-event:quest_stage_advanced:quest_effects:stage_signal:30',
      sourceDomainEvent: 'quest_stage_advanced',
    });
    expect(worldMemory.getState().facts.fact_stage_signal_lit).toMatchObject({
      truthStatus: 'confirmed',
      sourceEventIds: [questEvent.id],
    });
    expect(worldMemory.getState().facts.rumor_signal_seen).toMatchObject({
      truthStatus: 'rumor',
      confidence: 0.6,
      sourceEventIds: [questEvent.id],
    });
    expect(worldMemory.getState().beliefs['belief:npc:npc_watchman:quest_effects:fact_stage_signal_lit']).toMatchObject({
      holderId: 'npc_watchman',
      factId: 'fact_stage_signal_lit',
      sourceEventIds: [questEvent.id],
      lastReinforcedTurn: 30,
    });
    cleanup();
  });

  it('repeated quest stage world-effect beliefs merge provenance and refresh reinforcement turn', () => {
    const { eventBus, stores, codexEntries, worldMemory } = makeHarness();
    codexEntries.set('quest_effects_repeat', {
      id: 'quest_effects_repeat',
      name: 'Repeating Effects Quest',
      type: 'quest',
      world_effects: {
        on_stage_enter: {
          stage_signal: {
            beliefs_created: [{
              holder_id: 'npc_watchman',
              holder_type: 'npc',
              subject_id: 'quest_effects_repeat',
              fact_id: 'fact_repeat_signal_lit',
              stance: 'knows',
              statement: 'The watchman knows the repeated signal has been lit.',
              confidence: 0.9,
              decay: 'slow',
              tags: ['signal', 'repeat'],
            }],
          },
        },
      },
    } as unknown as CodexEntry);
    const cleanup = initWorldEventRecorder(stores, eventBus, codexEntries);

    eventBus.emit('quest_stage_advanced', { questId: 'quest_effects_repeat', newStageId: 'stage_signal', turnNumber: 30 });
    eventBus.emit('quest_stage_advanced', { questId: 'quest_effects_repeat', newStageId: 'stage_signal', turnNumber: 31 });

    const [firstQuestEvent, secondQuestEvent] = worldMemory.getState().events;
    expect(firstQuestEvent).toBeDefined();
    expect(secondQuestEvent).toBeDefined();
    expect(worldMemory.getState().beliefs['belief:npc:npc_watchman:quest_effects_repeat:fact_repeat_signal_lit']).toMatchObject({
      sourceEventIds: [firstQuestEvent!.id, secondQuestEvent!.id],
      lastReinforcedTurn: 31,
    });
    cleanup();
  });
});
