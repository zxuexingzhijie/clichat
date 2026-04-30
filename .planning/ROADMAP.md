# Roadmap: Chronicle

## Milestones

- ✅ **v1.0 MVP** — Phases 1–5 (shipped 2026-04-22) — [archive](.planning/milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Playability & Distribution** — Phases 6–10 (shipped 2026-04-26) — [archive](.planning/milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Game System Integrity & Playability** — Phases 11–15 (shipped 2026-04-29) — [archive](.planning/milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 Story Mainline & Narrative System** — Phase 16 (shipped 2026-04-29) — [archive](.planning/milestones/v1.3-ROADMAP.md)
- 🔄 **v1.4 AI Quality & Game Completeness** — Phases 17–21 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–5) — SHIPPED 2026-04-22</summary>

- [x] Phase 1: Foundation (6/6 plans) — Rules Engine, CLI layout, state management, World Codex schema, command parsing
- [x] Phase 2: Core Gameplay (7/7 plans) — Character creation, scene exploration, NPC dialogue, combat, AI narration
- [x] Phase 3: Persistence & World (8/8 plans) — Save/load, NPC memory, quest system, relationship tracking, content packs
- [x] Phase 4: Differentiation (9/9 plans) — Story branching, ASCII map, codex browser, keyboard shortcuts, epistemic separation
- [x] Phase 5: Polish & Optimization (7/7 plans) — Background summarizer, replay, multi-provider LLM routing, cost tracking, prompt caching

</details>

<details>
<summary>✅ v1.1 Playability & Distribution (Phases 6–10) — SHIPPED 2026-04-26</summary>

- [x] Phase 6: Bug Fixes & Live Validation (5/5 plans) — Core input loop fixed, focus switching, reliable quit, live UAT
- [x] Phase 7: Streaming Output (4/4 plans) — Typewriter narration and NPC dialogue, skip-to-end
- [x] Phase 8: Narrative Character Creation (4/4 plans) — Guard intercept scene, no menu, Rules Engine attribute setting
- [x] Phase 9: Animation System (5/5 plans) — Title animation, spinner, scene transitions, combat flash, toast feedback
- [x] Phase 10: Distribution (5/5 plans) — npm publish, Homebrew tap, GitHub Actions CI/release pipeline

</details>

<details>
<summary>✅ v1.2 Game System Integrity & Playability (Phases 11–15) — SHIPPED 2026-04-29</summary>

- [x] Phase 11: App Wiring (3/3 plans) — All game systems wired at startup
- [x] Phase 12: Combat & Save Correctness (4/4 plans) — Combat, flee, abilities, save/branch fixed
- [x] Phase 13: Dialogue & Reputation (4/4 plans) — Scale mismatch, inline mode, sentiment, faction writes
- [x] Phase 14: Quest, Memory, Scene & Codex (4/4 plans) — quests.yaml, memory eviction, /look, /cast
- [x] Phase 15: Content & Death Recovery (2/2 plans) — NPC placement, dark cave, shadow contact, death screen

</details>

<details>
<summary>✅ v1.3 Story Mainline & Narrative System (Phase 16) — SHIPPED 2026-04-29</summary>

- [x] Phase 16: Story Mainline & Narrative System (5/5 plans) — narrativeState store, act-aware prompts, 6-stage quest arc, NPC trust disclosure, location overrides

</details>

<details>
<summary>🔄 v1.4 AI Quality & Game Completeness (Phases 17–21) — IN PROGRESS</summary>

- [ ] **Phase 17: NPC Architecture Fix** — narrativeContext wired into NPC Actor; sentiment routed through Rules Engine
- [ ] **Phase 18: Multi-Turn Dialogue** — ai-caller.ts messages[] API; DialogueManager history per session; guard dialogue context accumulation
- [ ] **Phase 19: AI Output Quality** — generateObject for narration; intent-classifier cost tracking; summarizer graceful shutdown
- [ ] **Phase 20: Enemy Loot System** — loot_table in EnemySchema; combat drops items on death; :take from scene
- [ ] **Phase 21: Distribution & Live Validation** — OWNER placeholders replaced; npm publish --dry-run clean; live API UAT passes

</details>

## v1.4 AI Quality & Game Completeness

**Goal:** Fix critical AI architecture violations discovered in code audit, implement true multi-turn NPC dialogue, and complete deferred game/distribution features for a publishable build.
**Phases:** 17–21
**Total Plans:** TBD

## Phase Details

### Phase 17: NPC Architecture Fix
**Goal**: NPC dialogue tone and relationship changes are governed by proper architecture — no direct state mutations bypassing the Rules Engine
**Depends on**: Phase 16 (v1.3)
**Requirements**: ARCH-01, ARCH-02
**Success Criteria** (what must be TRUE):
  1. NPC Actor system prompt includes current act and atmosphere tags from narrativeStore — NPC dialogue tone shifts between acts without manual prompt editing
  2. Talking to an NPC and receiving a positive/negative sentiment response updates relationship via `adjudicateTalkResult`, not a direct delta — the Rules Engine owns the change
  3. Unit tests confirm the `void` bug in npc-actor.ts is eliminated and narrativeContext flows through the call chain
  4. No regression in existing NPC dialogue tests
**Plans**: TBD

### Phase 18: Multi-Turn Dialogue
**Goal**: NPC conversations accumulate context across exchanges — each reply builds on prior turns instead of starting fresh
**Depends on**: Phase 17
**Requirements**: DIAL-01, DIAL-02, DIAL-03
**Success Criteria** (what must be TRUE):
  1. Player can have a 3-turn exchange with an NPC where the NPC's third response demonstrably references or builds on earlier turns — not a fresh context-free reply
  2. The character creation guard dialogue (4 rounds) uses accumulated messages[] — the guard's later questions reflect the player's earlier answers
  3. `ai-caller.ts` accepts and forwards a `messages[]` array to the LLM API without serializing history to plain text
  4. DialogueManager stores history as `{role, content}[]` per session and resets cleanly on session end
**Plans**: 3 plans
Plans:
- [ ] 18-01-PLAN.md — ai-caller.ts multi_turn 模式 + npc-actor.ts 类型迁移 (DIAL-01)
- [ ] 18-02-PLAN.md — dialogueHistory 原子迁移 {speaker,text}→{role,content} + historySection 删除 (DIAL-02)
- [ ] 18-03-PLAN.md — useNpcDialogue messagesRef 积累 + 守卫对话接线 (DIAL-03)

### Phase 19: AI Output Quality
**Goal**: AI-generated narration is schema-validated, intent classification costs are tracked, and the summarizer shuts down gracefully
**Depends on**: Phase 17
**Requirements**: AI-05, AI-06, AI-07
**Success Criteria** (what must be TRUE):
  1. Narration output is never truncated mid-sentence — `generateNarration` enforces `text.max(300)` via Zod schema, not manual slice
  2. The `:cost` command shows intent classification token usage alongside narration and NPC costs — no AI call is invisible to the cost tracker
  3. Sending Ctrl-C during an active summarizer loop exits cleanly with a log line — no unhandled promise rejection, no orphaned process
**Plans**: TBD

### Phase 20: Enemy Loot System
**Goal**: Defeating enemies yields items that persist in the scene and can be picked up
**Depends on**: Phase 17
**Requirements**: GAME-01
**Success Criteria** (what must be TRUE):
  1. At least one enemy in the Classic Fantasy world has a defined `loot_table` in its YAML schema entry
  2. Killing that enemy causes at least one item to appear in the scene — `:look` lists it among scene contents
  3. Player can `:take [item]` to move the dropped item into inventory — item persists after save/load
**Plans**: TBD

### Phase 21: Distribution & Live Validation
**Goal**: The package is publishable and live API behavior matches the implementation's claims
**Depends on**: Phase 19, Phase 20
**Requirements**: DIST-01, UAT-01
**Success Criteria** (what must be TRUE):
  1. `npm publish --dry-run` completes without errors — no OWNER placeholders remain in package.json, Homebrew formula, or GitHub Actions workflows
  2. Live API session: `:cost` displays accurate token counts that include intent classification usage added in Phase 19
  3. Live API session: `:replay` replays the last 5 turns with correct narration matching the actual game history
  4. Live API session: background summarizer compresses NPC memory after 10+ interactions without error
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 6/6 | Complete | 2026-04-20 |
| 2. Core Gameplay | v1.0 | 7/7 | Complete | 2026-04-21 |
| 3. Persistence & World | v1.0 | 8/8 | Complete | 2026-04-21 |
| 4. Differentiation | v1.0 | 9/9 | Complete | 2026-04-22 |
| 5. Polish & Optimization | v1.0 | 7/7 | Complete | 2026-04-22 |
| 6. Bug Fixes & Live Validation | v1.1 | 5/5 | Complete | 2026-04-24 |
| 7. Streaming Output | v1.1 | 4/4 | Complete | 2026-04-24 |
| 8. Narrative Character Creation | v1.1 | 4/4 | Complete | 2026-04-25 |
| 9. Animation System | v1.1 | 5/5 | Complete | 2026-04-25 |
| 10. Distribution | v1.1 | 5/5 | Complete | 2026-04-26 |
| 11. App Wiring | v1.2 | 3/3 | Complete | 2026-04-28 |
| 12. Combat & Save Correctness | v1.2 | 4/4 | Complete | 2026-04-28 |
| 13. Dialogue & Reputation | v1.2 | 4/4 | Complete | 2026-04-28 |
| 14. Quest, Memory, Scene & Codex | v1.2 | 4/4 | Complete | 2026-04-28 |
| 15. Content & Death Recovery | v1.2 | 2/2 | Complete | 2026-04-28 |
| 16. Story Mainline & Narrative System | v1.3 | 5/5 | Complete | 2026-04-29 |
| 17. NPC Architecture Fix | v1.4 | 0/TBD | Not started | - |
| 18. Multi-Turn Dialogue | v1.4 | 0/TBD | Not started | - |
| 19. AI Output Quality | v1.4 | 0/TBD | Not started | - |
| 20. Enemy Loot System | v1.4 | 0/TBD | Not started | - |
| 21. Distribution & Live Validation | v1.4 | 0/TBD | Not started | - |
