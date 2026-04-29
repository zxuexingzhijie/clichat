# Phase 15 Research: Content & Death Recovery

**Researched:** 2026-04-28
**Domain:** World content YAML + Ink/React death screen UI
**Confidence:** HIGH — all findings from direct codebase inspection

---

## CONT-01..04: Notable NPCs

### Current State of notable_npcs in locations.yaml

| Location ID | Current notable_npcs | Missing per D-01..04 |
|-------------|----------------------|----------------------|
| `loc_north_gate` | `[npc_guard]` | Add `npc_captain`, `npc_hunter` |
| `loc_temple` | `[npc_priestess]` | Add `npc_herbalist` |
| `loc_main_street` | `[]` | Add `npc_elder` |
| `loc_forest_road` | `[]` | Add `npc_hunter` |
| `loc_abandoned_camp` | `[]` | Stay empty (D-05) |
| `loc_dark_cave` | `[]` | Stay empty (D-05) |

### NPC ID Existence in npcs.yaml

All four target NPC IDs exist and are fully defined:

| NPC ID | Name | location_id in npcs.yaml | Notes |
|--------|------|--------------------------|-------|
| `npc_captain` | 守卫队长·陈铁柱 | `loc_north_gate` | Correct home location |
| `npc_hunter` | 猎人·阿虎 | `loc_north_gate` | Home is north_gate; adding to forest_road too is lore-consistent (hunter patrols) |
| `npc_herbalist` | 药师·林婆婆 | `loc_temple` | Correct home location |
| `npc_elder` | 镇长·王德 | `loc_main_street` | Correct home location |

**No new NPC entries are required.** All IDs already exist in npcs.yaml.

### Exact YAML changes

`loc_north_gate` — change:
```yaml
notable_npcs:
  - npc_guard
  - npc_captain
  - npc_hunter
```

`loc_temple` — change:
```yaml
notable_npcs:
  - npc_priestess
  - npc_herbalist
```

`loc_main_street` — change:
```yaml
notable_npcs:
  - npc_elder
```

`loc_forest_road` — change:
```yaml
notable_npcs:
  - npc_hunter
```

### SceneManager NPC rendering

`scene-manager.ts` line 117: `draft.npcsPresent = [...entry.notable_npcs]` — copies the array directly from the codex entry. No filtering, no visibility gating. Adding IDs to the YAML array is sufficient to make them appear in the scene and generate "与X交谈" actions via `buildSuggestedActions`.

---

## CONT-05: Dark Cave Encounter

### LocationSchema.enemies field

`src/codex/schemas/entry-types.ts` line 45:
```typescript
enemies: z.array(z.string()).optional(),
```

The field **already exists** (added in Phase 12). It is optional — locations without it default to no combat. `loc_dark_cave` currently has no `enemies` field at all.

### Available wolf enemies in enemies.yaml

| ID | Name | hp | attack | dc | danger_level |
|----|------|----|--------|----|--------------|
| `enemy_wolf` | 灰狼 | 20 | 2 | 12 | 2 |
| `enemy_wolf_alpha` | 头狼 | 35 | 4 | 14 | 4 |

`loc_dark_cave` has `danger_level: 8`. Appropriate encounter: `enemy_wolf_alpha` (danger_level 4) or a pack of `enemy_wolf` entries. A single `enemy_wolf_alpha` fits a boss-like dark cave encounter; two `enemy_wolf` entries would also work for pack_tactics activation.

**Recommended:** `[enemy_wolf_alpha]` — matches the cave's high danger rating and is thematically the pack leader that has retreated to the cave.

### Combat trigger pattern (verified in move-handler.ts)

Combat is NOT triggered on `scene_changed`. It is triggered in `handleMove` (the `move` action handler):

```typescript
// src/engine/action-handlers/move-handler.ts
const entry = ctx.codexEntries.get(newSceneId);
const location = entry?.type === 'location' ? (entry as Location) : null;
const enemies = location?.enemies ?? [];
const alreadyInCombat = ctx.stores.combat.getState().active;
if (enemies.length > 0 && !alreadyInCombat) {
  await ctx.combatLoop.startCombat(enemies);
}
```

`combatLoop.startCombat(enemyIds: string[])` — takes an array of enemy IDs from the codex.

**Implementation:** Only add `enemies` field to `loc_dark_cave` in locations.yaml. No engine code changes required.

### Exact YAML addition

```yaml
- id: loc_dark_cave
  # ... existing fields unchanged ...
  enemies:
    - enemy_wolf_alpha
```

---

## DEATH-01: Death Screen Recovery

### Current game_over code (game-screen.tsx lines 295–406)

Two separate `useInput` hooks are in play:

**Hook 1** (lines 264–296): Active for all phases. Handles normal gameplay keys. Not active for `game_over` because `gameState.pendingQuit` guard and logic focus on non-game_over states.

