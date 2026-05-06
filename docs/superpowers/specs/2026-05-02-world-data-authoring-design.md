# World-data Authoring System v2 Design

## Goal

Refactor Chronicle's `world-data` from loose lore YAML into a coherent authoring system that supports three consumers at the same time:

1. **Player experience** — vivid, consistent, player-facing descriptions.
2. **AI grounding** — structured context that tells models what to use, what to avoid, and what must remain hidden.
3. **Ecological memory** — facts, rumors, beliefs, and propagation hooks that feed the runtime world-memory system.

This is a full `world-data` design, not just a prose rewrite. Implementation should still happen in phases: schema first, mechanical migration second, quality rewriting third, and runtime integration last.

## Scope

### In scope

Codex entry files loaded by `loadAllCodex()`:

- `backgrounds.yaml`
- `enemies.yaml`
- `factions.yaml`
- `history_events.yaml`
- `items.yaml`
- `locations.yaml`
- `npcs.yaml`
- `professions.yaml`
- `quests.yaml`
- `races.yaml`
- `spells.yaml`

Companion world-data files with separate treatment:

- `relationships.yaml` — relationship graph data, not a `CodexEntry`.
- `guard-dialogue.yaml` — character-creation dialogue authoring, not a `CodexEntry`.
- `narrative-transitions.yaml` — narrative state transitions; stays separate but must be coordinated with quest `world_effects` and location state overrides.
- `world-manifest.json` — should track data/schema version and migration status.

### Out of scope

- `ai-config.yaml` is runtime/model configuration, not world content. Do not migrate it into authoring schema.
- Replacing YAML with a database.
- Building an editor UI.
- Adding vector search/embeddings.

## Current Problems

The current files in `world-data/codex` already define useful entities, but the information is too compressed into generic fields:

- `description` is overloaded: it serves UI labels, scene prose, AI context, and sometimes hidden lore.
- `epistemic` marks authority/visibility, but does not explain how the AI should use or reveal the content.
- NPCs have `knowledge_profile`, but locations, quests, items, factions, and history events do not have equivalent grounding/reveal rules.
- Quest stages express triggers and objectives, but not enough world-state consequences, rumor creation, belief updates, or memory hooks.
- Objects like `notice_board`, `fireplace`, `barrel`, and `signpost` appear as raw IDs unless their codex entries provide good display/interaction guidance.
- The ecological memory system needs structured seeds (`WorldFact`, `NpcBelief`, propagation), but current authoring data does not consistently provide them.

## Design Principles

- **Do not delete existing `description` or `epistemic`.** They remain compatibility fields.
- **Separate player-facing prose from AI-only grounding.** Anything hidden or spoilery must not live in generic `description`.
- **Make every entity explain how it should be used.** Locations, NPCs, quests, factions, items, enemies, races, professions, backgrounds, spells, and history events need usage metadata at either common-block or type-specific level.
- **Prefer structured hooks over prompt prose.** Facts, rumors, reveal conditions, and propagation rules should be data, not buried in text.
- **Full migration, staged rollout.** Every world-data file gets a defined v2 strategy, but high-quality rewriting starts with core Blackpine content.
- **Keep YAML human-editable.** No database or opaque generated files in this pass.
- **Loader compatibility first.** Old YAML must load; new fields must be preserved by Zod parsing.

## Common CodexEntry v2 Blocks

Every codex entry keeps the current base fields:

```yaml
id: loc_north_gate
name: 黑松镇·北门
type: location
tags: [...]
description: Stable short summary for lists and fallback UI
epistemic: ...
```

Then entries may add these optional blocks.

### `player_facing`

Controls what the player can see/read directly.

```yaml
player_facing:
  first_visit: >
    第一次进入时的完整场景叙事。
  revisit: >
    再次进入时的短描述。
  short_label: 北门
  sensory:
    sights:
      - 石砌城门两侧油灯摇晃
    sounds:
      - 守卫长矛轻敲石板
    smells:
      - 冷空气里有松脂和油烟味
  interactables:
    - id: notice_board
      visible_name: 公告栏
      affordance: 可以查看悬赏、通缉令和镇民告示
```

