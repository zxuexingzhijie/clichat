---
phase: 22-ux-architecture-refactor
plan: 02
subsystem: ui-architecture
tags: [atmosphere-provider, context-provider, react-ink, quest-context, clock]
requires:
  - phase: 22-01
    provides: [Clock, ManualClock, deterministic-timing-tests]
provides:
  - AtmosphereProvider wide world-perception context
  - useAtmosphere/useToast/useActiveQuests selector hooks
  - Clock-backed atmosphere event state for toast, scene dimout, and spinner dimout
  - GameScreen integration via provider-owned quest ecological context
  - isolated AtmosphereProvider tests
affects:
  - src/app.tsx
  - src/ui/screens/game-screen.tsx
  - src/ui/providers/atmosphere-provider.tsx
tech-stack:
  added: []
  patterns: [React Context provider selector hooks, pure provider transform helpers, Clock-backed event UI state]
key-files:
  created:
    - src/ui/providers/atmosphere-provider.tsx
    - src/ui/providers/atmosphere-provider.test.ts
  modified:
    - src/app.tsx
    - src/ui/screens/game-screen.tsx
    - src/ui/screens/game-screen.test.ts
key-decisions:
  - AtmosphereProvider owns quest ecological context and exposes activeQuestIds/activeQuestTags to GameScreen instead of recalculating them locally.
  - Toast and dimout behavior are centralized in a Clock-backed event-state helper so isolated tests do not render GameScreen or sleep.
  - GameScreen remains responsible for current Narrative/Input responsibilities until later Phase 22 plans, but no longer owns D-02 atmosphere state.
patterns-established:
  - Provider logic has pure derivation helpers for tests and React hooks for runtime consumption.
  - EventBus subscriptions are registered through exact handler references and cleaned up by provider event state.
requirements-completed: [UXA-01, UXA-03]
duration: 9m43s
completed: 2026-05-07T17:37:24Z
---

# Phase 22 Plan 02: AtmosphereProvider Wide World-Perception State Summary

**AtmosphereProvider now centralizes quest ecology, toast events, scene dimming, spinner dimout, time labels, and optional weather/scene tags for GameScreen.**

## Performance

- **Duration:** 9m43s
- **Started:** 2026-05-07T17:27:41Z
- **Completed:** 2026-05-07T17:37:24Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `AtmosphereProvider` with `useAtmosphere()`, `useToast()`, `useActiveQuests()`, and `useAtmosphereProcessing()` hooks.
- Moved active/completed/failed quest derivation and ecological `activeQuestIds`/`activeQuestTags` out of `GameScreen`.
- Centralized quest/item/knowledge/gold/reputation/summary toast handling in provider event state with cleanup coverage.
- Centralized `scene_changed` dimout and processing-to-streaming spinner dimout behind the Plan 22-01 `Clock` seam.
- Wired `AppInner` to wrap the `GameScreen` subtree with `AtmosphereProvider` while preserving existing visible layout and behavior.

## Task Commits

Each task was committed atomically with TDD RED/GREEN commits:

1. **Task 1: Create AtmosphereProvider and isolated tests**
   - `cb7b2e0` test: add failing AtmosphereProvider tests
   - `ba8d440` feat: implement AtmosphereProvider
2. **Task 2: Wire AtmosphereProvider and remove atmosphere logic from GameScreen**
   - `51d90a8` test: add failing AtmosphereProvider wiring tests
   - `f508048` feat: wire AtmosphereProvider into GameScreen

## Files Created/Modified

- `src/ui/providers/atmosphere-provider.tsx` — New provider, hook contract, quest derivation helper, weather/tag readers, and Clock-backed event state for toasts/dimouts.
- `src/ui/providers/atmosphere-provider.test.ts` — Isolated unit/source-structure tests for quest derivation, ecological context, event cleanup, ManualClock dimout behavior, and app/GameScreen wiring.
- `src/app.tsx` — Imports `AtmosphereProvider` and wraps the gameplay subtree with `questTemplates` and `ctx.eventBus`.
- `src/ui/screens/game-screen.tsx` — Replaces local quest/toast/timed atmosphere ownership with AtmosphereProvider hooks.
- `src/ui/screens/game-screen.test.ts` — Updates ecological context source-structure assertion to expect provider-owned context.

## Verification Evidence

Final plan verification completed successfully:

```bash
bun test src/ui/providers/atmosphere-provider.test.ts src/ui/screens/game-screen.test.ts
bun run typecheck
bun test
```

Observed results:

- Focused provider/GameScreen tests: 44 pass, 0 fail, 110 assertions.
- Typecheck: `tsc --noEmit` exit 0.
- Full suite: 1308 pass, 0 fail, 9449 assertions.

## Decisions Made

- Kept `AtmosphereProvider` UI-agnostic: it computes and exposes state but does not render panels.
- Added `useAtmosphereProcessing()` as a small bridge so the current GameScreen can report processing/streaming state until NarrativeProvider/InputProvider own those responsibilities in later plans.
- Read weather and scene tags only if the current scene state already exposes those fields; no Phase 24 weather behavior or new scene schema was introduced.

## Deviations from Plan

None - plan executed as written. The small `useAtmosphereProcessing()` hook is an implementation detail required to move spinner dimout ownership into AtmosphereProvider while later Narrative/Input providers are still pending.

## TDD Gate Compliance

- RED for Task 1: `bun test src/ui/providers/atmosphere-provider.test.ts` failed because `./atmosphere-provider` did not exist.
- GREEN for Task 1: provider tests passed after adding the provider, pure derivation helpers, event state, and ManualClock-backed dimout behavior.
- RED for Task 2: integration/source tests failed because `App` did not yet wrap `GameScreen` with `AtmosphereProvider` and `GameScreen` still owned local atmosphere logic.
- GREEN for Task 2: focused tests, typecheck, and the full suite passed after app wiring and GameScreen hook consumption.

## Known Stubs

None. `null` values in the touched files are explicit absence states (`toast`, weather, optional branch/compare state, timer sentinels) and do not flow as UI placeholder stubs.

## Threat Flags

None. This plan introduced no network endpoints, auth paths, file access trust boundaries, or schema changes. The planned EventBus-to-provider trust boundary was covered by explicit subscription cleanup tests and concise player-facing toast strings.

## Issues Encountered

- The initial test/implementation drafts had duplicated token typos (`mitt mitt`, `Set Set`, `Array Array`, `createContextContext`) from edit insertion. These were corrected before GREEN commits and verified by the focused tests/typecheck.
- Existing `game-screen.test.ts` expected GameScreen to own ecological quest derivation; it was updated to assert provider ownership instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Atmosphere state is now provider-owned and available to later NarrativeProvider/InputProvider work.
- GameScreen is slimmer, but still intentionally owns narrative/input responsibilities until Plans 22-03 through 22-05.

## Notes

- The working tree contained pre-existing `.planning` modifications/deletions outside Plan 22-02 scope. They were not touched or staged.
- Per execution rules for this orchestrated run, `STATE.md` and `ROADMAP.md` were not updated.

## Self-Check: PASSED

- FOUND: `src/ui/providers/atmosphere-provider.tsx`
- FOUND: `src/ui/providers/atmosphere-provider.test.ts`
- FOUND: `.planning/phases/22-ux-architecture-refactor/22-02-SUMMARY.md`
- FOUND commit: `cb7b2e0`
- FOUND commit: `ba8d440`
- FOUND commit: `51d90a8`
- FOUND commit: `f508048`
