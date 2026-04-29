---
phase: 16
plan: P05
subsystem: codex-schema, scene-manager, world-data
tags: [location, description-overrides, worldFlags, narration, deterministic]
dependency_graph:
  requires: [16-P01, 16-P02, 16-P03]
  provides: [location-description-overrides, selectLocationDescription]
  affects: [scene-manager, locations.yaml, LocationSchema]
tech_stack:
  added: []
  patterns: [worldFlags priority override, pure helper extraction]
key_files:
  created: []
  modified:
    - src/codex/schemas/entry-types.ts
    - src/engine/scene-manager.ts
    - src/engine/scene-manager.test.ts
    - world-data/codex/locations.yaml
decisions:
  - OVERRIDE_PRIORITY list hardcoded in scene-manager (not in schema) for easy iteration without data migrations
  - selectLocationDescription exported for direct unit testability
  - handleLook uses stores.scene.getState().sceneId (not closure variable) to avoid stale ref bug
metrics:
  duration: ~10min
  completed: "2026-04-30"
  tasks_completed: 3
  files_changed: 4
---

# Phase 16 Plan P05: Location description_overrides + scene-manager worldFlags lookup Summary

**One-liner:** Deterministic per-worldFlag location description overrides with priority resolution in scene-manager, bypassing LLM when a flag matches.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add `description_overrides: z.record(z.string(), z.string()).optional()` to `LocationSchema` | 6ba6063 |
| 2 | Author override texts for `loc_tavern`, `loc_north_gate`, `loc_main_street` in locations.yaml | 6ba6063 |
| 3 | `selectLocationDescription` helper + `OVERRIDE_PRIORITY` list + wire into `loadScene` and `handleLook` | 6ba6063 |

## Implementation Notes

`selectLocationDescription` iterates `OVERRIDE_PRIORITY` and returns the first key that is both truthy in `worldFlags` and present in `location.description_overrides`. Falls back to `location.description` otherwise.

`handleLook` (no-target path) checks the override before considering `generateNarrationFn`. If an override matches, it appends the text as a new narration line and returns immediately — no LLM call (satisfies D-23 deterministic override requirement).

`loadScene` replaces `let narrationText = entry.description` with a `selectLocationDescription` call so initial scene entry also reflects worldFlags state.

## Tests

11 new tests added across 3 describe blocks:
- `selectLocationDescription`: matching flag, no flags, no overrides, false flag, priority order (act3 > mayor_secret), lower-priority fallthrough
- `handleLook override path`: override fires without LLM call; LLM called when no flag matches
- `loadScene with worldFlags override`: loadScene uses override description when flag matches

All 26 tests pass (15 pre-existing + 11 new).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/codex/schemas/entry-types.ts` — FOUND, `description_overrides` field added
- `src/engine/scene-manager.ts` — FOUND, `selectLocationDescription` exported, wired into `loadScene` and `handleLook`
- `src/engine/scene-manager.test.ts` — FOUND, 26 tests pass
- `world-data/codex/locations.yaml` — FOUND, 3 locations have `description_overrides`
- Commit `6ba6063` — FOUND
