---
phase: 12-combat-save-correctness
plan: P02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/engine/action-handlers/combat-handler.ts
  - src/engine/game-screen-controller.ts
  - src/engine/combat-loop.ts
autonomous: true
requirements:
  - COMBAT-01
  - COMBAT-02
  - COMBAT-06
must_haves:
  truths:
    - "After the player attacks, the enemy takes exactly one turn before control returns to the player"
    - "After a successful flee, the enemy does NOT take an additional turn"
    - "If processPlayerAction throws, combat.phase resets to 'player_turn' (not stuck at 'resolving')"
  artifacts:
    - path: src/engine/action-handlers/combat-handler.ts
      provides: "processEnemyTurn() unconditional call removed (line 19 deleted)"
    - path: src/engine/game-screen-controller.ts
      provides: "handleCombatExecute guards enemy turn against flee/victory/defeat outcomes"
    - path: src/engine/combat-loop.ts
      provides: "processPlayerAction wrapped in try/catch; catch resets phase to 'player_turn'"
  key_links:
    - from: src/engine/action-handlers/combat-handler.ts
      to: src/engine/combat-loop.ts
      via: "processPlayerAction only — no processEnemyTurn call"
      pattern: "processEnemyTurn"
    - from: src/engine/game-screen-controller.ts
      to: src/engine/combat-loop.ts
      via: "processEnemyTurn guarded by phase === 'enemy_turn' AND outcome not flee/victory/defeat"
      pattern: "outcome.*flee|flee.*outcome"
---

<objective>
Fix the double enemy turn bug (COMBAT-01), the flee-then-enemy-turn bug (COMBAT-02), and wrap processPlayerAction in a try/catch so runtime errors cannot permanently freeze combat (COMBAT-06).

Purpose: Players currently face two enemy attacks per round. A successful flee is punished by a bonus enemy turn. Errors in use_item or cast leave combat in 'resolving' indefinitely.
Output: combat-handler.ts with line 19 deleted; game-screen-controller.ts with outcome guard; combat-loop.ts processPlayerAction in try/catch.
</objective>

<execution_context>
@/Users/makoto/Downloads/work/cli/.planning/phases/12-combat-save-correctness/12-CONTEXT.md
</execution_context>

<context>
@/Users/makoto/Downloads/work/cli/.planning/ROADMAP.md
@/Users/makoto/Downloads/work/cli/.planning/phases/12-combat-save-correctness/12-PATTERNS.md

<interfaces>
<!-- Extracted from source files. -->

From src/engine/combat-loop.ts:
```typescript
export type CombatActionResult =
  | { readonly status: 'ok'; readonly checkResult?: CheckResult; readonly narration: string; readonly outcome?: 'flee' | 'victory' | 'defeat' }
  | { readonly status: 'error'; readonly message: string };

export interface CombatLoop {
  readonly processPlayerAction: (actionType: CombatActionType, options?: CombatActionOptions) => Promise<CombatActionResult>;
  readonly processEnemyTurn: () => Promise<void>;
  readonly checkCombatEnd: () => Promise<CombatEndResult>;
  readonly getCombatPhase: () => string;
}
```

From src/engine/action-handlers/combat-handler.ts (current, full file):
```typescript
// Lines 13-20 — CHANGE REQUIRED:
const combatResult = await ctx.combatLoop.processPlayerAction(
  action.type as 'attack' | 'cast' | 'guard' | 'flee',
);
if (combatResult.status === 'error') {
  return { status: 'error', message: combatResult.message };
}
await ctx.combatLoop.processEnemyTurn();  // LINE 19 — DELETE THIS
await ctx.combatLoop.checkCombatEnd();
```

From src/engine/game-screen-controller.ts (lines 203-221, handleCombatExecute):
```typescript
const handleCombatExecute = async (index: number): Promise<void> => {
  if (!combatLoop) return;
  const actionType = COMBAT_ACTION_TYPES[index] ?? 'attack';
  try {
    const result = await combatLoop.processPlayerAction(actionType);
    if (result.status === 'error') { ... return; }
    if (combatLoop.getCombatPhase() === 'enemy_turn') {
      await combatLoop.processEnemyTurn();   // GUARD REQUIRED
    }
  } catch (err: unknown) { ... }
};
```

