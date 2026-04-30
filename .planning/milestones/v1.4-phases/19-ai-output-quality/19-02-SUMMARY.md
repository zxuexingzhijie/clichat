---
phase: 19-ai-output-quality
plan: "02"
subsystem: ai
tags: [intent-classifier, ai-caller, cost-tracking, recordUsage, callGenerateObject]

requires:
  - phase: 19-ai-output-quality
    provides: callGenerateObject in ai-caller.ts (19-01 pattern established)

provides:
  - classifyIntent routes through callGenerateObject with role 'retrieval-planner'
  - Intent classification token costs now flow through recordUsage into :cost display

affects:
  - 19-03-PLAN (summarizer graceful shutdown — same phase)
  - cost-session-store (retrieval-planner role now accumulates tokens)

tech-stack:
  added: []
  patterns:
    - "classifyIntent uses getRoleConfig + callGenerateObject instead of bare generateObject"
    - "Model and retry config sourced from getRoleConfig, not inlined in options"

key-files:
  created: []
  modified:
    - src/input/intent-classifier.ts
    - src/input/intent-classifier.test.ts

key-decisions:
  - "D-05/D-06: classifyIntent calls callGenerateObject with role 'retrieval-planner' — model field removed from ClassifyIntentOptions"
  - "D-07: All intent classification token usage now flows through recordUsage and appears in :cost"
  - "Pre-existing cost-session-store test failures (6) are caused by ai-caller.test.ts mock pollution — not introduced by this plan"

patterns-established:
  - "Pattern: AI role services use getRoleConfig + callGenerateObject, never bare generateObject"

requirements-completed: [AI-06]

duration: 2min
completed: 2026-04-30
---

# Phase 19 Plan 02: Intent-Classifier Cost Tracking Summary

**classifyIntent rewritten to call callGenerateObject with role 'retrieval-planner', closing the :cost blind spot for all NL input LLM calls**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-30T10:48:38Z
- **Completed:** 2026-04-30T10:50:38Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Removed manual retry loop and bare `generateObject` import from intent-classifier.ts
- Routed classifyIntent through callGenerateObject — retry, recordUsage, and emitFailure handled centrally
- Removed `model?` field from ClassifyIntentOptions (model now sourced from getRoleConfig)
- Added new test asserting recordUsage is called with 'retrieval-planner' on success

## Task Commits

1. **Task 1: [RED] Update error assertion + add recordUsage test** - `5a12a78` (test)
2. **Task 2: [GREEN] Rewrite classifyIntent to use callGenerateObject** - `e57da60` (feat)

## Files Created/Modified

- `src/input/intent-classifier.ts` - Replaced manual retry loop + bare generateObject with callGenerateObject; removed model? option field
- `src/input/intent-classifier.test.ts` - Updated error assertion to .toThrow(Error); added mockRecordUsage mock and new recordUsage assertion test

## Decisions Made

- Removed `model?` from `ClassifyIntentOptions` per D-05 — callers that pass a custom model must now configure it via `ai-config.yaml` role overrides
- `maxRetries` default stays `1` (matches prior behaviour — 2 total attempts)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing: 6 `cost-session-store` tests fail in the full suite due to `ai-caller.test.ts` mocking `cost-session-store` globally before `cost-session-store.test.ts` runs. This was present before this plan (7 failures before, 6 after — the 7th was from 19-01 which is now fixed). No new failures introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 19-02 complete; ready for 19-03 (summarizer graceful shutdown via AbortSignal)
- All intent classification costs now visible in :cost — blind spot closed

---
*Phase: 19-ai-output-quality*
*Completed: 2026-04-30*
