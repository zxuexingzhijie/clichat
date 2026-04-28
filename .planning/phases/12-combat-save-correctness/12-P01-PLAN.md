---
phase: 12-combat-save-correctness
plan: P01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/state/serializer.ts
  - src/persistence/save-file-manager.ts
  - src/engine/action-handlers/types.ts
  - src/engine/action-handlers/load-handler.ts
  - src/engine/action-handlers/branch-handler.ts
  - src/persistence/branch-manager.ts
autonomous: true
requirements:
  - SAVE-01
  - SAVE-02
  - SAVE-03
must_haves:
  truths:
    - "Saving a game stores the provided name (not hardcoded 'Quick Save')"
    - "snapshot() records real elapsed playtime via the getPlaytime callback"
    - "Branch switch loads the saved game state associated with that branch's headSaveId"
    - "Branch switch with no headSaveId returns '该分支没有存档可恢复' and does not crash"
    - "Loading a game validates the path against saveDir (path traversal check active)"
  artifacts:
    - path: src/state/serializer.ts
      provides: "Serializer interface with snapshot(saveName?: string), createSerializer with getPlaytime param"
    - path: src/engine/action-handlers/types.ts
      provides: "ActionContext.branchManager with getBranchMeta; saveFileManager.loadGame with saveDir param"
    - path: src/engine/action-handlers/branch-handler.ts
      provides: "switch subaction loads headSaveId save; null headSaveId returns Chinese error"
    - path: src/engine/action-handlers/load-handler.ts
      provides: "loadGame called with ctx.saveDir as third argument"
  key_links:
    - from: src/engine/action-handlers/branch-handler.ts
      to: src/persistence/save-file-manager.ts
      via: "ctx.saveFileManager.loadGame(filePath, ctx.serializer, ctx.saveDir)"
      pattern: "loadGame.*ctx\\.saveDir"
    - from: src/state/serializer.ts
      to: src/persistence/save-file-manager.ts
      via: "snapshot(saveName) called inside quickSave/saveGame"
      pattern: "snapshot\\(.*saveName"
---

<objective>
Fix three save/branch correctness bugs: parametrize snapshot() so saves store real names and playtime (SAVE-01), fix branch switch to actually restore the branch's game state (SAVE-02), and pass saveDir to loadGame so path-traversal protection is active (SAVE-03). Also fix two type definitions that block the implementations.

Purpose: Save names say "Quick Save" for every save regardless of user input; branch switch silently ignores the saved state; load has no security boundary.
Output: serializer.ts with saveName/playtime params; branch-handler loads game on switch; load-handler calls loadGame with saveDir; two type corrections in types.ts.
</objective>

<execution_context>
@/Users/makoto/Downloads/work/cli/.planning/phases/12-combat-save-correctness/12-CONTEXT.md
</execution_context>

<context>
@/Users/makoto/Downloads/work/cli/.planning/ROADMAP.md
@/Users/makoto/Downloads/work/cli/.planning/phases/12-combat-save-correctness/12-PATTERNS.md

<interfaces>
<!-- Extracted from source files. Executor uses these directly — no re-reading needed. -->

From src/state/serializer.ts (current):
```typescript
export interface Serializer {
  snapshot(): string;   // CHANGE TO: snapshot(saveName?: string): string
  restore(json: string): void;
}

export function createSerializer(
  stores: { player, scene, combat, game, quest, relations, npcMemory, exploration, playerKnowledge, turnLog },
  getBranchId: () => string,
  getParentSaveId: () => string | null,
  // ADD: getPlaytime: () => number
): Serializer

// In snapshot() — current hardcoded values:
saveName: 'Quick Save',   // becomes: saveName ?? 'Quick Save'
playtime: 0,              // becomes: getPlaytime()
```

