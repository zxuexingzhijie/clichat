---
phase: 14
plan: "03"
subsystem: memory-persistence, npc-memory-store, scene-manager
tags: [bug-fix, memory-retention, scene-manager, stale-closure]
key-files:
  modified:
    - src/persistence/memory-persistence.ts
    - src/state/npc-memory-store.ts
    - src/engine/scene-manager.ts
    - src/persistence/memory-persistence.test.ts
    - src/engine/scene-manager.test.ts
decisions:
  - applyRetention evicts by importance-then-turnNumber sort, not by array position
  - addMemory inlines eviction logic to avoid circular import with memory-persistence
  - handleLook re-narration uses generateNarrationFn when available, falls back to cache
metrics:
  duration: ~15min
  completed: "2026-04-28"
  tasks: 2
  files_modified: 5
---

# Phase 14 Plan 03: Bug Fixes — Memory Retention, Stale Closure, :look Re-narration

Three independent bugs fixed in a single plan.

## What Was Fixed

### Bug 1 — applyRetention eviction order (src/persistence/memory-persistence.ts)

**Before:** When `recentMemories` reached 15 entries, the first element (index 0) was always promoted to salient — regardless of importance. This meant a `high`-importance recent memory could be evicted while `low`-importance entries survived.

**After:** Entries are sorted by `importanceOrder` (low=0, medium=1, high=2), then by `turnNumber` ascending. The lowest-importance, oldest entry is evicted first.

### Bug 2 — addMemory exported from npc-memory-store (src/state/npc-memory-store.ts)

Added `addMemory(store, npcId, entry)` as an exported function. Handles record creation if absent, appends the entry, then enforces the max-15 cap inline (not via `applyRetention` import, which would create a circular dependency).

### Bug 3 — scene-manager stale closure on currentSceneId (src/engine/scene-manager.ts)

**Before:** `currentSceneId` was only updated via `loadScene`. After `state_restored` (save/load), the scene store held the restored `sceneId` but `currentSceneId` in the closure remained `null` or pointed to the pre-load scene.

**After:** Subscribed to `state_restored` event on `stores.eventBus`. On restore, syncs `currentSceneId` from `stores.scene.getState().sceneId`.

### Bug 4 — :look returns cache instead of re-narrating (src/engine/scene-manager.ts)

**Before:** `handleLook(undefined)` returned the existing `narrationLines` unchanged — no AI call, no new content.

**After:** When `generateNarrationFn` is available, calls it with `playerAction: 're-look'` and appends the result to `narrationLines`. Falls back to returning existing lines only when no narration function is injected.

## Verification Results

- `src/persistence/memory-persistence.test.ts`: 13/13 pass (added 2 new tests)
- `src/engine/scene-manager.test.ts`: 11/11 pass (added 3 new tests)
- `bun tsc --noEmit`: clean

## Commit

`31b6a70` — fix(14-03): memory retention ordering + scene-manager stale closure + :look re-narration

## Known Stubs

None.

## Deviations from Plan

None — plan executed exactly as written, with minor TypeScript type fixes applied (Rule 1):
- `entries` array in memory-persistence test typed as `NpcMemoryRecord['recentMemories']` to allow mixed importance assignments
- Removed erroneous top-level `import mitt` and `import type { GameEvents }` from scene-manager test (leftover from draft)

## Self-Check: PASSED

- `src/persistence/memory-persistence.ts` — exists, modified
- `src/state/npc-memory-store.ts` — exists, modified
- `src/engine/scene-manager.ts` — exists, modified
- Commit `31b6a70` — verified in git log
