---
phase: 04-differentiation
reviewed: 2026-04-22T12:00:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - src/ai/utils/context-assembler.ts
  - src/ai/utils/epistemic-tagger.ts
  - src/ai/utils/npc-knowledge-filter.ts
  - src/codex/schemas/entry-types.ts
  - src/engine/branch-diff.ts
  - src/engine/exploration-tracker.ts
  - src/engine/knowledge-tracker.ts
  - src/engine/turn-log.ts
  - src/events/event-types.ts
  - src/input/command-registry.ts
  - src/persistence/branch-manager.ts
  - src/persistence/save-migrator.ts
  - src/state/branch-store.ts
  - src/state/exploration-store.ts
  - src/state/game-store.ts
  - src/state/player-knowledge-store.ts
  - src/state/serializer.ts
  - src/types/game-action.ts
  - src/ui/components/category-tabs.tsx
  - src/ui/components/diff-line.tsx
  - src/ui/components/inline-confirm.tsx
  - src/ui/components/map-node.tsx
  - src/ui/hooks/use-game-input.ts
  - src/ui/hooks/use-tab-completion.ts
  - src/ui/panels/branch-tree-panel.tsx
  - src/ui/panels/codex-panel.tsx
  - src/ui/panels/compare-panel.tsx
  - src/ui/panels/map-panel.tsx
  - src/ui/panels/shortcut-help-panel.tsx
  - src/ui/screens/game-screen.tsx
findings:
  critical: 1
  warning: 12
  info: 5
  total: 18
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-04-22T12:00:00Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Phase 4 adds story branching, ASCII map, codex browser, keyboard shortcuts, and epistemic separation (truth vs. NPC belief vs. player knowledge). The code is generally well-structured with good use of Zod schemas, immutable patterns via Immer, and clean React/Ink component decomposition. However, there is one critical issue (silent error swallowing in branch registry loading), several logic bugs (redundant/dead filter logic, duplicate array entry, missing state restoration for turn log), and a handful of quality concerns.

## Critical Issues

### CR-01: Silent error swallowing in loadBranchRegistry hides filesystem and parse failures

**File:** `src/persistence/branch-manager.ts:124-128`
**Issue:** The catch block only re-throws errors whose message starts with `"Invalid branch registry"`. All other errors -- including filesystem permission errors, disk I/O failures, and `JSON.parse` SyntaxErrors -- are silently swallowed. This means a corrupted `branches.json` file (invalid JSON) or a permission-denied error will be silently ignored, and the branch store will remain in its default state with no indication to the user that their branch data failed to load. This is a **data loss risk**: the player could save over their branch registry thinking it loaded when it did not.
**Fix:**
```typescript
} catch (err) {
  if (err instanceof Error && err.message.startsWith('Invalid branch registry')) {
    throw err;
  }
  // File not found is expected on first run -- all other errors should propagate
  const isFileNotFound = err instanceof Error &&
    (err.message.includes('ENOENT') || err.message.includes('No such file'));
  if (!isFileNotFound) {
    throw err;
  }
}
```

## Warnings

### WR-01: Serializer.restore does not restore turnLog into the turn-log module

**File:** `src/state/serializer.ts:137-169`
**Issue:** The `restore` method parses `data.turnLog` from the save file but never calls `restoreTurnLog()` (from `src/engine/turn-log.ts`) with it. The quest event log is properly restored (lines 167-168), but `turnLog` data is silently discarded. After loading a save, `replayTurns()` and `getTurnLog()` will return empty arrays, losing the player's turn history.
**Fix:** Add after line 168:
```typescript
import { resetTurnLog, restoreTurnLog as restoreTurnLogEntries } from '../engine/turn-log';
// ... in restore():
resetTurnLog();
restoreTurnLogEntries(data.turnLog);
```

### WR-02: Redundant and dead code in npc-knowledge-filter visibility logic

