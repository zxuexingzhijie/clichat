---
phase: 03-persistence-world
plan: "05"
subsystem: persistence
tags: [serializer, save-migration, v2-schema, quest-store, relation-store, tdd]
dependency_graph:
  requires:
    - 03-03 (QuestStateSchema, QuestEventSchema, questEventLog, resetQuestEventLog)
    - 03-04 (RelationStateSchema, getDefaultRelationState)
    - 03-01 (NpcMemoryStateSchema, getDefaultNpcMemoryState)
  provides:
    - SaveDataV2Schema with version:2, meta envelope, 8 stores, questEventLog
    - SaveMetaSchema (saveName, timestamp, character, playtime, locationName)
    - createSerializer accepting 8 stores + getQuestEventLog callback
    - migrateV1ToV2 transparent v1->v2 migration
    - restoreQuestEventLog utility for clean event log restoration
  affects:
    - src/state/serializer.ts
    - src/state/serializer.test.ts
    - src/persistence/save-migrator.ts
    - src/persistence/save-migrator.test.ts
    - src/state/quest-store.ts
    - src/e2e/phase1-verification.test.ts
tech_stack:
  added: []
  patterns:
    - TDD (RED/GREEN per task)
    - Zod schema literal version discriminator
    - Defensive migration with optional chaining
    - Immutable event log restore via spread
key_files:
  created:
    - src/persistence/save-migrator.ts
    - src/persistence/save-migrator.test.ts
  modified:
    - src/state/serializer.ts
    - src/state/serializer.test.ts
    - src/state/quest-store.ts
    - src/e2e/phase1-verification.test.ts
decisions:
  - restoreQuestEventLog added to quest-store.ts (not appendQuestEvent) -- preserves original event ids/timestamps from save file
  - migrateV1ToV2 uses identity passthrough for non-v1 and null input -- safe for future version chains
  - playtime hardcoded to 0 in snapshot meta -- accurate tracking deferred to Phase 5 per plan spec
  - SaveDataSchema (v1) kept in serializer.ts for backward-compatibility reference (not exported, not used in new code)
metrics:
  duration: 18m
  completed_date: "2026-04-21"
  tasks_completed: 2
  tasks_total: 2
  tests_before: 322
  tests_after: 366
---

# Phase 03 Plan 05: Serializer v2 + Save Migrator Summary

SaveDataV2Schema with all 8 stores + meta envelope + questEventLog, upgraded createSerializer, and migrateV1ToV2 for transparent v1 save file loading.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for save-migrator v1->v2 | a70a8ba | src/persistence/save-migrator.test.ts |
| 1 (GREEN) | Implement save-migrator.ts | 0c4fae8 | src/persistence/save-migrator.ts |
| 2 (RED) | Failing tests for serializer v2 upgrade | 7adcc7e | src/state/serializer.test.ts |
| 2 (GREEN) | Upgrade serializer to SaveDataV2 | 2fe449f | src/state/serializer.ts, src/state/quest-store.ts, src/e2e/phase1-verification.test.ts |

## Verification

- `bun test src/persistence/save-migrator.test.ts` -- 12 tests, 0 failures
- `bun test src/state/serializer.test.ts` -- 15 tests, 0 failures
- `bun test` -- 366 tests, 0 failures (up from 322 baseline, +44 new tests)
- `grep -n "version: z.literal(2)" src/state/serializer.ts` -- FOUND (line 31)
- `grep -n "relations" src/state/serializer.ts` -- FOUND in both snapshot() and restore()
- `grep -n "migrateV1ToV2" src/state/serializer.ts` -- FOUND (lines 10, 101)

## What Was Built

**SaveMetaSchema** -- envelope for save file identity:
- `saveName`, `timestamp`, `character` (name/race/profession), `playtime`, `locationName`

**SaveDataV2Schema** -- full v2 save object:
- `version: 2` (Zod literal)
- `meta: SaveMetaSchema`
- All 8 store states: `player`, `scene`, `combat`, `game`, `quest`, `relations`, `npcMemorySnapshot`
- `questEventLog: QuestEvent[]`
- `externalRefs` (optional, for future world/rules pack tracking)

**createSerializer** -- upgraded to 8-store + event log:
- Accepts `{ player, scene, combat, game, quest, relations, npcMemory }` stores + `getQuestEventLog` callback
- `snapshot()` builds meta from current player/scene/game state; produces v2 JSON
- `restore()` calls `migrateV1ToV2` before `SaveDataV2Schema.safeParse`; restores all 8 stores + event log

**migrateV1ToV2** (`src/persistence/save-migrator.ts`):
- Detects `version === 1`, injects: `version: 2`, meta envelope (from v1 player/scene fields), `quest`/`relations`/`npcMemorySnapshot` defaults, `questEventLog: []`
- Identity passthrough for non-v1 objects and null/primitives

**restoreQuestEventLog** -- added to `quest-store.ts`:
- Replaces questEventLog with an immutable spread of the provided array
- Enables clean roundtrip restoration without losing original event ids/timestamps

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated phase1-verification.test.ts for new createSerializer signature**

- **Found during:** Task 2 GREEN -- full suite run
- **Issue:** `src/e2e/phase1-verification.test.ts` used old 4-store `createSerializer` signature; also asserted `version: 1` on snapshot output. Both broke after the serializer upgrade.
- **Fix:** Updated all 3 `createSerializer` calls to 8-store signature with `getQuestEventLog` callback. Changed `version: 1` assertion to `version: 2`.
- **Files modified:** `src/e2e/phase1-verification.test.ts`
- **Commit:** 2fe449f

**2. [Rule 2 - Missing functionality] Added restoreQuestEventLog to quest-store.ts**

- **Found during:** Task 2 GREEN -- `require()` approach for event log restoration was fragile in ESM
- **Issue:** Plan specified "resetQuestEventLog() then re-populate from data.questEventLog (push each event)" but `questEventLog` is a `let` export -- pushing to a re-assigned module-level variable across ESM module boundaries is not reliable. `appendQuestEvent` generates new ids/timestamps, losing fidelity.
- **Fix:** Added `restoreQuestEventLog(events: QuestEvent[])` to `quest-store.ts` that replaces the log via immutable spread. Called from `restore()` after `resetQuestEventLog()`.
- **Files modified:** `src/state/quest-store.ts`
- **Commit:** 2fe449f

## TDD Gate Compliance

- Task 1 RED gate: `test(03-05)` commit a70a8ba -- PASS
- Task 1 GREEN gate: `feat(03-05)` commit 0c4fae8 -- PASS
- Task 2 RED gate: `test(03-05)` commit 7adcc7e -- PASS
- Task 2 GREEN gate: `feat(03-05)` commit 2fe449f -- PASS

## Known Stubs

- `playtime: 0` in snapshot meta -- hardcoded per plan spec; accurate tracking deferred to Phase 5.
- `saveName: 'Quick Save'` in snapshot meta -- default value; save-file-manager (future plan) will provide the actual name.

## Threat Flags

None -- threat mitigations T-03-09 and T-03-10 are both implemented as planned:
- T-03-09: `SaveDataV2Schema.safeParse` with first-issue error reporting in `restore()`
- T-03-10: `migrateV1ToV2` uses optional chaining for all v1 field reads; unknown fields are spread through; Zod validates result

## Self-Check: PASSED
