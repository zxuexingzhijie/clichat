# Quest System Fixes — Auto-Accept + Reputation Rewards

**Commit:** e899162
**Date:** 2026-04-28

## Fix 1: Auto-accept quests on dialogue trigger

**Status:** DONE

### What changed
- `src/codex/schemas/entry-types.ts` — added `auto_accept: z.boolean().optional()` to `QuestTemplateSchema`
- `world-data/codex/quests.yaml` — added `auto_accept: true` to all 4 quests
- `src/engine/quest-system.ts` — `dialogue_ended` bus listener now iterates codex entries first, auto-calls `acceptQuest` for any quest where:
  - `auto_accept: true`
  - no progress entry exists yet (not previously accepted/failed/completed)
  - first stage trigger is `dialogue_ended` with matching `targetId` (or no targetId)

### Behaviour
Players talking to any NPC will now automatically receive quests whose first stage is `dialogue_ended` with no targetId (e.g. `quest_main_01`). Quests with `targetId` on the first stage trigger (e.g. `quest_side_overdue_debt` targeting `npc_merchant_afu`) only auto-accept when the player talks to that specific NPC.

## Fix 2: completeQuest applies faction reputation rewards

**Status:** DONE

### What changed
- `src/engine/quest-system.ts` — imported `applyFactionReputationDelta` from `reputation-system`
- `completeQuest()` now reads `template.rewards.reputation_delta` and calls `applyFactionReputationDelta(stores.relation, factionId, delta)` for each entry

### Behaviour
Completing `quest_main_01` now grants +20 to `faction_guard`. Completing `quest_side_overdue_debt` grants +15 to `faction_merchants`. The `relation_delta` (NPC-level) field in rewards is not yet wired (separate concern, not in scope).

## Tests

- 3 new tests added to `src/engine/quest-system.test.ts`:
  - `completeQuest applies reputation_delta to factionReputations` — passes
  - `auto_accept quest is accepted automatically on dialogue_ended` — passes
  - `auto_accept quest is NOT re-accepted if already active` — passes (verifies `acceptedAt` unchanged on second `dialogue_ended`)

**Results:** 936 pass, 8 fail (all 8 pre-existing — `items.yaml` codex validation x7 + `use-game-input.test.ts` x1)

## Deviations

**[Rule 1 - Bug] Fixed incorrect `not_started` status check**
- Found during implementation: `QuestProgress.status` enum is `unknown | active | completed | failed` — no `not_started` value
- Fix: changed guard from `progress.status !== 'not_started'` to `if (progress) continue` (skip if any entry exists)