**File:** `src/ai/utils/npc-knowledge-filter.ts:21-44`
**Issue:** The `secret` check on line 21 is redundant -- the `known_by` check on line 18 already returned `true` for NPCs in the list, so reaching line 21 means `!ep.known_by.includes(npc.npcId)` is always true, making the second condition in the `&&` always true and the entire check equivalent to just `if (ep.visibility === 'secret') return false`. Lines 36-41 (scope-based public check) are dead code because line 43 (`if (ep.visibility === 'public' && ep.authority !== 'canonical_truth') return true`) and line 44 (`if (ep.visibility === 'public') return true`) already cover all public entries unconditionally. The `authority !== 'canonical_truth'` check on line 43 is also dead since line 44 immediately catches the remaining case.
**Fix:** Simplify the logic:
```typescript
if (ep.known_by.includes(npc.npcId)) return true;
if (ep.visibility === 'forbidden') return false;
if (ep.visibility === 'secret') return false;
if (ep.visibility === 'hidden') {
  // Check faction/profession access
  for (const factionId of npc.npcFactionIds) {
    if (ep.known_by.includes(factionId)) return true;
  }
  if (ep.known_by.includes(npc.npcProfession)) return true;
  return false;
}
// For public/discovered: check faction/profession, then scope
for (const factionId of npc.npcFactionIds) {
  if (ep.known_by.includes(factionId)) return true;
}
if (ep.known_by.includes(npc.npcProfession)) return true;
if (ep.visibility === 'public') return true;
if (ep.visibility === 'discovered') return false;
return false;
```

### WR-03: COMBAT_ACTION_TYPES has duplicate 'flee' entry

**File:** `src/ui/screens/game-screen.tsx:59`
**Issue:** `const COMBAT_ACTION_TYPES: readonly CombatActionType[] = ['attack', 'cast', 'guard', 'flee', 'flee'];` has 'flee' twice (indices 3 and 4). The `handleCombatExecute` callback on line 151 also special-cases `index === 3` to return 'flee', which means both index 3 and 4 resolve to 'flee'. If the array is supposed to map to 4 combat action buttons, this is likely a copy-paste bug where index 4 was meant to be a different action (e.g., 'use_item').
**Fix:** Remove the duplicate or replace with the correct 5th action:
```typescript
const COMBAT_ACTION_TYPES: readonly CombatActionType[] = ['attack', 'cast', 'guard', 'flee'];
```
And remove the special-case on line 151 since the array indexing already covers it.

### WR-04: useTabCompletion uses stale closure values

**File:** `src/ui/hooks/use-tab-completion.ts:32`
**Issue:** Inside `handleTab`, the `completionIndex` and `matchedCandidates` values used on line 32 are captured from the closure at the time `handleTab` was created. Due to React's state batching, after `setCompletionIndex(0)` is called (line 26), the next invocation of `handleTab` may still see the old `completionIndex`. This causes the Tab cycle to skip the first candidate or repeat candidates unpredictably.
**Fix:** Use a ref to track `completionIndex` and `matchedCandidates`, or use a functional pattern:
```typescript
const completionRef = useRef({ index: -1, matches: [] as string[], prefix: '' });
const handleTab = useCallback((currentInput: string): string | null => {
  const ref = completionRef.current;
  const prefix = currentInput.toLowerCase();
  if (prefix !== ref.prefix) {
    const matches = candidates.filter(c => c.toLowerCase().startsWith(prefix));
    if (matches.length === 0) return null;
    ref.prefix = prefix;
    ref.matches = matches;
    ref.index = 0;
    setCompletionIndex(0);
    setMatchedCandidates(matches);
    return matches[0] ?? null;
  }
  if (ref.matches.length === 0) return null;
  const nextIndex = (ref.index + 1) % ref.matches.length;
  ref.index = nextIndex;
  setCompletionIndex(nextIndex);
  return ref.matches[nextIndex] ?? null;
}, [candidates]);
```

### WR-05: Unsafe type assertion for panel phase transition

