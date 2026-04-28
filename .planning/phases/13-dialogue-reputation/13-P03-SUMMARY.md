---
phase: 13-dialogue-reputation
plan: P03
subsystem: dialogue
tags: [dialogue, npc, ui, free-text, roles]
dependency_graph:
  requires: [13-P01]
  provides: [NPC_ROLE_QUESTIONS extended, processPlayerFreeText, DialoguePanel TextInput]
  affects: [dialogue-manager, dialogue-panel, panel-router, game-screen]
tech_stack:
  added: []
  patterns: [TextInput from @inkjs/ui, isFreeTextMode state toggle, useInput isActive guard]
key_files:
  created:
    - src/ui/panels/dialogue-panel.test.tsx
  modified:
    - src/engine/dialogue-manager.ts
    - src/engine/dialogue-manager.test.ts
    - src/ui/panels/dialogue-panel.tsx
    - src/ui/panels/panel-router.tsx
    - src/ui/screens/game-screen.tsx
    - src/ui/screens/game-screen.test.ts
    - src/engine/game-screen-controller.test.ts
decisions:
  - "clergy added as separate key (not merged with religious) — explicit tag match"
  - "isFreeTextMode toggled via onChange (first char typed) rather than focus event — @inkjs/ui TextInput has no onFocus"
  - "useInput isActive: isActive && !isFreeTextMode — combined with parent isActive prop"
  - "Escape handled in single useInput: if isFreeTextMode, exit text mode; else call onEscape"
  - "onDialogueFreeText prop name used on PanelRouter; onFreeTextSubmit used on DialoguePanel"
metrics:
  duration: ~20 minutes
  completed: 2026-04-28T10:06:26Z
  tasks_completed: 2
  files_changed: 8
---

# Phase 13 Plan P03: NPC Role Questions + Inline TextInput Free-Text Dialogue Summary

NPC role coverage extended to 6 new roles (innkeeper/hunter/military/clergy/beggar/underworld) with world-appropriate Chinese questions; DialoguePanel gains inline TextInput with mode-toggle so players can type free-text responses to NPCs without leaving dialogue.

## Tasks Completed

| Task | Description | Commit | Key Files |
|------|-------------|--------|-----------|
| 1 | Add innkeeper/hunter/military/clergy/beggar/underworld to NPC_ROLE_QUESTIONS | 1585de4 | dialogue-manager.ts, dialogue-manager.test.ts |
| 2 | Add TextInput + processPlayerFreeText + wire onFreeTextSubmit in game-screen | 9dda116 | dialogue-panel.tsx, dialogue-panel.test.tsx, panel-router.tsx, game-screen.tsx, game-screen.test.ts, game-screen-controller.test.ts |

## What Was Built

### Task 1: NPC_ROLE_QUESTIONS Extended

Six new entries added to `NPC_ROLE_QUESTIONS` in `src/engine/dialogue-manager.ts`:

- `innkeeper` — room availability, town news, food specialties
- `hunter` — dangerous prey, road safety, strange tracks
- `military` — current mission, abnormal movements, area jurisdiction
- `clergy` — divine revelation, sanctuary, services provided
- `beggar` — need for help, almshouse locations, unusual sightings
- `underworld` — special services, black market inventory, boss contact

The existing tag-matching loop (`for tag of npc.tags, break on first match`) is already correct — no changes needed. `clergy` added as its own key rather than merging with `religious` to keep explicit tag semantics.

### Task 2: DialoguePanel TextInput + processPlayerFreeText

**`src/ui/panels/dialogue-panel.tsx`:**
- Added `onFreeTextSubmit: (text: string) => void` prop
- Added `useState(false)` for `isFreeTextMode`
- `useInput` now has `isActive: isActive && !isFreeTextMode` — disables arrow/number key capture when typing
- Escape handler checks `isFreeTextMode` first: if true, calls `setIsFreeTextMode(false)` and returns; otherwise calls `onEscape`
- `TextInput` rendered below numbered options with `onChange` to activate text mode on first character, `onSubmit` to call `onFreeTextSubmit` with trimmed text and reset mode
- Hint text updated to include `直接输入文字 回复NPC`

