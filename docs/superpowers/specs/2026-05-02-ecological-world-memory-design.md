# Ecological World Memory Design

## Goal

Build Chronicle's memory architecture toward a living world: events should persist, become facts and beliefs, spread through people and places, and influence future dialogue and story reactions.

This design is a second-stage layer on top of `docs/superpowers/specs/2026-05-02-no-loss-context-design.md`. The no-loss work remains the foundation: raw history must not be deleted, summaries are derived caches, and prompt builders should prefer full context with observable budget fallback.

## Relationship to No-Loss Context

This ecological memory work assumes the no-loss foundation is either complete or completed first in the same milestone.

Required preconditions:

- NPC memory has an authoritative append-only raw log such as `allMemories`.
- Summarization does not delete raw memory entries.
- Turn logs and narration history are not storage-capped.
- Prompt builders distinguish full raw context from budgeted prompt views.

If these preconditions are not yet implemented, ecological memory should treat `WorldEvent` as the new no-loss source of truth and use current NPC memory only as a compatibility view during migration. Implementation plans must not claim no-loss behavior while `recentMemories.max(15)`, `salientMemories.max(50)`, or destructive summarizer slicing remain authoritative paths.

## Problem

The current system has useful memory pieces, but they are not yet an ecosystem:

- NPC memory is mostly private per-NPC conversation memory.
- Player knowledge, narrative state, turn log, codex truth, and NPC memory are stored separately.
- Events do not consistently become world facts.
- Facts do not naturally become NPC beliefs or rumors.
- NPCs and factions do not systematically react to what the world has learned.

The result is that NPCs can remember isolated interactions, but the world does not reliably accumulate consequences.

## Principles

- **Events are the source of truth.** Store what happened before deriving interpretations.
- **Facts and beliefs are derived, versioned, and traceable.** Every fact or belief should point back to source event IDs.
- **Different characters can believe different things.** World truth, rumor, player knowledge, and NPC belief must not collapse into one string.
- **Propagation is rule-driven first.** Use deterministic visibility, location, faction, and relationship rules before asking an LLM to infer spread.
- **LLMs enrich, not own, world state.** LLMs may summarize, phrase, or suggest derived facts, but rule/state systems validate final writes.
- **No vector DB in the first pass.** Keep storage JSON/Zod/store based and git-diffable. Add embeddings only when scale requires it.
- **Idempotency is mandatory.** Domain events that may fire more than once must not create duplicate world events.

## Memory Layers

### 1. Working Memory

Working memory is the prompt package assembled for a single AI call. It is not persisted directly.

Inputs:

- Current scene and visible objects/NPCs.
- Current player action or dialogue turn.
- Relevant `WorldEvent` records.
- Relevant `WorldFact` records.
- Relevant `NpcBelief` records for the active NPC.
- Relevant player knowledge and narrative state.

Output:

- Prompt context for narrative, NPC dialogue, and dynamic dialogue options.
- Omitted-context metadata when prompt budget forces fallback.

### 2. Episodic Memory: `WorldEvent`

`WorldEvent` is the append-only record of what happened.

Proposed schema:

```ts
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
```

Field intent:

- `summary` is player/developer-readable text.
- `rawText` preserves relevant generated prose or dialogue text.
- `rawPayload` preserves structured event payloads such as `{ questId, newStageId }` or `{ itemId, quantity }`.
- `sourceDomainEvent` identifies the originating `DomainEvents` event name when present.
- `idempotencyKey` prevents duplicate records when existing systems emit the same transition through multiple paths.

Examples:

- Player told the north-gate guard they came from war.
- Player found a bounty notice about missing miner Wang Er.
- Player killed a wolf on the forest road.
- Guard captain's faction reputation changed after a dialogue.

### 3. Semantic Memory: `WorldFact`

`WorldFact` is a durable statement distilled from one or more events. It does **not** own who knows the fact; that belongs to `NpcBelief` or derived indexes.

Proposed schema:

```ts
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
```

Examples:

- Miner Wang Er is missing.
- A bounty notice about Wang Er exists at the north gate.
- The northern forest road has recent wolf attacks.

These statements describe world facts or rumor content. They should not encode who knows or believes them; holder-specific knowledge belongs in `NpcBelief`.

### 4. Belief Memory: `NpcBelief`

`NpcBelief` captures what an NPC or faction believes, not necessarily what is true.

Proposed schema:

```ts
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
```

Examples:

