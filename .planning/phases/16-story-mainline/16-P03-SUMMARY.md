---
phase: 16
plan: P03
subsystem: quest-schema, quest-system, world-data
tags: [quest, branching, yaml, schema]
dependency_graph:
  requires: []
  provides: [conditional_next_stages schema, resolveNextStage logic, 6-stage quest_main_01]
  affects: [src/codex/schemas/entry-types.ts, src/engine/quest-system.ts, world-data/codex/quests.yaml]
tech_stack:
  added: []
  patterns: [conditional flag branching, first-match-wins resolution]
key_files:
  created: []
  modified:
    - src/codex/schemas/entry-types.ts
    - src/engine/quest-system.ts
    - src/engine/quest-system.test.ts
    - world-data/codex/quests.yaml
decisions:
  - resolveNextStage reads flags at advancement time (not at accept time), so flags set during stage play route correctly
  - condition_value uses strict equality; truthy-only check when condition_value is omitted
  - stage_allies_decision default nextStageId is stage_consequence_harmony (covers missing-flag case)
  - Stage 2 trigger uses single location_entered/loc_abandoned_camp; OR-with-beggar is an objective note only
metrics:
  duration: ~15 minutes
  completed: 2026-04-29
---

# Phase 16 Plan P03: QuestStageSchema conditional_next_stages + quest_main_01 6-Stage Arc Summary

**One-liner:** `ConditionalNextStageSchema` + `resolveNextStage` added; `quest_main_01` expanded from 3 stages to 8-stage structure (5 linear + 3 branching endings) with flag-driven routing at `stage_allies_decision`.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Added `ConditionalNextStageSchema` and `conditional_next_stages` field to `QuestStageSchema` | 9d48f6b |
| 2 | Added `resolveNextStage` to `quest-system.ts`; replaced bare `stage.nextStageId` in `checkAndAdvance`; added 5 new tests | 9d48f6b |
| 3 | Replaced `quest_main_01` 3-stage block with 8-stage arc; updated side-quest descriptions with mainline bindings | 9d48f6b |

## Tests

- `bun test src/engine/quest-system.test.ts`: **22 pass, 0 fail** (was 12 before this plan)
- YAML smoke test (`loadAllCodex`): **OK**
- New test cases added:
  - conditional flag matches → routes to specified stage
  - no matching flag → falls back to `nextStageId`
  - `condition_value` exact match routes correctly
  - `condition_value` mismatch falls back
  - linear advancement (no `conditional_next_stages`) still works

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The 8 quest stages are fully declared with objectives, triggers, and routing logic. Flag accumulation (`justice_score_locked`, `shadow_score_locked`, `pragmatism_score_locked`) is left to P04 dialogue handlers as specified.

## Threat Flags

None. Schema and YAML changes introduce no new network endpoints or trust boundaries.

## Self-Check: PASSED

- `src/codex/schemas/entry-types.ts` — ConditionalNextStageSchema present, QuestStageSchema has `conditional_next_stages` field
- `src/engine/quest-system.ts` — `resolveNextStage` function present, `checkAndAdvance` uses it
- `world-data/codex/quests.yaml` — all 8 stage IDs present: stage_rumor, stage_disappearances, stage_truth_in_forest, stage_mayor_secret, stage_allies_decision, stage_consequence_justice, stage_consequence_harmony, stage_consequence_shadow
- commit `9d48f6b` exists