From src/engine/action-handlers/types.ts (current):
```typescript
readonly saveFileManager?: {
  readonly loadGame: (filePath: string, serializer: Serializer) => Promise<void>;  // MISSING saveDir
};
readonly branchManager?: {
  readonly createBranch: (name: string) => BranchMeta;
  readonly switchBranch: (branchId: string) => void;
  readonly deleteBranch: (branchId: string) => void;
  // MISSING: getBranchMeta: (branchId: string) => BranchMeta | undefined
};
```

From src/persistence/branch-manager.ts:
```typescript
// branchStore is a module-level singleton — accessible via:
import { branchStore } from '../state/branch-store';
// OR via exported getBranchTree / listBranches
// BranchMeta shape:
export type BranchMeta = {
  id: string; name: string; parentBranchId: string | null;
  parentSaveId: string | null; headSaveId: string | null;
  createdAt: string; description: string;
};
```

From src/persistence/save-file-manager.ts (current):
```typescript
export async function quickSave(serializer: Serializer, saveDir: string): Promise<string> {
  const json = serializer.snapshot();   // UPDATE TO: serializer.snapshot('Quick Save')
  ...
}
export async function saveGame(name: string, serializer: Serializer, saveDir: string): Promise<string> {
  const json = serializer.snapshot();   // UPDATE TO: serializer.snapshot(name)
  ...
}
export async function loadGame(filePath: string, serializer: Serializer, saveDir?: string): Promise<void>
// saveDir param already exists in implementation — only the ActionContext type was missing it
```

From src/engine/action-handlers/branch-handler.ts (current switch block lines 19-28):
```typescript
if (subAction === 'switch') {
  const name = (action.modifiers as Record<string, string>)['name'];
  if (!name) return { status: 'error', message: '请指定分支名称。' };
  if (!ctx.branchManager) return { status: 'error', message: '分支系统未初始化' };
  try {
    ctx.branchManager.switchBranch(name);
    return { status: 'action_executed', action, narration: [`已切换至分支「${name}」。`] };
  } catch {
    return { status: 'error', message: `分支「${name}」不存在。...` };
  }
}
```

