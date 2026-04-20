---
phase: 01-foundation
plan: 05
subsystem: input
tags: [commander, ai-sdk, zod, intent-classification, input-routing, dual-input]

requires:
  - phase: 01-foundation
    plan: 01
    provides: types (GameAction, Intent schemas)

provides:
  - Commander.js in-process command parser with exitOverride
  - AI SDK v5 NL intent classifier with Zod validation
  - Input router with / prefix detection and confidence gating
  - 12 game commands (look, go, talk, attack, inspect, use_item, cast, guard, flee, trade, help, save)

affects: [01-06]

tech-stack:
  added: []
  patterns: [commander-exitOverride, generateObject-schema-validation, retry-on-failure, prefix-based-routing]

key-files:
  created:
    - src/input/command-parser.ts
    - src/input/command-registry.ts
    - src/input/intent-classifier.ts
    - src/input/input-router.ts
    - src/input/command-parser.test.ts
    - src/input/intent-classifier.test.ts
  modified: []

key-decisions:
  - "Commander.js program is recreated per-parse with exitOverride() and silenced output to prevent process.exit"
  - "Intent classifier uses AI SDK v5 generateObject with IntentSchema for type-safe LLM output"
  - "Retry logic: max 1 retry on schema validation failure before throwing"
  - "CONFIDENCE_THRESHOLD = 0.3 for clarification flow"
  - "Input router: / prefix -> command parser, else -> NL intent classifier"
  - "ClassifyIntentOptions allows model injection for testing and provider flexibility"

patterns-established:
  - "Command parser factory: createCommandParser() returns immutable CommandParser interface"
  - "Input routing: prefix detection -> typed union result (success | clarification | error)"
  - "LLM integration: generateObject + Zod schema = validated structured output"

requirements-completed: [CORE-01, CORE-02]

duration: ~15min
completed: 2026-04-20
---

# Phase 01 Plan 05: Dual-Input System Summary

**Commander.js command parser (12 commands), AI SDK v5 intent classifier with Zod validation, input router with / prefix detection and confidence gating**

## Performance

- **Duration:** ~15min
- **Completed:** 2026-04-20
- **Tasks:** 2 of 2 auto tasks
- **Tests:** 28 pass, 0 fail

## Accomplishments

- Built createCommandParser with Commander.js exitOverride() preventing process.exit
- Built command-registry with 12 game commands (look, go, talk, attack, inspect, use_item, cast, guard, flee, trade, help, save)
- Built classifyIntent using AI SDK v5 generateObject with IntentSchema Zod validation
- Built retry logic (max 1 retry on failure per D-26)
- Built routeInput with / prefix detection routing to command parser vs NL classifier
- Confidence gating at 0.3 threshold with clarification flow (D-27)
- All error messages in Chinese per UI-SPEC

## Files Created

- `src/input/command-parser.ts` — Commander.js in-process parser with exitOverride
- `src/input/command-registry.ts` — 12 game command definitions
- `src/input/intent-classifier.ts` — AI SDK v5 NL intent classification
- `src/input/input-router.ts` — Routes / commands vs NL text
- `src/input/command-parser.test.ts` — 14 tests for command parsing
- `src/input/intent-classifier.test.ts` — 14 tests for intent classification + routing

## Decisions Made

- CommandParser is a readonly interface (parse method only)
- generateObject uses system prompt separation (INTENT_SYSTEM_PROMPT) from player input
- ClassifyIntentOptions accepts model override for testing flexibility
- InputResult is a discriminated union: success | clarification | error

## Deviations from Plan

None significant. Implementation follows plan exactly.

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| intent-classifier.ts | 22 | default model openai('gpt-4o-mini') | Will be configured from game settings in Phase 5 |

---
*Phase: 01-foundation*
*Completed: 2026-04-20*
