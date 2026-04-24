---
phase: 06-bug-fixes-live-validation
plan: 01
subsystem: ui/game-loop
tags: [bug-fix, game-loop, narration, controlled-input]
key-files:
  - src/ui/hooks/use-game-input.ts
  - src/ui/panels/input-area.tsx
  - src/app.tsx
  - src/ui/screens/game-screen.tsx
  - src/ui/screens/game-screen.test.ts
metrics:
  tasks: 2/2
  tests_added: 11
  files_changed: 5
---

# Plan 06-01 Summary: Wire Game Loop into GameScreen (BUG-01)

## What Changed

### Task 1: Lift inputValue into useGameInput + make InputArea controlled
- Added `inputValue` (string) and `setInputValue` to `useGameInput()` hook return
- Removed internal `useState` from `InputArea` — now accepts `value`/`onChange` as controlled props
- `GameScreen` passes `inputValue`/`setInputValue` from hook down to `InputArea`

### Task 2: Wire gameLoop into AppInner and implement handleActionExecute
- `AppInner` creates `gameLoop` via `useMemo(() => createGameLoop(), [])` and passes to `GameScreen`
- `handleActionExecute` replaces the Phase 1 stub with full flow:
  1. Guards on missing action/gameLoop
  2. Sets `inputMode('processing')` (D-03)
  3. Calls `gameLoop.processInput()` — adjudication first (D-02)
  4. Calls `generateNarration()` — narration second (D-02)
  5. Appends result to `sceneStore.narrationLines`
  6. Error paths: `[错误]` for processInput failure, `[叙事错误]` for narration failure (D-04)
  7. Returns to `action_select` in `finally` block (D-03)

## Commits

| Hash | Description |
|------|-------------|
| `addc6f8` | fix(06-01): lift inputValue into useGameInput and make InputArea controlled |
| `19b0371` | fix(06-01): fix unicode escape assertion in game-screen test |

## Deviations

- Test for D-04 Chinese error prefix uses unicode escape matching (`\u9519\u8BEF`) instead of literal Chinese chars, because Bun compiles Chinese to unicode escapes in `Function.toString()`.
- Task 2 commit was split: executor completed the implementation but got blocked on a hook permission issue for the test unicode fix. Orchestrator completed the test fix in a separate commit.

## Self-Check: PASSED

- [x] `useGameInput()` returns `inputValue` and `setInputValue`
- [x] `InputArea` is controlled (value/onChange from parent)
- [x] `AppInner` creates `gameLoop` with `useMemo` and passes to `GameScreen`
- [x] `handleActionExecute` calls processInput then generateNarration (D-02)
- [x] `setInputMode('processing')` before async, `action_select` in finally (D-03)
- [x] Error paths write to narrationLines (D-04)
- [x] `bun test src/ui/screens/game-screen.test.ts` — 11/11 pass
- [x] `bun test` — 652 pass, 0 fail