Rules:

- `first_visit` is vivid but not too long.
- `revisit` is short and avoids repeated exposition.
- `sensory` gives the narrative model concrete details to recombine.
- `interactables` prevents raw IDs like `notice board tavern` from leaking into UI.

### `ai_grounding`

Controls what AI should know when using this entry.

```yaml
ai_grounding:
  must_know:
    - 这里是黑松镇北门，是进入城镇的主要入口
    - 守卫会盘查可疑旅人，但不会无故阻拦
  must_not_invent:
    - 不要说这里有王都军队驻扎
    - 不要直接透露镇长五年前的秘密
  tone:
    - 边境小镇
    - 表面平静
    - 夜晚寒冷
  reveal_policy:
    default: public_surface_only
    hidden_until:
      - quest_stage: stage_mayor_secret
```

Rules:

- `must_know` is grounding context, not player-facing prose.
- `must_not_invent` is a model guardrail.
- `tone` drives style and atmosphere.
- `reveal_policy` prevents spoilers from leaking early.
- `description` remains fallback, not primary AI context after v2 integration.

### `ecology`

Connects static world-data to runtime ecological memory.

```yaml
ecology:
  facts_seeded:
    - id: fact_blackpine_north_gate_is_guarded
      statement: 黑松镇北门由守卫日夜值守
      scope: location
      scopeId: loc_north_gate
      truthStatus: confirmed
      confidence: 1.0
      tags: [blackpine, guard]
  rumors_seeded:
    - id: rumor_missing_miner_notice
      statement: 公告栏上贴着失踪矿工王二的悬赏
      scope: location
      scopeId: loc_north_gate
      confidence: 0.65
      tags: [missing_miner, notice_board]
      spread: [loc_tavern, loc_market, faction_guard]
      starts_at_stage: stage_rumor
  belief_hooks:
    - when: player_asks_about_missing_people
      holderId: npc_bartender
      holderType: npc
      subjectId: player
      stance: believes
      statement: 玩家正在调查失踪事件
      confidence: 0.7
      decay: normal
      tags: [missing_people]
  propagation:
    default_visibility: same_location
    faction_scope: faction_guard
```

Authoring-to-runtime mapping:

- `facts_seeded` maps to runtime `WorldFact`.
  - `truthStatus` defaults to `confirmed` if omitted.
  - `scopeId` defaults to the enclosing entry ID when omitted.
  - `confidence` is required for authored facts unless a type-specific default is documented.
  - provenance should come from a generated system `WorldEvent` with idempotency key `world_data_seed:{entryId}:{factId}`; the runtime `WorldFact.sourceEventIds` stores that generated event ID.
  - `createdAt` / `updatedAt` are generated when seeds are inserted.
- `rumors_seeded` maps to runtime `WorldFact` with `truthStatus: rumor`.
  - `confidence` is required; suggested range is `0.4` to `0.8` depending on source credibility.
  - `scopeId` defaults to the enclosing entry ID when omitted.
  - provenance follows the same generated system `WorldEvent` rule as `facts_seeded`, using idempotency key `world_data_seed:{entryId}:{rumorId}`; runtime `sourceEventIds`, `createdAt`, and `updatedAt` are generated from that seed event.
  - `spread` is authoring metadata used by propagation rules and does not become a runtime `WorldFact` field.

- `belief_hooks` maps to runtime `NpcBelief` when the named trigger condition occurs.
  - `sourceEventIds` and `lastReinforcedTurn` are generated from the triggering event.
- `propagation` defines default visibility and spread rules for runtime events produced from the entry.

## Type-specific Extensions

### Locations

Locations should define scene usability:

```yaml
location_context:
  travel_role: town_gate | social_hub | danger_zone | service | mystery_site
  default_actions:
    - talk
    - inspect
    - move
  state_overrides:
    act3_confrontation:
      player_facing_override: ...
      ai_tone_override: ...
```

Relationship to current `description_overrides`:

