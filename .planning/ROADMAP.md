# Roadmap: Chronicle

## Milestones

- ✅ **v1.0 MVP** — Phases 1–5 (shipped 2026-04-22) — [archive](.planning/milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Playability & Distribution** — Phases 6–10 (shipped 2026-04-26) — [archive](.planning/milestones/v1.1-ROADMAP.md)
- 🚧 **v1.2 Game System Integrity & Playability** — Phases 11–15 (in progress)

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

### 🚧 v1.2 Game System Integrity & Playability (In Progress)

**Milestone Goal:** Fix 46 known issues — restore save/quest/branch/map/RAG wiring, combat correctness, dialogue/reputation integrity, quest content, memory eviction, scene/codex correctness, and world content gaps to correct playable state.

- [ ] **Phase 11: App Wiring** — Wire all missing injections in app.tsx so every game system is connected at startup
- [ ] **Phase 12: Combat & Save Correctness** — Fix double enemy turn, flee bug, combat initiation, abilities, spells, and save/branch state issues
- [ ] **Phase 13: Dialogue & Reputation** — Fix reputation scale mismatch, inline dialogue, NPC role questions, streaming sentiment, and faction writes
- [ ] **Phase 14: Quest, Memory, Scene & Codex** — Create quests.yaml, fix quest routing, scene closure, /look, /cast routing, memory eviction, and codex display (4 plans)
- [ ] **Phase 15: Content & Death Recovery** — Fill notable_npcs arrays, add dark cave content, wire shadow contact discovery, fix death screen

## Phase Details

### Phase 11: App Wiring
**Goal**: Every game system (save, quest, branch, replay, map, RAG, summarizer, exploration tracker, knowledge tracker) is connected to the game loop and boots correctly at startup
**Depends on**: Phase 10 (v1.1 complete)
**Requirements**: WIRE-01, WIRE-02, WIRE-03, WIRE-04, WIRE-05, WIRE-06, WIRE-07, WIRE-08, WIRE-09, WIRE-10
**Success Criteria** (what must be TRUE):
  1. Player can type `:save` and the game saves to disk without error
  2. Player can type `:quest` and the quest journal renders (no crash)
  3. Player can type `:branch` and branch panels render with current tree
  4. Player can type `:replay` and turn history is displayed
  5. Player can type `:map` and the ASCII map renders the current location
**Plans**: 3 plans
Plans:
- [ ] 11-P01-PLAN.md — Refactor app.tsx to createGameContext(); wire save, quest, branch, turnLog into gameLoop (WIRE-01/02/03)
- [ ] 11-P02-PLAN.md — Wire RAG retrieval planner, combat narration, mapData, branchTree props (WIRE-04/05/06/07)
- [ ] 11-P03-PLAN.md — Wire summarizer, exploration tracker, knowledge tracker startup; fix codexDisplayEntries knowledgeStatus (WIRE-08/09/10)

### Phase 12: Combat & Save Correctness
**Goal**: Combat resolves correctly (one enemy turn per round, flee exits cleanly, combat initiates on danger entry), spells and abilities work, and saves correctly name/timestamp/restore
**Depends on**: Phase 11
**Requirements**: COMBAT-01, COMBAT-02, COMBAT-03, COMBAT-04, COMBAT-05, COMBAT-06, SAVE-01, SAVE-02, SAVE-03
**Success Criteria** (what must be TRUE):
  1. After the player attacks, the enemy takes exactly one turn before control returns
  2. After the player flees successfully, the enemy does not take an additional turn
  3. Walking into a danger area or attacking an enemy NPC initiates combat
  4. Casting a healing spell restores HP; spell name appears in narration
  5. Saving a game stores the custom name; loading a branch restores its game state
**Plans**: 4 plans
Plans:
- [ ] 12-P01-PLAN.md — Parametrize snapshot() saveName/playtime; fix branch switch loadGame; fix load-handler saveDir arg; fix ActionContext types (SAVE-01/02/03)
- [ ] 12-P02-PLAN.md — Delete unconditional processEnemyTurn; add flee/outcome guard; wrap processPlayerAction in try/catch (COMBAT-01/02/06)
- [ ] 12-P03-PLAN.md — Add LocationSchema enemies field; auto combat trigger on move; explicit :attack NPC initiation (COMBAT-03)
- [ ] 12-P04-PLAN.md — Implement enemy abilities (pack_tactics/howl/backstab/poison_blade/vanish); data-driven spell cast (COMBAT-04/05)

### Phase 13: Dialogue & Reputation
**Goal**: Reputation values use a consistent scale end-to-end, inline dialogue lets the player respond, NPC role questions cover all role types, and streaming dialogue correctly extracts sentiment
**Depends on**: Phase 11
**Requirements**: DIAL-01, DIAL-02, DIAL-03, DIAL-04, DIAL-05, DIAL-06, DIAL-07, REP-01, REP-02, REP-03, REP-04
**Success Criteria** (what must be TRUE):
  1. Talking to an NPC and completing dialogue changes the relationship label consistently (no scale mismatch)
  2. In inline dialogue mode, the player sees an input field and can type a response to the NPC
  3. An NPC with role `innkeeper`, `hunter`, or `clergy` offers relevant role-specific questions
  4. After streaming dialogue completes, the sentiment-based reputation delta is applied (not stuck at neutral)
  5. Reputation events do not fire spuriously on game load
**Plans**: TBD

### Phase 14: Quest, Memory, Scene & Codex
**Goal**: The quest system has content and correct routing, scene state restores on load, /look re-narrates, /cast gives a clear out-of-combat error, NPC memory evicts by importance, and codex entries show correct knowledge status
**Depends on**: Phase 11
**Requirements**: QUEST-01, QUEST-02, QUEST-03, MEM-01, MEM-02, SCENE-01, SCENE-02, SCENE-03, CODEX-01, CODEX-02
**Success Criteria** (what must be TRUE):
  1. The quest journal shows the main quest and at least two side quests after accepting them
  2. Typing `:quest complete` or `:quest journal` routes to the correct handler without error
  3. After loading a save, `:look` describes the correct saved location (not a stale starting scene)
  4. Typing `:cast` outside combat returns "你现在不在战斗中" instead of routing to handleDefault
  5. Codex entries for discovered items show `已知` knowledge status; undiscovered entries show `未知`
**Plans**: 4 plans
Plans:
- [ ] 14-01-PLAN.md — Extend QuestStageSchema with trigger field; create quests.yaml (QUEST-01)
- [ ] 14-02-PLAN.md — Quest event-based stage advancement; :quest status/journal handlers (QUEST-02, QUEST-03)
- [ ] 14-03-PLAN.md — Fix memory eviction ordering; addMemory inline max(15); scene-manager stale closure; /look re-narration (MEM-01, MEM-02, SCENE-01, SCENE-02)
- [ ] 14-04-PLAN.md — handleCast outside combat error; tighten safety filter; CODEX-01 verified (SCENE-03, CODEX-01, CODEX-02)

### Phase 15: Content & Death Recovery
**Goal**: Notable NPCs are present at their locations, the dark cave has an encounter, the shadow contact is discoverable, and the death screen offers a load-last-save option
**Depends on**: Phase 14
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, DEATH-01
**Success Criteria** (what must be TRUE):
  1. Visiting the North Gate shows Captain and Hunter as available NPCs to talk to
  2. Visiting the Temple shows the Herbalist NPC; visiting Main Street shows the Elder
  3. The dark cave has at least one enemy encounter trigger when entered
  4. After a bartender conversation or knowledge check, the shadow contact NPC becomes visible
  5. The death screen offers both "return to title" and "load last save"; if no save exists, an auto-save is created before death
**Plans**: 2 plans
Plans:
- [ ] 15-01-PLAN.md — Add notable_npcs to 4 locations and enemies to loc_dark_cave in locations.yaml (CONT-01..05)
- [ ] 15-02-PLAN.md — revealedNpcs on GameState; shadow contact discovery; loadLastSave on GameLoop; death screen key routing; emergency save on defeat (CONT-04, DEATH-01)

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
| 11. App Wiring | v1.2 | 0/3 | Not started | - |
| 12. Combat & Save Correctness | v1.2 | 0/4 | Not started | - |
| 13. Dialogue & Reputation | v1.2 | 0/TBD | Not started | - |
| 14. Quest, Memory, Scene & Codex | v1.2 | 4/4 | Complete | 2026-04-28 |
| 15. Content & Death Recovery | v1.2 | 0/2 | Not started | - |
