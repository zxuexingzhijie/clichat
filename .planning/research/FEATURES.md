# Feature Landscape

**Domain:** AI-driven CLI interactive novel / text RPG
**Researched:** 2026-04-20
**Overall confidence:** MEDIUM-HIGH (based on training data knowledge of the genre, verified against the design document; no live web verification available for this session)

## Competitive Landscape Overview

The feature analysis draws from six product categories:

| Category | Representatives | Key Differentiator |
|----------|----------------|-------------------|
| AI text adventure | AI Dungeon, NovelAI, KoboldAI, HoloAI | LLM-generated open-ended narrative |
| Classic interactive fiction | Zork, Colossal Cave, Inform 7 games | Parser-based, hand-authored, puzzle-focused |
| Choice-based IF | Twine, ChoiceScript, Ink (Inkle) | Branching narrative trees, authored choices |
| Traditional MUDs | DikuMUD, LPMud, CircleMUD, Discworld MUD | Persistent world, multiplayer, stat systems |
| Modern roguelike/CLI | Dwarf Fortress, Caves of Qud, Cataclysm DDA | Deep simulation, emergent narrative, ASCII UI |
| Tabletop RPG digital tools | Roll20, Foundry VTT, solo TTRPG apps | Rules adjudication, character sheets, dice |

Chronicle sits at the intersection of AI text adventure + MUD structure + TTRPG adjudication + CLI aesthetics. This is a genuinely novel combination.

---

## Table Stakes

Features users expect. Missing any of these and the product feels broken or incomplete compared to existing AI text games.

### Narrative & Interaction

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Free-text natural language input | AI Dungeon and NovelAI both allow arbitrary text input; users expect this as baseline for AI games | Medium | Chronicle's dual-input (NL + commands) exceeds this, but NL must work well |
| Coherent multi-paragraph prose output | Every AI text game produces narrative prose; quality is the baseline users judge immediately | Medium | Depends on prompt engineering + model selection per AI role |
| Multiple action modes (Do/Say/Story) | AI Dungeon established Do/Say/Story as standard input modes; NovelAI uses similar patterns | Low | Chronicle's command categories (observe, move, social, conflict, cognition) are a better-structured version of this |
| Setting/genre selection | AI Dungeon offers fantasy, sci-fi, mystery, etc.; NovelAI lets you set any genre | Low | Chronicle ships with Classic Fantasy first; genre framework should be extensible via world packs |
| Character creation | Race, class/profession, name, basic backstory -- every RPG has this | Medium | Design doc specifies race + profession + background; table stakes |
| Basic combat/conflict resolution | MUDs, RPGs, and AI Dungeon all include combat; text RPG without combat feels incomplete | High | Deterministic Rules Engine adjudication is the right approach; needs stat system, skill checks, outcomes |
| NPC dialogue | Talking to characters is fundamental to IF and RPGs alike | Medium | NPC Actor system with per-character prompts is designed for this |
| World exploration / room-based navigation | From Zork through MUDs to modern IF -- movement between discrete locations is expected | Medium | `:go`, `:travel`, location descriptions; this is core |
| Inventory management | Items, equipment, consumables -- RPG baseline since the 1970s | Medium | Item instances, equipment slots, use/drop/trade |
| Quest/task tracking | Journal or quest log showing active objectives; standard in all RPGs post-2000 | Medium | `:journal` command, quest states, completion tracking |

### Persistence & State

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Save/load game | Every single-player game has this; mandatory | Low | `:save` and `:load` -- snapshot full game state |
| Session continuity | Game remembers what happened last session; AI Dungeon struggles here; users notice and complain | High | Requires memory architecture (world facts + session state + episodic memory + summaries) |
| World state persistence | NPCs stay where you left them, doors stay open, items stay dropped | Medium | Deterministic state layer handles this; not LLM-dependent |
| Character progression | XP, levels, skill improvements, stat growth -- RPG baseline | Medium | Not deeply specified in design doc yet; needs at minimum: XP gain, level thresholds, stat increases, new abilities |