From src/engine/combat-loop.ts (processPlayerAction lines 116-122):
```typescript
async function processPlayerAction(...): Promise<CombatActionResult> {
  stores.combat.setState(draft => {
    draft.phase = 'resolving';
  });
  // all existing logic — wrap everything after this in try/catch
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Delete unconditional processEnemyTurn from combat-handler (COMBAT-01)</name>
  <files>src/engine/action-handlers/combat-handler.ts</files>
  <read_first>
    - src/engine/action-handlers/combat-handler.ts — read fully before editing (31 lines)
  </read_first>
  <behavior>
    - Test 1: handleCombat mock — processPlayerAction returns { status: 'ok', narration: '...' } → processEnemyTurn is NOT called by handleCombat
    - Test 2: handleCombat mock — processPlayerAction returns { status: 'error' } → processEnemyTurn is NOT called
    - Test 3: handleCombat returns { status: 'action_executed' } with narration from combat store
  </behavior>
  <action>
Delete line 19 of `src/engine/action-handlers/combat-handler.ts`:
```
await ctx.combatLoop.processEnemyTurn();
```

The file after editing must look like:
```typescript
import type { ActionHandler } from './types';

export const handleCombat: ActionHandler = async (action, ctx) => {
  if (!ctx.combatLoop) {
    return { status: 'error', message: '战斗系统未初始化' };
  }

  const COMBAT_ACTIONS = new Set(['attack', 'cast', 'guard', 'flee']);
  if (!COMBAT_ACTIONS.has(action.type)) {
    return { status: 'error', message: '战斗中只能进行战斗行动！' };
  }

  const combatResult = await ctx.combatLoop.processPlayerAction(
    action.type as 'attack' | 'cast' | 'guard' | 'flee',
  );
  if (combatResult.status === 'error') {
    return { status: 'error', message: combatResult.message };
  }
  await ctx.combatLoop.checkCombatEnd();
  const narration = ctx.stores.combat.getState().lastNarration
    ? [ctx.stores.combat.getState().lastNarration]
    : [];
  return {
    status: 'action_executed',
    action,
    checkResult: ctx.stores.combat.getState().lastCheckResult ?? undefined,
    narration,
  };
};
```
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/engine/action-handlers/combat-handler.test.ts --bail 2>&1 | tail -20</automated>
  </verify>
  <done>
    - combat-handler.ts has no `processEnemyTurn` call
    - grep confirms: `grep -n "processEnemyTurn" src/engine/action-handlers/combat-handler.ts` → no output
    - Tests pass
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add flee/outcome guard to game-screen-controller handleCombatExecute (COMBAT-02)</name>
  <files>src/engine/game-screen-controller.ts</files>
  <read_first>
    - src/engine/game-screen-controller.ts — read lines 195-235 (handleCombatExecute and the return block) before editing
  </read_first>
  <behavior>
    - Test 1: processPlayerAction returns { status: 'ok', outcome: 'flee' } → processEnemyTurn is NOT called
    - Test 2: processPlayerAction returns { status: 'ok', outcome: 'victory' } → processEnemyTurn is NOT called
    - Test 3: processPlayerAction returns { status: 'ok', outcome: 'defeat' } → processEnemyTurn is NOT called
    - Test 4: processPlayerAction returns { status: 'ok', narration: '...' } (no outcome) AND getCombatPhase() === 'enemy_turn' → processEnemyTurn IS called
    - Test 5: processPlayerAction returns { status: 'ok' } AND getCombatPhase() === 'player_turn' → processEnemyTurn is NOT called
  </behavior>
  <action>
In `src/engine/game-screen-controller.ts`, locate `handleCombatExecute`. Replace the current guard:

```typescript
// CURRENT (lines ~214-216):
if (combatLoop.getCombatPhase() === 'enemy_turn') {
  await combatLoop.processEnemyTurn();
}
```

With the outcome-aware guard (per D-02):

```typescript
if (
  combatLoop.getCombatPhase() === 'enemy_turn' &&
  result.outcome !== 'flee' &&
  result.outcome !== 'victory' &&
  result.outcome !== 'defeat'
) {
  await combatLoop.processEnemyTurn();
}
```

`result` is the `CombatActionResult` returned by `processPlayerAction`. It is already in scope as `result` at that point in `handleCombatExecute`. The `outcome` field is only present on the `status: 'ok'` variant — TypeScript will allow `result.outcome` because the error branch already returned early.
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/engine/game-screen-controller.test.ts --bail 2>&1 | tail -20</automated>
  </verify>
  <done>
    - handleCombatExecute in game-screen-controller.ts checks result.outcome before calling processEnemyTurn
    - grep confirms: `grep -A5 "getCombatPhase" src/engine/game-screen-controller.ts` shows the outcome checks
    - Tests pass; bun tsc --noEmit passes
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Wrap processPlayerAction in try/catch to prevent combat freeze (COMBAT-06)</name>
  <files>src/engine/combat-loop.ts</files>
  <read_first>
    - src/engine/combat-loop.ts — read lines 116-248 (entire processPlayerAction function) before editing
  </read_first>
  <behavior>
    - Test 1: processPlayerAction throws an Error inside → returns { status: 'error', message: '战斗处理出错: <err.message>' }
    - Test 2: after exception → combat.phase === 'player_turn' (not 'resolving')
    - Test 3: normal attack path unaffected — still sets phase to 'resolving' at start and proceeds normally
  </behavior>
  <action>
In `src/engine/combat-loop.ts`, wrap the body of `processPlayerAction` after the initial `setState` call in a try/catch (per D-11).

Current structure (lines 116-248):
```typescript
async function processPlayerAction(...): Promise<CombatActionResult> {
  stores.combat.setState(draft => { draft.phase = 'resolving'; });
  // ... all logic ...
  return { status: 'ok', checkResult, narration };
}
```

Target structure — wrap everything after the opening setState in try/catch:
```typescript
async function processPlayerAction(
  actionType: CombatActionType,
  options?: CombatActionOptions,
): Promise<CombatActionResult> {
  stores.combat.setState(draft => {
    draft.phase = 'resolving';
  });
  try {
    // ... all existing logic unchanged (from `const player = stores.player.getState()` onward) ...
  } catch (err: unknown) {
    stores.combat.setState(draft => {
      draft.phase = 'player_turn';
    });
    const msg = err instanceof Error ? err.message : String(err);
    return { status: 'error', message: `战斗处理出错: ${msg}` };
  }
}
```

Do NOT modify any logic inside the try block. Only add the wrapping try/catch.
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/engine/combat-loop.test.ts --bail 2>&1 | tail -20</automated>
  </verify>
  <done>
    - processPlayerAction in combat-loop.ts has try/catch wrapping its body
    - On throw: phase resets to 'player_turn' and returns { status: 'error', message: '战斗处理出错: ...' }
    - All existing combat-loop tests pass
    - bun tsc --noEmit passes
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| combat state machine | Phase transitions must be safe — no stuck states accessible from player input |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-12P02-01 | Denial of Service | combat-loop.ts processPlayerAction | mitigate | try/catch resets phase to 'player_turn' — player can always act after an error |
| T-12P02-02 | Tampering | combat-handler.ts | accept | handler is internal game logic, no external trust boundary |
</threat_model>

<verification>
```
cd /Users/makoto/Downloads/work/cli
grep -n "processEnemyTurn" src/engine/action-handlers/combat-handler.ts
# expected: no output

grep -A6 "getCombatPhase" src/engine/game-screen-controller.ts
# expected: shows outcome !== 'flee' guard

bun test --bail 2>&1 | tail -10
bun tsc --noEmit 2>&1 | head -10
```
</verification>

<success_criteria>
- combat-handler.ts: no processEnemyTurn call (grep returns empty)
- game-screen-controller.ts: processEnemyTurn blocked when outcome is flee/victory/defeat
- combat-loop.ts: processPlayerAction has try/catch; exception → phase reset to player_turn
- All tests pass
- No TypeScript errors
</success_criteria>

<output>
After completion, create `/Users/makoto/Downloads/work/cli/.planning/phases/12-combat-save-correctness/12-P02-SUMMARY.md`
</output>
