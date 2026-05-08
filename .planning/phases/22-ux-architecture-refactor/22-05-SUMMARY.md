---
phase: 22-ux-architecture-refactor
plan: 05
subsystem: ui-architecture
tags: [input-provider, state-machine, game-screen, controller-dispatch, uxa-01, uxa-03, uxa-04]
requires:
  - phase: 22-02
    provides: [AtmosphereProvider, active quest context]
  - phase: 22-03
    provides: [NarrativeProvider, streaming selector hooks]
  - phase: 22-04
    provides: [NarrativeRenderer, PanelRouter narrative routing]
provides:
  - InputProvider owns input mode, command input, selected indexes, keyboard handling, and controller dispatch
  - Seven-state input state machine for EXPLORATION, DIALOGUE, COMBAT, MENU, CODEX, MAP, and BRANCH
  - GameScreen slim orchestrator under 100 lines
affects:
  - src/ui/providers/input-provider.tsx
  - src/ui/hooks/use-game-input.ts
  - src/engine/game-screen-controller.ts
  - src/app.tsx
  - src/ui/screens/game-screen.tsx
tech-stack:
  added: []
  patterns: [provider-owned controller dispatch, dual-layer keyboard handling, event-driven input state]
key-files:
  created:
    - src/ui/providers/input-provider.tsx
    - src/ui/providers/input-provider.test.ts
  modified:
    - src/ui/hooks/use-game-input.ts
    - src/engine/game-screen-controller.ts
    - src/engine/game-screen-controller.test.ts
    - src/app.tsx
    - src/ui/screens/game-screen.tsx
    - src/ui/screens/game-screen.test.ts
key-decisions:
  - InputProvider owns the state machine and delegates game actions through createGameScreenController.
  - GameScreen remains a renderer/layout shell and still renders InlineConfirm as layout chrome.
  - Existing panel-local navigation can remain only behind provider-controlled active state.
patterns-established:
  - Seven independent useInput handlers guarded by currentState.
  - Global keyboard layer handles Esc/Ctrl-C/help/stream skip before state handlers.
  - GameScreen consumes provider selector hooks instead of domain hooks/controllers.
requirements-completed: [UXA-01, UXA-03, UXA-04]
duration: resumed
completed: 2026-05-08
---

# Phase 22 Plan 05: InputProvider State Machine Summary

**InputProvider now owns keyboard state, controller dispatch, and the 7-state input machine while GameScreen is a 70-line layout orchestrator.**

## Performance

- **Duration:** resumed session
- **Completed:** 2026-05-08
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added `InputProvider` and selector hooks for input state, actions, selected indexes, and command input.
- Implemented explicit input states: EXPLORATION, DIALOGUE, COMBAT, MENU, CODEX, MAP, and BRANCH.
- Moved controller ownership into InputProvider using AtmosphereProvider active quest context and NarrativeProvider stream hooks.
- Refactored `GameScreen` to 70 physical lines with no direct `useInput`, streaming hooks, toast hooks, or controller ownership.
- Preserved the gameplay layout stack: title, NarrativeRenderer via PanelRouter, status, actions, input row, and InlineConfirm.

## Task Commits

Each task was committed atomically or completed through continuation recovery:

1. **Task 1: Build InputProvider state machine and EventBus transitions** — `713a164` (test), `982ff2f` (feat)
2. **Task 2: Move controller ownership into InputProvider** — `ae3cc58` (test), `e5bf8b6` (feat)
3. **Task 3: Wire InputProvider and slim GameScreen** — `1e4dfa1` (test), `7218e9e` (fix), `66e52d0` (feat)

## Files Created/Modified

- `src/ui/providers/input-provider.tsx` — provider-owned input state machine, controller dispatch, global key layer, and selector hooks.
- `src/ui/providers/input-provider.test.ts` — state-machine, EventBus, source structure, and provider ownership checks.
- `src/ui/hooks/use-game-input.ts` — canonical input state names and pure transition/global-input helpers.
- `src/ui/hooks/use-game-input.test.ts` — helper coverage for states, transitions, and global input consumption.
- `src/engine/game-screen-controller.ts` — controller compatibility and dispatch behavior retained for provider use.
- `src/engine/game-screen-controller.test.ts` — controller behavior remains covered.
- `src/app.tsx` — AtmosphereProvider → NarrativeProvider → InputProvider → GameScreen nesting.
- `src/ui/screens/game-screen.tsx` — slim layout orchestrator consuming provider hooks.
- `src/ui/screens/game-screen.test.ts` — GameScreen slim-down, provider wiring, and regression checks.

## Decisions Made

- `InputProvider` owns pending-quit key handling and state transitions; `GameScreen` only renders `InlineConfirm` as layout chrome.
- `InputProvider` sets `processing` before action dispatch to satisfy the input-state contract even though the controller also sets processing internally.
- The legacy `createGameScreenController` module remains as the pure dispatch factory consumed by InputProvider, preserving existing tests and behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. Processing mode set before async dispatch**
- **Found during:** Task 3 verification continuation
- **Issue:** Focused test expected InputProvider source to set `processing` before delegating action dispatch.
- **Fix:** Added `setInputMode('processing')` in InputProvider's public `handleActionExecute` wrapper before calling `controller.handleActionExecute`.
- **Files modified:** `src/ui/providers/input-provider.tsx`
- **Verification:** Focused Phase 22 tests, typecheck, and full suite pass.
- **Committed in:** `7218e9e`

---

**Total deviations:** 1 auto-fixed correctness issue.
**Impact on plan:** No scope creep; fix strengthens D-04/D-10 input ownership behavior.

## Issues Encountered

- The continuation shell did not have `bun` on PATH; verification used `/Users/makoto/.bun/bin/bun`, which matches the installed Bun executable.
- The prior executor did not return a completion signal for Plan 22-05. Work was recovered from commits and spot-checked, then completed with summary creation.

## Verification Evidence

Final verification completed successfully:

```bash
/Users/makoto/.bun/bin/bun test src/ui/providers/input-provider.test.ts src/ui/providers/atmosphere-provider.test.ts src/ui/providers/narrative-provider.test.ts src/ui/panels/scene-panel.test.ts src/ui/screens/game-screen.test.ts
/Users/makoto/.bun/bin/bun run typecheck
/Users/makoto/.bun/bin/bun test
```

Observed results:

- Focused Phase 22 tests: 75 pass, 0 fail.
- Typecheck: `tsc --noEmit` exit 0.
- Full suite: 1338 pass, 0 fail, 9589 assertions.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 22 implementation is ready for phase-level verification. Phase 23 can rely on decoupled provider architecture after `/gsd-verify-work 22` passes.

---
*Phase: 22-ux-architecture-refactor*
*Completed: 2026-05-08*