- Existing `description_overrides` remains supported for compatibility.
- New `location_context.state_overrides` becomes the v2 structure.
- During migration, existing `description_overrides` should be copied into `state_overrides.*.player_facing_override` where possible.
- Runtime should prefer v2 overrides when present, then fallback to existing `description_overrides`, then fallback to `player_facing` / `description`.

Use for:

- `SceneManager` suggested actions.
- `NarrativeDirector` scene grounding.
- `MapPanel` labels/details.
- World memory location facts.

### NPCs

NPCs should define voice, reveal rules, and belief behavior:

```yaml
voice:
  register: 粗粝、直接、边境口音
  sentence_style: 短句为主，偶尔压低声音
  verbal_tics:
    - “听着”
    - “别往外说”

knowledge_profile:
  always_knows: [...]
  hidden_knowledge: [...]
  trust_gates: [...]

social_memory:
  remembers:
    - favors
    - threats
    - secrets
  shares_with:
    - faction_guard
  secrecy: cautious
```

Use for:

- `NpcActor` prompt building.
- Dynamic dialogue option generation.
- Ecological belief propagation.

### Quests

Quests should declare consequences, not only triggers:

```yaml
world_effects:
  on_stage_enter:
    stage_mayor_secret:
      facts_created:
        - id: fact_mayor_secret_suspected
          statement: 镇长可能隐瞒了五年前灾难的真相
          scope: quest
          scopeId: quest_main_01
          truthStatus: rumor
          confidence: 0.75
          tags: [mayor_secret, act2]
      rumors_created:
        - id: rumor_mayor_knows_more
          statement: 镇长知道的比他承认的更多
          scope: location
          scopeId: loc_main_street
          confidence: 0.6
          spread: [loc_tavern, loc_market]
          tags: [mayor_secret]
      beliefs_created:
        - holderId: npc_captain
          holderType: npc
          subjectId: npc_elder
          stance: believes
          statement: 镇长隐瞒了五年前的真相
          confidence: 0.8
  on_complete:
    facts_created: [...]
    faction_reputation: [...]
```

Rules:

- `facts_created` and `rumors_created` must be inline objects or references to IDs declared in the same quest's `ecology.facts_seeded` / `ecology.rumors_seeded`.
- If an ID reference cannot be resolved during validation, loading should fail in first-party data.
- Inline `facts_created` and `rumors_created` use the triggering quest-stage `WorldEvent` as provenance, not the static `world_data_seed` event. Their runtime `sourceEventIds` contains the quest-stage event ID; `createdAt` and `updatedAt` use that event timestamp.
- ID references to `ecology.facts_seeded` / `ecology.rumors_seeded` reuse the referenced statement/scope/confidence/tags, but still use the triggering quest-stage event as provenance when created by `world_effects`.
- Static `world_data_seed:{entryId}:{factId}` provenance is only for facts/rumors inserted at load/seed time, not for stage-triggered effects.
- `beliefs_created` follows `belief_hooks` runtime mapping rules and receives `sourceEventIds` / `lastReinforcedTurn` from the quest-stage event.

Relationship to `narrative-transitions.yaml`:

- `narrative-transitions.yaml` remains the macro act/atmosphere/world-flag transition source.
- `quest.world_effects` becomes the content-level consequence source for facts, rumors, and beliefs.
- If both define effects for the same stage, narrative transitions update `narrativeState`; quest world effects update ecological memory.
- Later, `narrative-transitions.yaml` may be compiled from quest metadata, but not in the first migration.

### Factions

Factions should define information networks and reaction policy:

```yaml
information_network:
  hears_from:
    - loc_tavern
    - loc_market
  spreads_to:
    - npc_guard
    - npc_captain
  rumor_threshold: medium

reaction_policy:
  player_helped: reputation_up
  player_threatened: reputation_down
  player_exposed_secret: split_internal_response
```

Use for:

- faction-held `NpcBelief`.
- rumor propagation.
- reputation and dialogue tone.

### Items and Enemies

Items and enemies should tell AI what they mean narratively:

```yaml
ai_grounding:
  must_know:
    - 狼皮是森林狼掉落物，可作为猎人/商人线索
  must_not_invent:
    - 不要让普通狼皮证明古代仪式存在

ecology:
  facts_seeded: []
  belief_hooks:
    - when: player_carries_item
      holderId: npc_hunter
      holderType: npc
      stance: believes
      statement: 玩家最近在北林猎杀过狼
      confidence: 0.8
```

