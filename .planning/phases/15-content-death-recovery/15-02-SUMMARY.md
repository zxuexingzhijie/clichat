---
phase: 15-content-death-recovery
plan: "02"
subsystem: game-state
tags: [game-loop, scene-manager, npc-discovery, death-screen, save-load, combat-handler]

requires:
  - phase: 13-dialogue-reputation
    provides: dialogue_ended event emitted after NPC dialogue completes
  - phase: 12-combat-save
    provides: combat-handler with checkCombatEnd result, save-file-manager with listSaves/saveGame

provides:
  - revealedNpcs field on GameState (Zod default([]) for backward-compatible save loading)
  - Shadow contact NPC (npc_shadow_contact) appears in loc_tavern after npc_bartender dialogue ends
  - loadLastSave() on GameLoop interface — loads most recent save and transitions to game phase
  - Emergency auto-save on first defeat (when no prior saves exist)
  - Death screen key routing: r/l loads last save, any other key returns to title

affects:
  - phase-16-onwards: loadLastSave and revealedNpcs are now stable API surface
  - future quest plans: revealedNpcs pattern can be reused for other conditional NPC reveals

tech-stack:
  added: []
  patterns:
    - "Conditional NPC injection: revealedNpcs array in GameState filtered by location_id on loadScene"
    - "Injectable dependency for testability: listSavesFn option on GameLoopOptions avoids mock.module pollution"
    - "Event-driven NPC discovery: dialogue_ended listener in scene-manager reads/writes game store"

key-files:
  created: []
  modified:
    - src/state/game-store.ts
    - src/engine/scene-manager.ts
    - src/game-loop.ts
    - src/engine/action-handlers/combat-handler.ts
    - src/ui/screens/game-screen.tsx
    - src/engine/game-screen-controller.test.ts
    - src/ui/screens/game-screen.test.ts
    - src/engine/scene-manager.test.ts
    - src/game-loop.test.ts

key-decisions:
  - "listSavesFn injected via GameLoopOptions rather than top-level mock.module to prevent test isolation pollution"
  - "revealedNpcs uses Zod .default([]) so old saves without the field parse cleanly"
  - "dialogue_ended listener in scene-manager (not dialogue-manager) because scene-manager already owns npcsPresent"

requirements-completed: [CONT-04, DEATH-01]

duration: 45min
completed: 2026-04-28
---

# Phase 15 Plan 02: Shadow Contact Discovery + Death Screen Recovery Summary

**revealedNpcs state field + bartender-triggered shadow contact in loc_tavern + death screen [R]/[Q] routing with emergency save on first defeat**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-04-28T00:00:00Z
- **Completed:** 2026-04-28T00:45:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- `GameStateSchema` gains `revealedNpcs: z.array(z.string()).default([])` — old saves load without migration
- Completing bartender dialogue emits `dialogue_ended` which scene-manager listens to, pushing `npc_shadow_contact` into `revealedNpcs`; next `loadScene('loc_tavern')` merges it into `npcsPresent`
- `GameLoop` interface gains `loadLastSave()`: calls injectable `listSavesFn` (defaults to real `listSaves`), takes first entry, calls `sfm.loadGame`, sets phase to `'game'`
- `combat-handler` captures `checkCombatEnd` result; on `defeat` with no existing saves, calls `saveGame('emergency', ...)`
- Death screen `useInput` routes `r`/`l` to `gameLoop.loadLastSave()`, any other key resets to title; hint text updated to `[R] 载入最近存档  [Q] 返回标题`

## Task Commits

1. **RED: scene-manager tests** - `e7d8bae` (test)
2. **GREEN: Task 1 implementation** - `f24fd5d` (feat)
3. **RED: game-loop loadLastSave tests** - `362385a` (test)
4. **GREEN: Task 2 implementation** - `3f315cf` (feat)

## Files Created/Modified

