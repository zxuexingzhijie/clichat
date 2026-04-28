# Phase 14: Quest, Memory, Scene & Codex - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix quest content + routing, NPC memory eviction, scene state restore, /look re-narration, /cast error, codex knowledge display, and safety filter false positives. All existing systems restored to correct playable state. No new features.

Requirements: QUEST-01, QUEST-02, QUEST-03, MEM-01, MEM-02, SCENE-01, SCENE-02, SCENE-03, CODEX-01, CODEX-02

</domain>

<decisions>
## Implementation Decisions

### Quest Content (QUEST-01)

- **D-01:** Main quest (`quest_main_01`) gets full treatment — 3 stages with distinct trigger types, world-state changes per stage, and NPC/reputation consequences.
- **D-02:** Side quests (`quest_side_missing_ore`, `quest_side_overdue_debt`, `quest_side_wolf_bounty`) get minimal stubs — 2 stages each, one objective per stage, no branching.
- **D-03:** Main quest stage design:
  - Stage 1 (start → 调查谣言): Auto-accepted after talking to any NPC. Trigger: `dialogue_ended`. World change: guard captain attitude becomes friendly.
  - Stage 2 (调查 → 追查线索): Trigger: `location_entered` (dark cave `loc_dark_cave`). World change: new NPC/merchant dialogue unlocks.
  - Stage 3 (追查 → 揭露真相): Trigger: `dialogue_ended` (specific NPC) AND `item_found`. World change: faction reputation delta + map unlock.
- **D-04:** Each side quest uses a different trigger type to exercise all three event paths:
  - `quest_side_missing_ore`: `item_found` trigger (find ore → deliver to blacksmith)
  - `quest_side_overdue_debt`: `dialogue_ended` trigger (demonstrates REP system)
  - `quest_side_wolf_bounty`: `combat_ended` trigger (simplest — pure combat)
- **D-05:** Quest rewards are functional where possible: `quest_side_missing_ore` reward unlocks equipment repair dialogue; faction reputation changes on `quest_side_overdue_debt` completion.

### Quest Stage Trigger Wiring (QUEST-03)

- **D-06:** Three event types wired in quest-handler/quest-system: `dialogue_ended`, `location_entered`, `item_found`, `combat_ended`. Each checked against active quest stage `trigger` field in quests.yaml.
- **D-07:** Stage advance is automatic when trigger conditions match — player does not manually call `:quest advance`. The system checks on each relevant event.
- **D-08:** Multi-condition stage (Stage 3 of main quest: dialogue AND item) uses AND logic — both conditions must be true before advancing.

### /look Re-narration (SCENE-02)

- **D-09:** `:look` with no target calls the AI Narrative Director to re-generate current scene narration from current game state. Same path as scene load narration — not a cache replay. Aligns with core value: world feels alive and reactive.
- **D-10:** Re-narration uses existing `generateNarrationFn` already wired in Phase 11 (WIRE-06). No new AI infrastructure needed — just call it with current scene context.

### Memory Eviction (MEM-01, MEM-02)

- **D-11:** `applyRetention` sorts by `importance` ascending before eviction — lowest-importance memories evicted first. If importance is equal, recency is the tiebreaker (oldest evicted).
- **D-12:** In-memory enforcement: `addMemory` in npc-memory-store applies retention immediately when `recentMemories.length > 15`, not only on disk write.

### Remaining Fixes (unambiguous — Claude's discretion)

- SCENE-01: `scene-manager.ts` closure updated on state restore — subscribe to game-store and update `currentSceneId` ref.
- SCENE-03: `:cast` outside combat returns "你现在不在战斗中" — check `combatState.active` before routing to cast handler.
- CODEX-01: `codexDisplayEntries` reads from `playerKnowledgeStore` instead of hardcoding `knowledgeStatus: null`.
- CODEX-02: Safety filter regex tightened — legitimate Chinese patterns like "你获得了10枚金币" excluded from flagging.

### Claude's Discretion

- quests.yaml YAML schema structure — use the existing `QuestTemplate` schema from `src/codex/schemas/entry-types.ts`; Claude picks field names consistent with existing codex entries.
- Exact Chinese text for quest titles, descriptions, and stage names — Claude writes appropriate in-world Chinese content.
- Safety filter regex specifics — Claude determines the minimal pattern change that fixes false positives without weakening the filter.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Quest System
- `src/engine/quest-system.ts` — QuestSystem interface, acceptQuest/advanceStage/completeQuest
- `src/state/quest-store.ts` — QuestState shape, appendQuestEvent
- `src/codex/schemas/entry-types.ts` — QuestTemplate schema (use this for quests.yaml structure)
- `world-data/codex/npcs.yaml` — NPC IDs for quest trigger matching
- `world-data/codex/locations.yaml` — Location IDs for location_entered triggers

### Memory System
- `src/state/npc-memory-store.ts` — NpcMemoryRecord schema, recentMemories max(15), addMemory
- `src/persistence/memory-persistence.ts` — Disk write path (applyRetention called here currently)

### Scene System
- `src/engine/scene-manager.ts` — currentSceneId closure, state restore path
- `src/ai/roles/narrative-director.ts` — generateNarrationFn signature for /look re-narration

### Codex & Safety
- `src/codex/query.ts` — codexDisplayEntries builder
- `src/state/knowledge-store.ts` — playerKnowledgeStore for knowledgeStatus reads
- `src/ai/prompts/safety-system.ts` — safety filter regex (Phase 13 extracted this)

### Existing Phase Context
- `.planning/phases/11-app-wiring/11-CONTEXT.md` — WIRE-06: generateNarrationFn wiring
- `.planning/phases/13-dialogue-reputation/13-CONTEXT.md` — safety filter changes from Phase 13

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `generateNarrationFn`: Already wired in Phase 11 (WIRE-06) — /look re-narration calls this directly
- `QuestTemplate` schema in `entry-types.ts`: quests.yaml must conform to this schema
- `applyReputationDelta` / `applyFactionReputationDelta`: Available from Phase 13 for quest rewards

### Established Patterns
- Event bus (`mitt`): Quest stage triggers subscribe to `dialogue_ended`, `combat_ended`, `item_found`, `location_entered` events — same pattern as Phase 12 combat wiring
- Codex query pattern: `queryById(codexEntries, id)` — same pattern for quest lookup

### Integration Points
- `quest-system.ts` → subscribes to event bus events for stage advancement (QUEST-03)
- `scene-manager.ts` → calls `generateNarrationFn` on `/look` (SCENE-02)
- `npc-memory-store.ts` → `addMemory` enforces max(15) inline (MEM-02)

</code_context>

<specifics>
## Specific Ideas

- Main quest should feel like it connects existing world locations (guard captain at north gate, dark cave as mid-quest climax, final NPC reveal)
- Side quests deliberately exercise all three trigger event types so QUEST-03 code coverage is full
- Each completed quest stage should feel like "the world noticed" — reputation or NPC attitude change on completion
- `/look` re-narration must feel responsive — use streaming output (typewriter) same as scene entry

</specifics>

<deferred>
## Deferred Ideas

- Quest branching / player choices that split quest outcomes — Phase 15 or v1.3
- Quest map markers (show quest location on ASCII map) — v1.3
- Quest XP / leveling system — out of scope per PROJECT.md

</deferred>

---

*Phase: 14-quest-memory-scene-codex*
*Context gathered: 2026-04-28*
