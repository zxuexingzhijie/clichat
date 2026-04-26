# Phase 8: Narrative Character Creation - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the menu-based character creation wizard with an in-world cinematic guard intercept dialogue at 黑松镇北门. The player enters the game world immediately and defines their character through natural conversation with the guard NPC — no separate creation menu exists.

</domain>

<decisions>
## Implementation Decisions

### Guard Dialogue Flow
- **D-01:** AI-narrated + fixed options — guard asks questions with AI-generated prose (using NPC Actor role), player picks from fixed codex-mapped dialogue options. AI handles narration flavor; option→effect mapping is deterministic.
- **D-02:** 4 dialogue rounds matching current wizard structure: (1) origin → race, (2) livelihood → profession weights, (3) reason for visiting 黑松镇 → background weights, (4) secret → background weights + quest hooks.
- **D-03:** Each player selection triggers an AI-narrated guard response before the next question. 4 LLM calls during creation (one per answer). Uses existing NPC Actor AI role with npc_guard identity.
- **D-04:** Seamless transition — no confirmation screen after the 4th answer. Guard waves player through, game phase begins immediately. Guard's farewell line implicitly confirms the resolved character (e.g., "看你的样子像个法师…进去吧").

### Character Name Input
- **D-05:** Delayed free-text input — guard does NOT ask name first. After the initial identity questions (race/profession established), the guard asks for the player's name in a natural conversational context.
- **D-06:** Free-text input with validation: length check, empty input falls back to '旅人', Tab key generates a random name suggestion. No separate rename screen — name is part of the dialogue flow.

### App Phase Transition
- **D-07:** New `narrative_creation` value added to `GamePhaseSchema`. Flow: `title → narrative_creation → game` for new games, `title → game` for loaded saves. Title screen handles the branching.
- **D-08:** Old `CharacterCreationScreen` component and `character-creation-store.ts` are removed entirely. The engine (`character-creation.ts` with `buildCharacter`, `calculateAttributes`, codex queries) is preserved — the new guard scene calls it with the same interface after weight resolution.
- **D-09:** Load game bypasses guard scene entirely — title screen routes directly to `game` phase when restoring a save.

