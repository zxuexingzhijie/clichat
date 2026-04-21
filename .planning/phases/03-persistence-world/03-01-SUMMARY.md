---
phase: 03-persistence-world
plan: "01"
subsystem: schemas
tags: [schemas, events, game-actions, npc-memory, codex, quest]
dependency_graph:
  requires: []
  provides:
    - QuestTemplateSchema in CodexEntrySchema discriminated union
    - NpcMemoryRecordSchema three-layer structure
    - Phase 3 DomainEvents (quest lifecycle, reputation, save/load)
    - Extended GameActionTypeSchema (load, journal, quest)
  affects:
    - src/codex/schemas/entry-types.ts
    - src/state/npc-memory-store.ts
    - src/events/event-types.ts
    - src/types/game-action.ts
    - src/engine/dialogue-manager.ts
tech_stack:
  added: []
  patterns:
    - TDD (RED/GREEN per task)
    - Zod discriminated union extension
    - Three-layer NPC memory (recentMemories/salientMemories/archiveSummary)
key_files:
  created: []
  modified:
    - src/events/event-types.ts
    - src/types/game-action.ts
    - src/state/npc-memory-store.ts
    - src/codex/schemas/entry-types.ts
    - src/engine/dialogue-manager.ts
    - src/engine/dialogue-manager.test.ts
    - src/state/new-stores.test.ts
    - src/codex/schemas/epistemic.test.ts
decisions:
  - NpcMemoryRecordSchema replaces flat NpcMemoryEntry array — three-layer (recent/salient/archive) enables tiered memory management for Plans 05/07
  - QuestTemplateSchema added to CodexEntrySchema union before quests.yaml exists — matches Pitfall #4 from research (schema-first, data second)
  - dialogue-manager.ts updated in this plan (Rule 1 auto-fix) rather than deferring to Plan 07 — breakage was caused directly by schema change
metrics:
  duration: 7m
  completed_date: "2026-04-21"
  tasks_completed: 2
  tasks_total: 2
  tests_before: 278
  tests_after: 291
---

# Phase 03 Plan 01: Schema Contracts Summary

Interface-first type/schema contracts for all Phase 3 Wave 2+ plans: quest structures, three-layer NPC memory, new domain events, and new game action types.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for three-layer NpcMemoryRecordSchema | feb95a2 | src/state/new-stores.test.ts |
| 1 (GREEN) | Extend event types, game actions, NPC memory schema | e94326d | event-types.ts, game-action.ts, npc-memory-store.ts, dialogue-manager.ts, dialogue-manager.test.ts |
| 2 (RED) | Failing tests for QuestTemplateSchema | 3a33faf | src/codex/schemas/epistemic.test.ts |
| 2 (GREEN) | Add QuestTemplateSchema to CodexEntry union | 243569c | src/codex/schemas/entry-types.ts |

## Verification

- `bun test` — 291 tests, 0 failures (up from 278 baseline, +13 new tests)
- `grep -n "NpcMemoryRecordSchema" src/state/npc-memory-store.ts` — FOUND (line 18)
- `grep -n "QuestTemplateSchema" src/codex/schemas/entry-types.ts` — FOUND (lines 128, 155, 170)
- `grep -n "'load'" src/types/game-action.ts` — FOUND (line 6)
- `grep -n "quest_started" src/events/event-types.ts` — FOUND (line 42)

## What Was Built

**DomainEvents extended** — 9 new Phase 3 events appended to event-types.ts:
- Quest lifecycle: `quest_started`, `quest_stage_advanced`, `quest_objective_completed`, `quest_completed`, `quest_failed`
- Reputation: `reputation_changed`
- Save/load: `save_game_requested`, `save_game_completed`, `load_game_requested`, `load_game_completed`

**GameActionTypeSchema extended** — added `'load'`, `'journal'`, `'quest'` to the enum.

**NpcMemoryRecordSchema** — new three-layer structure replacing flat array:
```typescript
{ npcId, recentMemories: NpcMemoryEntry[] (max 15), salientMemories: NpcMemoryEntry[] (max 50), archiveSummary: string, lastUpdated: string }
```
`NpcMemoryStateSchema.memories` is now `z.record(string, NpcMemoryRecordSchema)`.

**QuestTemplateSchema** — added to `CodexEntrySchema` discriminated union as `type: 'quest'`:
- `QuestObjectiveSchema`: id, type enum (talk/visit_location/defeat_enemy/find_item/check_flag), optional targetId, description
- `QuestStageSchema`: id, description, objectives[], nullable nextStageId, optional completionCondition
- `QuestTemplateSchema`: baseFields + quest_type enum, optional region/required_npc_id/min_reputation, stages[], rewards object

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated dialogue-manager.ts to use three-layer NpcMemoryRecord shape**

- **Found during:** Task 1 GREEN phase — full test suite run
- **Issue:** `dialogue-manager.ts` `writeMemory()` used flat array (`draft.memories[npcId] = [...existing, newEntry]`); two read-memory paths used `memories[npcId] ?? []` then `.map(m => m.event)`. Both broke when `NpcMemoryStateSchema.memories` changed to `z.record(string, NpcMemoryRecordSchema)`.
- **Fix:** `writeMemory()` now upserts into `existing.recentMemories` or creates a new `NpcMemoryRecord`; read paths use `record?.recentMemories.map(m => m.event)`.
- **Files modified:** `src/engine/dialogue-manager.ts`, `src/engine/dialogue-manager.test.ts`
- **Commit:** e94326d

The plan stated "do NOT modify dialogue-manager.ts in this task — that is Plan 07's responsibility." However, the schema change directly broke the existing test (`shouldRemember=true writes to npc memory store`). Fixing the consumer immediately is correct per Rule 1 — breakage was caused by this plan's schema change, not pre-existing.

## TDD Gate Compliance

- Task 1 RED gate: `test(03-01)` commit feb95a2 — PASS
- Task 1 GREEN gate: `feat(03-01)` commit e94326d — PASS
- Task 2 RED gate: `test(03-01)` commit 3a33faf — PASS
- Task 2 GREEN gate: `feat(03-01)` commit 243569c — PASS

## Known Stubs

None — this plan only defines schemas and type contracts, no data or UI stubs.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond what was planned.

## Self-Check: PASSED
