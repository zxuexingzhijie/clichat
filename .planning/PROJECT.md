# Chronicle

## What This Is

Chronicle is an AI-driven CLI interactive novel game — a text RPG where AI handles narration
and NPC behavior while a deterministic Rules Engine controls truth, state, and game pacing.
Chinese-first, CLI-first, single-player. Players interact through dual-input (structured
commands + natural language), manage story forks like git branches, and explore a persistent
world with long-memory NPCs. v1.3 ships with a full story mainline (6-stage quest arc, 3
endings), act-aware AI prompts, NPC trust-gated knowledge disclosure, and deterministic
location descriptions driven by world flags.

## Core Value

The player must feel they are in a **persistent, consistent world that remembers them** — not
a chatbot that reinvents the universe every turn.

## Current Milestone: v1.5 Ecosystem Engine

**Goal:** Evolve from "one game" to "CLI-native world simulation ecosystem" — UX architecture refactor + World Pack platform + Delight Layer visual system.

**Target features:**
- UX Architecture Refactor: Context Providers, NarrativeRenderer, GameScreen slim-down, 7-state input state machine
- World Pack Platform: pack spec, namespace prefix, composable interfaces, SDK CLI, cached loader, save migration
- Delight Layer: 墨韵呼吸 design system implementation (World Heartbeat BPM, 墨分五色, sine-curve typing, NPC glyphs, weather, faction meter, story export)

## Current State (v1.4)

- **Shipped:** 2026-04-30
- **Codebase:** ~41,500+ lines TypeScript, Bun runtime, React + Ink
- **Test suite:** 1115+ tests, 0 failures
- **AI providers:** Multi-provider via YAML config (Google, OpenAI, Anthropic, Qwen, DeepSeek)
- **World:** Classic Fantasy — 9 locations, 4 factions, 15+ NPCs, 8-stage main quest (3 endings) + 4 side quests
- **Distribution:** npm (chronicle-cli@1.4.0), Homebrew tap, GitHub Actions CI/CD — publishable
- **Narrative system:** narrativeStore (act1/act2/act3 + worldFlags); act-aware AI prompts; NPC trust-gated disclosure; location description overrides
- **AI architecture:** Rules Engine boundary enforced; multi-turn messages[] API; schema-validated narration; cost-tracked intent classification; graceful summarizer shutdown
- **Game systems:** Enemy loot_table schema; combat drops; :take handler; SaveDataV6 migration
- **Known gaps:** Live API UAT (non-blocking human checklist); CJK rendering audit deferred

## Requirements

### Validated

- ✓ Dual-input system (commands + NL intent recognition) — v1.0 (CORE-01, CORE-02)
- ✓ Deterministic Rules Engine (adjudicates outcomes, no LLM involvement) — v1.0 (CORE-03)
- ✓ Immutable game state with full JSON serialize/restore — v1.0 (CORE-04, SaveDataV4)
- ✓ AI Narrative Director (Chinese prose from adjudicated results) — v1.0 (AI-01)
- ✓ NPC Actor system with per-character memory and personality — v1.0 (AI-02)
- ✓ Skills-based RAG: Retrieval Planner decides what to fetch per turn — v1.0 (AI-03)
- ✓ Background Summarizer (code complete; live UAT deferred) — v1.0 (AI-04)
- ✓ World Codex as tagged YAML files (races, locations, factions, spells, items) — v1.0 (WORLD-01)
- ✓ NPC episodic memory: three-layer schema (recent/salient/archive) — v1.0 (WORLD-02)
- ✓ Character creation (race, profession, background, stats, equipment) — v1.0 (PLAY-01)
- ✓ Scene exploration (`:look`, `:inspect`, `:scan`) — v1.0 (PLAY-02)
- ✓ Dialogue system (`:talk`, `:ask`, NPC Actor Skill) — v1.0 (PLAY-03)
- ✓ Basic combat system (`:attack`, `:cast`, `:guard`, `:flee`) — v1.0 (PLAY-04)
- ✓ Quest system (accept, track, complete, journal) — v1.0 (WORLD-03)
- ✓ Relationship/reputation tracking (NPC + faction) — v1.0 (WORLD-04)
- ✓ ASCII/Unicode map display — v1.0 (CLI-02)
- ✓ Git-like save/branch system (`:save`, `:branch`, `:compare`, `:replay`) — v1.0 (SAVE-01–04)
- ✓ World codex browser (`:codex`) — v1.0 (CLI-03)
- ✓ Multi-provider LLM abstraction (YAML-driven per-role routing) — v1.0 (LLM-01)
- ✓ Token cost tracking + `:cost` command — v1.0 (LLM-02)
- ✓ Prompt caching (Anthropic cacheControl, Google prefix ordering) — v1.0 (LLM-03)
- ✓ Truth vs. cognition separation (world_truth / npc_belief / player_knowledge) — v1.0 (LLM-04)
- ✓ Classic Fantasy world pack (9 locations, 4 factions, 15+ NPCs, quests) — v1.0 (CONT-01–04)
- ✓ CLI layout: four-panel (scene, status bar, suggested actions, input) — v1.0 (CLI-01)
- ✓ Keyboard shortcuts: Tab completion, arrow history, `?` help — v1.0 (CLI-04)
- ✓ Core input loop fixed (Enter advances, focus switching, reliable quit) — v1.1 (BUG-01–03)
- ✓ Streaming typewriter narration and NPC dialogue with skip-to-end — v1.1 (STREAM-01–03)
- ✓ Narrative character creation via guard intercept scene — v1.1 (NCC-01–04)
- ✓ Animation system (title, spinner, transitions, combat flash, toast) — v1.1 (ANIM-01–05)
- ✓ npm + Homebrew distribution with CI/CD release pipeline — v1.1 (DIST-01–05)
- ✓ All 46 v1.2 game system integrity fixes (WIRE/COMBAT/DIAL/QUEST/SAVE/REP/MEM/SCENE/CODEX/CONT/DEATH) — v1.2
- ✓ NarrativeState store (currentAct/atmosphereTags/worldFlags/playerKnowledgeLevel) + SaveDataV5 migration — v1.3 (D-01–05)
- ✓ Act-aware narrative prompts + NPC trust-gated knowledge disclosure — v1.3 (D-06–09)
- ✓ quest_main_01 6-stage arc with 3 conditional endings (justice/harmony/shadow) — v1.3 (D-10–14)
- ✓ NPC knowledge_profile for 7 story NPCs + dialogue trust injection + route-lock flags — v1.3 (D-15–20)
- ✓ Location description_overrides with worldFlags priority resolution (no LLM call) — v1.3 (D-21–24)

