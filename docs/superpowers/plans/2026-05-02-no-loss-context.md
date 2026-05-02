# No-Loss Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove destructive truncation while preserving full memory, narration, turn logs, UI access, and full-first AI context behavior.

**Architecture:** Introduce an append-only NPC memory source of truth, keep summaries and recent/salient lists as derived compatibility views, and replace storage caps with reversible UI and AI selection behavior. Fixed prompt caps become full-first context selection with budget metadata; UI preview caps remain only when full content is reachable.

**Tech Stack:** TypeScript, Bun test runner, Zod schemas, Ink React UI, existing store/persistence/event architecture.

---

## File Structure

- Modify `src/state/npc-memory-store.ts`: add `allMemories`, summary source metadata, no-loss schema defaults, append-only `addMemory`, and event emission based on raw memory growth.
- Modify `src/persistence/memory-persistence.ts`: make `applyRetention` non-destructive and normalize legacy records before writing.
- Modify `src/ai/summarizer/summarizer-worker.ts`: preserve raw NPC memories when applying summaries.
- Modify `src/ai/summarizer/summarizer-scheduler.ts`: trigger compression from the authoritative raw log.
- Modify `src/engine/turn-log.ts`: remove module/store caps from append and restore.
- Modify `src/state/turn-log-store.ts`: keep `MAX_TURN_LOG_SIZE` only as deprecated view-size compatibility or remove callers.
- Modify `src/engine/scene-manager.ts`: stop capping/resetting `narrationLines`; pass full narration to AI context assembly.
- Modify `src/engine/game-screen-controller.ts`: stop capping `narrationLines`; pass full narration to narration generation.
- Create `src/ai/utils/context-budget.ts`: shared full-first context selection with omitted-entry metadata.
- Modify `src/ai/utils/context-assembler.ts`: use full-first selection and expose omitted metadata.
- Modify `src/ai/prompts/npc-system.ts`: remove fixed memory cap inside prompt builder.
- Modify `src/ai/prompts/narrative-system.ts`: remove fixed recent/codex/description caps inside prompt builder.
- Modify `src/engine/dialogue-manager.ts`: store full memory text and use full-first codex selection.
- Modify `src/ai/roles/dialogue-options-generator.ts`: use full dialogue history unless budget utility omits entries.
- Modify `src/ui/panels/dialogue-panel.tsx`: add full-history toggle or scroll state for all dialogue entries.
- Modify `src/ui/panels/replay-panel.tsx`: mark list labels as previews while preserving full detail.
- Update tests in `src/state/npc-memory-store.test.ts`, `src/persistence/memory-persistence.test.ts`, `src/ai/summarizer/summarizer-worker.test.ts`, `src/ai/summarizer/summarizer-scheduler.test.ts`, `src/engine/turn-log.test.ts`, `src/state/__tests__/turn-log-store.test.ts`, `src/engine/scene-manager.test.ts`, `src/ai/utils/context-assembler.test.ts`, `src/ai/prompts/npc-system.test.ts`, `src/ai/prompts/narrative-system.test.ts`, and relevant UI panel tests if they exist.

## Task 1: Add append-only NPC memory model

**Files:**
- Modify: `src/state/npc-memory-store.ts`
- Test: `src/state/npc-memory-store.test.ts`

- [ ] **Step 1: Write failing schema test for large memory records**

Add a test that creates 75 memory entries and expects `NpcMemoryRecordSchema.safeParse` to succeed when `allMemories` contains all entries.

```ts
const entries = Array.from({ length: 75 }, (_, i) => makeEntry(i));
const result = NpcMemoryRecordSchema.safeParse({
  npcId: 'npc_guard',
  allMemories: entries,
  recentMemories: entries.slice(-15),
  salientMemories: entries.slice(0, 50),
  archiveSummary: '',
  archiveSourceIds: [],
  lastUpdated: '2026-01-01T00:00:00.000Z',
  version: 0,
});
expect(result.success).toBe(true);
```

- [ ] **Step 2: Write failing append-only `addMemory` test**

Add a test that calls `addMemory` 20 times and expects `allMemories` length to be 20, with no raw entry lost.

- [ ] **Step 3: Write failing memory event test**

Add a test using a mock event bus that calls `addMemory` 20 times and expects the 20th write to still emit `npc_memory_written`. This prevents persistence from silently stopping once `recentMemories` reaches its derived view size.

```ts
expect(emittedEvents.at(-1)).toMatchObject({
  npcId: 'npc_guard',
  event: 'event-19',
  turnNumber: 19,
});
```

