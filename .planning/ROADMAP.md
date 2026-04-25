# Roadmap: Chronicle

## Milestones

- ✅ **v1.0 MVP** — Phases 1–5 (shipped 2026-04-22) — [archive](.planning/milestones/v1.0-ROADMAP.md)
- 🔄 **v1.1 Playability & Distribution** — Phases 6–10 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–5) — SHIPPED 2026-04-22</summary>

- [x] Phase 1: Foundation (6/6 plans) — Rules Engine, CLI layout, state management, World Codex schema, command parsing
- [x] Phase 2: Core Gameplay (7/7 plans) — Character creation, scene exploration, NPC dialogue, combat, AI narration
- [x] Phase 3: Persistence & World (8/8 plans) — Save/load, NPC memory, quest system, relationship tracking, content packs
- [x] Phase 4: Differentiation (9/9 plans) — Story branching, ASCII map, codex browser, keyboard shortcuts, epistemic separation
- [x] Phase 5: Polish & Optimization (7/7 plans) — Background summarizer, replay, multi-provider LLM routing, cost tracking, prompt caching

</details>

### v1.1 Playability & Distribution (Phases 6–10)

- [x] **Phase 6: Bug Fixes & Live Validation** — Core interaction bugs fixed; Enter advances game, focus switching works, quit is reliable, live UAT confirmed
- [x] **Phase 7: Streaming Output** — Narration and NPC dialogue render as typewriter effect; player can skip to end
- [ ] **Phase 8: Narrative Character Creation** — No menu on startup; guard intercept scene sets character identity through dialogue
- [ ] **Phase 9: Animation System** — Title animation, AI loading spinner, scene transitions, combat hit feedback, UI event feedback, chapter summary display
- [ ] **Phase 10: Distribution** — npm publish, Homebrew tap, GitHub Actions CI pipeline wired

## Phase Details

### Phase 6: Bug Fixes & Live Validation
**Goal**: The game is reliably interactive — core input loop works correctly and live session behaviors are confirmed
**Depends on**: Nothing (first v1.1 phase — must run before everything else)
**Requirements**: BUG-01, BUG-02, BUG-03, CARRY-01
**Success Criteria** (what must be TRUE):
  1. Player presses Enter on a highlighted suggested action and narration updates with the result
  2. Player presses `/` or Tab to move cursor focus from suggested-actions list to the free-text input and can type freely
  3. Player can exit the game at any time via Ctrl-C, `:quit`, or `:exit` without the process hanging
  4. Live session confirms `/cost` shows real token data, `/replay` panel responds interactively, and background summarizer fires after a real session
**Plans**: 5 plans
Plans:
- [x] 06-01-PLAN.md — Wire gameLoop to GameScreen + implement handleActionExecute (BUG-01)
- [x] 06-02-PLAN.md — Focus switching: / and Tab activate input, Escape deactivates (BUG-02)
- [x] 06-03-PLAN.md — Quit commands + SIGINT confirmation flow via InlineConfirm (BUG-03)
- [x] 06-04-PLAN.md — Export runNextTask + live validation scripts for /cost, /replay, summarizer (CARRY-01)
- [x] 06-05-PLAN.md — Complete unit test coverage for BUG-01, BUG-02, BUG-03 fixes [DONE]
**UI hint**: yes

### Phase 7: Streaming Output
**Goal**: AI narration and NPC dialogue stream character-by-character, making the world feel alive in real time
**Depends on**: Phase 6
**Requirements**: STREAM-01, STREAM-02, STREAM-03
**Success Criteria** (what must be TRUE):
  1. Narration text appears in the scene panel one character at a time rather than all at once after generation completes
  2. NPC dialogue streams to the scene panel with the same typewriter effect as narration
  3. Player presses any key during streaming and the full text appears immediately with no further animation
**Plans**: 4 plans
Plans:
- [x] 07-01-PLAN.md — Sentence buffer + metadata extractor utilities (TDD)
- [x] 07-02-PLAN.md — streamNpcDialogue async generator + NPC streaming events
- [x] 07-03-PLAN.md — Wire streaming narration into UI (useAiNarration + ScenePanel + skip-to-end)
- [x] 07-04-PLAN.md — Wire NPC dialogue streaming (useNpcDialogue hook + game-screen integration)

