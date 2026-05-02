# Ecological World Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-pass ecological world memory layer that records world events, derives facts and NPC/faction beliefs, persists them in SaveDataV7, and makes them available to dialogue/narrative context without deleting raw history.

**Architecture:** Introduce `WorldMemoryStore` as a JSON/Zod/store-based source for `WorldEvent`, `WorldFact`, `NpcBelief`, and idempotency keys. Add a recorder that listens to existing `EventBus` domain events where payloads are sufficient, records dialogue events at the source before state reset, and provides a retriever that prompt-building code can consume. Keep no-loss context as a foundation: raw events are append-only; summaries/facts/beliefs are derived.

**Tech Stack:** TypeScript, Bun test runner, Zod, existing custom store pattern, mitt-based `EventBus`, Ink UI, existing serializer/migration chain.

---

## File Structure

- Create `src/state/world-memory-store.ts`: schemas, default state, store factory, append/update helpers for events, facts, beliefs, and idempotency index.
- Create `src/engine/world-memory-recorder.ts`: records idempotent `WorldEvent`s, maps domain events to world events, applies first-pass deterministic fact/belief updates, and returns cleanup for listeners.
- Create `src/ai/utils/ecological-memory-retriever.ts`: retrieves relevant events/facts/beliefs for an NPC/location/action context and returns a typed context package.
- Modify `src/context/game-context.ts`: add `worldMemory` to `GameStores` and instantiate `createWorldMemoryStore(eventBus)`.
- Modify `src/app.tsx`: initialize `initWorldEventRecorder` after codex entries are available; cleanup on unmount/reload.
- Modify `src/state/serializer.ts`: add `SaveDataV7Schema`, `SaveDataV7`, `worldMemory` snapshot/restore support.
- Modify `src/persistence/save-migrator.ts`: add `migrateV6ToV7`, update `migrateToLatest` return type.
- Modify `src/engine/branch-diff.ts`: accept `SaveDataV7`; do not display world-memory diffs in first version.
- Modify `src/events/event-types.ts`: extend `dialogue_ended` payload or introduce a richer dialogue event only if using EventBus path; this plan chooses source-level `recordWorldEvent` in `dialogue-manager` first to avoid lossy payload.
- Modify `src/engine/dialogue-manager.ts`: record full dialogue world events before resetting dialogue state; retrieve ecological memory before NPC generation.
- Modify `src/ai/prompts/npc-system.ts` and/or `src/ai/roles/npc-actor.ts`: format ecological memory with explicit epistemic labels.
- Add/update tests next to touched modules.

## Task 1: Create WorldMemoryStore

**Files:**
- Create: `src/state/world-memory-store.ts`
- Test: `src/state/world-memory-store.test.ts`

- [ ] **Step 1: Write failing schema/default-state tests**

Create `src/state/world-memory-store.test.ts` with tests for default empty state, event append order, and duplicate idempotency prevention.

```ts
import { describe, expect, it } from 'bun:test';
import { createWorldMemoryStore, getDefaultWorldMemoryState, appendWorldEvent, type WorldEvent } from './world-memory-store';
import mitt from 'mitt';
import type { DomainEvents } from '../events/event-types';

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

describe('world-memory-store', () => {
  it('default state is empty and JSON-serializable', () => {
    const state = getDefaultWorldMemoryState();
    expect(state).toEqual({ events: [], facts: {}, beliefs: {}, processedIdempotencyKeys: {} });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('appendWorldEvent preserves order and records idempotency key', () => {
    const store = createWorldMemoryStore(mitt<DomainEvents>());
    appendWorldEvent(store, makeEvent('event-1', 'key-1'));
    appendWorldEvent(store, makeEvent('event-2', 'key-2'));
    expect(store.getState().events.map((event) => event.id)).toEqual(['event-1', 'event-2']);
    expect(store.getState().processedIdempotencyKeys['key-1']).toBe('event-1');
  });

  it('appendWorldEvent ignores duplicate idempotency keys', () => {
    const store = createWorldMemoryStore(mitt<DomainEvents>());
    appendWorldEvent(store, makeEvent('event-1', 'same-key'));
    appendWorldEvent(store, makeEvent('event-2', 'same-key'));
    expect(store.getState().events).toHaveLength(1);
    expect(store.getState().events[0]!.id).toBe('event-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/state/world-memory-store.test.ts`

