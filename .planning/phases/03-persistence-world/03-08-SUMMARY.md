---
phase: 03-persistence-world
plan: "08"
subsystem: ui
tags: [journal-panel, quest-ui, game-screen, status-bar, tdd]
dependency_graph:
  requires:
    - 03-03 (questStore, QuestProgress, QuestState)
    - 03-04 (RelationStore — via game-screen context)
    - 03-07 (GamePhaseSchema 'journal' added, :journal command routing)
  provides:
    - JournalPanel component with active/completed/failed quest groups
    - QuestDisplayEntry type for pairing QuestProgress with QuestTemplate
    - game-screen renders JournalPanel when phase === 'journal'
    - StatusBar receives first active quest name (not null stub)
    - handleJournalClose resets phase to 'game' via direct gameStore.setState
  affects:
    - src/ui/panels/journal-panel.tsx (created)
    - src/ui/panels/journal-panel.test.ts (created)
    - src/ui/screens/game-screen.tsx (extended)
tech_stack:
  added: []
  patterns:
    - TDD (RED/GREEN per plan type: tdd, Task 1)
    - Conditional panel rendering (same pattern as DialoguePanel/CombatPanel)
    - Direct store mutation in handleJournalClose (matching game-loop pattern)
    - QuestDisplayEntry pairing pattern (progress + template co-located)
key_files:
  created:
    - src/ui/panels/journal-panel.tsx
    - src/ui/panels/journal-panel.test.ts
  modified:
    - src/ui/screens/game-screen.tsx
decisions:
  - handleJournalClose calls gameStore.setState directly (no prop threading) — matches game-loop pattern; avoids phantom prop on GameScreenProps
  - questState and questTemplates added as required GameScreenProps — makes dependency explicit; callers must provide quest context
  - QuestDisplayEntry type exported from journal-panel.tsx — keeps type co-located with the component that consumes it
  - GamePhaseSchema 'journal' was already present (added by plan 03-07) — no-op deviation documented
metrics:
  duration: 6m
  completed_date: "2026-04-21"
  tasks_completed: 2
  tasks_total: 2
  tests_before: 413
  tests_after: 418
---

# Phase 03 Plan 08: Journal UI Panel Summary

JournalPanel component with quest status groups (active/completed/failed), quest name/stage/clues/objectives display, Escape-to-close; wired into game-screen conditional panel chain with handleJournalClose using direct gameStore.setState; StatusBar quest stub replaced with first active quest name from QuestStore.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for JournalPanel and GamePhaseSchema | 617afe3 | src/ui/panels/journal-panel.test.ts |
| 1 (GREEN) | Create JournalPanel component | f340d21 | src/ui/panels/journal-panel.tsx |
| 2 | Wire JournalPanel into game-screen and StatusBar | b311030 | src/ui/screens/game-screen.tsx |

## Verification

- `bun test` — 418 tests, 0 failures (up from 413 baseline, +5 new tests)
- `grep -n "JournalPanel" src/ui/screens/game-screen.tsx` — FOUND (lines 8, 222)
- `grep -n "isInJournal" src/ui/screens/game-screen.tsx` — FOUND (lines 71, 220)
- `grep -n "activeQuestName" src/ui/screens/game-screen.tsx` — FOUND (lines 85, 179)
- `grep -n "quest={null}" src/ui/screens/game-screen.tsx` — NO MATCH (stub replaced)
- `grep -n "gameStore.setState" src/ui/screens/game-screen.tsx` — FOUND (line 131)
- `grep -n "'journal'" src/state/game-store.ts` — FOUND (line 6)

## What Was Built

**JournalPanel** (src/ui/panels/journal-panel.tsx):
- Props: `activeQuests`, `completedQuests`, `failedQuests` (each `readonly QuestDisplayEntry[]`), `onClose`
- `useInput` hook captures Escape key to call `onClose`
- Three sections: 进行中 (yellow bold), 已完成 (green bold), 已失败 (red dimmed)
- Each quest entry: name (bold), current stage description (dimColor), discovered clues (✓ green), pending objectives (□ dimColor)
- Empty sections show `<无>` in dim color
- Footer: "Esc 关闭日志"

**QuestDisplayEntry** type (exported from journal-panel.tsx):
- `{ progress: QuestProgress; template: QuestTemplate }`
- Pairing type used by game-screen to build display arrays from questStore + questTemplates Map

**game-screen.tsx extensions**:
- Imports: `JournalPanel`, `QuestDisplayEntry`, `gameStore`, `QuestState`, `QuestTemplate`
- New props: `questState: QuestState`, `questTemplates: ReadonlyMap<string, QuestTemplate>`
- `isInJournal = gameState.phase === 'journal'` conditional
- `allQuestEntries` built via `Object.entries(questState.quests)` with null-filter for missing templates (T-03-18 mitigation)
- `activeQuestName = activeQuests[0]?.template.name ?? null` passed to StatusBar
- `handleJournalClose` calls `gameStore.setState(draft => { draft.phase = 'game'; })` directly
- `scenePanelNode` conditional chain extended: combat > dialogue > journal > scene

## Deviations from Plan

### Deviation (Informational)

**GamePhaseSchema 'journal' already present**
- **Found during:** Task 1 setup
- **Issue:** Plan specifies adding 'journal' to GamePhaseSchema; however plan 03-07 already added it as a deviation (documented in 03-07-SUMMARY.md decisions section)
- **Action:** No change needed to game-store.ts — 'journal' was already in the enum
- **Impact:** Task 1 RED tests for GamePhaseSchema pass immediately (3 of 5 tests); 2 JournalPanel import tests failed as expected

## TDD Gate Compliance

- RED gate: `test(03-08)` commit 617afe3 — PASS (5 tests: 3 pass for existing GamePhaseSchema, 2 fail for missing JournalPanel)
- GREEN gate: `feat(03-08)` commit f340d21 — PASS (all 5 tests pass)

## Known Stubs

None — JournalPanel receives live questState and questTemplates from game-screen props. The `quest={null}` stub in StatusBar has been replaced with `activeQuestName` derived from questStore data.

Note: `questState` and `questTemplates` are new required props on GameScreenProps. The existing `app.tsx` already has pre-existing TypeScript errors (missing `dialogueState` and `combatState` props) which are out of scope — those are tracked as pre-existing issues.

## Threat Flags

None — all mitigations from plan threat register implemented:
- T-03-18: `allQuestEntries` building filters out null entries where template is not found — JournalPanel never receives entries with undefined template

## Self-Check: PASSED
