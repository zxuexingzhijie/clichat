# Phase 1: Foundation - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the game engine skeleton: command parsing (structured + NL intent), deterministic Rules Engine, immutable game state with multi-store architecture, CLI four-panel layout with adaptive rendering, and World Codex YAML schema with epistemic metadata system. Phase 1 delivers a wired-up shell with placeholder gameplay data — no actual game content or AI narration yet.

</domain>

<decisions>
## Implementation Decisions

### CLI Panel Layout
- **D-01:** Adaptive layout — vertical stack when terminal < 100 columns, side-by-side split when >= 100 columns
- **D-02:** Single outer border wrapping entire screen (`┌─┤└` style), horizontal dividers (`├───┤`) between sections — not individual panel borders
- **D-03:** Title bar: game name left-aligned, time/day info right-aligned
- **D-04:** Scene panel: narration text area (largest panel)
- **D-05:** Status bar: single-line `HP/MP/Gold/Location/Quest` format
- **D-06:** Actions panel: vertical numbered list with `❯` cursor selection (like Claude Code / Superpower option style), keyboard hints at bottom (`↑↓ 选择  Enter 确认  / 输入自定义行动`)
- **D-07:** Input area: `>` prompt at bottom, `/` prefix switches from action selection to free-form input
- **D-08:** AI dynamically generates 3-5 recommended actions per scene change (Phase 1 uses placeholder actions)
- **D-09:** Figlet ASCII art title screen with gradient-string on launch, press any key to enter game
- **D-10:** Auto-detect terminal background color and adapt color scheme accordingly
- **D-11:** Phase 1 uses placeholder data in all panels to validate layout and resize behavior

### Rules Engine Model
- **D-12:** Core dice system: D20-based with multiple adjudication modes
- **D-13:** Normal actions: D20 + attribute + skill + environmental modifiers vs DC
- **D-14:** Opposed actions: both sides roll D20 + attribute + skill, compare results
- **D-15:** Probability actions: percentage-based checks
- **D-16:** Plot-critical actions: graded success results (graduated outcomes affect AI narration branches)
- **D-17:** Three-attribute system: 体魄 (Physique), 技巧 (Finesse), 心智 (Mind) — covering physical contests, precision actions, and cognitive/social/magical behavior respectively
- **D-18:** Character differentiation through background, profession, equipment, status, and experience tags — not attribute stacking
- **D-19:** Combat damage: weapon base damage + attribute modifier + success grade bonus - armor reduction
- **D-20:** Default: full check display showing roll value, attribute modifier, tag modifier, environmental modifier, target DC, and final result — for rule transparency and player trust
- **D-21:** Reserve "immersion mode" toggle: collapses check details to success/failure only, weaving process into AI narration
- **D-22:** AI handles narration expression only, never final adjudication

### NL Intent Recognition
- **D-23:** Core intent set for Phase 1: move, look, talk, attack, use_item, cast, guard, flee, inspect, trade (10 categories)
- **D-24:** Zod structured intent output. Provider-native structured outputs preferred (OpenAI Structured Outputs, Anthropic tool calling), fallback to tool calling with schema validation error retry
- **D-25:** Validation chain: Intent Classifier → Zod schema validation → domain rule validation → confidence gating → Rules Engine. Rules Engine NEVER consumes raw model output
- **D-26:** On schema validation failure: max 1 repair retry
- **D-27:** On invalid target/illegal action/low confidence: enter clarification flow or return candidate actions
- **D-28:** Unrecognized intent: notify player with friendly message + show recommended actions list for selection

### World Codex Schema
- **D-29:** Eight entry types for Phase 1: race, profession, location, faction, npc, spell, item, history_event — complete schema with all required/optional fields defined per type
- **D-30:** Epistemic Metadata System per codex entry — not just authority level but multi-dimensional credibility:
  - `authority`: 6-level — canonical_truth, established_canon, regional_common_knowledge, institutional_doctrine, scholarly_dispute, street_rumor
  - `truth_status`: true, false, partially_true, misleading, unknown, contested, propaganda, mythic
  - `scope`: global, kingdom_wide, regional, local, faction_internal, personal, ancient, forbidden (+ scope_ref for specific location/group)
  - `visibility`: public, discovered, hidden, secret, forbidden — prevents AI spoilers; hidden/secret entries only revealed through investigation/quests/checks
  - `confidence`: 0.0–1.0 float — directly influences AI narration tone ("确实" vs "据说" vs "传闻")
  - `source_type`: authorial, official_record, ancient_text, oral_history, npc_memory, faction_claim, street_rumor, player_found, system_event (+ source_bias field)
  - `known_by`: list of entity IDs (NPCs, factions, locations) who know this information — drives NPC cognition boundaries
  - `contradicts`: list of codex entry IDs with conflicting claims — supports multi-version history
  - `volatility`: stable, evolving, deprecated — tracks whether entry may change through gameplay
