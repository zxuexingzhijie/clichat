---
phase: 12-combat-save-correctness
plan: P03
type: execute
wave: 2
depends_on:
  - 12-P01
files_modified:
  - src/codex/schemas/entry-types.ts
  - src/engine/action-handlers/move-handler.ts
  - src/engine/action-handlers/combat-handler.ts
autonomous: true
requirements:
  - COMBAT-03
must_haves:
  truths:
    - "Walking into a location that has an enemies[] list in its codex entry triggers startCombat"
    - "Walking into a danger area when combat is already in progress does NOT trigger startCombat again"
    - "Typing ':attack <enemyId>' when the NPC type is 'enemy' triggers startCombat([npcId])"
    - "Typing ':attack <npcId>' against a non-enemy NPC returns a '无法发起战斗' error"
    - "LocationSchema accepts an optional enemies field — existing locations without it still parse"
  artifacts:
    - path: src/codex/schemas/entry-types.ts
      provides: "LocationSchema with enemies: z.array(z.string()).optional()"
    - path: src/engine/action-handlers/move-handler.ts
      provides: "After successful move, reads new scene's codex entry enemies[] and calls startCombat if non-empty and not already in combat"
    - path: src/engine/action-handlers/combat-handler.ts
      provides: "Explicit :attack <targetId> path — codex lookup, type === 'enemy' check, startCombat([npcId])"
  key_links:
    - from: src/engine/action-handlers/move-handler.ts
      to: src/engine/combat-loop.ts
      via: "ctx.combatLoop.startCombat(enemies) after handleGo success"
      pattern: "startCombat.*enemies"
    - from: src/engine/action-handlers/combat-handler.ts
      to: src/engine/combat-loop.ts
      via: "ctx.combatLoop.startCombat([npcId]) for explicit :attack NPC"
      pattern: "startCombat.*npcId"
---

<objective>
Implement two combat initiation paths (COMBAT-03): (1) automatic — entering a location whose codex entry has an `enemies[]` array calls startCombat; (2) explicit — `:attack <npcId>` verifies the NPC is type 'enemy' then calls startCombat. Also add the `enemies?: string[]` field to LocationSchema that the auto-trigger path requires.

Purpose: Combat never starts — there is no trigger. Players cannot enter the dark cave or attack visible enemies because no code calls startCombat.
Output: LocationSchema with enemies optional field; move-handler with auto-trigger; combat-handler with explicit :attack NPC path.
</objective>

<execution_context>
@/Users/makoto/Downloads/work/cli/.planning/phases/12-combat-save-correctness/12-CONTEXT.md
</execution_context>

<context>
@/Users/makoto/Downloads/work/cli/.planning/ROADMAP.md
@/Users/makoto/Downloads/work/cli/.planning/phases/12-combat-save-correctness/12-PATTERNS.md

<interfaces>
<!-- Extracted from source files. -->

From src/codex/schemas/entry-types.ts (LocationSchema lines 35-45):
```typescript
export const LocationSchema = z.object({
  ...baseFields,
  type: z.literal("location"),
  region: z.string(),
  danger_level: z.number().min(0).max(10),
  exits: z.array(z.union([z.string(), SpatialExitSchema])),
  notable_npcs: z.array(z.string()),
  objects: z.array(z.string()),
  coordinates: z.object({ x: z.number(), y: z.number() }).optional(),
  map_icon: z.string().optional(),
  // ADD: enemies: z.array(z.string()).optional()
});
export type Location = z.infer<typeof LocationSchema>;
```

From src/engine/action-handlers/move-handler.ts (current, full file):
```typescript
import type { ActionHandler } from './types';

export const handleMove: ActionHandler = async (action, ctx) => {
  if (ctx.sceneManager) {
    const result = await ctx.sceneManager.handleGo(action.target ?? '');
    if (result.status === 'success') {
      return { status: 'action_executed', action, narration: result.narration };
    }
    return { status: 'error', message: result.message };
  }
  return { status: 'error', message: '场景系统未初始化' };
};
```

From ActionContext (types.ts) — what ctx exposes for this handler:
- ctx.sceneManager.handleGo(direction) → SceneManagerResult
- ctx.sceneManager.getCurrentScene() → string | null  (returns new sceneId after successful move)
- ctx.combatLoop.startCombat(enemyIds: string[]) → Promise<void>
- ctx.combatLoop.getCombatPhase() → string  (returns null-equivalent value if not in combat — actually returns '' or phase string)