- ✓ Wire narrativeContext into NPC Actor; sentiment routed through Rules Engine (adjudicateTalkResult) — v1.4 Phase 17 (ARCH-01, ARCH-02)
- ✓ True multi-turn NPC dialogue via messages[]; dialogueHistory {role,content}[]; messagesRef hook accumulation — v1.4 Phase 18 (DIAL-01, DIAL-02, DIAL-03)
- ✓ Narrative Director generateObject + NarrationOutputSchema (Zod min10/max300); schema rejection → catch fallback — v1.4 Phase 19 (AI-05)
- ✓ intent-classifier routes through callGenerateObject (role 'retrieval-planner'); tokens visible in :cost — v1.4 Phase 19 (AI-06)
- ✓ runSummarizerLoop AbortSignal (3 checkpoints); SIGINT wired in app.tsx; graceful exit — v1.4 Phase 19 (AI-07)
- ✓ Enemy loot_table schema + combat drops + :take handler + SaveDataV6 migration — v1.4 Phase 20 (GAME-01)
- ✓ package.json v1.4.0, author=Makoto, repository.url=git+https://; npm publish --dry-run 0 errors — v1.4 Phase 21 (DIST-01)
- ✓ Live API UAT: 21-UAT-CHECKLIST.md with automation gate + 3 human tests; non-blocking — v1.4 Phase 21 (UAT-01)

### Active

- [ ] CJK text rendering audit in live terminal (partial mitigation via string-width) — deferred to v1.5
- [ ] Live API UAT execution (3 tests in 21-UAT-CHECKLIST.md) — requires live API key, non-blocking

### Out of Scope

- Multiplayer / persistent shared world — too complex for v1, defer to v2+
- Complex economy system — basic currency sufficient
- Custom magic language — template-based spells sufficient
- Deep multimodal input (image/voice) — text-only
- Creator marketplace / mod platform — defer to v2+
- Mobile app — CLI desktop only
- Offline mode — requires API access for LLM
- Graphical UI / web frontend — CLI-first is product identity

## Context

- **Reference codebase**: `claude-code-main/` contains a Claude Code source snapshot used as
  architectural reference for Skills system, tool-based retrieval, and terminal UI (React + Ink)
- **Design document**: `deep-research-report (1).md` is the comprehensive product design doc
- **Architecture model**: Skills as scoped prompt templates with declared tool permissions;
  tool-based retrieval (YAML + JSON) instead of vector DB; deterministic state separated from LLM
- **Target users**: Narrative single-player gamers, TRPG enthusiasts, worldbuilding writers,
  keyboard-first terminal users
- **Language**: Chinese-first content, English codebase

## Constraints

