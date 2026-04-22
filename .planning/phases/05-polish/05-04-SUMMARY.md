---
phase: 05-polish
plan: "04"
subsystem: ui/panels
tags: [replay, panel, ink, terminal-ui, navigation]
dependency_graph:
  requires:
    - 05-01  # TurnLogEntry npcDialogue field added
  provides:
    - ReplayPanel component (src/ui/panels/replay-panel.tsx)
  affects:
    - src/ui/screens/game-screen.tsx (Wave 3 wiring, Plan 05-06)
tech_stack:
  added: []
  patterns:
    - Two-pane Ink layout (40% list | 60% detail) matching codex-panel.tsx
    - useInput keyboard nav with pageUp/pageDown support
    - Sliding window visible range for long lists
key_files:
  created:
    - src/ui/panels/replay-panel.tsx
    - src/ui/panels/replay-panel.test.tsx
  modified: []
decisions:
  - "Sliding window uses floor(VISIBLE_COUNT/2) offset to keep selection centered"
  - "VISIBLE_COUNT=8 wide, 4 narrow — matches vertical space budget of each layout"
  - "detailExpanded state collapses timestamp/turnNumber behind Enter hint (avoids clutter)"
  - "npcDialogue conditional guard checks both undefined AND empty array"
metrics:
  duration: "2 minutes"
  completed: "2026-04-22T11:19:07Z"
  tasks_completed: 1
  files_created: 2
  files_modified: 0
  tests_added: 14
  test_suite_result: "602 pass, 0 fail"
---

# Phase 05 Plan 04: ReplayPanel Summary

**One-liner:** Two-pane scrollable turn-history browser (Ink/React) with keyboard nav (↑↓/p/n/PgUp/PgDn), collapsible detail showing narration, adjudication, and NPC dialogue.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create ReplayPanel component with two-pane layout and keyboard navigation | d168e0c | src/ui/panels/replay-panel.tsx, src/ui/panels/replay-panel.test.tsx |

## What Was Built

`ReplayPanel` accepts `entries: readonly TurnLogEntry[]` and `onClose: () => void`. It renders:

- **Wide mode (width >= 100):** 40% list pane | divider | 60% detail pane
- **Narrow mode (width < 100):** stacked list above detail with separator
- **Empty state:** centered "暂无回放记录" message
- **Detail pane:** player input (dim), narration lines, adjudication result (yellow, if non-null), NPC dialogue (green, if present), collapsible timestamp/turn-number section

Keyboard bindings: `↑` / `p` = prev, `↓` / `n` = next, `PgUp` = back 5, `PgDn` = forward 5, `Enter` / `Space` = toggle expanded detail, `Esc` = close.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. Component is read-only render of existing `TurnLogEntry[]` data. Consistent with T-05-09 (no LLM re-call in replay path).

## Known Stubs

None. All fields rendered directly from `TurnLogEntry` data passed as props.

## Self-Check: PASSED

- [x] `src/ui/panels/replay-panel.tsx` exists (188 lines, >= 80 minimum)
- [x] `src/ui/panels/replay-panel.test.tsx` exists (14 tests, all pass)
- [x] Commit d168e0c exists: `feat(05-04): implement ReplayPanel component with two-pane layout`
- [x] `grep -n "export.*ReplayPanel"` returns lines 62, 188
- [x] `grep -n "npcDialogue\|pageUp\|pageDown"` returns lines 40, 43, 74, 75, 84, 87
- [x] Full suite: 602 pass, 0 fail
