---
phase: 04-differentiation
plan: 05
subsystem: ai-epistemic
tags: [epistemic, npc-filter, cognitive-envelope, context-assembler]
dependency_graph:
  requires: [04-01, 04-04]
  provides: [epistemic-tagger, npc-knowledge-filter, cognitive-envelope-assembler]
  affects: [ai-narration, npc-dialogue]
tech_stack:
  added: []
  patterns: [cognitive-context-envelope, epistemic-tagging, 6-dimension-npc-filter]
key_files:
  created:
    - src/ai/utils/epistemic-tagger.ts
    - src/ai/utils/npc-knowledge-filter.ts
    - src/ai/utils/npc-knowledge-filter.test.ts
    - src/ai/utils/context-assembler.test.ts
  modified:
    - src/ai/utils/context-assembler.ts
decisions:
  - "NPC Actor receives only scene_visible + npc_memory + npc_belief (filtered by sourceId)"
  - "Narrative Director receives world_truth + scene_visible + player_knowledge (no npc_memory)"
  - "known_by whitelist is checked first; forbidden visibility is a hard exclusion"
  - "hidden visibility entries accessible via faction/profession inference in known_by"
metrics:
  duration: "4m"
  completed: "2026-04-22T05:07:30Z"
  tasks_completed: 2
  tasks_total: 2
  test_count: 27
  files_changed: 5
---

# Phase 4 Plan 5: Epistemic Separation System Summary

Cognitive Context Envelope with 5-level epistemic tagging + 6-dimension NPC knowledge filter enforcing that NPCs never receive world_truth or player_knowledge.

## What Was Built

### Epistemic Tagger (`src/ai/utils/epistemic-tagger.ts`)
- 5 epistemic levels: `world_truth`, `npc_belief`, `player_knowledge`, `scene_visible`, `npc_memory`
- `tagContextChunk()` -- attaches epistemic level to any content string
- `buildCognitiveEnvelope()` -- partitions tagged chunks into typed envelope
- `filterForNpcActor()` -- returns only scene_visible + matching NPC's npc_memory + npc_belief
- `filterForNarrativeDirector()` -- returns world_truth + scene_visible + player_knowledge

### NPC Knowledge Filter (`src/ai/utils/npc-knowledge-filter.ts`)
6-dimension codex filtering per D-11:
1. **known_by whitelist** -- explicit NPC ID match (overrides all other checks including forbidden)
2. **Visibility gate** -- forbidden/secret/hidden hard-exclude unless whitelisted
3. **Faction/profession inference** -- faction IDs and profession in known_by grant hidden access
4. **Scope-based** -- regional/global/kingdom_wide + public = accessible
5. **NPC memory** -- handled externally via npc_memory chunks
6. **Scene visibility** -- handled externally via scene_visible chunks

### Context Assembler Upgrade (`src/ai/utils/context-assembler.ts`)
- `assembleFilteredNpcContext()` -- wraps existing `assembleNpcContext` with epistemic filtering, returns backward-compatible NpcContext + filtered chunks
- `assembleNarrativeContextWithEnvelope()` -- wraps existing `assembleNarrativeContext` with CognitiveContextEnvelope, pulls player knowledge from PlayerKnowledgeStore
- **Original functions unchanged** -- `assembleNarrativeContext` and `assembleNpcContext` signatures preserved

## Test Results

- 27 new tests (18 for epistemic tagger + NPC filter, 9 for context assembler)
- Full suite: **529 tests, 0 failures**

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Epistemic tagger + NPC knowledge filter (TDD) | d2bb8aa | epistemic-tagger.ts, npc-knowledge-filter.ts, npc-knowledge-filter.test.ts |
| 2 | Context assembler cognitive envelope upgrade | fd1b4ec | context-assembler.ts, context-assembler.test.ts |

## Deviations from Plan

None -- plan executed exactly as written.

## Threat Surface Scan

No new threat flags. The epistemic filter is the mitigation for T-04-12 and T-04-13:
- T-04-12: `filterCodexForNpc` enforces 6-dimension filtering before NPC Actor prompt
- T-04-13: `filterForNpcActor` excludes world_truth and player_knowledge entirely

## Self-Check: PASSED

- All 5 key files exist on disk
- Commits d2bb8aa and fd1b4ec verified in git log
- 529 tests pass, 0 failures
