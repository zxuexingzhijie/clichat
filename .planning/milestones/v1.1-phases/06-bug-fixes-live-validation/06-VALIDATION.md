# Phase 6: Bug Fixes & Live Validation — Validation Architecture

**Source:** Extracted from 06-RESEARCH.md §Validation Architecture
**Phase:** 06-bug-fixes-live-validation

---

## Test Framework

| Property | Value |
|----------|-------|
| Framework | bun test (built-in) |
| Config file | none (bun detects `*.test.ts` automatically) |
| Quick run command | `bun test src/ui/hooks/use-game-input.test.ts` |
| Full suite command | `bun test` |

---

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUG-01 | handleActionExecute triggers processInput and updates sceneStore | unit | `bun test src/ui/screens/game-screen.test.ts` | Wave 0 gap |
| BUG-02 | / and Tab set inputMode to input_active; Escape clears/deactivates | unit | `bun test src/ui/hooks/use-game-input.test.ts` | Extend existing |
| BUG-03 | :quit/:exit command routes to pendingQuit; SIGINT sets store flag | unit | `bun test src/input/command-registry.test.ts` | Wave 0 gap |
| CARRY-01 | Live API: cost recorded, replay data flows, summarizer triggered | integration (manual) | `bun scripts/validate-live.ts` | Wave 0 gap |

---

## Test Cases Per Requirement

### BUG-01 — handleActionExecute (game-screen.test.ts)

| Case | Input | Expected |
|------|-------|----------|
| Happy path | valid action index + gameLoop.processInput returns `{ status: 'ok' }` | sceneStore.narrationLines gains new narration entry |
| processInput error | gameLoop.processInput returns `{ status: 'error', message: 'fail' }` | `[错误] fail` appended to narrationLines; mode returns to action_select |
| Missing action | index has no matching action in sceneState.actions | handler returns early; processInput not called |
| Missing gameLoop | gameLoop prop is undefined | handler returns early; no call, no crash |

### BUG-02 — Focus switch (game-screen.test.ts)

| Case | Input | Expected |
|------|-------|----------|
| Slash activates | '/' key when !isTyping, !isInCombat, !isInDialogue, !isOverlay | setInputMode called with 'input_active' |
| Tab activates | key.tab=true, same guards | setInputMode called with 'input_active' |
| Escape clears non-empty | key.escape, inputMode='input_active', inputValue='hello' | setInputValue called with '' |
| Escape deactivates empty | key.escape, inputMode='input_active', inputValue='' | setInputMode called with 'action_select' |
| Overlay Escape unaffected | key.escape, isInOverlayPanel=true | overlay handler fires; new branch does not fire |

### BUG-03 — Quit commands (command-registry.test.ts + game-screen.test.ts)

| Case | Input | Expected |
|------|-------|----------|
| :quit parsed | parseCommand('quit') | `{ type: 'quit', target: null }` |
| :exit parsed | parseCommand('exit') | `{ type: 'quit', target: null }` |
| SIGINT sets flag | process.emit('SIGINT') | gameStore.getState().pendingQuit === true |

### CARRY-01 — Live validation (scripts/validate-live.ts, manual)

| Case | Trigger | Expected |
|------|---------|----------|
| /cost token data | generateNarration() with real API key | getCostSummary().totalInputTokens > 0 |
| /cost output tokens | same | getCostSummary().totalOutputTokens > 0 |
| /cost per-role breakdown | same | Object.keys(getCostSummary().byRole).length > 0 |
| /replay entries populated | processInput('look') seeds turn log | getLastReplayEntries().length > 0 |
| Summarizer triggered | evaluateTriggers('save_game_completed') + runNextTask() | runNextTask() returns true |

---

## Sampling Rate

| Checkpoint | Command |
|------------|---------|
| Per task commit | `bun test src/ui/hooks/use-game-input.test.ts` |
| Per wave merge | `bun test` |
| Phase gate (automated) | `bun test` — full suite green |
| Phase gate (manual) | `bun scripts/validate-live.ts` — run with real API keys before marking phase done |

---

## Wave 0 Gaps (files that must be created before implementation)

These test files do not exist yet. Plans 01, 03, and 04 create them as part of their TDD tasks.

| File | Created By | Covers |
|------|-----------|--------|
| `src/ui/screens/game-screen.test.ts` | Plan 01 Task 2 | BUG-01 handleActionExecute, BUG-02 focus switch |
| `src/input/command-registry.test.ts` | Plan 03 Task 1 | BUG-03 :quit/:exit, SIGINT → pendingQuit |
| `scripts/validate-live.ts` | Plan 04 Task 2 | CARRY-01 live API validation |

---

## Test Harness Patterns

### command-registry.test.ts — existing harness to extend
```typescript
import { describe, it, expect } from 'bun:test';
import { Command } from 'commander';
import { registerCommands } from './command-registry';
import type { GameAction } from '../types/game-action';

function parseCommand(input: string): GameAction | null {
  let result: GameAction | null = null;
  const program = new Command();
  program.exitOverride();
  program.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  registerCommands(program, (action) => { result = action; });
  try {
    program.parse(input.split(' '), { from: 'user' });
  } catch { }
  return result;
}
```

### game-screen.test.ts — logic test harness (no React renderer needed)
```typescript
import { describe, it, expect, mock } from 'bun:test';
import { sceneStore } from '../../state/scene-store';
import { gameStore } from '../../state/game-store';

const mockGameLoop = {
  processInput: mock(async (_label: string, _opts: unknown) => ({ status: 'ok' as const })),
};
```

### use-game-input.test.ts — hook shape assertion
```typescript
import { describe, it, expect } from 'bun:test';
import { useGameInput } from './use-game-input';
// If renderHook unavailable, test return type via TypeScript type assertion
// and test store side-effects via sceneStore/gameStore state
```

---

## Security Validation Notes

Per RESEARCH.md §Security Domain:

| Check | Validation |
|-------|-----------|
| API keys never logged | Inspect validate-live.ts output: must show 'set'/'MISSING', never the key value |
| SIGINT fallback | If gameStore.setState throws, process.exit(0) is called (try/catch in index.tsx) |
| InlineConfirm key capture | Confirm component only captures keys when mounted (pendingQuit === true) |
