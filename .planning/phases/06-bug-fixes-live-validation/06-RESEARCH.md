# Phase 6: Bug Fixes & Live Validation - Research

**Researched:** 2026-04-23
**Domain:** Ink 7 input state machine, game-loop execution path, SIGINT interception, live API validation scripts
**Confidence:** HIGH — all findings are derived from direct codebase reads; no external lookups required

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**BUG-01 (Enter key)**
- D-01: Full fix — handleActionExecute must trigger rules engine → AI narration → store update. No more stub.
- D-02: Adjudication first, narration second. AI writes prose, does not decide outcome.
- D-03: UI enters `processing` mode during AI generation; returns to `action_select` on completion.
- D-04: AI failure shows error in scene panel; player may retry. Silent failure is forbidden.

**BUG-02 (focus switch)**
- D-05: `/` and Tab both switch `inputMode` to `input_active`.
- D-06: Input prompt changes color (dim `>` → bright cyan `>`) when active. `InputArea` `mode` prop is the extension point.
- D-07: Escape clears input if non-empty; exits `input_active` → `action_select` if input already empty.

**BUG-03 (:quit / :exit)**
- D-08: Register `:quit` and `:exit` in `command-registry.ts`.
- D-09: Reuse `InlineConfirm` component (`src/ui/components/inline-confirm.tsx`) for confirmation dialog.
- D-10: Ctrl-C also goes through the same confirmation flow. Replace `process.exit(0)` in `index.tsx` SIGINT handler with a store-flag trigger.

**CARRY-01 (live validation)**
- D-11: Automated scripts calling real API providers (env-var API keys required).
- D-12: Three features validated: `/cost` token data, `/replay N` interactive scroll, background summarizer triggering at least once.
- D-13: Scripts not in regular CI. Independent files, manually triggered or in secrets-aware CI.

### Claude's Discretion
- `processing` state loading animation style (spinner text / color)
- Exit confirmation dialog copy (Chinese)
- Validation script file path and structure (`e2e/` or `scripts/` directory)
- SIGINT interception implementation approach (useApp hook vs. process-level)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUG-01 | Enter key in ActionsPanel does nothing | §BUG-01 gap analysis; §Full execution path |
| BUG-02 | `/` and Tab do not switch focus to InputArea | §BUG-02 gap analysis; §inputMode state machine |
| BUG-03 | No reliable exit path; Ctrl-C quits immediately without confirmation | §BUG-03 gap analysis; §SIGINT interception |
| CARRY-01 | Validate /cost, /replay, background summarizer with real API | §CARRY-01 validation approach |
</phase_requirements>

---

## Summary

Phase 6 is a surgical bug-fix and validation phase. All four gaps are small, well-bounded, and confirmed by direct code inspection. No new architectural concepts are introduced — every fix slots into existing extension points the codebase already provides.

**BUG-01** is the most substantive fix: `handleActionExecute` in `game-screen.tsx` is a one-line stub. The full execution path already exists and is used by `handleInputSubmit` and the combat/dialogue handlers — it just was never wired to the actions panel. The pattern is: call `gameLoop.processInput(actionLabel)` → set `processing` mode → await result → update `sceneStore.narrationLines` → return to `action_select`. The `useAiNarration` hook in `use-ai-narration.ts` wraps `streamNarration` and is the right tool for streaming display.

**BUG-02** is a two-line addition to the `useInput` handler in `game-screen.tsx`: intercept `/` and `Tab` before they reach `getPanelActionForKey`, then call `setInputMode('input_active')`. `InputArea` already has the `mode` prop; the color change is already implemented (`mode === 'nl'` or `'command'` renders cyan prompt). The Escape → clear/deactivate logic requires adding a `value` ref or lifting the input value out of `InputArea`.

**BUG-03** requires two coordinated changes: (1) add `:quit` / `:exit` to `command-registry.ts` using the same `setResult` pattern as all other commands; (2) replace `process.exit(0)` in `index.tsx` with a store flag that makes `GameScreen` render `InlineConfirm`. The `InlineConfirm` component is fully functional and handles Y/N/Enter/default already.

