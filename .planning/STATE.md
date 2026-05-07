---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: milestone
status: completed
stopped_at: context exhaustion at 75% (2026-05-07)
last_updated: "2026-05-07T11:01:48.178Z"
last_activity: 2026-04-30 — Phase 21 all 3 plans complete
progress:
  total_phases: 11
  completed_phases: 11
  total_plans: 59
  completed_plans: 59
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-30)

**Core value:** The player must feel they are in a persistent, consistent world that remembers them -- not a chatbot that reinvents the universe every turn.
**Current focus:** v1.4 complete — archived to milestones/v1.4-ROADMAP.md; ready for /gsd-new-milestone

## Current Position

Phase: 21 (Distribution & Live Validation) — complete
Plan: P03 complete (all 3 plans done)
Status: Phase 21 complete — package.json v1.4.0, npm dry-run clean, Homebrew review PASS, UAT checklist created
Last activity: 2026-04-30 — Phase 21 all 3 plans complete

Progress: [█████████░] 90%

## Performance Metrics

**Velocity:**

- Total plans completed: 15 (v1.2) + 1 (v1.4 P01)
- Average duration: ~15 min/plan
- Total execution time: ~3.7 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 11 (App Wiring) | 3 | ~45 min | ~15 min |
| 12 (Combat & Save) | 4 | ~75 min | ~19 min |
| 13 P02 (Dialogue & Reputation) | 1 | ~12 min | ~12 min |
| 13 P01 (Dialogue & Reputation) | 1 | ~25 min | ~25 min |
| 13 P03 (Dialogue & Reputation) | 1 | ~20 min | ~20 min |
| 13 P04 (Dialogue & Reputation) | 1 | ~4 min | ~4 min |
| 14 Wave 1 (Quest Schema, Memory Fix, handleCast) | 3 | ~24 min | ~8 min |
| 14 Wave 2 (Quest Events + Commands) | 1 | ~8 min | ~8 min |
| 17 P01 (NPC Architecture Fix) | 1 | ~3 min | ~3 min |
| 17 P02 (NPC Architecture Fix) | 1 | ~3 min | ~3 min |
| 21 P01 (Distribution) | 1 | ~1 min | ~1 min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

- REP-04: RelationStore uses isRestoring flag to bypass reputation_changed during game load; GameStores.relation typed as RelationStore
- DIAL-01/REP-01: sentimentToDelta returns integers (10/0/-10/-20); startDialogue sets relationshipValue=0; endDialogue calls applyFactionReputationDelta when npc.faction set; NpcSchema has faction field
- DIAL-03/05: clergy added as separate key from religious; NPC_ROLE_QUESTIONS has 12 roles total
- DIAL-04: TextInput mode toggled via onChange (no onFocus in @inkjs/ui); useInput isActive combined with !isFreeTextMode; Escape exits text mode before exiting dialogue
- DIAL-03/06/07: ExtractedNpcMetadata.sentiment is optional (undefined = no detection); isAllDefaults uses !extracted.sentiment; streaming completion in useEffect with completionFiredRef; hasFiredRef guards handleNpcDialogueComplete
- QUEST-01: faction_guard used (faction_town_guard not in factions.yaml); item_iron_ore used as targetId string (not yet in items.yaml)
- QUEST-02: createQuestSystem accepts optional bus (EventBus); pendingConditions Map tracks multi-condition stages; questStore added to ActionContext (GameLoopStores had no quest field)
- MEM-01: applyRetention evicts lowest-importance first (low<medium<high), oldest by turnNumber on tie; addMemory in npc-memory-store inlines sort logic to avoid circular import
- SCENE-01/02: scene-manager subscribes state_restored to sync currentSceneId; handleLook(undefined) calls generateNarrationFn when available
- SCENE-03/CODEX-02: handleCast returns '你现在不在战斗中，无法使用法术。' outside combat; STATE_OVERRIDE_PATTERN requires explicit [+-] operator (level\s*up split to separate branch)
- CODEX-01: playerKnowledgeState already reactive in app.tsx (useState+useEffect+useMemo) — no code change needed
- 15-02: listSavesFn injected via GameLoopOptions (not mock.module) to prevent test isolation pollution; revealedNpcs uses Zod .default([]) for backward-compatible saves; dialogue_ended listener in scene-manager owns npcsPresent merge
- 17-P01: storyAct used as raw identifier (act1/act2/act3) in NPC system prompt — no translation to 第一幕 etc
- 17-P02: adjudicateTalkResult wraps sentimentToDelta in rules-engine.ts; NpcSentiment inferred from NpcDialogue['sentiment'] to avoid enum duplication
- 19-P01: NarrationOutputSchema enforces min(10)/max(300) via Zod; callGenerateObject replaces callGenerateText in generateNarration; schema rejection triggers catch fallback; streamNarration unchanged
- 19-P02: classifyIntent uses callGenerateObject with role 'retrieval-planner'; model? removed from ClassifyIntentOptions; intent classification tokens now visible in :cost
- 19-P03: runSummarizerLoop checks signal.aborted at 3 points (loop start, post-sleep, post-dispatchTask); SIGINT handler stored as named const for process.off deregistration; useEffect cleanup calls controller.abort() then process.off
- 20-P01: EnemySchema loot→loot_table; SceneStateSchema droppedItems:string[] default []; combat-loop.ts updated to loot_table access
- 20-P03: SaveDataV6Schema extends V5; readSaveData() upgraded to V6; branch-diff SaveDataCompare extends to V4|V5|V6; UI type refs cascade-updated
- 21-P01: version bumped to 1.4.0; author=Makoto; repository.url=git+https:// canonical format; npm publish --dry-run passes cleanly

