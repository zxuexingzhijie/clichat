---
phase: 11
plan: P01
subsystem: app-wiring
tags: [app, context, stores, save, quest, branch, replay]
dependency_graph:
  requires: [game-context, save-file-manager, serializer, quest-system, branch-manager, turn-log]
  provides: [wired-app-tsx]
  affects: [app.tsx, game-loop.test.ts]
tech_stack:
  added: []
  patterns: [createGameContext DI pattern, useMemo factory wiring]
key_files:
  created: []
  modified:
    - src/app.tsx
    - src/game-loop.test.ts
decisions:
  - "turnLog option uses { replayTurns } from engine/turn-log.ts (module-level fn), not ctx.stores.turnLog (Store<TurnLogState> has no replayTurns method)"
  - "saveDir computed as module-level constant outside hooks — resolveDataDir() is deterministic"
  - "ctx passed as prop to AppInner to avoid re-creating game context on every render"
metrics:
  duration: "~10 min"
  completed: "2026-04-28"
---

# Phase 11 Plan P01: App Wiring createGameContext() Summary

Replaced all module-level singleton store imports in `app.tsx` with `createGameContext()` DI pattern, wiring WIRE-01 (save), WIRE-02 (quest/branch), and WIRE-03 (replay/turnLog) into `createGameLoop` options.

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| 1 | Replace singleton imports with createGameContext(), wire all options into createGameLoop | Done |
| 2 | Add describe("createGameLoop options wiring") tests for /save, /quest, /replay 3 | Done |

## TypeScript Status

`bunx tsc --noEmit` — zero errors.

## Test Status

`bun test src/game-loop.test.ts` — 17/17 pass (includes 3 new wiring tests).

## Key Changes

- `src/app.tsx`: removed 9 singleton imports (`gameStore`, `playerStore`, `sceneStore`, `dialogueStore`, `combatStore`, `questStore`, `npcMemoryStore`, `relationStore`, `eventBus`). Added `createGameContext()` in `App()` via `useMemo`, passed as prop to `AppInner`. All 6 Providers now use `ctx.stores.*`. `createGameLoop` now receives `saveFileManager`, `serializer`, `saveDir`, `questSystem`, `branchManager`, `turnLog`.
- `src/game-loop.test.ts`: added `describe("createGameLoop options wiring")` with 3 tests.

## Deviations from Plan

**1. [Rule 1 - Bug] turnLog wiring uses replayTurns from engine/turn-log.ts, not ctx.stores.turnLog**
- **Found during:** Task 1
- **Issue:** Plan specified `turnLog: ctx.stores.turnLog` but `Store<TurnLogState>` has no `replayTurns` method. `GameLoopOptions.turnLog` requires `{ replayTurns: (count) => TurnLogEntry[] }`.
- **Fix:** Import `replayTurns` from `./engine/turn-log` and pass `{ replayTurns }` to gameLoop options.
- **Files modified:** src/app.tsx

## Self-Check: PASSED

- `src/app.tsx` — exists, tsc clean
- `src/game-loop.test.ts` — exists, 17/17 tests pass
- Commit `364c796` — confirmed in git log
