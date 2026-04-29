# Game Fixes Summary — Combat & Inventory

**Commit:** f9f64d3
**Date:** 2026-04-29
**Tests:** 959 pass, 1 pre-existing fail (use-game-input 'i' → null)

## Fixes Applied

### C1 — Character creation writes starting items to tags

**Files:** `world-data/codex/professions.yaml`, `src/engine/character-creation.ts`, `src/state/player-store.ts`

- `professions.yaml`: all three professions had bare item IDs without the `item_` prefix. Fixed: `iron_sword` → `item_iron_sword`, `leather_armor` → `item_leather_armor`, `healing_potion` → `item_healing_potion`, `wooden_staff` → `item_wooden_staff`, `cloth_robe` → `item_cloth_robe`, `mana_potion` → `item_mana_potion`.
- `character-creation.ts` `buildCharacter`: now checks each starting equipment entry — if the codex entry has `item_type === 'consumable'`, it pushes `item:<id>` into `tags` instead of filling an equipment slot. Weapons and armor still go into equipment slots as before.
- `player-store.ts` `getDefaultPlayerState`: added `'item:item_healing_potion'` to default `tags` so players without full character creation (e.g. tests, quick-start) always have a usable potion.

### C6 — use_item in combat calls handleUseItem

**File:** `src/engine/combat-loop.ts`

- Added `sceneStore` and `eventBus` to `CombatLoopOptions` (both optional, so existing tests are unaffected).
- Extracted them into closure-level constants `sceneStore` / `combatEventBus` to avoid shadowing by the inner `options: CombatActionOptions` parameter.
- `use_item` branch now: builds a proper `GameAction` with `modifiers: {}` and `source: 'command'`, constructs a minimal `ActionContext`, calls `handleUseItem`, and returns the last narration line. Falls back to the old error message when `sceneStore`/`eventBus` are not provided.
- `src/app.tsx`: passes `sceneStore: ctx.stores.scene` and `eventBus: ctx.eventBus` to `createCombatLoop`.

### M2 — Victory loot distributed to player

**File:** `src/engine/combat-loop.ts`

- `checkCombatEnd` victory path: after confirming all enemies dead, iterates `state.enemies`, looks up each enemy's codex entry, and for each `itemId` in `enemy.loot` (a `string[]`) pushes `item:<itemId>` into `player.tags` using immutable spread.
- Loot distribution happens before the combat state is set to `ended`, ensuring the player state is updated before any downstream subscribers react to the victory.

### M4 — Enemy turn breaks on player death

**File:** `src/engine/combat-loop.ts`

- After each enemy's attack resolves (damage applied, narration generated), checks `stores.player.getState().hp <= 0`. If the player is dead, breaks out of the enemy loop immediately — remaining enemies do not continue attacking a dead player.

### m1 — Remove incorrect item_acquired emit on consume

**File:** `src/engine/action-handlers/use-item-handler.ts`

- Removed the `ctx.eventBus.emit('item_acquired', { itemId, itemName, quantity: -1 })` line. Consuming an item is not acquiring one; emitting `item_acquired` with `quantity: -1` was incorrectly triggering quest `item_found` conditions on item use.

## Test Changes

- `src/engine/character-creation.test.ts`: updated `equipment.weapon` expectations from bare IDs (`iron_sword`, `wooden_staff`) to prefixed IDs (`item_iron_sword`, `item_wooden_staff`), and added assertion that `item:item_healing_potion` appears in `tags` for the adventurer build.
