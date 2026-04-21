---
phase: 03-persistence-world
plan: "04"
subsystem: reputation
tags: [relation-store, reputation-system, tdd, events, pure-functions]
dependency_graph:
  requires:
    - src/events/event-types.ts (reputation_changed event — Plan 03-01)
    - src/state/create-store.ts
    - src/events/event-bus.ts
  provides:
    - RelationStore with NpcDispositionSchema and RelationStateSchema
    - getAttitudeLabel pure function
    - applyReputationDelta pure function
    - filterResponsesByReputation pure function
  affects:
    - src/state/relation-store.ts (new)
    - src/engine/reputation-system.ts (new)
tech_stack:
  added: []
  patterns:
    - TDD (RED/GREEN cycle)
    - createStore pattern (game-store.ts analog)
    - Pure functions with no store imports (rules-engine.ts analog)
    - Zod schema validation with range constraints
key_files:
  created:
    - src/state/relation-store.ts
    - src/state/relation-store.test.ts
    - src/engine/reputation-system.ts
    - src/engine/reputation-system.test.ts
  modified: []
decisions:
  - getAttitudeLabel uses strict less-than for all thresholds — boundary values (-60, -20, 20, 60) belong to the higher tier (冷漠, 中立, 友好, 信任 respectively)
  - applyReputationDelta applies Math.min/Math.max clamping per-field to satisfy T-03-07 threat mitigation
  - factionReputations uses a flat number record (not NpcDisposition) — factions have single aggregate score, not 6-dimensional disposition
metrics:
  duration: 4m
  completed_date: "2026-04-21"
  tasks_completed: 2
  tasks_total: 2
  tests_before: 291
  tests_after: 322
---

# Phase 03 Plan 04: RelationStore and ReputationSystem Summary

RelationStore with 6-dimensional NPC disposition and faction reputation tracking, emitting `reputation_changed` events on value changes; plus pure functions for attitude labeling, delta application (immutable, clamped), and response filtering by reputation gate.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Failing tests for RelationStore + ReputationSystem | ccfc6c6 | src/state/relation-store.test.ts, src/engine/reputation-system.test.ts |
| GREEN | Implement both modules to pass all tests | e3d7ea0 | src/state/relation-store.ts, src/engine/reputation-system.ts |

## Verification

- `bun test src/state/relation-store.test.ts` — 10 pass, 0 fail
- `bun test src/engine/reputation-system.test.ts` — 21 pass, 0 fail
- `grep -n "reputation_changed" src/state/relation-store.ts` — FOUND (lines 42, 59)
- `grep -n "getAttitudeLabel" src/engine/reputation-system.ts` — FOUND (line 3)
- `grep -n "applyReputationDelta" src/engine/reputation-system.ts` — FOUND (line 11)
- `bun test` (full suite) — 319 pass, 3 fail (3 failures are pre-existing in event-bus.test.ts, unrelated to this plan)

## What Was Built

**RelationStore** (`src/state/relation-store.ts`):
- `NpcDispositionSchema` — 6-field Zod object (value, publicReputation, personalTrust, fear, infamy, credibility), all `z.number().min(-100).max(100)`
- `RelationStateSchema` — `{ npcDispositions: Record<string, NpcDisposition>, factionReputations: Record<string, number(-100..100)> }`
- `getDefaultNpcDisposition()` — all-zero NpcDisposition
- `getDefaultRelationState()` — `{ npcDispositions: {}, factionReputations: {} }`
- `relationStore` — createStore instance; onChange iterates all changed NPC `value` fields and all changed faction values, emitting `reputation_changed` with `{ targetId, targetType, delta, newValue }`

**ReputationSystem** (`src/engine/reputation-system.ts`):
- `getAttitudeLabel(value)` — returns `'敌视'/'冷漠'/'中立'/'友好'/'信任'` using strict less-than thresholds: `< -60`, `< -20`, `< 20`, `< 60`
- `applyReputationDelta(current, delta)` — returns new `NpcDisposition` with each field = `clamp(current[f] + delta[f] ?? 0)`, never mutates input
- `filterResponsesByReputation(responses, dispositionValue)` — maps responses to `T & { locked: boolean }`, `locked=true` when `dispositionValue < r.minReputation`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] getAttitudeLabel threshold boundaries corrected to strict less-than**

- **Found during:** GREEN phase — tests for boundaries 20 and 60 failed
- **Issue:** Plan spec said thresholds `-60/-20/20/60` but didn't clarify direction. Initial implementation used `<= 20` and `<= 60` for 中立/友好. Test assertions showed 20 → 友好 and 60 → 信任, requiring `< 20` and `< 60`.
- **Fix:** Changed all upper-bound checks to strict less-than: `< -60`, `< -20`, `< 20`, `< 60`.
- **Files modified:** `src/engine/reputation-system.ts`
- **Commit:** e3d7ea0

## TDD Gate Compliance

- RED gate: `test(03-04)` commit ccfc6c6 — PASS
- GREEN gate: `feat(03-04)` commit e3d7ea0 — PASS

## Known Stubs

None — this plan implements pure logic and store with no UI rendering or data source wiring.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns. Reputation clamping (T-03-07) is implemented via Math.min/Math.max in `applyReputationDelta` and Zod range constraints in schemas.

## Self-Check: PASSED
