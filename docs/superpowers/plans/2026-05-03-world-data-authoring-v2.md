# World-data Authoring v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Chronicle's world-data authoring system so codex entries preserve player-facing prose, AI grounding constraints, and ecological memory hooks while remaining backward-compatible with existing YAML.

**Architecture:** Add optional v2 authoring blocks to Zod schemas first, then mechanically migrate all world-data YAML with conservative data, then rewrite core Blackpine content, then wire runtime consumers to use the new fields. Keep old `description` and `epistemic` as compatibility fallbacks while enforcing that new fields survive `loadCodexFile()` parsing.

**Tech Stack:** TypeScript, Bun test runner, Zod, YAML world-data, existing codex loader, existing AI prompt/context systems, ecological memory runtime.

---

## File Structure

- Modify `src/codex/schemas/entry-types.ts`: add shared optional v2 blocks (`player_facing`, `ai_grounding`, `ecology`) and type-specific blocks (`location_context`, `voice`, `social_memory`, `world_effects`, `information_network`, `reaction_policy`).
- Modify `src/codex/schemas/relationship.ts`: add optional v2 `ai_grounding` / `ecology` blocks for relationship edges.
- Modify `src/codex/loader.ts`: preserve declared v2 fields; keep `ai-config.yaml` outside scope; keep relationship and guard-dialogue special handling.
- Create `src/codex/schemas/authoring-v2.ts` if shared schemas make `entry-types.ts` too large.
- Create/update tests in `src/codex/schemas/epistemic.test.ts`, `src/codex/loader.test.ts`, and `src/codex/schemas/relationship.test.ts`.
- Modify `world-data/world-manifest.json`: add world data schema metadata.
- Modify all codex YAML files under `world-data/codex` except `guard-dialogue.yaml` and `relationships.yaml` for mechanical v2 fields.
- Modify `world-data/codex/relationships.yaml` separately with relationship v2 fields.
- Add companion validation/spec comments or tests for `world-data/codex/guard-dialogue.yaml`.
- Modify runtime consumers after migration: `scene-manager`, `narrative-system`, `npc-system`, `context-assembler`, `world-memory-recorder`, and UI label generation only after schema/data are stable.

## Task 1: Add shared v2 authoring schemas

**Files:**
- Create or modify: `src/codex/schemas/authoring-v2.ts`
- Modify: `src/codex/schemas/entry-types.ts`
- Test: `src/codex/schemas/epistemic.test.ts` or create `src/codex/schemas/entry-types-v2.test.ts`

- [ ] **Step 1: Write failing tests for enriched entries**

Add tests proving an enriched location, NPC, quest, item, faction, enemy, race, profession, background, spell, and history event all validate with optional v2 fields.


Additional required schema shapes:

- `voice`: `{ register?: string; sentence_style?: string; verbal_tics?: string[] }`
- `social_memory`: `{ remembers?: string[]; shares_with?: string[]; secrecy?: string }`
- `location_context`: travel role, default actions, and state overrides.
- `world_effects`: stage-keyed `facts_created`, `rumors_created`, `beliefs_created`, plus optional `world_effects_none`.
- `information_network`: `hears_from`, `spreads_to`, `rumor_threshold`.
- `reaction_policy`: flexible string-to-string or string-to-unknown map for first version.
- `ecology`: `facts_seeded`, `rumors_seeded`, `belief_hooks`, and `propagation` with the mapping rules from the spec.

Example location test:

```ts
const result = LocationSchema.safeParse({
  id: 'loc_test_gate',
  name: '测试城门',
  type: 'location',
  tags: ['test'],
  description: 'fallback summary',
  epistemic: validEpistemic,
  region: '测试区域',
  danger_level: 1,
  exits: [],
  notable_npcs: [],
  objects: [],
  player_facing: {
    first_visit: '第一次来到测试城门。',
    revisit: '你回到测试城门。',
    short_label: '城门',
    sensory: { sights: ['石墙'], sounds: ['风声'], smells: ['尘土'] },
    interactables: [{ id: 'notice_board', visible_name: '公告栏', affordance: '查看告示' }],
  },
  ai_grounding: {
    must_know: ['这里是测试城门'],
    must_not_invent: ['不要说这里有龙'],
    tone: ['冷清'],
    reveal_policy: { default: 'public_surface_only' },
  },
  ecology: {
    facts_seeded: [{ id: 'fact_test_gate', statement: '测试城门有人值守', scope: 'location', scopeId: 'loc_test_gate', truthStatus: 'confirmed', confidence: 1, tags: ['test'] }],
    rumors_seeded: [{ id: 'rumor_test_gate', statement: '城门有奇怪传闻', scope: 'location', scopeId: 'loc_test_gate', confidence: 0.6, tags: ['rumor'], spread: ['loc_tavern'] }],
    belief_hooks: [{ when: 'player_asks_guard', holderId: 'npc_guard', holderType: 'npc', subjectId: 'player', stance: 'believes', statement: '玩家正在打听守卫', confidence: 0.7, decay: 'normal', tags: ['guard'] }],
    propagation: { default_visibility: 'same_location', faction_scope: 'faction_guard' },
  },
  location_context: {
    travel_role: 'town_gate',
    default_actions: ['talk', 'inspect', 'move'],
    state_overrides: { act3_confrontation: { player_facing_override: '气氛紧张。', ai_tone_override: 'confrontation' } },
  },
});
expect(result.success).toBe(true);
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test src/codex/schemas/entry-types-v2.test.ts`

Expected: FAIL because v2 schemas do not exist.

- [ ] **Step 3: Implement shared authoring schemas**

Create `src/codex/schemas/authoring-v2.ts` with:

```ts
export const PlayerFacingSchema = z.object({
  first_visit: z.string().optional(),
  revisit: z.string().optional(),
  short_label: z.string().optional(),
  sensory: z.object({
    sights: z.array(z.string()).optional(),
    sounds: z.array(z.string()).optional(),
    smells: z.array(z.string()).optional(),
  }).optional(),
  interactables: z.array(z.object({
    id: z.string(),
    visible_name: z.string(),
    affordance: z.string().optional(),
  })).optional(),
}).optional();

export const AiGroundingSchema = z.object({
  must_know: z.array(z.string()).optional(),
  must_not_invent: z.array(z.string()).optional(),
  tone: z.array(z.string()).optional(),
  reveal_policy: z.record(z.string(), z.unknown()).optional(),
}).optional();
```

Add ecology schemas that align with runtime `WorldFact` / `NpcBelief` authoring:

```ts
export const EcologyFactSeedSchema = z.object({
  id: z.string(),
  statement: z.string(),
  scope: z.enum(['global', 'location', 'faction', 'npc', 'quest', 'player']),
  scopeId: z.string().nullable().optional(),
  truthStatus: z.enum(['confirmed', 'rumor', 'contested', 'false', 'unknown']).optional(),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.string()).optional(),
});
```

Use `truthStatus: 'rumor'` in rumor mapping at runtime, not necessarily in authoring object.

- [ ] **Step 4: Attach v2 blocks to all CodexEntry schemas**

In `entry-types.ts`, extend `baseFields`:

```ts
const baseFields = {
  id: z.string().min(1),
  name: z.string(),
  tags: z.array(z.string()),
  description: z.string(),
  epistemic: EpistemicMetadataSchema,
  player_facing: PlayerFacingSchema,
  ai_grounding: AiGroundingSchema,
  ecology: EcologySchema,
};
```

Add type-specific fields:

- `LocationSchema.location_context`
- `NpcSchema.voice` and `social_memory`
- `QuestTemplateSchema.world_effects`
- `FactionSchema.information_network` and `reaction_policy`

- [ ] **Step 5: Run tests to verify pass**

Run: `bun test src/codex/schemas/entry-types-v2.test.ts`

Expected: PASS.

## Task 2: Preserve v2 fields through loader and relationships

**Files:**
- Modify: `src/codex/loader.ts`
- Modify: `src/codex/schemas/relationship.ts`
- Test: `src/codex/loader.test.ts`
- Test: `src/codex/schemas/relationship.test.ts`

- [ ] **Step 1: Write failing loader preservation test**

Add a test using a temporary YAML codex file with `player_facing`, `ai_grounding`, and `ecology`, then assert `loadCodexFile()` returns those fields.

