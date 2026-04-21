---
phase: 03-persistence-world
reviewed: 2026-04-21T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/events/event-types.ts
  - src/types/game-action.ts
  - src/codex/schemas/entry-types.ts
  - src/state/npc-memory-store.ts
  - src/state/quest-store.ts
  - src/state/relation-store.ts
  - src/engine/reputation-system.ts
  - src/state/serializer.ts
  - src/persistence/save-migrator.ts
  - src/persistence/save-file-manager.ts
  - src/persistence/memory-persistence.ts
  - src/engine/quest-system.ts
  - src/engine/dialogue-manager.ts
  - src/input/command-registry.ts
  - src/game-loop.ts
  - src/ui/panels/journal-panel.tsx
  - src/ui/screens/game-screen.tsx
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 03 introduces persistence (save/load, NPC memory files, quest state, reputation) and new engine systems (dialogue, quest, reputation). The persistence layer and serializer are well-structured with Zod validation on restore, which is the right approach. The main concerns are: a path traversal vulnerability in `loadGame`, a broken mutation inside Immer in `dialogue-manager`, and several logic bugs that will silently produce wrong game state (reputation accumulation on load, quest gating logic, duplicate entry in combat actions array). No hardcoded secrets were found.

---

## Critical Issues

### CR-01: Path Traversal in `loadGame`

**File:** `src/persistence/save-file-manager.ts:47-52`
**Issue:** `loadGame` calls `path.resolve(filePath)` on a user-supplied string and immediately reads the resolved path with no directory-boundary check. A player (or a malicious save file list entry) can supply `../../../../etc/passwd` or an absolute path outside the save directory. `path.resolve` does not restrict the result to the save directory — it will happily resolve traversal sequences to any path on disk.
**Fix:**
```typescript
export async function loadGame(filePath: string, serializer: Serializer, saveDir: string): Promise<void> {
  const resolvedSaveDir = path.resolve(saveDir);
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(resolvedSaveDir + path.sep)) {
    throw new Error('Invalid save path: outside save directory');
  }
  const file = Bun.file(resolvedPath);
  const json = await file.text();
  serializer.restore(json);
}
```
The caller in `game-loop.ts:174` constructs `filePath` from user input directly, so the guard must be in `loadGame`.

---

### CR-02: Immer Mutation of External Object in `dialogue-manager` `writeMemory`

**File:** `src/engine/dialogue-manager.ts:274-297`
**Issue:** Inside the Immer `setState` recipe, when an existing NPC memory record is found, the code does:
```typescript
existing.recentMemories = [...existing.recentMemories, newEntry];
existing.lastUpdated = new Date().toISOString();
```
`existing` is a reference into the Immer draft, so the assignment to `existing.recentMemories` is a direct mutation of the draft property — this part is fine. However the spread `[...existing.recentMemories, newEntry]` creates a new array that references the draft's proxied elements; Immer will then try to finalize those proxied children as part of the parent draft, which can produce unexpected behavior or silent data corruption in some Immer versions when elements are structurally shared between the old and new array. The safe pattern is to push into the draft array directly or use `produce` in a way that avoids spreading draft arrays:
```typescript
if (existing) {
  existing.recentMemories.push(newEntry);
  existing.lastUpdated = new Date().toISOString();
}
```
This is the canonical Immer pattern; spreading a draft array into a new array is fragile.

---

## Warnings

### WR-01: Reputation Accumulates on Game Load (Double-Count Bug)

**File:** `src/state/serializer.ts:113-119`
**Issue:** `restore()` calls `stores.relations.setState(draft => { Object.assign(draft, data.relations); })`. The `relationStore` onChange callback (in `relation-store.ts:31-67`) fires on every `setState` and emits `reputation_changed` events for every NPC/faction whose value differs from the current (in-memory) state. When loading a saved game, all NPC dispositions in the save will differ from the current in-memory zero state, causing a flood of `reputation_changed` events with incorrect deltas. Any listener that applies those deltas (e.g., a future UI badge counter or an NPC attitude recalculation) will see fabricated changes.
**Fix:** Introduce a `restoring` flag in the store or perform a batch-reset before restore that sets the in-memory state to match the saved state without triggering events. At minimum, document this as a known issue so callers don't wire reactive logic to `reputation_changed` during a load sequence.