### UI & Usability

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Clear status display | HP, MP, location, active quest -- MUDs and roguelikes show this constantly | Low | Status bar in CLI layout; design doc has this |
| Help system / command reference | Every CLI tool and MUD has `:help`; new users need this | Low | Must be contextual, not just a wall of text |
| Input history (up arrow) | Terminal standard; not having it feels broken | Low | Readline/terminal library handles this |
| Tab completion for commands | CLI standard expectation | Low | Commander.js + custom completion |
| Error recovery / undo | If you mistype or the AI misunderstands, you need a way back | Medium | `:undo` last action or `:replay` to review; design doc's branch system covers the hard case |

---

## Differentiators

Features that set Chronicle apart from existing products. Not expected by users coming from AI Dungeon/NovelAI, but create competitive advantage.

### Tier 1: Core Differentiators (build these -- they define the product)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Git-like save/branch/compare system** | No AI text game has this. AI Dungeon has linear save. NovelAI has manual branching in the editor but no compare/replay. This transforms AI unpredictability from bug to feature -- "explore the timeline" | High | `:save`, `:branch`, `:compare`, `:replay` -- the design doc's crown jewel. Requires full state snapshots, diff engine for narrative comparison, branch tree visualization |
| **Deterministic Rules Engine (no LLM adjudication)** | AI Dungeon and NovelAI let the LLM decide everything -- combat outcomes, item effects, NPC reactions. This causes wild inconsistency. Chronicle's Rules Engine decides outcomes deterministically; AI only narrates. This is the #1 architecture differentiator | High | Separation of "what happens" (Rules Engine) from "how it's described" (AI Narrative Director). Prevents the LLM from making up that you suddenly have a magic sword |
| **NPC long-term episodic memory** | AI Dungeon NPCs forget you exist between scenes. NovelAI's lorebook is static, player-managed. Chronicle's per-NPC episodic memory (structured JSON) with retrieval means NPCs remember you helped/betrayed/ignored them | High | Per-character memory store, relevance-based retrieval, personality-informed responses. This is what makes the world feel "alive" |
| **Truth/cognition/knowledge separation** | No competitor does this. world_truth vs npc_belief vs player_knowledge enables: unreliable NPCs, investigation gameplay, secrets, misinformation, reveals. Dramatically deeper than flat lorebook | High | Three epistemic layers per fact. Retrieval Planner must scope what each entity can know. Creates genuine mystery/investigation gameplay |
| **Dual-input system (commands + NL)** | MUDs have commands only. AI Dungeon has NL only. Chronicle supports both simultaneously -- structured commands for efficiency, NL for creativity. Best of both worlds | Medium | Intent recognition layer parses NL into structured actions before passing to Rules Engine. Commands bypass NL parsing for speed |
| **CLI-native rich layout** | No AI text game uses a structured terminal UI (scene panel + status + suggestions + input). AI Dungeon is a web chat. NovelAI is a web editor. MUDs have plain text. React+Ink enables a genuinely novel text game UI | Medium | Four-panel layout using Ink components. Responsive, keyboard-driven. Feels like a real game, not a chatbot |

