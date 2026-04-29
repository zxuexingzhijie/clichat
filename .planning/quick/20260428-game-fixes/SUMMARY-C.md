# SUMMARY-C: use_item handler + onboarding hint

**Commit:** bac1e9e
**Date:** 2026-04-28

## Fix 1: use_item consumable handler

**Status:** DONE

**Files created/modified:**
- `src/engine/action-handlers/use-item-handler.ts` — new handler
- `src/engine/action-handlers/index.ts` — registered `handleUseItem` in HANDLER_MAP
- `src/codex/schemas/entry-types.ts` — added `heal_amount?: number` to `ItemSchema`
- `world-data/codex/items.yaml` — added `heal_amount: 10` to `item_healing_potion`, `heal_amount: 5` to `item_herb_bundle`

**Implementation notes:**
- Inventory is tracked via player `tags` array with `item:<itemId>` prefix
- Handler looks up `item:<itemId>` tag, validates item type is `consumable`, applies `heal_amount` heal capped at `maxHp`, removes tag from inventory, emits narration line
- `item_acquired` event emitted with `quantity: -1` (item consumed)
- `gameStore.turnCount` incremented per normal action convention

**Deviation:** `item_acquired` event semantics repurposed for removal notification (quantity: -1). The event was originally for gaining items — a dedicated `item_consumed` event would be cleaner but was not added to avoid schema churn.

## Fix 2: New player onboarding hint

**Status:** DONE

**Files modified:**
- `src/engine/scene-manager.ts` — appends hint line when `turnCount === 0` and no previous scene

**Implementation:** In `loadScene`, after building `narrationLines`, if `gameStore.getState().turnCount === 0 && !previousSceneId`, a Chinese hint line is appended: "与 NPC 交谈，或输入 /help 查看所有命令。"

## Test results

- tsc: clean (0 errors)
- Tests: 959 pass, 1 fail
- Remaining failure: `getPanelActionForKey > returns inventory for i when not typing` — pre-existing failure unrelated to this work (present since phase 13)