Expected: FAIL because `world-memory-store.ts` does not exist.

- [ ] **Step 3: Implement schemas and store helpers**

Create `src/state/world-memory-store.ts`:

```ts
import { z } from 'zod';
import { createStore, type Store } from './create-store';
import type { EventBus } from '../events/event-bus';

export const WorldEventSchema = z.object({
  id: z.string(),
  idempotencyKey: z.string(),
  turnNumber: z.number().int(),
  timestamp: z.string(),
  type: z.enum(['dialogue', 'movement', 'combat', 'quest', 'discovery', 'item', 'reputation', 'world_state']),
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

export function getDefaultWorldMemoryState(): WorldMemoryState {
  return { events: [], facts: {}, beliefs: {}, processedIdempotencyKeys: {} };
}

export function createWorldMemoryStore(_bus: EventBus): Store<WorldMemoryState> {
  return createStore<WorldMemoryState>(getDefaultWorldMemoryState());
}

export function appendWorldEvent(store: Store<WorldMemoryState>, event: WorldEvent): boolean {
  const parsed = WorldEventSchema.parse(event);
  if (store.getState().processedIdempotencyKeys[parsed.idempotencyKey]) return false;
  store.setState((draft) => {
    draft.events = [...draft.events, parsed];
    draft.processedIdempotencyKeys[parsed.idempotencyKey] = parsed.id;
  });
  return true;
}

export function upsertWorldFact(store: Store<WorldMemoryState>, fact: WorldFact): void {
  const parsed = WorldFactSchema.parse(fact);
  store.setState((draft) => { draft.facts[parsed.id] = parsed; });
}

export function upsertNpcBelief(store: Store<WorldMemoryState>, belief: NpcBelief): void {
  const parsed = NpcBeliefSchema.parse(belief);
  store.setState((draft) => { draft.beliefs[parsed.id] = parsed; });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/state/world-memory-store.test.ts`

Expected: PASS.

## Task 2: Add WorldMemory to context and SaveDataV7

**Files:**
- Modify: `src/context/game-context.ts`
- Modify: `src/state/serializer.ts`
- Modify: `src/persistence/save-migrator.ts`
- Modify: `src/engine/branch-diff.ts`
- Modify: `src/app.tsx`
- Test: `src/state/__tests__/store-factories.test.ts`
- Test: `src/state/serializer.test.ts`
- Test: `src/persistence/save-migrator.test.ts`
- Test: `src/engine/branch-diff.test.ts`

- [ ] **Step 1: Write failing GameContext store factory test**

Add a test proving `createGameContext().stores.worldMemory` exists and starts as `getDefaultWorldMemoryState()`.

Run: `bun test src/state/__tests__/store-factories.test.ts`

Expected: FAIL because `worldMemory` is not in `GameStores`.

- [ ] **Step 2: Add world memory store to game context**

Modify `src/context/game-context.ts`:

```ts
import { createWorldMemoryStore, type WorldMemoryState } from '../state/world-memory-store';

export type GameStores = {
  // existing fields...
  readonly worldMemory: Store<WorldMemoryState>;
};

const stores: GameStores = {
  // existing fields...
  worldMemory: createWorldMemoryStore(eventBus),
};
```

Run: `bun test src/state/__tests__/store-factories.test.ts`

Expected: PASS for the new context test.

- [ ] **Step 3: Write failing serializer migration tests**

Add tests proving:
- `createSerializer().snapshot()` writes `version: 7` and includes `worldMemory`.
- V6 saves migrate to V7 with empty world memory.
- `worldMemory.processedIdempotencyKeys` round-trips.

Example assertion:

```ts
const parsed = JSON.parse(serializer.snapshot('test'));
expect(parsed.version).toBe(7);
expect(parsed.worldMemory).toEqual(getDefaultWorldMemoryState());
```