- **D-31:** Typed relationship graph: entities store basic attributes + description only; all cross-entity associations expressed as independent relationship edges with source_id, target_id, relation_type, visibility, strength, status, evidence, and note fields
- **D-32:** Minimum example data for Phase 1: 1-2 entries per type + example relationship edges — sufficient to validate schema, Zod validation, and query logic

### State Management
- **D-33:** Multi-store architecture: separate stores (PlayerStore, SceneStore, CombatStore, etc.) each managing their own domain
- **D-34:** Each store independently serializes/deserializes — save files composed from individual store snapshots
- **D-35:** All store updates use immer `produce()` globally for consistent immutability
- **D-36:** Typed domain event bus: all store state changes publish typed domain events (not generic "state changed"). UI, save manager, AI narrator, quest system, and logging system subscribe to relevant events. mitt as underlying event bus, wrapped with typed domain event layer

### Command Parsing
- **D-37:** Command prefix: `/` (not `:` as originally in CLAUDE.md) — `/look`, `/go north`, `/talk NPC`, `/attack`
- **D-38:** No command aliases/abbreviations — full command names only
- **D-39:** Default input mode: natural language. Typing `/` switches to command mode. Auto-detection: input starting with `/` is a command, otherwise goes through NL intent classification
- **D-40:** `/help` command shows all available commands + Tab completion for command names and parameters (NPC names, directions, item names)

### Claude's Discretion
- Graded success level count and thresholds (recommended: 5-level with nat20/nat1 critical)
- Exact figlet font choice and gradient color scheme
- Status bar field ordering and overflow behavior
- Tab completion implementation details (Commander.js integration approach)
- Store naming conventions and granularity beyond the core stores listed

</decisions>

<specifics>
## Specific Ideas

- CLI layout mockup provided by user — must match this visual style:
  ```
  ┌─ Chronicle CLI ──────────────────────────────── Day 1 / Night ─┐
  │ 雨夜的黑松镇北门前，守卫的油灯在风中摇晃。                       │
  │ 告示牌上贴着一张新悬赏令，墨迹被雨水晕开。                       │
  ├─────────────────────────────────────────────────────────────────┤
  │ HP 30/30  MP 8/8  Gold 12  Location: 黑松镇·北门  Quest: None  │
  ├─────────────────────────────────────────────────────────────────┤
  │ Actions                                                         │
  │   1. 仔细阅读告示                                                │
  │ ❯ 2. 向守卫询问最近的失踪事件                                    │
  │   3. 绕到城墙阴影处观察                                          │
  │   4. 打开地图                                                    │
  │ ↑↓ 选择    Enter 确认    / 输入自定义行动                        │
  ├─────────────────────────────────────────────────────────────────┤
  │ >                                                               │
  └─────────────────────────────────────────────────────────────────┘
  ```
- Actions panel feels like Claude Code / Superpower selection UI — vertical numbered options with cursor
- Design philosophy: "骰子管命运，Codex 管真相，NPC 管偏见" (Dice govern fate, Codex governs truth, NPCs govern bias)
- Narrative priority over number simulation — three attributes + tags, not six-attribute stat sheets
- World Codex example entries (黑松镇狼灾 + hidden truth) demonstrate the epistemic metadata system in action
- Full check display example: `[D20: 14] + 体魄 3 = 17 vs DC 15 → 成功！`

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project design
- `CLAUDE.md` — Full architecture spec: layer model, dual-input system, RAG strategy, multi-model strategy, world content organization, CLI UX principles, technology stack
- `deep-research-report (1).md` — Comprehensive product design doc covering gameplay, AI roles, RAG strategy, CLI UX, and roadmap

### Reference implementation
- `claude-code-main/` — Claude Code source snapshot: Skills system, tool-based retrieval pattern, terminal UI (React + Ink), custom store pattern (`src/state/store.ts`), Ink rendering (`src/ink.ts`)

### Requirements
- `.planning/REQUIREMENTS.md` §Core Engine — CORE-01 through CORE-04 requirements for Phase 1
- `.planning/REQUIREMENTS.md` §CLI UX — CLI-01 requirement for four-panel layout
- `.planning/REQUIREMENTS.md` §World Data — WORLD-01 requirement for YAML codex schema

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- No existing source code — greenfield project

### Established Patterns
- Claude Code reference in `claude-code-main/`: custom createStore pattern (~35 lines), React + Ink + ThemeProvider wrapping, Skills as scoped prompt templates

### Integration Points
- Bun runtime as entry point
- Commander.js for command routing
- React + Ink for terminal rendering
- mitt for event bus
- immer for immutable state updates
- Zod for schema validation (codex + intent output + game state)
- AI SDK v5 for NL intent classification

</code_context>

<deferred>
## Deferred Ideas

- Command aliases/abbreviations — revisit if user feedback demands faster input
- Immersion mode (collapsed check display) — UI toggle, implement when AI narration is live (Phase 2)
- Store migration/versioning for save file format evolution — Phase 3 (save/load)

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-20*
