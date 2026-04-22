---
phase: 05-polish
plan: "01"
subsystem: state
tags: [zod, schema, migration, serializer, npc-memory, game-store, event-types]

requires:
  - phase: 03-persistence
    provides: SaveDataV3Schema, NpcMemoryRecordSchema, TurnLogEntrySchema, save-migrator pattern
provides:
  - TurnLogEntrySchema with optional npcDialogue field
  - NpcMemoryRecordSchema with version field (int, default 0)
  - GamePhaseSchema with 'replay' and 'cost' values
  - GameActionTypeSchema with 'cost' value
  - DomainEvents token_usage_updated and summarizer_task_completed
  - SaveDataV4Schema and migrateV3ToV4 wired in restore() chain
affects: [05-02, 05-03, 05-04, 05-05, 05-06, 05-07]

tech-stack:
  added: []
  patterns:
    - "SaveDataVN.extend({version: z.literal(N)}) pattern for schema versioning"
    - "migrateVNtoVN+1: identity migration when fields are optional/defaulted"

key-files:
  created:
    - src/state/npc-memory-store.test.ts
  modified:
    - src/state/serializer.ts
    - src/state/npc-memory-store.ts
    - src/state/game-store.ts
    - src/events/event-types.ts
    - src/types/game-action.ts
    - src/persistence/save-migrator.ts
    - src/state/serializer.test.ts
    - src/e2e/phase1-verification.test.ts

key-decisions:
  - "V3→V4 is a no-op migration: npcDialogue is optional, version field uses .default(0), so no backfill needed"
  - "SaveDataV4Schema uses .extend({version: z.literal(4)}) over SaveDataV3Schema to avoid field duplication"

patterns-established:
  - "Schema version bump: extend prior schema, update snapshot() type annotation and version literal, add migration function, chain in restore()"

requirements-completed: [AI-04, LLM-01, LLM-02, SAVE-04]

duration: 5min
completed: 2026-04-22
---

# Phase 05 Plan 01: Schema Extensions and V4 Migration Summary

**Zod schema contract extensions across 5 files for Phase 5: npcDialogue on TurnLogEntry, version on NpcMemoryRecord, replay/cost phases, token_usage_updated event, SaveDataV4 with V3→V4 migration**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-22T11:09:11Z
- **Completed:** 2026-04-22T11:13:57Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Extended 5 schema files with new fields/values required by all Phase 5 plans (Wave 1 contract-first)
- Added SaveDataV4Schema and migrateV3ToV4 — snapshot() now outputs version 4; V3 saves migrate transparently
- Created npc-memory-store.test.ts (previously missing) with 4 tests for NpcMemoryRecordSchema.version behavior

## Task Commits

1. **RED: failing tests for schema extensions and V4 migration** - `656f584` (test)
2. **Task 1 + Task 2: schema extensions and V3→V4 migration** - `0ff9802` (feat)

## Files Created/Modified

- `src/state/serializer.ts` — npcDialogue in TurnLogEntrySchema, SaveDataV4Schema, migrateV3ToV4 import+chain, snapshot() uses version 4
- `src/state/npc-memory-store.ts` — version field added to NpcMemoryRecordSchema
- `src/state/game-store.ts` — GamePhaseSchema now includes 'replay' and 'cost'
- `src/events/event-types.ts` — DomainEvents gains token_usage_updated and summarizer_task_completed
- `src/types/game-action.ts` — GameActionTypeSchema gains 'cost'
- `src/persistence/save-migrator.ts` — migrateV3ToV4 function added
- `src/state/npc-memory-store.test.ts` — created with NpcMemoryRecordSchema.version tests
- `src/state/serializer.test.ts` — updated to SaveDataV4Schema, new npcDialogue and V4 migration tests
- `src/e2e/phase1-verification.test.ts` — updated version assertion from 3 to 4

## Decisions Made

- V3→V4 migration is a no-op (only bumps version number). npcDialogue is `.optional()` so absent in old saves; NpcMemoryRecord.version uses `.default(0)` so old records without the field are valid.
- Committed Tasks 1 and 2 together in a single feat commit since Task 2 (migrateV3ToV4) is the prerequisite import for the serializer changes in Task 1 — splitting would have produced a broken intermediate state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated two existing tests asserting version: 3 after snapshot() was upgraded to version: 4**
- **Found during:** GREEN phase verification
- **Issue:** `serializer.test.ts` line 41 expected `version: 3`; `phase1-verification.test.ts` line 176 expected `version: 3` — both correct assertions for the old behavior but now stale
- **Fix:** Updated both assertions to `version: 4`
- **Files modified:** src/state/serializer.test.ts, src/e2e/phase1-verification.test.ts
- **Verification:** 583 tests, 0 failures
- **Committed in:** 0ff9802

---

**Total deviations:** 1 auto-fixed (Rule 1 - stale test assertions)
**Impact on plan:** Necessary correctness fix — the tests were testing the old version number, not a different behavior. No scope creep.

## Issues Encountered

None beyond the stale test assertions above.

## Next Phase Readiness

All Wave 1 type contracts are in place. Wave 2 plans (cost-session-store, replay-viewer, summarizer-agent, multi-provider routing, performance dashboard) can import and build against these schemas without further contract changes.

---
*Phase: 05-polish*
*Completed: 2026-04-22*

## Self-Check: PASSED

- FOUND: src/state/serializer.ts
- FOUND: src/persistence/save-migrator.ts
- FOUND: src/state/npc-memory-store.test.ts
- FOUND: .planning/phases/05-polish/05-01-SUMMARY.md
- FOUND commit: 656f584 (RED tests)
- FOUND commit: 0ff9802 (feat implementation)
- 583 tests, 0 failures
