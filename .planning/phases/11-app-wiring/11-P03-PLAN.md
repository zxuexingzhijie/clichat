---
phase: 11-app-wiring
plan: P03
type: execute
wave: 3
depends_on:
  - 11-P01
  - 11-P02
files_modified:
  - src/app.tsx
autonomous: true
requirements:
  - WIRE-08
  - WIRE-09
  - WIRE-10

must_haves:
  truths:
    - "runSummarizerLoop() is called in a useEffect with empty deps — fire-and-forget, errors logged to stderr, app does not crash on failure"
    - "initExplorationTracker called in useEffect; cleanup function is returned to React"
    - "initKnowledgeTracker called in useEffect gated on allCodexEntries.size > 0; cleanup function is returned"
    - "codexDisplayEntries reads knowledgeStatus from playerKnowledgeStore state instead of hardcoding null"
    - "playerKnowledge store subscribed reactively; codex panel updates as player discovers things"
  artifacts:
    - path: src/app.tsx
      provides: "WIRE-08/09/10 startup effects plus CODEX-01 (knowledgeStatus fix)"
  key_links:
    - from: "src/app.tsx AppInner useEffect"
      to: "runSummarizerLoop"
      via: "fire-and-forget useEffect with [] deps"
      pattern: "runSummarizerLoop"
    - from: "src/app.tsx AppInner useEffect"
      to: "initExplorationTracker"
      via: "useEffect returning cleanup fn"
      pattern: "initExplorationTracker.*ctx.stores"
    - from: "src/app.tsx codexDisplayEntries useMemo"
      to: "playerKnowledgeState.entries"
      via: "knowledgeStatus derived from entries by codexEntryId"
      pattern: "knowledgeStatus.*playerKnowledge|entries\[entry.id\]"
---

<objective>
Wire WIRE-08 (summarizer startup), WIRE-09 (exploration tracker), WIRE-10 (knowledge tracker), and fix CODEX-01 (knowledgeStatus hardcoded null) as a bonus because it's a 2-line change in the same useMemo.

Purpose: Background summarizer compresses NPC memory; exploration events are tracked as player moves; knowledge events are tracked from dialogue; codex panel shows real discovered/undiscovered status.
Output: app.tsx with three startup useEffect hooks and reactive knowledgeStatus in codexDisplayEntries.
</objective>

<execution_context>
@/Users/makoto/Downloads/work/cli/.planning/phases/11-app-wiring/11-CONTEXT.md
</execution_context>

<context>
@/Users/makoto/Downloads/work/cli/.planning/ROADMAP.md
@/Users/makoto/Downloads/work/cli/.planning/phases/11-app-wiring/11-P01-SUMMARY.md
@/Users/makoto/Downloads/work/cli/.planning/phases/11-app-wiring/11-P02-SUMMARY.md

<interfaces>
<!-- Key contracts. Read these before touching app.tsx. -->

From src/engine/exploration-tracker.ts:
```typescript
export function initExplorationTracker(
  stores: { exploration: Store<ExplorationState>; game: Store<GameState> },
  eventBus: EventBus,
): () => void  // returns cleanup/unsubscribe function
```

From src/engine/knowledge-tracker.ts:
```typescript
export function initKnowledgeTracker(
  stores: { playerKnowledge: Store<PlayerKnowledgeState>; game: Store<GameState> },
  eventBus: EventBus,
): () => void  // returns cleanup/unsubscribe function
// NOTE: signature takes only stores + eventBus — does NOT need allCodexEntries as a param
// Gate the useEffect on allCodexEntries.size > 0 to ensure codex is loaded first
```

From src/ai/summarizer/summarizer-worker.ts:
```typescript
export async function runSummarizerLoop(): Promise<void>
// Infinite polling loop (5000ms interval) — never resolves normally
// Fire-and-forget pattern: call without await, catch errors
```

From src/state/player-knowledge-store.ts:
```typescript
export type KnowledgeStatus = 'heard' | 'suspected' | 'confirmed' | 'contradicted';
export type PlayerKnowledgeEntry = {
  id: string;
  codexEntryId: string | null;
  knowledgeStatus: KnowledgeStatus;
  // ... other fields
};
export type PlayerKnowledgeState = {
  entries: Record<string, PlayerKnowledgeEntry>;
};
```

