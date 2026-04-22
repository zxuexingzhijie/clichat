---
phase: "04"
plan: "04"
subsystem: "engine/trackers"
tags: [exploration, knowledge, event-driven, trackers, fog-of-war]
dependency_graph:
  requires: [ExplorationStore, PlayerKnowledgeStore, eventBus, gameStore]
  provides: [initExplorationTracker, markLocationLevel, initKnowledgeTracker, addKnowledge]
  affects: [exploration-store, player-knowledge-store]
tech_stack:
  added: []
  patterns: [event-listener-init-pattern, level-ranking-guard, cleanup-function-return]
key_files:
  created:
    - src/engine/exploration-tracker.ts
    - src/engine/exploration-tracker.test.ts
    - src/engine/knowledge-tracker.ts
    - src/engine/knowledge-tracker.test.ts
  modified: []
decisions:
  - "initExplorationTracker and initKnowledgeTracker return cleanup functions (unlike memory-persistence which does not)"
  - "ExplorationTracker preserves original discoveredAt when upgrading level (e.g., rumored -> visited keeps first discovery turn)"
  - "KnowledgeTracker deduplicates by codexEntryId; null codexEntryId entries always create new records"
  - "contradicted status overrides any existing status regardless of rank ordering"
metrics:
  duration: "2m 32s"
  completed: "2026-04-22T04:53:07Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 16
  tests_total: 470
---

# Phase 4 Plan 04: Event-Driven Trackers Summary

Event-driven ExplorationTracker and KnowledgeTracker that automatically update stores from gameplay events -- location discovery on scene_changed, knowledge acquisition from dialogue/quests/exploration with epistemic status ranking.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (RED) | c876f89 | Failing tests for ExplorationTracker (8 tests) |
| 1 (GREEN) | 9edcf15 | Implement ExplorationTracker with scene_changed listener and markLocationLevel |
| 2 (RED) | f8965c5 | Failing tests for KnowledgeTracker (8 tests) |
| 2 (GREEN) | 4cf9d1e | Implement KnowledgeTracker with 4-event listener and addKnowledge |

## Task Details

### Task 1: ExplorationTracker

Created `src/engine/exploration-tracker.ts` following the memory-persistence.ts event listener pattern:

- **initExplorationTracker()**: Subscribes to `scene_changed` events. On each scene change, marks the location as `visited` in ExplorationStore unless already at `visited` or `surveyed` level.
- **markLocationLevel()**: Programmatic API for setting exploration levels (e.g., NPC tells player about a location -> `rumored`). Respects level ordering and never downgrades.
- Level ranking: `unknown(0) < rumored(1) < known(2) < visited(3) < surveyed(4)`.
- Returns cleanup function for listener removal (improvement over memory-persistence pattern).

### Task 2: KnowledgeTracker

Created `src/engine/knowledge-tracker.ts` listening to 4 event types:

- **dialogue_ended**: Adds `heard` entry (credibility 0.6, codexEntryId = npcId)
- **quest_stage_advanced**: Adds `suspected` entry (credibility 0.8, null codexEntryId)
- **quest_completed**: Adds `confirmed` entry (credibility 1.0, null codexEntryId)
- **scene_changed**: Adds `confirmed` entry (credibility 1.0, codexEntryId = sceneId)
- **addKnowledge()**: Public API with deduplication by codexEntryId and status ranking (heard < suspected < confirmed < contradicted). Contradicted always overrides.

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- both trackers are fully functional with real store writes and event handling.

## TDD Gate Compliance

Both tasks followed RED-GREEN cycle:
- Task 1: `test(04-04)` commit c876f89 (RED) -> `feat(04-04)` commit 9edcf15 (GREEN)
- Task 2: `test(04-04)` commit f8965c5 (RED) -> `feat(04-04)` commit 4cf9d1e (GREEN)

No refactor phase needed -- implementations are minimal and clean.

## Test Results

- 16 new tests across 2 test files (8 exploration + 8 knowledge)
- 470 total tests passing (454 existing + 16 new)
- 0 failures

## Self-Check: PASSED

All 4 files verified present. All 4 commit hashes (c876f89, 9edcf15, f8965c5, 4cf9d1e) confirmed in git log.
