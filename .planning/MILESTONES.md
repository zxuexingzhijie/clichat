# Milestones

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