- `npc_guard` believes the player is suspicious but harmless.
- `faction_guard` knows the player helped expose a criminal.
- `npc_bartender` heard a rumor that the player asks about missing miners.

`knownByNpcIds` and `knownByFactionIds` should not be stored on `WorldFact` in the first version because they duplicate `NpcBelief` and flatten belief stance. If lookup speed later requires it, they can be derived indexes, not source-of-truth fields.

### 5. Procedural Memory: Reaction Rules

Procedural memory is not prose; it is behavior policy.

First pass should be deterministic rules such as:

- If an event is `public`, create or update a location/faction fact.
- If an event is `same_location`, NPCs present may receive a belief.
- If an NPC belongs to a faction, high-importance beliefs can propagate to faction memory.
- If a belief about the player has high confidence, NPC dialogue options and tone can change.
- If a fact is `rumor`, dialogue should phrase it as rumor rather than truth.

Later passes can add LLM-assisted reflection, but rule validation remains authoritative.

## Data Flow

### Event Write Flow

1. Player action, dialogue, quest, combat, or exploration happens.
2. Existing subsystem emits a domain event when that event contains enough source data.
3. `initWorldEventRecorder(stores, eventBus, codexEntries)` listens to sufficiently rich domain events and converts them into `WorldEvent` records.
4. If an existing domain event lacks raw source data, extend that event payload or call `recordWorldEvent` at the source before state is reset.
5. `WorldMemoryStore` appends the raw event if its `idempotencyKey` has not already been recorded.
6. `WorldMemoryConsolidator` derives candidate facts and beliefs.
7. Deterministic propagation rules decide who knows or believes what.
8. Affected stores update `WorldFact`, `NpcBelief`, and compatibility NPC memory views.

Recommended recorder interface:

```ts
import type { CodexEntry } from '../codex/schemas/entry-types';
import type { EventBus } from '../events/event-bus';

type WorldMemoryStoreLike = {
  readonly getState: () => WorldMemoryState;
  readonly setState: (recipe: (draft: WorldMemoryState) => void) => void;
};

type GameStoreLike = {
  readonly getState: () => GameState;
  readonly setState: (recipe: (draft: GameState) => void) => void;
};

type SceneStoreLike = {
  readonly getState: () => SceneState;
  readonly setState: (recipe: (draft: SceneState) => void) => void;
};

type DialogueStoreLike = {
  readonly getState: () => DialogueState;
  readonly setState: (recipe: (draft: DialogueState) => void) => void;
};

type WorldEventRecorderStores = {
  readonly worldMemory: WorldMemoryStoreLike;
  readonly game: GameStoreLike;
  readonly scene: SceneStoreLike;
  readonly dialogue: DialogueStoreLike;
};



export function initWorldEventRecorder(
  stores: WorldEventRecorderStores,
  eventBus: EventBus,
  codexEntries: ReadonlyMap<string, CodexEntry>,
): () => void;



```

Existing `scene_changed` deserves special handling because the current code can emit it from both `scene-store` and `scene-manager`. The preferred fix is to define one canonical source for movement events, ideally the store-level transition. If both emitters must remain, the event payload needs a stable `transitionId` or the recorder must build an idempotency key that does not depend on source-specific `previousSceneId` differences. For example, initial scene load should not create two movement events if one source reports `previousSceneId = null` and another reports a placeholder scene.

Dialogue events also need special handling. The current `dialogue_ended` payload is too small if it only carries `npcId`; by the time the event is observed, full dialogue history may already be reset. First-version implementation must either extend `dialogue_ended` with `dialogueHistory`, `relationshipDelta`, `turnNumber`, `npcId`, and raw text, or explicitly call `recordWorldEvent` inside `dialogue-manager.endDialogue()` before resetting dialogue state.

### Retrieval Flow

1. A narrative or dialogue action starts.
2. `MemoryRetriever` receives query context:
   - active NPC ID,
   - location ID,
   - player action,
   - quest IDs,
   - current act,
   - visible NPC/faction IDs.
3. Retriever returns a typed context package:

```ts
export const EcologicalMemoryContextSchema = z.object({
  events: z.array(WorldEventSchema),
  facts: z.array(WorldFactSchema),
  beliefs: z.array(NpcBeliefSchema),
  playerKnowledge: z.array(z.string()),
  omitted: z.array(z.object({ type: z.string(), id: z.string(), reason: z.string() })).default([]),
});
```

