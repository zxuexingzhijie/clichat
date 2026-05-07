---
phase: 22-ux-architecture-refactor
plan: 04
subsystem: ui-architecture
tags: [narrative-renderer, scene-panel, dialogue-view, panel-router, uxa-02, uxa-03]
requires:
  - phase: 22-02
    provides: [AtmosphereProvider, useToast, atmosphere dimout state]
  - phase: 22-03
    provides: [NarrativeProvider, useNarrativeText, useDialogueStream]
provides:
  - NarrativeRenderer in-place replacement for ScenePanel
  - Embedded DialogueView inside the narrative surface
  - PanelRouter routing for exploration, dialogue, and combat through NarrativeRenderer modes
affects:
  - src/ui/panels/scene-panel.tsx
  - src/ui/panels/scene-panel.test.ts
  - src/ui/panels/panel-router.tsx
tech-stack:
  added: []
  patterns: [mode-driven renderer, embedded dialogue subview, source-structure TDD tests]
key-files:
  created:
    - src/ui/panels/scene-panel.test.ts
  modified:
    - src/ui/panels/scene-panel.tsx
    - src/ui/panels/panel-router.tsx
key-decisions:
  - Preserved the existing scene-panel.tsx path while replacing the active export with NarrativeRenderer.
  - Kept dialogue mode state-driven inside NarrativeRenderer instead of mounting DialoguePanel from PanelRouter.
  - Left dialogue-panel.tsx on disk for compatibility with existing imports/tests, but it is no longer the active dialogue renderer.
requirements-completed: [UXA-02, UXA-03]
metrics:
  started: 2026-05-07T17:46:15Z
  completed: 2026-05-07T17:52:30Z
  duration: 6m15s
  tasks_completed: 2
  commits: 4
---

# Phase 22 Plan 04: NarrativeRenderer In-Place Rewrite Summary

## One-Liner

NarrativeRenderer now replaces the active ScenePanel surface in-place, with exploration, combat, and embedded NPC dialogue rendered through one mode-driven terminal narrative component.

## What Changed

- Rewrote `src/ui/panels/scene-panel.tsx` in place so the active export is `NarrativeRenderer` instead of `ScenePanel`.
- Preserved `parseSceneLine()` and scroll/autostick behavior for exploration narration history.
- Added `NarrativeMode = 'exploration' | 'dialogue' | 'combat'` and a mode-driven renderer API.
- Embedded `DialogueView` inside `scene-panel.tsx` with NPC glyph fallback `○`, cyan/bold header, relationship label, recent/full history toggle, response options, free-text submit, and Chinese hint row.
- Added renderer recovery copy for invalid dialogue props: `界面状态暂时失同步。请按 Esc 返回上一层，或重启游戏继续。`
- Updated `PanelRouter` so dialogue, combat, and exploration all render `NarrativeRenderer` from `./scene-panel`.
- Removed active `DialoguePanel` mounting from `PanelRouter`; `dialogue-panel.tsx` remains as an inactive legacy component until later cleanup is safe.

## Tasks Completed

| Task | Name | Commit | Verification |
|------|------|--------|--------------|
| RED 1 | Add failing NarrativeRenderer tests | `9697f35` | `bun test src/ui/panels/scene-panel.test.ts` failed as expected before renderer rewrite |
| 1 | Rewrite scene-panel.tsx in place as NarrativeRenderer | `a6cad1f` | `bun test src/ui/panels/scene-panel.test.ts` passed; `bun run typecheck` passed after routing import compatibility fix |
| RED 2 | Add failing PanelRouter routing tests | `10f77bb` | `bun test src/ui/panels/scene-panel.test.ts src/ui/screens/game-screen.test.ts` failed because PanelRouter still mounted DialoguePanel |
| 2 | Route dialogue/combat/exploration through NarrativeRenderer | `7e26242` | focused tests, typecheck, and full suite passed |

## Verification Evidence

Final plan verification completed successfully:

```bash
bun test src/ui/panels/scene-panel.test.ts src/ui/screens/game-screen.test.ts
bun run typecheck
bun test
```

Observed final results:

- Focused renderer/GameScreen tests: 45 pass, 0 fail.
- Typecheck: `tsc --noEmit` exit 0.
- Full suite: 1324 pass, 0 fail, 9522 assertions.

## Decisions Made

- `NarrativeRenderer` owns the flexible narrative surface for exploration, dialogue, and combat while overlay panels remain routed separately by `PanelRouter`.
- Dialogue free text is callback-only from the renderer (`onFreeTextSubmit`); deterministic dialogue processing remains outside the renderer.
- Combat display reuses `CheckResultLine` inside `NarrativeRenderer` to preserve existing combat check formatting and timing behavior.
- The existing `DialoguePanel` file was not deleted because the plan only required removing active use from `PanelRouter`; deletion can be handled by a later cleanup if no references remain.

## Deviations from Plan

None - plan executed as written.

## TDD Gate Compliance

- RED for Task 1: `scene-panel.test.ts` failed because `NarrativeRenderer`, `NarrativeMode`, `DialogueView`, and UI-SPEC empty copy did not exist yet.
- GREEN for Task 1: renderer tests passed after rewriting `scene-panel.tsx` in place and preserving `parseSceneLine`.
- RED for Task 2: routing tests failed because `PanelRouter` still imported and mounted `DialoguePanel` for dialogue mode.
- GREEN for Task 2: routing tests, GameScreen tests, typecheck, and the full suite passed after routing all active narrative modes through `NarrativeRenderer`.

## Known Stubs

None. The `TextInput` `placeholder="直接输入你的回应…"` is real player-facing input affordance copy, not a data stub. `null` values in touched files are explicit optional absence states for panels, dialogue props, combat checks, and toast/branch state.

## Threat Flags

None. This plan introduced no network endpoints, auth paths, file access patterns, schema changes, or new trust boundaries beyond those already listed in the plan. Renderer mitigations were applied: free text only invokes callbacks, dialogue/narration history remains sliced/scrollable, glyphs fall back to `○`, and renderer-level error display uses Chinese recovery copy rather than raw stack traces.

## Notes

- The working tree contained pre-existing `.planning` modifications/deletions outside Plan 22-04 scope. They were not touched or staged.
- Per execution rules for this orchestrated run, `STATE.md` and `ROADMAP.md` were not updated.

## Self-Check: PASSED

- FOUND: `src/ui/panels/scene-panel.tsx`
- FOUND: `src/ui/panels/scene-panel.test.ts`
- FOUND: `src/ui/panels/panel-router.tsx`
- FOUND: `.planning/phases/22-ux-architecture-refactor/22-04-SUMMARY.md`
- FOUND commit: `9697f35`
- FOUND commit: `a6cad1f`
- FOUND commit: `10f77bb`
- FOUND commit: `7e26242`