codexDisplayEntries knowledgeStatus derivation logic:
```typescript
// Current (broken — hardcodes null):
knowledgeStatus: null,

// Correct pattern — find the player knowledge entry whose codexEntryId matches the codex entry id:
const knowledgeEntry = Object.values(playerKnowledgeState.entries)
  .find(e => e.codexEntryId === entry.id);
knowledgeStatus: knowledgeEntry?.knowledgeStatus ?? null,
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add startup useEffects for summarizer, exploration tracker, knowledge tracker</name>
  <files>src/app.tsx</files>
  <read_first>
    - src/app.tsx (full file after P01+P02 changes — understand all existing useEffects before adding)
    - src/engine/exploration-tracker.ts (full file — confirm signature and return type)
    - src/engine/knowledge-tracker.ts (full file — confirm signature and return type)
    - src/ai/summarizer/summarizer-worker.ts (lines 90-110 — confirm runSummarizerLoop export)
  </read_first>
  <behavior>
    - Three new useEffects added to AppInner after existing codex-loading useEffect
    - Summarizer effect: deps = `[]`, fire-and-forget, error logged with `console.error('[Summarizer] loop error:', ...)`
    - Exploration tracker effect: deps = `[ctx]`, returns cleanup fn from initExplorationTracker
    - Knowledge tracker effect: deps = `[ctx, allCodexEntries]`, gated with `if (allCodexEntries.size === 0) return;`, returns cleanup fn from initKnowledgeTracker
    - No imports that are already present are duplicated
    - Order: summarizer first (pure side-effect), then exploration, then knowledge
  </behavior>
  <action>
    In src/app.tsx (AppInner function, after existing codex-loading useEffect):

    1. Add imports:
       ```typescript
       import { runSummarizerLoop } from './ai/summarizer/summarizer-worker';
       import { initExplorationTracker } from './engine/exploration-tracker';
       import { initKnowledgeTracker } from './engine/knowledge-tracker';
       ```

    2. Add summarizer useEffect (fire-and-forget, per D-14):
       ```typescript
       useEffect(() => {
         runSummarizerLoop().catch((err) => {
           console.error('[Summarizer] loop error:', err instanceof Error ? err.message : String(err));
         });
       }, []);
       ```

    3. Add exploration tracker useEffect (per D-15):
       ```typescript
       useEffect(() => {
         const cleanup = initExplorationTracker(
           { exploration: ctx.stores.exploration, game: ctx.stores.game },
           ctx.eventBus,
         );
         return cleanup;
       }, [ctx]);
       ```

    4. Add knowledge tracker useEffect (per D-16):
       ```typescript
       useEffect(() => {
         if (allCodexEntries.size === 0) return;
         const cleanup = initKnowledgeTracker(
           { playerKnowledge: ctx.stores.playerKnowledge, game: ctx.stores.game },
           ctx.eventBus,
         );
         return cleanup;
       }, [ctx, allCodexEntries]);
       ```
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bunx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "runSummarizerLoop" src/app.tsx` returns a match inside useEffect
    - `grep -n "initExplorationTracker" src/app.tsx` returns a match with `ctx.stores.exploration`
    - `grep -n "initKnowledgeTracker" src/app.tsx` returns a match with `ctx.stores.playerKnowledge`
    - `grep -n "allCodexEntries.size === 0" src/app.tsx` returns match (knowledge tracker gate)
    - `bunx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Three startup useEffects present in AppInner: summarizer (fire-and-forget), exploration tracker (with cleanup), knowledge tracker (gated + cleanup); TypeScript clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fix codexDisplayEntries to read knowledgeStatus from playerKnowledgeStore (CODEX-01)</name>
  <files>src/app.tsx</files>
  <read_first>
    - src/app.tsx (the codexDisplayEntries useMemo — lines around the `knowledgeStatus: null` line)
    - src/state/player-knowledge-store.ts (PlayerKnowledgeState, PlayerKnowledgeEntry, KnowledgeStatus types)
    - src/ui/panels/codex-panel.ts (CodexDisplayEntry type — confirm knowledgeStatus field type)
  </read_first>
  <behavior>
    - `playerKnowledgeState` subscribed reactively via useState + useEffect on `ctx.stores.playerKnowledge`
    - `codexDisplayEntries` useMemo includes `playerKnowledgeState` in its dependency array
    - `knowledgeStatus` for each entry is `Object.values(playerKnowledgeState.entries).find(e => e.codexEntryId === entry.id)?.knowledgeStatus ?? null`
    - If CodexDisplayEntry.knowledgeStatus expects `KnowledgeStatus | null`, the `?? null` handles the undefined case correctly
    - P02 already added an `explorationState` subscription — check if `playerKnowledgeState` subscription was also added there (unlikely, but verify before duplicating)
  </behavior>
  <action>
    In src/app.tsx (AppInner function):

    1. Add `playerKnowledgeState` reactive subscription (if not already present from P02):
       ```typescript
       const [playerKnowledgeState, setPlayerKnowledgeState] = useState(
         () => ctx.stores.playerKnowledge.getState()
       );
       useEffect(() => {
         return ctx.stores.playerKnowledge.subscribe(() => {
           setPlayerKnowledgeState(ctx.stores.playerKnowledge.getState());
         });
       }, [ctx]);
       ```

    2. Update the `codexDisplayEntries` useMemo to include `playerKnowledgeState` in deps and replace `knowledgeStatus: null`:
       ```typescript
       const codexDisplayEntries = useMemo<CodexDisplayEntry[]>(() => {
         return Array.from(allCodexEntries.values()).map(entry => ({
           id: entry.id,
           name: entry.name,
           type: entry.type,
           description: entry.description,
           visibility: entry.epistemic.visibility,
           authority: entry.epistemic.authority,
           confidence: entry.epistemic.confidence,
           sourceType: entry.epistemic.source_type,
           tags: entry.tags,
           relatedIds: [],
           knowledgeStatus: Object.values(playerKnowledgeState.entries)
             .find(e => e.codexEntryId === entry.id)?.knowledgeStatus ?? null,
         }));
       }, [allCodexEntries, playerKnowledgeState]);
       ```

    Per D-17 from CONTEXT.md (knowledgeStatus from playerKnowledge store, not hardcoded null).
    Also closes CODEX-01 from REQUIREMENTS.md as a bonus fix (same 2-line change).
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "knowledgeStatus: null" src/app.tsx` returns ZERO matches (the hardcoded null is gone)
    - `grep -n "playerKnowledgeState.entries" src/app.tsx` returns a match inside codexDisplayEntries useMemo
    - `grep -n "playerKnowledgeState" src/app.tsx` returns matches for useState, useEffect subscription, and useMemo dep array
    - `bunx tsc --noEmit` exits 0
    - `bun test` exits 0 (all 807+ tests pass, no regressions)
  </acceptance_criteria>
  <done>codexDisplayEntries derives knowledgeStatus from playerKnowledgeStore; subscribes reactively; no hardcoded null; all tests pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| runSummarizerLoop → NPC memory store | Summarizer reads npcMemoryStore module-level singleton (pre-existing coupling, out of scope) |