- [ ] **Step 4: Run targeted test and verify it fails**

Run: `bun test src/state/npc-memory-store.test.ts`

Expected: FAIL because `allMemories` and `archiveSourceIds` do not exist and old schema caps reject large arrays.

- [ ] **Step 5: Implement no-loss NPC memory schema**

Update `NpcMemoryRecordSchema` to include `allMemories` and `archiveSourceIds`; remove `.max(15)` and `.max(50)` from storage schema arrays.

```ts
allMemories: z.array(NpcMemoryEntrySchema).default([]),
recentMemories: z.array(NpcMemoryEntrySchema).default([]),
salientMemories: z.array(NpcMemoryEntrySchema).default([]),
archiveSourceIds: z.array(z.string()).default([]),
```

- [ ] **Step 6: Implement append-only `addMemory`**

Make `addMemory` append to `allMemories` and update compatibility views without deleting raw data. If keeping bounded derived views, compute them from `allMemories`; do not use them as source of truth.

```ts
record.allMemories = [...(record.allMemories ?? []), entry];
record.recentMemories = record.allMemories.slice(-15);
record.salientMemories = record.allMemories
  .filter((memory) => memory.importance !== 'low')
  .slice(-50);
```

- [ ] **Step 7: Emit memory-written events from raw memory growth**

In the store listener inside `createNpcMemoryStore`, compare `allMemories.length` instead of `recentMemories.length`, and emit the latest raw memory entry. Use a legacy fallback only when `allMemories` is absent.

```ts
const newEntries = newState.memories[npcId]?.allMemories ?? newState.memories[npcId]?.recentMemories ?? [];
const oldEntries = oldState.memories[npcId]?.allMemories ?? oldState.memories[npcId]?.recentMemories ?? [];
if (newEntries.length > oldEntries.length) {
  const latest = newEntries[newEntries.length - 1];
}
```

- [ ] **Step 8: Run targeted test and verify it passes**

Run: `bun test src/state/npc-memory-store.test.ts`

Expected: PASS, including the 20th memory event emission.

- [ ] **Step 9: Checkpoint**

Do not commit unless the user explicitly requests commits. Record changed files for later summary.

## Task 2: Stop destructive memory persistence

**Files:**
- Modify: `src/persistence/memory-persistence.ts`
- Test: `src/persistence/memory-persistence.test.ts`

- [ ] **Step 1: Update failing persistence tests**

Change tests that currently expect eviction/archiving into tests that prove `applyRetention` preserves every raw entry in `allMemories` and never moves structured records into plain text as the only copy.

- [ ] **Step 2: Run targeted test and verify it fails**

Run: `bun test src/persistence/memory-persistence.test.ts`

Expected: FAIL because `applyRetention` still evicts recent entries and archives salient entries.

- [ ] **Step 3: Replace `applyRetention` with normalization**

Make `applyRetention` normalize legacy records instead of truncating. It should ensure `allMemories` contains the union of existing `allMemories`, `recentMemories`, and `salientMemories` by ID.

```ts
const byId = new Map<string, NpcMemoryEntry>();
for (const memory of [...(record.allMemories ?? []), ...record.recentMemories, ...record.salientMemories]) {
  byId.set(memory.id, memory);
}
const allMemories = [...byId.values()].sort((a, b) => a.turnNumber - b.turnNumber);
```

- [ ] **Step 4: Preserve compatibility views non-destructively**

Return normalized `allMemories`, keep `recentMemories` and `salientMemories` as derived views if needed, and never append raw event text to `archiveSummary` as replacement storage.

- [ ] **Step 5: Run targeted test and verify it passes**

Run: `bun test src/persistence/memory-persistence.test.ts`

Expected: PASS.

- [ ] **Step 6: Checkpoint**

Do not commit unless explicitly requested.

## Task 3: Preserve raw memories during summarization

**Files:**
- Modify: `src/ai/summarizer/summarizer-worker.ts`
- Modify: `src/ai/summarizer/summarizer-scheduler.ts`
- Test: `src/ai/summarizer/summarizer-worker.test.ts`
- Test: `src/ai/summarizer/summarizer-scheduler.test.ts`

- [ ] **Step 1: Write failing worker test**

Update `applyNpcMemoryCompression` tests so a compression result updates `archiveSummary` and `archiveSourceIds`, but leaves `allMemories` and `recentMemories` intact.

- [ ] **Step 2: Write failing scheduler test**

