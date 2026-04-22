---
phase: 04-differentiation
plan: "06"
subsystem: engine
tags: [branch-diff, turn-log, replay, save-system]
dependency_graph:
  requires: [04-03]
  provides: [compareBranches, appendTurnLog, getTurnLog, replayTurns, resetTurnLog, restoreTurnLog]
  affects: [save-file-manager, game-loop]
tech_stack:
  added: []
  patterns: [pure-function-comparison, bounded-log, immutable-copies]
key_files:
  created:
    - src/engine/branch-diff.ts
    - src/engine/branch-diff.test.ts
    - src/engine/turn-log.ts
    - src/engine/turn-log.test.ts
  modified: []
decisions:
  - "HIGH_IMPACT_RELATION_DELTA=20 threshold for NPC relation high-impact flag"
  - "HIGH_IMPACT_KNOWLEDGE_TRANSITIONS includes heard->confirmed, suspected->confirmed, heard->contradicted, suspected->contradicted"
  - "Inventory diff compares equipment slots + tags + gold, not a flat item array (player state uses equipment record, not inventory array)"
  - "Turn log uses module-level mutable array (same pattern as questEventLog) with immutable return copies"
metrics:
  duration: "3m"
  completed: "2026-04-22T05:07:04Z"
---

# Phase 4 Plan 06: Branch Diff Engine & Turn Log Summary

Pure-function branch comparison across 6 dimensions (quest/npc_relation/inventory/location/faction/knowledge) with DiffItem markers and impact classification, plus bounded turn log (50 entries) for replay support.

## Completed Tasks

| Task | Name | Commit | Test Count |
|------|------|--------|------------|
| 1 | Branch diff with 6-dimension comparison | e9270c8 | 12 |
| 2 | Turn log for replay support | bb42cc5 | 10 |

## Implementation Details

### Branch Diff Engine (branch-diff.ts)

`compareBranches(source, target)` takes two `SaveDataV3` snapshots and produces a `BranchDiffResult` with:
- `DiffItem[]` with category, marker (+/-/~), key, description, isHighImpact, sourceValue/targetValue
- 6 comparison dimensions: quest progress, NPC dispositions, equipment/tags/gold, scene location, faction reputation, player knowledge
- High-impact classification: quest active->completed/failed, NPC relation delta >= 20, knowledge status transitions (heard->confirmed)

### Turn Log (turn-log.ts)

Module-level bounded log capped at `MAX_TURN_LOG_SIZE=50` entries (mitigates T-04-16 DoS threat):
- `appendTurnLog`: adds timestamped entry, trims oldest when cap exceeded
- `getTurnLog`/`replayTurns(n)`: return immutable copies
- `restoreTurnLog`: for save file restoration, enforces cap
- `resetTurnLog`: clears log

## TDD Gate Compliance

- RED: `test(04-06)` tests written first, confirmed failing (module not found)
- GREEN: `feat(04-06)` implementation passes all tests
- Both tasks followed RED->GREEN sequence

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Inventory comparison adapted to actual data model**
- **Found during:** Task 1 implementation
- **Issue:** Plan assumed `player.inventory` array, but actual PlayerState uses `equipment` record (slot->item map) + `tags` array + `gold` number
- **Fix:** compareInventory compares equipment slots, tags, and gold instead of a flat inventory array
- **Files modified:** src/engine/branch-diff.ts
- **Commit:** e9270c8

## Verification

- `bun test src/engine/branch-diff.test.ts` -- 12 pass
- `bun test src/engine/turn-log.test.ts` -- 10 pass
- `bun test --bail` -- 524 pass, 0 fail

## Self-Check: PASSED

- [x] src/engine/branch-diff.ts exists
- [x] src/engine/branch-diff.test.ts exists
- [x] src/engine/turn-log.ts exists
- [x] src/engine/turn-log.test.ts exists
- [x] Commit e9270c8 found in git log
- [x] Commit bb42cc5 found in git log