---

### WR-02: Quest Gating Logic Uses Wrong Condition (AND instead of OR)

**File:** `src/engine/quest-system.ts:32-37`
**Issue:**
```typescript
if (template.min_reputation !== undefined && template.required_npc_id) {
```
This gate only applies if *both* `min_reputation` and `required_npc_id` are set. A quest template with only `min_reputation` (no required NPC) will never be gated — the check silently passes. The schema (`entry-types.ts:133-134`) defines these as independent optional fields. If either is present alone, the gate should still apply.
**Fix:**
```typescript
if (template.min_reputation !== undefined) {
  const npcId = template.required_npc_id;
  const dispositionValue = npcId
    ? (relationStore.getState().npcDispositions[npcId]?.value ?? 0)
    : 0;
  if (dispositionValue < template.min_reputation) {
    return { status: 'gated', reason: '声望不足' };
  }
}
```
Alternatively, if the intent is always NPC-scoped, make `required_npc_id` required when `min_reputation` is present via a Zod refine.

---

### WR-03: `applyRetention` Promotes the Oldest Memory, Not the Most Important

**File:** `src/persistence/memory-persistence.ts:15-19`
**Issue:**
```typescript
if (recent.length >= 15) {
  const promoted = recent[0]!;   // oldest entry
  recent = recent.slice(1);
```
`recent[0]` is the oldest entry (memories are appended at the end). When the buffer is full, the oldest memory is promoted to salient, which is reasonable, but when `salient.length >= 50` the oldest 25 salient memories are archived. This means high-importance memories entered early can be promoted and then immediately archived in the same call if both thresholds are hit together. The `importance` field on `NpcMemoryEntry` (schema line 10) is never consulted — making the field meaningless in practice.
**Fix:** Sort salient memories by importance before archiving, or at minimum archive only `low` importance entries first. The current behavior means a `high`-importance memory can be lost to the archive while a `low`-importance one stays in salient.

---

### WR-04: `listSaves` Silently Accepts Any JSON with a `meta` Field

**File:** `src/persistence/save-file-manager.ts:63-66`
**Issue:**
```typescript
const meta = parsed?.meta as SaveMeta | undefined;
if (meta) {
  entries.push({ filePath, meta });
}
```
`parsed?.meta` is cast to `SaveMeta` without Zod validation. A corrupted or tampered save file with a valid `meta` key but garbage values (e.g., `timestamp: "'; DROP TABLE --"`) will be accepted into the returned list. Downstream code calls `new Date(b.meta.timestamp)` (line 73) which will produce `NaN` for an invalid string, causing the sort to behave incorrectly (NaN comparisons always return false, producing non-deterministic sort order).
**Fix:**
```typescript
import { SaveMetaSchema } from '../state/serializer';
// ...
const metaResult = SaveMetaSchema.safeParse(parsed?.meta);
if (metaResult.success) {
  entries.push({ filePath, meta: metaResult.data });
}
```

---

### WR-05: `endDialogue` Uses Accumulated `relationshipValue` as an Absolute Delta

**File:** `src/engine/dialogue-manager.ts:252-264`
**Issue:** `dialogueStore.getState().relationshipValue` starts at `npc.initial_disposition + npcDialogue.relationshipDelta` (line 153) and grows by adding subsequent `relationshipDelta` values. At `endDialogue`, the entire accumulated `relationshipValue` is applied as a delta to the NPC disposition:
```typescript
const delta = dialogueStore.getState().relationshipValue;
// ...
applyReputationDelta(current, { value: delta });
```
This means a single brief dialogue can shift NPC disposition by `initial_disposition + all_deltas`, which could be a large number (e.g., `0.8 + several 0.1 increments`). The `initial_disposition` from the codex (a value on the -1 to 1 scale, line 54 of `entry-types.ts`) is accumulated into a field intended for -100 to 100 scale disposition changes, creating a scale mismatch. Only the sum of `relationshipDelta` values from the dialogue should be applied as the delta; `initial_disposition` should not be included.
**Fix:** Track accumulated deltas separately from the initial disposition value in the dialogue state.

