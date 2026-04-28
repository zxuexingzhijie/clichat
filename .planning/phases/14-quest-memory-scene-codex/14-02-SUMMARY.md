---
phase: "14"
plan: "02"
subsystem: quest-system
tags: [quest, event-bus, auto-advancement, cli-commands]
dependency_graph:
  requires: [14-01]
  provides: [quest-event-triggers, quest-status-command, quest-journal-command]
  affects: [game-loop, app-wiring, action-handlers]
tech_stack:
  added: []
  patterns: [event-bus-subscription, pending-conditions-map, action-handler-subcommands]
key_files:
  created:
    - src/engine/action-handlers/quest-handler.test.ts
  modified:
    - src/engine/quest-system.ts
    - src/engine/quest-system.test.ts
    - src/engine/action-handlers/quest-handler.ts
    - src/engine/action-handlers/types.ts
    - src/game-loop.ts
    - src/app.tsx
decisions:
  - "Added questStore as separate ActionContext field rather than expanding GameLoopStores, to avoid coupling game-loop core to quest subsystem"
  - "pendingConditions Map keyed by {questId}:{stageId} cleared on advanceStage to prevent stale condition state across stage transitions"
metrics:
  duration: "~4 minutes"
  completed: "2026-04-28"
  tasks_completed: 2
  files_changed: 7
---

# Phase 14 Plan 02: Quest Event-Based Auto-Advancement + Status/Journal Commands Summary

Event-driven quest stage progression via EventBus subscriptions (dialogue_ended, scene_changed, item_acquired, combat_ended) with multi-condition gating, plus :quest status and :quest journal CLI subcommands backed by codex name lookup.

## What Was Completed

### Task 1: createQuestSystem event bus subscriptions

`createQuestSystem` now accepts an optional third parameter `bus?: EventBus`. When provided, it subscribes to four domain events and automatically advances quest stages when trigger conditions match. A `pendingConditions` Map handles multi-condition stages (e.g., stage requiring both dialogue_ended AND location_entered before advancing).

Key logic:
- `checkAndAdvance(questId, 'primary' | 'secondary')` accumulates satisfied conditions
- Single-condition stages advance immediately on primary match
- Multi-condition stages (when `stage.trigger.secondaryEvent` is set) require both primary + secondary before advancing
- `pendingConditions` entry cleared when a stage advances (preventing stale state)
- `completeQuest` called when the final stage (nextStageId = null) triggers

### Task 2: quest-handler status/journal subcommands + wiring

`handleQuest` extended with two new branches:
- `:quest status` — lists active quests with human-readable names and current stage descriptions from codexEntries; returns "当前没有进行中的任务。" when none active
- `:quest journal` — lists active + completed quests; completed quests show "(已完成)" suffix

Wiring changes:
- `ActionContext` in types.ts gained `questStore?: Store<QuestState>` (separate from `stores: GameLoopStores` which has no quest field)
- `GameLoopOptions` and `createGameLoop`'s actionContext gained `questStore`
- `app.tsx` passes `ctx.stores.quest` as `questStore` and `ctx.eventBus` as bus to `createQuestSystem`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] GameLoopStores has no quest field**
- **Found during:** Task 2 tsc check
- **Issue:** `ctx.stores.quest` does not exist — `GameLoopStores` only has player/scene/game/combat. Plan assumed `ctx.stores.quest` was accessible.
- **Fix:** Added `questStore?: Store<QuestState>` directly to `ActionContext` (and `GameLoopOptions`). quest-handler now reads from `ctx.questStore`. Test helper updated accordingly.
- **Files modified:** types.ts, game-loop.ts, quest-handler.ts, quest-handler.test.ts
- **Commit:** 2437734

**2. [Rule 1 - Bug] GameAction has no rawInput field**
- **Found during:** Task 2 tsc check on test file
- **Issue:** Test helper constructed `GameAction` with `rawInput` which is not in the schema
- **Fix:** Removed `rawInput`, used `source: 'command'` instead
- **Files modified:** quest-handler.test.ts
- **Commit:** 2437734

## Verification Results

```
bun test src/engine/quest-system.test.ts   → 14 pass, 0 fail (was 8, +6 new)
bun test src/engine/action-handlers/       → 31 pass, 0 fail (was 26, +5 new)
bun tsc --noEmit                           → clean
```

Total new tests: 11 (6 event-advancement + 5 status/journal).

## Self-Check: PASSED

- src/engine/quest-system.ts: exists, bus wiring confirmed
- src/engine/action-handlers/quest-handler.ts: exists, status/journal confirmed
- src/engine/action-handlers/quest-handler.test.ts: exists, 5 tests confirmed
- Commits 953f66a and 2437734: both present in git log