Use for:

- loot narration.
- inspection text.
- NPC reactions to inventory.

### Races, Professions, Backgrounds, Spells, History Events

These types use the common v2 blocks unless they need future specialization.

Recommended additions:

- `races.yaml`: `player_facing`, `ai_grounding`, optional `ecology.facts_seeded` for common-world perceptions of the race.
- `professions.yaml`: `player_facing`, `ai_grounding`, optional `social_memory`-like reaction hooks via `ecology.belief_hooks`.
- `backgrounds.yaml`: `player_facing`, `ai_grounding`, `ecology.belief_hooks` for NPC reactions to player origin.
- `spells.yaml`: `player_facing`, `ai_grounding.must_not_invent`, optional ecological consequences for forbidden/visible magic.
- `history_events.yaml`: `ai_grounding`, `ecology.facts_seeded`, and reveal policy. History events are especially useful for seeding `WorldFact` and rumors.

### Relationships

`relationships.yaml` is not a `CodexEntry`, so it needs a separate v2 companion schema rather than base fields.

Existing fields remain:

```yaml
source_id: npc_guard
target_id: npc_captain
relation_type: subordinate
visibility: public
strength: 0.8
status: active
evidence: ...
note: ...
```

Optional v2 fields:

```yaml
ai_grounding:
  must_know:
    - 北门守卫服从陈铁柱的巡逻安排
  must_not_invent: []
ecology:
  belief_hooks:
    - when: source_hears_reputation_change
      holderId: npc_captain
      holderType: npc
      statement: 下属报告了玩家的异常行为
```

### Guard Dialogue

`guard-dialogue.yaml` remains a specialized character-creation authoring file.

Add a companion spec/test, not CodexEntry blocks:

- how each round maps to player-facing question text,
- how each option maps to background/race/profession weights,
- how each option contributes to AI grounding for the guard's next response,
- how selected options can create initial ecological facts/beliefs about the player.

### World Manifest

`world-manifest.json` should track data/schema versions:

```json
{
  "version": "1.2.0",
  "gameVersion": "1.5.0",
  "worldDataSchema": "2.0.0",
  "migration": "world-data-authoring-v2"
}
```

Use for:

- migration tests,
- data pack compatibility,
- future mod/content validation.

## System Integration

### Loader and schema

Update `src/codex/schemas/entry-types.ts` to add optional v2 blocks to base entries.

Compatibility rules:

- All old YAML remains valid.
- New fields are optional at first.
- Zod must preserve new fields. Tests must prove `loadCodexFile()` returns `player_facing`, `ai_grounding`, and `ecology` rather than stripping them.
- Unknown field policy must be explicit:
  - For first-party `world-data`, prefer strict known fields after migration.
  - During transition, use declared optional v2 fields rather than `passthrough` catch-alls.

### Narrative Director

Narration should prefer:

1. `player_facing.first_visit` / `revisit` for direct scene prose.
2. `player_facing.sensory` for concrete atmospheric details.
3. `ai_grounding.must_know` for factual grounding.
4. `ai_grounding.must_not_invent` as constraints.
5. `ecology` only as structured runtime memory input, not raw exposition.

Grounding contract:

```ts
type GroundedCodexContext = {
  id: string;
  playerFacing?: {
    shortLabel?: string;
    sceneText?: string;
    sensory?: string[];
    interactables?: { id: string; visibleName: string; affordance?: string }[];
  };
  aiGrounding?: {
    mustKnow: string[];
    mustNotInvent: string[];
    tone: string[];
    revealPolicy?: unknown;
  };
};
```

`description` remains fallback when v2 fields are absent.

### NPC Actor

NPC prompts should use:

- `voice` for style.
- `knowledge_profile` for what the NPC knows.
- `ai_grounding.reveal_policy` for secrecy.
- `social_memory` for remembering/sharing behavior.
- ecological `belief_hooks` for runtime belief creation.

