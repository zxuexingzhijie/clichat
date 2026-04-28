# Phase 12: Combat & Save Correctness - Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 7 modified files
**Analogs found:** 7 / 7

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/engine/action-handlers/combat-handler.ts` | handler | request-response | `src/engine/action-handlers/save-handler.ts` | role-match |
| `src/engine/game-screen-controller.ts` | controller | event-driven | self (targeted fix) | exact |
| `src/engine/action-handlers/move-handler.ts` | handler | request-response | `src/engine/action-handlers/combat-handler.ts` | role-match |
| `src/engine/combat-loop.ts` | service | event-driven | self (targeted fix) | exact |
| `src/state/serializer.ts` | service | CRUD | self (targeted fix) | exact |
| `src/engine/action-handlers/branch-handler.ts` | handler | request-response | `src/engine/action-handlers/load-handler.ts` | role-match |
| `src/engine/action-handlers/load-handler.ts` | handler | request-response | `src/engine/action-handlers/save-handler.ts` | role-match |

---

## Pattern Assignments

### `src/engine/action-handlers/combat-handler.ts` (COMBAT-01/02/03)

**Bug:** Line 19 unconditionally calls `processEnemyTurn()` — this fires a second enemy turn after `game-screen-controller` already calls it, and it fires even after a flee success.

**Fix pattern — delete line 19** (`await ctx.combatLoop.processEnemyTurn()`):
```typescript
// BEFORE (lines 13-20):
const combatResult = await ctx.combatLoop.processPlayerAction(
  action.type as 'attack' | 'cast' | 'guard' | 'flee',
);
if (combatResult.status === 'error') {
  return { status: 'error', message: combatResult.message };
}
await ctx.combatLoop.processEnemyTurn();  // DELETE THIS LINE
await ctx.combatLoop.checkCombatEnd();

// AFTER:
const combatResult = await ctx.combatLoop.processPlayerAction(
  action.type as 'attack' | 'cast' | 'guard' | 'flee',
);
if (combatResult.status === 'error') {
  return { status: 'error', message: combatResult.message };
}
await ctx.combatLoop.checkCombatEnd();
```

**COMBAT-03 explicit `:attack NPC` pattern — codex lookup before startCombat:**
```typescript
// Pattern from combat-loop.ts lines 83-91 (startCombat codex lookup):
const entry = codexEntries.get(id);
if (!entry || entry.type !== 'enemy') {
  return { status: 'error', message: '该目标无法发起战斗。' };
}
// Then: await ctx.combatLoop.startCombat([npcId]);
```

**ActionHandler return shape** (from `src/engine/action-handlers/types.ts` line 38-41):
```typescript
export type ActionHandler = (
  action: GameAction,
  ctx: ActionContext,
) => Promise<ProcessResult>;
// ProcessResult status values: 'error' | 'action_executed' | 'clarification' | 'help'
// error shape:   { status: 'error', message: string }
// success shape: { status: 'action_executed', action, narration: string[] }
```

---

### `src/engine/game-screen-controller.ts` (COMBAT-01/02)

**Existing correct guard pattern** (lines 214-215) — keep this, add `outcome` check:
```typescript
// CURRENT (lines 203-221):
const handleCombatExecute = async (index: number): Promise<void> => {
  if (!combatLoop) return;
  const actionType = COMBAT_ACTION_TYPES[index] ?? 'attack';
  try {
    const result = await combatLoop.processPlayerAction(actionType);
    if (result.status === 'error') { ... return; }
    if (combatLoop.getCombatPhase() === 'enemy_turn') {
      await combatLoop.processEnemyTurn();   // this is the keeper
    }
  } catch (err: unknown) { ... }
};

// ADD outcome check before processEnemyTurn call:
if (
  combatLoop.getCombatPhase() === 'enemy_turn' &&
  result.status === 'ok' &&
  result.outcome !== 'flee' &&
  result.outcome !== 'victory' &&
  result.outcome !== 'defeat'
) {
  await combatLoop.processEnemyTurn();
}
```

**CombatActionResult outcome type** (combat-loop.ts lines 19-21):
```typescript
export type CombatActionResult =
  | { readonly status: 'ok'; readonly checkResult?: CheckResult; readonly narration: string; readonly outcome?: 'flee' | 'victory' | 'defeat' }
  | { readonly status: 'error'; readonly message: string };