- [ ] **Step 4: Run serializer tests to verify they fail**

Run: `bun test src/state/serializer.test.ts src/persistence/save-migrator.test.ts`

Expected: FAIL because V7 does not exist.

- [ ] **Step 5: Add SaveDataV7 schema and serializer support**

Modify `src/state/serializer.ts`:

```ts
import { WorldMemoryStateSchema, type WorldMemoryState } from './world-memory-store';

export const SaveDataV7Schema = SaveDataV6Schema.extend({
  version: z.literal(7),
  worldMemory: WorldMemoryStateSchema,
});
export type SaveDataV7 = z.infer<typeof SaveDataV7Schema>;
```

Add `worldMemory` to `createSerializer` stores, snapshot, and restore. Change snapshot version to 7 and parse restore with `SaveDataV7Schema`.

Also update `src/app.tsx` where `createSerializer` is called:

```ts
worldMemory: ctx.stores.worldMemory,
```

- [ ] **Step 6: Add V6 to V7 migration**

Modify `src/persistence/save-migrator.ts`:

```ts
export function migrateV6ToV7(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const data = raw as Record<string, unknown>;
  if (data['version'] !== 6) return raw;
  return { ...data, version: 7, worldMemory: getDefaultWorldMemoryState() };
}

export function migrateToLatest(raw: unknown): SaveDataV7 {
  const v2 = migrateV1ToV2(raw);
  const v3 = migrateV2ToV3(v2);
  const v4 = migrateV3ToV4(v3);
  const v5 = migrateV4ToV5(v4);
  const v6 = migrateV5ToV6(v5);
  const v7 = migrateV6ToV7(v6);
  return v7 as SaveDataV7;
}
```

- [ ] **Step 7: Update branch diff type compatibility**

Modify `src/engine/branch-diff.ts` to include `SaveDataV7`:

```ts
import type { SaveDataV4, SaveDataV5, SaveDataV6, SaveDataV7 } from '../state/serializer';

type SaveDataCompare = SaveDataV4 | SaveDataV5 | SaveDataV6 | SaveDataV7;
```

Do not add world-memory diff display in this first version.

- [ ] **Step 8: Run tests to verify pass**

Run: `bun test src/state/serializer.test.ts src/persistence/save-migrator.test.ts src/engine/branch-diff.test.ts`

Expected: PASS.

## Task 3: Implement world event recorder

**Files:**
- Create: `src/engine/world-memory-recorder.ts`
- Test: `src/engine/world-memory-recorder.test.ts`
- Modify: `src/app.tsx`

- [ ] **Step 1: Write failing recorder tests**

Create tests for:
- `quest_stage_advanced` records a quest `WorldEvent`.
- `item_acquired` records an item `WorldEvent`.
- `scene_changed` records one movement `WorldEvent` using a canonical/idempotent transition key.
- `knowledge_discovered` or `location_explored` records a discovery `WorldEvent`.
- duplicate idempotency keys do not append duplicate events.
- cleanup unregisters handlers.
- `quest_stage_advanced` derives a quest-scoped `WorldFact`.
- `item_acquired` does not derive a fact by default.
- `reputation_changed` derives a holder-scoped `NpcBelief`.

```ts
const cleanup = initWorldEventRecorder({ worldMemory, game, scene, dialogue }, bus, codexEntries);
bus.emit('quest_stage_advanced', { questId: 'quest_main_01', newStageId: 'stage_2', turnNumber: 7 });
expect(worldMemory.getState().events[0]).toMatchObject({ type: 'quest', sourceDomainEvent: 'quest_stage_advanced' });
cleanup();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/engine/world-memory-recorder.test.ts`

Expected: FAIL because file does not exist.

- [ ] **Step 3: Implement recorder helpers**

Create `src/engine/world-memory-recorder.ts` with:

