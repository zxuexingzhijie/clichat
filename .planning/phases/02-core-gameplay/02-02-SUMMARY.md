---
phase: 02-core-gameplay
plan: 02
subsystem: world-data
tags: [yaml, codex, zod, content, character-creation, combat, npcs]

requires:
  - phase: 01-foundation
    provides: Codex loader, schemas, YAML validation pipeline
provides:
  - 3 playable races with traits and abilities
  - 3 professions with starting equipment and primary attributes
  - 7 background hooks with attribute biases for character creation
  - 12 named NPCs with backstories for town of 黑松镇
  - 5 enemy stat blocks for combat encounters
  - 10 items covering weapons, armor, consumables, tools
  - EnemySchema and BackgroundSchema in codex type system
affects: [02-03-character-creation, 02-05-scene-exploration, 02-06-npc-dialogue, 02-07-combat]

tech-stack:
  added: []
  patterns:
    - "Partial object schema for sparse attribute maps (attribute_bias)"
    - "Enemy stat block pattern: hp/maxHp/attack/defense/dc/damage_base/abilities/danger_level"
    - "Background hook pattern: question/attribute_bias/starting_tags/world_state_effects/narrative_hook"

key-files:
  created:
    - src/data/codex/backgrounds.yaml
    - src/data/codex/enemies.yaml
  modified:
    - src/codex/schemas/entry-types.ts
    - src/data/codex/races.yaml
    - src/data/codex/professions.yaml
    - src/data/codex/npcs.yaml
    - src/data/codex/items.yaml

key-decisions:
  - "BackgroundSchema attribute_bias uses partial object {physique?, finesse?, mind?} instead of strict record to allow sparse bias definitions"

patterns-established:
  - "Background hooks map to wizard questions with attribute biases per D-02/D-03"
  - "NPC entries include Chinese backstories with plot hooks connecting to town narrative"

requirements-completed: [CONT-02, CONT-04]

duration: 5min
completed: 2026-04-20
---

# Phase 2 Plan 2: World Codex Content Expansion Summary

**3 races, 3 professions, 7 backgrounds, 12 NPCs, 5 enemies, 10 items -- all Zod-validated YAML codex content for character creation and combat**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-20T17:33:36Z
- **Completed:** 2026-04-20T17:38:09Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added EnemySchema and BackgroundSchema to codex type system with discriminated union
- Expanded world content to meet CONT-02 (races/professions/equipment) and CONT-04 (10-15 NPCs)
- Created 7 background hooks for the character creation wizard (4 origin + 3 secret)
- Created 5 enemy stat blocks with varied danger levels for combat encounters

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend codex schemas with EnemySchema and BackgroundSchema** - `8a6fe00` (feat)
2. **Task 2: Expand YAML codex data for all content requirements** - `0487356` (feat)

## Files Created/Modified
- `src/codex/schemas/entry-types.ts` - Added EnemySchema, BackgroundSchema, updated CodexEntrySchema union
- `src/data/codex/races.yaml` - Added race_dwarf (3 races total)
- `src/data/codex/professions.yaml` - Added prof_rogue (3 professions total)
- `src/data/codex/backgrounds.yaml` - New file, 7 background hooks for character creation
- `src/data/codex/npcs.yaml` - Added 10 NPCs (12 total) for 黑松镇
- `src/data/codex/items.yaml` - Added 8 items (10 total) covering all profession gear
- `src/data/codex/enemies.yaml` - New file, 5 enemy stat blocks for combat

## Decisions Made
- Used partial object `{physique?, finesse?, mind?}` for attribute_bias instead of `z.record(z.enum(...), z.number())` -- Zod 4 strict record requires all enum keys present, but backgrounds only bias 1-2 attributes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed BackgroundSchema attribute_bias type**
- **Found during:** Task 2 (YAML content expansion)
- **Issue:** Plan specified `z.record(z.enum(['physique', 'finesse', 'mind']), z.number())` but Zod 4 requires all enum keys present in records. Background YAML entries only specify biased attributes (e.g., `{physique: 1}` without finesse/mind).
- **Fix:** Changed to `z.object({physique: z.number().optional(), finesse: z.number().optional(), mind: z.number().optional()})` which accepts sparse attribute maps.
- **Files modified:** src/codex/schemas/entry-types.ts
- **Verification:** All 57 codex tests pass, all 7 background entries validate
- **Committed in:** 0487356 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Schema fix necessary for Zod 4 compatibility with sparse attribute maps. No scope creep.

## Issues Encountered
None beyond the schema fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All codex content ready for character creation wizard (02-03)
- Enemy stat blocks ready for combat system (02-07)
- NPC data ready for dialogue system (02-06)
- Item data ready for inventory/equipment in character creation
- Background hooks ready for narrative-driven attribute assignment per D-02/D-03

## Self-Check: PASSED

All acceptance criteria verified:
- [x] src/codex/schemas/entry-types.ts contains EnemySchema and BackgroundSchema
- [x] CodexEntrySchema union includes both new types
- [x] races.yaml: 3 entries (race_human, race_elf, race_dwarf)
- [x] professions.yaml: 3 entries (prof_adventurer, prof_mage, prof_rogue)
- [x] backgrounds.yaml: 7 entries with type: background
- [x] npcs.yaml: 12 entries (2 existing + 10 new)
- [x] enemies.yaml: 5 entries with type: enemy
- [x] items.yaml: 10 entries including item_wooden_staff and item_short_bow
- [x] All codex tests pass: 57 tests, 0 failures

---
*Phase: 02-core-gameplay*
*Completed: 2026-04-20*
