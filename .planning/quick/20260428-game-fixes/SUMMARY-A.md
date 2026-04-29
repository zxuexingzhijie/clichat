# Chronicle CLI — YAML Content Fixes Summary

**Date:** 2026-04-28
**Commit:** 4fc5708

## Fix Status

| # | Fix | Status | Notes |
|---|-----|--------|-------|
| 1 | app.tsx exits field `location_id` → `targetId` | done | Line 249 in src/app.tsx |
| 2 | loc_tavern + loc_market missing NPCs | done | npc_innkeeper → loc_tavern; npc_beggar → loc_market |
| 3 | loc_forest_road + loc_abandoned_camp enemies | done | enemy_wolf → forest_road; enemy_bandit → abandoned_camp |
| 4 | Add item_iron_ore and item_evidence to items.yaml | done | item_type corrected: `material`→`misc`, `quest_item`→`key_item` (schema constraint) |
| 5 | obj_find_evidence targetId + loc_dark_cave object | done | targetId: item_evidence added to quest; item_evidence added to cave objects list |
| 6 | Map icon diversification | done | G/T/S/B/M for north_gate/tavern/main_street/blacksmith/market; loc_temple kept "T" |

## Deviations

**Fix 4 — item_type schema correction:** The specified item_type values `material` and `quest_item` are not in the schema's enum (`weapon|armor|consumable|key_item|misc`). Auto-fixed:
- `item_iron_ore`: `material` → `misc`
- `item_evidence`: `quest_item` → `key_item`

This caused 7 test failures on first run; correcting the types restored the test suite.

## Test Results

```
957 pass
1 fail   ← pre-existing: use-game-input.test.ts (getPanelActionForKey > returns inventory for i)
958 total across 88 files
```

No regressions introduced.