### Tier 2: Strong Differentiators (build these -- they amplify the core)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **World Codex browser** | NovelAI has lorebook but it's a config tool, not a player-facing feature. Chronicle's `:codex` lets players browse world lore like an in-game encyclopedia. Rewards curiosity, reinforces consistency | Medium | Tag-based search over YAML codex files; display in terminal UI. Players can verify world facts |
| **Relationship/reputation tracking** | Most AI text games have no visible relationship system. MUDs sometimes have faction reputation. Chronicle tracks per-NPC relationship + per-faction reputation with visible scores and history | Medium | Structured relationship data, visible via `:relations` command. Feeds into NPC Actor prompts |
| **Three turn granularities (scene/conflict/journey)** | Unique to Chronicle. AI Dungeon has one turn type. Traditional RPGs have exploration vs combat modes. Chronicle adds journey mode for travel -- prevents the "every step is a scene" fatigue problem | Medium | Rules Engine switches modes based on context. Different prompt templates, pacing, and UI for each |
| **ASCII/Unicode map display** | Dwarf Fortress and roguelikes have this, but no AI text game does. Gives spatial awareness that pure prose cannot | Medium | Must update dynamically. Show explored/unexplored, current position, points of interest, danger zones |
| **Suggested actions** | AI Dungeon added this recently but it's generic. Chronicle's suggestions should be context-aware, reflecting available commands, nearby NPCs, active quests, and environmental affordances | Low | Generated per turn based on game state, not LLM. Helps new players, doesn't constrain experienced ones |
| **Background summarizer** | Solves the context window problem that plagues all AI text games. Long sessions get compressed without losing critical facts | High | Runs asynchronously. Replaces old turns with summaries. Must preserve quest states, relationship changes, and key events |

### Tier 3: Nice-to-Have Differentiators (defer to post-MVP unless easy)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Replay/journal system** | `:replay` last N turns as a readable narrative log. No AI text game does this well. Lets players remember "how did I get here?" | Medium | Requires turn history storage and summary generation |
| **Branch comparison (narrative diff)** | `:compare` two branches showing diverging quest states, relationships, and outcomes in human-readable form -- not a code diff | High | AI-generated comparison of two game states; novel UX challenge |
| **World pack extensibility** | Content packs (world, rules, story, event) that can be loaded/swapped. Enables community content and genre variety | High | YAML-based content format. Requires validation, loading, and conflict resolution |
| **Multi-provider LLM abstraction** | Switch models per AI role. Use fast/cheap for narration, powerful for key scenes | Medium | Adapter pattern per provider. Cost optimization rather than user-facing feature |
| **Export/share story** | Export your playthrough as a readable document or shareable link | Low | Serialize game history to markdown/HTML |

---

## Anti-Features

Features to explicitly NOT build. Each would waste time, distract from core value, or actively harm the product.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Real-time multiplayer** | Exponentially increases complexity. MUD-style multiplayer requires different architecture (tick systems, conflict resolution between players, persistence). The design doc correctly defers this to v2+ | Design for single-player first. Architect state layer so multiplayer COULD be added later, but don't build it now |
| **Image/art generation** | AI Dungeon added AI art. It's a novelty, not core gameplay. CLI-first product should embrace text aesthetics, not fight them | Use ASCII art, Unicode box drawing, and well-crafted prose. The constraint is the differentiator |
| **Voice input/output** | Adds massive complexity (STT/TTS integration, latency). Not what terminal users want | Text-only. CLI users chose the terminal for a reason |
| **Complex economy/trading system** | Deep economic simulation is a rabbit hole (inflation, supply/demand, market manipulation). Not needed for narrative RPG | Basic currency. Buy/sell at NPCs with fixed prices. Complex economy is a v2+ concern if ever |
| **Custom spell/ability creator** | Free-form spell design is impossible to adjudicate deterministically. Creates a rules nightmare | Template-based spells from the codex. Players choose from defined spells; world pack authors can add more |
| **Mod platform / creator marketplace** | Platform infrastructure is a separate product. Building it too early fragments focus | Ship YAML-based world packs as files. Community can share via git. Marketplace is v3+ |
| **GUI / web client** | Building a second client splits engineering effort and dilutes the CLI identity | CLI-only. If demand exists, a web client wrapping the same engine can come in v2+ |
| **Procedural infinite world generation** | Tempting but destroys consistency. AI Dungeon's worlds feel hollow because they're infinitely generated with no structure | Hand-authored world packs with AI-assisted expansion tools. Finite but deep beats infinite but shallow |
| **LLM decides outcomes** | This is AI Dungeon's fundamental flaw. "The AI decided you won" feels arbitrary. Users lose trust | Rules Engine adjudicates ALL outcomes. AI only narrates the result. This is an architecture decision, not a feature, but must be enforced religiously |
| **Persistent online world (MMO-style)** | Requires server infrastructure, anti-cheat, content moderation, 24/7 ops. Wrong product for a CLI single-player game | Single-player with local state. Shared/spectator mode in v2+ if validated |

