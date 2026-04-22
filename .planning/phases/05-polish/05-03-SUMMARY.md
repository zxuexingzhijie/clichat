---
phase: 05-polish
plan: "03"
subsystem: ai
tags: [cost-tracking, token-usage, event-bus, createStore, ai-sdk]

requires:
  - phase: 05-01
    provides: token_usage_updated event in DomainEvents

provides:
  - CostSessionStore with recordUsage(), getCostSummary(), resetCostSession()
  - Per-role token and cost accumulation from narrative-director and npc-actor
  - Auto-reset on state_restored event

affects:
  - 05-06 (cost command reads getCostSummary())
  - status bar display (reads lastTurnTokens from costSessionStore state)

tech-stack:
  added: []
  patterns:
    - "createStore + eventBus onChange pattern for ephemeral session state"
    - "TDD RED/GREEN cycle for store implementation"

key-files:
  created:
    - src/state/cost-session-store.ts
    - src/state/cost-session-store.test.ts
  modified:
    - src/ai/roles/narrative-director.ts
    - src/ai/roles/npc-actor.ts
    - src/ai/roles/narrative-director.test.ts
    - src/ai/roles/npc-actor.test.ts

key-decisions:
  - "CostSessionState is ephemeral (not in SaveData); resets on state_restored to prevent session bleed"
  - "RoleConfig has no pricing field; estimatedCost stays 0 for all current roles — correct zero-cost behavior until pricing is added"
  - "npc-actor uses generateObject (not generateText); usage destructured from generateObject result"
  - "streamText usage awaited after stream loop (before return) per AI SDK v5 pattern"

patterns-established:
  - "Rule 1 fix: AI role test mocks must include usage field in resolved values to avoid swallowing results in catch block"

requirements-completed:
  - LLM-02

duration: 5min
completed: 2026-04-22
---

# Phase 05 Plan 03: Cost Session Store Summary

**CostSessionStore tracking per-role token usage with createStore pattern, wired into narrative-director (generateText + streamText) and npc-actor (generateObject) call sites**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-22T11:17:21Z
- **Completed:** 2026-04-22T11:22:21Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- CostSessionStore with `recordUsage()`, `getCostSummary()`, `resetCostSession()` exports using createStore pattern
- Token usage forwarded to costSessionStore after every AI call in narrative-director and npc-actor
- Auto-reset on `state_restored` event prevents cost bleed across game loads
- 7 new tests (TDD RED/GREEN), 613 total tests passing

## Task Commits

1. **Task 1 RED: failing tests** - `77ae192` (test)
2. **Task 1 GREEN: CostSessionStore implementation** - `aa95fa7` (feat)
3. **Task 2: wire usage in narrative-director and npc-actor** - `7b51a27` (feat)

## Files Created/Modified

- `src/state/cost-session-store.ts` - CostSessionStore with record/getSummary/reset; emits token_usage_updated; subscribes to state_restored
- `src/state/cost-session-store.test.ts` - 7 tests covering all behaviors including state_restored auto-reset
- `src/ai/roles/narrative-director.ts` - recordUsage('narrative-director', usage) after generateText and streamText (await result.usage after stream loop)
- `src/ai/roles/npc-actor.ts` - recordUsage('npc-actor', usage) after generateObject
- `src/ai/roles/narrative-director.test.ts` - added usage to mock return values (bug fix)
- `src/ai/roles/npc-actor.test.ts` - added usage to mock return values (bug fix)

## Decisions Made

- `RoleConfig` has no `pricing` field in providers.ts — `estimatedCost` stays 0 for all current roles. The implementation handles this gracefully via optional chaining; pricing can be added to `RoleConfig` in a future plan without changing the store logic.
- `npc-actor.ts` uses `generateObject` not `generateText` — usage destructured from `{ object, usage }`.
- `streamNarration` places `await result.usage` + `recordUsage` before the `return` inside the try block, after the stream loop completes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mocks missing usage field caused fallback path**
- **Found during:** Task 2 (AI roles test run after wiring)
- **Issue:** Existing test mocks returned `{ text: narration }` / `{ object: expected }` without a `usage` field. After destructuring `usage` and calling `recordUsage(role, usage)`, passing `undefined` as usage threw an error inside the try block, causing the catch to swallow the result and return the fallback string instead.
- **Fix:** Added `mockUsage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 }` to both test files; included `usage: mockUsage` in all `mockResolvedValueOnce` calls and default mock implementations. For streamText mock, added `usage: Promise.resolve(mockUsage)`.
- **Files modified:** `src/ai/roles/narrative-director.test.ts`, `src/ai/roles/npc-actor.test.ts`
- **Verification:** All 12 AI role tests pass after fix
- **Committed in:** `7b51a27` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in test mocks)
**Impact on plan:** Necessary correctness fix. No scope creep.

## Issues Encountered

None beyond the test mock fix above.

## Next Phase Readiness

- `getCostSummary()` ready for the `/cost` command (Plan 05-06)
- `costSessionStore.getState().lastTurnTokens` ready for status bar display
- Pricing data can be added to `RoleConfig` in providers.ts to enable cost estimation

---
*Phase: 05-polish*
*Completed: 2026-04-22*
