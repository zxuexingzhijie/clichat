---
plan: 03-02
phase: 03-persistence-world
status: complete
completed_at: 2026-04-21
requirements: [CONT-01, CONT-03]
---

# Plan 03-02: World Content YAML Expansion

## What Was Built

Expanded all four world content YAML files to provide a complete first region for Chronicle:

- **locations.yaml** — 9 locations in 黑松镇 and surrounding wilderness
- **npcs.yaml** — 15 named NPCs distributed across locations
- **factions.yaml** — 4 factions (卫队/影子公会/商人协会/神殿)
- **quests.yaml** — 1 main quest (6 stages) + 5 side quest templates

## Key Files Created/Modified

- `src/data/codex/locations.yaml` — 9 locations with region, danger_level, exits, notable_npcs, objects
- `src/data/codex/npcs.yaml` — 15 NPCs with backstories, goals, personality_tags, initial_disposition
- `src/data/codex/factions.yaml` — 4 factions with territory, alignment, goals, rivals
- `src/data/codex/quests.yaml` — main quest 黑松镇的阴影 + 5 side quests as QuestTemplateSchema entries

## Decisions Made

- All quest entries use QuestTemplateSchema (`type: quest`) to match 03-01 CodexEntry discriminated union
- NPCs have `location_id` refs matching location IDs for consistency
- Factions have cross-references via `rivals` field
- Main quest has 5 stages with objectives and nextStageId chain

## Self-Check: PASSED

- [x] 9 locations exist across 黑松镇 and surrounding wilderness
- [x] 4 factions exist (卫队/影子公会/商人协会/神殿)
- [x] 15 named NPCs distributed across locations
- [x] 1 main quest skeleton (6 stages) + 5 side quest templates
- [x] All quest entries match QuestTemplateSchema (type: quest)