```ts
function subscribe<K extends keyof DomainEvents>(
  eventBus: EventBus,
  eventName: K,
  handler: (payload: DomainEvents[K]) => void,
): () => void {
  eventBus.on(eventName, handler);
  return () => eventBus.off(eventName, handler);
}

export function recordWorldEvent(store: Store<WorldMemoryState>, event: WorldEvent): boolean {
  return appendWorldEvent(store, event);
}

export function initWorldEventRecorder(
  stores: WorldEventRecorderStores,
  eventBus: EventBus,
  codexEntries: ReadonlyMap<string, CodexEntry>,
): () => void {
  const cleanups = [
    subscribe(eventBus, 'quest_stage_advanced', (payload) => { /* build quest event */ }),
    subscribe(eventBus, 'item_acquired', (payload) => { /* build item event */ }),
    subscribe(eventBus, 'scene_changed', (payload) => { /* build movement event with canonical idempotency */ }),
    subscribe(eventBus, 'knowledge_discovered', (payload) => { /* build discovery event */ }),
    subscribe(eventBus, 'location_explored', (payload) => { /* build discovery event */ }),
    subscribe(eventBus, 'reputation_changed', (payload) => { /* build reputation event */ }),
    subscribe(eventBus, 'combat_ended', (payload) => { /* build combat event */ }),
  ];
  return () => cleanups.forEach((cleanup) => cleanup());
}
```

Use idempotency keys such as:
- `quest_stage_advanced:${questId}:${newStageId}:${turnNumber}`
- `item_acquired:${itemId}:${quantity}:${turnCount}`
- `combat_ended:${outcome}:${enemyIds.join(',')}:${turnCount}`
- `scene_changed:${sceneId}:turn:${turnCount}` for movement, intentionally avoiding source-specific `previousSceneId` differences.
- `knowledge_discovered:${entryId}:${codexEntryId ?? 'none'}:${turnNumber}` for discovery.
- `location_explored:${locationId}:${newLevel}:${turnCount}` for discovery.

For `scene_changed`, use `sceneId + current turnCount` as the first-version canonical idempotency key so duplicate emissions from `scene-store` and `scene-manager` collapse into one movement event even when `previousSceneId` differs.

- [ ] **Step 4: Add first-pass fact/belief derivation**

Inside recorder, after a public/high-importance event append, create simple derived facts or beliefs where deterministic:
- `quest_stage_advanced` -> `WorldFact` scoped to quest.
- `item_acquired` -> no fact by default.
- `reputation_changed` -> `NpcBelief` or faction belief about player if `targetType` is npc/faction.

Keep this conservative to avoid noisy facts.

- [ ] **Step 5: Initialize recorder in AppInner**

Modify `src/app.tsx` after `allCodexEntries.size > 0`:

```ts
useEffect(() => {
  if (allCodexEntries.size === 0) return;
  return initWorldEventRecorder(
    {
      worldMemory: ctx.stores.worldMemory,
      game: ctx.stores.game,
      scene: ctx.stores.scene,
      dialogue: ctx.stores.dialogue,
    },
    ctx.eventBus,
    allCodexEntries,
  );
}, [ctx, allCodexEntries]);
```

- [ ] **Step 6: Add movement/discovery tests**

Add tests proving:

- two `scene_changed` payloads with the same `sceneId` in the same turn but different `previousSceneId` create only one movement event.
- `knowledge_discovered` creates a discovery event with `rawPayload.entryId` and `rawPayload.codexEntryId`.
- `location_explored` creates a discovery event with `rawPayload.locationId` and `rawPayload.newLevel`.

- [ ] **Step 7: Implement movement/discovery recording**

Add recorder handlers for `scene_changed`, `knowledge_discovered`, and `location_explored`. Use the idempotency keys defined above and preserve original payload in `rawPayload`.

- [ ] **Step 8: Run tests**

Run: `bun test src/engine/world-memory-recorder.test.ts`

Expected: PASS.

## Task 4: Add conservative propagation rules

**Files:**
- Modify: `src/engine/world-memory-recorder.ts`
- Test: `src/engine/world-memory-recorder.test.ts`

- [ ] **Step 1: Write failing propagation tests**