Update trigger tests to schedule compression based on unsummarized raw entries from `allMemories`, falling back to `recentMemories` only when `allMemories` is missing or empty. Include a legacy-record case where `allMemories` defaults to `[]` but `recentMemories` contains entries, and expect the scheduler to enqueue them.

- [ ] **Step 3: Run targeted tests and verify failures**

Run: `bun test src/ai/summarizer/summarizer-worker.test.ts src/ai/summarizer/summarizer-scheduler.test.ts`

Expected: FAIL because worker still slices `recentMemories` and scheduler only checks `recentMemories`.

- [ ] **Step 4: Update worker to keep raw entries**

Remove `r.recentMemories = r.recentMemories.slice(task.entryIds.length)`. Set `archiveSummary = result`, merge `task.entryIds` into `archiveSourceIds`, and increment `version`.

- [ ] **Step 5: Update scheduler source selection**

Use length-based fallback, not nullish fallback, so legacy records still summarize after `allMemories` defaults to an empty array. Enqueue entry IDs that are not already in `archiveSourceIds`. Keep existing combat priority behavior.

```ts
const source = record.allMemories && record.allMemories.length > 0
  ? record.allMemories
  : record.recentMemories;
const unsummarized = source.filter((memory) => !record.archiveSourceIds.includes(memory.id));
```

- [ ] **Step 6: Run targeted tests and verify they pass**

Run: `bun test src/ai/summarizer/summarizer-worker.test.ts src/ai/summarizer/summarizer-scheduler.test.ts`

Expected: PASS.

- [ ] **Step 7: Checkpoint**

Do not commit unless explicitly requested.

## Task 4: Remove turn-log storage caps

**Files:**
- Modify: `src/engine/turn-log.ts`
- Modify: `src/state/turn-log-store.ts`
- Test: `src/engine/turn-log.test.ts`
- Test: `src/state/__tests__/turn-log-store.test.ts`

- [ ] **Step 1: Write failing append/restore tests**

Add tests that append and restore more than 50 turn entries and expect all entries to remain in `getTurnLog()` and `getTurnLogStore().getState().entries`.

- [ ] **Step 2: Run targeted tests and verify failures**

Run: `bun test src/engine/turn-log.test.ts src/state/__tests__/turn-log-store.test.ts`

Expected: FAIL because storage still slices to `MAX_TURN_LOG_SIZE`.

- [ ] **Step 3: Remove append cap**

In `appendTurnLog`, remove the module-level cap and store-level `.slice(-MAX_TURN_LOG_SIZE)`.

```ts
turnLog = [...turnLog, fullEntry];
getStore().setState((d) => {
  d.entries = [...d.entries, fullEntry];
});
```

- [ ] **Step 4: Remove restore cap**

In `restoreTurnLog`, assign all entries into both stores.

```ts
turnLog = [...entries];
getStore().setState((d) => { d.entries = [...entries]; });
```

- [ ] **Step 5: Reclassify `MAX_TURN_LOG_SIZE`**

If other files still need a display window size, rename or document it as a view constant. Do not use it for storage retention.

- [ ] **Step 6: Run targeted tests and verify they pass**

Run: `bun test src/engine/turn-log.test.ts src/state/__tests__/turn-log-store.test.ts`

Expected: PASS.

- [ ] **Step 7: Checkpoint**

Do not commit unless explicitly requested.

## Task 5: Preserve full narration history across scene actions

**Files:**
- Modify: `src/engine/scene-manager.ts`
- Modify: `src/engine/game-screen-controller.ts`
- Test: `src/engine/scene-manager.test.ts`

- [ ] **Step 1: Write failing scene transition test**

Add a test that loads one scene, appends history, then loads another scene and expects prior narration lines plus new narration lines to remain.

- [ ] **Step 2: Write failing no-cap test**

Add a test that performs or simulates more than 50 narration appends and expects all lines to remain in `scene.narrationLines`.

- [ ] **Step 3: Run targeted test and verify failures**

Run: `bun test src/engine/scene-manager.test.ts`

Expected: FAIL because `loadScene` resets `narrationLines` and `capNarrationLines` slices to 50.

- [ ] **Step 4: Replace capping helper**

Change `capNarrationLines` in both `scene-manager.ts` and `game-screen-controller.ts` into a no-loss append helper or remove it.

```ts
function appendNarrationLines(lines: readonly string[], additions: readonly string[]): string[] {
  return [...lines, ...additions];
}
```

- [ ] **Step 5: Append on scene load instead of reset**