### Attribute Mapping (Deterministic Fragment Mapping)
- **D-10:** Each guard dialogue option maps to an `effects` object containing: attribute deltas, professionWeights, backgroundWeights, tags, and quest hooks. This is NOT a direct option→codex ID mapping — it's a weight accumulation system.
- **D-11:** Race is determined directly from the first question (origin). Profession and background are resolved AFTER all 4 questions by accumulating weights across all answers and picking the highest-weighted codex ID.
- **D-12:** Effects data lives in a standalone `guard-dialogue.yaml` file, decoupled from world codex data. This file defines the dialogue tree structure, per-option effects, and resolution rules.
- **D-13:** Tiebreaker rule — 4-layer deterministic resolution:
  1. Last answer's weight contribution to tied candidates (player's final self-expression has most influence)
  2. Question priority comparison (profession resolution weighs "livelihood" question higher; background resolution weighs "reason for visiting" higher)
  3. `archetypePriority` config defined in guard-dialogue.yaml (game designer's intended default archetypes)
  4. Codex definition order fallback (guaranteed deterministic)
- **D-14:** Guard summary line on resolution — when the guard waves the player through, the AI-narrated farewell references the resolved profession/race implicitly (e.g., "看你的样子像个法师"). No explicit stats display during creation; status bar shows full character sheet once GameScreen renders.

### Claude's Discretion
- AI prompt templates for the guard's narration style (tone, length, personality expression)
- Specific dialogue option text and flavor descriptions in guard-dialogue.yaml
- guard-dialogue.yaml schema design (exact field names, nesting structure)
- How the NarrativeCreationScreen component manages streaming of guard responses (can reuse Phase 7 streaming infrastructure)
- Random name generation strategy (name pool, algorithm)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Design
- `CLAUDE.md` — Layer model (Rules Engine owns state, AI writes prose), dual-input system, NPC Actor role definition, truth vs cognition separation
- `CLAUDE.md` §NPC Mind — NPC Actor inputs (identity, goals, memories, scene, player action) and outputs (dialogue, emotion tag, memory flag, relationship delta)

### Prior Phase Context
- `.planning/phases/02-core-gameplay/02-CONTEXT.md` — Original character creation decisions D-01 through D-06 (wizard flow, narrative attribute assignment, three attributes, background hooks). Phase 8 evolves D-01/D-02 from menu to in-world dialogue.

### Existing Engine Code
- `src/engine/character-creation.ts` — `createCharacterCreation()` API: `getAvailableRaces`, `getAvailableProfessions`, `getBackgroundHooks`, `calculateAttributes`, `buildCharacter`. Returns `PlayerState`. **Preserved and reused.**
- `src/state/player-store.ts` — `PlayerState` type (name, race, profession, hp, mp, gold, attributes, tags, equipment)
- `src/engine/dialogue-manager.ts` — Existing dialogue system (`startDialogue`, `endDialogue`)
- `src/ui/hooks/use-npc-dialogue.ts` — NPC dialogue hook with streaming (Phase 7)

### World Data
- `src/data/codex/npcs.yaml` — `npc_guard` (北门守卫) at `loc_north_gate`, personality: dutiful/cautious/honest
- `src/data/codex/locations.yaml` — `loc_north_gate` (黑松镇·北门) with connections to town_square, forest_edge
- `src/data/codex/races.yaml` — Playable races (race_human, race_elf, race_dwarf)
- `src/data/codex/backgrounds.yaml` — Background entries with `question`, `attribute_bias`, `starting_tags`

### App Flow
- `src/app.tsx` — Current phase routing: `title → character_creation → game`. Must be modified for `narrative_creation` phase.
- `src/state/game-store.ts` — `GamePhaseSchema` enum (needs `narrative_creation` addition)

### Requirements
- `.planning/REQUIREMENTS.md` — NCC-01 through NCC-04 (narrative creation requirements)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `character-creation.ts` engine — `buildCharacter()` takes `CharacterSelections` (name, raceId, professionId, backgroundIds) and returns full `PlayerState`. The new guard scene calls this after weight resolution produces the final IDs.
- `use-npc-dialogue.ts` — Phase 7 NPC dialogue streaming hook. Can be adapted for the guard's AI-narrated responses during creation.
- `npc_guard` codex entry — Already defined with location, personality, goals. No new NPC data needed.
- `loc_north_gate` — Already defined as starting location with appropriate description.
- Streaming infrastructure from Phase 7 — sentence buffer, typewriter effect, skip-to-end. Guard narration can reuse this.

### Established Patterns
- Store pattern: `createStore<T>(initial, onChange)` with immutable updates via immer
- Event bus: `mitt` for decoupled system communication (character_created event already exists)
- AI roles: Configured via `ai-config.yaml`, called through AI SDK generateText/generateObject
- Phase routing: `GamePhaseSchema` enum → conditional rendering in `AppInner`

### Integration Points
- `app.tsx` `AppInner` — Add `narrative_creation` phase branch, replace `handleStart` to route to new phase
- `game-store.ts` `GamePhaseSchema` — Add `narrative_creation` enum value
- `title-screen.tsx` — "New Game" → `narrative_creation`, "Load Game" → `game`
- `event-bus.ts` — `character_created` event already fires on creation complete
- New `guard-dialogue.yaml` — Must be loadable by the same codex/YAML infrastructure

</code_context>

<specifics>
## Specific Ideas

- Guard farewell line should reference the resolved character identity naturally (e.g., "看你的样子像个法师…进去吧") — not a stats dump
- Name input uses free-text within the dialogue flow, not a separate screen/modal
- The weight accumulation system should be fully traceable in tests: given these 4 answers → these weights → this profession/background
- guard-dialogue.yaml should be human-readable and game-designer-tunable, same as other codex YAML files

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-narrative-character-creation*
*Context gathered: 2026-04-25*
