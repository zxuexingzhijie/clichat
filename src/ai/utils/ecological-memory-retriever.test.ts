import { describe, expect, it } from 'bun:test';
import type { NpcBelief, WorldEvent, WorldFact, WorldMemoryState } from '../../state/world-memory-store';
import { retrieveEcologicalMemory } from './ecological-memory-retriever';

type EventOverrides = {
  id: WorldEvent['id'];
  idempotencyKey?: WorldEvent['idempotencyKey'];
  turnNumber?: WorldEvent['turnNumber'];
  timestamp?: WorldEvent['timestamp'];
  type?: WorldEvent['type'];
  actorIds?: WorldEvent['actorIds'];
  subjectIds?: WorldEvent['subjectIds'];
  locationId?: WorldEvent['locationId'];
  factionIds?: WorldEvent['factionIds'];
  summary?: WorldEvent['summary'];
  rawText?: WorldEvent['rawText'];
  rawPayload?: WorldEvent['rawPayload'];
  sourceDomainEvent?: WorldEvent['sourceDomainEvent'];
  visibility?: WorldEvent['visibility'];
  importance?: WorldEvent['importance'];
  tags?: WorldEvent['tags'];
  source?: WorldEvent['source'];
};

type FactOverrides = {
  id: WorldFact['id'];
  statement?: WorldFact['statement'];
  scope?: WorldFact['scope'];
  scopeId?: WorldFact['scopeId'];
  truthStatus?: WorldFact['truthStatus'];
  confidence?: WorldFact['confidence'];
  sourceEventIds?: WorldFact['sourceEventIds'];
  tags?: WorldFact['tags'];
  createdAt?: WorldFact['createdAt'];
  updatedAt?: WorldFact['updatedAt'];
};

type BeliefOverrides = {
  id: NpcBelief['id'];
  holderId: NpcBelief['holderId'];
  holderType?: NpcBelief['holderType'];
  subjectId?: NpcBelief['subjectId'];
  factId?: NpcBelief['factId'];
  statement?: NpcBelief['statement'];
  stance?: NpcBelief['stance'];
  confidence?: NpcBelief['confidence'];
  sourceEventIds?: NpcBelief['sourceEventIds'];
  lastReinforcedTurn?: NpcBelief['lastReinforcedTurn'];
  decay?: NpcBelief['decay'];
  tags?: NpcBelief['tags'];
};

function makeEvent(overrides: EventOverrides): WorldEvent {
  return {
    id: overrides.id,
    idempotencyKey: overrides.idempotencyKey ?? `key-${overrides.id}`,
    turnNumber: overrides.turnNumber ?? 1,
    timestamp: overrides.timestamp ?? '2026-05-02T00:00:00.000Z',
    type: overrides.type ?? 'quest',
    actorIds: overrides.actorIds ?? ['player'],
    subjectIds: overrides.subjectIds ?? [],
    locationId: overrides.locationId ?? null,
    factionIds: overrides.factionIds ?? [],
    summary: overrides.summary ?? `event ${overrides.id}`,
    rawText: overrides.rawText,
    rawPayload: overrides.rawPayload,
    sourceDomainEvent: overrides.sourceDomainEvent,
    visibility: overrides.visibility ?? 'public',
    importance: overrides.importance ?? 'medium',
    tags: overrides.tags ?? [],
    source: overrides.source ?? 'system',
  };
}

function makeFact(overrides: FactOverrides): WorldFact {
  return {
    id: overrides.id,
    statement: overrides.statement ?? `fact ${overrides.id}`,
    scope: overrides.scope ?? 'global',
    scopeId: overrides.scopeId ?? null,
    truthStatus: overrides.truthStatus ?? 'confirmed',
    confidence: overrides.confidence ?? 1,
    sourceEventIds: overrides.sourceEventIds ?? [],
    tags: overrides.tags ?? [],
    createdAt: overrides.createdAt ?? '2026-05-02T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-05-02T00:00:00.000Z',
  };
}

