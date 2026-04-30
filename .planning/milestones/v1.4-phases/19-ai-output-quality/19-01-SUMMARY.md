---
phase: 19-ai-output-quality
plan: "01"
subsystem: ai
tags: [zod, generateObject, narration, ai-caller, schema-validation]

requires:
  - phase: 17-npc-architecture-fix
    provides: callGenerateObject pattern in ai-caller.ts

provides:
  - NarrationOutputSchema (z.string min10 max300) in src/ai/schemas/narration-output.ts
  - generateNarration uses callGenerateObject — schema-enforced bounds, no manual slice guards

affects: [19-02, 19-03, narrative-director callers, game-loop]

tech-stack:
  added: []
  patterns:
    - "Zod schema file per AI role output: src/ai/schemas/{role}-output.ts"
    - "callGenerateObject replaces callGenerateText when output shape is structured"

key-files:
  created:
    - src/ai/schemas/narration-output.ts
  modified:
    - src/ai/roles/narrative-director.ts
    - src/ai/roles/narrative-director.test.ts

key-decisions:
  - "D-01: NarrationOutputSchema enforces min(10)/max(300) — Zod rejects out-of-range text, triggering fallback via catch block"
  - "D-02: streamNarration untouched — only generateNarration moves to generateObject (streaming stays as callStreamText)"
  - "D-03: generateNarration return type stays Promise<string> — callers unchanged"

patterns-established:
  - "Narration output schema: single-field z.object({ text }) with describe label"
  - "Out-of-range LLM output handled by schema rejection + catch fallback, not manual length guards"

requirements-completed: [AI-05]

duration: 3min
completed: 2026-04-30
---

# Phase 19 Plan 01: Narration Output Schema Summary

**`generateNarration` migrated from `callGenerateText` to `callGenerateObject` with `NarrationOutputSchema` (z.string min10/max300), replacing brittle manual slice/length guards with Zod schema enforcement**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-30T07:28:24Z
- **Completed:** 2026-04-30T07:30:57Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments

- Created `NarrationOutputSchema` as a single-field Zod schema following the `npc-dialogue.ts` pattern
- Replaced `callGenerateText` with `callGenerateObject` in `generateNarration` — schema now enforces length bounds at the AI SDK level
- Removed `text.slice(0,300)` and `text.length < 10` manual guards entirely
- Updated 4 test cases to assert on `mockGenerateObject` (not `mockGenerateText`); `streamNarration` tests unchanged

## Task Commits

1. **Task 1: [RED] Update narrative-director.test.ts** - `9358a5b` (test)
2. **Task 2: [GREEN] Create narration-output.ts + update narrative-director.ts** - `07ec430` (feat)

**Plan metadata:** (docs commit follows)

_Note: TDD plan — RED commit precedes GREEN commit._

## Files Created/Modified

- `src/ai/schemas/narration-output.ts` — New schema file: `NarrationOutputSchema` + `NarrationOutput` type export
- `src/ai/roles/narrative-director.ts` — `generateNarration` now calls `callGenerateObject` with `NarrationOutputSchema`; `streamNarration` untouched
- `src/ai/roles/narrative-director.test.ts` — 4 generateNarration tests updated to use `mockGenerateObject`; 2 streamNarration tests unchanged

## Decisions Made

- Zod validation failure (schema rejects out-of-range text) falls through to the existing `catch` block which returns `getFallbackNarration()` — no additional error handling needed
- `callGenerateObject` already handles retry and `recordUsage` internally, so the outer retry loop was not needed

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- 6 `cost-session-store` failures observed in full suite run — confirmed pre-existing (present before Task 1 commit, caused by `5a12a78` RED tests from plan 19-02 being committed prior to this plan's execution). Tests pass in isolation. Not caused by this plan.

## Known Stubs

None — `generateNarration` returns real structured output via `callGenerateObject`.

## Threat Flags

No new threat surface introduced. `NarrationOutputSchema` enforces T-19P01-01 (max(300) limits injection surface).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `NarrationOutputSchema` pattern available as analog for future AI output schemas
- Plan 19-02 (intent-classifier cost tracking) and Plan 19-03 (summarizer AbortSignal) can proceed independently

---
*Phase: 19-ai-output-quality*
*Completed: 2026-04-30*
