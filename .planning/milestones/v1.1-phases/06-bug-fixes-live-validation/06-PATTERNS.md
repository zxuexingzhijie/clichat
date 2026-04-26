# Phase 6: Bug Fixes & Live Validation - Pattern Map

**Mapped:** 2026-04-23
**Files analyzed:** 8 (modified) + 3 (new)
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/ui/screens/game-screen.tsx` | screen/orchestrator | event-driven | self (existing, being modified) | exact |
| `src/ui/hooks/use-game-input.ts` | hook/state-machine | event-driven | self (existing, being modified) | exact |
| `src/input/command-registry.ts` | command-router | request-response | self (existing, extend) | exact |
| `src/types/game-action.ts` | schema/enum | transform | self (existing, extend) | exact |
| `src/state/game-store.ts` | store | CRUD | `src/state/scene-store.ts` | role-match |
| `src/index.tsx` | entrypoint | event-driven | self (existing, being modified) | exact |
| `src/ui/panels/input-area.tsx` | component | event-driven | self (existing, lift value up) | exact |
| `src/app.tsx` | orchestrator | request-response | self (existing, add gameLoop prop) | exact |
| `src/ui/screens/game-screen.test.ts` | test | unit | `src/input/command-registry.test.ts` | role-match |
| `src/input/command-registry.test.ts` | test | unit | self (existing, extend) | exact |
| `scripts/validate-live.ts` | validation-script | batch | `src/ai/roles/retrieval-planner.test.ts` | partial |

---

## Pattern Assignments

### `src/ui/screens/game-screen.tsx` — BUG-01: handleActionExecute

**Change type:** Modify stub into real implementation + wire `gameLoop` prop

**Analog for handler pattern** — `handleCombatExecute` (lines 159-167):
```typescript
const handleCombatExecute = useCallback(
  (index: number) => {
    if (!combatLoop) return;
    const actionType = COMBAT_ACTION_TYPES[index] ?? 'attack';
    combatLoop.processPlayerAction(actionType).catch(() => {});
    setCombatSelectedIndex(0);
  },
  [combatLoop],
);
```

**Analog for dialogue handler pattern** — `handleDialogueExecute` (lines 142-149):
```typescript
const handleDialogueExecute = useCallback(
  (index: number) => {
    if (dialogueManager) {
      dialogueManager.processPlayerResponse(index).catch(() => {});
      setDialogueSelectedIndex(0);
    }
  },
  [dialogueManager],
);
```

**Target pattern for handleActionExecute** — copy `handleCombatExecute` shape with processInput:
- Guard on `!action || !gameLoop` (null guard same as `!combatLoop`)
- Call `setInputMode('processing')` before async call
- Call `gameLoop.processInput(action.label, { source: 'action_select' })`
- On `result.status === 'error'`: append `[错误] ${result.message}` to `sceneStore.narrationLines` (see game-loop.ts lines 307-311 for the narrationLines setState pattern)
- In `finally`: call `setInputMode('action_select')`

**Analog for props pattern** — existing optional prop declaration (lines 48-49):
```typescript
readonly dialogueManager?: DialogueManager;
readonly combatLoop?: CombatLoop;
```
Add `readonly gameLoop?: GameLoop;` in the same block. Import `GameLoop` from `../../game-loop`.

**Analog for inputMode transitions in useInput** — existing escape branch (lines 179-188):
```typescript
useInput(useCallback((input: string, key: { escape: boolean }) => {
  if (key.escape && isInOverlayPanel) {
    gameStore.setState(draft => { draft.phase = 'game'; });
    return;
  }
  const panelAction = getPanelActionForKey(input, isTyping);
  ...
}, [isTyping, isInCombat, isInDialogueMode, isInOverlayPanel]));
```
New `/` and Tab branches must be inserted BEFORE the `getPanelActionForKey` call and must `return` early. Add `inputMode` and `inputValue` to the dependency array.

**Analog for InlineConfirm conditional render** — `isInReplay` conditional panel render (lines 329-331):
```typescript
: isInReplay
  ? <ReplayPanel entries={[...getLastReplayEntries()]} onClose={handlePanelClose} />
  : <ScenePanel lines={sceneLines} />;
