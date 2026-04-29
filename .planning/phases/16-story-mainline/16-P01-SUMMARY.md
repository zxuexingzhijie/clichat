---
phase: 16
plan: "01"
subsystem: narrative-state
tags: [store, serialization, event-wiring, migration]
dependency_graph:
  requires: []
  provides: [narrativeStore, SaveDataV5, createNarrativeStateWatcher]
  affects: [serializer, save-migrator, game-context, compare-panel, branch-diff]
tech_stack:
  added: [narrative-transitions.yaml]
  patterns: [createStore pattern, Zod schema extension, migration chain]
key_files:
  created:
    - src/state/narrative-state.ts
    - src/state/narrative-state.test.ts
    - src/engine/narrative-state-watcher.ts
    - src/engine/narrative-state-watcher.test.ts
    - world-data/narrative-transitions.yaml
  modified:
    - src/state/serializer.ts
    - src/state/serializer.test.ts
    - src/persistence/save-migrator.ts
    - src/persistence/save-migrator.test.ts
    - src/persistence/save-file-manager.ts
    - src/context/game-context.ts
    - src/app.tsx
    - src/e2e/phase1-verification.test.ts
    - src/engine/branch-diff.ts
    - src/engine/branch-diff.test.ts
    - src/engine/dialogue-manager.test.ts
    - src/engine/scene-manager.test.ts
    - src/ui/panels/compare-panel.tsx
    - src/ui/panels/panel-router.tsx
    - src/ui/screens/game-screen.tsx
decisions:
  - "Used SaveDataV4 as the base type for compareBranches via a SaveDataCompare union type to allow both V4 and V5 saves to be passed"
  - "narrativeStore wired into createGameContext so the watcher is created at app startup"
  - "branch-diff.ts updated to accept SaveDataV4 | SaveDataV5 to remain compatible with readSaveData returning V5"
metrics:
  duration: "~35 minutes"
  completed: "2026-04-29"
  tasks: 3
  files: 20
---

# Phase 16 Plan 01: narrativeState Store + SaveDataV5 + Event Wiring Summary

narrativeState Zod store, SaveDataV5 migration chain, and quest_stage_advanced event watcher mapping 8 narrative transitions from YAML.

## What Was Built

**Task 1 — narrativeState store** (`src/state/narrative-state.ts`):
- `NarrativeStateSchema` with `currentAct` (act1/act2/act3 enum), `atmosphereTags` (string[]), `worldFlags` (Record<string, boolean>), `playerKnowledgeLevel` (0–5 int)
- `createNarrativeStore()` factory + singleton `narrativeStore` export
- `restoreState()` method for save restoration

**Task 2 — narrative-transitions.yaml + watcher** (`world-data/narrative-transitions.yaml`, `src/engine/narrative-state-watcher.ts`):
- 8 transition entries mapping quest stage IDs to act/atmosphere/knowledge/flag changes
- `createNarrativeStateWatcher` subscribes to `quest_stage_advanced`, looks up transition by `newStageId`, applies state update; returns cleanup function
- Wired into `createGameContext` — watcher starts at app boot

**Task 3 — SaveDataV5 + migration** (`src/state/serializer.ts`, `src/persistence/save-migrator.ts`):
- `SaveDataV5Schema = SaveDataV4Schema.extend({ version: z.literal(5), narrativeState: NarrativeStateSchema })`
- `migrateV4ToV5` adds default narrativeState when upgrading V4 saves
- `restore()` chain: `migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(raw))))` then V5 → V4 → V3 fallback parse
- `readSaveData` updated to return `SaveDataV5`

## Test Results

- `src/state/narrative-state.test.ts` — 11/11 pass
- `src/engine/narrative-state-watcher.test.ts` — 6/6 pass
- `src/persistence/save-migrator.test.ts` — 28/28 pass (includes 7 new V4→V5 tests)
- `src/state/serializer.test.ts` — 33/33 pass (includes 5 new V5 tests)
- Full suite: **1048 pass, 0 fail**

## Commits

- `0592f24`: feat(16-P01): narrativeState store + V5 save schema + quest_stage_advanced watcher

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale NarrativeStore mock shape in dialogue-manager.test.ts and scene-manager.test.ts**
- **Found during:** Task 1 (tsc check)
- **Issue:** Existing mocks returned `{ recentNarration: [] }` which is not in the new schema; missing `worldFlags` and `playerKnowledgeLevel`
- **Fix:** Updated mock `getState()` return to `{ currentAct, atmosphereTags, worldFlags: {}, playerKnowledgeLevel: 0 }`
- **Files modified:** `src/engine/dialogue-manager.test.ts`, `src/engine/scene-manager.test.ts`

**2. [Rule 1 - Bug] Fixed SaveDataV3 references in compare-panel.tsx, panel-router.tsx, game-screen.tsx, branch-diff.ts, branch-diff.test.ts**
- **Found during:** Task 3 (tsc check after V5 introduction)
- **Issue:** Multiple UI files referenced the removed `SaveDataV3` type; `branch-diff.ts` needed to accept both V4 and V5 saves
- **Fix:** Updated all to use `SaveDataV4` or `SaveDataV5` as appropriate; `branch-diff.ts` uses local `SaveDataCompare = SaveDataV4 | SaveDataV5` union
- **Files modified:** 5 files listed above

**3. [Rule 1 - Bug] Updated save-file-manager.test.ts mock data**
- **Found during:** Task 3 (tsc check)
- **Issue:** Mock had `version: 4` and no `narrativeState`; `readSaveData` now parses against `SaveDataV5Schema`
- **Fix:** Updated mock to `version: 5` with `narrativeState` default values

## Pre-existing Errors (not caused by this plan)

Confirmed pre-existing via `git stash` verification:
- `src/ai/summarizer/summarizer-worker.ts` — `TurnLogEntry.narration` missing
- `src/engine/action-handlers/quest-handler.test.ts` — `QuestSystem.cleanup` optional vs required
- `src/game-loop.test.ts` — `QuestSystem.cleanup` missing in mock (3 locations)

## Known Stubs

None — all narrativeState fields flow through from the watcher to stored state correctly.

## Threat Flags

None — no new network endpoints or auth paths introduced.

## Self-Check: PASSED

Files confirmed present:
- src/state/narrative-state.ts ✓
- src/engine/narrative-state-watcher.ts ✓
- world-data/narrative-transitions.yaml ✓
- Commit 0592f24 ✓ (19 files changed, 532 insertions)
- Tests: 1048 pass, 0 fail ✓
