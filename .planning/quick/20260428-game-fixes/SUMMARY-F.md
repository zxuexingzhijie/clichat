# Game Fixes Summary — Quest Rewards, Item Pickup, Save Restore

**Commit:** `944027f`
**Date:** 2026-04-29

## Fixes Applied

### M1 — completeQuest gold and relation_delta rewards

**File:** `src/engine/quest-system.ts`

- Added `player: Store<PlayerState>` to the `stores` parameter of `createQuestSystem`
- `completeQuest` now increments `player.gold` when `rewards.gold` is set
- `completeQuest` now applies `rewards.relation_delta` entries to `npcDispositions` via `applyReputationDelta` (adjusts the `value` field, clamped ±100)
- Updated call site in `src/app.tsx` to pass `player: ctx.stores.player`
- Updated `src/engine/quest-system.test.ts` to include `player: playerStore` in the `stores` fixture

### C5 — handleInspect emits item_acquired for item-type objects

**File:** `src/engine/scene-manager.ts`

- In `handleInspect`, when the inspected target's codex entry has `type === 'item'`:
  - Tags the player with `item:{objectId}` (idempotent via includes check)
  - Emits `item_acquired` with `{ itemId, itemName, quantity: 1 }` on the event bus
- Non-item objects (cave_entrance, markings, etc.) are unaffected
- Uses the singleton `playerStore` import since `createSceneManager` only receives `scene` and `eventBus` in its `stores` param

### M3 — state_restored emitted after loadGame

**File:** `src/persistence/save-file-manager.ts`

- Added `import { eventBus } from '../events/event-bus'`
- After `serializer.restore(json)`, emits `eventBus.emit('state_restored', undefined)`
- This triggers the existing `state_restored` handler in `scene-manager.ts` which syncs `currentSceneId` from the restored scene store

## Test Results

- 957 pass, 3 fail (all 3 pre-existing: `use-game-input` 'i'→null, `buildCharacter` equipment ID format)
- tsc: clean (pre-existing `combat-loop.ts` errors only, unrelated)

## Deviations

None — fixes applied exactly as specified.
