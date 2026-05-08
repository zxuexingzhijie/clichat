---
phase: 22-ux-architecture-refactor
plan: 06
subsystem: ui-architecture
tags: [gap-closure, input-provider, overlay-panels, state-machine, uxa-04]
requires:
  - phase: 22-05
    provides: [InputProvider, seven-state input state machine, slim GameScreen]
provides:
  - useOverlayPanelData selector for App-provided map/codex/branch overlay data
  - GameScreen-to-PanelRouter overlay data wiring without restoring domain logic to GameScreen
  - Provider currentState gates for MAP, CODEX, BRANCH, and compare overlay keyboard handlers
affects:
  - src/ui/providers/input-provider.tsx
  - src/ui/providers/input-provider.test.ts
  - src/ui/screens/game-screen.tsx
  - src/ui/screens/game-screen.test.ts
  - src/ui/panels/panel-router.tsx
  - src/ui/panels/map-panel.tsx
  - src/ui/panels/codex-panel.tsx
  - src/ui/panels/branch-tree-panel.tsx
  - src/ui/panels/compare-panel.tsx
tech-stack:
  added: []
  patterns: [provider selector data boundary, active-state keyboard gating, TDD gap closure]
key-files:
  created: []
  modified:
    - src/ui/providers/input-provider.tsx
    - src/ui/providers/input-provider.test.ts
    - src/ui/screens/game-screen.tsx
    - src/ui/screens/game-screen.test.ts
    - src/ui/panels/panel-router.tsx
    - src/ui/panels/map-panel.tsx
    - src/ui/panels/codex-panel.tsx
    - src/ui/panels/branch-tree-panel.tsx
    - src/ui/panels/compare-panel.tsx
key-decisions:
  - Overlay data remains App-computed and crosses InputProvider as read-only selector data.
  - GameScreen consumes one compact overlay selector and stays a thin 70-line orchestrator.
  - Existing overlay panels keep local navigation behavior, but Ink useInput handlers are gated by provider currentState.
requirements-completed: [UXA-04]
metrics:
  duration: ~10 minutes
  tasks: 3
  files_modified: 9
  completed: 2026-05-08T04:58:58Z
---

# Phase 22 Plan 06: UXA-04 Overlay Gap Closure Summary

**MAP/CODEX/BRANCH overlay panels now receive real provider data and only process keyboard input when their InputProvider state is active.**

## Performance

- **Duration:** ~10 minutes
- **Completed:** 2026-05-08T04:58:58Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added `OverlayPanelData` and `useOverlayPanelData()` to `InputProvider`, exposing App-provided `mapData`, `codexEntries`, `branchTree`, `currentBranchId`, `branches`, `readSaveData`, and `saveDir` without fabricating placeholder data.
- Wired `GameScreen` to call `useOverlayPanelData()` exactly once and pass overlay dependencies through to `PanelRouter` while remaining 70 physical lines.
- Updated `PanelRouter` to consume `useInputState()` and pass `isActive` gates to map, codex, branch tree, and branch compare panels.
- Added backward-compatible `isActive = true` props to `MapPanel`, `CodexPanel`, `BranchTreePanel`, and `ComparePanel`, and changed each local Ink `useInput` call to `useInput(handler, { isActive })`.
- Preserved branch switch confirmation behavior; no single-key destructive branch switching was introduced.

## Task Commits

1. **Task 1: Expose overlay panel data through InputProvider selector hook** — `0f0da16`
2. **Task 2: Wire GameScreen PanelRouter to provider overlay data without thickening GameScreen** — `0bc5a71`
3. **Task 3: Gate MAP/CODEX/BRANCH panel-local keyboard handlers by InputProvider currentState** — `2f08ac5`

## Files Created/Modified

- `src/ui/providers/input-provider.tsx` — `OverlayPanelData` type, overlay props in context value, and `useOverlayPanelData()` selector.
- `src/ui/providers/input-provider.test.ts` — TDD source-structure tests for overlay selector, PanelRouter currentState gates, and panel `isActive` useInput gating.
- `src/ui/screens/game-screen.tsx` — compact overlay selector call and PanelRouter overlay prop pass-through.
- `src/ui/screens/game-screen.test.ts` — tests confirming selector use, pass-through props, and under-100-line constraint.
- `src/ui/panels/panel-router.tsx` — provider currentState read and `isActive` props for MAP/CODEX/BRANCH/compare overlays.
- `src/ui/panels/map-panel.tsx` — optional `isActive` prop gating local map navigation handler.
- `src/ui/panels/codex-panel.tsx` — optional `isActive` prop gating local codex navigation/search handler.
- `src/ui/panels/branch-tree-panel.tsx` — optional `isActive` prop gating local branch navigation and confirm-before-switch handler.
- `src/ui/panels/compare-panel.tsx` — optional `isActive` prop gating local compare navigation handler.

## Verification Evidence

Final verification completed successfully:

```bash
/Users/makoto/.bun/bin/bun test src/ui/providers/input-provider.test.ts src/ui/screens/game-screen.test.ts
/Users/makoto/.bun/bin/bun run typecheck
/Users/makoto/.bun/bin/bun test
```

Observed results:

- Focused InputProvider/GameScreen tests: 54 pass, 0 fail, 173 assertions.
- Typecheck: `tsc --noEmit` exit 0.
- Full suite: 1346 pass, 0 fail, 9665 assertions.
- GameScreen line count: 70 physical lines.

## Success Criteria Check

| Criterion | Status | Evidence |
|---|---|---|
| `useOverlayPanelData()` exists and returns real App-provided map/codex/branch/compare data | PASS | `InputProvider` context stores and returns the seven overlay dependencies directly. |
| GameScreen passes overlay data to PanelRouter while staying under 100 lines | PASS | `GameScreen` calls `useOverlayPanelData()` once; `wc -l` reports 70 lines. |
| MAP/CODEX/BRANCH/COMPARE overlay panels gate local `useInput` handlers via provider currentState | PASS | `PanelRouter` passes `isActive={currentState === ...}`; panels call `useInput(..., { isActive })`. |
| No Phase 23 world-pack or Phase 24 delight-layer behavior added | PASS | Changes are limited to provider data wiring and input handler gating. |
| Focused tests, typecheck, and full suite pass | PASS | Commands above all passed. |

## Deviations from Plan

None - plan executed exactly as written.

## Auth Gates

None.

## Known Stubs

None found in created/modified plan files. The implementation preserves explicit `undefined` absence states for missing overlay data rather than adding placeholder map/codex/branch content.

## Threat Flags

None. This plan restored existing UI data flow and keyboard gating only; it introduced no new network endpoints, auth paths, file access patterns, or schema changes.

## Deferred Issues

None.

## Self-Check: PASSED

- FOUND: `.planning/phases/22-ux-architecture-refactor/22-06-SUMMARY.md`
- FOUND: `0f0da16`
- FOUND: `0bc5a71`
- FOUND: `2f08ac5`
