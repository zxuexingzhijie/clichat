# Retrospective

## Milestone: v1.0 MVP

**Shipped:** 2026-04-22
**Phases:** 5 | **Plans:** 37 | **Commits:** 232
**Timeline:** 3 days (2026-04-19 → 2026-04-22)
**Test suite:** 637 tests, 0 failures

### What Was Built

1. Rules Engine with D20 adjudication — AI cannot override game outcomes
2. AI Narrative Director + NPC Actor with per-character episodic memory and personality
3. Persistent world: save/load with versioned migrations (V1→V4), three-layer NPC memory, quests, reputation
4. Git-like story branching with 6-dimension diff and branch tree visualization
5. Epistemic separation: Cognitive Context Envelope ensures NPCs only see contextually appropriate knowledge
6. Multi-provider YAML-driven LLM routing with token cost tracking and Anthropic/Google prompt caching

### What Worked

- **Schema-first design**: Defining type contracts as the first plan in each phase prevented integration rework
- **TDD discipline**: Every store and engine function had tests before wiring; 637 tests at close with 0 failures
- **Phased wave execution**: Breaking phases into parallel waves (infra → engine → UI → integration) kept plans independent
- **Custom store pattern**: ~35 lines, zero deps, fully testable without React — the right call vs Zustand
- **Versioned migrations**: Chaining V1→V2→V3→V4 migrations in restore() meant no save file compatibility breaks
- **Discriminated unions**: CombatActionResult ok|error, GamePhase enum — TypeScript narrowing caught integration bugs at compile time

### What Was Inefficient

- **ROADMAP progress table**: Phase 5 showed "0/7" while plans were already checked off — stale table caused audit confusion
- **AI SDK v5 type issues**: LanguageModelV3 cast, maxOutputTokens, usage nullability — Phase 5 needed a dedicated fix pass (WR-01–05)
- **Phase 2 SUMMARY.md**: Not created at phase level — plan-level summaries exist but no phase rollup; required inferring from final plan summary
- **Live UAT deferred**: 3 behavioral tests require live API session — could have been caught with a minimal smoke test script

### Patterns Established

- Schema contracts plan (XX-01) opens every phase — locks types before any implementation
- Content expansion plan (XX-02) follows immediately — world data before engine that consumes it
- Engine/store plans (TDD) before UI plans — UI depends on stable data shapes
- Integration/wiring plan closes every phase — single commit that connects everything
- Code review + fix pass after phase execution — not optional; WR bugs were real

### Key Lessons

- Keep ROADMAP.md progress table updated after each plan; stale counters cause false audit failures
- Create a phase-level SUMMARY.md at phase close, not just plan-level summaries
- For CLI games: define a minimal `bun run smoke` script early — would have validated live AI calls in CI
- AI SDK v5 provider-specific options (cacheControl, providerOptions) differ subtly; read provider docs before implementing, not after
- Epistemic separation (Phase 4) was the hardest plan to reason about — benefit from explicit integration test documenting expected filter behavior

### Cost Observations

- Model mix: gemini-2.0-flash for all 6 AI roles (v1.0 default; YAML config in place for v1.1 tuning)
- Sessions: ~10 execution sessions across 3 days
- Notable: Background tasks (summarizer, quest planner) share the same model as real-time roles in v1.0 — Phase 5 YAML config enables differentiation in v1.1

---

## Milestone: v1.1 Playability & Distribution

**Shipped:** 2026-04-26
**Phases:** 5 | **Plans:** 23 | **Commits:** 135
**Timeline:** 4 days (2026-04-22 → 2026-04-26)
**Test suite:** 744 tests, 0 failures

### What Was Built

1. Core input loop fixed — Enter advances game, focus switching works, reliable quit via Ctrl-C/:quit/:exit
2. Streaming typewriter narration and NPC dialogue with sentence buffering and skip-to-end
3. Cinematic guard intercept scene replaces character creation menu — Rules Engine sets attributes deterministically
4. Full animation system — title typewriter with gradient, AI spinner dimout, scene fade, combat HP flash, toast notifications
5. npm + Homebrew distribution with automated GitHub Actions CI/CD release pipeline

### What Worked

- **Pure-logic + React wrapper pattern**: Animation hooks (useTimedEffect, useTypewriter) split into testable pure functions + thin React wrappers — timer tests run without React Testing Library
- **Phase dependency graph**: Phase 7/8 ran in parallel after Phase 6; Phase 9 benefited from both; Phase 10 waited for stability — correct sequencing
- **Env var propagation for data dir**: Single `__CHRONICLE_DATA_DIR` env var set before dynamic import — all consumers read it without import changes
- **Segment-based traversal guard**: Caught that path.normalize resolves '..' away — split approach is security-correct
- **Distribution scaffolding with placeholders**: OWNER/SHA256 stubs let CI/CD files pass validation; user replaces before first publish

### What Was Inefficient

- **REQUIREMENTS.md checkboxes stale**: 8 requirements showed unchecked despite being completed — traceability table never updated during execution
- **87 TypeScript errors accumulated**: A dedicated fix commit was needed after Phase 10 plans — could be caught earlier with CI running during development
- **Phase 05/07 VERIFICATION.md left as human_needed**: These were never resolved from v1.0 carry-over — acknowledged at close

### Patterns Established

- Streaming: sentence buffer accumulates partial text, flushes on sentence boundary — avoids partial-word rendering
- Animation: 3-state machine (wasProcessing → isDimming → dimComplete) for smooth spinner-to-content transition
- Distribution: fan-out CI pattern (quality-gate → parallel npm+binaries → release → homebrew dispatch)
- Security: env: blocks in GitHub Actions instead of inline ${{ }} to prevent injection in sed operations

### Key Lessons

- Keep REQUIREMENTS.md checkboxes and traceability table updated after each phase — stale state causes confusion at milestone close
- Run typecheck in CI or as pre-commit hook — 87 accumulated TS errors is a debt signal
- Pure-logic extraction pattern is worth the upfront effort for any timer/animation code
- Guard intercept scene proves narrative character creation is viable — players get immersed faster than with menus

### Cost Observations

- Model mix: Opus for planning/review agents, Sonnet for execution agents
- Sessions: ~8 execution sessions across 4 days
- Notable: Phase 10 plans averaged 1-2min each — distribution work was mostly scaffolding with little AI generation needed

---

## Cross-Milestone Trends

| Metric | v1.0 | v1.1 |
|--------|------|------|
| Phases | 5 | 5 |
| Plans | 37 | 23 |
| Tests at close | 637 | 744 |
| Timeline (days) | 3 | 4 |
| Deferred UAT items | 3 | 3 |
| Critical bugs at review | 2 | 0 |
| Code review fix passes | 1 | 1 (87 TS errors) |
