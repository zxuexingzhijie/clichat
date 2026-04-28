# Phase 15: Content & Death Recovery - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning
**Mode:** --auto (all decisions auto-selected at recommended defaults)

<domain>
## Phase Boundary

Fill missing world content (notable_npcs arrays, dark cave encounter, shadow contact discovery) and implement death screen recovery option (load last save / return to title).

This phase does NOT add new game mechanics. It fixes content gaps and completes the death recovery UI.

</domain>

<decisions>
## Implementation Decisions

### Notable NPCs Content (CONT-01..04)

- **D-01:** `loc_north_gate` notable_npcs: add `npc_captain` and `npc_hunter` (currently only `npc_guard`)
- **D-02:** `loc_temple` notable_npcs: add `npc_herbalist` (currently only `npc_priestess`)
- **D-03:** `loc_main_street` notable_npcs: add `npc_elder` (currently empty `[]`)
- **D-04:** `loc_forest_road` notable_npcs: add `npc_hunter` (currently empty `[]`) — hunter patrols between forest and north gate
- **D-05:** `loc_abandoned_camp` and `loc_dark_cave` notable_npcs stay empty — these are encounter zones, not NPC conversation zones

### Dark Cave Encounter (CONT-05)

- **D-06:** Add enemy encounter to `loc_dark_cave` in locations.yaml — use existing `enemy_wolf` or wolf-type from enemies.yaml as the encounter enemy
- **D-07:** Encounter trigger pattern: when player enters `loc_dark_cave`, `scene_changed` event fires → combat loop initiates automatically (same pattern as existing `enemies` field on LocationSchema from Phase 12 / COMBAT-03)
- **D-08:** If LocationSchema already has `enemies` field (added in Phase 12), populate `loc_dark_cave.enemies` array with wolf encounter data. If not, add the field to the schema and populate it.

### Shadow Contact Discovery (CONT-04)

- **D-09:** `npc_shadow_contact` becomes visible at `loc_tavern` or `loc_main_street` after EITHER: (a) completing any dialogue with `npc_bartender`, OR (b) player has acquired relevant knowledge entry (`knowledge_shadow_contact` or similar flag)
- **D-10:** Implementation: listen for `dialogue_ended` with `targetId: npc_bartender` on the exploration-tracker or scene-manager; set a game flag `shadow_contact_revealed: true`; when flag is set, include `npc_shadow_contact` in the current scene's NPC list
- **D-11:** If no existing flag system for NPC visibility, add a `revealedNpcs: string[]` field to GameState or SceneState — NPC is shown only when its ID appears in `revealedNpcs`

### Death Screen Recovery (DEATH-01)

- **D-12:** Current death screen (`gameState.phase === 'game_over'`) shows only "按任意键返回标题". Replace with two explicit actions:
  1. **"返回标题"** — returns to title screen (existing behavior)
  2. **"载入最近存档"** — loads the most recent save file
- **D-13:** If no save exists when player dies: auto-create an emergency save just before the death is applied, so "载入最近存档" always has something to load. The emergency save should be named `[emergency]` or similar to distinguish it.
- **D-14:** Death screen UI: use existing `Box/Text` Ink components matching the current game_over layout. Add `Select` or two `Text` items with keybinding hints (e.g. `[R] 载入最近存档  [Q] 返回标题`).
- **D-15:** Key handling on death screen: `r` or `l` → load last save; `q` or any other key → return to title. Do NOT use the existing "press any key" handler — replace it with explicit key routing.

### Claude's Discretion

- Exact NPC position within location (whether npc_hunter appears at north_gate only vs forest_road too) — planner can adjust based on lore consistency
- Emergency save file naming convention
- Whether shadow contact discovery also requires a minimum reputation threshold (planner can add if it fits CONT-04 requirements cleanly)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### World Content
- `world-data/codex/locations.yaml` — Current notable_npcs arrays (most are empty or incomplete)
- `world-data/codex/npcs.yaml` — NPC definitions including npc_captain, npc_hunter, npc_herbalist, npc_elder, npc_shadow_contact
- `world-data/codex/enemies.yaml` — Enemy types for dark cave encounter

### Engine
- `src/engine/scene-manager.ts` — Scene change handling, NPC visibility logic
- `src/engine/exploration-tracker.ts` — May track which locations/NPCs have been visited
- `src/engine/action-handlers/index.ts` — HANDLER_MAP, combat initiation pattern

### State & UI
- `src/ui/screens/game-screen.tsx` lines 395-408 — Current game_over death screen (minimal, needs upgrade)
- `src/state/game-store.ts` — GameState shape (check for flags/revealedNpcs field)
- `src/codex/schemas/entry-types.ts` — LocationSchema (check for `enemies` field from Phase 12)

### No external specs — requirements fully captured in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `game-screen.tsx` game_over block (lines 395-408): already has the container layout; needs content replacement
- `enemies.yaml`: existing wolf-type enemies available for dark cave
- LocationSchema `enemies` field: added in Phase 12 (COMBAT-03) — likely already exists

### Established Patterns
- `notable_npcs` in locations.yaml: simple string array, planner just adds IDs
- `scene_changed` bus event: already fires on every location change — dark cave combat can subscribe to it
- Death screen: `gameState.phase === 'game_over'` guard already in place

### Integration Points
- `loc_dark_cave` in locations.yaml — add enemies array
- `loc_north_gate`, `loc_temple`, `loc_main_street`, `loc_forest_road` — add NPC IDs to notable_npcs
- `game-screen.tsx` game_over block — replace "press any key" with explicit recovery options
- SceneManager or ExplorationTracker — add shadow contact reveal logic on bartender dialogue

</code_context>

<specifics>
## Specific Ideas

- Death screen keybindings: `r`=load save, `q`=return title — consistent with vim-style single key navigation already used in the game
- Shadow contact: revealed after bartender dialogue (organic discovery, fits the bartender's role as information hub)

</specifics>

<deferred>
## Deferred Ideas

- Multiplayer NPC schedules (NPCs move between locations by time of day) — future phase
- Additional dark cave rooms or multi-room dungeon — future phase
- Shadow contact quest chain beyond discovery — already partially in quests.yaml (quest_side_overdue_debt chain)

</deferred>

---

*Phase: 15-content-death-recovery*
*Context gathered: 2026-04-28*
*Mode: --auto*