```

---

### `src/engine/action-handlers/move-handler.ts` (COMBAT-03)

**Current handler** (lines 1-12) — add combat trigger after successful move:
```typescript
// CURRENT:
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

// Pattern to add after successful move — codex Location has `enemies[]` field:
// (LocationSchema line 41: exits, notable_npcs, objects — enemies[] comes from scene)
// Check codex entry for target scene: if entry.type === 'location' && entry has enemies
// Only trigger if combatLoop.getCombatPhase() === null (D-04: don't re-trigger)
if (
  ctx.combatLoop &&
  ctx.combatLoop.getCombatPhase() === null &&
  enemyIds.length > 0
) {
  await ctx.combatLoop.startCombat(enemyIds);
}
```

**Location schema** (entry-types.ts lines 35-45) — `enemies[]` is NOT in LocationSchema. The trigger logic must check the scene's codex entry. LocationSchema has `danger_level` and `notable_npcs`. The enemy ids for combat trigger come from the scene codex entry's associated enemies (need to check scene-manager for how enemies are tracked per location, or use a separate `enemies` array on the location).

**Note for planner:** Verify whether `SceneManager.handleGo` returns the new scene's codex entry or if `ctx` exposes `codexEntries` directly. The pattern from combat-loop.ts line 86 shows `codexEntries.get(id)`.

---

### `src/engine/combat-loop.ts` (COMBAT-04/05/06)

**COMBAT-04: Enemy abilities — read from codex pattern** (lines 260-266):
```typescript
// Existing pattern — codex lookup per enemy:
const enemyEntry = codexEntries.get(enemy.id);
const enemyData = enemyEntry?.type === 'enemy' ? (enemyEntry as Enemy) : null;
const enemyAttackMod = enemyData?.attack ?? 0;
const enemyDamageBase = enemyData?.damage_base ?? 3;
// ADD: const abilities = enemyData?.abilities ?? [];
```

**Enemy abilities from enemies.yaml:**
- `pack_tactics` — attack bonus when multiple enemies alive (enemy_wolf, enemy_wolf_alpha)
- `howl` — reduce player damage mitigation next turn (enemy_wolf_alpha)
- `backstab` — guaranteed crit on first attack (enemy_shadow_assassin)
- `poison_blade` — apply DoT (enemy_shadow_assassin)
- `vanish` — enemy flees combat (enemy_shadow_assassin)

**Forward-compatible ability dispatch pattern (D-06):**
```typescript
for (const ability of abilities) {
  switch (ability) {
    case 'pack_tactics': { /* bonus logic */ break; }
    case 'howl':         { /* debuff logic */ break; }
    case 'backstab':     { /* crit flag logic */ break; }
    case 'poison_blade': { /* DoT logic */ break; }
    case 'vanish':       { /* flee logic */ break; }
    default:             break;  // silently skip unknown
  }
}
```

**COMBAT-05: Spell lookup — spells.yaml structure:**
```yaml
# mp_cost, effect, requirements per spell
# spell_fire_arrow:  mp_cost: 3, effect: "对单体目标造成3-5点火焰伤害", element: fire
# spell_healing_light: mp_cost: 2, effect: "恢复目标2-4点生命值", element: holy
```
The SpellSchema in entry-types.ts (lines 66-73) does NOT have `effect_type` or `base_value` fields — only `mp_cost` and `effect` (string). **The planner must handle this discrepancy:** either parse `effect_type` from the `tags` array (`'healing'` tag = heal, `'attack'` tag = damage), or use `element` as a proxy. The CONTEXT.md decisions D-07/D-08 reference `effect_type` and `base_value` which do not exist in the current schema — the implementation must derive these from existing fields.

**COMBAT-05: Existing MP check pattern** (lines 156-166):
```typescript
if (actionType === 'cast') {
  if (player.mp < GAME_CONSTANTS.CAST_MP_COST) {
    stores.combat.setState(draft => { draft.phase = 'player_turn'; });
    return { status: 'error', message: '魔力不足！无法施法。' };
  }
  stores.player.setState(draft => {
    draft.mp = draft.mp - GAME_CONSTANTS.CAST_MP_COST;
  });
}
// Replace GAME_CONSTANTS.CAST_MP_COST with spellEntry.mp_cost
```

**COMBAT-06: try/catch wrap pattern for processPlayerAction (D-11):**
```typescript
// Wrap the entire processPlayerAction body:
async function processPlayerAction(...): Promise<CombatActionResult> {
  try {
    stores.combat.setState(draft => { draft.phase = 'resolving'; });
    // ... existing logic ...
  } catch (err: unknown) {
    stores.combat.setState(draft => { draft.phase = 'player_turn'; });
    const msg = err instanceof Error ? err.message : String(err);
    return { status: 'error', message: `战斗处理出错: ${msg}` };
  }
}
// Pattern for reset-on-error from game-screen-controller.ts lines 217-221:
combatStore.setState(draft => { draft.phase = 'player_turn'; });
```

---

### `src/state/serializer.ts` (SAVE-01)

**Bug location** (lines 105-121) — `createSerializer` signature and `snapshot()`:
```typescript
// CURRENT createSerializer signature (line 89-104):
export function createSerializer(
  stores: { player, scene, combat, game, quest, relations, npcMemory, exploration, playerKnowledge, turnLog },
  getBranchId: () => string,
  getParentSaveId: () => string | null,
): Serializer

