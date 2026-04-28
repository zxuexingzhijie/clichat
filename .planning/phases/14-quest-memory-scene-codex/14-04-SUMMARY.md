---
phase: 14
plan: "04"
subsystem: action-handlers, safety-filter
tags: [cast, safety, regex, codex]
dependency_graph:
  requires: []
  provides: [handleCast, tightened-safety-filter]
  affects: [src/engine/action-handlers/index.ts, src/ai/roles/safety-filter.ts]
tech_stack:
  added: []
  patterns: [out-of-combat guard, operator-required regex]
key_files:
  created: []
  modified:
    - src/engine/action-handlers/index.ts
    - src/ai/roles/safety-filter.ts
    - src/ai/roles/safety-filter-failclosed.test.ts
decisions:
  - handleCast delegates to handleCombat when combat is active, matching attack/guard/flee pattern
  - level\s*up split from main alternation to preserve no-operator match
metrics:
  duration: ~5m
  completed: "2026-04-28"
---

# Phase 14 Plan 04: handleCast + Safety Filter Tighten Summary

One-liner: handleCast rejects cast outside combat; STATE_OVERRIDE_PATTERN now requires explicit +/- operator to eliminate narrative false positives.

## What Was Done

### Task 1 — handleCast out-of-combat error

Added `handleCast` const before `HANDLER_MAP` in `src/engine/action-handlers/index.ts`:

- When `ctx.stores.combat.getState().active` is false, returns `{ status: 'error', message: '你现在不在战斗中，无法使用法术。' }`
- When combat is active, delegates to `handleCombat` (same as the `createDefaultRegistry` combat intercept path)
- Updated `HANDLER_MAP` entry `cast: handleDefault` → `cast: handleCast`

### Task 2 — Tighten STATE_OVERRIDE_PATTERN

Changed `src/ai/roles/safety-filter.ts` regex from:
```
/(获得|失去|HP|MP|金币|等级|升级|gained|lost|level\s*up|gold|experience)\s*[+\-]?\d+/i
```
to a split pattern:
```
/level\s*up\s*\d+|(获得|失去|HP|MP|金币|等级|升级|gained|lost|gold|experience)\s*[+\-]\d+/i
```

Rationale: operator `?` (optional) caused false positives on normal narrative text like `你获得了10枚金币` or `获得50经验`. Making operator required eliminates these. `level up` is split out as a separate branch because `player level up 5` has no operator but should still be blocked.

Added 3 new tests to `safety-filter-failclosed.test.ts`:
- `你获得了10枚金币` — passes (no operator)
- `你击败了狼，获得50经验` — passes (no operator)
- `获得+10金币` — blocked as `state_override`

### Deviation

**[Rule 1 - Bug]** `level\s*up` split required to fix pre-existing test `blocks "level up" pattern`

- Found during: Task 2 regex tighten
- Issue: `player level up 5` has no +/- operator but pre-existing test expects it blocked
- Fix: Split `level\s*up\s*\d+` into its own alternation branch without operator requirement
- Files modified: src/ai/roles/safety-filter.ts
- Commit: 4b1f5a3

## CODEX-01 Confirmation

CODEX-01 is correctly implemented — no code changes required.

Evidence in `src/app.tsx` lines 66–102:

1. **Reactive subscription (lines 66–73):** `playerKnowledgeState` is a React `useState` initialized from `ctx.stores.playerKnowledge.getState()`, with a `useEffect` subscribing to the store and calling `setPlayerKnowledgeState` on every change.

2. **useMemo dependency (line 102):** `codexDisplayEntries` useMemo lists `[allCodexEntries, playerKnowledgeState]` as dependencies. When playerKnowledge store updates, `setPlayerKnowledgeState` fires, triggering useMemo recomputation, and `knowledgeStatus` on each entry reflects the current state via `.find(e => e.codexEntryId === entry.id)?.knowledgeStatus ?? null`.

The reactive pipeline is complete and correct.

## Verification Results

- action-handlers tests: 26 pass, 0 fail
- safety-filter tests: 10 pass, 0 fail (includes 3 new tests)
- tsc: pre-existing error in `src/persistence/memory-persistence.test.ts` (unrelated to this plan)

## Commit

- `4b1f5a3` — feat(14-04): handleCast out-of-combat error + tighten safety-filter regex

## Self-Check: PASSED

- src/engine/action-handlers/index.ts — modified, handleCast present
- src/ai/roles/safety-filter.ts — modified, split regex present
- src/ai/roles/safety-filter-failclosed.test.ts — 3 new tests present
- commit 4b1f5a3 — verified in git log
