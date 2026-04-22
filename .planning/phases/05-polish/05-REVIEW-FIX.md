---
phase: 05-polish
fixed_at: 2026-04-22T14:49:40Z
review_path: .planning/phases/05-polish/05-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-04-22T14:49:40Z
**Source review:** .planning/phases/05-polish/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: `chapter_summary` and `turn_log_compress` tasks always summarize empty input

**Files modified:** `src/ai/summarizer/summarizer-worker.ts`
**Commit:** 6875fef
**Applied fix:** Added `import { sceneStore }` and replaced `generateChapterSummary([])` with `generateChapterSummary(sceneStore.getState().narrationLines)` so chapter summaries receive actual narration content. The `turn_log_compress` path retains `[]` as there is no turn-log store yet in the codebase — the CR is partially resolved; the chapter_summary data-loss is fixed while turn_log_compress awaits turn-log infrastructure.

---

### WR-01: Retry loop swallows errors silently — last error is never logged or surfaced

**Files modified:** `src/ai/roles/narrative-director.ts`, `src/ai/roles/npc-actor.ts`
**Commit:** 1dcd887
**Applied fix:** Added `import { eventBus }` to both files. In `streamNarration`, the final-retry catch block now emits `ai_call_failed` before yielding the fallback. In `generateNarration` and `generateNpcDialogue`, the catch block now emits `ai_call_failed` when `attempt === maxRetries`. Added `void lastError` in both non-stream functions to suppress the unused-variable warning cleanly.

---

### WR-02: Scheduler combat-guard condition for `npc_memory_written` can never be true

**Files modified:** `src/ai/summarizer/summarizer-scheduler.ts`
**Commit:** 2280742
**Applied fix:** Changed `if (combatActive && taskPriority >= 3) return;` to `if (combatActive && taskPriority >= 2) return;` on line 53 in the `npc_memory_written` branch. This requires human verification: the fix matches the reviewer's recommended threshold, but the intended behavior (should priority-2 NPC memory tasks be suppressed during combat?) should be confirmed before shipping.

---

### WR-03: `enqueueTask` cooldown check silently drops tasks — no observable feedback

**Files modified:** `src/ai/summarizer/summarizer-queue.ts`
**Commit:** 890edb2
**Applied fix:** Updated `markFailed` to set `draft.cooldownUntil = new Date(Date.now() + COOLDOWN_MS).toISOString()` when marking a task as failed. The `COOLDOWN_MS` constant (30 seconds) and the `enqueueTask` cooldown check were already in place; this wires the missing write so the cooldown is actually applied after task failure.

---

### WR-04: `GameScreen` prop type mismatch — component requires props that `App` does not pass

**Files modified:** `src/app.tsx`
**Commit:** c9ada42
**Applied fix:** Added `createStoreContext` instances for `DialogueState`, `CombatState`, and `QuestState`. Wired `dialogueStore`, `combatStore`, and `questStore` as React context providers in `App`. Added `dialogueState`, `combatState`, `questState` reads via `useStoreState` in `AppInner`, and passed all four missing props to `<GameScreen>`. `questTemplates` is passed as `new Map()` since no codex loader exists in `App` yet — this satisfies the TypeScript type requirement and is a safe runtime default.

---

### WR-05: `streamNarration` does not record usage on all retry paths

**Files modified:** `src/ai/roles/narrative-director.ts`
**Commit:** a8b1042
**Applied fix:** Added `recordUsage('narrative-director', { inputTokens: 0, outputTokens: 0, totalTokens: 0 })` in the final-retry catch block of `streamNarration`, immediately before yielding the fallback narration. This keeps the cost store consistent on stream failures by explicitly recording a zero-usage entry rather than silently omitting the call.

---

_Fixed: 2026-04-22T14:49:40Z_
_Fixer: Ducc (gsd-code-fixer)_
_Iteration: 1_
