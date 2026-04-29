---
phase: 16
plan: P02
subsystem: ai-prompts
tags: [narrative, npc, trust-gates, act-context, prompt-injection]
dependency_graph:
  requires: [16-P01]
  provides: [act-aware-narrative-prompt, npc-trust-disclosure, narrativeStore-wiring]
  affects: [scene-manager, dialogue-manager, npc-actor, narrative-director]
tech_stack:
  added: []
  patterns: [optional-param-backward-compat, trust-threshold-gating, store-context-injection]
key_files:
  created:
    - src/ai/prompts/narrative-system.test.ts
    - src/ai/prompts/npc-system.test.ts
    - src/state/narrative-state.ts
  modified:
    - src/ai/prompts/narrative-system.ts
    - src/ai/prompts/npc-system.ts
    - src/ai/roles/narrative-director.ts
    - src/ai/roles/npc-actor.ts
    - src/engine/scene-manager.ts
    - src/engine/scene-manager.test.ts
    - src/engine/dialogue-manager.ts
    - src/engine/dialogue-manager.test.ts
decisions:
  - NarrativePromptContext uses 'act1'|'act2'|'act3' string union matching NarrativeState.currentAct
  - trustLevel defaults to 0 so all existing callers of buildNpcSystemPrompt get surface-only behavior
  - getNarrativeContext helper in scene-manager returns undefined when no narrativeStore, keeping all call sites clean
  - getDialogueNarrativeContext helper in dialogue-manager avoids repeating store extraction at each of 3 call sites
  - narrativeContext accepted but not yet forwarded to buildNpcSystemPrompt in npc-actor (P04 adds knowledge_profile to NpcSchema and will wire trust level from relation store)
  - narrative-state.ts stub created since P01 had already run and created the real file
metrics:
  duration: ~25min
  completed: 2025-04-29
  tasks_completed: 3
  files_modified: 11
---

# Phase 16 Plan P02: AI Prompt Injection — Narrative Act Context + NPC Trust Disclosure Summary

Act-aware narrative system prompt injection and NPC trust-gated knowledge disclosure with full backward compatibility; narrativeStore wired into scene-manager and dialogue-manager call sites.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | buildNarrativeSystemPrompt act/atmosphere injection | 4d3809a | narrative-system.ts, narrative-system.test.ts |
| 2 | NpcKnowledgeProfile + trust-gated buildNpcSystemPrompt | 4d3809a | npc-system.ts, npc-system.test.ts |
| 3 | narrativeStore wiring in scene-manager + dialogue-manager | 4d3809a | scene-manager.ts, dialogue-manager.ts, npc-actor.ts, narrative-director.ts |

## What Was Built

**Task 1 — `buildNarrativeSystemPrompt` extension**

Added `NarrativePromptContext` type and optional second parameter. When provided, the function appends:
- Atmosphere tags joined with `、` and framing instruction
- Act label (第一幕/第二幕/第三幕) with per-act prose guidance from `ACT_TONE_GUIDANCE`
- Optional recent narration block with "避免重复同一词语" continuity instruction

Callers passing only `sceneType` receive identical output to before.

**Task 2 — `buildNpcSystemPrompt` trust gates**

Added `NpcTrustGate`, `NpcKnowledgeProfile` types and optional `knowledgeProfile` on `NpcProfile`. Three disclosure tiers:
- `trustLevel < 5`: surface restriction text appended
- `5 <= trustLevel <= 8`: unlocked trust_gates listed with hedging instruction
- `trustLevel > 8`: hidden_knowledge revealed with "极度不愿承认" framing

`always_knows` items appear at every trust level. `trustLevel` defaults to 0 — existing callers unchanged.

**Task 3 — narrativeStore wiring**

- `SceneManagerOptions.narrativeStore?: NarrativeStore` added; `getNarrativeContext()` helper extracts `{ storyAct, atmosphereTags }` from store or returns `undefined`
- All four `generateNarrationFn` call sites (loadScene, handleLook no-target, handleLook with-target, handleInspect) pass `narrativeContext`
- `NarrativeContext` type in `narrative-director.ts` extended with optional `narrativeContext?: NarrativePromptContext`; both `generateNarration` and `streamNarration` forward it to `buildNarrativeSystemPrompt`
- `DialogueManagerOptions.narrativeStore?: NarrativeStore` added; `getDialogueNarrativeContext()` helper used at all three `doGenerateDialogue` call sites
- `generateNpcDialogue` in `npc-actor.ts` accepts optional 6th `narrativeContext` parameter (stored for future P04 trust-level threading)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] narrative-state.ts already existed from P01**

- **Found during:** Task 3 setup
- **Issue:** Plan said to create a stub if P01 hadn't run; P01 had already run and created the full file with `NarrativeStore = Store<NarrativeState> & { restoreState }`. The `getState()` returns `NarrativeState` with `currentAct` and `atmosphereTags` matching what P02 needs.
- **Fix:** Used the real file directly; no stub needed.
- **Files modified:** none (no action required)

**2. [Rule 1 - Bug] NarrativePromptContext.storyAct type narrowing**

- **Found during:** Task 3 implementation
- **Issue:** `NarrativeState.currentAct` is typed as `'act1' | 'act2' | 'act3'` matching `NarrativePromptContext.storyAct` exactly — no cast needed. Code compiled cleanly.
- **Fix:** No fix needed; types align.

## Known Stubs

- `generateNpcDialogue` accepts `narrativeContext` as 6th arg but currently uses `trustLevel = 0` hardcoded. The `narrativeContext` parameter is stored via `void narrativeContext` — this is intentional. P04 will add `knowledge_profile` to `NpcSchema` and wire the actual trust level from the relation store into this call.

## Test Results

```
bun test src/ai/prompts/narrative-system.test.ts  → 10 pass
bun test src/ai/prompts/npc-system.test.ts        → 13 pass
bun test src/engine/scene-manager.test.ts         → 14 pass (2 new wiring tests)
bun test src/engine/dialogue-manager.test.ts      → 25 pass (2 new wiring tests)
Total: 62 pass, 0 fail
```

## Self-Check: PASSED

- `/Users/makoto/Downloads/work/cli/src/ai/prompts/narrative-system.ts` — FOUND
- `/Users/makoto/Downloads/work/cli/src/ai/prompts/npc-system.ts` — FOUND
- `/Users/makoto/Downloads/work/cli/src/ai/prompts/narrative-system.test.ts` — FOUND
- `/Users/makoto/Downloads/work/cli/src/ai/prompts/npc-system.test.ts` — FOUND
- `/Users/makoto/Downloads/work/cli/src/engine/scene-manager.ts` — FOUND
- `/Users/makoto/Downloads/work/cli/src/engine/dialogue-manager.ts` — FOUND
- Commit `4d3809a` — FOUND
