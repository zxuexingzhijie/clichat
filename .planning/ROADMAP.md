# Roadmap: Chronicle

## Milestones

- ✅ **v1.0 MVP** — Phases 1–5 (shipped 2026-04-22) — [archive](.planning/milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Playability & Distribution** — Phases 6–10 (shipped 2026-04-26) — [archive](.planning/milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Game System Integrity & Playability** — Phases 11–15 (shipped 2026-04-29) — [archive](.planning/milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 Story Mainline & Narrative System** — Phase 16 (shipped 2026-04-29) — [archive](.planning/milestones/v1.3-ROADMAP.md)
- ✅ **v1.4 AI Quality & Game Completeness** — Phases 17–21 (shipped 2026-04-30) — [archive](.planning/milestones/v1.4-ROADMAP.md)

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
| 17. NPC Architecture Fix | v1.4 | 2/2 | Complete | 2026-04-30 |
| 18. Multi-Turn Dialogue | v1.4 | 3/3 | Complete | 2026-04-30 |
| 19. AI Output Quality | v1.4 | 3/3 | Complete | 2026-04-30 |
| 20. Enemy Loot System | v1.4 | 3/3 | Complete | 2026-04-30 |
| 21. Distribution & Live Validation | v1.4 | 3/3 | Complete | 2026-04-30 |