```
For BUG-03: conditionally render `<InlineConfirm>` when `gameState.pendingQuit === true`. Mount it at the bottom of the layout (after `<InputArea>`), NOT inside the scene tree. Only render it when true — do not pass `isActive` prop; rely on React unmount to deactivate its `useInput`.

---

### `src/ui/hooks/use-game-input.ts` — BUG-02: export inputValue/setInputValue

**Change type:** Lift `value` state out of `InputArea` into this hook so parent can read/reset it on Escape.

**Current return shape** (lines 7-13):
```typescript
type UseGameInputReturn = {
  readonly inputMode: InputMode;
  readonly setInputMode: (mode: InputMode) => void;
  readonly selectedActionIndex: number;
  readonly setSelectedActionIndex: (index: number) => void;
  readonly isTyping: boolean;
};
```

**Target:** Add `inputValue: string` and `setInputValue: (v: string) => void` to the return type and hook body using the same `useState` pattern already in the hook (lines 29-30):
```typescript
const [inputMode, setInputMode] = useState<InputMode>('action_select');
const [selectedActionIndex, setSelectedActionIndex] = useState(0);
```
Add `const [inputValue, setInputValue] = useState('');` in the same style.

This value is then passed as a controlled prop to `InputArea` (lifting `value` out of `InputArea`'s internal state), enabling the parent's `useInput` Escape handler to call `setInputValue('')` to clear.

---

### `src/ui/panels/input-area.tsx` — BUG-02: controlled value prop

**Change type:** Accept `value` and `onChange` as controlled props instead of owning internal state.

**Current internal state** (lines 16):
```typescript
const [value, setValue] = useState('');
```

**Current TextInput usage** (lines 41-44):
```typescript
<TextInput
  isDisabled={!isActive}
  onChange={setValue}
  onSubmit={handleSubmit}
/>
```

**Target:** Remove internal `useState` for `value`. Add `value` and `onChange` to `InputAreaProps`. Pass them through to `TextInput`. `@inkjs/ui` `TextInput` supports controlled mode via `value` + `onChange` props.

**Analog for controlled component pattern** — `DialoguePanel` uses index as controlled prop from parent (game-screen.tsx lines 265-276):
```typescript
<DialoguePanel
  ...
  selectedIndex={dialogueSelectedIndex}
  onSelect={setDialogueSelectedIndex}
  ...
/>
```

---

### `src/input/command-registry.ts` — BUG-03: register :quit / :exit

**Change type:** Add two new `program.command()` registrations.

**Exact analog** — `guard` and `flee` no-argument commands (lines 63-73):
```typescript
program
  .command('guard')
  .action(() => {
    setResult({ type: 'guard', target: null, modifiers: {}, source: 'command' });
  });

program
  .command('flee')
  .action(() => {
    setResult({ type: 'flee', target: null, modifiers: {}, source: 'command' });
  });