**CARRY-01** requires creating validation scripts (no `e2e/` or `scripts/` directory exists yet) that exercise the live game loop with real API keys, asserting on `costSessionStore` state, `lastReplayEntries`, and `summarizerQueueStore` task completion.

**Primary recommendation:** Wire `handleActionExecute` to `gameLoop.processInput` first (BUG-01), then add the two `useInput` branches for BUG-02, then coordinate the store-flag quit flow for BUG-03, then write validation scripts for CARRY-01.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Action execution (Enter) | Game Loop | Scene Store | Rules engine adjudicates, sceneStore receives narration lines |
| AI narration during action | Narrative Director role | useAiNarration hook | Role owns prompt/call; hook owns React streaming display |
| inputMode state machine | useGameInput hook | game-screen.tsx useInput | Hook holds state; screen's useInput triggers transitions |
| InputArea activation | InputArea component | game-screen.tsx | isActive/mode props control render; parent controls when |
| Exit confirmation dialog | InlineConfirm component | gameStore (quit flag) | Component owns UI; store owns trigger signal |
| SIGINT interception | index.tsx (process-level) | gameStore flag | Process-level handler sets flag; React layer shows confirm |
| Command routing (:quit) | command-registry.ts | game-loop.ts | Registry registers; loop routes to action handler |
| Cost data | costSessionStore | getCostSummary() | Store accumulates per-role; getCostSummary() computes totals |
| Replay data | lastReplayEntries (game-loop) | ReplayPanel | Loop populates on /replay; panel renders |
| Summarizer trigger | summarizer-scheduler.ts | eventBus | Scheduler listens to events; queue/worker executes |

---

## Standard Stack

No new libraries are required for this phase. All fixes use the existing stack.

### Core (existing, no changes)
| Library | Version | Purpose |
|---------|---------|---------|
| ink | ^7.0.1 | `useInput` hook for key interception |
| React | ^19.2.5 | Component state, useCallback, useState |
| immer | ^11.1.4 | Immutable store updates |
| ai (Vercel AI SDK v5) | ^5.0.179 | `streamText` / `generateText` in narrative-director.ts |

### Relevant Internal Modules
| Module | Path | Role in Phase 6 |
|--------|------|-----------------|
| useGameInput | src/ui/hooks/use-game-input.ts | inputMode state machine |
| useAiNarration | src/ui/hooks/use-ai-narration.ts | React wrapper for streamNarration |
| streamNarration | src/ai/roles/narrative-director.ts | Actual AI streaming call |
| generateNarration | src/ai/roles/narrative-director.ts | Non-streaming AI call alternative |
| gameStore | src/state/game-store.ts | Phase transitions, quit flag candidate |
| sceneStore | src/state/scene-store.ts | narrationLines written after action |
| costSessionStore | src/state/cost-session-store.ts | /cost data source |
| getCostSummary() | src/state/cost-session-store.ts | Totals + per-role breakdown |
| summarizerQueueStore | src/ai/summarizer/summarizer-queue.ts | Queue state for validation |
| evaluateTriggers() | src/ai/summarizer/summarizer-scheduler.ts | Manual trigger entry point |
| lastReplayEntries | src/game-loop.ts (module-level var) | /replay data for ReplayPanel |
| InlineConfirm | src/ui/components/inline-confirm.tsx | Quit confirmation dialog |

---

## BUG-01: handleActionExecute Gap Analysis

### The Stub (game-screen.tsx:128-133)
```typescript
const handleActionExecute = useCallback(
  (_index: number) => {
    // Phase 1 stub: future phases route to rules engine
  },
  [],
);
```
The callback receives the selected action index. `sceneState.actions` is available in the component (`<ActionsPanel actions={[...sceneState.actions]} />`), so the label at `sceneState.actions[index]?.label` is accessible.

### What Already Works
`ActionsPanel` (line 32): `key.return` calls `onExecute(selectedIndex)` — the panel fires correctly. The handler stub is the only gap.

### Full Execution Path (what handleActionExecute must do)
Looking at how `handleInputSubmit` works and tracing the `gameLoop.processInput` call pattern used throughout `game-loop.ts`:

1. **Get action label** from `sceneState.actions[index]`
2. **Set mode to `processing`** via `setInputMode('processing')`
3. **Call `gameLoop.processInput(label, { source: 'action_select' })`** — this runs adjudication (rolls D20, resolves check, emits `action_resolved` event) and returns `ProcessResult`
4. **On success**: `sceneStore.setState` is already done inside `game-loop.ts` (lines 308-315). The narration lines are updated in `sceneStore.narrationLines` automatically.
5. **On failure**: Display error in scene panel (append error message to narrationLines)
6. **Return to `action_select`** via `setInputMode('action_select')`

### Where gameLoop lives in GameScreen
`GameScreen` does NOT currently have a `gameLoop` prop. The `game-loop.ts` module exports a `createGameLoop()` factory. Looking at `app.tsx`, `GameScreen` is rendered with no `gameLoop` prop — it is not passed in. **This is the integration gap.**

Two options:
- Option A: Pass `gameLoop` as a prop through `App → AppInner → GameScreen` (consistent with how `dialogueManager` and `combatLoop` are passed)
- Option B: Call `createGameLoop()` inside `GameScreen` and hold the instance

Option A is architecturally correct and consistent with the established pattern. `app.tsx` already passes `dialogueManager` and `combatLoop` optionally. A `gameLoop` prop should be added the same way.

Note: `app.tsx` currently renders `GameScreen` with `questTemplates={new Map()}` and no `gameLoop`. The `gameLoop` instance needs to be created in `AppInner` (or `App`) and passed down.

### useAiNarration hook availability
`src/ui/hooks/use-ai-narration.ts` exists and wraps `streamNarration`. It exposes `startNarration(context)`, `isStreaming`, `narrationText`, and `error`. This hook is the right tool for streaming the narration into the scene panel during `processing` mode.

The narration flow:
```
handleActionExecute(index)
  → setInputMode('processing')
  → adjudication via gameLoop.processInput (sync rules engine part)
  → startNarration({ sceneType: 'exploration', playerAction: label, ... })
  → isStreaming chunks arrive → append to sceneStore.narrationLines
  → on complete: setInputMode('action_select')
  → on error: append error line to narrationLines, setInputMode('action_select')
```

Alternatively, `generateNarration` (non-streaming) is simpler and avoids the streaming chunk accumulation complexity. The CONTEXT.md (D-03) only specifies a loading spinner during generation, not real-time streaming display in the scene panel — `generateNarration` is sufficient and simpler.

---

## BUG-02: inputMode State Machine Gap Analysis

### Current State Machine (use-game-input.ts)
```
States: 'action_select' | 'input_active' | 'processing'
isTyping = (inputMode === 'input_active')
```
No transition logic is in the hook — it is purely a value holder. All transitions are driven by callers via `setInputMode()`.

### Current Transitions in game-screen.tsx
- `handleInputSubmit` (line 137): calls `setInputMode('action_select')` after input submitted
- No transition TO `input_active` exists anywhere in the codebase

### Missing Transitions
In the `useInput` handler at line 179:
```typescript
useInput(useCallback((input: string, key: { escape: boolean }) => {
  if (key.escape && isInOverlayPanel) { ... return; }
  const panelAction = getPanelActionForKey(input, isTyping);
  ...
}, [...]));
```

**Missing branches to add:**
1. `if (input === '/' && !isTyping && !isInCombat && !isInDialogueMode)` → `setInputMode('input_active')`
2. `if (key.tab && !isTyping && !isInCombat && !isInDialogueMode)` → `setInputMode('input_active')`
3. Escape when `inputMode === 'input_active'`: if input value is empty → `setInputMode('action_select')`; if non-empty → clear value

The Tab key is accessed via `key.tab` in Ink's `useInput` key object (the key object has `tab: boolean`).

### Escape + clear value problem
`InputArea` owns the `value` state internally (line 6: `const [value, setValue] = useState('')`). The Escape-to-clear behavior requires either:
- Lifting `value` up to `GameScreen` and passing it as a controlled prop
- Adding a `onRequestClear` callback prop to `InputArea` that the parent triggers on Escape

The `InputArea` `TextInput` from `@inkjs/ui` accepts `value` and `onChange` — it supports controlled mode. Lifting value up is the clean approach and enables the parent to both read it (check if empty on Escape) and reset it.

