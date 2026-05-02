import type { NpcBelief, WorldEvent, WorldFact, WorldMemoryState } from '../../state/world-memory-store';

export type EcologicalMemoryQuery = {
  readonly npcId?: string;
  readonly locationId?: string;
  readonly factionIds?: readonly string[];
  readonly questIds?: readonly string[];
  readonly playerKnowledge?: readonly string[];
  readonly playerAction?: string;
  readonly tags?: readonly string[];
  readonly maxEvents?: number;
  readonly maxFacts?: number;
  readonly maxBeliefs?: number;
};

export type EcologicalMemoryContext = {
  readonly events: readonly WorldEvent[];
  readonly facts: readonly WorldFact[];
  readonly beliefs: readonly NpcBelief[];
  readonly playerKnowledge: readonly string[];
  readonly omitted: readonly EcologicalMemoryOmission[];
};

export type EcologicalMemoryOmission = {
  readonly type: 'event' | 'fact' | 'belief';
  readonly id: string;
  readonly reason: string;
};

const importanceRank = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
} satisfies {
  readonly critical: number;
  readonly high: number;
  readonly medium: number;
  readonly low: number;
};

export function retrieveEcologicalMemory(
  state: WorldMemoryState,
  query: EcologicalMemoryQuery,
): EcologicalMemoryContext {
  const events = state.events.filter((event) => eventMatchesQuery(event, query)).sort(compareEvents);
  const facts = Object.values(state.facts).filter((fact) => factMatchesQuery(fact, query)).sort(compareFacts);
  const beliefs = Object.values(state.beliefs).filter((belief) => beliefMatchesQuery(belief, query)).sort(compareBeliefs);

  const cappedEvents = capEvents(events, query.maxEvents);
  const cappedFacts = capFacts(facts, query.maxFacts);
  const cappedBeliefs = capBeliefs(beliefs, query.maxBeliefs);

  return {
    events: cappedEvents.items.map(cloneEvent),
    facts: cappedFacts.items.map(cloneFact),
    beliefs: cappedBeliefs.items.map(cloneBelief),
    playerKnowledge: [...(query.playerKnowledge ?? [])],
    omitted: [...cappedEvents.omitted, ...cappedFacts.omitted, ...cappedBeliefs.omitted],
  };
}

function eventMatchesQuery(event: WorldEvent, query: EcologicalMemoryQuery): boolean {
  switch (event.visibility) {
    case 'public':
      return true;
    case 'private':
    case 'secret':
      return involvesNpc(event, query.npcId);
    case 'same_location':
      return isCurrentLocation(event.locationId, query.locationId) || involvesNpc(event, query.npcId);
    case 'faction':
      return intersects(event.factionIds, query.factionIds) || involvesNpc(event, query.npcId);
  }
}

function factMatchesQuery(fact: WorldFact, query: EcologicalMemoryQuery): boolean {
  if (intersects(fact.tags, query.tags)) return true;

  switch (fact.scope) {
    case 'global':
      return true;
    case 'location':
      return isCurrentLocation(fact.scopeId, query.locationId);
    case 'npc':
      return isSameId(fact.scopeId, query.npcId);
    case 'faction':
      return includesId(query.factionIds, fact.scopeId);
    case 'quest':
      return includesId(query.questIds, fact.scopeId);
    case 'player':
      return true;
  }
}

function beliefMatchesQuery(belief: NpcBelief, query: EcologicalMemoryQuery): boolean {
  if (belief.holderType === 'npc') return belief.holderId === query.npcId;
  if (belief.holderType === 'faction') return query.factionIds?.includes(belief.holderId) ?? false;
  return false;
}

function compareEvents(left: WorldEvent, right: WorldEvent): number {
  const importanceDifference = importanceRank[right.importance] - importanceRank[left.importance];
  if (importanceDifference !== 0) return importanceDifference;

  const turnDifference = right.turnNumber - left.turnNumber;
  if (turnDifference !== 0) return turnDifference;

  const timestampDifference = compareTimestampsDescending(left.timestamp, right.timestamp);
  if (timestampDifference !== 0) return timestampDifference;

  return left.id.localeCompare(right.id);
}

function compareFacts(left: WorldFact, right: WorldFact): number {
  const scopeDifference = factScopeRank(left) - factScopeRank(right);
  if (scopeDifference !== 0) return scopeDifference;

  const updatedDifference = compareTimestampsDescending(left.updatedAt, right.updatedAt);
  if (updatedDifference !== 0) return updatedDifference;

  return left.id.localeCompare(right.id);
}

