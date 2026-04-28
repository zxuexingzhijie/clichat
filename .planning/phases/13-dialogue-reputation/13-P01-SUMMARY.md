---
phase: 13-dialogue-reputation
plan: P01
subsystem: engine/reputation + engine/dialogue + ui/panels + codex/schemas
tags: [reputation, dialogue, npc, faction, bug-fix]
dependency_graph:
  requires: []
  provides: [integer-sentiment-deltas, faction-reputation-write, npc-faction-schema]
  affects: [src/engine/reputation-system.ts, src/engine/dialogue-manager.ts, src/ui/panels/dialogue-panel.tsx, src/codex/schemas/entry-types.ts]
tech_stack:
  added: []
  patterns: [immutable-state-update, clamped-numeric-range]
key_files:
  created: []
  modified:
    - src/engine/reputation-system.ts
    - src/engine/reputation-system.test.ts
    - src/codex/schemas/entry-types.ts
    - src/engine/dialogue-manager.ts
    - src/engine/dialogue-manager.test.ts
    - src/ui/panels/dialogue-panel.tsx
    - src/engine/sentiment-mapping.test.ts
decisions:
  - "sentimentToDelta returns integer deltas (10/0/-10/-20) to match NpcDispositionSchema -100..+100 scale"
  - "startDialogue sets relationshipValue=0; only processPlayerResponse accumulates delta"
  - "endDialogue reads plain number from factionReputations (not {value}), consistent with RelationStateSchema"
  - "sentiment-mapping.test.ts updated to reflect corrected integer expectations (those were the buggy values)"
metrics:
  duration: ~25min
  completed: "2026-04-28"
  tasks: 2
  files: 7
---

# Phase 13 Plan P01: Reputation Integer Scale + Faction Delta + NpcSchema Faction Field Summary

Integer-scale sentimentToDelta (10/0/-10/-20), faction reputation write path in endDialogue, and NpcSchema faction field — unifying the reputation scale across all dialogue components.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix sentimentToDelta integers + add applyFactionReputationDelta | d35c1ca | reputation-system.ts, reputation-system.test.ts |
| 2 | NpcSchema faction + clean dialogue-panel + fix startDialogue + wire faction delta | 9f1cd0f | entry-types.ts, dialogue-panel.tsx, dialogue-manager.ts, dialogue-manager.test.ts, sentiment-mapping.test.ts |

## What Was Done

**Task 1 — reputation-system.ts:**
- `SENTIMENT_DELTAS`: `positive: 0.2 → 10`, `negative: -0.2 → -10`, `hostile: -0.4 → -20`
- Added `applyFactionReputationDelta(store, factionId, delta)` — writes clamped number to `store.factionReputations[factionId]`
- Added new import: `Store<RelationState>` from `create-store` / `relation-store`

**Task 2 — four files:**
- `NpcSchema`: added `faction: z.string().optional()`
- `dialogue-panel.tsx`: deleted `relationshipLabel` function, imported `getAttitudeLabel` from reputation-system, updated call site
- `dialogue-manager.ts`: `startDialogue` now sets `draft.relationshipValue = 0`; `QUEST_GOAL_KEYWORDS` extended with `调查/寻找/找到/招募/发现/追踪/揭露`; `endDialogue` calls `applyFactionReputationDelta` when `npc.faction` is set
- `sentiment-mapping.test.ts`: updated from float expectations to integer expectations (fixing the test that documented the bug)

## Test Results

```
906 pass, 1 fail (pre-existing unrelated: use-game-input.test.ts)
bun tsc --noEmit: 0 errors
```

New tests added: 9 (5 sentimentToDelta + 4 applyFactionReputationDelta in reputation-system.test.ts; 4 new dialogue-manager tests)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated stale sentiment-mapping.test.ts expectations**
- **Found during:** Task 2 full suite run
- **Issue:** `src/engine/sentiment-mapping.test.ts` asserted old float values (0.2, -0.2, -0.4) — these were the bug values being fixed
- **Fix:** Updated all 4 expectations to integer scale (10, -10, -20)
- **Files modified:** src/engine/sentiment-mapping.test.ts
- **Commit:** 9f1cd0f

**2. [Rule 1 - Bug] Fixed existing endDialogue test to use processPlayerResponse**
- **Found during:** Task 2 test run
- **Issue:** Existing test "endDialogue flushes non-zero relationshipValue delta" called `endDialogue` immediately after `startDialogue`. With the fix that `startDialogue` sets `relationshipValue=0`, the greeting sentiment no longer contributes to delta, so nothing was written. The test was testing the old (buggy) behavior.
- **Fix:** Updated test to call `processPlayerResponse(0)` after `startDialogue` to generate a real delta before `endDialogue`
- **Files modified:** src/engine/dialogue-manager.test.ts
- **Commit:** 9f1cd0f

## Known Stubs

None — all implemented paths are fully wired.

## Threat Flags

None — `applyFactionReputationDelta` clamps to [-100, 100] (T-13P01-01 mitigated). `faction` field is non-secret metadata (T-13P01-02 accepted).

## Self-Check: PASSED

- `src/engine/reputation-system.ts` — FOUND, exports `applyFactionReputationDelta`
- `src/codex/schemas/entry-types.ts` — FOUND, contains `faction: z.string().optional()`
- `src/engine/dialogue-manager.ts` — FOUND, `relationshipValue = 0` in startDialogue, Chinese keywords present, faction write in endDialogue
- `src/ui/panels/dialogue-panel.tsx` — FOUND, no `relationshipLabel`, uses `getAttitudeLabel`
- Commits d35c1ca and 9f1cd0f — FOUND in git log