**Hook 2** (lines 298–300): The death screen handler — "press any key":
```typescript
useInput(useCallback((_input: string, _key: unknown) => {
  gameStore.setState(draft => { draft.phase = 'title'; draft.pendingQuit = false; });
}, []), { isActive: gameState.phase === 'game_over' });
```

This is a single callback with **no key inspection** — any input returns to title. It must be replaced with key routing.

**UI block** (lines 395–407):
```tsx
if (gameState.phase === 'game_over') {
  return (
    <Box flexDirection="column" width={width} height={height} borderStyle="single" justifyContent="center" alignItems="center">
      <Text bold color="red">── 旅途终结 ──</Text>
      <Text> </Text>
      <Text>{combatState.lastNarration.length > 0 ? combatState.lastNarration : '你倒下了，生命就此走到了尽头。'}</Text>
      <Text> </Text>
      <Text bold>{playerState.name} 的旅程就此终止。</Text>
      <Text> </Text>
      <Text dimColor>按任意键返回标题...</Text>
    </Box>
  );
}
```

### Save/Load API

`src/persistence/save-file-manager.ts` exports standalone functions (not a class):

| Function | Signature | Notes |
|----------|-----------|-------|
| `quickSave` | `(serializer, saveDir) => Promise<string>` | Writes to `{saveDir}/quicksave.json`. Returns file path. |
| `saveGame` | `(name, serializer, saveDir) => Promise<string>` | Named save with timestamp. |
| `loadGame` | `(filePath, serializer, saveDir?) => Promise<void>` | Path-traversal guard. Calls `serializer.restore(json)`. |
| `listSaves` | `(saveDir) => Promise<SaveListEntry[]>` | Returns saves sorted by timestamp desc. First entry = most recent. |

In `app.tsx` line 202, these are passed to `gameLoop` as `saveFileManager`. In `game-screen.tsx`, the `gameLoop` prop is available but `saveFileManager` is not directly on the screen — it lives inside the `ActionContext` of the game loop.

**The death screen useInput hook must call save/load directly, not through the action system.** The screen already has access to:
- `gameLoop` prop (passed to GameScreen)
- `eventBus` (imported at top of file)

The cleanest approach: pass `saveFileManager`, `serializer`, and `saveDir` as props to `GameScreen`, or expose a `loadLastSave()` method on `GameLoop`.

**Alternative (simpler):** The `listSaves` function + `loadGame` function can be called directly in the `useInput` callback if `saveDir` and `serializer` are passed as props to `GameScreen`. Currently they are NOT props of `GameScreen` — they are closed over in `app.tsx`.

### Most-recent save retrieval

`listSaves(saveDir)` returns `SaveListEntry[]` sorted descending by `meta.timestamp`. The first element `[0]` is the most recent save. Its `filePath` field is the path to pass to `loadGame`.

### Emergency save

`quickSave(serializer, saveDir)` writes `quicksave.json`. For the emergency save, D-13 specifies naming it `[emergency]` to distinguish it. Using `saveGame('[emergency]', serializer, saveDir)` would produce `[emergency]_2026-04-28T....json`. However the `safeName` regex in `saveGame` strips `[` and `]` — it would become `-emergency-_timestamp.json`. Options:
- Use a constant name: `saveGame('emergency', serializer, saveDir)` → `emergency_timestamp.json`
- Or write directly to `{saveDir}/emergency.json` bypassing `saveGame`

**Recommended:** Use `saveGame('emergency', serializer, saveDir)` — the timestamp suffix guarantees no overwrite conflicts and the name is still recognizable.

### Key routing implementation

Replace the single "any key" `useInput` with:
```typescript
useInput(useCallback((input: string, _key: unknown) => {
  if (input === 'r' || input === 'l') {
    // load last save
  } else {
    gameStore.setState(draft => { draft.phase = 'title'; draft.pendingQuit = false; });
  }
}, [...deps]), { isActive: gameState.phase === 'game_over' });
```

The `r`/`l` branch needs async execution — use a `useRef` + `useEffect` pattern (consistent with other async UI operations in this file) or call a synchronous state setter that triggers a `useEffect`.

### Props gap

Currently `GameScreen` does not receive `saveFileManager`, `serializer`, or `saveDir`. To implement DEATH-01, one of the following is needed:
- Add `saveDir`, `serializer`, and save functions as props to `GameScreen`
- OR add a `loadLastSave(): Promise<void>` method to `GameLoop` and expose it through the `gameLoop` prop

The second option is cleaner (no new props on GameScreen). `GameLoop` already has access to `saveFileManager`, `serializer`, and `saveDir` via its options.

---

## Shadow Contact Discovery (D-09..D-11)

### npc_shadow_contact definition

In `npcs.yaml`:
- `id: npc_shadow_contact`
- `location_id: loc_tavern`
- `epistemic.visibility: hidden` — this is a documentation field, not engine-enforced
- `known_by: [npc_bartender]` — lore only, not engine-enforced