### Visual feedback (D-06)
`InputArea` already renders cyan prompt for `mode === 'nl'` or `mode === 'command'` (line 36-40). The fix is: when switching to `input_active`, pass `mode='nl'` instead of the current `mode={isTyping ? 'nl' : 'action'}` — which already does this correctly. D-06 is already implemented conditionally; the only missing piece is actually reaching `isTyping === true`.

---

## BUG-03: Exit Command and SIGINT Gap Analysis

### Current SIGINT handler (index.tsx:10-12)
```typescript
process.on('SIGINT', () => {
  process.exit(0);
});
```
This immediately terminates — no confirmation.

### Command registry pattern
All commands in `command-registry.ts` follow this pattern:
```typescript
program
  .command('commandname')
  .action(() => {
    setResult({ type: 'quit', target: null, modifiers: {}, source: 'command' });
  });
```
`setResult` is the `(action: GameAction) => void` callback passed to `registerCommands`.

To add `:quit` / `:exit`:
1. Add `'quit'` to `GameActionTypeSchema` enum in `src/types/game-action.ts`
2. Add two `program.command()` registrations in `command-registry.ts`
3. Add `quit` handler in `game-loop.ts` that sets a store flag rather than calling `process.exit`

### Store-flag approach for SIGINT (D-10)
The cleanest pattern for Ctrl-C → confirmation is:
1. Add `pendingQuit: boolean` to `GameState` in `game-store.ts`
2. SIGINT handler in `index.tsx` sets `gameStore.setState(d => { d.pendingQuit = true; })`
3. `GameScreen` (or `AppInner`) renders `<InlineConfirm>` when `gameState.pendingQuit === true`
4. `InlineConfirm.onConfirm(true)` → `process.exit(0)`; `onConfirm(false)` → `gameStore.setState(d => { d.pendingQuit = false; })`

