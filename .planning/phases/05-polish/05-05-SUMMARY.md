---
phase: 05-polish
plan: "05"
subsystem: ai
tags: [summarizer, background-tasks, queue, scheduler, worker, atomic-write, version-check, llm, chinese]

requires:
  - phase: 05-01
    provides: NpcMemoryRecordSchema with version field, DomainEvents token_usage_updated + summarizer_task_completed
  - phase: 05-03
    provides: recordUsage in cost-session-store.ts

provides:
  - SummarizerTask type + SummarizerQueueStore with priority-sorted async queue
  - SummarizerScheduler: event-driven trigger evaluation with combat gate + debounce
  - SummarizerWorker: non-blocking async loop + atomic version-checked write-back
  - MemorySummarizer AI role: generateNpcMemorySummary/generateChapterSummary/generateTurnLogCompress
  - Summarizer prompt templates for NPC memory, chapter, and turn log compression (Chinese)

affects:
  - game-loop (can call runSummarizerLoop on init)
  - npc-memory-store (version field used by atomic write-back)
  - cost-session-store (recordUsage called for summarizer role)

tech-stack:
  added: []
  patterns:
    - "Priority-sorted async queue with dedup: enqueueTask skips same targetId+type with pending status"
    - "Atomic version-checked write-back: record.version !== task.baseVersion → conflict, no overwrite"
    - "Event-driven scheduler: eventBus.on wired at module init for npc_memory_written/save_game_completed"
    - "Non-blocking background loop: void runSummarizerLoop() with 5s sleep between polls"
    - "Combat gate: skip priority >= 3 tasks when combatStore.getState().active === true"

key-files:
  created:
    - src/ai/summarizer/summarizer-queue.ts
    - src/ai/summarizer/summarizer-scheduler.ts
    - src/ai/summarizer/summarizer-worker.ts
    - src/ai/summarizer/summarizer-prompts.ts
    - src/ai/roles/memory-summarizer.ts
    - src/ai/summarizer/summarizer-queue.test.ts
    - src/ai/summarizer/summarizer-scheduler.test.ts
    - src/ai/summarizer/summarizer-worker.test.ts
  modified: []

key-decisions:
  - "On version conflict in applyNpcMemoryCompression, markFailed and do NOT re-queue — preserves original NPC memories"
  - "Scheduler debounce applies only to 'interval' trigger source, not event-driven triggers"
  - "chapter_summary and turn_log_compress tasks store results in module-level arrays (stub for future display)"
  - "Combat gate skips priority >= 3 (low) tasks; priority 1 (high) from save_game_completed fires regardless"

patterns-established:
  - "Summarizer pattern: createStore for queue state, priority sort ascending (1=high), dedup by targetId+type+pending"
  - "TDD pattern maintained: RED (failing tests) → GREEN (implementation) → all 24 tests pass"

requirements-completed: [AI-04]

duration: 7min
completed: 2026-04-22
---

# Phase 05 Plan 05: Background Summarizer Summary

**Priority-sorted async summarizer queue with combat-gated scheduler, atomic version-checked NPC memory write-back, and three Chinese LLM compression roles (NPC memory, chapter, turn log)**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-22T11:25:54Z
- **Completed:** 2026-04-22T11:32:56Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- SummarizerQueueStore with priority-sorted task list, dedup by targetId+type, markRunning/Done/Failed helpers
- SummarizerScheduler evaluates triggers from events, gates on combatStore.active for low-priority tasks, debounces interval calls within 5s
- SummarizerWorker runSummarizerLoop non-blocking async loop (5s sleep); applyNpcMemoryCompression with exact version check before write-back
- MemorySummarizer AI role (generateNpcMemorySummary/generateChapterSummary/generateTurnLogCompress) using summarizer role config + recordUsage

## Task Commits

Each task was committed atomically:

1. **Task 1: SummarizerQueue store and SummarizerScheduler** - `8a0867f` (feat)
2. **Task 2: SummarizerWorker, prompts, MemorySummarizer AI role** - `d4443bf` (feat)

**Plan metadata:** (docs commit below)

_Note: Both tasks used TDD: RED (missing module error) → GREEN (implementation passing all tests)_

## Files Created/Modified
- `src/ai/summarizer/summarizer-queue.ts` - SummarizerTask type, summarizerQueueStore, enqueueTask/dequeuePending/markRunning/markDone/markFailed
- `src/ai/summarizer/summarizer-scheduler.ts` - evaluateTriggers with combat gate, NPC memory threshold, debounce; event listeners at module init
- `src/ai/summarizer/summarizer-worker.ts` - runSummarizerLoop (non-blocking), applyNpcMemoryCompression (atomic version check), dispatchTask router
- `src/ai/summarizer/summarizer-prompts.ts` - buildNpcMemoryCompressPrompt, buildChapterSummaryPrompt, buildTurnLogCompressPrompt (Chinese output)
- `src/ai/roles/memory-summarizer.ts` - generateNpcMemorySummary, generateChapterSummary, generateTurnLogCompress via AI SDK
- `src/ai/summarizer/summarizer-queue.test.ts` - 13 tests: enqueue, dedup, priority sort, markDone event
- `src/ai/summarizer/summarizer-scheduler.test.ts` - 7 tests: combat gate, NPC threshold, debounce, save trigger
- `src/ai/summarizer/summarizer-worker.test.ts` - 4 tests: conflict on version mismatch, conflict on missing NPC, applied on match, slice verification

## Decisions Made
- Version conflict in applyNpcMemoryCompression → markFailed, no re-queue (preserve originals per T-05-10 mitigation)
- Debounce (5s) applies only to 'interval' trigger, not event-driven sources — event triggers always evaluate
- Combat gate (combatStore.active) skips priority >= 3 tasks; priority 1 (chapter_summary on save) always fires
- chapter_summary and turn_log_compress results stored in module-level arrays as stubs; game-screen can read via getters

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Summarizer system ready; game-loop can call `void runSummarizerLoop()` at startup
- SummarizerScheduler event listeners auto-register on import; no explicit init needed
- Chapter/turn-log compression results accessible via getRecentChapterSummaries/getRecentTurnCompressBlocks stubs

---
*Phase: 05-polish*
*Completed: 2026-04-22*

## Self-Check: PASSED

- [x] src/ai/summarizer/summarizer-queue.ts exists
- [x] src/ai/summarizer/summarizer-scheduler.ts exists
- [x] src/ai/summarizer/summarizer-worker.ts exists
- [x] src/ai/summarizer/summarizer-prompts.ts exists
- [x] src/ai/roles/memory-summarizer.ts exists
- [x] Task 1 commit 8a0867f exists
- [x] Task 2 commit d4443bf exists
- [x] 637 tests pass, 0 failures