From src/app.tsx (how branchManager is wired):
```typescript
import { createBranch, switchBranch, deleteBranch } from './persistence/branch-manager';
// ...
branchManager: { createBranch, switchBranch, deleteBranch },
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Parametrize serializer snapshot() with saveName and getPlaytime</name>
  <files>src/state/serializer.ts, src/persistence/save-file-manager.ts</files>
  <read_first>
    - src/state/serializer.ts — read fully before editing (lines 15-18 Serializer interface, lines 89-104 createSerializer signature, lines 106-121 snapshot body)
    - src/persistence/save-file-manager.ts — read fully before editing (lines 35-50 quickSave/saveGame bodies)
  </read_first>
  <behavior>
    - Test 1: snapshot('My Save') → JSON.parse result has meta.saveName === 'My Save'
    - Test 2: snapshot() (no arg) → meta.saveName === 'Quick Save'
    - Test 3: createSerializer with getPlaytime: () => 120 → snapshot() sets playtime to 120
    - Test 4: quickSave calls snapshot('Quick Save'); saveGame('Chapter 1', ...) calls snapshot('Chapter 1')
  </behavior>
  <action>
1. In `src/state/serializer.ts`:
   - Change `Serializer` interface: `snapshot(saveName?: string): string`
   - Add `getPlaytime: () => number` as 4th param to `createSerializer` (after `getParentSaveId`)
   - In `snapshot()` body: replace `saveName: 'Quick Save'` with `saveName: saveName ?? 'Quick Save'`; replace `playtime: 0` with `playtime: getPlaytime()`

2. In `src/persistence/save-file-manager.ts`:
   - In `quickSave`: change `serializer.snapshot()` to `serializer.snapshot('Quick Save')`
   - In `saveGame`: change `serializer.snapshot()` to `serializer.snapshot(name)` — passes the user-provided save name

3. Find all callers of `createSerializer` in the codebase (grep for `createSerializer(`) and add a `getPlaytime` argument. The expected call site is `src/app.tsx`. Pass a closure that captures session start time: add `const sessionStart = Date.now()` near where createSerializer is called, then pass `() => Math.floor((Date.now() - sessionStart) / 1000)` as the getPlaytime argument.
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/state/serializer.test.ts --bail 2>&1 | tail -20</automated>
  </verify>
  <done>
    - Serializer interface has snapshot(saveName?: string): string
    - createSerializer signature has getPlaytime: () => number as 4th param
    - snapshot() uses saveName param (defaults to 'Quick Save') and calls getPlaytime()
    - quickSave passes 'Quick Save'; saveGame passes the name arg
    - bun tsc --noEmit passes (no type errors)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fix ActionContext types — saveFileManager.loadGame and branchManager.getBranchMeta</name>
  <files>src/engine/action-handlers/types.ts, src/game-loop.ts</files>
  <read_first>
    - src/engine/action-handlers/types.ts — read fully (lines 20-31 saveFileManager and branchManager shapes)
    - src/game-loop.ts — read lines 55-75 (GameLoopOptions saveFileManager and branchManager shapes)
  </read_first>
  <behavior>
    - Test 1: TypeScript accepts ctx.saveFileManager.loadGame(path, serializer, saveDir) without type error
    - Test 2: TypeScript accepts ctx.branchManager.getBranchMeta(branchId) → BranchMeta | undefined without type error
  </behavior>
  <action>
1. In `src/engine/action-handlers/types.ts`:
   - In `saveFileManager` optional type: change loadGame signature from:
     `readonly loadGame: (filePath: string, serializer: Serializer) => Promise<void>`
     to:
     `readonly loadGame: (filePath: string, serializer: Serializer, saveDir?: string) => Promise<void>`
   - In `branchManager` optional type: add:
     `readonly getBranchMeta: (branchId: string) => BranchMeta | undefined`

2. In `src/game-loop.ts`:
   - In the `GameLoopOptions.saveFileManager` type (lines ~60-63): update `loadGame` signature to match — add `saveDir?: string` as 3rd param.
   - In the `GameLoopOptions.branchManager` type (lines ~67-71): add `readonly getBranchMeta: (branchId: string) => BranchMeta | undefined`

3. In `src/app.tsx`:
   - The `branchManager` object passed to `createGameLoop` must now expose `getBranchMeta`. Add it using the `branchStore` singleton:
     ```typescript
     import { branchStore } from './state/branch-store';
     // in branchManager object:
     getBranchMeta: (branchId: string) => branchStore.getState().branches[branchId],
     ```
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun tsc --noEmit 2>&1 | head -40</automated>
  </verify>
  <done>
    - ActionContext.saveFileManager.loadGame type accepts 3rd arg saveDir?: string
    - ActionContext.branchManager has getBranchMeta: (branchId: string) => BranchMeta | undefined
    - app.tsx passes getBranchMeta using branchStore.getState().branches[branchId]
    - bun tsc --noEmit produces zero errors
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Fix load-handler (SAVE-03) and branch-handler switch (SAVE-02)</name>
  <files>src/engine/action-handlers/load-handler.ts, src/engine/action-handlers/branch-handler.ts</files>
  <read_first>
    - src/engine/action-handlers/load-handler.ts — read fully (7 lines total)
    - src/engine/action-handlers/branch-handler.ts — read fully (44 lines total)
    - src/state/branch-store.ts — lines 6-15 (BranchMeta type, headSaveId field)
  </read_first>
  <behavior>
    - Test 1: load-handler calls loadGame with (filePath, serializer, ctx.saveDir) — third arg present
    - Test 2: branch switch with branchMeta.headSaveId = null → returns error '该分支没有存档可恢复'
    - Test 3: branch switch with valid headSaveId → calls ctx.saveFileManager.loadGame with the correct filePath
    - Test 4: branch switch with valid headSaveId → returns action_executed with narration confirming the branch + load
  </behavior>
  <action>
1. In `src/engine/action-handlers/load-handler.ts` (SAVE-03 one-line fix, per D-17/D-18):
   - Change line 7 from:
     `await ctx.saveFileManager.loadGame(filePath, ctx.serializer);`
     to:
     `await ctx.saveFileManager.loadGame(filePath, ctx.serializer, ctx.saveDir);`

2. In `src/engine/action-handlers/branch-handler.ts` (SAVE-02, per D-15/D-16):
   Replace the `switch` block (lines 19-28) with:
   ```typescript
   if (subAction === 'switch') {
     const name = (action.modifiers as Record<string, string>)['name'];
     if (!name) return { status: 'error', message: '请指定分支名称。' };
     if (!ctx.branchManager) return { status: 'error', message: '分支系统未初始化' };
     try {
       ctx.branchManager.switchBranch(name);
     } catch {
       return { status: 'error', message: `分支「${name}」不存在。使用 /branch tree 查看所有分支。` };
     }
     const branchMeta = ctx.branchManager.getBranchMeta(name);
     const headSaveId = branchMeta?.headSaveId ?? null;
     if (!headSaveId) {
       return { status: 'error', message: '该分支没有存档可恢复' };
     }
     if (!ctx.saveFileManager || !ctx.serializer || !ctx.saveDir) {
       return { status: 'error', message: '存档系统未初始化' };
     }
     const filePath = headSaveId.includes('/') ? headSaveId : `${ctx.saveDir}/${headSaveId}`;
     await ctx.saveFileManager.loadGame(filePath, ctx.serializer, ctx.saveDir);
     return { status: 'action_executed', action, narration: [`已切换至分支「${name}」并恢复存档。`] };
   }
   ```
   Note: `switchBranch` in branch-manager.ts uses `branchId` as the key in `state.branches` — the `name` parameter in the handler is passed as `branchId` here (consistent with current code). `getBranchMeta(name)` will also receive the same value. Confirm this matches existing create/switch logic before applying.
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/engine/action-handlers/branch-handler.test.ts src/engine/action-handlers/load-handler.test.ts --bail 2>&1 | tail -30</automated>
  </verify>
  <done>
    - load-handler line 7: loadGame called with three args (filePath, ctx.serializer, ctx.saveDir)
    - branch-handler switch: after switchBranch, checks headSaveId; null → '该分支没有存档可恢复'
    - branch-handler switch: valid headSaveId → loadGame called; returns '已切换至分支「X」并恢复存档。'
    - bun tsc --noEmit passes
    - All existing tests pass: bun test --bail
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user input → saveDir path | filePath constructed from action.target or headSaveId — traversal risk |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-12P01-01 | Elevation of Privilege | load-handler.ts, branch-handler.ts | mitigate | Pass ctx.saveDir as 3rd arg to loadGame — path.resolve() + startsWith() check in save-file-manager.ts line 54-58 activates |
| T-12P01-02 | Information Disclosure | serializer.ts snapshot | accept | playtime and saveName are non-secret game metadata; no PII |
</threat_model>

<verification>
Run full test suite after all three tasks:
```
cd /Users/makoto/Downloads/work/cli && bun test --bail 2>&1 | tail -20
bun tsc --noEmit 2>&1 | head -20
```
All tests must pass. No type errors.
</verification>

<success_criteria>
- snapshot(saveName) stores the provided name in meta.saveName; snapshot() defaults to 'Quick Save'
- snapshot() calls getPlaytime() — not hardcoded 0
- saveGame('Chapter 1', ...) produces a save with meta.saveName === 'Chapter 1'
- loadGame in load-handler called with three args (path traversal guard active)
- branch switch with no headSaveId returns '该分支没有存档可恢复'
- branch switch with valid headSaveId calls loadGame and returns success narration
- bun test: all pass, no regressions
- bun tsc --noEmit: zero errors
</success_criteria>

<output>
After completion, create `/Users/makoto/Downloads/work/cli/.planning/phases/12-combat-save-correctness/12-P01-SUMMARY.md`
</output>
