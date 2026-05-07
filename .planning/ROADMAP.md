# Roadmap: Chronicle

## Milestones

- ✅ **v1.0 MVP** — Phases 1–5 (shipped 2026-04-22) — [archive](.planning/milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Playability & Distribution** — Phases 6–10 (shipped 2026-04-26) — [archive](.planning/milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Game System Integrity & Playability** — Phases 11–15 (shipped 2026-04-29) — [archive](.planning/milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 Story Mainline & Narrative System** — Phase 16 (shipped 2026-04-29) — [archive](.planning/milestones/v1.3-ROADMAP.md)
- ✅ **v1.4 AI Quality & Game Completeness** — Phases 17–21 (shipped 2026-04-30) — [archive](.planning/milestones/v1.4-ROADMAP.md)
- 🚧 **v1.5 Ecosystem Engine** — Phases 22–24 (in progress)

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
<summary>✅ v1.4 AI Quality & Game Completeness (Phases 17–21) — SHIPPED 2026-04-30</summary>

- [x] **Phase 17: NPC Architecture Fix** — narrativeContext wired into NPC Actor; sentiment routed through Rules Engine
- [x] **Phase 18: Multi-Turn Dialogue** — ai-caller.ts messages[] API; DialogueManager history per session; guard dialogue context accumulation
- [x] **Phase 19: AI Output Quality** — generateObject for narration; intent-classifier cost tracking; summarizer graceful shutdown
- [x] **Phase 20: Enemy Loot System** — loot_table in EnemySchema; combat drops items on death; :take from scene; SaveDataV6
- [x] **Phase 21: Distribution & Live Validation** — package.json v1.4.0; npm publish --dry-run clean; Homebrew review PASS; Live API UAT checklist

</details>

### 🚧 v1.5 Ecosystem Engine (In Progress)

**Milestone Goal:** Evolve from "one game" to "CLI-native world simulation ecosystem" — UX architecture refactor + World Pack platform + Delight Layer visual system.

- [ ] **Phase 22: UX Architecture Refactor** - Context Providers, NarrativeRenderer, GameScreen slim-down, 7-state input state machine, injectable Clock
- [ ] **Phase 23: World Pack Platform** - Pack spec, namespace prefix, composable interfaces, SDK CLI, cached loader, save migration
- [ ] **Phase 24: Delight Layer** - 墨韵呼吸 design system: BPM timing, 墨分五色, sine-curve typing, NPC glyphs, weather, faction meter, story export, entry animation

## Phase Details

### Phase 22: UX Architecture Refactor
**Goal**: GameScreen becomes a thin orchestrator; all state access flows through Context Providers with selector hooks; input handling covers all 7 game states cleanly
**Depends on**: Phase 21 (v1.4 complete)
**Requirements**: UXA-01, UXA-02, UXA-03, UXA-04, UXA-05
**Success Criteria** (what must be TRUE):
  1. GameScreen component is under 100 lines; all domain logic delegated to Context Providers
  2. AtmosphereProvider, NarrativeProvider, and InputProvider each testable in isolation (unit tests pass without rendering GameScreen)
  3. NarrativeRenderer replaces ScenePanel entirely; switching to dialogue mode happens internally without parent re-mount
  4. Input state machine handles all 7 states (EXPLORATION, DIALOGUE, COMBAT, MENU, CODEX, MAP, BRANCH) with correct keyboard context per state
  5. All timing-dependent tests use injectable Clock; no flaky setTimeout-based assertions remain
**Plans**: TBD
**UI hint**: yes

### Phase 23: World Pack Platform
**Goal**: A second world pack can be loaded alongside Classic Fantasy; content authors have SDK tooling to scaffold, validate, and diff packs; saves migrate cleanly to namespaced format
**Depends on**: Phase 22 (decoupled architecture enables pack-driven content injection)
**Requirements**: WPK-01, WPK-02, WPK-03, WPK-04, WPK-05, WPK-06, WPK-07, WPK-08
**Success Criteria** (what must be TRUE):
  1. `chronicle validate` passes on Classic Fantasy pack restructured under pack spec (manifest.yaml + directory convention)
  2. Two packs loaded simultaneously without entity ID collision (namespace prefix `@pack/entity_id` resolves all references)
  3. `chronicle init` scaffolds a valid pack structure; `chronicle diff` shows meaningful entity-level changes
  4. WorldPackLoader is a pure function called from cli.ts (pre-React); cached WorldState cold start < 5ms with warm cache
  5. Existing v1.4 saves auto-migrate to V7 namespaced format on load; no data loss
**Plans**: TBD

### Phase 24: Delight Layer
**Goal**: DESIGN.md fully implemented in code; the terminal world breathes with rhythm, ink-hierarchy colors, and meaningful silence — players notice the world is alive in every interaction
**Depends on**: Phase 22 (NarrativeRenderer provides the rendering surface for typing effects, silence system, and atmosphere integration)
**Requirements**: DLT-01, DLT-02, DLT-03, DLT-04, DLT-05, DLT-06, DLT-07, DLT-08, DLT-09, DLT-10, DLT-11, DLT-12
**Success Criteria** (what must be TRUE):
  1. All animation timing derives from global BPM; changing scene mood (calm/tension/combat/dreamlike) visibly changes typing speed, cursor blink, and dot cycling in unison
  2. Text color hierarchy follows 墨分五色 exclusively (bold white / white / gray / dim / faint); 朱砂红 appears ONLY on HP<20%, betrayal, or death
  3. NPC dialogue displays with sine-curve typing rhythm (sentence-start fast, sentence-end slow) and Chinese punctuation pauses (。= long, ！= zero, ……= 3x slower)
  4. `chronicle export --story` produces a readable markdown document of the player's narrative journey
  5. 入墨序列 plays on startup: 7.5s gradual emergence from void to title following the breathing curve
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 22 → 23 → 24

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
| 17. NPC Architecture Fix | v1.4 | 2/2 | Complete | 2026-04-30 |
| 18. Multi-Turn Dialogue | v1.4 | 3/3 | Complete | 2026-04-30 |
| 19. AI Output Quality | v1.4 | 3/3 | Complete | 2026-04-30 |
| 20. Enemy Loot System | v1.4 | 3/3 | Complete | 2026-04-30 |
| 21. Distribution & Live Validation | v1.4 | 3/3 | Complete | 2026-04-30 |
| 22. UX Architecture Refactor | v1.5 | 0/? | Not started | - |
| 23. World Pack Platform | v1.5 | 0/? | Not started | - |
| 24. Delight Layer | v1.5 | 0/? | Not started | - |