- **Tech stack**: TypeScript + Bun runtime
- **Terminal UI**: React + Ink 7
- **LLM**: Multi-provider abstraction — fast models for online path, quality models for background
- **No vector DB**: RAG uses file-based keyword/tag search on YAML codex + JSON memory
- **World data**: Human-readable YAML/JSON, git-diffable, version-controllable
- **CLI parsing**: Commander.js for command routing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript + Bun | Fast cold start; native TS; proven Ink compatibility | ✓ Good — no issues with runtime or type system |
| Tool-based RAG over vector DB | Human-readable, git-diffable, no embedding infra | ✓ Good — YAML/JSON proved sufficient for MVP |
| Custom createStore pattern (~35 lines) | No Zustand/Redux; game logic UI-independent | ✓ Good — simple, testable, no overhead |
| Rules Engine has NO LLM access | Deterministic adjudication; AI cannot override outcomes | ✓ Good — critical boundary held throughout |
| Three epistemic layers | Prevents NPC omniscience; enables investigation gameplay | ✓ Good — Cognitive Context Envelope clean |
| Multi-provider abstraction + YAML config | Different roles have different cost/latency needs | ✓ Good — YAML config flexible, easy to swap |
| YAML codex + JSON memory | Structured enough for reliable retrieval; human-editable | ✓ Good — git-diffable as intended |
| NpcMemoryRecord three-layer schema | Enables lossless summarization without losing context | ✓ Good — version field enables atomic write-back |
| SaveData versioned migrations (V1→V4) | Forward-compatible saves | ✓ Good — chained migrations work |
| Inline dialogue mode | Appends NPC speech as narration; no layout change | ✓ Good — simpler than separate dialogue window |
| immer for complex nested updates | Selective use; plain spreads elsewhere | ✓ Good — used only where nested mutation would be error-prone |
| CostSessionState ephemeral | Resets on state_restored; prevents cross-session bleed | ✓ Good — clean separation of session vs save state |
| gemini-2.0-flash as default for all roles | Placeholder; real routing via YAML config | Revisit — pricing fields not fully populated; estimatedCost stays 0 until YAML loaded |
| Streaming via sentence buffer + async generator | Smooth typewriter without partial-word rendering | Good — clean separation of buffering and rendering |
| Guard intercept scene for character creation | Cinematic entry replaces menu; Rules Engine sets stats | Good — immersive and deterministic |
| Animation hooks as pure-logic + React wrappers | Testable without React Testing Library | Good — timer-dependent tests run fast |
| CLI env var propagation for data dir | Single env var __CHRONICLE_DATA_DIR shared by all consumers | Good — no import changes needed |
| Segment-based traversal guard | path.normalize resolves '..' away; split detects it | Good — security-correct |
| NarrativeState as separate store | Keeps narrative arc out of GameState; restores independently | ✓ Good — clean separation, V5 migration trivial |
| SaveDataV4 union for compareBranches | branch-diff accepts V4|V5 without breaking existing code | ✓ Good — no downstream breakage |
| OVERRIDE_PRIORITY hardcoded in code | Avoids data migration when priority changes | ✓ Good — easy to iterate |
| quest field optional in createDialogueManager | Backward-compatible with existing test fixtures | ✓ Good — no test regressions |
| ai-caller.ts single-turn only | Original design; multi-turn serialized to strings | ✓ Resolved — Phase 18 implemented multi_turn MessageMode with messages[] |
| multi_turn uses SystemModelMessage (role:'system') as first element | All providers handle it uniformly; no top-level system param needed | ✓ Good — clean discriminated union extension |
| dialogueHistory migrated to {role,content}[] | Unified with LLM API format; historySection text serialization deleted | ✓ Good — single history channel, no duplication |
| messagesRef (useRef) for cross-render accumulation in hook | React ref survives re-renders; reset() preserves history; resetMessages() sets session boundary | ✓ Good — mirrors createStreamingText factory pattern |
| NarrationOutputSchema via callGenerateObject | Zod schema enforcement (min10/max300) replaces manual slice; rejection triggers catch fallback | ✓ Good — schema is source of truth, not code guards |
| classifyIntent uses callGenerateObject (role 'retrieval-planner') | Routes through ai-caller.ts; tokens recorded via recordUsage(); model? removed from options | ✓ Good — intent costs now visible in :cost |
| runSummarizerLoop AbortSignal at 3 checkpoints | loop start + post-sleep + post-dispatchTask; SIGINT stored as named const for process.off | ✓ Good — Ctrl-C exits cleanly, no unhandled rejection |
| EnemySchema loot→loot_table rename | Semantic clarity: loot_table is a roll table, not a flat list | ✓ Good — no ambiguity |
| SaveDataV6Schema extends V5 | Chained migration pattern; branch-diff union extended to V4\|V5\|V6 | ✓ Good — backward-compatible saves maintained |
| UAT-01 as non-blocking human checklist | Automation gate (bun test + tsc + dry-run) is the CI pass condition; live API tests require human | ✓ Good — doesn't block shipping; stays visible |

---
*Last updated: 2026-04-30 after v1.4 milestone (AI Quality & Game Completeness)*

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-26 after v1.1 milestone*
