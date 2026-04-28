---
phase: 15-content-death-recovery
plan: "01"
subsystem: world-data
tags:
  - content
  - locations
  - npcs
  - enemies
dependency_graph:
  requires: []
  provides:
    - locations-npcs-wired
    - dark-cave-combat-trigger
  affects:
    - src/engine/scene-manager.ts
    - src/engine/action-handlers/move-handler.ts
tech_stack:
  added: []
  patterns:
    - YAML data-driven NPC placement
    - YAML data-driven enemy encounter
key_files:
  created: []
  modified:
    - world-data/codex/locations.yaml
decisions:
  - npc_hunter assigned to both loc_north_gate and loc_forest_road (patrol pattern per D-04)
  - enemy_wolf_alpha chosen for loc_dark_cave (danger_level:8 location, thematically appropriate)
metrics:
  duration: "5m"
  completed: "2026-04-28T14:37:28Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 1
---

# Phase 15 Plan 01: NPC Placement and Dark Cave Enemy Wiring Summary

YAML-only content pass wiring five locations: four locations receive missing NPCs via notable_npcs arrays, and loc_dark_cave gets an enemies field triggering combat with enemy_wolf_alpha via the existing move-handler.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add missing NPCs to four locations | 27a46eb | world-data/codex/locations.yaml |
| 2 | Add enemy encounter to loc_dark_cave | 27a46eb | world-data/codex/locations.yaml |

## Changes Made

**loc_north_gate** — notable_npcs expanded from `[npc_guard]` to `[npc_guard, npc_captain, npc_hunter]`

**loc_temple** — notable_npcs expanded from `[npc_priestess]` to `[npc_priestess, npc_herbalist]`

**loc_main_street** — notable_npcs changed from `[]` to `[npc_elder]`

**loc_forest_road** — notable_npcs changed from `[]` to `[npc_hunter]`

**loc_dark_cave** — enemies field added: `[enemy_wolf_alpha]`

## How It Wires Into the Engine

- `scene-manager.ts` line 117: `draft.npcsPresent = [...entry.notable_npcs]` — the notable_npcs array is copied directly into scene state on location entry.
- `move-handler.ts`: reads `location.enemies` and calls `combatLoop.startCombat(enemies)` when non-empty — no engine changes needed.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all NPC IDs and enemy IDs reference confirmed entries in npcs.yaml and enemies.yaml.

## Threat Flags

None — YAML data files only; no new network endpoints or auth paths introduced.

## Self-Check: PASSED

- world-data/codex/locations.yaml: FOUND and modified
- Commit 27a46eb: FOUND
- Bun YAML import assertions: all passed
- bun test: 949 pass, 1 pre-existing failure (use-game-input.test.ts — not introduced by this plan)