4. Prompt builders format the package with clear epistemic labels:
   - `World truth`,
   - `Rumors`,
   - `This NPC believes`,
   - `Player knows`,
   - `Recent events`.

## Relationship to Existing Systems

### NPC Memory

Existing NPC memory remains as a compatibility view during migration.

- `allMemories` remains the raw per-NPC log from no-loss work if that work has landed.
- New `WorldEvent` records become the broader source of truth.
- NPC memory can store event references and personal summaries.
- Do not delete raw NPC memories during summarization.

### Player Knowledge

Player knowledge should become a view over facts/events the player has learned.

- Keep `playerKnowledgeStore` for UI and save compatibility.
- Add links from player knowledge entries to `WorldFact` or `WorldEvent` IDs where possible.
- Dialogue should distinguish facts the player knows from facts the NPC knows.

### Narrative State

Narrative state remains the macro story controller.

- It can consume facts/events to set `worldFlags`.
- It should not become a dumping ground for all ecological memory.
- It answers: what act and atmosphere is the story in?
- World memory answers: what happened, what is known, and who believes what?

### Turn Log

Turn log remains a UI/replay chronology.

- It can link to `WorldEvent` IDs.
- It should not be the only source of event truth.
- Replay can show player-facing summaries while world memory stores structured event semantics.

### Codex

Codex remains authored world truth.

- Codex defines static entities, history, factions, locations, and epistemic policy.
- World memory records runtime changes and discovered facts.
- Retrieval should combine Codex truth with runtime facts and beliefs.

## Save Data and Migration

This feature should create a new save version.

- Add `WorldMemoryStateSchema`.
- Use JSON-serializable idempotency storage, not a raw `Set`.

```ts
export const WorldMemoryStateSchema = z.object({
  events: z.array(WorldEventSchema).default([]),
  facts: z.record(z.string(), WorldFactSchema).default({}),
  beliefs: z.record(z.string(), NpcBeliefSchema).default({}),
  processedIdempotencyKeys: z.record(z.string(), z.string()).default({}),
});
```

- Add `SaveDataV7Schema = SaveDataV6Schema.extend({ version: z.literal(7), worldMemory: WorldMemoryStateSchema })`.
- Add `migrateV6ToV7(raw)` that injects `worldMemory: getDefaultWorldMemoryState()`.
- Update `migrateToLatest` to return `SaveDataV7`.
- Update `createSerializer.snapshot()` to write `version: 7` and include `worldMemory`.
- Update `createSerializer.restore()` to restore `worldMemory`.
- Update all direct `SaveDataV6` type references where they accept current save data. At minimum, update `src/engine/branch-diff.ts` from `SaveDataV4 | SaveDataV5 | SaveDataV6` to include `SaveDataV7`.
- Decide whether `worldMemory` participates in branch diff. First version may explicitly exclude it from displayed diff while preserving type compatibility.
- Update `save-migrator.test.ts`, `serializer.test.ts`, `branch-diff.test.ts`, and save compatibility tests.

## First-Version Scope

In scope:

- Create `WorldMemoryStore` containing `events`, `facts`, `beliefs`, and JSON-serializable idempotency index.
- Create `initWorldEventRecorder` to listen to existing domain events where payloads are sufficient.
- Extend insufficient domain events or record at the source before data is reset. `dialogue_ended` is the first known case that needs this decision.
- Record world events from dialogue end, quest stage changes, item acquisition, combat outcomes, movement, and discoveries.
- Add deterministic propagation rules for same-location, faction, public, and private visibility.
- Add retrieval package used by NPC dialogue and narrative generation.
- Add save version V7 and migration.
- Preserve current no-loss constraints.

Out of scope for first version:

- Vector database or embeddings.
- Autonomous NPC daily schedules.
- Full social simulation.
- Complex rumor mutation or unreliable narrator mechanics.
- User-facing memory deletion/pruning UI.

## Proposed Files

- Create `src/state/world-memory-store.ts`
  - Owns `WorldEvent`, `WorldFact`, `NpcBelief`, schemas, defaults, append/update helpers.
- Create `src/engine/world-memory-recorder.ts`
  - Registers event listeners, creates idempotent world events, and applies first-pass deterministic fact/belief updates.
  - This file may initially contain recorder + simple consolidation + simple propagation to avoid over-splitting.
  - Initialize it from the composition root that has both `eventBus` and `codexEntries`. If `createGameContext()` still cannot access codex entries, initialize from `AppInner` after codex load and return cleanup to prevent handler leaks.
