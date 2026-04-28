# Requirements — v1.2 Game System Integrity & Playability

> Milestone goal: Fix 50 known issues spanning code bugs, missing wiring, misaligned systems,
> gameplay dead ends, and content gaps. No new features — restore all existing systems to
> correct, playable state.

---

## Active Requirements

### WIRE — App Initialization & Wiring (Critical Missing Connections)

- [ ] **WIRE-01**: `saveFileManager`, `serializer`, `saveDir` wired into `createGameLoop` so `/save` and `/load` are functional
- [ ] **WIRE-02**: `questSystem` and `branchManager` wired into `createGameLoop` so `/quest` and `/branch` are functional
- [ ] **WIRE-03**: `turnLog` wired into `createGameLoop` so `/replay` is functional
- [ ] **WIRE-04**: `mapData` prop passed from `app.tsx` to `GameScreen` so `/map` renders correctly
- [ ] **WIRE-05**: `branchTree`, `branchDiffResult`, `compareBranchNames` props passed to `GameScreen` so branch panels render
- [ ] **WIRE-06**: `generateRetrievalPlanFn` passed to `createSceneManager` so RAG pipeline runs on scene load and inspect
- [ ] **WIRE-07**: `generateNarrationFn` passed to `createCombatLoop` so combat outcomes get AI narration
- [ ] **WIRE-08**: `runSummarizerLoop()` called at app startup so background summarizer and NPC memory compression run
- [ ] **WIRE-09**: `initExplorationTracker()` called at app startup so player exploration is tracked
- [ ] **WIRE-10**: `initKnowledgeTracker()` called at app startup so player knowledge is tracked

### COMBAT — Combat System Correctness

- [ ] **COMBAT-01**: Fix double enemy turn — `processEnemyTurn()` called once per player action, not twice (combat-handler + screen-controller both calling it)
- [ ] **COMBAT-02**: Fix flee success still triggering enemy turn — `combat-handler.ts` must not call `processEnemyTurn` when flee succeeded
- [ ] **COMBAT-03**: Wire combat initiation — `startCombat()` called when player enters danger area or attacks an enemy NPC
- [ ] **COMBAT-04**: Enemy abilities from YAML (`pack_tactics`, `howl`, `backstab`, `poison_blade`, `vanish`) read and applied in combat loop
- [ ] **COMBAT-05**: Spell MP costs and effects from `spells.yaml` used in `/cast`; healing spells restore HP; spell identity preserved in narration
- [ ] **COMBAT-06**: Fix `use_item` phase stuck in `resolving` if exception occurs between phase set and reset

### DIALOGUE — Dialogue System Correctness

- [ ] **DIAL-01**: Fix `endDialogue` scale mismatch — convert float-scale `dialogueState.relationshipValue` to integer-scale delta before calling `applyReputationDelta` (WR-05)
- [ ] **DIAL-02**: Fix `isQuestNpc` using English keywords on Chinese NPC goals — replace with Chinese keyword matching or YAML `role` field check
- [ ] **DIAL-03**: Fix streaming path always producing `sentiment: 'neutral'` in `metadata-extractor.ts` — extract sentiment from streamed content or use structured output
- [ ] **DIAL-04**: Fix `inline` dialogue mode — player must be able to respond to NPC in inline mode (show dialogue input, not scene actions)
- [ ] **DIAL-05**: Fix NPC role questions coverage — add question templates for `innkeeper`, `hunter`, `beggar`, `clergy`, `military`, `underworld` NPC roles
- [ ] **DIAL-06**: Fix `use-npc-dialogue.ts` streaming completion detection running as render side-effect — move to `useEffect`
- [ ] **DIAL-07**: Fix `handleNpcDialogueComplete` firing twice — guard against double-fire when `npcMetadata` transitions

### QUEST — Quest System