---

### WR-06: Duplicate `'flee'` in `COMBAT_ACTION_TYPES` Causes Wrong Action Dispatch

**File:** `src/ui/screens/game-screen.tsx:40`
**Issue:**
```typescript
const COMBAT_ACTION_TYPES: readonly CombatActionType[] = ['attack', 'cast', 'guard', 'flee', 'flee'];
```
Index 3 and 4 are both `'flee'`. The `handleCombatExecute` callback (line 121) has a special case for `index === 3` already mapping to `'flee'`, so the duplicate at index 4 is dead but misleading. If there are 5 buttons (attack/cast/guard/flee/something_else), the last slot will incorrectly dispatch `'flee'` instead of the intended action. The `CombatActionsPanel` renders exactly 4 standard actions (based on convention), but this array having 5 entries is a latent bug if the panel ever renders a 5th action.
**Fix:** Remove the duplicate:
```typescript
const COMBAT_ACTION_TYPES: readonly CombatActionType[] = ['attack', 'cast', 'guard', 'flee'];
```
And remove the special-case `index === 3` check in `handleCombatExecute` since it's now redundant.

---

## Info

### IN-01: `questEventLog` Is Module-Level Mutable State

**File:** `src/state/quest-store.ts:44`
**Issue:** `export let questEventLog: QuestEvent[] = [];` is a module-level `let` variable, not encapsulated in a store. This makes it invisible to React subscriptions and difficult to test in isolation. The `resetQuestEventLog` and `restoreQuestEventLog` helpers partially mitigate this but any direct import of `questEventLog` will capture the initial value and miss updates.
**Fix:** Move the event log into the `questStore` state (add an `eventLog` field) or wrap it in a minimal store. At minimum, do not export the raw array; export only the accessor functions.

---

### IN-02: Magic Number `DEFAULT_REGION = 'blackpine_town'` Hardcoded in Persistence

**File:** `src/persistence/memory-persistence.ts:8`
**Issue:** `const DEFAULT_REGION = 'blackpine_town';` is hardcoded. NPC memory files for all NPCs, regardless of their actual `location_id`, will be written under `blackpine_town/`. When multi-region play is added, all files will be in the wrong directory and the path will be stale.
**Fix:** Pass the current region as a parameter derived from the NPC's codex entry or from the active scene, rather than using a hardcoded constant.

---

### IN-03: `renderQuestEntry` Uses `key` Prop on `<Box>` Inside a Function (Not a Component)

**File:** `src/ui/panels/journal-panel.tsx:26`
**Issue:** `renderQuestEntry` is a plain function returning `React.ReactNode`, not a React component. The `key={template.id}` prop on the `<Box>` inside it will be applied but React's reconciler only respects `key` when elements are in an array returned from `map`. Since this function is called directly via `activeQuests.map(renderQuestEntry)` (line 58), the key is on the right element and works correctly. However, the function signature should be a component (`(props: ...) => ...` named with capital letter) to make the intent clear and to avoid future lint warnings about hooks usage inside non-component functions.

---

### IN-04: `handleDialogueExecute` Silently Swallows Errors

**File:** `src/ui/screens/game-screen.tsx:104`
**Issue:**
```typescript
dialogueManager.processPlayerResponse(index).catch(() => {});
```
The empty `.catch` swallows all errors from `processPlayerResponse`, including network errors from the LLM call. The player will see no feedback and the dialogue state will be in an inconsistent half-updated condition. The project coding style requires errors to be handled explicitly at every level.
**Fix:**
```typescript
dialogueManager.processPlayerResponse(index).catch((err: unknown) => {
  console.error('[dialogue] processPlayerResponse failed:', err);
  // Optionally emit an ai_call_failed event so the UI can show an error line
});
```

---

_Reviewed: 2026-04-21T00:00:00Z_
_Reviewer: Ducc (gsd-code-reviewer)_
_Depth: standard_