Add tests proving deterministic first-version behavior:

- private events append only the raw event and do not create beliefs for bystanders.
- same-location events create beliefs for NPCs present in `scene.npcsPresent`.
- faction-scoped reputation events create a faction-held `NpcBelief`.
- public quest events create a scoped `WorldFact`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/engine/world-memory-recorder.test.ts`

Expected: FAIL because derivation/propagation rules are incomplete.

- [ ] **Step 3: Implement conservative propagation helpers**

Keep these helpers in `world-memory-recorder.ts` for the first version unless the file becomes too large:

```ts
function deriveFactFromEvent(event: WorldEvent): WorldFact | null { ... }
function deriveBeliefsFromEvent(event: WorldEvent, stores: WorldEventRecorderStores): NpcBelief[] { ... }
function applyDerivedMemory(store: Store<WorldMemoryState>, event: WorldEvent, derived: { fact?: WorldFact; beliefs: NpcBelief[] }): void { ... }
```

Do not use LLM inference here. Only derive facts/beliefs when the rule is obvious from event type and payload.

- [ ] **Step 4: Run tests to verify pass**

Run: `bun test src/engine/world-memory-recorder.test.ts`

Expected: PASS.

## Task 5: Record full dialogue events before state reset

**Files:**
- Modify: `src/engine/dialogue-manager.ts`
- Test: `src/engine/dialogue-manager.test.ts`
- Possibly modify: `src/events/event-types.ts` only if choosing richer event payload instead of direct record.

- [ ] **Step 1: Write failing dialogue world-event test**

Add a test that starts dialogue, processes a response or free text, ends dialogue, and asserts a `WorldEvent` was recorded with full dialogue history in `rawPayload.dialogueHistory` before reset.

This requires injecting a world-event recorder dependency into `createDialogueManager`, or passing a callback in options:

```ts
const recordWorldEventFn = mock(() => true);
const manager = createDialogueManager(stores, mockCodexEntries, { generateNpcDialogueFn, adjudicateFn, recordWorldEventFn });
await manager.startDialogue('npc_guard');
await manager.processPlayerFreeText('我来自战火地区');
manager.endDialogue();
expect(recordWorldEventFn).toHaveBeenCalledWith(expect.objectContaining({
  type: 'dialogue',
  actorIds: expect.arrayContaining(['player', 'npc_guard']),
  rawPayload: expect.objectContaining({ dialogueHistory: expect.any(Array) }),
}));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/engine/dialogue-manager.test.ts`

Expected: FAIL because no recorder dependency exists.

- [ ] **Step 3: Add optional recordWorldEvent dependency**

Extend dialogue manager options with:

```ts
recordWorldEventFn?: (event: WorldEvent) => boolean;
```

In `endDialogue()`, before resetting dialogue store, read:
- current dialogue state,
- relationship delta,
- current turn number,
- scene id,
- NPC/faction metadata if available.

Build a `WorldEvent` with:
- `type: 'dialogue'`,
- `visibility: 'private'` or `same_location` depending on design choice,
- `rawPayload.dialogueHistory`,
- `summary` based on NPC/player ids and number of turns.

- [ ] **Step 4: Wire real recorder from AppInner**

After Task 3, pass a `recordWorldEventFn` from `AppInner` to `createDialogueManager` that calls `recordWorldEvent(ctx.stores.worldMemory, event)`. If this creates circular dependencies, put the adapter in `world-memory-recorder.ts`.

- [ ] **Step 5: Run tests**

Run: `bun test src/engine/dialogue-manager.test.ts src/engine/world-memory-recorder.test.ts`

Expected: PASS.

## Task 6: Add ecological memory retriever

**Files:**
- Create: `src/ai/utils/ecological-memory-retriever.ts`
- Test: `src/ai/utils/ecological-memory-retriever.test.ts`

- [ ] **Step 1: Write failing retrieval tests**

Test that:
- active NPC receives own beliefs,
- active NPC does not receive another NPC's private belief,
- location-scoped facts are included for current location,
- public recent events are included,
- player knowledge remains a separate field.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/ai/utils/ecological-memory-retriever.test.ts`

