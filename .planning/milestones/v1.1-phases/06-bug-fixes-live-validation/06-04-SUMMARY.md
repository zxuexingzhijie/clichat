---
phase: 06-bug-fixes-live-validation
plan: 04
subsystem: ai/summarizer, scripts
tags: [carry-01, live-validation, cost, replay, summarizer]
key-files:
  - src/ai/summarizer/summarizer-worker.ts
  - scripts/validate-live.ts
metrics:
  tasks: 2/2
  files_changed: 2
---

# Plan 06-04 Summary: Live Validation Script (CARRY-01)

## What Changed

### Task 1: Export runNextTask() from summarizer-worker.ts
- Added `runNextTask()` — one-shot helper that dequeues, dispatches, and marks done a single task
- Uses existing `dequeuePending`, `markRunning`, `markDone`, `markFailed` from queue module
- Does not touch `runSummarizerLoop` (infinite loop left unchanged)

### Task 2: Create scripts/validate-live.ts
- Standalone Bun script (not a test file) validating three CARRY-01 features:
  1. `/cost` — calls `generateNarration`, asserts `getCostSummary()` has non-zero tokens
  2. `/replay` — calls `processInput('look')`, asserts `getLastReplayEntries()` non-empty
  3. Summarizer — calls `evaluateTriggers('save_game_completed')` then `runNextTask()`, asserts task processed
- API keys logged as 'set'/'MISSING' only (D-13: never log actual values)
- Exit code 0 on success, 1 on failure

## Commits

| Hash | Description |
|------|-------------|
| `8270454` | feat(06-04): export runNextTask() from summarizer-worker |
| `a860e70` | feat(06-04): add CARRY-01 live validation script |

## Deviations

- Executor got stuck on permissions; orchestrator completed Task 2 (script creation) directly.

## Self-Check: PASSED

- [x] `runNextTask()` exported from summarizer-worker.ts
- [x] `scripts/validate-live.ts` exists and compiles
- [x] Script not picked up by `bun test`
- [x] `bun test` — 664 pass, 0 fail (no regressions)