```ts
const entries = await loadCodexFile('/tmp/enriched-locations.yaml');
expect((entries[0] as Location).player_facing?.short_label).toBe('城门');
expect((entries[0] as Location).ai_grounding?.must_know).toContain('这里是测试城门');
expect((entries[0] as Location).ecology?.facts_seeded?.[0]?.id).toBe('fact_test_gate');
```

- [ ] **Step 2: Write failing relationship v2 test**

Add a relationship schema test proving `ai_grounding` and `ecology.belief_hooks` are accepted and preserved by `loadRelationships()`.

- [ ] **Step 3: Run tests to verify failure**

Run: `bun test src/codex/loader.test.ts src/codex/schemas/relationship.test.ts`

Expected: FAIL until relationship v2 schema exists.

- [ ] **Step 4: Implement relationship v2 optional fields**

In `relationship.ts`, add optional `ai_grounding` and `ecology` fields using shared schemas or a small relationship-specific subset.

Do not make `relationships.yaml` a `CodexEntry`; keep loader separation unchanged.

- [ ] **Step 5: Run tests to verify pass**

Run: `bun test src/codex/loader.test.ts src/codex/schemas/relationship.test.ts`

Expected: PASS.

## Task 3: Add world manifest schema metadata

**Files:**
- Modify: `world-data/world-manifest.json`
- Test: create `src/codex/world-manifest.test.ts` or extend existing manifest tests if any

- [ ] **Step 1: Write failing manifest test**

Add test proving `world-manifest.json` includes:

```json
{
  "worldDataSchema": "2.0.0",
  "migration": "world-data-authoring-v2"
}
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test src/codex/world-manifest.test.ts`

Expected: FAIL because manifest lacks schema metadata.

- [ ] **Step 3: Update manifest**

Modify `world-data/world-manifest.json`:

```json
{
  "version": "1.2.0",
  "gameVersion": "1.5.0",
  "generatedAt": "2026-05-03",
  "worldDataSchema": "2.0.0",
  "migration": "world-data-authoring-v2"
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `bun test src/codex/world-manifest.test.ts`

Expected: PASS.

## Task 4: Mechanical migrate core codex entries

**Files:**
- Modify: `world-data/codex/locations.yaml`
- Modify: `world-data/codex/npcs.yaml`
- Modify: `world-data/codex/quests.yaml`
- Modify: `world-data/codex/factions.yaml`
- Test: `src/codex/loader.test.ts`

- [ ] **Step 1: Write failing content smoke tests**

Add tests that load real `world-data/codex` and assert core entries include v2 fields:

```ts
const entries = await loadAllCodex(path.join(process.cwd(), 'world-data/codex'));
expect((entries.get('loc_north_gate') as Location).player_facing?.short_label).toBeDefined();
expect((entries.get('npc_guard') as Npc).voice?.register).toBeDefined();
expect((entries.get('quest_main_01') as QuestTemplate).world_effects).toBeDefined();
expect((entries.get('faction_guard') as Faction).information_network).toBeDefined();
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test src/codex/loader.test.ts`

Expected: FAIL because core entries lack v2 fields.

- [ ] **Step 3: Add conservative v2 fields to core locations**

Migrate at minimum:

- `loc_north_gate`
- `loc_main_street`
- `loc_tavern`
- `loc_blacksmith`
- `loc_market`
- `loc_temple`
- `loc_forest_road`
- `loc_abandoned_camp`
- `loc_dark_cave`

For each, add:

- `player_facing.short_label`
- `player_facing.first_visit` copied/enhanced from current description
- `player_facing.revisit`
- `player_facing.sensory`
- `player_facing.interactables` for existing `objects`
- `ai_grounding.must_know`
- `ai_grounding.must_not_invent`
- `ai_grounding.tone`
- `ecology` with at least empty arrays or obvious facts
- `location_context`

- [ ] **Step 4: Add conservative v2 fields to core NPCs**

Migrate at minimum:

- `npc_guard`
- `npc_bartender`
- `npc_captain`
- `npc_hunter`
- `npc_elder`
- `npc_priestess`
- `npc_shadow_contact`

Add:

- `voice`
- `ai_grounding.must_know`
- `ai_grounding.must_not_invent`
- `social_memory`
- `ecology.belief_hooks` where obvious

- [ ] **Step 5: Add conservative v2 fields to main quest and factions**

For `quest_main_01`, add `world_effects` for key stages without changing quest mechanics.

For guard/town/shadow factions, add `information_network` and `reaction_policy`.

- [ ] **Step 6: Run loader tests**

Run: `bun test src/codex/loader.test.ts`

Expected: PASS.

## Task 5: Mechanical migrate remaining codex files by type

**Files:**
- Modify: all remaining YAML files under `world-data/codex` except `relationships.yaml` and `guard-dialogue.yaml`
- Modify: `world-data/codex/relationships.yaml`
- Test: `src/codex/loader.test.ts`
- Test: `src/codex/schemas/relationship.test.ts`

- [ ] **Step 1: Add full migration completeness tests**

Test that all loaded codex entries have at least `player_facing.short_label` or a documented exemption, and all first-party entries have declared `ai_grounding`.

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test src/codex/loader.test.ts src/codex/schemas/relationship.test.ts`