Expected: FAIL because file does not exist.

- [ ] **Step 3: Implement retriever**

Create:

```ts
export type EcologicalMemoryQuery = {
  readonly npcId?: string;
  readonly locationId?: string;
  readonly factionIds?: readonly string[];
  readonly playerKnowledge?: readonly string[];
  readonly tags?: readonly string[];
  readonly maxEvents?: number;
  readonly maxFacts?: number;
  readonly maxBeliefs?: number;
};

export function retrieveEcologicalMemory(state: WorldMemoryState, query: EcologicalMemoryQuery): EcologicalMemoryContext;
```

Selection rules:
- events: public, same current location, involving npcId, or matching tags; newest/critical first.
- facts: global, current location, current NPC, quest/player relevant scopes.
- beliefs: holder is active NPC or active faction.
- omitted: include IDs when caps omit entries.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/ai/utils/ecological-memory-retriever.test.ts`

Expected: PASS.

## Task 7: Inject ecological memory into NPC prompts

**Files:**
- Modify: `src/engine/dialogue-manager.ts`
- Modify: `src/ai/roles/npc-actor.ts`
- Modify: `src/ai/prompts/npc-system.ts`
- Test: `src/engine/dialogue-manager.test.ts`
- Test: `src/ai/prompts/npc-system.test.ts`
- Test: `src/ai/roles/npc-actor.test.ts`

- [ ] **Step 1: Write failing prompt formatting test**

Add a test showing prompt output includes labeled sections:

```text
Runtime memory:
- Confirmed world facts:
- Rumors:
- This NPC believes:
- Recent events:
```

Assert that rumors are not labeled as confirmed facts.

- [ ] **Step 2: Write failing dialogue manager retrieval test**

Add a test where `worldMemory` contains:
- a belief held by `npc_guard`,
- a private belief held by another NPC,
- a current-location fact.

Assert `generateNpcDialogueFn` receives only the guard's belief and the current-location fact.

- [ ] **Step 3: Run tests to verify failures**

Run: `bun test src/engine/dialogue-manager.test.ts src/ai/prompts/npc-system.test.ts src/ai/roles/npc-actor.test.ts`

Expected: FAIL because ecological memory is not passed or formatted.

- [ ] **Step 4: Extend NPC actor context**

Add optional `ecologicalMemory` to NPC dialogue context/options. Keep existing memory fields for compatibility.

- [ ] **Step 5: Add world memory dependencies to dialogue manager**

Extend `createDialogueManager` stores/options so it can access ecological memory without singleton reads:

```ts
stores: {
  dialogue: Store<DialogueState>;
  npcMemory: Store<NpcMemoryState>;
  scene: Store<SceneState>;
  game: Store<GameState>;
  player: Store<PlayerState>;
  relation: Store<RelationState>;
  quest?: Store<QuestState>;
  worldMemory?: Store<WorldMemoryState>;
  playerKnowledge?: Store<PlayerKnowledgeState>;
}
```

Update the `createDialogueManager` call in `src/app.tsx` to pass:

```ts
worldMemory: ctx.stores.worldMemory,
playerKnowledge: ctx.stores.playerKnowledge,
```

- [ ] **Step 6: Retrieve memory in every NPC generation path**

Use `retrieveEcologicalMemory(stores.worldMemory.getState(), query)` in all three dialogue generation paths, not just initial greeting:

- `startDialogue`
- `processPlayerResponse`
- `processPlayerFreeText`

Each query should include active `npcId`, current `sceneId`, NPC faction IDs when known, current player action/response text, and player knowledge summaries if available. Pass retrieved context to NPC actor.

- [ ] **Step 7: Format prompt labels**

In `npc-system.ts`, format ecological memory separately from raw NPC memories. Do not flatten rumor/fact/belief into one paragraph.

- [ ] **Step 8: Run targeted tests**

Run: `bun test src/engine/dialogue-manager.test.ts src/ai/prompts/npc-system.test.ts src/ai/roles/npc-actor.test.ts`

Expected: PASS.

## Task 8: Inject ecological memory into narrative prompts

**Files:**
- Modify: `src/engine/scene-manager.ts`
- Modify: `src/engine/game-screen-controller.ts`
- Modify: `src/ai/roles/narrative-director.ts`
- Modify: `src/ai/prompts/narrative-system.ts`
- Test: `src/engine/scene-manager.test.ts`
- Test: `src/engine/game-screen-controller.test.ts`
- Test: `src/ai/prompts/narrative-system.test.ts`
- Test: `src/ai/roles/narrative-director.test.ts`

- [ ] **Step 1: Write failing narrative prompt formatting test**

Add a test proving `buildNarrativeSystemPrompt` can render ecological memory with labels such as:

```text
Runtime world memory:
- Confirmed world facts:
- Local rumors:
- Recent relevant events:
```

Assert rumor entries are not rendered under confirmed facts.

- [ ] **Step 2: Write failing scene/game controller integration tests**

Add tests proving narration generation paths call `retrieveEcologicalMemory` or receive a prebuilt ecological memory package when available:

- `scene-manager.handleLook` / scene narration path includes current `sceneId` in retrieval query.
- `game-screen-controller` action narration path includes current scene and player action in retrieval query.

- [ ] **Step 3: Run tests to verify failures**

Run: `bun test src/engine/scene-manager.test.ts src/engine/game-screen-controller.test.ts src/ai/prompts/narrative-system.test.ts src/ai/roles/narrative-director.test.ts`

Expected: FAIL because narrative ecological memory is not passed or formatted.

- [ ] **Step 4: Extend narrative context types**

Add optional ecological memory to `NarrativePromptContext` / `generateNarration` input, reusing the context type from `ecological-memory-retriever.ts`.

- [ ] **Step 5: Retrieve ecological memory for narration**

Where narration is generated from `scene-manager` or `game-screen-controller`, retrieve ecological memory using current location, player action, active quest IDs/tags when available, and public/location facts/events. Pass it to narrative director.

- [ ] **Step 6: Format narrative prompt labels**

Update `narrative-system.ts` to render facts, rumors, and recent events separately. Keep codex world truth distinct from runtime world facts.

- [ ] **Step 7: Run targeted tests**

Run: `bun test src/engine/scene-manager.test.ts src/engine/game-screen-controller.test.ts src/ai/prompts/narrative-system.test.ts src/ai/roles/narrative-director.test.ts`

Expected: PASS.

## Task 9: Full verification

**Files:**
- All files modified above.

- [ ] **Step 1: Run world-memory focused tests**

Run:

```bash
bun test \
  src/state/world-memory-store.test.ts \
  src/engine/world-memory-recorder.test.ts \
  src/ai/utils/ecological-memory-retriever.test.ts \
  src/engine/dialogue-manager.test.ts \
  src/state/serializer.test.ts \
  src/persistence/save-migrator.test.ts \
  src/engine/branch-diff.test.ts
```

Expected: all pass.

- [ ] **Step 2: Run full test suite**

Run: `bun test`

Expected: all tests pass with `0 fail`.

- [ ] **Step 3: Run typecheck**

Run: `bun run typecheck`

Expected: `tsc --noEmit` exits 0.

- [ ] **Step 4: Run build**

Run: `bun run build`

Expected: bundle succeeds.

- [ ] **Step 5: Manual smoke scenario**

Run the game and verify this scenario manually if API keys are available:

1. Start a new session.
2. Tell `npc_guard` a private fact.
3. End dialogue.
4. Talk to `npc_guard` again: guard can reference the fact.
5. Talk to unrelated NPC: they should not know unless propagation rule applies.
6. Trigger a public quest event: town-relevant rumor/fact appears in later relevant dialogue.

- [ ] **Step 6: Final summary**

Summarize:
- new files,
- changed files,
- tests run,
- any deferred work such as vector retrieval or autonomous NPC schedules.

Do not commit unless the user explicitly requests it.
