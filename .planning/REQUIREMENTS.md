# Requirements: Chronicle

**Defined:** 2026-04-20
**Core Value:** The player must feel they are in a persistent, consistent world that remembers them — not a chatbot that reinvents the universe every turn.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Core Engine

- [ ] **CORE-01**: Player can enter structured commands (`:look`, `:go north`, `:talk NPC`, `:attack`) and receive deterministic parsing into game actions
- [ ] **CORE-02**: Player can enter free-form natural language and have it classified into structured intent (action type, targets, modifiers) via fast LLM
- [ ] **CORE-03**: Rules Engine adjudicates all mechanical outcomes (success/failure, damage, resource changes, relationship deltas) deterministically based on character stats, modifiers, and randomization — with zero LLM involvement
- [ ] **CORE-04**: All game state exists as a single serializable JSON tree with immutable updates, enabling complete snapshot/restore at any point

### AI System

- [ ] **AI-01**: Narrative Director generates 80–180 character Chinese prose per turn from adjudicated results + retrieved context, without inventing world facts or overriding game state
- [ ] **AI-02**: NPC Actor generates per-character dialogue informed by NPC identity, goals, current emotions, episodic memory, and scene context — each NPC only knows what they would know
- [ ] **AI-03**: Retrieval Planner decides which codex entries, NPC memories, and quest states to fetch for each turn, outputting a structured retrieval plan (not a prompt dump)
- [ ] **AI-04**: Background Summarizer compresses long sessions into chapter summaries and NPC memory notes without blocking interactive gameplay

### Gameplay

- [ ] **PLAY-01**: Player can create a character by choosing race, profession, and background, with corresponding base stats and starting equipment
- [ ] **PLAY-02**: Player can explore scenes with `:look`, `:inspect`, `:scan` — seeing environment description, NPCs present, exits, and interactable objects
- [ ] **PLAY-03**: Player can engage in NPC dialogue via `:talk` and `:ask` — NPCs respond with personality, memory of past interactions, and emotional state
- [ ] **PLAY-04**: Player can engage in turn-based combat via `:attack`, `:cast`, `:guard`, `:flee` — with deterministic resolution, HP/MP tracking, and narrated outcomes

### World Data

- [ ] **WORLD-01**: World Codex exists as tagged YAML files (races, locations, factions, spells, items, history events) with schema validation and required fields (id, tags, type, related_ids)
- [ ] **WORLD-02**: Per-NPC episodic memory stored as structured JSON, tagged with participants, locations, quest IDs, and emotional valence, retrieved by structured query
- [ ] **WORLD-03**: Player can accept, track progress on, and complete quests — with a `:journal` command showing active/completed/failed quests
- [ ] **WORLD-04**: Relationship system tracks player reputation with individual NPCs and factions, influencing NPC dialogue and quest availability

### Save & Branch

- [ ] **SAVE-01**: Player can quick save, named save (`:save "before the gate"`), and load any save — full game state serialized/restored
- [ ] **SAVE-02**: Player can branch storylines (`:branch name`) to explore alternative decisions, with branch tree visualization
- [ ] **SAVE-03**: Player can compare branches (`:compare main..branch/name`) seeing state differences (quests, relationships, inventory, location) as human-readable summary
- [ ] **SAVE-04**: Player can replay recent turns (`:replay N`) by reading stored turn log (not re-generating AI output)

### CLI UX

- [ ] **CLI-01**: Terminal displays four-panel layout: scene panel (narration + NPCs + exits), status bar (HP/MP/reputation/quest), suggested actions, and input area — responsive to terminal resize
- [ ] **CLI-02**: ASCII/Unicode region map accessible via `:map` showing current location, explored areas, exits, and points of interest
- [ ] **CLI-03**: World codex browser via `:codex` allowing search/browse of discovered lore entries (races, factions, locations, spells, items)
- [ ] **CLI-04**: Keyboard shortcuts: Tab completion for commands/NPC names, arrow key history, Ctrl-R history search, `?` quick help

### LLM Infrastructure