`InlineConfirm` props: `message: string`, `defaultOption: 'y' | 'n'`, `onConfirm: (confirmed: boolean) => void`. Default option should be `'n'` (safer: don't quit by default on Enter).

The `useApp` hook from Ink provides `exit()` which cleanly tears down the Ink renderer — prefer `useApp().exit()` over `process.exit(0)` for confirmed quit to allow Ink to restore the terminal.

### Alternative: useApp hook for SIGINT
Ink's `useApp()` returns `{ exit }`. The SIGINT handler runs outside React context (process-level), so it cannot use hooks directly. The store-flag approach is the only safe way to bridge process-level events into React.

### GameStateSchema needs 'quit' phase or pendingQuit field
Looking at `GamePhaseSchema` (game-store.ts:6), it is a `z.enum([...])`. Adding `pendingQuit: z.boolean()` as a separate field in `GameStateSchema` is simpler than adding a `'quit'` phase — it avoids affecting phase-based routing logic throughout `game-screen.tsx`.

---

## CARRY-01: Live Validation Approach

### What needs validating

**1. `/cost` — token data**
- `costSessionStore.getState().byRole` must have entries after real API calls
- `getCostSummary()` must return non-zero `totalInputTokens` and `totalOutputTokens`
- Validation: trigger at least one `generateNarration` or `generateText` call with a real API key, then assert on `getCostSummary()`

**2. `/replay N` — interactive scroll**
- `lastReplayEntries` (module-level in game-loop.ts) must be populated
- `ReplayPanel` navigation (↑↓, PgUp/PgDn, Enter) must work
- Validation: call `processInput('look')` to seed at least one turn log entry, then assert `getLastReplayEntries().length > 0`

**3. Background summarizer — at least one trigger**
- `evaluateTriggers('save_game_completed')` directly enqueues a `chapter_summary` task
- `runNextTask()` processes the task atomically and returns `true`
- Validation: call `evaluateTriggers('save_game_completed')`, then `runNextTask()`, assert returns `true`

### Script structure (CARRY-01 discretion area)
No `e2e/` or `scripts/` directory exists yet. Create `scripts/validate-live.ts` (or `e2e/validate-live.ts`). These are standalone Bun scripts, not Bun test files, since they require API keys and should not run in CI.

Pattern for validation script:
```typescript
// scripts/validate-live.ts
import { initRoleConfigs } from '../src/ai/providers';
import { generateNarration } from '../src/ai/roles/narrative-director';
import { getCostSummary } from '../src/state/cost-session-store';
import { evaluateTriggers } from '../src/ai/summarizer/summarizer-scheduler';
import { runNextTask } from '../src/ai/summarizer/summarizer-worker';
// ... assertions
```

Required env vars: `GOOGLE_GENERATIVE_AI_API_KEY` (default provider is Google Gemini), or whichever provider is configured in `ai-config.yaml`.

### runSummarizerLoop is an infinite loop
`runSummarizerLoop()` never returns — it loops with 5s sleep. For validation, use the exported `runNextTask()` helper (Plan 04 Task 1) which processes exactly one task and returns.

---

## Architecture Patterns

### System Architecture: Action Execution Flow (BUG-01)

```
ActionsPanel
  key.return → onExecute(selectedIndex)
    ↓
GameScreen.handleActionExecute(index)
  setInputMode('processing')    ← new
  action = sceneState.actions[index]
    ↓
gameLoop.processInput(action.label, { source: 'action_select' })   ← new
  routeInput → intent extraction or command parse
  adjudicate(action) → CheckResult (D20 roll, DC 12)
  sceneStore.setState(narrationLines += checkResult.display)
  gameStore.setState(turnCount += 1)
  returns ProcessResult
    ↓
generateNarration(context)  ← new (AI narration)
  getRoleConfig('narrative-director')
  generateText({model, system, prompt})
  recordUsage('narrative-director', usage)
  returns string (80-300 chars)
    ↓
sceneStore.setState(narrationLines += narrationText)   ← new
setInputMode('action_select')   ← new
```

### System Architecture: Focus Switch Flow (BUG-02)

```
Keyboard event '/' or Tab
  ↓
GameScreen.useInput handler
  [new branch] input === '/' || key.tab
  && !isTyping && !isInCombat && !isInDialogueMode
    ↓
  setInputMode('input_active')
    ↓
  isTyping becomes true
    ↓
  InputArea: isActive=true, mode='nl'  (cyan prompt, TextInput enabled)
  ActionsPanel: isActive=false  (keyboard capture released)

Keyboard event Escape
  ↓
GameScreen.useInput handler
  [new branch] key.escape && inputMode === 'input_active'
    if value === '' → setInputMode('action_select')
    else → setValue('')  (clear input, stay active)
```

### System Architecture: Quit Flow (BUG-03)

```
SIGINT (Ctrl-C) OR :quit/:exit command
  ↓
gameStore.setState(d => { d.pendingQuit = true; })
  ↓
GameScreen renders InlineConfirm overlay
  message: "确定要退出吗？"  defaultOption: 'n'
  ↓
  y / Enter(y default) → useApp().exit() or process.exit(0)
  n / Enter(n default) → gameStore.setState(d => { d.pendingQuit = false; })
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Y/N confirmation dialog | Custom confirm component | InlineConfirm (already exists) | Handles y/n/Enter/default, has correct Ink useInput |
| AI streaming accumulation | Manual chunk buffer | useAiNarration hook (already exists) | Handles cancel, error state, streaming lifecycle |
| Key event handling | Manual stdin | Ink `useInput` (already used throughout) | isActive param controls capture scope correctly |
| Store immutable updates | Manual spread | immer `produce` via `createStore.setState` | Pattern used in every existing store |
| Cost calculation | Custom math | `recordUsage` + `getCostSummary` (already exists) | Per-role accumulation, pricing config already wired |
| Summarizer trigger | New event hook | `evaluateTriggers('save_game_completed')` (already exists) | Event bus integration already done |

---

## Common Pitfalls

### Pitfall 1: Forgetting to pass gameLoop down to GameScreen
**What goes wrong:** `handleActionExecute` calls `gameLoop.processInput` but `gameLoop` is undefined — runtime error or silent no-op.
**Why it happens:** `app.tsx` renders `GameScreen` without a `gameLoop` prop. The factory is not called anywhere visible in the current rendering tree.
**How to avoid:** Create `gameLoop` instance in `AppInner` (same pattern as `dialogueManager` / `combatLoop`), pass it as a prop to `GameScreen`.
**Warning signs:** TypeScript will error on the new prop unless `GameScreenProps` is updated.

### Pitfall 2: Escape handling conflicts in overlay panels
**What goes wrong:** Adding Escape → `action_select` in the main `useInput` handler fires when the player presses Escape inside the ReplayPanel / MapPanel / etc., navigating away from both the panel AND resetting inputMode.
**Why it happens:** Multiple `useInput` handlers are active simultaneously in Ink 7; the existing handler at line 179 already handles `key.escape && isInOverlayPanel`. The new Escape branch must be guarded with `inputMode === 'input_active'` to prevent double-fire.
**How to avoid:** Guard: `if (key.escape && inputMode === 'input_active' && !isInOverlayPanel)`.

### Pitfall 3: `/` key intercepted by getPanelActionForKey before new branch fires
**What goes wrong:** `/` is passed to `getPanelActionForKey`, which returns `null` for it — no harm, but the ordering matters if other keys share `/`.
**Why it happens:** Order of checks in `useInput` handler.
**How to avoid:** Add the `/` / Tab branch BEFORE the `getPanelActionForKey` call, with an early return.

### Pitfall 4: InlineConfirm is not active-guarded
**What goes wrong:** `InlineConfirm` uses `useInput` without an `{ isActive }` option, meaning it captures all keypresses even when not visible.
**Why it happens:** Looking at `inline-confirm.tsx` — `useInput(useCallback(...), /* no options */)`. Ink 7's `useInput` is always active unless you pass `{ isActive: false }`.
**How to avoid:** Conditionally render `<InlineConfirm>` only when `pendingQuit === true` (React unmount removes the useInput listener automatically). Do not render it always with `isActive={false}`.

### Pitfall 5: SIGINT handler in index.tsx runs before React is initialized
**What goes wrong:** SIGINT fires during startup before `gameStore` is imported/initialized.
**Why it happens:** Unlikely in practice (Ctrl-C during startup), but SIGINT is registered at module load time.
**How to avoid:** Wrap the store setState in a try/catch; worst case falls back to `process.exit(0)`.

### Pitfall 6: runSummarizerLoop in validation scripts hangs forever
**What goes wrong:** Validation script never exits.
**Why it happens:** `runSummarizerLoop()` is `while (true)` with 5s sleep.
**How to avoid:** Do not call `runSummarizerLoop()` in validation scripts. Use `runNextTask()` instead — it processes exactly one queued task and returns.

### Pitfall 7: processingMode blocks ActionsPanel and InputArea simultaneously
**What goes wrong:** During `processing`, both panels are inactive. If the AI call hangs indefinitely, the player is stuck with no way to cancel.
**Why it happens:** `processing` state was not designed with a timeout/cancel path.
**How to avoid:** Set a reasonable timeout on `generateNarration` (AI SDK's `abortSignal` option), or keep Escape listening even in `processing` mode as a last resort.

---

## Code Examples

### Pattern: Calling gameLoop.processInput from handleActionExecute
```typescript
// Derived from game-loop.ts processInput pattern and existing handleCombatExecute
const handleActionExecute = useCallback(
  async (index: number) => {
    const action = sceneState.actions[index];
    if (!action || !gameLoop) return;
    setInputMode('processing');
    try {
      const result = await gameLoop.processInput(action.label, { source: 'action_select' });
      if (result.status === 'error') {
        sceneStore.setState(draft => {
          draft.narrationLines = [...draft.narrationLines, `[错误] ${result.message}`];
        });
        return;
      }
      // Optionally add AI narration on top of adjudication result
      // (adjudication already appended checkResult.display to narrationLines via game-loop)
    } finally {
      setInputMode('action_select');
    }
  },
  [sceneState.actions, gameLoop, setInputMode],
);
```

### Pattern: Adding / and Tab to useInput in game-screen.tsx
```typescript
useInput(useCallback((input: string, key: {
  escape: boolean;
  tab?: boolean;
}) => {
  // New: / and Tab activate input mode
  if ((input === '/' || key.tab) && !isTyping && !isInCombat && !isInDialogueMode && !isInOverlayPanel) {
    setInputMode('input_active');
    return;
  }
  // New: Escape exits input mode
  if (key.escape && inputMode === 'input_active') {
    if (inputValue.trim().length === 0) {
      setInputMode('action_select');
    } else {
      setInputValue('');
    }
    return;
  }
  if (key.escape && isInOverlayPanel) {
    gameStore.setState(draft => { draft.phase = 'game'; });
    return;
  }
  // ... existing panel action routing
}, [isTyping, inputMode, inputValue, isInCombat, isInDialogueMode, isInOverlayPanel, setInputMode, setInputValue]));
```

### Pattern: Registering :quit / :exit in command-registry.ts
```typescript
program
  .command('quit')
  .action(() => {
    setResult({ type: 'quit', target: null, modifiers: {}, source: 'command' });
  });

program
  .command('exit')
  .action(() => {
    setResult({ type: 'quit', target: null, modifiers: {}, source: 'command' });
  });
```
`'quit'` must also be added to `GameActionTypeSchema` in `src/types/game-action.ts`.

### Pattern: SIGINT → store flag in index.tsx
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

### Pattern: Live validation script structure
```typescript
// scripts/validate-live.ts
import { initRoleConfigs } from '../src/ai/providers';
import { generateNarration } from '../src/ai/roles/narrative-director';
import { getCostSummary } from '../src/state/cost-session-store';
import { evaluateTriggers } from '../src/ai/summarizer/summarizer-scheduler';
import { runNextTask } from '../src/ai/summarizer/summarizer-worker';

async function main() {
  await initRoleConfigs('./ai-config.yaml');

  // Validate /cost
  await generateNarration({ sceneType: 'exploration', codexEntries: [], playerAction: 'look', recentNarration: [], sceneContext: 'test' });
  const summary = getCostSummary();
  console.assert(summary.totalInputTokens > 0, '/cost: no input tokens recorded');

  // Validate summarizer trigger
  evaluateTriggers('save_game_completed');
  const processed = await runNextTask();
  console.assert(processed === true, 'summarizer: runNextTask() returned false — no task was enqueued');

  console.log('Validation complete');
}
main().catch(console.error);
```

---

## Open Questions (RESOLVED)

1. **Where does gameLoop get created in the app?** (RESOLVED)
   - Resolution: Create in `AppInner` via `useMemo(() => createGameLoop(), [])`, same pattern as `dialogueManager`. Pass as prop to `GameScreen`. Plan 01 implements this.

2. **Should AI narration be called from handleActionExecute or let game-loop call it?** (RESOLVED)
   - Resolution: UI layer (`handleActionExecute`) calls `generateNarration` after `processInput` succeeds. game-loop owns adjudication only. Preserves the "AI writes prose, doesn't decide outcomes" boundary per D-02. Plan 01 implements this.

3. **dispatchTask export for validation scripts** (RESOLVED)
   - Resolution: Export `runNextTask()` helper from `summarizer-worker.ts` that calls `dequeuePending` + `markRunning` + `dispatchTask` + `markDone` atomically. Plan 04 Task 1 implements this.

---

## Environment Availability

No new external dependencies for this phase. All validation scripts require API keys set as env vars.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| GOOGLE_GENERATIVE_AI_API_KEY | CARRY-01 validation (default provider) | [runtime check] | — | Set different provider in ai-config.yaml |
| OPENAI_API_KEY | CARRY-01 (if OpenAI profile used) | [runtime check] | — | Use Google profile |
| Bun runtime | All scripts | Assumed available (project uses Bun) | ^1.3.12 | — |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | bun test (built-in) |
| Config file | none (bun detects *.test.ts automatically) |
| Quick run command | `bun test src/ui/hooks/use-game-input.test.ts` |
| Full suite command | `bun test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUG-01 | handleActionExecute triggers processInput and updates sceneStore | unit | `bun test src/ui/screens/game-screen.test.ts` | ❌ Wave 0 |
| BUG-02 | / and Tab set inputMode to input_active; Escape clears/deactivates | unit | `bun test src/ui/hooks/use-game-input.test.ts` | ✅ (extend) |
| BUG-03 | :quit/:exit command routes to pendingQuit; SIGINT sets store flag | unit | `bun test src/input/command-registry.test.ts` | ❌ Wave 0 |
| CARRY-01 | Live API: cost recorded, replay data flows, summarizer triggered | integration (manual) | `bun scripts/validate-live.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test src/ui/hooks/use-game-input.test.ts`
- **Per wave merge:** `bun test`
- **Phase gate:** Full suite green before `/gsd-verify-work`; `bun scripts/validate-live.ts` run manually with API keys

### Wave 0 Gaps
- [ ] `src/ui/screens/game-screen.test.ts` — covers BUG-01 handleActionExecute integration
- [ ] `src/input/command-registry.test.ts` — covers BUG-03 :quit/:exit registration
- [ ] `scripts/validate-live.ts` — CARRY-01 manual validation script

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Existing: `routeInput` + `GameActionTypeSchema` Zod enum — adding `'quit'` requires updating the enum |
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V6 Cryptography | no | — |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SIGINT handler calling setState before store ready | Denial of Service (process crash) | try/catch around store call, fallback to process.exit |
| API key in validation script logs | Information Disclosure | Never log API key env vars; use `process.env.KEY ? 'set' : 'MISSING'` in output |

---

## Sources

### Primary (HIGH confidence — direct codebase reads)
- `src/ui/screens/game-screen.tsx` — handleActionExecute stub, useInput handler, InputArea props
- `src/ui/hooks/use-game-input.ts` — inputMode state machine (pure value holder, no transitions)
- `src/ui/panels/actions-panel.tsx` — Enter → onExecute confirmed working
- `src/ui/panels/input-area.tsx` — mode prop, value state, isActive/isDisabled
- `src/index.tsx` — SIGINT: `process.exit(0)`, no confirmation
- `src/input/command-registry.ts` — command registration pattern, missing quit/exit
- `src/ui/components/inline-confirm.tsx` — props API, useInput without isActive option
- `src/game-loop.ts` — processInput, adjudicate, fallback path for action_select
- `src/state/cost-session-store.ts` — byRole schema, recordUsage, getCostSummary
- `src/ui/panels/replay-panel.tsx` — navigation keys, TurnLogEntry rendering
- `src/ai/roles/narrative-director.ts` — generateNarration, streamNarration, recordUsage
- `src/ai/roles/memory-summarizer.ts` — generateNpcMemorySummary, generateChapterSummary
- `src/ai/summarizer/summarizer-scheduler.ts` — evaluateTriggers, event bus listeners
- `src/ai/summarizer/summarizer-queue.ts` — enqueueTask, dequeuePending, markRunning, markDone
- `src/ai/summarizer/summarizer-worker.ts` — dispatchTask (private), runSummarizerLoop
- `src/ui/hooks/use-ai-narration.ts` — startNarration hook, streamNarration wrapper
- `src/app.tsx` — GameScreen rendering with no gameLoop prop — confirmed gap
- `src/state/game-store.ts` — GameStateSchema, GamePhaseSchema, no pendingQuit field yet
- `src/types/game-action.ts` — GameActionTypeSchema, no 'quit' type yet

### Secondary (MEDIUM confidence)
- CONTEXT.md §Decisions — D-01 through D-13 locked decisions, all honored in analysis above
- Phase 05 CONTEXT.md — background summarizer D-04/D-05/D-06 trigger strategy, confirms evaluateTriggers pattern

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Ink 7 `useInput` key object has a `.tab` boolean field | BUG-02 gap analysis | Would need to intercept Tab via raw input character or a different key property |
| A2 | `useApp().exit()` is preferred over `process.exit()` for clean Ink teardown | BUG-03 analysis | process.exit(0) also works but may leave terminal in raw mode |
| A3 | Creating gameLoop in AppInner (not passed from CLI entrypoint) is architecturally appropriate | BUG-01 gap analysis | May conflict with how gameLoop should be initialized with all its options (sceneManager, etc.) |

---

## Metadata

**Confidence breakdown:**
- Bug root causes: HIGH — confirmed by direct code reads
- Fix approach: HIGH — all extension points exist and are documented
- CARRY-01 script structure: MEDIUM — dispatchTask export gap is a real unknown
- Standard stack: HIGH — no new libraries

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (codebase-specific; revalidate if Phase 5 plan diverged from CONTEXT.md)

---

## RESEARCH COMPLETE
