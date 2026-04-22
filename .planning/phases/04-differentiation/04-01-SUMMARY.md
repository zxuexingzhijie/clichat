---
phase: "04"
plan: "01"
subsystem: "state/types"
tags: [stores, schemas, events, branch, exploration, knowledge]
dependency_graph:
  requires: []
  provides: [BranchStore, ExplorationStore, PlayerKnowledgeStore, extended-GameActionType, extended-GamePhase, extended-DomainEvents]
  affects: [game-store, event-types, game-action]
tech_stack:
  added: []
  patterns: [createStore-with-onChange-events, zod-enum-extension]
key_files:
  created:
    - src/state/branch-store.ts
    - src/state/exploration-store.ts
    - src/state/player-knowledge-store.ts
    - src/state/branch-store.test.ts
    - src/state/exploration-store.test.ts
    - src/state/player-knowledge-store.test.ts
  modified:
    - src/types/game-action.ts
    - src/events/event-types.ts
    - src/state/game-store.ts
decisions:
  - "BranchStore default state includes 'main' branch with Chinese description"
  - "ExplorationStore uses 5-level enum: unknown/rumored/known/visited/surveyed"
  - "PlayerKnowledgeStore emits knowledge_discovered only on new entries, not updates"
  - "branch_deleted event emitted when branch key removed from state"
metrics:
  duration: "3m 8s"
  completed: "2026-04-22T04:46:07Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 36
  tests_total: 454
---

# Phase 4 Plan 01: Type Contracts & State Stores Summary

Three new domain stores and extended type contracts for all Phase 4 differentiation features -- branch management, fog-of-war exploration, and player knowledge tracking with epistemic credibility.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 42addb3 | Extend GameActionType (+5), GamePhase (+5), DomainEvents (+6) |
| 2 | 2bd36f4 | Create BranchStore, ExplorationStore, PlayerKnowledgeStore + 36 tests |

## Task Details

### Task 1: Extend GameActionTypeSchema, GamePhaseSchema, and DomainEvents

Extended three existing type definitions:

- **GameActionTypeSchema**: Added `branch`, `compare`, `map`, `codex`, `replay` (5 new actions)
- **GamePhaseSchema**: Added `map`, `codex`, `branch_tree`, `compare`, `shortcuts` (5 new phases)
- **DomainEvents**: Added `branch_created`, `branch_switched`, `branch_deleted`, `knowledge_discovered`, `location_explored`, `location_discovery_level_changed` (6 new events)

### Task 2: Create BranchStore, ExplorationStore, PlayerKnowledgeStore

Created 3 new stores following the established createStore + immer + eventBus pattern:

- **BranchStore**: Holds branch registry with metadata (id, name, parent, save pointers, timestamps). Default state includes `main` branch. Emits `branch_created`, `branch_switched`, `branch_deleted` on state changes.
- **ExplorationStore**: Tracks 5-level fog-of-war discovery per location (unknown -> rumored -> known -> visited -> surveyed). Emits `location_explored` for new locations, `location_discovery_level_changed` for level upgrades.
- **PlayerKnowledgeStore**: Tracks player-discovered knowledge with credibility scores and epistemic status (heard/suspected/confirmed/contradicted). Emits `knowledge_discovered` for new entries only.

All stores include Zod schemas for validation at save/load boundaries per threat model T-04-01/02/03.

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all stores are fully functional with real schemas and event emission.

## Test Results

- 36 new tests across 3 test files
- 454 total tests passing (418 existing + 36 new)
- 0 failures

## Self-Check: PASSED

All 9 files verified present. Both commit hashes (42addb3, 2bd36f4) confirmed in git log.
