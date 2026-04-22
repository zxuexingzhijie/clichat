---
phase: 05-polish
reviewed: 2026-04-22T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - ai-config.yaml
  - src/ai/config/ai-config-loader.ts
  - src/ai/config/ai-config-schema.ts
  - src/ai/providers.ts
  - src/ai/roles/memory-summarizer.ts
  - src/ai/roles/narrative-director.ts
  - src/ai/roles/npc-actor.ts
  - src/ai/summarizer/summarizer-prompts.ts
  - src/ai/summarizer/summarizer-queue.ts
  - src/ai/summarizer/summarizer-scheduler.ts
  - src/ai/summarizer/summarizer-worker.ts
  - src/app.tsx
  - src/events/event-types.ts
  - src/persistence/save-migrator.ts
  - src/state/cost-session-store.ts
  - src/state/game-store.ts
  - src/state/npc-memory-store.ts
  - src/state/serializer.ts
  - src/types/game-action.ts
  - src/ui/panels/replay-panel.tsx
  - src/ui/panels/status-bar.tsx
  - src/ui/screens/game-screen.tsx
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-04-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

This batch covers the AI layer (providers, roles, summarizer pipeline), core state stores, persistence/serialization, and the main UI screens. The architecture is clean and the immutability convention is followed well through the store pattern. The most significant issues are: a silent data-loss race in the summarizer worker where `chapter_summary` and `turn_log_compress` tasks always receive empty input; dead error-logging in narrative retry loops; a logic bug in the scheduler's combat-guard check that can never fire; and a `GameScreen` type signature mismatch against the actual props passed from `App`.

---

## Critical Issues

### CR-01: `chapter_summary` and `turn_log_compress` tasks always summarize empty input

**File:** `src/ai/summarizer/summarizer-worker.ts:62-70`

**Issue:** `dispatchTask` calls `generateChapterSummary([])` and `generateTurnLogCompress([])` unconditionally with empty arrays. No narration lines or turn-log entries are retrieved from any store or passed through the task payload. The LLM therefore receives zero content to summarize on every task of these two types, silently producing meaningless summaries that are stored as `recentChapterSummaries` / `recentTurnCompressBlocks`. This is a silent data-correctness failure — the feature appears to work (no error is thrown) but the output is always garbage.

**Fix:** Pass the actual narration/turn data into the task payload, or retrieve it inside `dispatchTask` from the relevant store. For example, for `chapter_summary`, retrieve recent narration lines from the scene store:

```typescript
if (task.type === 'chapter_summary') {
  const narrationLines = sceneStore.getState().narrationLines;
  const result = await generateChapterSummary(narrationLines);
  recentChapterSummaries.push(result);
  return;
}

if (task.type === 'turn_log_compress') {
  const turns = getTurnLog().slice(-20); // retrieve from engine/turn-log
  const result = await generateTurnLogCompress(turns);
  recentTurnCompressBlocks.push(result);
  return;
}
```

---

## Warnings

### WR-01: Retry loop swallows errors silently — last error is never logged or surfaced

**File:** `src/ai/roles/narrative-director.ts:75-79` and `src/ai/roles/npc-actor.ts:69-71`