Expected: FAIL because remaining files are not migrated.

- [ ] **Step 3: Migrate backgrounds.yaml**

Add conservative `player_facing`, `ai_grounding`, and `ecology.belief_hooks` for character-origin reactions. Run the migration completeness test and expect only remaining file groups to fail.

- [ ] **Step 4: Migrate enemies.yaml**

Add conservative `player_facing`, `ai_grounding`, and `ecology` for enemy narrative meaning and loot implications. Run tests and expect remaining file groups to fail.

- [ ] **Step 5: Migrate items.yaml**

Add conservative `player_facing.short_label`, `ai_grounding`, and item-related `belief_hooks` where obvious. Run tests and expect remaining file groups to fail.

- [ ] **Step 6: Migrate history_events.yaml**

Add `ai_grounding`, reveal policy, and `ecology.facts_seeded` / `rumors_seeded` for durable world facts. Run tests and expect remaining file groups to fail.

- [ ] **Step 7: Migrate races.yaml, professions.yaml, and spells.yaml**

Add conservative common blocks. Do not invent new mechanics. Run tests and expect only companion files to fail.

- [ ] **Step 8: Migrate relationships.yaml**

Add relationship v2 fields where useful:

```yaml
ai_grounding:
  must_know: [...]
  must_not_invent: []
ecology:
  belief_hooks: []
```

- [ ] **Step 9: Add guard-dialogue companion validation**

If no schema exists, add a lightweight test that `guard-dialogue.yaml` options include player-facing labels and grounding hints sufficient for character creation.

- [ ] **Step 10: Run tests to verify pass**

Run: `bun test src/codex/loader.test.ts src/codex/schemas/relationship.test.ts`

Expected: PASS.

## Task 6: Runtime integration for player-facing UI

**Files:**
- Modify: `src/engine/scene-manager.ts`
- Modify: UI panels if action labels currently expose raw IDs
- Test: `src/engine/scene-manager.test.ts`
- Test: relevant UI panel tests

- [ ] **Step 1: Write failing runtime tests**

Add tests proving:

- Scene action labels use `player_facing.interactables.visible_name` when available.
- Scene narration context prefers `player_facing.first_visit/revisit` over raw `description` when available.
- Raw object IDs such as `notice board tavern` do not appear in suggested actions when v2 fields exist.

- [ ] **Step 2: Run tests to verify failure**

Run targeted scene/prompt/UI tests.

Expected: FAIL because runtime still uses mostly `description` and object IDs.

- [ ] **Step 3: Implement player-facing UI field usage**

Update scene/action generation to prefer:

- `player_facing.short_label`
- `player_facing.interactables[].visible_name`
- `player_facing.interactables[].affordance`

Keep fallback to current behavior for old data.

- [ ] **Step 4: Run targeted tests**

Run scene/UI tests.

Expected: PASS.

## Task 7: Runtime integration for AI grounding

**Files:**
- Modify: `src/ai/prompts/narrative-system.ts`
- Modify: `src/ai/prompts/npc-system.ts`
- Modify: `src/ai/utils/context-assembler.ts`
- Test: corresponding prompt/context tests

- [ ] **Step 1: Write failing AI grounding tests**

Add tests proving:

- Narrative prompt receives `ai_grounding.must_know`, `must_not_invent`, and `tone` separately from codex `description`.
- NPC prompt receives `voice`, `social_memory`, and reveal policy when present.
- `description` remains fallback for old entries.

- [ ] **Step 2: Run tests to verify failure**

Run exact prompt/context tests.

Expected: FAIL because AI prompt assembly still uses mostly `description`.

- [ ] **Step 3: Implement grounding context assembly**

Update context assembly and prompt builders to carry structured grounding fields. Do not expose AI-only hidden content in player-facing text.

- [ ] **Step 4: Run targeted tests**

Expected: PASS.

## Task 8: Runtime ecological seed/effect integration

**Files:**
- Modify: `src/engine/world-memory-recorder.ts`
- Modify: ecological memory tests
- Test: `src/engine/world-memory-recorder.test.ts`

- [ ] **Step 1: Write failing world-data ecology tests**

Add tests proving:

- `ecology.facts_seeded` inserts runtime `WorldFact` through generated system `WorldEvent` provenance.
- `ecology.rumors_seeded` inserts runtime `WorldFact` with `truthStatus: rumor`, required confidence, and seed provenance.
- static seed idempotency uses `world_data_seed:{entryId}:{factOrRumorId}`.
- `quest.world_effects.on_stage_enter` creates facts/rumors/beliefs using the triggering quest-stage event provenance, not static seed provenance.

- [ ] **Step 2: Run tests to verify failure**

Run `bun test src/engine/world-memory-recorder.test.ts`.

Expected: FAIL because world-data ecology seeds/effects are not consumed.

- [ ] **Step 3: Implement seed/effect mapping**

Add minimal functions that translate authoring `ecology` and `world_effects` into runtime `WorldFact` / `NpcBelief` via existing world memory APIs. Keep these deterministic.

- [ ] **Step 4: Run tests to verify pass**

Expected: PASS.

## Task 9: Validation and audit tools

**Files:**
- Create or modify test files under `src/codex`
- Optional script under `scripts/` only if needed

- [ ] **Step 1: Add audit tests**

Add tests for:

- every object ID in locations has a player-facing affordance or codex display fallback.
- every migrated NPC has `voice` and `knowledge_profile` or documented exemption.
- every quest stage has `world_effects` or explicit `world_effects_none: true`.
- no player-facing field contains obvious AI-only secret markers.
- `narrative-transitions.yaml` stage IDs match quest stage IDs.
- `narrative-transitions.yaml` world flags do not contradict quest `world_effects`.
- `location_context.state_overrides` keys are valid narrative/world flag keys or documented narrative state keys.
- `world-manifest.json.worldDataSchema` matches expected schema version.

- [ ] **Step 2: Run tests to verify failure**

Run codex/audit tests.

Expected: FAIL until migration is complete.

- [ ] **Step 3: Fix data or exemptions**

Add missing v2 fields or explicit exemptions. Do not weaken tests unless a clear documented exception exists.

- [ ] **Step 4: Run audit tests**

Expected: PASS.

## Task 10: Full verification

- [ ] **Step 1: Run codex-focused tests**

Run:

```bash
bun test \
  src/codex/loader.test.ts \
  src/codex/schemas/entry-types-v2.test.ts \
  src/codex/schemas/relationship.test.ts \
  src/codex/world-manifest.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run prompt and runtime tests**

Run relevant prompt and scene tests.

Expected: PASS.

- [ ] **Step 3: Run full suite**

Run: `bun test`

Expected: PASS with `0 fail`.

- [ ] **Step 4: Run typecheck**

Run: `bun run typecheck`

Expected: `tsc --noEmit` exits 0.

- [ ] **Step 5: Run build**

Run: `bun run build`

Expected: bundle succeeds.

- [ ] **Step 6: Manual smoke test**

If possible, run the game and verify:

- action labels show human-readable object names,
- first/revisit location descriptions feel distinct,
- NPC voice is more consistent,
- prompt output does not reveal hidden AI-only content,
- ecological memory can seed facts/rumors from world-data where implemented.

- [ ] **Step 7: Final summary**

Summarize:

- schema additions,
- migrated files,
- runtime integrations,
- validation tests,
- deferred content-quality work.

Do not commit unless explicitly requested.