From src/engine/combat-loop.ts:
- getCombatPhase() returns stores.combat.getState().phase
- CombatState.phase includes: null | 'player_turn' | 'enemy_turn' | 'resolving' | 'narrating' | 'check_end' | 'ended'
- When not in combat: combat.active === false, phase will be whatever it was last set to

From src/engine/action-handlers/combat-handler.ts (current — has the :attack routing but no NPC type check):
```typescript
// Current COMBAT_ACTIONS set: ['attack', 'cast', 'guard', 'flee']
// action.type === 'attack' routes here
// action.target is the NPC id for ':attack goblin' command
```

From src/engine/combat-loop.ts startCombat (lines 83-114):
```typescript
async function startCombat(enemyIds: string[]): Promise<void> {
  // looks up codex for each id, creates enemy objects
  // sets combat.active = true, phase = 'player_turn'
  // sets game.phase = 'combat'
}
```

CombatState initial shape (combat-store.ts):
```typescript
active: false  // when not in combat
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add enemies optional field to LocationSchema</name>
  <files>src/codex/schemas/entry-types.ts</files>
  <read_first>
    - src/codex/schemas/entry-types.ts — read fully (185 lines)
  </read_first>
  <behavior>
    - Test 1: LocationSchema.parse({ ...validLocation, enemies: ['enemy_wolf'] }) succeeds
    - Test 2: LocationSchema.parse({ ...validLocation }) (no enemies field) succeeds — field is optional
    - Test 3: Parsed Location type has enemies?: string[] — TypeScript infers it correctly
  </behavior>
  <action>
In `src/codex/schemas/entry-types.ts`, add one field to `LocationSchema` after `map_icon`:

```typescript
export const LocationSchema = z.object({
  ...baseFields,
  type: z.literal("location"),
  region: z.string(),
  danger_level: z.number().min(0).max(10),
  exits: z.array(z.union([z.string(), SpatialExitSchema])),
  notable_npcs: z.array(z.string()),
  objects: z.array(z.string()),
  coordinates: z.object({ x: z.number(), y: z.number() }).optional(),
  map_icon: z.string().optional(),
  enemies: z.array(z.string()).optional(),
});
```

No other changes to entry-types.ts.
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/codex/schemas/ --bail 2>&1 | tail -20</automated>
  </verify>
  <done>
    - LocationSchema has `enemies: z.array(z.string()).optional()`
    - Location type has `enemies?: string[]`
    - Existing location YAML files without an enemies field still parse (optional field)
    - bun tsc --noEmit passes
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Auto combat trigger in move-handler on entering dangerous location</name>
  <files>src/engine/action-handlers/move-handler.ts</files>
  <read_first>
    - src/engine/action-handlers/move-handler.ts — read fully (12 lines)
    - src/engine/combat-loop.ts — read lines 27-33 (CombatLoop interface) and lines 83-114 (startCombat)
    - src/state/combat-store.ts — read to confirm initial state shape (active field)
  </read_first>
  <behavior>
    - Test 1: handleMove — sceneManager.handleGo returns success, new scene codex entry has enemies: ['enemy_wolf'] AND combatLoop.getCombatPhase() returns non-active phase → startCombat(['enemy_wolf']) is called
    - Test 2: handleMove — sceneManager.handleGo returns success, new scene has enemies: ['enemy_wolf'] AND getCombatPhase() returns 'player_turn' (combat active) → startCombat NOT called
    - Test 3: handleMove — sceneManager.handleGo returns success, new scene has no enemies field → startCombat NOT called
    - Test 4: handleMove — sceneManager.handleGo returns success, enemies: [] (empty) → startCombat NOT called
    - Test 5: handleMove — sceneManager.handleGo returns error → no startCombat, returns error
  </behavior>
  <action>
Rewrite `src/engine/action-handlers/move-handler.ts` to add the auto combat trigger after a successful move.

The new scene's enemies are read from the codex via ActionContext. ActionContext does not directly expose codexEntries, but `ctx.sceneManager.getCurrentScene()` returns the current sceneId after the move. To look up the codex entry, we need codexEntries access.

**Implementation approach:** Add an optional `codexEntries?: Map<string, CodexEntry>` field to `ActionContext` (in types.ts). Wire it in app.tsx from the codex that is already loaded. Then move-handler reads `ctx.codexEntries?.get(newSceneId)` to get the location entry and its enemies.

**Steps:**
1. In `src/engine/action-handlers/types.ts`: add to ActionContext:
   ```typescript
   readonly codexEntries?: Map<string, CodexEntry>;
   ```
   Import `CodexEntry` from `'../../codex/schemas/entry-types'`.

2. In `src/game-loop.ts`: add to GameLoopOptions:
   ```typescript
   readonly codexEntries?: Map<string, CodexEntry>;
   ```
   Add to actionContext construction:
   ```typescript
   codexEntries: options?.codexEntries,
   ```

3. In `src/app.tsx`: pass `codexEntries` to createGameLoop (it already has codexEntries as a variable — check how it's built and wire it in).

4. Rewrite `src/engine/action-handlers/move-handler.ts`:
   ```typescript
   import type { ActionHandler } from './types';
   import type { Location } from '../../codex/schemas/entry-types';

   export const handleMove: ActionHandler = async (action, ctx) => {
     if (!ctx.sceneManager) {
       return { status: 'error', message: '场景系统未初始化' };
     }
     const result = await ctx.sceneManager.handleGo(action.target ?? '');
     if (result.status !== 'success') {
       return { status: 'error', message: result.message };
     }

     if (ctx.combatLoop && ctx.codexEntries) {
       const newSceneId = ctx.sceneManager.getCurrentScene();
       if (newSceneId) {
         const entry = ctx.codexEntries.get(newSceneId);
         const location = entry?.type === 'location' ? (entry as Location) : null;
         const enemies = location?.enemies ?? [];
         const alreadyInCombat = ctx.combatLoop.getCombatPhase() === 'player_turn'
           || ctx.combatLoop.getCombatPhase() === 'enemy_turn'
           || ctx.combatLoop.getCombatPhase() === 'resolving'
           || ctx.combatLoop.getCombatPhase() === 'narrating'
           || ctx.combatLoop.getCombatPhase() === 'check_end';
         if (enemies.length > 0 && !alreadyInCombat) {
           await ctx.combatLoop.startCombat(enemies);
         }
       }
     }

     return { status: 'action_executed', action, narration: result.narration };
   };
   ```

Note on "already in combat" detection: `combat.active` is the correct field, but getCombatPhase() returns a string, not a boolean. Check `ctx.stores.combat.getState().active` instead — this is simpler and reliable. Use:
   ```typescript
   const alreadyInCombat = ctx.stores.combat.getState().active;
   if (enemies.length > 0 && !alreadyInCombat) { ... }
   ```
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/engine/action-handlers/move-handler.test.ts --bail 2>&1 | tail -20</automated>
  </verify>
  <done>
    - move-handler reads new scene's codex entry after successful move
    - startCombat called when enemies.length > 0 and !combat.active
    - startCombat NOT called when combat.active === true (D-04)
    - startCombat NOT called when enemies is empty or absent
    - ActionContext.codexEntries type added to types.ts and game-loop.ts
    - app.tsx wires codexEntries to createGameLoop
    - bun tsc --noEmit passes
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Explicit :attack NPC path in combat-handler (COMBAT-03)</name>
  <files>src/engine/action-handlers/combat-handler.ts</files>
  <read_first>
    - src/engine/action-handlers/combat-handler.ts — read fully (after P02 edits it has no processEnemyTurn call)
    - src/engine/combat-loop.ts — lines 83-114 (startCombat)
    - src/codex/schemas/entry-types.ts — lines 94-109 (EnemySchema, Enemy type)
  </read_first>
  <behavior>
    - Test 1: action.type === 'attack', action.target === 'enemy_wolf' (codex type === 'enemy') AND combat not active → startCombat(['enemy_wolf']) called; returns action_executed
    - Test 2: action.type === 'attack', action.target === 'npc_bartender' (codex type === 'npc') → returns error '该目标无法发起战斗。'
    - Test 3: action.type === 'attack', action.target === 'enemy_wolf' AND combat already active → processPlayerAction called normally (ongoing combat)
    - Test 4: action.type === 'attack', no action.target → follows existing combat-in-progress flow (attacks first alive enemy)
  </behavior>
  <action>
Modify `src/engine/action-handlers/combat-handler.ts` to handle the `:attack <npcId>` initiation path.

The split logic:
- If combat is NOT active (`!ctx.stores.combat.getState().active`) AND action.type === 'attack' AND action.target is present → check codex type, call startCombat
- If combat IS active → existing processPlayerAction flow (as after P02 edits)

Updated file:
```typescript
import type { ActionHandler } from './types';
import type { Enemy } from '../../codex/schemas/entry-types';