**Issue:** Both retry loops catch errors into `lastError` (narrative-director) or discard them entirely (npc-actor's `catch (err)` where `err` is unused). When all retries are exhausted, `lastError` is never logged and the caller receives only a fallback string with no indication of what failed. This makes production debugging of provider errors nearly impossible.

**Fix:** Emit the error on the event bus or at minimum log it before returning the fallback:

```typescript
} catch (err) {
  lastError = err;
  if (attempt === maxRetries) {
    eventBus.emit('ai_call_failed', {
      role: 'narrative-director',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
```

The same pattern applies to `npc-actor.ts` and `memory-summarizer.ts` (which also silently swallows LLM errors via the caller's uncaught promise in `runSummarizerLoop`).

---

### WR-02: Scheduler combat-guard condition for `npc_memory_written` can never be true

**File:** `src/ai/summarizer/summarizer-scheduler.ts:52-53`

**Issue:** The guard `if (combatActive && taskPriority >= 3) return;` uses `taskPriority = 2 as const`. Since `2 >= 3` is always `false`, this guard never fires. The intent (skip low-priority compression during combat) is valid but the condition is wrong. The same pattern at line 73 correctly uses `taskPriority = 3`, so priority-3 tasks are suppressed, but priority-2 tasks are never suppressed even during active combat.

**Fix:** Change the threshold to match the actual desired behavior. If priority-2 tasks (NPC memory compress on direct write) should also be blocked during combat, use `>= 2`:

```typescript
// line 52-53: npc_memory_written path
const taskPriority = 2 as const;
if (combatActive && taskPriority >= 2) return;
```

Or if only priority-3 interval tasks should be blocked, document the priority-2 case explicitly so the dead guard is removed.

---

### WR-03: `enqueueTask` cooldown check silently drops tasks — no observable feedback

**File:** `src/ai/summarizer/summarizer-queue.ts:47-50`

**Issue:** When `cooldownUntil` is set, new tasks are silently dropped. However `COOLDOWN_MS` is defined (30 seconds) but is never written to `cooldownUntil` anywhere in the reviewed code — no call sets this field. This means the cooldown field exists and is checked but is structurally dead: it will always be `null`. If cooldown logic is intentionally deferred, the check adds confusion. If it was meant to be populated after task failure, that wiring is missing.

**Fix:** Either wire `cooldownUntil` in `markFailed` (or `runSummarizerLoop` after repeated failures), or remove the dead check and `COOLDOWN_MS` constant until the feature is implemented:

```typescript
// In markFailed, if cooldown is desired after failure:
export function markFailed(taskId: string): void {
  summarizerQueueStore.setState((draft) => {
    const task = draft.tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = 'failed';
      draft.cooldownUntil = new Date(Date.now() + COOLDOWN_MS).toISOString();
    }
  });
}
```

---

### WR-04: `GameScreen` prop type mismatch — component requires props that `App` does not pass

**File:** `src/ui/screens/game-screen.tsx:39-60` vs `src/app.tsx:54-63`

**Issue:** `GameScreen`'s `GameScreenProps` type declares `dialogueState`, `combatState`, `questState`, and `questTemplates` as required (non-optional) fields. However `App` passes only `gameState`, `playerState`, `sceneState`, and `onSetGamePhase`. TypeScript will reject this, but the more important concern is runtime: if the component is ever rendered without these required props, it will throw or silently render incorrect state. The `App` component is the sole top-level consumer and does not import or pass these stores.

**Fix:** Either make the missing props optional with safe defaults in `GameScreen`, or wire the missing stores through `App` → `AppInner` → `GameScreen` as was apparently done for the other three stores. This is likely an incomplete wiring issue from a prior phase.

---

### WR-05: `streamNarration` does not record usage on all retry paths

**File:** `src/ai/roles/narrative-director.ts:69-80`

**Issue:** In `streamNarration`, `recordUsage` is called only after successfully consuming the full stream (line 73). If the stream throws partway through (after some chunks have been yielded), the catch block at line 75 discards the partial usage. On the final retry failure (line 77), the fallback narration is yielded but `recordUsage` is never called. The cost store therefore under-counts tokens when streams fail mid-flight.

This is a secondary concern relative to WR-01, but in a billing/cost-tracking feature it can cause confusing discrepancies in `/cost` output.

**Fix:** In the final failure branch, emit a zero-usage record or log a warning that usage data was lost:

```typescript
if (attempt === maxRetries) {
  yield getFallbackNarration(context.sceneType);
  // Usage not available for failed stream — emit zero to keep cost store consistent
  recordUsage('narrative-director', { inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  return;
}
```

---

## Info

### IN-01: `save-migrator.ts` — `buildMetaFromV1` is defined but not exported; ordering of migration functions is reversed from application order

**File:** `src/persistence/save-migrator.ts:5-19`

**Issue:** `buildMetaFromV1` is a private helper used only by `migrateV1ToV2`, which is fine. However the three migration functions are declared in order V2→V3, V3→V4, V1→V2. The application order (V1→V2→V3→V4) is reversed in the source. This makes the file harder to follow when adding future migrations.

**Fix:** Reorder the functions in ascending version order: `migrateV1ToV2`, `migrateV2ToV3`, `migrateV3ToV4`.

---

### IN-02: Magic numbers in `replay-panel.tsx` and `status-bar.tsx` should be named constants

**File:** `src/ui/panels/replay-panel.tsx:11-13`, `src/ui/panels/status-bar.tsx:54-74`

**Issue:** Width breakpoints in `status-bar.tsx` (45, 55, 65, 85) and the string truncation width of 45 in `replay-panel.tsx` are bare literals with no explanation. In `status-bar.tsx` specifically, four different breakpoints each gate a different field — these would be more maintainable as named constants explaining what each breakpoint represents.

**Fix:**
```typescript
const BREAKPOINT_SHOW_GOLD = 45;
const BREAKPOINT_SHOW_LOCATION = 55;
const BREAKPOINT_SHOW_QUEST = 65;
const BREAKPOINT_SHOW_TOKENS = 85;
```

---

### IN-03: `app.tsx` — `Object.assign(draft, newPlayerState)` is a mutation anti-pattern

**File:** `src/app.tsx:35`

**Issue:** `Object.assign(draft, newPlayerState)` inside an Immer `setState` producer is the correct Immer pattern (mutating the draft), so this is not a bug. However it is inconsistent with the rest of the codebase where direct property assignment is used (e.g. `draft.phase = ...`). For complex objects with nested fields, `Object.assign` may silently leave stale fields if `newPlayerState` omits any keys that were previously set.

**Fix:** Consider using explicit field assignments or a full replacement: `return { ...draft, ...newPlayerState };` (return value replaces the entire draft in Immer).

---

### IN-04: `summarizer-worker.ts` — module-level mutable arrays escape the store pattern

**File:** `src/ai/summarizer/summarizer-worker.ts:15-16`

**Issue:** `recentChapterSummaries` and `recentTurnCompressBlocks` are plain mutable `string[]` arrays at module level. They are mutated via `.push()` inside `dispatchTask`. This bypasses the store pattern used everywhere else and makes the data invisible to subscribers, untestable via store snapshots, and impossible to restore on save/load. The rest of the codebase consistently uses `createStore` for shared state.

**Fix:** Move these arrays into a dedicated store (e.g., `summarizerResultStore`) using `createStore`, consistent with how other state is managed. This also enables serialization of summarizer output if needed in future save formats.

---

_Reviewed: 2026-04-22T00:00:00Z_
_Reviewer: Ducc (gsd-code-reviewer)_
_Depth: standard_