function compareBeliefs(left: NpcBelief, right: NpcBelief): number {
  const turnDifference = right.lastReinforcedTurn - left.lastReinforcedTurn;
  if (turnDifference !== 0) return turnDifference;

  const confidenceDifference = right.confidence - left.confidence;
  if (confidenceDifference !== 0) return confidenceDifference;

  return left.id.localeCompare(right.id);
}

function factScopeRank(fact: WorldFact): number {
  switch (fact.scope) {
    case 'global':
      return 1;
    case 'location':
      return 2;
    case 'npc':
      return 3;
    case 'faction':
      return 4;
    case 'quest':
      return 5;
    case 'player':
      return 6;
  }
}

function compareTimestampsDescending(left: string, right: string): number {
  const leftTime = parseTimestamp(left);
  const rightTime = parseTimestamp(right);
  if (leftTime === rightTime) return 0;
  return rightTime > leftTime ? 1 : -1;
}

function parseTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function normalizeCap(cap: number | undefined): number | undefined {
  if (cap === undefined || cap < 0 || !Number.isFinite(cap)) return undefined;
  return Math.floor(cap);
}

function capEvents(
  items: readonly WorldEvent[],
  cap: number | undefined,
): { readonly items: readonly WorldEvent[]; readonly omitted: readonly EcologicalMemoryOmission[] } {
  const normalizedCap = normalizeCap(cap);
  if (normalizedCap === undefined || items.length <= normalizedCap) return { items, omitted: [] };
  return {
    items: items.slice(0, normalizedCap),
    omitted: items.slice(normalizedCap).map((item) => ({
      type: 'event',
      id: item.id,
      reason: `maxEvents cap ${normalizedCap} omitted this event`,
    })),
  };
}

function capFacts(
  items: readonly WorldFact[],
  cap: number | undefined,
): { readonly items: readonly WorldFact[]; readonly omitted: readonly EcologicalMemoryOmission[] } {
  const normalizedCap = normalizeCap(cap);
  if (normalizedCap === undefined || items.length <= normalizedCap) return { items, omitted: [] };
  return {
    items: items.slice(0, normalizedCap),
    omitted: items.slice(normalizedCap).map((item) => ({
      type: 'fact',
      id: item.id,
      reason: `maxFacts cap ${normalizedCap} omitted this fact`,
    })),
  };
}

function capBeliefs(
  items: readonly NpcBelief[],
  cap: number | undefined,
): { readonly items: readonly NpcBelief[]; readonly omitted: readonly EcologicalMemoryOmission[] } {
  const normalizedCap = normalizeCap(cap);
  if (normalizedCap === undefined || items.length <= normalizedCap) return { items, omitted: [] };
  return {
    items: items.slice(0, normalizedCap),
    omitted: items.slice(normalizedCap).map((item) => ({
      type: 'belief',
      id: item.id,
      reason: `maxBeliefs cap ${normalizedCap} omitted this belief`,
    })),
  };
}

function cloneEvent(event: WorldEvent): WorldEvent {
  return {
    ...event,
    actorIds: [...event.actorIds],
    subjectIds: [...event.subjectIds],
    factionIds: [...event.factionIds],
    tags: [...event.tags],
    rawPayload: event.rawPayload === undefined ? undefined : cloneRecord(event.rawPayload),
  };
}

function cloneFact(fact: WorldFact): WorldFact {
  return {
    ...fact,
    sourceEventIds: [...fact.sourceEventIds],
    tags: [...fact.tags],
  };
}

function cloneBelief(belief: NpcBelief): NpcBelief {
  return {
    ...belief,
    sourceEventIds: [...belief.sourceEventIds],
    tags: [...belief.tags],
  };
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneUnknown(entry)]));
}

function cloneUnknown(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneUnknown);
  if (isPlainRecord(value)) return cloneRecord(value);
  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function involvesNpc(event: WorldEvent, npcId: string | undefined): boolean {
  if (!npcId) return false;
  return event.actorIds.includes(npcId) || event.subjectIds.includes(npcId);
}

function isCurrentLocation(candidateId: string | null, locationId: string | undefined): boolean {
  return candidateId !== null && candidateId === locationId;
}

function isSameId(candidateId: string | null, id: string | undefined): boolean {
  return candidateId !== null && candidateId === id;
}

function includesId(ids: readonly string[] | undefined, candidateId: string | null): boolean {
  return candidateId !== null && (ids?.includes(candidateId) ?? false);
}

function intersects(left: readonly string[], right: readonly string[] | undefined): boolean {
  if (!right || right.length === 0) return false;
  return left.some((value) => right.includes(value));
}
