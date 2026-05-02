import { describe, expect, it } from 'bun:test';
import mitt from 'mitt';
import type { EventBus } from '../events/event-bus';
import {
  appendWorldEvent,
  createWorldMemoryStore,
  getDefaultWorldMemoryState,
  upsertNpcBelief,
  upsertWorldFact,
  type NpcBelief,
  type WorldEvent,
  type WorldFact,
} from './world-memory-store';

function makeStore() {
  return createWorldMemoryStore(mitt() as unknown as EventBus);
}

function makeEvent(id: string, idempotencyKey: string): WorldEvent {
  return {
    id,
    idempotencyKey,
    turnNumber: 1,
    timestamp: '2026-05-02T00:00:00.000Z',
    type: 'quest',
    actorIds: ['player'],
    subjectIds: [],
    locationId: 'loc_town',
    factionIds: [],
    summary: `event ${id}`,
    rawPayload: { id },
    sourceDomainEvent: 'test',
    visibility: 'public',
    importance: 'medium',
    tags: [],
    source: 'system',
  };
}

function makeFact(id: string): WorldFact {
  return {
    id,
    statement: `fact ${id}`,
    scope: 'global',
    scopeId: null,
    truthStatus: 'confirmed',
    confidence: 1,
    sourceEventIds: ['event-1'],
    tags: [],
    createdAt: '2026-05-02T00:00:00.000Z',
    updatedAt: '2026-05-02T00:00:00.000Z',
  };
}

function makeBelief(id: string): NpcBelief {
  return {
    id,
    holderId: 'npc-1',
    holderType: 'npc',
    subjectId: null,
    factId: null,
    statement: `belief ${id}`,
    stance: 'believes',
    confidence: 1,
    sourceEventIds: ['event-1'],
    lastReinforcedTurn: 1,
    decay: 'normal',
    tags: [],
  };
}

describe('world-memory-store', () => {
  it('default state is empty and JSON-serializable', () => {
    const state = getDefaultWorldMemoryState();

    expect(state).toEqual({
      events: [],
      facts: {},
      beliefs: {},
      processedIdempotencyKeys: {},
    });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('appendWorldEvent preserves event order and records idempotency key', () => {
    const store = makeStore();

    const firstAppendResult = appendWorldEvent(store, makeEvent('event-1', 'key-1'));
    const secondAppendResult = appendWorldEvent(store, makeEvent('event-2', 'key-2'));

    expect(firstAppendResult).toBe(true);
    expect(secondAppendResult).toBe(true);
    expect(store.getState().events.map((event) => event.id)).toEqual(['event-1', 'event-2']);
    expect(store.getState().processedIdempotencyKeys).toEqual({
      'key-1': 'event-1',
      'key-2': 'event-2',
    });
  });

  it('appendWorldEvent ignores duplicate idempotency keys', () => {
    const store = makeStore();

    const firstAppendResult = appendWorldEvent(store, makeEvent('event-1', 'same-key'));
    const duplicateAppendResult = appendWorldEvent(store, makeEvent('event-2', 'same-key'));

    expect(firstAppendResult).toBe(true);
    expect(duplicateAppendResult).toBe(false);
    expect(store.getState().events).toHaveLength(1);
    expect(store.getState().events[0]!.id).toBe('event-1');
    expect(store.getState().processedIdempotencyKeys).toEqual({ 'same-key': 'event-1' });
  });

  it("appendWorldEvent appends an event whose idempotency key matches an inherited property name", () => {
    const store = makeStore();

    const appendResult = appendWorldEvent(store, makeEvent('event-1', 'constructor'));

    expect(appendResult).toBe(true);
    expect(store.getState().events).toHaveLength(1);
    expect(store.getState().events[0]!.id).toBe('event-1');
    expect(store.getState().processedIdempotencyKeys).toEqual({ constructor: 'event-1' });
  });

  it('upsertWorldFact rejects unsafe fact ids', () => {
    const store = makeStore();

    expect(() => upsertWorldFact(store, makeFact('__proto__'))).toThrow(
      'Unsafe world fact id: __proto__',
    );
    expect(store.getState().facts).toEqual({});
  });

  it('upsertNpcBelief rejects unsafe belief ids', () => {
    const store = makeStore();

    expect(() => upsertNpcBelief(store, makeBelief('constructor'))).toThrow(
      'Unsafe NPC belief id: constructor',
    );
    expect(() => upsertNpcBelief(store, makeBelief('__proto__'))).toThrow(
      'Unsafe NPC belief id: __proto__',
    );
    expect(store.getState().beliefs).toEqual({});
  });
});
