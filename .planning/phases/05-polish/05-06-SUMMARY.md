---
phase: 05-polish
plan: "06"
subsystem: ui-cost-replay
tags: [ui, cost, replay, status-bar, game-screen]
dependency_graph:
  requires: [05-03, 05-04]
  provides: [cost-ui, replay-ui, token-status-bar]
  affects: [game-screen.tsx, status-bar.tsx, game-loop.ts, command-registry.ts]
tech_stack:
  added: []
  patterns: [costSessionStore.subscribe for live token updates, module-level replay entries passed to ReplayPanel]
key_files:
  created: []
  modified:
    - src/ui/screens/game-screen.tsx
    - src/ui/panels/status-bar.tsx
decisions:
  - ReplayPanel wired via module-level getLastReplayEntries() rather than prop threading through app root — avoids adding TurnLogEntry[] to every intermediate component
  - lastTurnTokens sourced from costSessionStore.subscribe in game-screen.tsx directly (no prop from app root) — store subscription is the cleaner pattern for ephemeral cost state
  - isInReplay included in isInOverlayPanel so ESC key handling auto-closes it like other panels
metrics:
  duration: ~15min
  completed: 2026-04-22
  tasks_completed: 3
  files_modified: 4
---

# Phase 05 Plan 06: /cost and /replay UI Wiring Summary

Wire /cost and /replay into the game loop and UI — cost store, replay panel, and status bar connected and player-visible.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire /cost and /replay routing in game-loop; register /cost command | `8afb1d3` | `src/game-loop.ts`, `src/input/command-registry.ts` |
| 2 | checkpoint:human-verify | APPROVED | — |
| 3 | Wire ReplayPanel in game-screen; add lastTurnTokens to StatusBar | `9488e10` | `src/ui/screens/game-screen.tsx`, `src/ui/panels/status-bar.tsx` |

## What Was Built

**`src/game-loop.ts`** (Task 1, `8afb1d3`):
- Imports `getCostSummary` from `cost-session-store`
- Updated `/replay` block: sets `phase='replay'`, stores entries in `lastReplayEntries` module-level variable, returns `narration: []`
- Exports `getLastReplayEntries()` for UI to consume
- New `/cost` block: reads `getCostSummary()` and returns formatted per-role token breakdown as narration lines

**`src/input/command-registry.ts`** (Task 1, `8afb1d3`):
- `/cost` command registered, routes to `{ type: 'cost', ... }`

**`src/ui/screens/game-screen.tsx`** (Task 3, `9488e10`):
- Imports `ReplayPanel`, `costSessionStore`, `getLastReplayEntries`
- Adds `isInReplay = gameState.phase === 'replay'` constant
- Includes `isInReplay` in `isInOverlayPanel` guard (ESC closes it)
- Subscribes to `costSessionStore` via `useEffect` to keep `lastTurnTokens` updated
- Adds `ReplayPanel` to the panel chain before the fallback `ScenePanel`
- Passes `lastTurnTokens` prop to `StatusBar`

**`src/ui/panels/status-bar.tsx`** (Task 3, `9488e10`):
- Adds `lastTurnTokens?: number` to `StatusBarProps`
- Renders `T:{n}` dimColor field when `width >= 85` and `lastTurnTokens > 0`

## Deviations from Plan

None — plan executed exactly as written.

## Verification

```
bun test → 637 pass, 0 fail
grep getCostSummary src/game-loop.ts → import + usage confirmed
grep ReplayPanel src/ui/screens/game-screen.tsx → import + panel chain confirmed
grep lastTurnTokens src/ui/panels/status-bar.tsx → prop + conditional render confirmed
grep command.*cost src/input/command-registry.ts → registration confirmed
```

## Known Stubs

None. All data flows are wired:
- `/cost` reads live `getCostSummary()` (returns zeros until AI calls are made, which is correct)
- `ReplayPanel` receives entries from `getLastReplayEntries()` (empty until `/replay` is called, which is correct)
- `lastTurnTokens` updates in real-time via store subscription

## Self-Check

- [x] `src/ui/screens/game-screen.tsx` modified — confirmed (git diff)
- [x] `src/ui/panels/status-bar.tsx` modified — confirmed (git diff)
- [x] Commit `8afb1d3` exists (Task 1)
- [x] Commit `9488e10` exists (Task 3)
- [x] 637 tests pass
