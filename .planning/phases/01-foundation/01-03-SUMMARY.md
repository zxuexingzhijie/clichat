---
phase: 01-foundation
plan: 03
subsystem: world-codex
tags: [zod, yaml, schema, epistemic, codex, tdd]
dependency_graph:
  requires: []
  provides: [codex-schemas, codex-loader, codex-query, example-data]
  affects: [narrative-director, npc-mind, retrieval-planner]
tech_stack:
  added: [zod@4.3.6, yaml@2.8.3, bun@1.3.12]
  patterns: [discriminated-union, epistemic-metadata, yaml-validation]
key_files:
  created:
    - src/codex/schemas/epistemic.ts
    - src/codex/schemas/entry-types.ts
    - src/codex/schemas/relationship.ts
    - src/codex/loader.ts
    - src/codex/query.ts
    - src/data/codex/races.yaml
    - src/data/codex/professions.yaml
    - src/data/codex/locations.yaml
    - src/data/codex/factions.yaml
    - src/data/codex/npcs.yaml
    - src/data/codex/spells.yaml
    - src/data/codex/items.yaml
    - src/data/codex/history_events.yaml
    - src/data/codex/relationships.yaml
    - src/codex/schemas/epistemic.test.ts
    - src/codex/loader.test.ts
    - package.json
    - tsconfig.json
  modified:
    - .gitignore
decisions:
  - Used Zod 4 discriminatedUnion for 8-type CodexEntrySchema routing by type field
  - Epistemic metadata defaults (known_by=[], contradicts=[], volatility=stable) reduce YAML verbosity
  - Loader uses safeParse for detailed error messages including file path, entry id, and field
  - Relationship edges stored in separate YAML file, loaded via dedicated loadRelationships function
metrics:
  duration: 26min
  completed: "2026-04-20T05:05:00Z"
  tasks_completed: 2
  tasks_total: 2
  tests: 57
  test_files: 2
  files_created: 18
---

# Phase 1 Plan 3: World Codex Schema & Data Layer Summary

Zod-validated YAML codex system with 8 entry type schemas, epistemic metadata (D-30), typed relationship graph (D-31), YAML loader with validation, query engine, and 16 example entries across 9 data files demonstrating truth-vs-rumor epistemic separation.

## What Was Built

### Schemas (src/codex/schemas/)

**epistemic.ts** - Full D-30 epistemic metadata schema:
- 6 enum types: AuthorityLevel, TruthStatus, Scope, Visibility, SourceType, Volatility
- EpistemicMetadataSchema with all fields, optional scope_ref/source_bias, defaults for known_by/contradicts/volatility

**entry-types.ts** - 8 codex entry type schemas with shared base fields (id, name, type, tags, description, epistemic):
- RaceSchema: traits, abilities, lore
- ProfessionSchema: abilities, starting_equipment, primary_attribute (physique/finesse/mind)
- LocationSchema: region, danger_level (0-10), exits, notable_npcs, objects
- FactionSchema: territory, alignment, goals, rivals
- NpcSchema: location_id, personality_tags, goals, backstory, initial_disposition (-1 to 1)
- SpellSchema: element, mp_cost, effect, requirements
- ItemSchema: item_type (weapon/armor/consumable/key_item/misc), value, effect, base_damage, armor_value
- HistoryEventSchema: date, participants, impact, era
- CodexEntrySchema: z.discriminatedUnion routing by type field

**relationship.ts** - D-31 relationship edge schema: source_id, target_id, relation_type, visibility, strength (0-1), status (active/broken/dormant/secret), optional evidence/note

### Loader & Query (src/codex/)

**loader.ts** - YAML file loading with Zod validation:
- loadCodexFile: reads YAML, validates each entry, returns typed array
- loadRelationships: same for relationship edges
- loadAllCodex: scans directory, merges into Map<string, CodexEntry>, rejects duplicate ids

**query.ts** - Codex query functions:
- queryByType, queryByTag, queryById for codex entries
- queryRelationships with multi-field filtering (source_id, target_id, relation_type)

### Example Data (src/data/codex/)

16 entries across 9 YAML files:
- races: 人类 (human), 精灵 (elf) - both playable, canonical_truth
- professions: 冒险者 (adventurer/physique), 法师 (mage/mind)
- locations: 黑松镇北门 (north gate), 黑松镇酒馆 (tavern)
- factions: 黑松镇守卫 (guard/public), 暗影行会 (shadow guild/hidden)
- npcs: 北门守卫 (guard), 酒馆老板老陈 (bartender)
- spells: 火焰箭 (fire arrow/3MP), 治愈之光 (healing light/2MP)
- items: 铁剑 (iron sword/weapon), 皮甲 (leather armor)
- history_events: 黑松镇狼灾 (wolf disaster/truth), 黑松镇狼灾隐情 (wolf conspiracy/rumor)
- relationships: 4 edges (guard->militia, guard->gate, bartender->tavern, bartender->shadow guild)

### Epistemic System Demonstration

The wolf disaster entries demonstrate the core epistemic system:
- `event_wolf_disaster`: authority=established_canon, truth_status=true, visibility=public
- `event_wolf_disaster_rumor`: authority=street_rumor, truth_status=partially_true, visibility=hidden, contradicts=[event_wolf_disaster], known_by=[npc_bartender]

This models: official history says wolves attacked naturally (public, true). Bar gossip says someone drove the wolves magically (hidden, partially true, contradicts official record). Only the bartender knows the rumor.

## TDD Gate Compliance

Verified in git log:
1. RED: `2f43d66` test(01-03): add failing tests for codex schemas
2. GREEN: `689a444` feat(01-03): implement codex schemas with epistemic metadata system
3. RED: `74625ae` test(01-03): add failing tests for YAML loader and query functions
4. GREEN: `f523cb5` feat(01-03): implement YAML loader, query engine, and example codex data

All gates passed. Tests written before implementation in both tasks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Project initialization required**
- **Found during:** Task 1
- **Issue:** Greenfield project had no package.json, tsconfig.json, or bun setup
- **Fix:** Ran bun init, installed zod and yaml dependencies
- **Files modified:** package.json, tsconfig.json, bun.lock, .gitignore

**2. [Rule 1 - Bug] Test import paths incorrect**
- **Found during:** Task 2
- **Issue:** Test file used `../loader.ts` and `../../data/codex` relative paths, but test lives in same directory as loader
- **Fix:** Changed to `./loader.ts` and `../data/codex`
- **Files modified:** src/codex/loader.test.ts

## Known Stubs

None. All schemas are fully implemented, all YAML data files contain real example content, all query functions are wired to actual data.

## Self-Check: PASSED

All 18 created files verified present. All 4 commit hashes verified in git log. 57 tests passing.
