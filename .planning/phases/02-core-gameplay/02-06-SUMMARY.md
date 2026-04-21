---
phase: "02"
plan: "02-06"
subsystem: npc-dialogue
tags: [gameplay, dialogue, npc, ai-roles, ui]
dependency-graph:
  requires: [02-01, 02-04, 02-05]
  provides: [dialogue-manager, dialogue-panel, talk-routing]
  affects: [game-loop, game-screen]
tech-stack:
  added: []
  patterns: [factory-with-di, store-setState, tdd-red-green]
key-files:
  created:
    - src/engine/dialogue-manager.ts
    - src/engine/dialogue-manager.test.ts
    - src/ui/panels/dialogue-panel.tsx
  modified:
    - src/ui/screens/game-screen.tsx
    - src/game-loop.ts
decisions:
  - "QUEST_GOAL_KEYWORDS excludes 'protect' to avoid false full-mode on routine guard goals; uses investigate/find/recruit/discover/locate/uncover"
  - "DialoguePanel emotion hint rendered inline after last NPC line; null hint renders nothing"
  - "Inline dialogue mode appends NPC speech as narration lines in existing ScenePanel, no layout change"
metrics:
  duration: 7m
  completed: 2026-04-21
  tasks_completed: 2
  files_created: 3
  files_modified: 2
  tests_added: 7
  tests_total: 265
requirements:
  - PLAY-03
  - AI-02
---

# Phase 02 Plan 06: NPC Dialogue System Summary

NPC dialogue system with AI-driven personality-consistent dialogue, inline/full Dialogue Mode, mind-check emotion hints, and NPC memory writing.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| RED | 399273c | test(02-06): add failing tests for dialogue manager engine |
| GREEN | a0c3a6f | feat(02-06): implement dialogue manager engine |
| 2 | 67a7fdc | feat(02-06): dialogue panel UI, game screen integration, /talk routing |

## What Was Built

**Task 1: Dialogue manager engine (TDD)**

`createDialogueManager(codexEntries, options)` with dependency injection for AI and adjudication functions:

- `startDialogue(npcId)`: finds NPC in codex, gets memories from npcMemoryStore, calls generateNpcDialogue, determines inline vs full mode, builds response options including check option in full mode, updates dialogueStore, writes memory if shouldRemember
- `processPlayerResponse(index)`: handles check options (runs adjudication, sets emotion hint on success), generates follow-up dialogue, updates dialogue history and responses, writes memory if shouldRemember
- `endDialogue()`: clears dialogueStore to default state, sets gameStore phase back to 'game'

Full mode triggers when NPC has quest-related goals (investigate/find/recruit keywords) or strong disposition (< -0.2 or > 0.5).

**Task 2: UI and routing**

- `DialoguePanel`: NPC name in bold cyan 【】, relationship label (敌对/冷淡/中立/友好/信任), last NPC speech, dim italic emotion hint, numbered response list with yellow check-option prefix, keyboard navigation (↑↓/Enter/Esc)
- `game-screen.tsx`: switches scene area to DialoguePanel when `dialogueState.active && mode === 'full'`; appends NPC speech as narration lines in ScenePanel for inline mode
- `game-loop.ts`: `dialogueManager` option added; `talk` action type routes to `dialogueManager.startDialogue(action.target)`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Keyword 'protect' falsely triggered full mode for routine guard NPCs**
- **Found during:** Task 1 GREEN phase (test failure)
- **Issue:** `npc_guard` with goal `protect_gate` contained the keyword `protect`, causing it to enter full mode when the test expected inline
- **Fix:** Removed `protect` from QUEST_GOAL_KEYWORDS; kept only clearly quest-intent keywords: `investigate`, `find`, `recruit`, `discover`, `locate`, `uncover`
- **Files modified:** src/engine/dialogue-manager.ts

## Known Stubs

None — dialogue manager calls real `generateNpcDialogue` from npc-actor.ts (Plan 04). Response options are generated from hardcoded templates per plan spec (the plan does not require AI-generated response options at this stage).

## Threat Surface Scan

No new network endpoints or auth paths introduced. Dialogue input uses indexed selection (T-02-14 mitigated: player selects from pre-defined indexed options, no raw NL passed to NPC AI for adjudication). NPC system prompt constrains NPC to known facts (T-02-15 addressed in npc-actor.ts from Plan 04).

## Self-Check: PASSED

- [x] src/engine/dialogue-manager.ts — FOUND
- [x] src/engine/dialogue-manager.test.ts — FOUND
- [x] src/ui/panels/dialogue-panel.tsx — FOUND
- [x] src/ui/screens/game-screen.tsx — FOUND (modified)
- [x] src/game-loop.ts — FOUND (modified)
- [x] Commit 399273c — test RED gate
- [x] Commit a0c3a6f — feat GREEN gate
- [x] Commit 67a7fdc — Task 2 UI+routing
- [x] 265 tests pass, 0 failures