**`src/engine/dialogue-manager.ts`:**
- `DialogueManager` interface gains `processPlayerFreeText(text: string): Promise<DialogueResult | null>`
- Implementation delegates to `doGenerateDialogue` with the raw text as the player action — same NL path as `processPlayerResponse` but with free text instead of a numbered option label

**`src/ui/panels/panel-router.tsx`:**
- Added `onDialogueFreeText: (text: string) => void` to `PanelRouterProps`
- Passes it as `onFreeTextSubmit` to `<DialoguePanel>`

**`src/ui/screens/game-screen.tsx`:**
- Added `handleDialogueFreeText` callback wired to `dialogueManager?.processPlayerFreeText(text)`
- Passed as `onDialogueFreeText` to `<PanelRouter>`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] DialogueManager interface missing processPlayerFreeText in controller test mock**
- **Found during:** Task 2 — tsc check after implementation
- **Issue:** `game-screen-controller.test.ts` had two `DialogueManager` mock objects lacking the new `processPlayerFreeText` method, causing TS2741 errors
- **Fix:** Added `processPlayerFreeText: mock(async (_t: string) => null)` to both mocks
- **Files modified:** `src/engine/game-screen-controller.test.ts`
- **Commit:** 9dda116

**2. [Rule 1 - Bug] Chinese hint text test used literal string, compiled output uses unicode escapes**
- **Found during:** Task 2 — first GREEN test run
- **Issue:** `DialoguePanel.toString()` returns compiled JS with `\u76F4\u63A5...` not decoded Chinese; `toContain('直接输入')` always failed
- **Fix:** Changed test to use regex `/直接输入|\u76F4\u63A5\u8F93\u5165|\\u76F4/` which matches the literal backslash-u form present in the compiled output
- **Files modified:** `src/ui/panels/dialogue-panel.test.tsx`
- **Commit:** 9dda116

**3. [Rule 1 - Bug] Game-screen test checked for `onFreeTextSubmit` in GameScreen source but GameScreen uses `onDialogueFreeText` (PanelRouter prop name)**
- **Found during:** Task 2 — first GREEN test run
- **Issue:** Test expected `GameScreen.toString()` to contain `onFreeTextSubmit` but GameScreen passes prop as `onDialogueFreeText` to PanelRouter
- **Fix:** Updated test assertion to check for `onDialogueFreeText` and `processPlayerFreeText` instead
- **Files modified:** `src/ui/screens/game-screen.test.ts`
- **Commit:** 9dda116

## Known Stubs

None. All new role questions are real Chinese content. TextInput wired to live `processPlayerFreeText` → `doGenerateDialogue` path.

## Threat Flags

No new network endpoints, auth paths, or trust boundaries introduced beyond what the plan's threat model covers (T-13P03-01, T-13P03-02 both mitigated as designed).

## Self-Check: PASSED

- [x] `src/engine/dialogue-manager.ts` — NPC_ROLE_QUESTIONS has innkeeper/hunter/military/clergy/beggar/underworld
- [x] `src/ui/panels/dialogue-panel.tsx` — onFreeTextSubmit prop, TextInput rendered, isFreeTextMode state
- [x] `src/ui/panels/panel-router.tsx` — onDialogueFreeText prop threaded through
- [x] `src/ui/screens/game-screen.tsx` — handleDialogueFreeText wired to processPlayerFreeText
- [x] Commit 1585de4 exists (Task 1)
- [x] Commit 9dda116 exists (Task 2)
- [x] bun tsc --noEmit: clean
- [x] 53 targeted tests pass (dialogue-manager + dialogue-panel + game-screen)
- [x] Pre-existing use-game-input.test.ts failure unchanged (out of scope)