`npc_shadow_contact` is NOT in `loc_tavern.notable_npcs`. That is intentional — it is hidden until revealed.

### No existing flag system for NPC visibility

`GameState` has no `revealedNpcs` or flags field:
```typescript
// game-store.ts — GameStateSchema fields:
day, timeOfDay, phase, turnCount, isDarkTheme, pendingQuit
```

`SceneState.npcsPresent` is set by `scene-manager.ts` directly from `entry.notable_npcs` with no filtering.

There is **no existing conditional NPC visibility mechanism** in the engine. D-11 applies: a new field must be added.

### Best home for the flag

`QuestProgress.flags` (`z.record(z.string(), z.unknown())`) exists per-quest but is scoped to quest progress, not global game flags. There is no global game flags store.

**Options ranked by fit:**
1. Add `revealedNpcs: z.array(z.string())` to `GameStateSchema` (game-store.ts) — cleanest, survives save/restore via serializer
2. Add a new `FlagsStore` — over-engineered for a single flag
3. Use `SceneState.npcsPresent` imperatively (mutate scene on dialogue_ended) — works but not persisted across scenes

**Recommended:** Option 1. Add `revealedNpcs: z.array(z.string()).default([])` to `GameStateSchema`. This field is serialized by the existing serializer (it snapshots all store states).

### dialogue_ended event payload

`src/events/event-types.ts` line 27:
```typescript
dialogue_ended: { npcId: string };
```

Payload has only `npcId`. To trigger shadow contact reveal:
```typescript
bus.on('dialogue_ended', ({ npcId }) => {
  if (npcId === 'npc_bartender') {
    gameStore.setState(draft => {
      if (!draft.revealedNpcs.includes('npc_shadow_contact')) {
        draft.revealedNpcs.push('npc_shadow_contact');
      }
    });
  }
});
```

This listener can live in `scene-manager.ts` (it already receives `eventBus`), or in a new `npc-reveal-tracker.ts` alongside `exploration-tracker.ts`.

### Scene NPC visibility — where to filter

`scene-manager.ts` line 117 (inside `loadScene`):
```typescript
draft.npcsPresent = [...entry.notable_npcs];
```

This must be updated to merge `entry.notable_npcs` with revealed NPCs that have `location_id` matching the current location. The scene manager needs read access to `gameStore` (or a passed-in `revealedNpcs` getter).

**Concrete change needed in loadScene:**
```typescript
const revealedNpcs: string[] = gameStore.getState().revealedNpcs;
const conditionalNpcs = revealedNpcs.filter(npcId => {
  const npc = queryById(codexEntries, npcId);
  return npc?.type === 'npc' && (npc as Npc).location_id === locationId;
});
draft.npcsPresent = [...entry.notable_npcs, ...conditionalNpcs];
```

`scene-manager.ts` currently does not import `gameStore` — that dependency would need to be added or the store passed in.

---

## Implementation Notes

### No LocationSchema changes needed

`enemies: z.array(z.string()).optional()` already exists at line 45. Adding the field to `loc_dark_cave` YAML is sufficient.

### npc_hunter appears in two locations

`npc_hunter.location_id` in npcs.yaml is `loc_north_gate`. Adding it to `loc_forest_road.notable_npcs` creates a soft lore inconsistency (NPC home vs patrol location). This is acceptable per D-04 ("hunter patrols between forest and north gate"). No engine enforces `location_id` as the only valid spawn location.

### Death screen async pattern

Other async operations in game-screen.tsx use the `useCallback` + `void` pattern:
```typescript
const handleActionExecute = useCallback(
  (index: number) => { void controller.handleActionExecute(index); },
  [controller],
);
```

The load-on-death path should follow the same pattern. A dedicated `handleLoadLastSave` callback on the controller (or a method on GameLoop) avoids putting async save logic directly inside a `useInput` callback.

### GameState serialization

`src/state/serializer.ts` snapshots all stores. Adding `revealedNpcs` to `GameStateSchema` with `.default([])` means old saves without this field will deserialize cleanly (Zod default fills in `[]`). No migration needed.

### Emergency save timing

The emergency save must happen **before** `gameStore.setState({ phase: 'game_over' })` is called. This is in `combat-loop.ts` — find where defeat triggers the phase change and insert the save call there. The `combat-loop` already has access to `saveFileManager` and `serializer` only if they are passed through — currently they are not part of `CombatLoop` options.

Alternative: listen for `combat_ended` with `outcome: 'defeat'` and save there before phase transition. The `combat_ended` event fires in `combat-loop.ts` before `game_phase_changed`. Check the exact sequencing.

### Shadow contact at loc_tavern vs loc_main_street

D-09 says "becomes visible at loc_tavern OR loc_main_street". `npc_shadow_contact.location_id` is `loc_tavern`. Using the `location_id` field as the reveal location is simplest — no hardcoding needed, the NPC definition already specifies where it lives.