### Ecological Memory

`ecology` blocks provide seeds and rules for:

- `WorldFact`
- `NpcBelief`
- rumor creation
- propagation
- quest consequences

Static world-data does not replace runtime memory. It defines what can happen and how to interpret runtime events.

### UI

UI should use player-facing fields only:

- `short_label` for maps/action lists.
- `first_visit` / `revisit` for scene text.
- `interactables.visible_name` and `affordance` for action labels.
- Do not display `ai_grounding`, `secrets`, or raw ecological rules.

## Migration Plan

### Phase 1: Schema support

- Add optional base blocks: `player_facing`, `ai_grounding`, `ecology`.
- Add type-specific optional blocks: `location_context`, `voice`, `social_memory`, `world_effects`, `information_network`, `reaction_policy`.
- Add relationship v2 schema support separately.
- Add guard dialogue companion validation separately.
- Keep all old data valid.
- Add tests for enriched location, NPC, quest, item, faction, race, profession, background, spell, history event, relationship entries.
- Add tests proving `loadCodexFile` preserves v2 fields.

### Phase 2: Mechanical full migration

Every codex YAML gets the new structure with conservative data:

- Move existing `description` into fallback summary.
- Add `player_facing.short_label` where UI labels currently show awkward IDs.
- Add minimal `ai_grounding.must_know` from current descriptions.
- Add empty `ecology` blocks where no runtime effect is defined yet.

Files included:

- `backgrounds.yaml`
- `enemies.yaml`
- `factions.yaml`
- `history_events.yaml`
- `items.yaml`
- `locations.yaml`
- `npcs.yaml`
- `professions.yaml`
- `quests.yaml`
- `races.yaml`
- `spells.yaml`

Companion files:

- `relationships.yaml` gets relationship v2 fields.
- `guard-dialogue.yaml` gets companion validation/spec.
- `narrative-transitions.yaml` remains independent and is cross-checked against quest `world_effects`.
- `world-manifest.json` gets schema version metadata.

### Phase 3: High-quality content rewrite

Prioritize:

1. Blackpine town locations: north gate, main street, tavern, blacksmith, market, temple.
2. Main story NPCs: guard, bartender, captain, elder, priestess, hunter, shadow contact.
3. Main quest stages and consequence routes.
4. Forest road / abandoned camp / dark cave.

### Phase 4: Runtime integration

- `SceneManager` uses `player_facing` and `interactables`.
- `NarrativeDirector` uses `ai_grounding` and sensory details.
- `NpcActor` uses `voice`, `social_memory`, and reveal policy.
- `WorldEventRecorder` and ecological memory use `ecology` and quest `world_effects`.

### Phase 5: Validation and audit

Add tools/tests for:

- every object ID has a display name or player-facing affordance,
- every NPC has voice and knowledge policy,
- every quest stage declares world impact or explicitly says none,
- every secret has reveal conditions,
- no `ai_grounding` secret appears in player-facing text,
- no raw IDs leak into suggested actions,
- `narrative-transitions.yaml` and quest `world_effects` do not contradict,
- `world-manifest.json` schema version matches the loader expectations.

## Acceptance Criteria

- Existing codex files still load.
- New v2 fields validate with Zod and survive `loadCodexFile`/`loadAllCodex`.
- All entity types have a documented authoring structure.
- Non-CodexEntry world-data files have explicit handling.
- Core Blackpine content has player-facing, AI-grounding, and ecology sections.
- Suggested action labels no longer expose raw IDs like `notice board tavern`.
- NPC prompts can use voice/knowledge/reveal policy without scraping generic descriptions.
- Ecological memory can seed facts, rumors, and beliefs from world-data.
- Runtime systems distinguish player-facing text from AI-only context.

## Risks

- **Large migration surface**: mitigate with optional fields and staged migration.
- **Prompt bloat**: use only relevant `ai_grounding` sections in retrieval.
- **Spoiler leaks**: enforce player-facing vs AI-only separation in tests.
- **Content inconsistency**: add validation for IDs, reveal conditions, and propagation hooks.
- **Over-authoring**: start with core Blackpine content before polishing every side item.
