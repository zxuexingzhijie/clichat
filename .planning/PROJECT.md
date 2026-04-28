# Chronicle

## What This Is

Chronicle is an AI-driven CLI interactive novel game — a text RPG where AI handles narration
and NPC behavior while a deterministic Rules Engine controls truth, state, and game pacing.
Chinese-first, CLI-first, single-player. Players interact through dual-input (structured
commands + natural language), manage story forks like git branches, and explore a persistent
world with long-memory NPCs. v1.1 ships with streaming output, cinematic character creation,
animation feedback, and npm + Homebrew distribution.

## Core Value

The player must feel they are in a **persistent, consistent world that remembers them** — not
a chatbot that reinvents the universe every turn.

## Current Milestone: v1.2 Game System Integrity & Playability

**Goal:** Fix 50 known issues — restore all wired systems, combat, dialogue, quest, save/branch, reputation, content gaps to correct playable state.

**Target features:**
- App initialization wiring (save/quest/branch/map/RAG/summarizer all connected)
- Combat system correctness (double enemy turn, flee bug, combat initiation, abilities, spells)
- Dialogue system correctness (reputation scale, inline mode, NPC role questions, streaming sentiment)
- Quest system completeness (quests.yaml content, command routing, stage triggers)
- Save/branch correctness (saveName, branch-switch restores state, path traversal fix)
- Reputation & memory data integrity (scale mismatch, faction writes, load event suppression)
- World content gaps (notable_npcs arrays, dark cave, shadow contact discovery)
- Death recovery option

---

## Current State (v1.1)

- **Shipped:** 2026-04-26
- **Codebase:** ~22,200 lines TypeScript, Bun runtime, React + Ink
- **Test suite:** 744 tests, 0 failures
- **AI providers:** Multi-provider via YAML config (Google, OpenAI, Anthropic, Qwen, DeepSeek)
- **World:** Classic Fantasy — 9 locations, 4 factions, 15+ NPCs, main quest + side quests
- **Distribution:** npm (chronicle-cli), Homebrew tap, GitHub Actions CI/CD
- **Known gaps:** OWNER placeholders in distribution files (user replaces before publish); live API UAT deferred

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
- ✓ Chapter summary display wired to game-screen UI — v1.1 (CARRY-02)

### Active

- [ ] CJK text rendering audit in live terminal (partial mitigation via string-width)
- [ ] Live session validation of /cost, /replay, background summarizer (carry-over)
- [ ] Replace OWNER placeholders in distribution files before first publish

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
| GitHub Actions fan-out pattern | publish-npm and build-binaries parallel after quality-gate | Good — reduces pipeline time |

## Evolution

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