```

Copy this exact pattern for `quit` and `exit`, substituting `type: 'quit'`.

---

### `src/types/game-action.ts` — BUG-03: add 'quit' to enum

**Change type:** Add one entry to the Zod enum.

**Current enum** (lines 3-9):
```typescript
export const GameActionTypeSchema = z.enum([
  'move', 'look', 'talk', 'attack', 'use_item',
  'cast', 'guard', 'flee', 'inspect', 'trade',
  'help', 'save', 'load', 'journal', 'quest',
  'branch', 'compare', 'map', 'codex', 'replay', 'cost',
  'unknown',
]);
```

Add `'quit'` to the end of the existing group (before `'unknown'`). No other changes needed.

---

### `src/state/game-store.ts` — BUG-03: add pendingQuit field

**Change type:** Add one boolean field to `GameStateSchema` and `getDefaultGameState`.

**Current schema** (lines 8-14):
```typescript
export const GameStateSchema = z.object({
  day: z.number().int().min(1),
  timeOfDay: TimeOfDaySchema,
  phase: GamePhaseSchema,
  turnCount: z.number().int().min(0),
  isDarkTheme: z.boolean(),
});
```

**Analog for boolean flag in store** — `isDarkTheme: z.boolean()` and `combatStore.active`. Add:
```typescript
pendingQuit: z.boolean(),
```
And in `getDefaultGameState()`:
```typescript
pendingQuit: false,
```

**Store update pattern** (lines 27-37) — `eventBus.emit` side effect on state change shows the established pattern. The `pendingQuit` field needs no side effect in `onChange`.

---

### `src/index.tsx` — BUG-03: SIGINT → store flag

**Change type:** Replace `process.exit(0)` with a store flag set.

**Current SIGINT handler** (lines 10-12):
```typescript
process.on('SIGINT', () => {
  process.exit(0);
});
```

**Analog for store import and setState** — `app.tsx` imports and uses `gameStore` at module level. `game-loop.ts` calls `gameStore.setState(draft => { draft.phase = 'game'; })` throughout. Copy the same pattern:
```typescript
import { gameStore } from './state/game-store';
process.on('SIGINT', () => {
  try {
    gameStore.setState(draft => { draft.pendingQuit = true; });
  } catch {
    process.exit(0);
  }
});
```

**Note on `useApp().exit()`:** `InlineConfirm.onConfirm(true)` cannot call a React hook directly. Use `useApp()` in the parent component (`GameScreen` or `AppInner`) to get the `exit` function and pass it as a callback to `onConfirm`.

---

### `src/app.tsx` — BUG-01: create and pass gameLoop

**Change type:** Instantiate `createGameLoop()` in `AppInner` and pass it to `GameScreen`.

**Exact analog** — how `dialogueManager` and `combatLoop` are already declared and passed. Currently they are not shown in `AppInner` but `GameScreen` has optional props for them (lines 48-49). The same pattern applies: create instance at `AppInner` level, pass down.

**Current GameScreen render** (lines 64-76):
```typescript
<GameScreen
  gameState={gameState}
  playerState={playerState}
  sceneState={sceneState}
  dialogueState={dialogueState}
  combatState={combatState}
  questState={questState}
  questTemplates={new Map()}
  onSetGamePhase={setGameState}
