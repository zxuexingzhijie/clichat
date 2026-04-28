# Phase 11: App Wiring - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Connect all existing game systems (save, quest, branch, replay, map, RAG, summarizer, exploration tracker, knowledge tracker) to the running app. No new features — everything is already implemented; the gap is that app.tsx doesn't wire them up at startup.

**Not in scope:** Fixing bugs within those systems (that's Phases 12-15). Only connecting them.

</domain>

<decisions>
## Implementation Decisions

### App Architecture: Use createGameContext() pattern

- **D-01:** Refactor `app.tsx` to use `createGameContext()` (already exists in `src/context/game-context.ts`) instead of importing singleton module-level stores directly. This gives access to all stores (quest, branch, turnLog, etc.) in one place.
- **D-02:** Replace the current `useMemo(() => createSceneManager(...))`, `createDialogueManager`, `createCombatLoop` pattern with a single `useMemo(() => createGameContext(), [])` call that provides all stores.
- **D-03:** All downstream factory calls (`createGameLoop`, `createSceneManager`, `createDialogueManager`, `createCombatLoop`, `createQuestSystem`, `createSerializer`) receive their dependencies from `ctx.stores` and `ctx.eventBus`.

### Save System Wiring

- **D-04:** `saveFileManager` (from `src/persistence/save-file-manager.ts`) — standalone exported functions `{ quickSave, saveGame, loadGame }` — passed as object into `createGameLoop` options.
- **D-05:** `createSerializer` (from `src/state/serializer.ts`) instantiated in `app.tsx` with `ctx.stores` and passed to `createGameLoop`.
- **D-06:** `saveDir` resolved via `resolveDataDir()` + `/saves` suffix — already the pattern used in CLI entry point.

### Quest System Wiring

- **D-07:** `createQuestSystem(ctx.stores.quest, allCodexEntries)` instantiated and passed to `createGameLoop` options as `questSystem`.

### Branch System Wiring

- **D-08:** Branch manager shape expected by `createGameLoop`: `{ createBranch, switchBranch, deleteBranch }` — use `ctx.stores.branch` directly plus the branch handler functions from `src/state/branch-store.ts`.
- **D-09:** `branchTree` derived from `ctx.stores.branch.getState()` and passed as prop to `GameScreen` — subscribe to branch store changes for reactive updates.

### Replay / TurnLog Wiring

- **D-10:** `ctx.stores.turnLog` passed as `turnLog` option to `createGameLoop` — it already implements `replayTurns(count)`.

### Map Data Wiring

- **D-11:** `mapData` prop for `GameScreen` derived from `allCodexEntries` (locations) + `ctx.stores.scene.getState().sceneId` (current location). Subscribed reactively via `useStoreState`.

### RAG Retrieval Planner Wiring

- **D-12:** `generateRetrievalPlan` (from `src/ai/roles/retrieval-planner.ts`) passed as `generateRetrievalPlanFn` to `createSceneManager`.

### Combat Narration Wiring

- **D-13:** `generateNarration` (from `src/ai/roles/narrative-director.ts`) already imported in `app.tsx` — pass it as `options.generateNarrationFn` to `createCombatLoop`.

### Summarizer Wiring

- **D-14:** `runSummarizerLoop()` (from `src/ai/summarizer/summarizer-worker.ts`) called inside a `useEffect(() => { runSummarizerLoop().catch(...) }, [])` in `AppInner` — fire-and-forget, void return.

### Exploration & Knowledge Trackers

- **D-15:** `initExplorationTracker(ctx.stores.exploration, ctx.eventBus)` called inside `useEffect` once on mount.
- **D-16:** `initKnowledgeTracker(ctx.stores.playerKnowledge, ctx.eventBus, allCodexEntries)` called inside `useEffect` once on mount (after codex loaded).

### Codex Knowledge Status

- **D-17:** `codexDisplayEntries` should read `knowledgeStatus` from `ctx.stores.playerKnowledge.getState()` instead of hardcoding `null`. Subscribe reactively so codex panel updates as player discovers things.

### React Provider Wiring

- **D-18:** The `GameStoreCtx.Provider`, `QuestStoreCtx.Provider`, etc. in `App()` must use stores from `ctx` — not the module-level singletons currently imported at top of `app.tsx`. This ensures all store hooks read from the same instance.

### Claude's Discretion

- Exact error handling for `runSummarizerLoop` failures — log to stderr, don't crash game.
- Whether `mapData` uses a `useMemo` or subscribes via `useStoreState` — either works; planner decides.
- Order of `useEffect` cleanup for trackers — standard React patterns apply.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Wiring Targets
- `src/app.tsx` — file being refactored; all current wiring is here
- `src/context/game-context.ts` — `createGameContext()` factory that creates all stores
- `src/game-loop.ts` — `GameLoopOptions` type shows all injectable dependencies
- `src/engine/scene-manager.ts` — `SceneManagerOptions` including `generateRetrievalPlanFn`
- `src/engine/combat-loop.ts` — options including `generateNarrationFn`

### Systems Being Wired
- `src/persistence/save-file-manager.ts` — `quickSave`, `saveGame`, `loadGame` functions
- `src/state/serializer.ts` — `createSerializer` factory
- `src/engine/quest-system.ts` — `createQuestSystem` factory
- `src/state/branch-store.ts` — branch state and operations
- `src/engine/turn-log.ts` — turn log with `replayTurns`
- `src/engine/exploration-tracker.ts` — `initExplorationTracker`
- `src/engine/knowledge-tracker.ts` — `initKnowledgeTracker`
- `src/ai/roles/retrieval-planner.ts` — `generateRetrievalPlan`
- `src/ai/roles/narrative-director.ts` — `generateNarration`
- `src/ai/summarizer/summarizer-worker.ts` — `runSummarizerLoop`

### UI Props
- `src/ui/screens/game-screen.tsx` — `GameScreenProps` interface (mapData, branchTree, etc.)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createGameContext()` — already creates ALL stores in one call, uses the same `eventBus` instance
- `ctx.stores.turnLog` — already implements `replayTurns(count)` matching `GameLoopOptions.turnLog` shape
- `generateRetrievalPlan` — exported from retrieval-planner, matches `GenerateRetrievalPlanFn` type in scene-manager
- `runSummarizerLoop` — exported, returns `Promise<void>`, fire-and-forget

### Established Patterns
- `useMemo` for factory instances (already used for sceneManager, dialogueManager, combatLoop)
- `useEffect` for startup side effects (already used for codex loading, initRoleConfigs)
- Stores passed as `ctx.stores.X` rather than module-level singletons

### Integration Points
- `GameScreen` already accepts `mapData`, `branchTree`, `branchDiffResult`, `compareBranchNames` as optional props — they just need to be computed and passed from `app.tsx`
- `createGameLoop` already has all the option slots — just not filled
- React Provider chain in `App()` needs to use `ctx.stores` instances

</code_context>

<specifics>
## Specific Ideas

- User confirmed: use `createGameContext()` refactor pattern — not incremental additions to existing structure.

</specifics>

<deferred>
## Deferred Ideas

- Fixing bugs *within* save/branch/quest/combat systems — Phase 12, 13, 14
- NPC notable_npcs content gaps — Phase 15
- quests.yaml content — Phase 14

</deferred>

---

*Phase: 11-app-wiring*
*Context gathered: 2026-04-28*
