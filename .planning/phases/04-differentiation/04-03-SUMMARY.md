---
phase: 04-differentiation
plan: 03
subsystem: persistence
tags: [save-system, branch-engine, schema-migration]
dependency_graph:
  requires: [04-01]
  provides: [SaveDataV3Schema, TurnLogEntrySchema, BranchManager]
  affects: [serializer, save-migrator, save-file-manager]
tech_stack:
  added: []
  patterns: [schema-versioned-migration, branch-tree-builder, path-traversal-guard]
key_files:
  created:
    - src/persistence/branch-manager.ts
    - src/persistence/branch-manager.test.ts
  modified:
    - src/state/serializer.ts
    - src/persistence/save-migrator.ts
    - src/persistence/save-migrator.test.ts
    - src/state/serializer.test.ts
    - src/e2e/phase1-verification.test.ts
decisions:
  - "V2->V3 migration uses inline defaults rather than importing getDefault* functions for simplicity"
  - "createSerializer signature extended with getTurnLog, getBranchId, getParentSaveId callback params"
  - "BranchManager uses branchStore directly rather than accepting store as param (matches save-file-manager pattern)"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-22T04:55:14Z"
  tasks_completed: 2
  tasks_total: 2
  test_count_before: 454
  test_count_after: 486
---

# Phase 04 Plan 03: Branch Engine Summary

SaveDataV3 schema with branch metadata/turn-log, V2->V3 migration with default main branch, and BranchManager for full branch CRUD lifecycle.

## Task Results

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | SaveDataV3Schema, TurnLogEntrySchema, V2->V3 migration | f8c248a | serializer.ts, save-migrator.ts, save-migrator.test.ts |
| 2 | BranchManager for branch CRUD | 8b9093d | branch-manager.ts, branch-manager.test.ts |

## What Was Built

### SaveDataV3Schema (Task 1)

Extended save format adding:
- `branchId: string` — which branch this save belongs to
- `parentSaveId: string | null` — save this was branched from
- `exploration: ExplorationStateSchema` — location discovery state
- `playerKnowledge: PlayerKnowledgeStateSchema` — epistemic knowledge entries
- `turnLog: TurnLogEntrySchema[]` — per-turn action snapshots for SAVE-04 replay

`TurnLogEntrySchema` captures: turnNumber, action, checkResult (nullable), narrationLines, timestamp.

### V2->V3 Migration (Task 1)

`migrateV2ToV3` follows exact pattern of `migrateV1ToV2`:
- Only applies to objects with `version === 2`
- Sets `branchId: 'main'`, `parentSaveId: null`
- Injects empty `exploration`, `playerKnowledge`, `turnLog`
- Non-V2 objects pass through unchanged

Serializer now chains: `migrateV2ToV3(migrateV1ToV2(raw))`.

### BranchManager (Task 2)

Full branch lifecycle operations:
- `createBranch(name, description?)` — sanitizes name, generates nanoid, sets parent context, auto-switches
- `switchBranch(branchId)` — validates existence, updates currentBranchId
- `deleteBranch(branchId)` — blocks deleting current branch, validates existence
- `listBranches()` — returns all branches as array
- `getBranchTree()` — recursive tree builder from flat branch registry
- `updateBranchHead(branchId, saveId)` — tracks latest save per branch
- `saveBranchRegistry(saveDir)` / `loadBranchRegistry(saveDir)` — persists to branches.json with BranchStateSchema validation

Security mitigations:
- Branch name sanitization: `/[^a-zA-Z0-9\u4e00-\u9fff_-]/g` (same regex as save-file-manager)
- Path traversal guard on registry file I/O
- Schema validation on registry load with `BranchStateSchema.safeParse()`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated all createSerializer callers (serializer.test.ts, phase1-verification.test.ts)**
- **Found during:** Task 1
- **Issue:** Changing createSerializer signature broke all existing test files
- **Fix:** Updated freshStores() to include exploration/playerKnowledge stores, updated all createSerializer calls with new params, updated version assertions from 2 to 3
- **Files modified:** src/state/serializer.test.ts, src/e2e/phase1-verification.test.ts
- **Commit:** f8c248a

## Decisions Made

1. **V2->V3 inline defaults over getDefault* imports** — The migration function uses `{ locations: {} }` and `{ entries: {} }` inline rather than importing from store modules. This avoids circular dependency risk and keeps the migration self-contained.

2. **createSerializer callback params** — Added `getTurnLog`, `getBranchId`, `getParentSaveId` as separate callback params rather than embedding in stores object. This keeps the store object typed consistently while allowing the game loop to wire branch context.

3. **BranchManager uses module-level branchStore** — Follows the pattern established by save-file-manager rather than dependency injection. Simple and consistent with existing codebase.

## Known Stubs

None. All functions are fully implemented.

## Threat Flags

None. All threat model mitigations (T-04-06 through T-04-09) are implemented:
- T-04-06: Branch name sanitization with CJK-safe regex
- T-04-07: Path traversal guard on file I/O
- T-04-08: BranchStateSchema.safeParse() on registry load
- T-04-09: Migration only applies to version===2 objects

## Test Results

- **Before:** 454 tests, 0 failures
- **After:** 486 tests, 0 failures (+32 new tests)
  - 9 migrateV2ToV3 tests
  - 23 BranchManager tests

## Self-Check: PASSED

- [x] src/persistence/branch-manager.ts — FOUND
- [x] src/persistence/branch-manager.test.ts — FOUND
- [x] src/state/serializer.ts — modified, FOUND
- [x] src/persistence/save-migrator.ts — modified, FOUND
- [x] src/persistence/save-migrator.test.ts — modified, FOUND
- [x] .planning/phases/04-differentiation/04-03-SUMMARY.md — FOUND
- [x] Commit f8c248a — FOUND (Task 1)
- [x] Commit 8b9093d — FOUND (Task 2)
