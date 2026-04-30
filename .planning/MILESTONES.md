# Milestones

## v1.4 AI Quality & Game Completeness — 2026-04-30

**Status:** ✅ SHIPPED
**Phases:** 17–21 (14 plans, 74 commits)
**Timeline:** 2026-04-29 → 2026-04-30 (2 days)
**Test Suite:** 1115+ tests, 0 failures
**Codebase:** ~41,500+ lines TypeScript

### Delivered

Critical AI architecture violations fixed (Rules Engine boundary enforced for NPC sentiment→relationship delta; narrativeContext wired into NPC Actor); true multi-turn NPC dialogue via messages[] standard API; schema-validated narration with Zod (no manual slice); intent classification token tracking in :cost; summarizer graceful AbortSignal shutdown; enemy loot drop system with :take and SaveDataV6; publishable build (package.json v1.4.0, npm publish --dry-run clean, Homebrew dispatch review PASS).

### Key Accomplishments

1. Rules Engine boundary enforced — adjudicateTalkResult wraps sentiment→delta; LLM cannot directly mutate relationship state
2. NPC Actor receives narrativeContext — dialogue tone shifts between acts; void bug eliminated
3. True multi-turn NPC dialogue — ai-caller.ts messages[] API; dialogueHistory {role,content}[]; messagesRef hook accumulation
4. AI output quality — NarrationOutputSchema (Zod max300); classifyIntent via callGenerateObject with cost tracking
5. Summarizer graceful shutdown — AbortSignal at 3 loop checkpoints; SIGINT handler registered and deregistered cleanly
6. Enemy loot system — loot_table schema, combat drops, :take handler, SaveDataV6 migration
7. Distribution ready — chronicle-cli@1.4.0, npm publish --dry-run 0 errors, Homebrew dispatch 5-check PASS

**Known deferred items at close:** 8 (see STATE.md Deferred Items) — primarily live API UAT requiring real API key

### Archive

- Roadmap: `.planning/milestones/v1.4-ROADMAP.md`
- Requirements: `.planning/milestones/v1.4-REQUIREMENTS.md`

---

## v1.1 Playability & Distribution — 2026-04-26

**Status:** SHIPPED
**Phases:** 6-10 (23 plans, 135 commits)
**Timeline:** 2026-04-22 -> 2026-04-26 (4 days)
**Test Suite:** 744 tests, 0 failures
**Codebase:** ~22,200 lines TypeScript

### Delivered

Core interaction bugs fixed (Enter advances, focus switching, reliable quit), streaming typewriter
narration and NPC dialogue with skip-to-end, cinematic guard encounter replaces character creation
menu, full animation system (title, spinner, transitions, combat flash, toast feedback), and
npm + Homebrew distribution with automated CI/CD release pipeline.

### Key Accomplishments

1. Core input loop fixed — Enter advances game, Tab/slash focus switching, Ctrl-C + :quit exit
2. Streaming typewriter effect for narration and NPC dialogue with any-key skip
3. Narrative character creation — guard intercept scene replaces menu, Rules Engine sets attributes
4. Animation system — title typewriter, AI spinner, scene fade, HP flash, toast notifications
5. Distribution — npm publish (chronicle-cli), Homebrew tap, GitHub Actions CI + release pipeline

### Known Deferred Items at Close: 3

- Phase 05 HUMAN-UAT (live API session validation)
- Phase 05/07 VERIFICATION human_needed items

### Archive

- Roadmap: `.planning/milestones/v1.1-ROADMAP.md`
- Requirements: `.planning/milestones/v1.1-REQUIREMENTS.md`

---

## v1.0 MVP — 2026-04-22

**Status:** ✅ SHIPPED
**Phases:** 1–5 (37 plans, 232 commits)
**Timeline:** 2026-04-19 → 2026-04-22 (3 days)
**Test Suite:** 637 tests, 0 failures
**Codebase:** ~19,000 lines TypeScript

### Delivered

A fully playable AI-driven CLI text RPG — deterministic Rules Engine + multi-role AI (narration,
NPC dialogue, retrieval planning) + Classic Fantasy world + git-style branching + ASCII map +
codex browser + cost tracking + background summarization.

### Key Accomplishments

1. Rules Engine with D20 adjudication — AI cannot override outcomes; zero LLM in game logic
2. AI Narrative Director + NPC Actor with per-character episodic memory and personality
3. Persistent world: save/load, NPC memory (three-layer schema), quests, reputation tracking
4. Git-like story branching with 6-dimension diff and branch tree visualization
5. Epistemic separation: NPCs only receive context appropriate to their character's knowledge
6. Multi-provider YAML-driven LLM routing with token cost tracking and prompt caching

### Known Deferred Items at Close: 3 (see .planning/phases/05-polish/05-HUMAN-UAT.md)

Live behavioral UAT for /cost, /replay, and background summarizer — requires live API session.
Code fully implemented (637 tests pass, 27/27 verification truths).

### Archive

- Roadmap: `.planning/milestones/v1.0-ROADMAP.md`
- Requirements: `.planning/milestones/v1.0-REQUIREMENTS.md`

## v1.3 — Story Mainline & Narrative System

**Shipped:** 2026-04-29
**Phase:** 16 | **Plans:** 5

### Delivered

Persistent narrative arc system: story state tracks acts/worldFlags/atmosphereTags; 8-stage main quest with 3 conditional endings; act-aware AI prompt injection; NPC trust-gated knowledge disclosure for 7 story NPCs; deterministic location description overrides driven by worldFlags.

### Key Accomplishments

1. narrativeState store + SaveDataV5 + quest_stage_advanced event watcher
2. Act-aware narrative prompts + NPC trust-gated knowledge disclosure
3. quest_main_01 6-stage arc (3 endings: justice/harmony/shadow)
4. NPC knowledge_profile YAML + dialogue trust injection + route-lock flags
5. Location description_overrides + worldFlags priority resolution (no LLM)

**Tests at ship:** 1062 pass, 0 fail
**Known deferred items at close:** 3 (see STATE.md Deferred Items)
