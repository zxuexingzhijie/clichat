---
phase: 11
plan: P03
subsystem: app-wiring
tags: [app, summarizer, exploration-tracker, knowledge-tracker, codex]
dependency_graph:
  requires: [11-P01, 11-P02, summarizer-worker, exploration-tracker, knowledge-tracker, player-knowledge-store]
  provides: [wired-summarizer, wired-exploration-tracker, wired-knowledge-tracker, wired-knowledgeStatus]
  affects: [app.tsx]
tech_stack:
  added: []
  patterns: [useEffect fire-and-forget, useEffect cleanup return, useState+useEffect store subscription, gated useEffect]
key_files:
  created: []
  modified:
    - src/app.tsx
decisions:
  - "playerKnowledgeState useState declared before codexDisplayEntries useMemo to avoid TS2448 block-scoped-before-declaration error"
  - "initKnowledgeTracker signature is (stores, eventBus) — does not accept allCodexEntries — plan description was inaccurate; gate via allCodexEntries.size === 0 check instead"
  - "Pre-existing test failure (getPanelActionForKey 'inventory') confirmed present before P03; not a regression"
metrics:
  duration: "~15 min"
  completed: "2026-04-28"
---

# Phase 11 Plan P03: App Wiring Summarizer/Trackers/knowledgeStatus Summary

Wired WIRE-08 (runSummarizerLoop fire-and-forget), WIRE-09 (initExplorationTracker with cleanup), WIRE-10 (initKnowledgeTracker gated on codex load), and fixed CODEX-01 (knowledgeStatus hardcoded null → reactive from playerKnowledgeState).

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| 1 | Add imports + 3 useEffects for summarizer, exploration tracker, knowledge tracker | Done |
| 2 | Add playerKnowledgeState subscription, fix codexDisplayEntries knowledgeStatus | Done |

## TypeScript Status

`bunx tsc --noEmit` — zero errors.

## Test Status

`bun test` — 834/835 pass. 1 pre-existing failure in `use-game-input.test.ts` (confirmed present before P03, not a regression).

## Key Changes

- `src/app.tsx`: added 3 imports (`runSummarizerLoop`, `initExplorationTracker`, `initKnowledgeTracker`) + 1 type import (`PlayerKnowledgeState`).
- Added `playerKnowledgeState` useState + useEffect subscription (positioned before `codexDisplayEntries` useMemo).
- `codexDisplayEntries` useMemo: `knowledgeStatus: null` replaced with `Object.values(playerKnowledgeState.entries).find(e => e.codexEntryId === entry.id)?.knowledgeStatus ?? null`; dep array updated to `[allCodexEntries, playerKnowledgeState]`.
- Added 3 useEffects after `branchTree` useMemo: summarizer (deps=[]), exploration tracker (deps=[ctx], returns cleanup), knowledge tracker (deps=[ctx, allCodexEntries], gated on `allCodexEntries.size === 0`, returns cleanup).

## Deviations from Plan

**1. [Rule 1 - Bug] playerKnowledgeState declaration order**
- **Found during:** Task 2
- **Issue:** `codexDisplayEntries` useMemo (line ~86) references `playerKnowledgeState` before its `useState` declaration. TS2448 error.
- **Fix:** Moved `playerKnowledgeState` useState + useEffect subscription to immediately after `codexLoadError` useState — before codexDisplayEntries useMemo.
- **Files modified:** src/app.tsx

**2. [Rule 1 - Bug] initKnowledgeTracker does not accept allCodexEntries**
- **Found during:** Task 1 (reading knowledge-tracker.ts)
- **Issue:** Plan described `initKnowledgeTracker(ctx.stores.playerKnowledge, ctx.eventBus, allCodexEntries)` but actual signature is `initKnowledgeTracker(stores: { playerKnowledge, game }, eventBus)` — no codex entries param.
- **Fix:** Called with correct 2-arg signature. Gating logic (`allCodexEntries.size === 0`) retained as useEffect guard to delay tracker init until codex is loaded.
- **Files modified:** src/app.tsx

## Self-Check: PASSED

- `src/app.tsx` exists and is tsc clean
- `grep "runSummarizerLoop" src/app.tsx` — matches line 258 (inside useEffect)
- `grep "initExplorationTracker" src/app.tsx` — matches line 264 with `ctx.stores.exploration`
- `grep "initKnowledgeTracker" src/app.tsx` — matches line 273 with `ctx.stores.playerKnowledge`
- `grep "allCodexEntries.size === 0" src/app.tsx` — matches line 272
- `grep "knowledgeStatus: null" src/app.tsx` — zero matches (CODEX-01 fixed)
- `grep "playerKnowledgeState.entries" src/app.tsx` — matches line 98 inside codexDisplayEntries useMemo
- Commit `bea021d` — confirmed in git log
