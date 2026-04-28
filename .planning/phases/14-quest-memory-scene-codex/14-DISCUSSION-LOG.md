# Phase 14: Quest, Memory, Scene & Codex - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 14-quest-memory-scene-codex
**Areas discussed:** quests.yaml content, Quest stage triggers, /look re-narration

---

## quests.yaml content

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal — 3 main stages, 2 side stages each | Enough to prove the system works | |
| Full — 5 main stages, 3 side stages with objectives | Maximum detail | |
| Asymmetric — full main, stub side quests | Main quest gets full treatment; side quests get minimal stubs | ✓ |

**User's choice:** Asymmetric — full main quest (3 stages), minimal stubs for 3 side quests (2 stages each)

---

## Quest stage triggers

| Option | Description | Selected |
|--------|-------------|----------|
| Location + NPC anchored | Stages based on existing world locations and NPCs | |
| Item + combat driven | Stages based on item discovery and combat | |
| Mixed triggers per stage | Different trigger type per stage to exercise all event paths | ✓ |

**User's choice (via discussion):** Mixed — 3 main quest stages each use a different trigger type (dialogue_ended / location_entered / item_found+dialogue_ended). Side quests each use a different event type (item_found / dialogue_ended / combat_ended).

**Notes:** User wanted my recommendation. I proposed mixed triggers so QUEST-03 code validates all event paths. User approved.

---

## /look re-narration

| Option | Description | Selected |
|--------|-------------|----------|
| AI 重新生成 | Calls AI Narrative Director every time — fresh text, token cost | ✓ |
| 复用上次叙事文字 | Replay cached narration — instant but static | |
| 先缓存后更新 | Show cache immediately, trigger AI in background | |

**User's choice:** AI 重新生成 — call AI Narrative Director to re-generate current scene narration every time `:look` is used with no target.

---

## Claude's Discretion

- quests.yaml YAML schema structure (follow existing QuestTemplate)
- Chinese quest titles, descriptions, stage names
- Safety filter regex specifics (CODEX-02)

## Deferred Ideas

- Quest branching / player choices that split quest outcomes
- Quest map markers on ASCII map
- Quest XP / leveling system (out of scope per PROJECT.md)