- [ ] **QUEST-01**: Create `world-data/codex/quests.yaml` with main quest (`quest_main_01`) and side quests (`quest_side_missing_ore`, `quest_side_overdue_debt`, `quest_side_wolf_bounty`)
- [ ] **QUEST-02**: Add quest command routing for `complete`, `fail`, `status`, `journal` in `quest-handler.ts`
- [ ] **QUEST-03**: Wire quest stage advancement triggers from game events (dialogue_ended, combat_ended, item_found)

### SAVE — Save/Branch System

- [ ] **SAVE-01**: Fix `serializer.snapshot()` hardcoding `saveName: 'Quick Save'` and `playtime: 0` — pass name and compute playtime
- [ ] **SAVE-02**: Fix `branch-handler.ts` switch not calling `serializer.restore()` — branch switch must load the branch's game state
- [ ] **SAVE-03**: Fix `load-handler.ts` path traversal — pass `saveDir` to `loadGame()` to restore security check

### REPUTATION — Reputation & Relationship System

- [ ] **REP-01**: Fix `applyReputationDelta` scale mismatch in `endDialogue` (same as DIAL-01 — fix together)
- [ ] **REP-02**: Fix `getAttitudeLabel` and `relationshipLabel` using incompatible scales — reconcile display after WR-05 fix
- [ ] **REP-03**: Wire faction reputation writes — `applyReputationDelta` called on faction when player actions affect a faction
- [ ] **REP-04**: Fix reputation events firing on game load (WR-01) — suppress `reputation_changed` during state restore

### MEMORY — NPC Memory System

- [ ] **MEM-01**: Fix `applyRetention` promoting oldest memory instead of lowest-importance (WR-03) — sort by importance before eviction
- [ ] **MEM-02**: Fix in-memory NPC memory store not enforcing `max(15)` — apply retention in-memory, not only on disk write

### SCENE — Scene & Map System

- [ ] **SCENE-01**: Fix `scene-manager.ts` local `currentSceneId` closure not updated on game load — update closure on state restore
- [ ] **SCENE-02**: Fix `/look` (no target) being a no-op — re-narrate current scene with AI on `/look` with no target
- [ ] **SCENE-03**: Fix `/cast` outside combat routing to `handleDefault` — return clear error "你现在不在战斗中" or enter combat context

### CODEX — Codex & Knowledge Display

- [ ] **CODEX-01**: Fix `codexDisplayEntries` hardcoding `knowledgeStatus: null` — read from `playerKnowledgeStore` when building display entries
- [ ] **CODEX-02**: Fix safety filter false positives on legitimate Chinese narration (e.g. "你获得了10枚金币") — tighten regex pattern

### CONTENT — World Content Gaps

- [ ] **CONT-01**: Fix `loc_north_gate.notable_npcs` missing `npc_captain` and `npc_hunter` — add them to locations YAML
- [ ] **CONT-02**: Fix `loc_temple.notable_npcs` missing `npc_herbalist` — add to locations YAML
- [ ] **CONT-03**: Fix `loc_main_street.notable_npcs` empty — add `npc_elder` (镇长) to locations YAML
- [ ] **CONT-04**: Add discovery mechanism for `npc_shadow_contact` (hidden NPC) — bartender or knowledge check unlocks
- [ ] **CONT-05**: Add content to `loc_dark_cave` — at least one enemy encounter trigger and environmental description

### DEATH — Death & Recovery

- [ ] **DEATH-01**: Fix death screen offering only "return to title" — add "load last save" option and auto-save before death if no save exists

---

## Future Requirements (Deferred)

- Multiplayer / persistent shared world — v2+
- Complex economy / trading system — v2+
- Custom magic language — v2+
- Deep multimodal input — v2+
- Enemy loot dropping to player inventory (requires WIRE-* first) — v1.3
- Full NPC discovery/unlock system for all hidden NPCs — v1.3
- Journey turn granularity (travel, camp, resupply) — v1.3

---

## Out of Scope (v1.2)

- New features not present in v1.1 design
- UI visual redesign
- New world regions or factions
- Multiplayer

---

## Traceability

> Filled by roadmapper.

---

*Last updated: 2026-04-28 — v1.2 milestone start*
