---
phase: 04-differentiation
fixed_at: 2026-04-22T13:00:00Z
review_path: .planning/phases/04-differentiation/04-REVIEW.md
iteration: 1
findings_in_scope: 13
fixed: 11
skipped: 2
status: partial
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-04-22T13:00:00Z
**Source review:** .planning/phases/04-differentiation/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 13 (1 Critical + 12 Warning)
- Fixed: 11
- Skipped: 2

## Fixed Issues

### CR-01: Silent error swallowing in loadBranchRegistry hides filesystem and parse failures

**Files modified:** `src/persistence/branch-manager.ts`
**Commit:** 58a3e7e (pre-existing fix, committed in prior session)
**Applied fix:** The `isFileNotFound` guard was already applied before this session — the catch block now only silently swallows ENOENT errors; all other errors (I/O failures, JSON parse errors) propagate.

---

### WR-01: Serializer.restore does not restore turnLog into the turn-log module

**Files modified:** `src/state/serializer.ts`
**Commit:** 58a3e7e (pre-existing fix, committed in prior session)
**Applied fix:** `resetTurnLog()` and `restoreTurnLogEntries(data.turnLog)` calls were already present at lines 171-172 before this session began.

---

### WR-02: Redundant and dead code in npc-knowledge-filter visibility logic

**Files modified:** `src/ai/utils/npc-knowledge-filter.ts`
**Commit:** f076d37
**Applied fix:** Removed redundant `!ep.known_by.includes(npc.npcId)` conditions from `secret` and `hidden` checks (unreachable since line 18 already returned true for that case). Removed dead scope-based public check block and the redundant `authority !== 'canonical_truth'` condition.

---

### WR-03: COMBAT_ACTION_TYPES has duplicate 'flee' entry

**Files modified:** `src/ui/screens/game-screen.tsx`
**Commit:** 0d4467f
**Applied fix:** Removed duplicate `'flee'` from `COMBAT_ACTION_TYPES` array (now 4 elements: `['attack', 'cast', 'guard', 'flee']`). Removed the `index === 3` special-case in `handleCombatExecute` since array indexing now handles it correctly.

---

### WR-04: useTabCompletion uses stale closure values

**Files modified:** `src/ui/hooks/use-tab-completion.ts`
**Commit:** 1cbd486
**Applied fix:** Replaced stale-closure state reads with a `useRef` tracking `{ index, matches, prefix }`. The ref is mutated synchronously inside `handleTab`, ensuring the next Tab press always reads the latest index regardless of React state batching. State setters (`setCompletionIndex`, `setMatchedCandidates`) are kept for UI rendering; `resetCompletion` now also resets the ref. Removed unused `lastPrefix` state.

---

### WR-05: Unsafe type assertion for panel phase transition

**Files modified:** `src/ui/screens/game-screen.tsx`
**Commit:** 42c34f5
**Applied fix:** Added a `validPhases` Set containing only phases that exist in `GameState['phase']` (`map`, `journal`, `codex`, `branch_tree`, `compare`, `shortcuts`). The cast now only executes when `panelAction` is a member of that set, preventing `'inventory'` from being assigned to game state.

---

### WR-06: Division by zero risk in codex-panel when categories array is empty

**Files modified:** `src/ui/panels/codex-panel.tsx`
**Commit:** edbd35a
**Applied fix:** Added `if (categories.length === 0) return prev;` guard at the top of both `setActiveCategory` updater callbacks (`[` and `]` key handlers), preventing NaN from modulo-by-zero when all entries are filtered out by search.

---

### WR-07: Inventory diff uses split(':') on strings that may contain colons

**Files modified:** `src/engine/branch-diff.ts`
**Commit:** b88d155
**Applied fix:** Replaced `entry.split(':')` destructuring with `indexOf`-based slicing in both the `srcEquipped` and `tgtEquipped` loops, so item names containing colons (e.g., `weapon:Sword of Light:+3`) are correctly parsed.

---

### WR-08: compare-panel scrollOffset state is updated but never used for rendering

**Files modified:** `src/ui/panels/compare-panel.tsx`
**Commit:** 652daf6
**Applied fix:** Removed `scrollOffset` state and the `setScrollOffset` calls from the `useInput` handler. Also removed `upArrow`/`downArrow` from the key type in `useInput` since they are no longer handled.

---

### WR-09: useGameInput hook sets pendingPanelAction but never exposes a setter for it

**Files modified:** `src/ui/hooks/use-game-input.ts`
**Commit:** c0c6e33
**Applied fix:** Removed `pendingPanelAction`, `setPendingPanelAction`, and `clearPanelAction` from the hook and its return type. Removed the now-unused `useCallback` import. No callers referenced these symbols.

---

### WR-10: branch-manager deleteBranch does not check for child branches

**Files modified:** `src/persistence/branch-manager.ts`
**Commit:** 018fe00
**Applied fix:** Added child-branch check before deletion: `Object.values(state.branches).some(b => b.parentBranchId === branchId)`. Throws a descriptive error if children exist, preventing orphaned branches in the tree.

---

### WR-11: context-assembler filters NPC memories by npcProfile.name instead of a dedicated id

**Files modified:** `src/ai/prompts/npc-system.ts`, `src/ai/utils/context-assembler.ts`, `src/ai/utils/context-assembler.test.ts`, `src/ai/roles/npc-actor.test.ts`, `src/engine/dialogue-manager.ts`
**Commit:** 9ab6f62
**Applied fix:** Added `id: string` field to `NpcProfile` type. Updated `assembleNpcContext` and `assembleFilteredNpcContext` in `context-assembler.ts` to filter by `npcProfile.id` instead of `npcProfile.name`. Updated both `npcProfile` object literals in `dialogue-manager.ts` to include `id: npc.id`. Updated test fixtures in `context-assembler.test.ts` and `npc-actor.test.ts` to include the `id` field.

---

### WR-12: EnemySchema allows hp > maxHp with no cross-field validation

**Files modified:** `src/codex/schemas/entry-types.ts`
**Commit:** 5101bc7
**Applied fix:** Added `.refine(data => data.hp <= data.maxHp, { message: "hp must not exceed maxHp", path: ["hp"] })` to `EnemySchema`. TypeScript compilation confirmed no new errors introduced.

---

## Skipped Issues

### WR-02: (see above — fixed as pre-existing working tree change)

_Note: CR-01 and WR-01 were already fixed before this session (committed as 58a3e7e). They are counted as fixed._

---

_Fixed: 2026-04-22T13:00:00Z_
_Fixer: Ducc (gsd-code-fixer)_
_Iteration: 1_
