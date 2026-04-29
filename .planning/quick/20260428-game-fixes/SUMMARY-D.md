# SUMMARY-D: YAML Data Fixes

Commit: `ee3ea3a`

## Items

| ID | File | Change | Status |
|----|------|--------|--------|
| C2 | quests.yaml | `quest_side_missing_ore` `stage_deliver` — added trigger `dialogue_ended / npc_blacksmith` | DONE |
| C3 | quests.yaml | `quest_side_wolf_bounty` `stage_report` — added trigger `dialogue_ended / npc_hunter` | DONE |
| C4 | quests.yaml | `quest_side_overdue_debt` `stage_collect` — added trigger `dialogue_ended / npc_beggar` | DONE |
| m4 | locations.yaml | `loc_temple` `map_icon` changed from `"T"` to `"P"` (no conflict with tavern) | DONE |
| m2 | quests.yaml | `quest_main_01` `stage_rumor` trigger narrowed to `npc_bartender` (was any NPC) | DONE |

## Test Result

959 pass, 1 fail (pre-existing: use-game-input.test.ts 'i' → null). No regressions.
