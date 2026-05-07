---
phase: 22-ux-architecture-refactor
plan: 01
subsystem: timing-foundation
tags: [clock, deterministic-tests, timing, uxa-05]
requires: []
provides: [Clock, ManualClock, deterministic-timing-tests]
affects:
  - src/time/clock.ts
  - src/time/manual-clock.ts
  - src/time/clock.test.ts
  - src/ui/hooks/use-timed-effect.ts
  - src/ui/hooks/use-timed-effect.test.ts
  - src/ui/hooks/use-toast.ts
  - src/ui/hooks/use-toast.test.ts
  - src/ai/utils/sentence-buffer.ts
  - src/ai/utils/sentence-buffer.test.ts
tech_stack:
  added: []
  patterns: [injectable Clock interface, ManualClock deterministic test seam]
key_files:
  created:
    - src/time/clock.ts
    - src/time/manual-clock.ts
    - src/time/clock.test.ts
  modified:
    - src/ui/hooks/use-timed-effect.ts
    - src/ui/hooks/use-timed-effect.test.ts
    - src/ui/hooks/use-toast.ts
    - src/ui/hooks/use-toast.test.ts
    - src/ai/utils/sentence-buffer.ts
    - src/ai/utils/sentence-buffer.test.ts
decisions:
  - Runtime timing utilities default to systemClock while tests explicitly inject ManualClock.
  - ManualClock uses monotonically ordered manual timer ids and executes due callbacks chronologically.
metrics:
  completed: 2026-05-07T17:12:39Z
  tasks_completed: 2
  commits: 2
---

# Phase 22 Plan 01: Clock Abstraction for Deterministic Timing Tests Summary

## One-Liner

Injectable Clock foundation with deterministic ManualClock advancement for timed effects, toasts, and sentence buffering while preserving system-clock runtime behavior.

## What Changed

- Added `Clock`, `TimeoutId`, and `systemClock` in `src/time/clock.ts`.
- Added `ManualClock` and `createManualClock()` in `src/time/manual-clock.ts` for deterministic test advancement.
- Added clock coverage for runtime timer delegation, manual advancement, timer clearing, chronological firing, and callback-scheduled timers.
- Updated `createTimedEffect` / `useTimedEffect` to accept an optional `Clock`, defaulting to `systemClock`.
- Updated `createToastManager` / `useToast` to accept an optional `Clock`, defaulting to `systemClock`.
- Updated `createSentenceBuffer` to accept `options.clock`, defaulting to `systemClock`.
- Replaced real-sleep timing assertions in touched tests with `ManualClock.advanceBy()`.

## Tasks Completed

| Task | Name | Commit | Verification |
|------|------|--------|--------------|
| 1 | Define injectable Clock and deterministic ManualClock | `3ef34f3` | `bun test src/time/clock.test.ts` — 4 pass, 0 fail |
| 2 | Inject Clock into existing timing utilities | `96f7a39` | focused timing tests, typecheck, and full suite passed |

## Verification Evidence

Final plan verification command completed successfully:

```bash
bun test src/time/clock.test.ts src/ui/hooks/use-timed-effect.test.ts src/ui/hooks/use-toast.test.ts src/ai/utils/sentence-buffer.test.ts && bun run typecheck && bun test
```

Observed results:

- Focused timing tests: 33 pass, 0 fail.
- Typecheck: `tsc --noEmit` exit 0.
- Full suite: 1300 pass, 0 fail, 9405 assertions.

Additional checks:

- No `setTimeout`, `await new Promise`, or sleep-based timing assertions remain in the touched timing test files.
- Production timing utilities use `clock.setTimeout` / `clock.clearTimeout` through the injectable `Clock` seam.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed malformed duplicate source after utility injection edit**
- **Found during:** Task 2 focused verification.
- **Issue:** The initial utility injection edit left duplicated legacy fragments in `use-timed-effect.ts` and `use-toast.ts`, causing syntax errors before tests could run.
- **Fix:** Rewrote both files to the intended clock-injected implementations and re-ran focused verification successfully.
- **Files modified:** `src/ui/hooks/use-timed-effect.ts`, `src/ui/hooks/use-toast.ts`
- **Commit:** `96f7a39`

## TDD Gate Compliance

- RED for Task 1: `bun test src/time/clock.test.ts` failed because `./clock` did not exist.
- GREEN for Task 1: `bun test src/time/clock.test.ts` passed after adding `Clock`, `systemClock`, and `ManualClock`.
- RED for Task 2: focused utility tests failed because utilities did not yet accept/use injected clocks.
- GREEN for Task 2: focused utility tests, typecheck, and full suite passed after implementation.

## Known Stubs

None. Internal `null` timer sentinels and empty test arrays are implementation/test state, not UI-rendered stubs or placeholder data.

## Threat Flags

None. The plan added no network endpoints, auth paths, file access trust boundaries, or schema changes. The only new trust surface is the planned test-only ManualClock seam, and runtime utilities continue to default to `systemClock` unless explicitly injected.

## Notes

- The working tree contained pre-existing `.planning` modifications/deletions outside Plan 22-01 scope. They were not touched or staged.
- Per execution rules for this orchestrated run, `STATE.md` and `ROADMAP.md` were not updated.

## Self-Check: PASSED

- FOUND: `src/time/clock.ts`
- FOUND: `src/time/manual-clock.ts`
- FOUND: `src/time/clock.test.ts`
- FOUND: `.planning/phases/22-ux-architecture-refactor/22-01-SUMMARY.md`
- FOUND commit: `3ef34f3`
- FOUND commit: `96f7a39`
