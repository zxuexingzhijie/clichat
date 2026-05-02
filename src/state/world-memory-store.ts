import { z } from 'zod';
import { createStore } from './create-store';
import type { EventBus } from '../events/event-bus';

export const WorldEventSchema = z.object({
  id: z.string(),
  idempotencyKey: z.string(),
  turnNumber: z.number().int(),
  timestamp: z.string(),
  type: z.enum([
    'dialogue',
    'movement',
    'combat',
    'quest',
    'discovery',
    'item',
    'reputation',
    'world_state',
  ]),
  actorIds: z.array(z.string()),
  subjectIds: z.array(z.string()).default([]),
  locationId: z.string().nullable(),
  factionIds: z.array(z.string()).default([]),
  summary: z.string(),
  rawText: z.string().optional(),
  rawPayload: z.record(z.string(), z.unknown()).optional(),
  sourceDomainEvent: z.string().optional(),
  visibility: z.enum(['private', 'same_location', 'faction', 'public', 'secret']),
  importance: z.enum(['low', 'medium', 'high', 'critical']),
  tags: z.array(z.string()).default([]),
  source: z.enum(['player_action', 'npc_dialogue', 'rules_engine', 'quest_system', 'scene_manager', 'system']),
});

export type WorldEvent = z.infer<typeof WorldEventSchema>;

export const WorldFactSchema = z.object({
  id: z.string(),
  statement: z.string(),
  scope: z.enum(['global', 'location', 'faction', 'npc', 'quest', 'player']),
  scopeId: z.string().nullable(),
  truthStatus: z.enum(['confirmed', 'rumor', 'contested', 'false', 'unknown']),
  confidence: z.number().min(0).max(1),
  sourceEventIds: z.array(z.string()),
  tags: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WorldFact = z.infer<typeof WorldFactSchema>;

export const NpcBeliefSchema = z.object({
  id: z.string(),
  holderId: z.string(),
  holderType: z.enum(['npc', 'faction']),
  subjectId: z.string().nullable(),
  factId: z.string().nullable(),
  statement: z.string(),
  stance: z.enum(['believes', 'doubts', 'denies', 'fears', 'wants', 'knows']),
  confidence: z.number().min(0).max(1),
  sourceEventIds: z.array(z.string()),
  lastReinforcedTurn: z.number().int(),
  decay: z.enum(['none', 'slow', 'normal', 'fast']).default('normal'),
  tags: z.array(z.string()).default([]),
});

export type NpcBelief = z.infer<typeof NpcBeliefSchema>;

export const WorldMemoryStateSchema = z.object({
  events: z.array(WorldEventSchema).default([]),
  facts: z.record(z.string(), WorldFactSchema).default({}),
  beliefs: z.record(z.string(), NpcBeliefSchema).default({}),
  processedIdempotencyKeys: z.record(z.string(), z.string()).default({}),
});

export type WorldMemoryState = z.infer<typeof WorldMemoryStateSchema>;

type WorldMemoryStore = {
  getState: () => WorldMemoryState;
  setState: (recipe: (draft: WorldMemoryState) => void) => void;
  subscribe: (listener: () => void) => () => void;
};

export function getDefaultWorldMemoryState(): WorldMemoryState {
  return { events: [], facts: {}, beliefs: {}, processedIdempotencyKeys: {} };
}

export function createWorldMemoryStore(_bus: EventBus): WorldMemoryStore {
  return createStore(getDefaultWorldMemoryState());
}

const unsafeRecordKeys = new Set(['__proto__', 'prototype', 'constructor']);

function assertSafeRecordKey(label: string, key: string, options?: { allowConstructor?: boolean }): void {
  if (key === 'constructor' && options?.allowConstructor) return;
  if (unsafeRecordKeys.has(key)) throw new Error(`Unsafe ${label}: ${key}`);
}

export function appendWorldEvent(store: WorldMemoryStore, event: WorldEvent): boolean {
  const parsed = WorldEventSchema.parse(event);
  assertSafeRecordKey('idempotency key', parsed.idempotencyKey, { allowConstructor: true });
  if (Object.prototype.hasOwnProperty.call(store.getState().processedIdempotencyKeys, parsed.idempotencyKey)) {
    return false;
  }

  store.setState((draft) => {
    draft.events = [...draft.events, parsed];
    draft.processedIdempotencyKeys[parsed.idempotencyKey] = parsed.id;
  });

  return true;
}

export function upsertWorldFact(store: WorldMemoryStore, fact: WorldFact): void {
  const parsed = WorldFactSchema.parse(fact);
  assertSafeRecordKey('world fact id', parsed.id);
  store.setState((draft) => {
    draft.facts[parsed.id] = parsed;
  });
}

export function upsertNpcBelief(store: WorldMemoryStore, belief: NpcBelief): void {
  const parsed = NpcBeliefSchema.parse(belief);
  assertSafeRecordKey('NPC belief id', parsed.id);
  store.setState((draft) => {
    draft.beliefs[parsed.id] = parsed;
  });
}
