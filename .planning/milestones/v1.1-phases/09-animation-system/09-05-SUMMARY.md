---
phase: 09-animation-system
plan: 05
subsystem: game-screen-wiring
tags: [spinner, dimout, toast, fade, chapter-summary, overlay, wiring]
dependency_graph:
  requires: [09-01, 09-03, 09-04]
  provides: [game-screen-animation-wiring, chapter-summary-overlay, event-toast-hook]
  affects: [src/ui/screens/game-screen.tsx, src/state/game-store.ts]
tech_stack:
  added: []
  patterns: [dimout-state-machine, extracted-event-hook, overlay-panel-routing]
key_files:
  created:
    - src/ui/panels/chapter-summary-panel.tsx
    - src/ui/panels/chapter-summary-panel.test.ts
    - src/ui/hooks/use-game-event-toasts.ts
  modified:
    - src/state/game-store.ts
    - src/ui/screens/game-screen.tsx
decisions:
  - "Spinner dimout uses 3-state machine (wasProcessingRef + isSpinnerDimming + spinnerDimoutComplete) for D-07 compliance"
  - "Toast logic extracted to useGameEventToasts hook keeping game-screen.tsx at 588 lines (well under 800 limit)"
  - "Chapter summary uses uppercase 'S' shortcut to avoid conflict with lowercase shortcuts"
metrics:
  duration: 2min
  completed: "2026-04-25T14:06:21Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 2
---

# Phase 9 Plan 5: GameScreen Animation Wiring Summary

Wired spinner (D-07 dimout state machine), toast (all D-15 events via extracted useGameEventToasts hook), scene fade (500ms on scene_changed), and chapter summary overlay into GameScreen. Created ChapterSummaryPanel and added 'chapter_summary' to GamePhaseSchema.

## One-Liner

GameScreen animation integration: spinner dimout state machine, 8-event toast hook, scene fade, and chapter summary overlay at 588 lines.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create ChapterSummaryPanel, useGameEventToasts, add chapter_summary phase | d6a35c8 | chapter-summary-panel.tsx, chapter-summary-panel.test.ts, use-game-event-toasts.ts, game-store.ts |
| 2 | Wire spinner dimout, toast, scene fade, chapter summary into GameScreen | abdb375 | game-screen.tsx |

## Implementation Details

### Task 1: New Files and Schema Update

**game-store.ts**: Added `'chapter_summary'` to GamePhaseSchema enum (14 values total).

**ChapterSummaryPanel** (`src/ui/panels/chapter-summary-panel.tsx`):
- Follows ReplayPanel overlay pattern: header with title + Esc hint, Escape key closes
- Empty state: "暂无章节总结。继续冒险以生成总结。"
- Populated state: chapter headers "━━━ 第N章 ━━━" with summary text
- Props: `readonly summaries: readonly string[]`, `readonly onClose: () => void`

**useGameEventToasts** (`src/ui/hooks/use-game-event-toasts.ts`):
- Subscribes to all 8 D-15 event types via `(eventBus as any).on/off` pattern
- quest_started -> "新任务: {title}" (cyan)
- quest_completed -> "任务完成: {id}" (green)
- quest_failed -> "任务失败: {id}" (red)
- knowledge_discovered -> "图鉴解锁: {entryId}" (magenta) when codexEntryId non-null, else "发现新知识: {entryId}" (blue)
- gold_changed -> "金币 +/-{delta}" (yellow, threshold |delta| >= 10)
- reputation_changed -> "{target} 关系变化: +/-{delta}" (yellow)
- item_acquired -> "获得物品: {itemName}" (green)
- summarizer_task_completed -> "新章节总结可查看" (cyan, only for chapter_summary type)

### Task 2: GameScreen Wiring

**Spinner D-07 dimout state machine**:
- `useTimedEffect(150)` for the dimming transition
- `wasProcessingRef` tracks previous processing state
- When streaming starts while spinner was showing: trigger 150ms dimout
- `spinnerDimoutComplete` prevents spinner from reappearing after dimout
- `showSpinnerWithDim` combines active spinner and dimming spinner states
- `isSpinnerDimming` passed to ScenePanel for `dimColor` on spinner text

**Toast**: Single line `const { toast } = useGameEventToasts()` replaces ~40 lines of inline subscriptions.

**Scene fade**: `useTimedEffect(500)` triggered by `eventBus.on('scene_changed')`, `isSceneDimmed` passed as `isDimmed` to ScenePanel.

**Chapter summary overlay**: `isInChapterSummary` flag added to `isInOverlayPanel`, renders `ChapterSummaryPanel` with summaries from `getRecentChapterSummaries()`, keyboard shortcut 'S' (uppercase).

**ScenePanel new props**: `showSpinner={showSpinnerWithDim}`, `spinnerContext={spinnerContext}`, `toast={toast}`, `isDimmed={isSceneDimmed}`, `isSpinnerDimming={isSpinnerDimming}`.

## Deviations from Plan

None -- plan executed exactly as written.

## Human Verification Pending

Task 3 (checkpoint:human-verify) was not executed per instructions. Visual verification of the full animation system (spinner dimout, toast, scene fade, HP flash, chapter summary overlay) should be done manually by running the game.

## Known Stubs

None. All components are fully wired with their intended data flow.

## Verification

```
bun build src/ui/screens/game-screen.tsx --no-bundle -> compiles clean
bun build src/ui/hooks/use-game-event-toasts.ts --no-bundle -> compiles clean
bun build src/state/game-store.ts --no-bundle -> compiles clean
bun test src/ui/panels/chapter-summary-panel.test.ts -> 2 pass, 0 fail
grep key patterns -> 15 matches (well above 5 minimum)
wc -l game-screen.tsx -> 588 lines (under 800 limit)
bun test -> 737 pass, 0 fail
```

## Self-Check: PASSED

- [x] src/ui/panels/chapter-summary-panel.tsx exists
- [x] src/ui/panels/chapter-summary-panel.test.ts exists
- [x] src/ui/hooks/use-game-event-toasts.ts exists
- [x] src/state/game-store.ts modified with 'chapter_summary'
- [x] src/ui/screens/game-screen.tsx modified with all animation wiring
- [x] Commit d6a35c8 exists
- [x] Commit abdb375 exists
