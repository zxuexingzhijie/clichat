---
phase: 13-dialogue-reputation
plan: P02
subsystem: state
tags: [reputation, serializer, restore, event-bus]
dependency_graph:
  requires: []
  provides: [RelationStore.restoreState]
  affects: [src/state/serializer.ts, src/context/game-context.ts]
tech_stack:
  added: []
  patterns: [isRestoring flag, intersection type extension]
key_files:
  created: []
  modified:
    - src/state/relation-store.ts
    - src/state/serializer.ts
    - src/context/game-context.ts
    - src/state/relation-store.test.ts
    - src/state/serializer.test.ts
decisions:
  - "Used isRestoring flag in createRelationStore function scope — single-threaded JS guarantees no async gap between set and clear, so this is safe (T-13P02-02)"
  - "RelationStore exported as intersection type Store<RelationState> & { restoreState } — callers typed as Store<RelationState> still work, only createSerializer and GameStores needed updating"
metrics:
  duration: ~12min
  completed: 2026-04-28
  tasks_completed: 1
  files_changed: 5
---

# Phase 13 Plan P02: restoreState bypasses reputation_changed on game load

Added `restoreState` to `createRelationStore` so that loading a saved game does not fire spurious `reputation_changed` events for every NPC in the save file.

## What Was Done

**Root cause:** `serializer.restore()` called `stores.relations.setState(...)`, which always triggers the `onChange` callback that emits `reputation_changed` for every NPC whose value changed from default (0) to saved value. On a fresh load, that is every NPC in the save file.

**Fix:**
1. `src/state/relation-store.ts` — Added `RelationStore` type (intersection of `Store<RelationState>` with `{ restoreState }`). In `createRelationStore`, added `let isRestoring = false` flag in function scope. The `onChange` callback now returns early when `isRestoring` is true. `restoreState(data)` sets the flag, calls `store.setState`, then clears the flag.
2. `src/state/serializer.ts` — Changed `stores.relations` parameter type from `Store<RelationState>` to `RelationStore`. Changed `stores.relations.setState(draft => { Object.assign(draft, data.relations); })` to `stores.relations.restoreState(data.relations)`.
3. `src/context/game-context.ts` — Updated `GameStores.relation` field type from `Store<RelationState>` to `RelationStore` to match the return type of `createRelationStore`.

## Test Results

```
bun test src/state/relation-store.test.ts src/state/serializer.test.ts
 41 pass, 0 fail
```

Full suite: 901 pass, 5 fail — all 5 failures are pre-existing (confirmed by running without P02 changes).

`bun tsc --noEmit`: zero errors.

## Deviations from Plan

**1. [Rule 2 - Missing critical] Updated GameStores.relation type in game-context.ts**
- **Found during:** Type check after implementation
- **Issue:** `createSerializer` in `app.tsx` passes `ctx.stores.relation` for the `relations` slot; `GameStores.relation` was typed as `Store<RelationState>` which lacks `restoreState`, causing TS2322
- **Fix:** Updated `GameStores.relation` to `RelationStore` and added the import
- **Files modified:** `src/context/game-context.ts`
- **Commit:** bd65b58

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

- `src/state/relation-store.ts` — FOUND (contains RelationStore, restoreState, isRestoring)
- `src/state/serializer.ts` — FOUND (contains restoreState call on line 169)
- `src/context/game-context.ts` — FOUND (relation: RelationStore)
- Commit bd65b58 — FOUND in git log
