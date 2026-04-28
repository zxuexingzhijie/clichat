# 12-P03 Execution Summary

**Status:** Complete
**Requirements:** COMBAT-03
**Files modified:**
- `src/codex/schemas/entry-types.ts` — added `enemies: z.array(z.string()).optional()` to LocationSchema
- `src/codex/schemas/entry-types.test.ts` — new: LocationSchema enemies field tests
- `src/engine/action-handlers/types.ts` — added `codexEntries?: Map<string, CodexEntry>` to ActionContext; added CodexEntry import
- `src/engine/action-handlers/move-handler.ts` — rewritten with auto combat trigger after successful move
- `src/engine/action-handlers/move-handler.test.ts` — new: 6 tests covering all auto-trigger scenarios
- `src/engine/action-handlers/combat-handler.ts` — added explicit :attack NPC initiation path
- `src/engine/action-handlers/combat-handler.test.ts` — expanded: 8 tests covering both in-combat and initiation paths
- `src/game-loop.ts` — added `codexEntries?: Map<string, CodexEntry>` to GameLoopOptions; wired into actionContext
- `src/app.tsx` — passed `allCodexEntries` as `codexEntries` to `createGameLoop`

**Tests:** 872 pass, 0 fail (1 pre-existing failure in use-game-input.test.ts unrelated to this plan)

**Key changes:**
- LocationSchema now accepts `enemies?: string[]` — existing YAML locations without the field still parse
- `ActionContext` and `GameLoopOptions` now carry `codexEntries?: Map<string, CodexEntry>`
- `app.tsx` wires the loaded codex map into the game loop so handlers can perform lookups
- `move-handler`: after a successful move, reads the new scene's codex entry; if it has a non-empty `enemies[]` and combat is not already active, calls `ctx.combatLoop.startCombat(enemies)`
- `combat-handler`: when not in combat and `action.type === 'attack'` with a target present, performs a codex type check; calls `startCombat([target])` if `entry.type === 'enemy'`, returns `'该目标无法发起战斗。'` otherwise; existing in-combat flow is unchanged

**Commits:**
- `8d590bf` feat(combat): add enemies optional field to LocationSchema (COMBAT-03)
- `de3b916` feat(combat): auto combat trigger in move-handler, add codexEntries to ActionContext (COMBAT-03)
- `9820a7f` feat(combat): explicit :attack NPC initiation path in combat-handler (COMBAT-03)
