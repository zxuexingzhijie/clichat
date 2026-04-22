# Chronicle

## What This Is

Chronicle is an AI-driven CLI interactive novel game — a text RPG where AI handles narration
and NPC behavior while a deterministic Rules Engine controls truth, state, and game pacing.
Chinese-first, CLI-first, single-player. Players interact through dual-input (structured
commands + natural language), manage story forks like git branches, and explore a persistent
world with long-memory NPCs. v1.0 ships a fully playable Classic Fantasy region.

## Core Value

The player must feel they are in a **persistent, consistent world that remembers them** — not
a chatbot that reinvents the universe every turn.

## Current Milestone: v1.1 Playability & Distribution

**Goal:** 修复核心交互 bug、实现流式输出、叙事式角色创建、动画反馈系统，并通过 npm + Homebrew tap 让用户真正可以安装和使用游戏。

**Target features:**
- [BUG] Enter 确认后不推进 + 无法切换到自定义输入
- [BUG] 游戏无法退出（无退出快捷键/命令）
- 流式输出 — 旁白/NPC 对话逐字打印
- 叙事式角色创建 — 取代菜单，通过守卫拦截场景引导定属性
- 动画系统 — 开场标题、AI loading、场景转换、战斗打击感、界面反馈
- npm publish (chronicle-cli) + Homebrew 自建 tap 分发

---

## Current State (v1.0)

- **Shipped:** 2026-04-22
- **Codebase:** ~19,000 lines TypeScript, Bun runtime, React + Ink
- **Test suite:** 637 tests, 0 failures
- **AI providers:** Multi-provider via YAML config (Google, OpenAI, Anthropic, Qwen, DeepSeek)
- **World:** Classic Fantasy — 9 locations, 4 factions, 15+ NPCs, main quest + side quests
- **Known gaps:** 3 live UAT items deferred (require API session); chapter summary display not wired to UI

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

### Active

- [ ] Live session validation of /cost, /replay, background summarizer (carry-over from v1.0)
- [ ] Chapter summary display wired to game-screen UI (stub storage not connected)
- [ ] CJK text rendering audit in live terminal (partial mitigation via string-width)

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
| gemini-2.0-flash as default for all roles | Placeholder; real routing via YAML config | ⚠️ Revisit — pricing fields not fully populated; estimatedCost stays 0 until YAML loaded |

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
*Last updated: 2026-04-22 after v1.0 milestone*