/>
```

Add `gameLoop={gameLoop}` where `gameLoop` is created with `useMemo(() => createGameLoop(), [])` in `AppInner`. Import `createGameLoop` from `./game-loop`.

---

### `src/ui/screens/game-screen.test.ts` — BUG-01 test (new file)

**Analog:** `src/input/command-registry.test.ts` (closest existing unit test for a handler-level integration test)

**Test harness pattern** (command-registry.test.ts lines 1-18):
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

For `game-screen.test.ts`, the harness is different (no React renderer needed for logic tests). Test `handleActionExecute` behavior by mocking `gameLoop.processInput` and asserting on `sceneStore.getState().narrationLines` and mode transitions. Pattern: create a mock `GameLoop`, call the handler function directly (extracted or tested via store side-effects).

**Analog for store-assertion tests** — `src/state/stores.test.ts` pattern where tests call `setState` and then `getState()` to assert.

---

### `src/input/command-registry.test.ts` — BUG-03 test (extend existing)

**Change type:** Add test cases to the existing file.

**Exact pattern** (lines 20-52) — copy the `it('guard command...', ...)` style. New tests follow the same `parseCommand('quit')` approach:
```typescript
describe('registerCommands — Phase 6 additions', () => {
  it('quit command produces { type: quit, target: null }', () => {
    const action = parseCommand('quit');
    expect(action?.type).toBe('quit');
    expect(action?.target).toBeNull();
  });

  it('exit command produces { type: quit, target: null }', () => {
    const action = parseCommand('exit');
    expect(action?.type).toBe('quit');
    expect(action?.target).toBeNull();
  });
});
```

---

### `scripts/validate-live.ts` — CARRY-01 (new file)

**Role:** Standalone Bun script (not a bun:test file). No test framework imports.

**Analog:** Pattern derived from how `game-loop.ts` calls AI functions and checks results. The script is a linear async `main()`.

**Entry-point pattern** (same as `src/index.tsx` — simple module with one top-level call):
```typescript
async function main() {
  // init
  // act
  // assert with console.assert or throw
  console.log('Validation complete');
}
main().catch(console.error);
```

**Import pattern** — mirror `game-loop.ts` imports for the modules it validates:
```typescript
import { initRoleConfigs } from '../src/ai/providers';
import { generateNarration } from '../src/ai/roles/narrative-director';
import { getCostSummary } from '../src/state/cost-session-store';
import { evaluateTriggers } from '../src/ai/summarizer/summarizer-scheduler';
import { dequeuePending, markRunning, markDone } from '../src/ai/summarizer/summarizer-queue';
```

**CRITICAL pitfall:** Do NOT call `runSummarizerLoop()` — it is an infinite `while (true)` loop. Call `dequeuePending` + `markRunning` + `markDone` directly (see RESEARCH.md §Pitfall 6).

---

## Shared Patterns

### Store setState with immer draft
**Source:** `src/game-loop.ts` (lines 308-315), `src/state/game-store.ts`
**Apply to:** All files that update store state (`game-screen.tsx`, `index.tsx`, `game-loop.ts`)
```typescript
sceneStore.setState(draft => {
  draft.narrationLines = [...draft.narrationLines, newLine];
});
gameStore.setState(draft => {
  draft.pendingQuit = true;
});
```

### useInput guard pattern (Ink 7)
**Source:** `src/ui/screens/game-screen.tsx` (lines 179-189)
**Apply to:** BUG-02 new branches in `useInput`, BUG-03 InlineConfirm
```typescript
useInput(useCallback((input: string, key: { escape: boolean }) => {
  // guards FIRST, return early
  if (key.escape && isInOverlayPanel) { ...; return; }
  // then routing
}, [/* all used variables */]));
```
Rule: new branches must come BEFORE `getPanelActionForKey`, must `return` early, and must be added to the dependency array.

### Optional prop + null guard
**Source:** `src/ui/screens/game-screen.tsx` (lines 48-49, 159-162)
**Apply to:** Adding `gameLoop` prop to `GameScreen`, `handleActionExecute`
```typescript
// Props:
readonly combatLoop?: CombatLoop;
// Handler:
if (!combatLoop) return;
```

### command registration (no-argument)
**Source:** `src/input/command-registry.ts` (lines 63-73)
**Apply to:** BUG-03 `:quit` / `:exit` registrations
```typescript
program
  .command('commandname')
  .action(() => {
    setResult({ type: 'commandname', target: null, modifiers: {}, source: 'command' });
  });
```

### useCallback with async + try/finally
**Source:** `src/ui/screens/game-screen.tsx` — `handleDialogueExecute` (lines 142-149) + RESEARCH.md §Code Examples
**Apply to:** `handleActionExecute` in `game-screen.tsx`
```typescript
const handleXExecute = useCallback(
  async (index: number) => {
    if (!dependency) return;
    setInputMode('processing');
    try {
      const result = await dependency.processX(args);
      if (result.status === 'error') {
        sceneStore.setState(draft => { draft.narrationLines = [...draft.narrationLines, `[错误] ${result.message}`]; });
        return;
      }
    } finally {
      setInputMode('action_select');
    }
  },
  [dependency, setInputMode],
);
```

---

## No Analog Found

All files have analogs. No file in Phase 6 introduces a concept without existing codebase precedent.

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| `scripts/validate-live.ts` | validation-script | batch | No `scripts/` directory yet. Pattern synthesized from existing module calls. Directory must be created. |

---

## Metadata

**Analog search scope:** `src/ui/screens/`, `src/ui/hooks/`, `src/ui/panels/`, `src/input/`, `src/state/`, `src/types/`, `src/index.tsx`, `src/app.tsx`, `src/game-loop.ts`, `src/ai/roles/`
**Files scanned:** 16 primary files read in full
**Pattern extraction date:** 2026-04-23

---

## PATTERNS COMPLETE
