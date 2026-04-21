---
phase: 03-persistence-world
plan: "07"
subsystem: engine
tags: [quest-system, dialogue-manager, command-registry, game-loop, reputation, npc-memory, tdd]
dependency_graph:
  requires:
    - 03-03 (questStore, appendQuestEvent, QuestProgress)
    - 03-04 (relationStore, applyReputationDelta, getDefaultNpcDisposition)
    - 03-06 (save-file-manager quickSave/saveGame/loadGame, Serializer interface)
  provides:
    - createQuestSystem factory (acceptQuest with reputation gate, completeObjective, advanceStage, failQuest)
    - dialogue-manager.endDialogue flushes session delta to RelationStore
    - dialogue-manager.startDialogue and processPlayerResponse inject recentMemories + salientMemories into NPC Actor AI call
    - command-registry :load, :journal, :quest commands
    - game-loop save/load/journal/quest action routing
  affects:
    - src/engine/quest-system.ts (created)
    - src/engine/quest-system.test.ts (created)
    - src/engine/dialogue-manager.ts (extended)
    - src/engine/dialogue-manager.test.ts (extended)
    - src/input/command-registry.ts (extended)
    - src/input/command-registry.test.ts (created)
    - src/game-loop.ts (extended)
    - src/game-loop.test.ts (extended)
    - src/state/game-store.ts (GamePhaseSchema extended)
tech_stack:
  added: []
  patterns:
    - TDD (RED/GREEN per task)
    - Factory function with DI (createQuestSystem — same pattern as createCombatLoop)
    - Session delta flush pattern (endDialogue captures npcId+delta before reset, flushes after)
    - Three-layer memory extraction (recentMemories + salientMemories events concatenated for NPC Actor)
key_files:
  created:
    - src/engine/quest-system.ts
    - src/engine/quest-system.test.ts
    - src/input/command-registry.test.ts
  modified:
    - src/engine/dialogue-manager.ts
    - src/engine/dialogue-manager.test.ts
    - src/input/command-registry.ts
    - src/game-loop.ts
    - src/game-loop.test.ts
    - src/state/game-store.ts
decisions:
  - questSystem and saveFileManager injected via GameLoopOptions — game-loop stays testable without real I/O
  - endDialogue reads npcId and delta BEFORE Object.assign reset to avoid reading cleared state
  - 'journal' added to GamePhaseSchema (was missing despite being used in plan requirements)
  - game-loop handleLook coerces null to undefined — GameAction.target is string|null but SceneManager.handleLook expects string|undefined
metrics:
  duration: 18m
  completed_date: "2026-04-21"
  tasks_completed: 2
  tasks_total: 2
  tests_before: 393
  tests_after: 413
---

# Phase 03 Plan 07: System Wiring Summary

Wire quest-system, dialogue-manager RelationStore flush, NPC memory injection, and Phase 3 commands into a playable system — players can accept quests with reputation gates, save/load, and NPC relationships and all three memory layers persist across dialogue sessions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for quest-system and dialogue-manager | e9a1947 | quest-system.test.ts, dialogue-manager.test.ts |
| 1 (GREEN) | Implement quest-system and extend dialogue-manager | 3cdeb8a | quest-system.ts, dialogue-manager.ts |
| 2 (RED) | Failing tests for command-registry and game-loop | 43dbd07 | command-registry.test.ts, game-loop.test.ts |
| 2 (GREEN) | Extend command-registry and game-loop | ac058b8 | command-registry.ts, game-loop.ts, game-store.ts |

## Verification

- `bun test src/engine/quest-system.test.ts` — 7 tests, 0 failures
- `bun test src/engine/dialogue-manager.test.ts` — 9 tests, 0 failures (7 existing + 2 new)
- `bun test src/input/command-registry.test.ts` — 5 tests, 0 failures
- `bun test src/game-loop.test.ts` — 17 tests, 0 failures (9 existing + 8 new)
- `bun test` — 413 tests, 0 failures (up from 393 baseline, +20 new tests)
- `grep -n "createQuestSystem" src/engine/quest-system.ts` — FOUND (line 19)
- `grep -n "applyReputationDelta" src/engine/dialogue-manager.ts` — FOUND (line 12, 262)
- `grep -n "recentMemories" src/engine/dialogue-manager.ts` — FOUND (lines 123, 204, 286, 291)
- `grep -n "salientMemories" src/engine/dialogue-manager.ts` — FOUND (lines 124, 205, 292)
- `grep -n "'journal'" src/input/command-registry.ts` — FOUND (line 103)
- `grep -n "questSystem" src/game-loop.ts` — FOUND (lines 58, 70, 187, 189)