| initKnowledgeTracker → eventBus | Knowledge tracker subscribes to domain events; event payloads are typed via DomainEvents |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-06 | Denial of Service | runSummarizerLoop infinite loop crashes app | mitigate | Error caught and logged to stderr; Promise rejection does not propagate to React render tree |
| T-11-07 | Tampering | Knowledge tracker writes to playerKnowledge store on dialogue events | mitigate | initKnowledgeTracker uses store.setState with immutable update; event source is internal eventBus (not user input) |
| T-11-08 | Information Disclosure | codexDisplayEntries exposes all knowledge entries to codex panel | accept | Knowledge panel is single-player; no cross-user leakage risk |
</threat_model>

<verification>
After completing both tasks:
1. `bunx tsc --noEmit` — zero errors
2. `bun test` — all tests pass (no regressions from the full suite)
3. `grep "runSummarizerLoop" src/app.tsx` — match inside useEffect
4. `grep "initExplorationTracker" src/app.tsx` — match with ctx.stores.exploration
5. `grep "initKnowledgeTracker" src/app.tsx` — match with ctx.stores.playerKnowledge
6. `grep "knowledgeStatus: null" src/app.tsx` — ZERO matches (CODEX-01 fixed)
</verification>

<success_criteria>
- runSummarizerLoop() called at app startup in fire-and-forget useEffect (WIRE-08)
- initExplorationTracker called with ctx stores and eventBus; cleanup returned (WIRE-09)
- initKnowledgeTracker called gated on codex loaded; cleanup returned (WIRE-10)
- codexDisplayEntries reads knowledgeStatus from playerKnowledgeStore reactively (CODEX-01 bonus)
- All tests pass; TypeScript clean
</success_criteria>

<output>
After completion, create `.planning/phases/11-app-wiring/11-P03-SUMMARY.md`
</output>