export const handleCombat: ActionHandler = async (action, ctx) => {
  if (!ctx.combatLoop) {
    return { status: 'error', message: '战斗系统未初始化' };
  }

  const inCombat = ctx.stores.combat.getState().active;

  if (!inCombat && action.type === 'attack' && action.target) {
    if (!ctx.codexEntries) {
      return { status: 'error', message: '世界数据未加载' };
    }
    const entry = ctx.codexEntries.get(action.target);
    if (!entry || entry.type !== 'enemy') {
      return { status: 'error', message: '该目标无法发起战斗。' };
    }
    await ctx.combatLoop.startCombat([action.target]);
    const narration = ctx.stores.combat.getState().lastNarration
      ? [ctx.stores.combat.getState().lastNarration]
      : [];
    return { status: 'action_executed', action, narration };
  }

  const COMBAT_ACTIONS = new Set(['attack', 'cast', 'guard', 'flee']);
  if (!COMBAT_ACTIONS.has(action.type)) {
    return { status: 'error', message: '战斗中只能进行战斗行动！' };
  }

  const combatResult = await ctx.combatLoop.processPlayerAction(
    action.type as 'attack' | 'cast' | 'guard' | 'flee',
  );
  if (combatResult.status === 'error') {
    return { status: 'error', message: combatResult.message };
  }
  await ctx.combatLoop.checkCombatEnd();
  const narration = ctx.stores.combat.getState().lastNarration
    ? [ctx.stores.combat.getState().lastNarration]
    : [];
  return {
    status: 'action_executed',
    action,
    checkResult: ctx.stores.combat.getState().lastCheckResult ?? undefined,
    narration,
  };
};
```

Note: `ctx.codexEntries` was added to ActionContext in Task 2 of this plan. This task depends on Task 2 being completed first.
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/engine/action-handlers/combat-handler.test.ts --bail 2>&1 | tail -20</automated>
  </verify>
  <done>
    - combat-handler handles !inCombat + attack + target → codex type check → startCombat
    - non-enemy target returns '该目标无法发起战斗。'
    - in-combat flow unchanged
    - bun tsc --noEmit passes
    - All tests pass
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| player input → codex lookup | action.target from player input is used as codex key — no path traversal risk (Map lookup) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-12P03-01 | Spoofing | combat-handler.ts :attack path | mitigate | Codex type check (entry.type === 'enemy') prevents attacking non-enemy entities |
| T-12P03-02 | Denial of Service | move-handler.ts auto-trigger | accept | alreadyInCombat guard (combat.active) prevents re-triggering startCombat |
</threat_model>

<verification>
```
cd /Users/makoto/Downloads/work/cli
grep -n "codexEntries" src/engine/action-handlers/types.ts
# expected: line with readonly codexEntries?: Map<string, CodexEntry>

grep -n "startCombat" src/engine/action-handlers/move-handler.ts
# expected: line with ctx.combatLoop.startCombat(enemies)

grep -n "startCombat" src/engine/action-handlers/combat-handler.ts
# expected: line with ctx.combatLoop.startCombat([action.target])

bun test --bail 2>&1 | tail -10
bun tsc --noEmit 2>&1 | head -10
```
</verification>

<success_criteria>
- LocationSchema has enemies?: string[] (optional)
- ActionContext has codexEntries?: Map<string, CodexEntry>
- move-handler: after successful move, reads location.enemies, calls startCombat if non-empty and !combat.active
- combat-handler: :attack <enemyId> (not in combat) → startCombat; :attack <npcId> (type !== 'enemy') → error
- All tests pass; no type errors
</success_criteria>

<output>
After completion, create `/Users/makoto/Downloads/work/cli/.planning/phases/12-combat-save-correctness/12-P03-SUMMARY.md`
</output>