function makeBelief(overrides: BeliefOverrides): NpcBelief {
  return {
    id: overrides.id,
    holderId: overrides.holderId,
    holderType: overrides.holderType ?? 'npc',
    subjectId: overrides.subjectId ?? null,
    factId: overrides.factId ?? null,
    statement: overrides.statement ?? `belief ${overrides.id}`,
    stance: overrides.stance ?? 'believes',
    confidence: overrides.confidence ?? 1,
    sourceEventIds: overrides.sourceEventIds ?? [],
    lastReinforcedTurn: overrides.lastReinforcedTurn ?? 1,
    decay: overrides.decay ?? 'normal',
    tags: overrides.tags ?? [],
  };
}

function makeState(overrides: {
  events?: WorldMemoryState['events'];
  facts?: WorldMemoryState['facts'];
  beliefs?: WorldMemoryState['beliefs'];
  processedIdempotencyKeys?: WorldMemoryState['processedIdempotencyKeys'];
}): WorldMemoryState {
  return {
    events: overrides.events ?? [],
    facts: overrides.facts ?? {},
    beliefs: overrides.beliefs ?? {},
    processedIdempotencyKeys: overrides.processedIdempotencyKeys ?? {},
  };
}

describe('ecological-memory-retriever', () => {
  it('active NPC receives own beliefs and not another NPC private belief', () => {
    const guardBelief = makeBelief({ id: 'belief-guard-secret', holderId: 'npc_guard' });
    const bartenderBelief = makeBelief({ id: 'belief-bartender-secret', holderId: 'npc_bartender' });
    const state = makeState({
      beliefs: {
        [guardBelief.id]: guardBelief,
        [bartenderBelief.id]: bartenderBelief,
      },
    });

    const context = retrieveEcologicalMemory(state, { npcId: 'npc_guard' });

    expect(context.beliefs.map((belief) => belief.id)).toEqual(['belief-guard-secret']);
  });

  it('includes location-scoped facts for current location', () => {
    const gateFact = makeFact({ id: 'fact-gate-rumor', scope: 'location', scopeId: 'loc_gate' });
    const tavernFact = makeFact({ id: 'fact-tavern-rumor', scope: 'location', scopeId: 'loc_tavern' });
    const globalFact = makeFact({ id: 'fact-global', scope: 'global', scopeId: null });
    const state = makeState({
      facts: {
        [gateFact.id]: gateFact,
        [tavernFact.id]: tavernFact,
        [globalFact.id]: globalFact,
      },
    });

    const context = retrieveEcologicalMemory(state, { locationId: 'loc_gate' });

    expect(context.facts.map((fact) => fact.id)).toEqual(['fact-global', 'fact-gate-rumor']);
  });

  it('includes public recent events and orders critical events before lower-importance events', () => {
    const publicEvent = makeEvent({ id: 'event-public-recent', visibility: 'public', turnNumber: 12, importance: 'medium' });
    const privateOtherLocation = makeEvent({
      id: 'event-private-other-location',
      visibility: 'private',
      locationId: 'loc_tavern',
      actorIds: ['npc_bartender'],
      turnNumber: 13,
      importance: 'low',
    });
    const criticalLocalEvent = makeEvent({
      id: 'event-critical-local',
      visibility: 'same_location',
      locationId: 'loc_gate',
      turnNumber: 10,
      importance: 'critical',
    });
    const state = makeState({ events: [publicEvent, privateOtherLocation, criticalLocalEvent] });

    const context = retrieveEcologicalMemory(state, { locationId: 'loc_gate' });

    expect(context.events.map((event) => event.id)).toEqual(['event-critical-local', 'event-public-recent']);
  });

  it('includes private events when the active NPC is involved', () => {
    const guardPrivateEvent = makeEvent({
      id: 'event-guard-private-dialogue',
      visibility: 'private',
      actorIds: ['npc_guard'],
      subjectIds: ['player'],
      locationId: 'loc_north_gate',
      tags: ['loc_north_gate'],
    });
    const state = makeState({ events: [guardPrivateEvent] });

    const context = retrieveEcologicalMemory(state, { npcId: 'npc_guard' });

    expect(context.events.map((event) => event.id)).toEqual(['event-guard-private-dialogue']);
  });

  it('excludes private events for unrelated NPCs even when location and tags match', () => {
    const guardPrivateEvent = makeEvent({
      id: 'event-guard-private-dialogue',
      visibility: 'private',
      actorIds: ['npc_guard'],
      subjectIds: ['player'],
      locationId: 'loc_north_gate',
      tags: ['loc_north_gate'],
    });
    const state = makeState({ events: [guardPrivateEvent] });

    const context = retrieveEcologicalMemory(state, {
      npcId: 'npc_bartender',
      locationId: 'loc_north_gate',
      tags: ['loc_north_gate'],
    });

    expect(context.events.map((event) => event.id)).toEqual([]);
  });

  it('includes same-location events at the current location for bystanders', () => {
    const gateEvent = makeEvent({
      id: 'event-gate-bystander-visible',
      visibility: 'same_location',
      actorIds: ['npc_guard'],
      locationId: 'loc_north_gate',
    });
    const state = makeState({ events: [gateEvent] });

    const context = retrieveEcologicalMemory(state, { npcId: 'npc_bartender', locationId: 'loc_north_gate' });

    expect(context.events.map((event) => event.id)).toEqual(['event-gate-bystander-visible']);
  });

  it('includes public events for unrelated NPCs', () => {
    const publicEvent = makeEvent({
      id: 'event-public-announcement',
      visibility: 'public',
      actorIds: ['npc_guard'],
      locationId: 'loc_north_gate',
    });
    const state = makeState({ events: [publicEvent] });

    const context = retrieveEcologicalMemory(state, { npcId: 'npc_bartender' });

    expect(context.events.map((event) => event.id)).toEqual(['event-public-announcement']);
  });

  it('keeps player knowledge as a separate field', () => {
    const playerFact = makeFact({ id: 'fact-player', scope: 'player', statement: 'The player knows the miner is missing.' });
    const guardBelief = makeBelief({ id: 'belief-guard', holderId: 'npc_guard', statement: 'The guard suspects the player.' });
    const state = makeState({
      facts: { [playerFact.id]: playerFact },
      beliefs: { [guardBelief.id]: guardBelief },
    });

    const context = retrieveEcologicalMemory(state, {
      npcId: 'npc_guard',
      playerKnowledge: ['Player read the missing miner notice.'],
    });

    expect(context.playerKnowledge).toEqual(['Player read the missing miner notice.']);
    expect(context.facts.map((fact) => fact.id)).toEqual(['fact-player']);
    expect(context.beliefs.map((belief) => belief.id)).toEqual(['belief-guard']);
  });

  it('includes omitted metadata when caps omit entries', () => {
    const state = makeState({
      events: [
        makeEvent({ id: 'event-critical', visibility: 'public', importance: 'critical', turnNumber: 1 }),
        makeEvent({ id: 'event-omitted', visibility: 'public', importance: 'medium', turnNumber: 2 }),
      ],
      facts: {
        'fact-global': makeFact({ id: 'fact-global', scope: 'global' }),
        'fact-location': makeFact({ id: 'fact-location', scope: 'location', scopeId: 'loc_gate' }),
      },
      beliefs: {
        'belief-new': makeBelief({ id: 'belief-new', holderId: 'npc_guard', lastReinforcedTurn: 3 }),
        'belief-old': makeBelief({ id: 'belief-old', holderId: 'npc_guard', lastReinforcedTurn: 1 }),
      },
    });

    const context = retrieveEcologicalMemory(state, {
      npcId: 'npc_guard',
      locationId: 'loc_gate',
      maxEvents: 1,
      maxFacts: 1,
      maxBeliefs: 1,
    });

    expect(context.events.map((event) => event.id)).toEqual(['event-critical']);
    expect(context.facts.map((fact) => fact.id)).toEqual(['fact-global']);
    expect(context.beliefs.map((belief) => belief.id)).toEqual(['belief-new']);
    expect(context.omitted).toEqual([
      { type: 'event', id: 'event-omitted', reason: 'maxEvents cap 1 omitted this event' },
      { type: 'fact', id: 'fact-location', reason: 'maxFacts cap 1 omitted this fact' },
      { type: 'belief', id: 'belief-old', reason: 'maxBeliefs cap 1 omitted this belief' },
    ]);
  });

  it('does not let returned context mutations mutate original state', () => {
    const event = makeEvent({
      id: 'event-public',
      visibility: 'public',
      actorIds: ['npc_guard'],
      subjectIds: ['player'],
      factionIds: ['faction_watch'],
      tags: ['rumor'],
      rawPayload: { nested: { count: 1 }, list: ['before'] },
    });
    const fact = makeFact({
      id: 'fact-global',
      scope: 'global',
      sourceEventIds: ['event-public'],
      tags: ['rumor'],
    });
    const belief = makeBelief({
      id: 'belief-guard',
      holderId: 'npc_guard',
      sourceEventIds: ['event-public'],
      tags: ['rumor'],
    });
    const state = makeState({
      events: [event],
      facts: { [fact.id]: fact },
      beliefs: { [belief.id]: belief },
    });

    const context = retrieveEcologicalMemory(state, { npcId: 'npc_guard' });
    const returnedEvent = context.events[0] as WorldEvent & { rawPayload: { nested: { count: number }; list: string[] } };
    const returnedFact = context.facts[0] as WorldFact;
    const returnedBelief = context.beliefs[0] as NpcBelief;

    returnedEvent.actorIds.push('npc_thief');
    returnedEvent.subjectIds.push('npc_mayor');
    returnedEvent.factionIds.push('faction_thieves');
    returnedEvent.tags.push('changed');
    returnedEvent.rawPayload.nested.count = 2;
    returnedEvent.rawPayload.list.push('after');
    returnedFact.sourceEventIds.push('event-other');
    returnedFact.tags.push('changed');
    returnedBelief.sourceEventIds.push('event-other');
    returnedBelief.tags.push('changed');

    expect(state.events[0].actorIds).toEqual(['npc_guard']);
    expect(state.events[0].subjectIds).toEqual(['player']);
    expect(state.events[0].factionIds).toEqual(['faction_watch']);
    expect(state.events[0].tags).toEqual(['rumor']);
    expect(state.events[0].rawPayload).toEqual({ nested: { count: 1 }, list: ['before'] });
    expect(state.facts[fact.id].sourceEventIds).toEqual(['event-public']);
    expect(state.facts[fact.id].tags).toEqual(['rumor']);
    expect(state.beliefs[belief.id].sourceEventIds).toEqual(['event-public']);
    expect(state.beliefs[belief.id].tags).toEqual(['rumor']);
  });

  it('normalizes event caps with zero, negative, NaN, and fractional values', () => {
    const state = makeState({
      events: [
        makeEvent({ id: 'event-3', visibility: 'public', turnNumber: 3 }),
        makeEvent({ id: 'event-2', visibility: 'public', turnNumber: 2 }),
        makeEvent({ id: 'event-1', visibility: 'public', turnNumber: 1 }),
      ],
    });

    expect(retrieveEcologicalMemory(state, { maxEvents: 0 }).events).toEqual([]);
    expect(retrieveEcologicalMemory(state, { maxEvents: -1 }).events.map((event) => event.id)).toEqual([
      'event-3',
      'event-2',
      'event-1',
    ]);
    expect(retrieveEcologicalMemory(state, { maxEvents: Number.NaN }).events.map((event) => event.id)).toEqual([
      'event-3',
      'event-2',
      'event-1',
    ]);

    const fractionalContext = retrieveEcologicalMemory(state, { maxEvents: 1.8 });

    expect(fractionalContext.events.map((event) => event.id)).toEqual(['event-3']);
    expect(fractionalContext.omitted).toEqual([
      { type: 'event', id: 'event-2', reason: 'maxEvents cap 1 omitted this event' },
      { type: 'event', id: 'event-1', reason: 'maxEvents cap 1 omitted this event' },
    ]);
  });

  it('sorts invalid timestamps deterministically after valid timestamps', () => {
    const state = makeState({
      events: [
        makeEvent({ id: 'aaa-invalid-event', visibility: 'public', turnNumber: 1, timestamp: 'not-a-date' }),
        makeEvent({ id: 'zzz-valid-event', visibility: 'public', turnNumber: 1, timestamp: '2026-05-02T00:00:00.000Z' }),
      ],
      facts: {
        'aaa-invalid-fact': makeFact({ id: 'aaa-invalid-fact', scope: 'global', updatedAt: 'not-a-date' }),
        'zzz-valid-fact': makeFact({ id: 'zzz-valid-fact', scope: 'global', updatedAt: '2026-05-02T00:00:00.000Z' }),
      },
    });

    const context = retrieveEcologicalMemory(state, {});

    expect(context.events.map((event) => event.id)).toEqual(['zzz-valid-event', 'aaa-invalid-event']);
    expect(context.facts.map((fact) => fact.id)).toEqual(['zzz-valid-fact', 'aaa-invalid-fact']);
  });

  it('includes public events and facts matching requested tags', () => {
    const taggedPublicEvent = makeEvent({
      id: 'event-tagged-public',
      visibility: 'public',
      tags: ['ancient-ruins'],
    });
    const untaggedPrivateEvent = makeEvent({ id: 'event-untagged-private', visibility: 'private' });
    const taggedFact = makeFact({
      id: 'fact-tagged-location',
      scope: 'location',
      scopeId: 'loc_elsewhere',
      tags: ['ancient-ruins'],
    });
    const untaggedFact = makeFact({ id: 'fact-untagged-location', scope: 'location', scopeId: 'loc_elsewhere' });
    const state = makeState({
      events: [taggedPublicEvent, untaggedPrivateEvent],
      facts: {
        [taggedFact.id]: taggedFact,
        [untaggedFact.id]: untaggedFact,
      },
    });

    const context = retrieveEcologicalMemory(state, { tags: ['ancient-ruins'] });

    expect(context.events.map((event) => event.id)).toEqual(['event-tagged-public']);
    expect(context.facts.map((fact) => fact.id)).toEqual(['fact-tagged-location']);
  });

  it('includes quest-scoped facts for requested quest ids', () => {
    const questFact = makeFact({ id: 'fact-quest-main', scope: 'quest', scopeId: 'quest_main' });
    const otherQuestFact = makeFact({ id: 'fact-quest-side', scope: 'quest', scopeId: 'quest_side' });
    const state = makeState({
      facts: {
        [questFact.id]: questFact,
        [otherQuestFact.id]: otherQuestFact,
      },
    });

    const context = retrieveEcologicalMemory(state, { questIds: ['quest_main'] });

    expect(context.facts.map((fact) => fact.id)).toEqual(['fact-quest-main']);
  });

  it('includes faction-held beliefs for requested faction ids', () => {
    const watchBelief = makeBelief({ id: 'belief-watch', holderId: 'faction_watch', holderType: 'faction' });
    const thievesBelief = makeBelief({ id: 'belief-thieves', holderId: 'faction_thieves', holderType: 'faction' });
    const state = makeState({
      beliefs: {
        [watchBelief.id]: watchBelief,
        [thievesBelief.id]: thievesBelief,
      },
    });

    const context = retrieveEcologicalMemory(state, { factionIds: ['faction_watch'] });

    expect(context.beliefs.map((belief) => belief.id)).toEqual(['belief-watch']);
  });
});