---

## Feature Dependencies

```
Character Creation ─────────────────┐
                                    v
World Codex (YAML data) ──────> Scene Exploration ──────> NPC Dialogue
                                    │                        │
                                    v                        v
                               Combat System         Relationship Tracking
                                    │                        │
                                    v                        v
                              Quest System <────────> NPC Episodic Memory
                                    │                        │
                                    v                        v
                          Save/Load (basic) ──────> Branch/Compare System
                                    │
                                    v
                           Turn Granularity ──────> Background Summarizer
                                    │
                                    v
                              ASCII Map ──────> Journey Mode (travel turns)

Foundational (must exist first):
  Rules Engine ──> ALL gameplay features depend on this
  CLI Layout (Ink) ──> ALL display features depend on this
  Intent Recognition ──> NL input depends on this
  World Codex Schema ──> ALL content depends on this
  State Management ──> ALL persistence depends on this

AI Roles (can be stubbed initially):
  Narrative Director ──> requires Rules Engine output + Codex access
  NPC Actor ──> requires NPC memory + relationship data + Codex access
  Retrieval Planner ──> requires Codex + memory architecture
  Summarizer ──> requires turn history storage
```

---

## Comparative Feature Matrix

How Chronicle's planned features compare to existing products:

| Feature | AI Dungeon | NovelAI | KoboldAI | Traditional MUD | Classic IF (Zork) | Chronicle (planned) |
|---------|-----------|---------|----------|-----------------|-------------------|-------------------|
| Free-text input | Yes | Yes | Yes | No (commands) | No (parser) | Yes + commands |
| Deterministic rules | No | No | No | Yes | Yes | Yes |
| NPC memory | Minimal | Lorebook (static) | None | Scripted | Scripted | Episodic per-NPC |
| World consistency | Low | Medium (lorebook) | Low | High (code) | High (authored) | High (Rules Engine + Codex) |
| Save/branch | Linear | Manual branching | Basic save | No (persistent) | Save/restore | Git-like branches |
| Character progression | Minimal | None | None | Deep (levels/skills) | None | Planned (levels/skills) |
| Map display | None | None | None | ASCII (some) | None | ASCII/Unicode |
| Quest tracking | None | None | None | Quest log (some) | Puzzle state | Journal system |
| Relationship tracking | None | None | None | Faction rep (some) | None | Per-NPC + per-faction |
| Combat system | AI-narrated | None | AI-narrated | Deterministic | Puzzle-based | Rules-adjudicated |
| CLI-native UI | No (web) | No (web) | No (web) | Yes (telnet) | Yes (terminal) | Yes (React+Ink) |
| Cost model | Subscription | Subscription | Self-hosted | Free | Free | LLM API costs |
| Chinese-first | No | No | No | Rare | No | Yes |

---

## MVP Recommendation

### Must Ship (Table Stakes + Tier 1 Differentiators)

Priority order based on dependencies:

1. **Rules Engine** -- foundation for everything; without this, you have another chatbot
2. **CLI Layout** (React+Ink four-panel) -- the canvas for all display
3. **World Codex schema + Classic Fantasy content** -- data the game runs on
4. **Character creation** (race, profession, background)
5. **Scene exploration** (`:look`, `:inspect`, room descriptions, NPC/item listing)
6. **Dual-input system** (command parsing + basic NL intent recognition)
7. **NPC dialogue** with per-character prompts (can start without full episodic memory)
8. **Basic combat** (`:attack`, `:cast`, `:guard` -- Rules Engine adjudicated)
9. **Inventory management** (pick up, use, equip, drop)
10. **Quest system** (accept, track progress, complete, journal display)
11. **Save/load** (full state snapshots)
12. **NPC episodic memory** (structured JSON, per-character retrieval)
13. **Relationship/reputation tracking** (visible scores, feeds into NPC prompts)
14. **ASCII map** (static + dynamic position)
15. **Branch system** (`:branch`, `:compare` basic, branch tree display)
16. **Status bar + suggested actions**

### Defer to Post-MVP

| Feature | Reason for Deferral |
|---------|-------------------|
| Branch comparison (narrative diff) | High complexity, not blocking core gameplay loop |
| Background summarizer | Can work around with session length limits initially |
| Three turn granularities | Start with scene mode only; add conflict + journey later |
| World pack extensibility | Ship one world pack first; extensibility framework later |
| Export/share | Nice-to-have, not core loop |
| Journey mode (travel turns) | Simple `:go`/`:travel` with instant transition works for MVP |
| Multi-provider LLM switching | Start with one provider; abstract later |
| Replay system | Save/load covers basic needs; replay is polish |

---

## Key Insight: Where AI Text Games Fail (and Chronicle Must Succeed)

Based on analysis of AI Dungeon, NovelAI, and KoboldAI user communities:

1. **Consistency failure** -- The #1 complaint across all AI text games. NPCs forget who they are mid-conversation. World facts contradict. Items appear and disappear. Chronicle's Rules Engine + Codex + episodic memory directly addresses this.

2. **No sense of consequences** -- Actions don't matter because the AI generates a new reality each turn. Chronicle's deterministic state + relationship tracking + quest system means choices have lasting effects.

3. **Session amnesia** -- Long games lose coherence. Users resort to manually editing memory/lorebook. Chronicle's structured memory + background summarizer automates what users currently do by hand.

4. **No game feel** -- AI text games feel like writing tools, not games. No stats, no progression, no stakes. Chronicle's RPG systems (combat, skills, quests, reputation) provide actual game mechanics.

5. **Prompt management burden** -- NovelAI and KoboldAI require users to manage lorebook, author's notes, memory, and generation settings. Chronicle should handle retrieval automatically via the Retrieval Planner.

The product opportunity is clear: **existing AI text games are writing tools pretending to be games. Chronicle is a game that happens to use AI for narration.** That distinction -- deterministic rules + AI narration rather than AI-decides-everything -- is the fundamental differentiator.

---

## Sources

- AI Dungeon feature set: Training data knowledge of Latitude's product (2020-2025), including Adventures, Scenarios, World Info, memory system, multiplayer features. Confidence: MEDIUM (no live verification).
- NovelAI feature set: Training data knowledge of NovelAI's lorebook, memory, author's note, generation settings, custom models (Clio, Kayra). Confidence: MEDIUM.
- KoboldAI/KoboldCpp: Training data knowledge of open-source AI text generation frontend, memory/world info features, model loading. Confidence: MEDIUM.
- MUD features: Training data knowledge of DikuMUD, LPMud, CircleMUD, and modern MUDs. Confidence: HIGH (well-documented, stable domain).
- Classic IF: Training data knowledge of Infocom games, Inform 7, TADS, Twine, ChoiceScript, Ink. Confidence: HIGH (well-documented, stable domain).
- Modern roguelikes/CLI games: Training data knowledge of Dwarf Fortress, Caves of Qud, Cataclysm DDA. Confidence: HIGH.
- Chronicle design document: `/Users/makoto/Downloads/work/cli/deep-research-report (1).md` -- directly read. Confidence: HIGH.
- Chronicle project spec: `/Users/makoto/Downloads/work/cli/.planning/PROJECT.md` -- directly read. Confidence: HIGH.
