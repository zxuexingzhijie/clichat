---
phase: 09-animation-system
plan: 03
subsystem: ui-components
tags: [spinner, toast, scene-panel, animation, fade]
dependency_graph:
  requires: [09-01]
  provides: [scene-spinner, toast-banner, scene-panel-animation-slots]
  affects: [09-04, 09-05]
tech_stack:
  added: []
  patterns: [context-specific-labels, dimColor-fade, optional-prop-slots]
key_files:
  created:
    - src/ui/components/scene-spinner.tsx
    - src/ui/components/toast-banner.tsx
    - src/ui/components/scene-spinner.test.ts
  modified:
    - src/ui/panels/scene-panel.tsx
decisions:
  - "FadeWrapper omitted -- Ink Text dimColor applied directly to ScenePanel lines (Text cannot wrap Box)"
  - "SpinnerContext type exported from scene-spinner.tsx for reuse by ScenePanel"
metrics:
  duration: 1min
  completed: "2026-04-25T13:59:00Z"
---

# Phase 9 Plan 3: SceneSpinner, ToastBanner, and ScenePanel Integration Summary

SceneSpinner wraps @inkjs/ui Spinner with Chinese atmosphere labels per context (narration/npc_dialogue/combat); ToastBanner renders single-line colored notifications; ScenePanel gains spinner, toast, fade, and spinner-dimming slots via optional props.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 8ea123e | feat | Create SceneSpinner and ToastBanner components |
| ec43763 | feat | Integrate spinner, toast, fade, and dimming into ScenePanel |

## Task Results

### Task 1: Create SceneSpinner and ToastBanner components

**SceneSpinner** (`src/ui/components/scene-spinner.tsx`):
- Wraps `@inkjs/ui` Spinner with `type="dots"` and context-specific Chinese labels
- Three contexts: `narration` (2 labels), `npc_dialogue` (1 label), `combat` (2 labels)
- Label selected randomly via `useState` initializer for stability across re-renders
- Exports `SpinnerContext` type and `SPINNER_LABELS` for testing

**ToastBanner** (`src/ui/components/toast-banner.tsx`):
- Renders `ToastData` (icon + message) as bold colored text in a padded Box
- Imports `ToastData` type from `use-toast.ts`

**Tests**: 6 tests, 0 failures -- structural validation of exports, label contents, and types.

### Task 2: Integrate spinner, toast, fade, and spinner-dimming into ScenePanel

Enhanced `ScenePanelProps` with 5 new optional props:
- `showSpinner` / `spinnerContext` -- render SceneSpinner when waiting for content
- `toast` -- render ToastBanner at top of panel
- `isDimmed` -- apply `dimColor` to narration lines for scene fade
- `isSpinnerDimming` -- apply `dimColor` to spinner for D-07 fade-out transition

Render order: toast (top) -> spinner OR content. All new props optional, zero impact on existing callers.

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None. All components are fully wired with their intended data flow through props.