// ADD parameter per D-13:
export function createSerializer(
  stores: { ... },
  getBranchId: () => string,
  getParentSaveId: () => string | null,
  getPlaytime: () => number,   // returns elapsed seconds
): Serializer

// CURRENT snapshot() meta (lines 111-121) — hardcoded:
const meta: SaveMeta = {
  saveName: 'Quick Save',   // D-12: accept saveName param
  timestamp: new Date().toISOString(),
  character: { name: player.name, race: player.race, profession: player.profession },
  playtime: 0,              // D-13: call getPlaytime()
  locationName: scene.sceneId,
};

// FIXED snapshot signature per D-12/D-14:
snapshot(saveName?: string): string {
  const meta: SaveMeta = {
    saveName: saveName ?? 'Quick Save',
    timestamp: new Date().toISOString(),
    character: { ... },
    playtime: getPlaytime(),
    locationName: scene.sceneId,
  };
}
```

**Serializer interface** (lines 15-18) — must update:
```typescript
export interface Serializer {
  snapshot(saveName?: string): string;  // add optional param
  restore(json: string): void;
}
```

**Save callers that must pass saveName (D-14):**
- `save-handler.ts` line 6: `ctx.saveFileManager.saveGame(action.target, ...)` — `saveGame` calls `serializer.snapshot()` internally via `save-file-manager.ts` line 47. Need to thread `saveName` through.
- `save-file-manager.ts` lines 35-49: `quickSave` and `saveGame` call `serializer.snapshot()` — update to pass name.

---

### `src/engine/action-handlers/branch-handler.ts` (SAVE-02)

**Bug location** (lines 19-28) — switch only calls `branchManager.switchBranch`, never loads save:
```typescript
// CURRENT switch block:
if (subAction === 'switch') {
  const name = (action.modifiers as Record<string, string>)['name'];
  if (!name) return { status: 'error', message: '请指定分支名称。' };
  if (!ctx.branchManager) return { status: 'error', message: '分支系统未初始化' };
  try {
    ctx.branchManager.switchBranch(name);
    return { status: 'action_executed', action, narration: [`已切换至分支「${name}」。`] };
  } catch {
    return { status: 'error', message: `分支「${name}」不存在。使用 /branch tree 查看所有分支。` };
  }
}