Change `draft.narrationLines = narrationLines` to append new scene lines to existing history.

```ts
draft.narrationLines = [...draft.narrationLines, ...narrationLines];
```

- [ ] **Step 6: Pass full narration to AI inputs**

Replace `state.narrationLines.slice(-3)` and `recentNarration: []` in scene narration paths with full available narration, leaving budget selection to context utilities.

- [ ] **Step 7: Run targeted test and verify it passes**

Run: `bun test src/engine/scene-manager.test.ts`

Expected: PASS.

- [ ] **Step 8: Checkpoint**

Do not commit unless explicitly requested.

## Task 6: Add full-first AI context selection

**Files:**
- Create: `src/ai/utils/context-budget.ts`
- Create or modify: `src/ai/utils/context-budget.test.ts`
- Modify: `src/ai/utils/context-assembler.ts`
- Modify: `src/ai/prompts/npc-system.ts`
- Modify: `src/ai/prompts/narrative-system.ts`
- Modify: `src/engine/dialogue-manager.ts`
- Modify: `src/ai/roles/dialogue-options-generator.ts`
- Test: `src/ai/utils/context-assembler.test.ts`
- Test: `src/ai/prompts/npc-system.test.ts`
- Test: `src/ai/prompts/narrative-system.test.ts`

- [ ] **Step 1: Write failing budget utility tests**

Add tests for helpers that derive a context budget from role config, return all entries when under budget, and return selected plus omitted metadata when over budget.

```ts
const budget = getContextBudgetForRole({ maxTokens: 384000 }, { reservedOutputTokens: 4000 });
expect(budget).toBeGreaterThan(0);

const result = selectContextItems(items, {
  estimate: (item) => item.text.length,
  maxBudget: 10,
  getId: (item) => item.id,
});
expect(result.omittedIds).toEqual(['long_old_item']);
```

- [ ] **Step 2: Run budget utility test and verify failure**

Run: `bun test src/ai/utils/context-budget.test.ts`

Expected: FAIL because the file does not exist.

- [ ] **Step 3: Implement context budget utility**

Create `getContextBudgetForRole` and `selectContextItems` with a full-first path. Derive budget from the selected role config's `maxTokens` with reserved output/headroom options, not from hardcoded model names. Keep selection deterministic: preserve original order when all fit; when over budget, prefer explicitly supplied priority, then recency.

```ts
export function getContextBudgetForRole(
  roleConfig: { readonly maxTokens: number },
  options: { readonly reservedOutputTokens: number; readonly safetyRatio?: number },
): number {
  return Math.max(0, Math.floor((roleConfig.maxTokens - options.reservedOutputTokens) * (options.safetyRatio ?? 0.8)));
}
```

- [ ] **Step 4: Update context assembler tests**

Change tests that expect 3 codex/memory/narration entries to expect full context under budget and omitted metadata over budget.

- [ ] **Step 5: Remove fixed caps from context assembler**

Remove `.slice(0, 3)`, `.slice(-3)`, and description `.slice(0, 200)` from `assembleNarrativeContext`; delegate any omission to `selectContextItems`. Update the return type so omitted metadata is observable by callers.

```ts
type OmittedContext = {
  readonly codexIds: readonly string[];
  readonly memoryIds: readonly string[];
  readonly narrationIndexes: readonly number[];
};

type AssembledContext = {
  readonly context: ExistingContextShape;
  readonly omittedContext: OmittedContext;
};
```

- [ ] **Step 6: Remove fixed caps from prompt builders**

In `npc-system.ts`, remove `context.memories.slice(0, 8)`. In `narrative-system.ts`, remove `recentNarration.slice(-3)`, `codexEntries.slice(0, 3)`, and description `.slice(0, 200)`.

- [ ] **Step 7: Update dialogue and options AI paths**

In `dialogue-manager.ts`, update both `buildNpcLlmContext` and `countEncounters` to use `memoryRecord.allMemories` as the primary source, with a legacy fallback to the union of `recentMemories` and `salientMemories`. Then replace codex `.slice(0, 3)` and description `.slice(0, 150)` with context-budget selection. In `dialogue-options-generator.ts`, use full `recentHistory` unless budget selection omits entries.

```ts
const rawMemories = memoryRecord?.allMemories?.length
  ? memoryRecord.allMemories
  : [...(memoryRecord?.recentMemories ?? []), ...(memoryRecord?.salientMemories ?? [])];
```

Add or update a dialogue-manager test proving memory beyond the old 15-entry recent view can influence dialogue context or appears in omitted metadata when budgeted out.