### Phase 8: Narrative Character Creation
**Goal**: The player enters the world directly through a cinematic guard encounter — no character creation menu exists
**Depends on**: Phase 6
**Requirements**: NCC-01, NCC-02, NCC-03, NCC-04
**Success Criteria** (what must be TRUE):
  1. Starting the game places the player at 黑松镇北门 in a cinematic scene with no menu or stats screen preceding it
  2. A guard NPC asks questions that surface the character's name, origin, and role through natural dialogue choices
  3. Player's dialogue responses deterministically set race, profession, background, and base stats via the Rules Engine — the character sheet reflects these values immediately
  4. After the guard dialogue ends, the normal game loop begins from 黑松镇北门 with the character fully initialized
**Plans**: 4 plans
Plans:
- [ ] 08-01-PLAN.md — Guard dialogue YAML data + loader + weight resolver engine (TDD)
- [ ] 08-02-PLAN.md — Phase routing (narrative_creation), guard AI prompts, backward compatibility
- [ ] 08-03-PLAN.md — NarrativeCreationScreen + GuardDialoguePanel + GuardNameInput + app wiring
- [ ] 08-04-PLAN.md — Delete old CharacterCreationScreen + character-creation-store cleanup
**UI hint**: yes

### Phase 9: Animation System
**Goal**: The game has visual rhythm — opening, waiting, transitions, and key events all carry motion feedback
**Depends on**: Phase 6; benefits from Phase 7 being complete (streaming and animation coordinate on narration delivery)
**Requirements**: ANIM-01, ANIM-02, ANIM-03, ANIM-04, ANIM-05, CARRY-02
**Success Criteria** (what must be TRUE):
  1. Title screen shows the Chronicle title with a typewriter or fade-in animation before the main menu appears
  2. While waiting for an AI response, a spinner or thinking animation occupies the scene panel and is replaced by streamed text when ready
  3. Entering a new scene plays a brief transition effect (fade-in or header flash) before narration begins rendering
  4. A combat hit on player or enemy HP produces a brief flash or shake on the affected value in the status bar
  5. Key UI events (option selection, skill check result, quest update, item acquired, Codex entry unlocked, chapter summary) trigger distinct visual feedback
**Plans**: 5 plans
Plans:
- [ ] 09-01-PLAN.md — Animation hooks layer (useTimedEffect, useTypewriter, useEventFlash, useToast)
- [ ] 09-02-PLAN.md — Title screen typewriter animation with progressive gradient
- [ ] 09-03-PLAN.md — SceneSpinner, ToastBanner, FadeWrapper + ScenePanel integration
- [ ] 09-04-PLAN.md — StatusBar + CombatStatusBar HP flash + CheckResultLine mount flash
- [ ] 09-05-PLAN.md — GameScreen wiring + ChapterSummaryPanel overlay + toast event subscriptions
**UI hint**: yes

### Phase 10: Distribution
**Goal**: Any user can install and launch Chronicle in under two minutes via npm or Homebrew, and releases are automated
**Depends on**: Phases 6, 7, 8, 9 (game must be stable before publishing)
**Requirements**: DIST-01, DIST-02, DIST-03, DIST-04, DIST-05
**Success Criteria** (what must be TRUE):
  1. Running `npx chronicle-cli` or `npm install -g chronicle-cli` installs and launches the game
  2. The `chronicle` binary is wired via a `bin` entry in package.json and a compiled entry point
  3. `brew tap <owner>/chronicle && brew install chronicle` installs the game and `chronicle` launches it correctly
  4. Pushing a `v*` tag triggers a GitHub Actions workflow that publishes a new npm release and updates the Homebrew formula automatically
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
| 8. Narrative Character Creation | v1.1 | 0/4 | Planning | - |
| 9. Animation System | v1.1 | 0/5 | Planning | - |
| 10. Distribution | v1.1 | 0/? | Not started | - |
