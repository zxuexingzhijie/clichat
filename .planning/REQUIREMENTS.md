# Requirements: Chronicle v1.1

**Defined:** 2026-04-22
**Core Value:** The player must feel they are in a persistent, consistent world that remembers them — not a chatbot that reinvents the universe every turn.

## v1.1 Requirements

Requirements for the Playability & Distribution milestone. Phases continue from v1.0 (starts at Phase 6).

---

### Bug Fixes (BUG)

- [ ] **BUG-01**: Player can press Enter on a suggested action and the game advances (narration updates, world state changes) — currently Enter does nothing after selecting an action
- [ ] **BUG-02**: Player can switch focus from the suggested-actions list to the free-text input field at the bottom using `/` or Tab, and type a custom action — currently cursor cannot reach the input area
- [x] **BUG-03
**: Player can quit the game at any time via `Ctrl-C`, `:quit`, or `:exit` — currently no reliable exit path exists

---

### Streaming Output (STREAM)

- [ ] **STREAM-01**: AI narration (Narrative Director) is rendered character-by-character as a streaming typewriter effect in the scene panel — not displayed all at once after full generation
- [ ] **STREAM-02**: NPC dialogue (NPC Actor) is streamed to the dialogue/scene panel with the same typewriter effect
- [ ] **STREAM-03**: Player can interrupt streaming output by pressing any key and see the full text immediately (skip-to-end behavior)

---

### Narrative Character Creation (NCC)

- [x] **NCC-01
**: The game begins with the player arriving at 黑松镇北门 in a cinematic scene — no character creation menu appears before entering the world
- [ ] **NCC-02**: A guard NPC intercepts the player and asks questions that naturally surface character identity (name, origin, profession/role) through dialogue choices
- [ ] **NCC-03**: Player's responses to the guard's questions determine starting attributes (race, profession, background, base stats) deterministically via the Rules Engine — not via a separate stats screen
- [x] **NCC-04
**: After the guard interaction concludes, the player's character sheet is fully initialized and the normal game loop begins from 黑松镇北门

---

### Animation System (ANIM)

- [ ] **ANIM-01**: Opening title screen displays Chronicle's title with a typewriter or fade-in animation before entering the main menu
- [ ] **ANIM-02**: While waiting for an AI response (narration or NPC dialogue), a spinner or "thinking" animation is shown in the scene panel — replaced by streamed output when ready
- [ ] **ANIM-03**: Entering a new scene plays a brief transition effect (e.g. fade-in, scene header flash) before narration renders
- [ ] **ANIM-04**: Combat hits (player and enemy) produce a brief flash/shake text effect on the affected HP value in the status bar
- [ ] **ANIM-05**: UI feedback animations fire on key events: option selection highlight, skill check result (success flash / failure dim), quest update banner, item acquired notice, Codex entry unlocked notice

---

### Distribution (DIST)

- [ ] **DIST-01**: The game is published to npm as `chronicle-cli` — users can run `npx chronicle-cli` or `npm install -g chronicle-cli` to play
- [ ] **DIST-02**: A `bin` entry in package.json and a compiled entry point allow the game to launch via a single CLI command (`chronicle`)
- [ ] **DIST-03**: A Homebrew tap repository (`homebrew-chronicle`) exists with a Formula that downloads the npm package and wires up the `chronicle` binary
- [ ] **DIST-04**: Users can install via `brew tap <owner>/chronicle && brew install chronicle` and the game launches correctly
- [ ] **DIST-05**: A GitHub Actions workflow builds and publishes a new npm release + updates the Homebrew formula on every version tag push (`v*`)

---

## Carry-over from v1.0 Active

- [ ] **CARRY-01**: Live session validation of `/cost`, `/replay`, background summarizer (requires API session)
- [ ] **CARRY-02**: Chapter summary display wired to game-screen UI

---

## Future Requirements (v1.2+)

- Multiplayer spectator mode
- Creator marketplace / mod platform
- Complex economy with trade routes
- Mobile companion app

---

## Out of Scope (v1.1)

| Feature | Reason |
|---------|--------|
| Web/graphical UI | CLI-first is product identity |
| Offline/local LLM | API-based is correct path |
| Multiplayer | v2+ scope |
| Voice input/output | Text-only medium |
| Windows native distribution | macOS + Linux first; Windows via WSL acceptable |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 | Phase 6 | Pending |
| BUG-02 | Phase 6 | Pending |
| BUG-03 | Phase 6 | Pending |
| CARRY-01 | Phase 6 | Pending |
| STREAM-01 | Phase 7 | Pending |
| STREAM-02 | Phase 7 | Pending |
| STREAM-03 | Phase 7 | Pending |
| NCC-01 | Phase 8 | Pending |
| NCC-02 | Phase 8 | Pending |
| NCC-03 | Phase 8 | Pending |
| NCC-04 | Phase 8 | Pending |
| ANIM-01 | Phase 9 | Pending |
| ANIM-02 | Phase 9 | Pending |
| ANIM-03 | Phase 9 | Pending |
| ANIM-04 | Phase 9 | Pending |
| ANIM-05 | Phase 9 | Pending |
| CARRY-02 | Phase 9 | Pending |
| DIST-01 | Phase 10 | Pending |
| DIST-02 | Phase 10 | Pending |
| DIST-03 | Phase 10 | Pending |
| DIST-04 | Phase 10 | Pending |
| DIST-05 | Phase 10 | Pending |

**Coverage:**
- v1.1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-04-22 | Traceability updated: 2026-04-23*