- Create `src/engine/world-memory-propagation.ts` only if propagation logic outgrows `world-memory-recorder.ts`.
- Create `src/ai/utils/ecological-memory-retriever.ts`
  - Retrieves relevant events/facts/beliefs for a given AI call.
- Modify `src/context/game-context.ts`
  - Add world memory store to `GameStores`.
- Modify `src/state/serializer.ts` and `src/persistence/save-migrator.ts`
  - Add V7 save schema and migration.
- Modify `src/engine/dialogue-manager.ts`
  - Record dialogue events and retrieve ecological memory before NPC generation.
- Modify `src/engine/quest-system.ts`
  - Record quest stage and completion events via domain events or recorder mapping.
- Modify combat and scene action handlers only where existing domain events are insufficient.
- Modify prompt builders
  - Format ecological memory with epistemic labels.

## Prompt Contract

NPC prompts should receive memory in this shape, conceptually:

```text
Runtime memory:
- Recent events involving this NPC:
  ...
- This NPC believes:
  ...
- Public/local rumors:
  ...
- Confirmed world facts relevant to this scene:
  ...
- Player knows:
  ...

Rules:
- Treat confirmed facts as true.
- Treat rumors as uncertain.
- Speak only from this NPC's belief and knowledge.
- Do not reveal facts this NPC does not know.
```

This prevents the model from flattening all context into omniscience.

## Testing Strategy

- Store tests:
  - append event preserves raw event order,
  - duplicate idempotency keys do not append duplicate events,
  - fact updates retain source event IDs,
  - belief updates are scoped to holder IDs.
- Recorder tests:
  - dialogue recording preserves full `dialogueHistory` in `WorldEvent.rawText` or `WorldEvent.rawPayload`,
  - `quest_stage_advanced` becomes a quest `WorldEvent`,
  - initial scene load can receive duplicate `scene_changed`-like transitions but creates one movement event,
  - recorder initialized through the real composition root writes to `worldMemory`,
  - cleanup unregisters event handlers.
- Propagation tests:
  - private event does not spread,
  - same-location event reaches present NPCs,
  - faction event reaches faction members,
  - public event becomes location/faction/world fact.
- Serializer tests:
  - world memory round-trips through save/load,
  - V1/V2/V3/V4/V5/V6 saves migrate to V7 with empty world memory,
  - snapshot writes V7,
  - idempotency index survives save/load and prevents duplicate event append after restore,
  - branch diff accepts V7 saves.
- Retrieval tests:
  - active NPC receives own beliefs,
  - NPC does not receive unknown private facts,
  - player knowledge and NPC belief remain distinct.
- Prompt tests:
  - facts are labeled by epistemic status,
  - rumors are not phrased as confirmed truth,
  - omitted metadata is available when budget fallback occurs.
- Integration tests:
  - after a player tells guard a secret, guard remembers it later,
  - another NPC does not know it unless propagation rule applies,
  - public quest event changes town rumor context.

## Migration Strategy

1. Implement `WorldMemoryStore` empty by default.
2. Serializer migration adds empty world memory to old saves as V7.
3. New events are written to world memory while old NPC memory remains available.
4. Retriever reads both old NPC memory and new world memory during transition.
5. Later migration can backfill important NPC memories into world events if needed.

## Risks and Mitigations

- **Risk: Over-engineering before gameplay proves need.**
  - Mitigation: First version only records and retrieves; no autonomous schedules.
- **Risk: Prompt noise increases.**
  - Mitigation: Use relevance and epistemic labels; keep no-loss in storage, not always in prompt.
- **Risk: Contradictory beliefs.**
  - Mitigation: Beliefs are holder-scoped and source-linked; contradictions are allowed when scoped.
- **Risk: Duplicate events from current event flow.**
  - Mitigation: Use idempotency keys and define canonical sources per event type.
- **Risk: Save files grow.**
  - Mitigation: JSON is acceptable now; add pagination/indexing later, not destructive pruning.

## Success Criteria

- The world can record an event once and reuse it across NPC memory, player knowledge, and narrative context.
- NPCs can know different things about the same event.
- Rumors and confirmed facts are distinct in storage and prompt context.
- Significant player actions can propagate to relevant NPCs/factions/locations without hand-written bespoke code for each case.
- No raw memory or event is deleted by summarization.
- Existing no-loss context design remains valid as the storage foundation.