### Pending Todos

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 20260428-A | YAML content fixes (exits field, NPC placement, enemies, items, map icons) | 2026-04-28 | 4fc5708 | [20260428-game-fixes](./quick/20260428-game-fixes/) |
| 20260428-B | Quest auto-accept + completeQuest faction reputation rewards | 2026-04-28 | e899162 | [20260428-game-fixes](./quick/20260428-game-fixes/) |
| 20260428-C | use_item consumable handler + onboarding hint | 2026-04-28 | bac1e9e | [20260428-game-fixes](./quick/20260428-game-fixes/) |
| 20260428-D | ComparePanel props fix + quest/save wiring | 2026-04-28 | (see SUMMARY-D) | [20260428-game-fixes](./quick/20260428-game-fixes/) |
| 20260428-E | Additional game fixes wave E | 2026-04-28 | (see SUMMARY-E) | [20260428-game-fixes](./quick/20260428-game-fixes/) |
| 20260428-F | completeQuest gold/relation_delta rewards + item pickup + state_restored emit | 2026-04-28 | 944027f | [20260428-game-fixes](./quick/20260428-game-fixes/) |
| 20260429-001 | 修复记忆系统3个gap: archiveSummary接线 + codex filter + slice(0,8) + push→spread | 2026-04-29 | 79123eb | [20260429-001-memory-wiring-fix](./quick/20260429-001-memory-wiring-fix/) |

### Debug Sessions Resolved

| Session | Root Cause | Resolution | Date |
|---------|-----------|------------|------|
| memory-system-design-gap | dialogue-manager bypassed archiveSummary + codex filter; slice(0,3) hard cap | Fixed by quick task 20260429-001 | 2026-04-29 |

### Blockers/Concerns

None — all known blockers resolved.

### Previous Milestone Context (v1.1)

- Phase 10 (final), all plans complete
- v1.1 shipped: 2026-04-26, 807 tests, 0 failures
- Deferred from v1.1: live API UAT, OWNER placeholder replacement

## Deferred Items

Items acknowledged and deferred at v1.4 milestone close on 2026-04-30:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| UAT | Live API session validation (/cost, /replay, summarizer) | human_needed — requires live API key | v1.4 close |
| Verification | Phase 05: VERIFICATION.md [human_needed] — live game session UAT | acknowledged | v1.3 close |
| Verification | Phase 12: VERIFICATION.md [human_needed] — combat system live UAT | acknowledged | v1.3 close |
| Verification | Phase 21: VERIFICATION.md [human_needed] — live API UAT non-blocking | acknowledged | v1.4 close |
| UAT | Phase 05: HUMAN-UAT.md [deferred] — game flow manual testing | acknowledged | v1.3 close |
| UAT | Phase 21: 21-UAT-CHECKLIST.md [pending] — live API UAT (intentionally non-blocking) | acknowledged | v1.4 close |
| QuickTask | game-fixes (20260428) — SUMMARY missing but commits present (4fc5708, e899162, bac1e9e, 944027f) | acknowledged | v1.4 close |
| QuickTask | 001-memory-wiring-fix (20260429) — SUMMARY missing but commit 79123eb present | acknowledged | v1.4 close |

## Session Continuity

Last session: 2026-05-07T11:01:48.169Z
Stopped at: context exhaustion at 75% (2026-05-07)
Resume file: None
