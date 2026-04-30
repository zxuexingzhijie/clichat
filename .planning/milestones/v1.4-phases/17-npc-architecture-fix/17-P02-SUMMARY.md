---
phase: "17"
plan: P02
subsystem: engine/rules-engine, engine/dialogue-manager, ai/schemas
tags: [npc, rules-engine, architecture-fix, tdd, bug-fix]
dependency_graph:
  requires: [P01]
  provides: [adjudicateTalkResult, TalkResult, NpcSentiment-export]
  affects:
    - src/engine/rules-engine.ts
    - src/engine/rules-engine.test.ts
    - src/engine/dialogue-manager.ts
    - src/engine/dialogue-manager.test.ts
    - src/ai/schemas/npc-dialogue.ts
tech_stack:
  added: []
  patterns: [rules-engine-boundary, pure-function-adjudication]
key_files:
  created: []
  modified:
    - src/engine/rules-engine.ts
    - src/engine/rules-engine.test.ts
    - src/engine/dialogue-manager.ts
    - src/engine/dialogue-manager.test.ts
    - src/ai/schemas/npc-dialogue.ts
decisions:
  - "adjudicateTalkResult wraps sentimentToDelta — keeps Rules Engine as sole owner of relationship delta logic; future caps/quest-flag modifiers can be added in one place"
  - "NpcSentiment inferred via NpcDialogue['sentiment'] — avoids duplicating the enum definition"
  - "replace_all used for sentimentToDelta substitution since both call sites are syntactically identical"
metrics:
  duration: "3 minutes"
  completed: "2026-04-30"
  tasks_completed: 2
  files_modified: 5
---

# Phase 17 Plan P02: NPC Architecture Fix — adjudicateTalkResult Boundary Summary

**One-liner:** Enforce Rules Engine boundary for LLM sentiment→relationship-delta by adding `adjudicateTalkResult` to rules-engine.ts and routing both dialogue-manager call sites through it.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for adjudicateTalkResult | f075552 | rules-engine.test.ts |
| 1 (GREEN) | Add adjudicateTalkResult + NpcSentiment export | 9440598 | rules-engine.ts, npc-dialogue.ts |
| 2 (RED) | Integration tests for dialogue-manager | 14916ec | dialogue-manager.test.ts |
| 2 (GREEN) | Replace sentimentToDelta with adjudicateTalkResult | 835eb4e | dialogue-manager.ts |

## What Was Built

**Task 1 — rules-engine.ts + npc-dialogue.ts:**
- Exported `NpcSentiment` type from `npc-dialogue.ts` as `NpcDialogue['sentiment']`
- Added `import { sentimentToDelta } from './reputation-system'` to rules-engine.ts
- Added `import type { NpcSentiment } from '../ai/schemas/npc-dialogue'` to rules-engine.ts
- Added `TalkResult = { readonly relationshipDelta: number }` type
- Added `adjudicateTalkResult(sentiment: NpcSentiment): TalkResult` pure function
- 5 new tests: all 4 sentiment values + field-shape check

**Task 2 — dialogue-manager.ts:**
- Removed `sentimentToDelta` from reputation-system import line
- Added `import { adjudicateTalkResult } from './rules-engine'`
- Replaced both `sentimentToDelta(npcDialogue.sentiment)` calls (lines ~487 and ~596) with:
  ```typescript
  const talkResult = adjudicateTalkResult(npcDialogue.sentiment);
  const newRelationship = state.relationshipValue + talkResult.relationshipDelta;
  ```
- 4 new integration tests covering positive/hostile via processPlayerResponse and negative/neutral via processPlayerFreeText

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `await import()` inside `describe` block not supported by bun test**
- **Found during:** Task 1 RED phase execution
- **Issue:** Plan suggested `const { adjudicateTalkResult } = await import("./rules-engine.ts")` inside the describe block, which bun rejects with "await can only be used inside an async function"
- **Fix:** Added `adjudicateTalkResult` to the existing top-level static import: `import { resolveAction, adjudicateTalkResult } from "./rules-engine.ts"`
- **Files modified:** src/engine/rules-engine.test.ts
- **Commit:** f075552 (included in RED commit)

## Known Stubs

None.

## Threat Flags

None — this plan closes threat T-17P02-02 (LLM output directly mutating game state). `adjudicateTalkResult` now sits between LLM sentiment output and `relationshipValue` state change, fulfilling the CLAUDE.md boundary: "AI does NOT decide whether relationships change — the Rules Engine owns those decisions."

## Self-Check: PASSED

- [x] src/engine/rules-engine.ts — exports `TalkResult` and `adjudicateTalkResult`
- [x] src/ai/schemas/npc-dialogue.ts — exports `NpcSentiment`
- [x] src/engine/rules-engine.test.ts — 5 new adjudicateTalkResult tests pass (18 total)
- [x] src/engine/dialogue-manager.ts — `sentimentToDelta` removed, `adjudicateTalkResult` appears 3 times
- [x] src/engine/dialogue-manager.test.ts — 4 new integration tests pass (31 total)
- [x] Full suite: 1079 pass, 0 fail
- [x] Commit f075552 — RED test (rules-engine)
- [x] Commit 9440598 — GREEN impl (rules-engine + npc-dialogue)
- [x] Commit 14916ec — RED test (dialogue-manager)
- [x] Commit 835eb4e — GREEN impl (dialogue-manager)
