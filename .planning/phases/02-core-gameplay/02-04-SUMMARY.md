---
phase: "02"
plan: "02-04"
subsystem: ai-roles
tags: [ai, narrative, npc, retrieval, safety, context-assembler]
key-files:
  - src/ai/roles/narrative-director.ts
  - src/ai/roles/npc-actor.ts
  - src/ai/roles/retrieval-planner.ts
  - src/ai/roles/safety-filter.ts
  - src/ai/utils/context-assembler.ts
  - src/ai/prompts/narrative-system.ts
  - src/ai/prompts/npc-system.ts
  - src/ai/prompts/retrieval-system.ts
metrics:
  files_created: 11
  tests_added: 12
  tests_total: 239
---

# 02-04 Summary: AI Role Implementations

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1-2 | f915635 | AI role implementations — Narrative Director, NPC Actor, Retrieval Planner, Safety Filter, Context Assembler |
| fix | 6c16002 | Fix mock.module pollution — include all ai exports in test mocks |

## What Was Delivered

- **Narrative Director** (`src/ai/roles/narrative-director.ts`) — generates 80-300 char Chinese narration with streaming support, retry logic, and fallback
- **NPC Actor** (`src/ai/roles/npc-actor.ts`) — per-character dialogue with emotion tags, memory flags, relationship deltas via generateObject
- **Retrieval Planner** (`src/ai/roles/retrieval-planner.ts`) — determines codex entries, NPC memories, quest states to fetch per turn
- **Safety Filter** (`src/ai/roles/safety-filter.ts`) — validates AI output for system info leaks, content policy, world consistency
- **Context Assembler** (`src/ai/utils/context-assembler.ts`) — assembles retrieval results into structured prompt sections
- **System Prompts** — narrative, NPC, and retrieval prompt templates with Chinese-first content
- **Tests** — 12 tests across 3 test files with proper mock isolation

## Deviations

- **Mock pollution fix** — Bun's `mock.module` shares state across test files in the same runner. All `ai` module mocks now include `generateText`, `generateObject`, and `streamText` exports to prevent cross-file pollution. Also fixed in Phase 1 test files (intent-classifier, game-loop).

## Self-Check

- [x] All 5 AI roles implemented
- [x] System prompts enforce Rules Engine boundary (AI writes prose, not game outcomes)
- [x] Structured output via generateObject with Zod schemas
- [x] Retry logic with fallback on all roles
- [x] 239 tests pass, 0 failures
- **PASSED**