- [ ] **LLM-01**: Multi-provider abstraction layer supporting OpenAI, Anthropic, Google, Alibaba Qwen, and DeepSeek — with per-AI-role model routing configuration
- [ ] **LLM-02**: Token usage and estimated cost tracked per turn and per session, visible via `:cost` command
- [ ] **LLM-03**: Static prompt content (world rules, narrative style, character skeletons) cached/prefixed to reduce per-turn token costs
- [ ] **LLM-04**: Retrieved context tagged with epistemic level (world_truth, npc_belief, player_knowledge) — NPC Actors only receive information their character would know

### Content

- [ ] **CONT-01**: First region world pack: one region with 8-12 locations (towns, dungeons, wilderness), 3-4 factions, regional lore, danger levels
- [ ] **CONT-02**: Character system: 3-4 races with traits, 3-4 professions with abilities, 5-6 base stats, starting equipment per profession
- [ ] **CONT-03**: Quest content: one main quest skeleton (5-8 stages) and 5-8 reusable side quest templates with region/NPC/constraint parameters
- [ ] **CONT-04**: NPC content: 10-15 named NPCs with backstories, goals, relationships, initial memory seeds, and personality tags

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Multiplayer

- **MULT-01**: Shared spectator mode — one player acts, others watch and vote on suggestions
- **MULT-02**: Room-based cooperative campaign — multiple players in same scene, turn-based input
- **MULT-03**: Persistent world — asynchronous player impact on shared world state

### Advanced Content

- **ADV-01**: Content pack marketplace for community world packs, rule packs, story packs
- **ADV-02**: Mod/creator tools for authoring world codex entries, quest templates, NPC profiles
- **ADV-03**: Complex economy system with supply/demand, trade routes, crafting
- **ADV-04**: Advanced magic system with custom spell construction and school specialization

### Platform

- **PLAT-01**: Multimodal input (image recognition for maps/symbols, voice input)
- **PLAT-02**: Export/share story as formatted document or web page
- **PLAT-03**: Mobile companion app for viewing codex and relationship status
- **PLAT-04**: Accessibility mode (high contrast, no-color, screen reader, input assistance)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Persistent MMO world | Multiplies content, balance, governance, and infra complexity by 10x — v2+ |
| Custom magic language parser | Template-based spells sufficient for v1; parser adds months of work |
| Graphical UI / web frontend | CLI-first is the product identity; graphical frontend is a different product |
| Offline/local LLM mode | Requires model hosting infrastructure; API-based is the correct v1 path |
| Real-time multiplayer combat | Turn-based CLI is the design constraint; real-time breaks the model |
| Voice synthesis for NPC dialogue | Cool but not core; text is the medium |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1 | Pending |
| CORE-02 | Phase 1 | Pending |
| CORE-03 | Phase 1 | Pending |
| CORE-04 | Phase 1 | Pending |
| AI-01 | Phase 2 | Pending |
| AI-02 | Phase 2 | Pending |
| AI-03 | Phase 2 | Pending |
| AI-04 | Phase 5 | Pending |
| PLAY-01 | Phase 2 | Pending |
| PLAY-02 | Phase 2 | Pending |
| PLAY-03 | Phase 2 | Pending |
| PLAY-04 | Phase 2 | Pending |
| WORLD-01 | Phase 1 | Pending |
| WORLD-02 | Phase 3 | Pending |
| WORLD-03 | Phase 3 | Pending |
| WORLD-04 | Phase 3 | Pending |
| SAVE-01 | Phase 3 | Pending |
| SAVE-02 | Phase 4 | Pending |
| SAVE-03 | Phase 4 | Pending |
| SAVE-04 | Phase 4 | Pending |
| CLI-01 | Phase 1 | Pending |
| CLI-02 | Phase 4 | Pending |
| CLI-03 | Phase 4 | Pending |
| CLI-04 | Phase 4 | Pending |
| LLM-01 | Phase 5 | Pending |
| LLM-02 | Phase 5 | Pending |
| LLM-03 | Phase 5 | Pending |
| LLM-04 | Phase 4 | Pending |
| CONT-01 | Phase 3 | Pending |
| CONT-02 | Phase 2 | Pending |
| CONT-03 | Phase 3 | Pending |
| CONT-04 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

---
*Requirements defined: 2026-04-20*
*Last updated: 2026-04-20 after roadmap creation*