// FIXED — add loadGame after switchBranch per D-15:
// BranchMeta shape (branch-store.ts lines 6-14):
// { id, name, parentBranchId, parentSaveId, headSaveId: string | null, createdAt, description }
// Get headSaveId from branchManager (needs getBranchMeta or direct store access)
// ctx.saveFileManager.loadGame(filePath, ctx.serializer, ctx.saveDir)  ← D-16
```

**IMPORTANT — ActionContext gap:** `ctx.branchManager` (types.ts lines 27-31) only exposes `createBranch`, `switchBranch`, `deleteBranch` — no `getBranchMeta`. The planner must either:
1. Add `getBranchMeta: (branchId: string) => BranchMeta | undefined` to `ActionContext.branchManager`, OR
2. Access `ctx.stores` directly (branch store is not in `GameLoopStores` — verify)

**Load pattern from load-handler.ts** (analog):
```typescript
const filePath = fileName.includes('/') ? fileName : `${ctx.saveDir}/${fileName}`;
await ctx.saveFileManager.loadGame(filePath, ctx.serializer);
// Fixed version adds third arg: ctx.saveDir
```

---

### `src/engine/action-handlers/load-handler.ts` (SAVE-03)

**Bug** (line 7) — missing third argument `ctx.saveDir`:
```typescript
// CURRENT (line 7):
await ctx.saveFileManager.loadGame(filePath, ctx.serializer);

// FIXED per D-17/D-18 (one-line change):
await ctx.saveFileManager.loadGame(filePath, ctx.serializer, ctx.saveDir);
```

**loadGame signature** (save-file-manager.ts line 52):
```typescript
export async function loadGame(filePath: string, serializer: Serializer, saveDir?: string): Promise<void>
// saveDir is optional — when provided, path traversal check fires (lines 54-58)
```

**ActionContext.saveFileManager type** (types.ts lines 20-24) — **also has the bug**:
```typescript
// CURRENT type (missing saveDir in loadGame):
readonly loadGame: (filePath: string, serializer: Serializer) => Promise<void>;
// MUST update to:
readonly loadGame: (filePath: string, serializer: Serializer, saveDir?: string) => Promise<void>;
```

---

## Shared Patterns

### ActionHandler error/success return shape
**Source:** `src/engine/action-handlers/types.ts`
**Apply to:** All handler files
```typescript
// Error:   { status: 'error', message: string }
// Success: { status: 'action_executed', action, narration: string[] }
// Guard:   if (!ctx.X) return { status: 'error', message: 'X系统未初始化' };
```

### Immutable state updates
**Source:** Throughout `src/engine/combat-loop.ts`
**Apply to:** All store mutations
```typescript
stores.combat.setState(draft => {
  draft.phase = 'player_turn';
});
// Never: const s = stores.combat.getState(); s.phase = 'player_turn';
```

### Chinese error messages
**Source:** All action handlers
**Apply to:** All user-facing error strings
```
'MP 不足！无法施法。'  (not 'Insufficient MP')
'分支系统未初始化'    (not 'Branch system not initialized')
'该分支没有存档可恢复' (new message for SAVE-02 no headSaveId case)
```

### Codex entry type narrowing
**Source:** `src/engine/combat-loop.ts` lines 133-135, 263-264
**Apply to:** Any code that reads Enemy or Location from codexEntries
```typescript
const entry = codexEntries.get(id);
const typedEntry = entry?.type === 'enemy' ? (entry as Enemy) : null;
const field = typedEntry?.field ?? defaultValue;
```

---

## Schema / Type Gap Analysis

| Gap | Impact | Resolution |
|---|---|---|
| `SpellSchema` has no `effect_type` or `base_value` | COMBAT-05 D-07/D-08 reference non-existent fields | Derive `effect_type` from `tags` array (`'healing'` → heal, `'attack'` → damage); derive `base_value` by parsing numeric range from `effect` string, OR add fields to SpellSchema |
| `LocationSchema` has no `enemies[]` field | COMBAT-03 D-03 auto-trigger needs enemy list per scene | Planner must decide: (a) add `enemies` field to LocationSchema + YAML, or (b) infer from `notable_npcs` filtered by codex type === 'enemy' |
| `ActionContext.branchManager` has no `getBranchMeta` | SAVE-02 D-15 needs `headSaveId` | Add `getBranchMeta` to branchManager interface in types.ts, or expose branch store in ctx |
| `ActionContext.saveFileManager.loadGame` type missing `saveDir` | SAVE-03 fix blocked at type level | Update ActionContext type alongside load-handler fix |

## No Analog Found

All files have existing analogs. No net-new file patterns needed.

## Metadata

**Analog search scope:** `src/engine/`, `src/engine/action-handlers/`, `src/state/`, `src/persistence/`, `src/codex/`, `world-data/codex/`
**Files scanned:** 12
**Pattern extraction date:** 2026-04-28