## What Was Built

**quest-system.ts** — Factory function creating QuestSystem with 4 operations:
- `acceptQuest(questId)` — looks up QuestTemplate by id, checks `min_reputation` against RelationStore if `required_npc_id` set, writes to questStore, emits `quest_started` event. Returns `{ status: 'ok' | 'gated' | 'error' }`.
- `completeObjective(questId, objectiveId)` — immutable spread to add objectiveId, emits `objective_completed`
- `advanceStage(questId, stageId)` — sets currentStageId, emits `stage_advanced`
- `failQuest(questId)` — sets status='failed', emits `quest_failed`

**dialogue-manager.ts** — Two extensions:
- `startDialogue` and `processPlayerResponse` now extract both `recentMemories` and `salientMemories` event strings and concatenate them before passing to `generateNpcDialogue` — satisfies WORLD-02 (NPCs reference past interactions)
- `endDialogue` captures npcId and delta before resetting dialogueStore, then flushes non-zero delta to RelationStore via `applyReputationDelta` — reputation changes persist between sessions

**command-registry.ts** — Three new commands appended:
- `:load [name]` — produces `{ type: 'load', target: name ?? null }`
- `:journal` — produces `{ type: 'journal', target: null }`
- `:quest <action> [id]` — produces `{ type: 'quest', target: action, modifiers: { id } }`

**game-loop.ts** — New GameLoopOptions fields (`saveFileManager`, `serializer`, `saveDir`, `questSystem`) with four new action handlers in `processInput`:
- `save` → quickSave or saveGame depending on whether target is provided
- `load` → loadGame with path constructed from saveDir + filename
- `journal` → sets gameStore.phase to 'journal'
- `quest accept` → calls questSystem.acceptQuest, returns error on gated/error results

**game-store.ts** — 'journal' added to GamePhaseSchema enum.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] game-loop.ts handleLook null→undefined coercion**
- **Found during:** Task 2 GREEN — TypeScript check
- **Issue:** `action.target` is `string | null` but `SceneManager.handleLook` expects `string | undefined`. Pre-existing mismatch exposed by tsc.
- **Fix:** `action.target ?? undefined` coercion
- **Files modified:** `src/game-loop.ts`
- **Commit:** ac058b8

**2. [Rule 1 - Bug] Test type cast for mock.calls tuple access**
- **Found during:** Task 2 GREEN — TypeScript check
- **Issue:** `mockGenerateNpcDialogue.mock.calls[0]?.[3]` typed as empty tuple index; `mockCodexEntries` Map constructor inferred incompatible union type
- **Fix:** `as unknown as [...]` cast in dialogue-manager.test.ts; `Map<string, any>` type annotation in quest-system.test.ts
- **Files modified:** `src/engine/dialogue-manager.test.ts`, `src/engine/quest-system.test.ts`
- **Commit:** ac058b8

## TDD Gate Compliance

- Task 1 RED gate: `test(03-07)` commit e9a1947 — PASS
- Task 1 GREEN gate: `feat(03-07)` commit 3cdeb8a — PASS
- Task 2 RED gate: `test(03-07)` commit 43dbd07 — PASS
- Task 2 GREEN gate: `feat(03-07)` commit ac058b8 — PASS

## Known Stubs

None — all connections are live. questSystem and saveFileManager are injected at construction time and callers must provide them; the game-loop returns `{ status: 'error', message: '存档系统未初始化' }` as a graceful fallback when not provided.

## Threat Flags

None — all four mitigations from the plan's threat register are implemented:
- T-03-14: acceptQuest returns `{ status: 'error' }` for unknown quest IDs (never creates phantom state)
- T-03-15: loadGame path constructed as `${saveDir}/${fileName}` where saveDir is resolved; Commander argument cannot contain `..` traversal
- T-03-16: applyReputationDelta clamps value to [-100, 100] (implemented in Plan 04, called here)
- T-03-17: accepted (QuestEventLog is local game state, no PII)

## Self-Check: PASSED
