# 12-P02 Execution Summary

**Status:** Complete
**Requirements:** COMBAT-01, COMBAT-02, COMBAT-06
**Duration:** ~15 minutes
**Completed:** 2026-04-28

## Files Modified

- `src/engine/action-handlers/combat-handler.ts` — deleted unconditional `processEnemyTurn()` call
- `src/engine/game-screen-controller.ts` — added outcome guard before `processEnemyTurn()`
- `src/engine/combat-loop.ts` — wrapped `processPlayerAction` body in try/catch
- `src/engine/action-handlers/combat-handler.test.ts` — new test file (4 tests)
- `src/engine/game-screen-controller.test.ts` — added 5 new tests for outcome guard
- `src/engine/combat-loop.test.ts` — added 3 new tests for try/catch behavior

## Tests

**859 pass, 1 fail** (the 1 failure is `use-game-input.test.ts` — pre-existing, unrelated to this plan)

New tests added: 12 total across 3 files.

## Key Changes

- **COMBAT-01:** Deleted `await ctx.combatLoop.processEnemyTurn()` at line 19 of `combat-handler.ts`. The handler now only calls `processPlayerAction` + `checkCombatEnd`. Enemy turn is driven exclusively from `game-screen-controller.ts`.
- **COMBAT-02:** Extended the `getCombatPhase() === 'enemy_turn'` guard in `handleCombatExecute` to also check `result.outcome !== 'flee' && result.outcome !== 'victory' && result.outcome !== 'defeat'`. Flee no longer grants a bonus enemy turn.
- **COMBAT-06:** Wrapped the body of `processPlayerAction` (after the initial `setState({ phase: 'resolving' })`) in a try/catch. On exception: resets `combat.phase` to `'player_turn'` and returns `{ status: 'error', message: '战斗处理出错: <err.message>' }`. Combat can never get permanently stuck in `'resolving'`.

## Commits

- `c8aec87` — fix(12-P02): remove unconditional processEnemyTurn from combat-handler (COMBAT-01)
- `047c974` — fix(12-P02): add flee/victory/defeat outcome guard in handleCombatExecute (COMBAT-02)
- `de4dc38` — fix(12-P02): wrap processPlayerAction in try/catch to prevent combat freeze (COMBAT-06)

## Deviations from Plan

**1. [Rule 1 - Bug] Test injection point changed for COMBAT-06 try/catch**

- **Found during:** Task 3 RED phase
- **Issue:** The plan's example used `generateNarrationFn` to inject a throw, but `doGenerateNarration` already has an inner try/catch that swallows all errors and returns a fallback string. The outer try/catch would never be exercised via narration throws.
- **Fix:** Changed the test to inject a throwing `rng` function instead. `rollD20(rng)` is called inside the try block with no inner protection, so the throw propagates correctly to the new catch.
- **Files modified:** `src/engine/combat-loop.test.ts`
- **Impact:** None — the try/catch in production code is correct and complete. Only the test injection method changed.

## Self-Check

- [x] `combat-handler.ts` — no `processEnemyTurn` call: confirmed by grep returning no output
- [x] `game-screen-controller.ts` — outcome guard present: `result.outcome !== 'flee'` etc. confirmed by grep
- [x] `combat-loop.ts` — catch block at line 249: confirmed by grep
- [x] All commits exist: `c8aec87`, `047c974`, `de4dc38` confirmed in git log
- [x] `bun tsc --noEmit` — clean
- [x] 859 tests pass

## Self-Check: PASSED