**File:** `src/ui/screens/game-screen.tsx:177`
**Issue:** `draft.phase = panelAction as GameState['phase']` performs an unchecked cast. The `PanelAction` type includes `'inventory'` and `null`, but `GameState['phase']` (from `GamePhaseSchema`) does not include `'inventory'`. If a user presses 'i' (mapped to `'inventory'`), the game state will be set to an invalid phase value that fails Zod validation on save.
**Fix:** Either add `'inventory'` to `GamePhaseSchema`, or validate before setting:
```typescript
const validPhases = new Set<string>(['map', 'journal', 'codex', 'branch_tree', 'shortcuts']);
if (panelAction && validPhases.has(panelAction)) {
  gameStore.setState(draft => { draft.phase = panelAction as GameState['phase']; });
}
```

### WR-06: Division by zero risk in codex-panel and map-panel when categories array is empty

**File:** `src/ui/panels/codex-panel.tsx:223-232`
**Issue:** `(prev - 1 + categories.length) % categories.length` and `(prev + 1) % categories.length` produce `NaN` when `categories.length === 0` (division by zero in modulo). This happens when all entries are filtered out by search. The `NaN` value then corrupts `activeCategory` state.
**Fix:** Guard against empty categories:
```typescript
if (categories.length === 0) return prev;
```

### WR-07: Inventory diff uses split(':') on strings that may contain colons

**File:** `src/engine/branch-diff.ts:156`
**Issue:** `entry.split(':')` is used to destructure `slot:item`, but item names could contain colons (e.g., `weapon:Sword of Light:+3`). This would incorrectly split the item name.
**Fix:** Use split with a limit:
```typescript
const colonIdx = entry.indexOf(':');
const slot = entry.slice(0, colonIdx);
const item = entry.slice(colonIdx + 1);
```

### WR-08: compare-panel scrollOffset state is updated but never used for rendering

**File:** `src/ui/panels/compare-panel.tsx:131,149-151`
**Issue:** `scrollOffset` is set via arrow keys but never consumed by the render logic. The diff list always renders all items without applying the offset. This means the up/down arrow keys appear to do nothing.
**Fix:** Either implement scroll rendering (slice the grouped items by offset and a visible window height), or remove the dead scroll state to avoid confusing future maintainers.

### WR-09: useGameInput hook sets pendingPanelAction but never exposes a setter for it

**File:** `src/ui/hooks/use-game-input.ts:33,38`
**Issue:** `setPendingPanelAction` is created but never called anywhere -- neither inside the hook nor exposed in the return value. The `pendingPanelAction` is always `null`. The game-screen.tsx ended up handling panel actions directly in its own `useInput` rather than through this hook's intended mechanism. This is dead code that indicates the panel action flow was refactored but the hook wasn't cleaned up.
**Fix:** Either remove `pendingPanelAction`/`setPendingPanelAction`/`clearPanelAction` from the hook, or wire them up properly by having game-screen use them instead of its inline `useInput`.

### WR-10: branch-manager deleteBranch does not check for child branches

**File:** `src/persistence/branch-manager.ts:59-70`
**Issue:** `deleteBranch` allows deleting a branch that has child branches referencing it via `parentBranchId`. This leaves orphaned branches in the tree whose `parentBranchId` points to a deleted branch. `getBranchTree` would then fail to render them since `buildSubtree` looks for branches whose parent matches, and the deleted parent would leave children as invisible orphans.
**Fix:** Check for children and either prevent deletion or re-parent them:
```typescript
export function deleteBranch(branchId: string): void {
  const state = branchStore.getState();
  if (!state.branches[branchId]) throw new Error('branch does not exist');
  if (branchId === state.currentBranchId) throw new Error('cannot delete active branch');
  const hasChildren = Object.values(state.branches).some(b => b.parentBranchId === branchId);
  if (hasChildren) throw new Error('cannot delete branch with children; delete or merge children first');
  branchStore.setState(draft => { delete draft.branches[branchId]; });
}
```