- [ ] **Step 8: Add metadata propagation tests**

Add tests proving `assembleNarrativeContext` returns empty `omittedContext` under budget and populated omitted IDs/indexes over budget. For dialogue paths, assert old extra memories either appear in prompt input under budget or are listed in omitted metadata over budget.

- [ ] **Step 9: Run targeted AI tests**

Run: `bun test src/ai/utils/context-budget.test.ts src/ai/utils/context-assembler.test.ts src/ai/prompts/npc-system.test.ts src/ai/prompts/narrative-system.test.ts src/engine/dialogue-manager.test.ts`

Expected: PASS after updating assertions.

- [ ] **Step 10: Checkpoint**

Do not commit unless explicitly requested.

## Task 7: Convert UI truncation into reversible previews

**Files:**
- Modify: `src/ui/panels/dialogue-panel.tsx`
- Modify: `src/ui/panels/replay-panel.tsx`
- Test: add/update UI panel tests if existing local patterns support them

- [ ] **Step 1: Add dialogue full-history behavior test if practical**

If there is an existing Ink render-test pattern, add a test proving `DialoguePanel` can show all non-greet history after toggling full-history mode.

- [ ] **Step 2: Add replay preview/detail test if practical**

Test that replay list labels are previews but selected detail still includes full `entry.action` and full narration lines.

- [ ] **Step 3: Implement dialogue history toggle**

Add state such as `showFullHistory`. Keep recent view by default if desired, but add an input hint and key, for example `h`, to toggle all history.

```tsx
const visibleHistory = showFullHistory ? filteredHistory : filteredHistory.slice(-4);
<Text dimColor>{showFullHistory ? 'h 隐藏早期对话' : 'h 查看全部对话'}</Text>
```

- [ ] **Step 4: Clarify replay preview labels**

Keep list labels short for layout, but add an ellipsis only when shortened and ensure detail continues to render full action.

```ts
return entry.action.length > 45
  ? `[T${entry.turnNumber}] ${entry.action.slice(0, 45)}…`
  : `[T${entry.turnNumber}] ${entry.action}`;
```

- [ ] **Step 5: Run UI tests or targeted typecheck**

Run available UI tests if present; otherwise run: `bun run typecheck`

Expected: PASS.

- [ ] **Step 6: Checkpoint**

Do not commit unless explicitly requested.

## Task 8: Update serialization and migration compatibility

**Files:**
- Modify: `src/state/serializer.ts` only if schema changes require restore normalization
- Modify: `src/persistence/save-migrator.ts` if legacy saves need normalization before schema parse
- Test: `src/persistence/save-migrator.test.ts`
- Test: serializer tests if present

- [ ] **Step 1: Write failing legacy-save compatibility test**

Add a test for a legacy save containing only `recentMemories` and `salientMemories`, expecting migration/restore to produce `allMemories` containing their union.

- [ ] **Step 2: Write failing large-save validation test**

Add a test that a save with more than 50 NPC memories validates after migration.

- [ ] **Step 3: Run targeted tests and verify failures**

Run: `bun test src/persistence/save-migrator.test.ts`

Expected: FAIL until normalization is wired.

- [ ] **Step 4: Implement migration normalization**

Normalize NPC memory records during migration or restore so missing `allMemories` is built from existing arrays. Avoid duplicate IDs.

- [ ] **Step 5: Run targeted tests and verify they pass**

Run: `bun test src/persistence/save-migrator.test.ts`

Expected: PASS.

- [ ] **Step 6: Checkpoint**

Do not commit unless explicitly requested.

## Task 9: Full verification pass

**Files:**
- No new files unless test updates reveal missing coverage

- [ ] **Step 1: Run all tests**

Run: `bun test`

Expected: PASS. If failures are unrelated pre-existing failures, document them with exact failing test names and do not broaden scope.

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `bun run build`

Expected: PASS.

- [ ] **Step 4: Inspect remaining truncation patterns**

Run a code search for destructive caps and fixed AI context slices. Remaining matches should be output schema limits, reversible UI previews, or documented budget-selection logic.

Search terms: `slice(`, `.max(15)`, `.max(50)`, `MAX_TURN_LOG_SIZE`, `recentNarration`, `archiveSummary`, `recentMemories =`.

- [ ] **Step 5: Summarize results**

Report changed files, verification commands, and any remaining intentional preview/output limits.

- [ ] **Step 6: Checkpoint**

Do not commit unless explicitly requested by the user.
