# Chronicle

## What This Is

Chronicle is an AI-driven CLI interactive novel game — a text RPG where AI handles narration and NPC behavior while a deterministic Rules Engine controls truth, state, and game pacing. Chinese-first, CLI-first, single-player. Players interact through dual-input (structured commands + natural language), manage story forks like git branches, and explore a persistent world with long-memory NPCs.

## Core Value

The player must feel they are in a **persistent, consistent world that remembers them** — not a chatbot that reinvents the universe every turn.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Dual-input system (commands + NL intent recognition)
- [ ] Deterministic Rules Engine (adjudicates outcomes, resource changes, relationships)
- [ ] AI Narrative Director (generates prose from adjudicated results)
- [ ] NPC Actor system with per-character memory and personality
- [ ] Skills-based RAG: Retrieval Planner decides what to fetch per turn
- [ ] World Codex as tagged YAML files (races, locations, factions, spells, items)
- [ ] NPC episodic memory (structured JSON, per-character)
- [ ] Three turn granularities (scene, conflict, journey)
- [ ] Character creation (race, profession, background)
- [ ] Scene exploration (`:look`, `:inspect`, `:scan`)
- [ ] Movement system (`:go`, `:travel`, `:camp`)
- [ ] Dialogue system (`:talk`, `:ask`, NPC Actor Skill)
- [ ] Basic combat system (`:attack`, `:cast`, `:guard`)
- [ ] Quest system (accept, track, complete, journal)
- [ ] Relationship/reputation tracking (NPC + faction)
- [ ] ASCII/Unicode map display
- [ ] Git-like save/branch system (`:save`, `:branch`, `:compare`, `:replay`)
- [ ] World codex browser (`:codex`)
- [ ] Multi-provider LLM abstraction (swap models per AI role)
- [ ] Classic Fantasy world pack (one region, main quest skeleton, side quest templates)
- [ ] CLI layout: scene panel + status bar + suggested actions + input area
- [ ] Truth vs. cognition separation in retrieval (world_truth, npc_belief, player_knowledge)
- [ ] Background summarizer for long-session compression

### Out of Scope

- Multiplayer / persistent shared world — too complex for v1, defer to v2+
- Complex economy system — basic currency sufficient for v1
- Custom magic language — use template-based spells
- Deep multimodal input (image/voice) — text-only for v1
- Creator marketplace / mod platform — defer to v2+
- Mobile app — CLI desktop only
- Offline mode — requires API access for LLM

## Context

- **Reference codebase**: `claude-code-main/` contains a Claude Code source snapshot used as architectural reference, especially for the Skills system, tool-based retrieval pattern, and terminal UI (React + Ink)
- **Design document**: `deep-research-report (1).md` is the comprehensive product design doc covering gameplay, AI roles, RAG strategy, CLI UX, and roadmap
- **Architecture model**: Follows Claude Code's pattern — Skills as scoped prompt templates with declared tool permissions, tool-based retrieval instead of vector DB, deterministic state management separated from LLM generation
- **Target users**: Narrative single-player gamers, TRPG enthusiasts, worldbuilding writers, keyboard-first terminal users
- **Language**: Chinese-first content, English codebase

## Constraints

- **Tech stack**: TypeScript + Bun runtime (matching Claude Code reference architecture)
- **Terminal UI**: React + Ink for rich terminal rendering
- **LLM**: Multi-provider abstraction — fast models (GPT-4o mini, Gemini Flash, Qwen-Plus) for online path, quality models for background tasks
- **No vector DB**: RAG uses file-based keyword/tag search on YAML codex + JSON memory, not embeddings
- **World data**: Human-readable YAML/JSON, git-diffable, version-controllable
- **CLI parsing**: Commander.js for command routing
- **First world**: Classic Fantasy (medieval, races, magic, factions) — one region with sufficient depth

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript + Bun | Matches Claude Code reference; fast runtime; good Ink/terminal ecosystem | — Pending |
| Tool-based RAG over vector DB | Human-readable, git-diffable, no embedding infrastructure; follows Claude Code pattern | — Pending |
| Skills as scoped prompt templates | Clean separation of concerns; each AI role has explicit permissions; testable in isolation | — Pending |
| Rules Engine has NO LLM access | Prevents AI from "deciding" outcomes; deterministic adjudication ensures consistency | — Pending |
| Truth/cognition/knowledge separation | Three epistemic layers prevent NPCs from being omniscient; enables investigation gameplay | — Pending |
| Multi-provider abstraction | Different AI roles have different latency/cost requirements; avoids vendor lock-in | — Pending |
| YAML codex + JSON memory | Structured enough for reliable retrieval; human-editable for content team; diffable | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

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
*Last updated: 2026-04-20 after initialization*
