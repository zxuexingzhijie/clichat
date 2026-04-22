---
phase: 04-differentiation
plan: 02
subsystem: codex-spatial
tags: [schema, location, spatial, map, yaml]
dependency_graph:
  requires: []
  provides: [SpatialExitSchema, LocationSchema-spatial, location-coordinates]
  affects: [src/codex/schemas/entry-types.ts, src/data/codex/locations.yaml]
tech_stack:
  added: []
  patterns: [union-type-backward-compat, optional-field-extension]
key_files:
  created: []
  modified:
    - src/codex/schemas/entry-types.ts
    - src/data/codex/locations.yaml
decisions:
  - "SpatialExitSchema uses z.union([z.string(), SpatialExitSchema]) for backward compatibility with old string exits"
  - "coordinates and map_icon are optional fields so existing code is unaffected"
metrics:
  duration: 264s
  completed: 2026-04-22T03:09:57Z
---

# Phase 4 Plan 02: Location Spatial Data Extension Summary

Backward-compatible LocationSchema extension with SpatialExitSchema, coordinates, and map_icon fields; all 9 locations enriched with spatial topology for ASCII map rendering.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend LocationSchema with SpatialExitSchema and coordinates | 93f14eb | src/codex/schemas/entry-types.ts |
| 2 | Add spatial data to all 9 locations in locations.yaml | 957e9a0 | src/data/codex/locations.yaml |

## Changes Made

### Task 1: Schema Extension
- Added `SpatialExitSchema` with `direction` (required), `targetId` (required), `distance` (optional), `label` (optional)
- Changed `LocationSchema.exits` from `z.array(z.string())` to `z.array(z.union([z.string(), SpatialExitSchema]))` for backward compatibility
- Added optional `coordinates: z.object({ x: z.number(), y: z.number() })` field
- Added optional `map_icon: z.string()` field
- Exported `SpatialExit` type

### Task 2: Location Data Enrichment
- Converted all 9 locations from string exits to SpatialExit objects with direction + targetId
- Added coordinate grid for Iron Wind Valley region:
  - Town cluster: north_gate(1,2), main_street(1,3), tavern(0,4), blacksmith(1,4), market(2,4), temple(2,3)
  - Wilderness: forest_road(1,1), abandoned_camp(3,1), dark_cave(3,0)
- Assigned map_icon values: H (town buildings), T (temple), F (forest), R (ruins), D (dungeon)
- All existing fields (id, name, tags, description, epistemic, region, danger_level, notable_npcs, objects) preserved unchanged

## Verification

418 tests pass, 0 failures across 34 test files. Codex loader validates new spatial exit format successfully via the union type.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

All files exist, all commits verified, all content checks pass.
