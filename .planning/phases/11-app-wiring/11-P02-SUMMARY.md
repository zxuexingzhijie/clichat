---
phase: 11
plan: P02
subsystem: app-wiring
tags: [app, map, branch, rag, combat-narration]
dependency_graph:
  requires: [11-P01, retrieval-planner, narrative-director, exploration-store, branch-store]
  provides: [wired-mapData, wired-branchTree, wired-RAG-planner, wired-combatNarration]
  affects: [app.tsx]
tech_stack:
  added: []
  patterns: [useState+useEffect store subscription, useMemo derived data, adapter wrapper]
key_files:
  created: []
  modified:
    - src/app.tsx
decisions:
  - "generateRetrievalPlan adapter wraps field name mismatch: SceneManagerOptions uses {currentScene,playerAction,activeNpcs,activeQuests} but RetrievalPromptContext uses {sceneId,locationName,playerIntent,activeNpcIds,activeQuestIds}"
  - "Store<T>.subscribe takes () => void Listener, not onChange callback — must call getState() inside listener"
  - "branchDiffResult and compareBranchNames passed as undefined (Phase 12 scope)"
metrics:
  duration: "~8 min"
  completed: "2026-04-28"
---

# Phase 11 Plan P02: App Wiring mapData/branchTree/RAG/combatNarration Summary

Wired WIRE-04 (mapData → GameScreen), WIRE-05 (branchTree → GameScreen), WIRE-06 (RAG planner → sceneManager), WIRE-07 (combat narration → combatLoop) by adding reactive store subscriptions and useMemo derivations in `app.tsx`.

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| 1 | Add generateRetrievalPlanFn to sceneManager, generateNarrationFn to combatLoop | Done |
| 2 | Wire explorationState/branchState subscriptions, mapData/branchTree useMemo, update GameScreen JSX | Done |

## TypeScript Status

`bunx tsc --noEmit` — zero errors.

## Test Status

`bun test src/ui/screens/game-screen.test.ts` — 23/23 pass.

## Key Changes

- `src/app.tsx`: added 4 new imports (`generateRetrievalPlan`, `LocationMapData`, `BranchDisplayNode`, `ExplorationState`, `BranchState`). `sceneManager` now receives `generateRetrievalPlanFn` (adapter). `combatLoop` now receives `generateNarrationFn: generateNarration`. Added `explorationState` and `branchState` via `useState` + `useEffect` subscriptions. Added `mapData` and `branchTree` `useMemo`. `GameScreen` JSX now passes `mapData`, `branchTree`, `currentBranchId`, `branchDiffResult={undefined}`, `compareBranchNames={undefined}`.

## Deviations from Plan

**1. [Rule 1 - Bug] generateRetrievalPlan field name adapter**
- **Found during:** Task 1
- **Issue:** `SceneManagerOptions.generateRetrievalPlanFn` expects `{currentScene, playerAction, activeNpcs, activeQuests}` but `generateRetrievalPlan` takes `RetrievalPromptContext` with `{sceneId, locationName, playerIntent, activeNpcIds, activeQuestIds}`.
- **Fix:** Wrapped in inline adapter lambda mapping field names. Used `currentScene` as both `sceneId` and `locationName` (same data, scene ID is the location ID).
- **Files modified:** src/app.tsx

**2. [Rule 1 - Bug] Store subscribe Listener signature**
- **Found during:** Task 2
- **Issue:** Plan showed `subscribe(({ newState }) => ...)` but `Listener` type is `() => void` — no arguments.
- **Fix:** Changed to `subscribe(() => { setState(ctx.stores.X.getState()); })`.
- **Files modified:** src/app.tsx

## Self-Check: PASSED

- `src/app.tsx` — exists, tsc clean, 23/23 tests pass
- Commit `f5449c3` — confirmed in git log
