---
phase: "17"
plan: P01
subsystem: ai/prompts, ai/roles
tags: [npc, narrative-context, tdd, bug-fix]
dependency_graph:
  requires: []
  provides: [buildNpcSystemPrompt-narrativeContext, streamNpcDialogue-trustLevel]
  affects: [src/ai/prompts/npc-system.ts, src/ai/roles/npc-actor.ts]
tech_stack:
  added: []
  patterns: [optional-param-guard, IIFE-result-assignment]
key_files:
  created: []
  modified:
    - src/ai/prompts/npc-system.ts
    - src/ai/prompts/npc-system.test.ts
    - src/ai/roles/npc-actor.ts
    - src/ai/roles/npc-actor.test.ts
decisions:
  - "storyAct used as raw identifier (act1/act2/act3) in prompt text per CONTEXT.md — no translation to 第一幕 etc"
  - "IIFE pattern used to assign knowledgeProfile result to local variable before appending narrative paragraph"
  - "mock.calls typed via unknown intermediate cast to satisfy bun's strict tuple inference"
metrics:
  duration: "3 minutes"
  completed: "2026-04-29"
  tasks_completed: 2
  files_modified: 4
---

# Phase 17 Plan P01: NPC Architecture Fix — narrativeContext Wiring Summary

**One-liner:** Wire NarrativePromptContext into buildNpcSystemPrompt (optional 3rd param) and fix npc-actor.ts to forward it instead of discarding with `void`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend buildNpcSystemPrompt with optional narrativeContext param | e2663ed | npc-system.ts, npc-system.test.ts |
| 2 | Fix npc-actor.ts — wire narrativeContext and add trustLevel to streamNpcDialogue | 699cb19 | npc-actor.ts, npc-actor.test.ts |

## What Was Built

**Task 1 — npc-system.ts:**
- Added `import type { NarrativePromptContext } from './narrative-system'`
- Extended `buildNpcSystemPrompt` signature with optional 3rd param `narrativeContext?: NarrativePromptContext`
- Refactored early-return paths into IIFE-assigned `result` variable
- Appended `\n\n当前故事阶段：{storyAct}\n氛围：{atmosphereTags}\n请用符合当前氛围的语气说话。` when context is present
- 5 new tests in `buildNpcSystemPrompt — narrativeContext injection` describe block

**Task 2 — npc-actor.ts:**
- Removed `void narrativeContext` line from `generateNpcDialogue`
- Changed `buildNpcSystemPrompt(npcProfile, trustLevel)` → `buildNpcSystemPrompt(npcProfile, trustLevel, narrativeContext)`
- Added `narrativeContext?: NarrativePromptContext` and `trustLevel: number = 0` params to `streamNpcDialogue`
- Changed `buildNpcSystemPrompt(npcProfile)` → `buildNpcSystemPrompt(npcProfile, trustLevel, narrativeContext)` in stream path
- 3 new tests in `narrativeContext forwarding` describe block

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript mock.calls tuple type errors in test assertions**
- **Found during:** Task 2 TypeScript check
- **Issue:** `mockGenerateObject.mock.calls[0][0]` — bun infers `mock.calls` as `[][]` (empty tuple), causing TS2493 and TS2352 errors
- **Fix:** Cast via `unknown` intermediate: `(mock.calls[0] as unknown as [Record<string, unknown>])[0]`
- **Files modified:** src/ai/roles/npc-actor.test.ts
- **Commit:** 699cb19 (included in same commit)

## Known Stubs

None.

## Threat Flags

None — `atmosphereTags` flows from internal `narrativeStore` state, not user input. System prompts remain server-side only per CLAUDE.md security boundary.

## Self-Check: PASSED

- [x] src/ai/prompts/npc-system.ts — exists, modified
- [x] src/ai/prompts/npc-system.test.ts — exists, 18 tests pass
- [x] src/ai/roles/npc-actor.ts — exists, `void narrativeContext` removed
- [x] src/ai/roles/npc-actor.test.ts — exists, 6 tests pass
- [x] Commit e2663ed — exists
- [x] Commit 699cb19 — exists
- [x] `streamNpcDialogue` signature includes `narrativeContext?: NarrativePromptContext` and `trustLevel: number = 0`
- [x] No new TypeScript errors in modified source files