### WR-11: context-assembler filters NPC memories by npcProfile.name instead of a dedicated id

**File:** `src/ai/utils/context-assembler.ts:82`
**Issue:** `memories.filter((m) => m.npcId === npcProfile.name)` compares `NpcMemory.npcId` against `NpcProfile.name` (display name). If the NPC's ID and name differ (which they likely do, since IDs are typically slugs like `"blacksmith_hilda"` while names are display strings like `"Hilda"`), this filter will never match and NPC context will always have empty memories.
**Fix:** Use a proper ID field. The `NpcProfile` type should have an `id` field; filter by that instead of `name`. If `NpcProfile` only has `name`, this needs a type fix upstream.

### WR-12: EnemySchema allows hp > maxHp with no cross-field validation

**File:** `src/codex/schemas/entry-types.ts:97-98`
**Issue:** `hp` and `maxHp` are validated independently (`z.number().int().min(1)` each). There is no constraint that `hp <= maxHp`. A codex entry with `hp: 100, maxHp: 50` would pass schema validation, which would cause display bugs in combat (HP bar overflows) or logic errors in the combat engine.
**Fix:** Add a refinement:
```typescript
export const EnemySchema = z.object({
  ...baseFields,
  type: z.literal("enemy"),
  hp: z.number().int().min(1),
  maxHp: z.number().int().min(1),
  // ...
}).refine(data => data.hp <= data.maxHp, {
  message: "hp must not exceed maxHp",
  path: ["hp"],
});
```

## Info

### IN-01: Mutable module-level variable in turn-log.ts

**File:** `src/engine/turn-log.ts:5`
**Issue:** `let turnLog: TurnLogEntry[] = []` is a mutable module-level variable. While the functions do create new arrays (immutable pattern), the module-level `let` makes it possible for future code to accidentally mutate it directly. Using a store (like the pattern used elsewhere) would be more consistent.
**Fix:** Consider wrapping in a `createStore` or at least a closure/class to prevent direct mutation access.

### IN-02: CategoryTabs receives onSelect prop but never uses it

**File:** `src/ui/components/category-tabs.tsx:12,15`
**Issue:** `onSelect` is declared in `CategoryTabsProps` and passed by callers (codex-panel line 327), but the component never calls it. Tab switching is handled by keyboard input in the parent. This is a dead prop.
**Fix:** Either remove `onSelect` from the props type, or wire it up to click/select handling if Ink supports it.

### IN-03: Map node icon-to-label mapping duplicated between map-panel.tsx:202 and line 293

**File:** `src/ui/panels/map-panel.tsx:202-205,293`
**Issue:** The icon-to-label mapping (H=town, T=temple, etc.) is defined twice: once in `legendIcons` (line 202) and once inline in a ternary chain (line 293). If a new icon type is added, both must be updated.
**Fix:** Extract a shared `ICON_LABELS` constant and use it in both places.

### IN-04: Magic number 3 used as context limit in context-assembler

**File:** `src/ai/utils/context-assembler.ts:52,60,83`
**Issue:** `.slice(0, 3)` is used in multiple places to limit codex entries, NPC memories, etc. The significance of 3 is unclear and if the token budget changes, all three locations must be found and updated.
**Fix:** Extract a named constant, e.g., `const MAX_CONTEXT_ITEMS = 3`.

### IN-05: Deeply nested ternary chain in game-screen.tsx

**File:** `src/ui/screens/game-screen.tsx:250-318`
**Issue:** The `scenePanelNode` assignment is a 9-level deep ternary chain. This is difficult to read, maintain, and extend. Each new panel type adds another nesting level.
**Fix:** Refactor to a function that maps `gameState.phase` to the appropriate panel component using a switch or Map lookup pattern.

---

_Reviewed: 2026-04-22T12:00:00Z_
_Reviewer: Ducc (gsd-code-reviewer)_
_Depth: standard_