- `src/state/game-store.ts` — `revealedNpcs` added to schema and default state
- `src/engine/scene-manager.ts` — imports `gameStore`, merges revealedNpcs in `loadScene`, registers `dialogue_ended` listener
- `src/game-loop.ts` — `loadLastSave` on interface + implementation; `listSavesFn` injectable option; imports `defaultListSaves`
- `src/engine/action-handlers/combat-handler.ts` — imports `listSaves`/`saveGame`; emergency save on defeat with no saves
- `src/ui/screens/game-screen.tsx` — death screen `useInput` routes r/l vs other; hint text updated
- `src/engine/game-screen-controller.test.ts` — two mock `GameLoop` objects updated with `loadLastSave`
- `src/ui/screens/game-screen.test.ts` — `createMockGameLoop` updated with `loadLastSave`
- `src/engine/scene-manager.test.ts` — 5 new tests + expanded mock codex (loc_tavern, npc_bartender, npc_shadow_contact)
- `src/game-loop.test.ts` — 3 new tests for `loadLastSave` using `listSavesFn` injection

## Decisions Made

- **Injectable `listSavesFn`**: Using `mock.module` inside test bodies or at top-level caused the `save-file-manager.test.ts` suite to lose access to `_fs` and `ensureSaveDirExists` exports (module registry pollution). Adding `listSavesFn?: (saveDir) => Promise<SaveListEntry[]>` to `GameLoopOptions` and defaulting to the real `listSaves` avoids any module mocking entirely.
- **`revealedNpcs` in GameState not SceneState**: NPC reveals persist across sessions and scenes; keeping them in `GameState` (serialized) is correct. `SceneState` is ephemeral.
- **Listener in scene-manager, not dialogue-manager**: scene-manager already owns `npcsPresent` merging and has access to `codexEntries` for location filtering. Putting the listener here avoids a cross-module dependency from dialogue-manager into game-state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] game-screen-controller.test.ts mock GameLoop missing loadLastSave**
- **Found during:** Task 2 (tsc check after adding loadLastSave to interface)
- **Issue:** Two inline mock objects typed as `GameLoop` lacked `loadLastSave`, causing TS2741 errors
- **Fix:** Added `loadLastSave: mock(async () => {})` to both objects
- **Files modified:** `src/engine/game-screen-controller.test.ts`, `src/ui/screens/game-screen.test.ts`
- **Verification:** `bun tsc --noEmit` clean
- **Committed in:** `3f315cf` (Task 2 commit)

**2. [Rule 1 - Bug] mock.module in test bodies polluted save-file-manager test suite**
- **Found during:** Task 2 full suite run
- **Issue:** In-body `mock.module('./persistence/save-file-manager', ...)` calls in `game-loop.test.ts` caused `save-file-manager.test.ts` to lose access to `_fs`/`ensureSaveDirExists` exports (9 test failures)
- **Fix:** Removed all `mock.module` calls; added `listSavesFn` injectable option to `GameLoopOptions`; tests pass the mock function directly
- **Files modified:** `src/game-loop.ts`, `src/game-loop.test.ts`
- **Verification:** Full suite: 956 pass, 1 fail (pre-existing)
- **Committed in:** `3f315cf` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes necessary for type safety and test isolation. The listSavesFn injection is a minor interface addition with no behavioral change in production. No scope creep.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Shadow contact discovery is wired end-to-end; manual verification needed (talk bartender → `:look` at tavern)
- Death screen recovery options are functional; manual verification needed (die in combat → press r)
- `revealedNpcs` pattern is ready for reuse in future conditional NPC reveals
- No blockers

---

## Self-Check

- [x] `src/state/game-store.ts` — revealedNpcs present
- [x] `src/engine/scene-manager.ts` — dialogue_ended listener + NPC merge present
- [x] `src/game-loop.ts` — loadLastSave on interface and implementation present
- [x] `src/engine/action-handlers/combat-handler.ts` — emergency save present
- [x] `src/ui/screens/game-screen.tsx` — [R]/[Q] hint text present
- [x] Commits e7d8bae, f24fd5d, 362385a, 3f315cf all present in git log
- [x] bun tsc --noEmit: CLEAN
- [x] bun test: 956 pass, 1 fail (pre-existing use-game-input.test.ts failure)

## Self-Check: PASSED

---
*Phase: 15-content-death-recovery*
*Completed: 2026-04-28*
