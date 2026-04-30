---
phase: 20
name: Enemy Loot System
type: patterns
created: "2026-04-30"
---

# Phase 20: Enemy Loot System - Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 8
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `world-data/codex/enemies.yaml` | config | transform | `world-data/codex/items.yaml` | role-match |
| `src/codex/schemas/entry-types.ts` | model | transform | `src/codex/schemas/entry-types.ts` (EnemySchema field, self) | exact |
| `src/state/scene-store.ts` | store | CRUD | `src/state/scene-store.ts` (objects field, self) | exact |
| `src/engine/combat-loop.ts` | service | event-driven | `src/engine/combat-loop.ts` (checkCombatEnd, self) | exact |
| `src/engine/action-handlers/take-handler.ts` | controller | request-response | `src/engine/action-handlers/use-item-handler.ts` | exact |
| `src/engine/action-handlers/index.ts` | config | request-response | `src/engine/action-handlers/index.ts` (self, add entry) | exact |
| `src/engine/scene-manager.ts` | service | request-response | `src/engine/scene-manager.ts` (handleLook, self) | exact |
| `src/state/serializer.ts` | model | CRUD | `src/state/serializer.ts` (SaveDataV5Schema pattern, self) | exact |

## Pattern Assignments

### `world-data/codex/enemies.yaml` (config, transform)

**Change:** Rename `loot` field to `loot_table` on all 5 enemy entries. Field value type unchanged — remains a YAML string array.

**Current pattern** (`enemies.yaml` lines 28, 61, 92, 124, 157):
```yaml
  loot:
    - item_wolf_pelt
```

**Target pattern:**
```yaml
  loot_table:
    - item_wolf_pelt
```

No structural change, no other fields involved.

---

### `src/codex/schemas/entry-types.ts` (model, transform)

**Analog:** `src/codex/schemas/entry-types.ts` — EnemySchema (lines 113–128)

**Current field** (line 123):
```typescript
  loot: z.array(z.string()).optional(),
```

**Target field:**
```typescript
  loot_table: z.array(z.string()).optional(),
```

**Context — full EnemySchema** (lines 113–128):
```typescript
export const EnemySchema = z.object({
  ...baseFields,
  type: z.literal("enemy"),
  hp: z.number().int().min(1),
  maxHp: z.number().int().min(1),
  attack: z.number().int(),
  defense: z.number().int(),
  dc: z.number().int().min(1),
  damage_base: z.number().int().min(0),
  abilities: z.array(z.string()),
  loot: z.array(z.string()).optional(),
  danger_level: z.number().min(0).max(10),
}).refine(data => data.hp <= data.maxHp, {
  message: "hp must not exceed maxHp",
  path: ["hp"],
});
```

Also update derived type export (line 219):
```typescript
export type Enemy = z.infer<typeof EnemySchema>;
```
No change needed to the type export — it infers automatically from the schema.

---

### `src/state/scene-store.ts` (store, CRUD)

**Analog:** `src/state/scene-store.ts` — `objects` field pattern (lines 12–21, 25–44)

**Imports pattern** (lines 1–4):
```typescript
import { z } from 'zod';
import { createStore, type Store } from './create-store';
import { eventBus } from '../events/event-bus';
import type { EventBus } from '../events/event-bus';
```

**Schema addition** — add `droppedItems` field alongside `objects` in `SceneStateSchema` (lines 12–21):
```typescript
export const SceneStateSchema = z.object({
  sceneId: z.string(),
  locationName: z.string(),
  narrationLines: z.array(z.string()),
  actions: z.array(SceneActionSchema),
  npcsPresent: z.array(z.string()),
  exits: z.array(z.string()),
  exitMap: z.record(z.string(), z.string()),
  objects: z.array(z.string()),
  // ADD:
  droppedItems: z.array(z.string()),
});
```

**Default state addition** — add `droppedItems: []` alongside `objects` in `getDefaultSceneState()` (lines 25–44):
```typescript
export function getDefaultSceneState(): SceneState {
  return {
    // ... existing fields ...
    objects: ['notice_board', 'oil_lamp'],
    droppedItems: [],   // ADD
  };
}
```

`SceneState` type infers automatically; no manual type change needed.

---

### `src/engine/combat-loop.ts` (service, event-driven)

**Analog:** `src/engine/combat-loop.ts` — `checkCombatEnd()` loot block (lines 515–548)

**Current loot write pattern** (lines 525–533):
```typescript
for (const combatEnemy of defeatedEnemies) {
  const enemyEntry = codexEntries.get(combatEnemy.id);
  const enemyData = enemyEntry?.type === 'enemy' ? (enemyEntry as Enemy) : null;
  const lootItems = enemyData?.loot ?? [];
  for (const itemId of lootItems) {
    stores.player.setState(draft => {
      draft.tags = [...draft.tags, `item:${itemId}`];
    });
  }
}
```

**Target pattern — two changes:**
1. Read `loot_table` instead of `loot` (field rename)
2. Write to `stores.scene.droppedItems` instead of `stores.player.tags`

```typescript
for (const combatEnemy of defeatedEnemies) {
  const enemyEntry = codexEntries.get(combatEnemy.id);
  const enemyData = enemyEntry?.type === 'enemy' ? (enemyEntry as Enemy) : null;
  const lootItems = enemyData?.loot_table ?? [];
  for (const itemId of lootItems) {
    stores.scene.setState(draft => {
      draft.droppedItems = [...draft.droppedItems, itemId];
    });
  }
}
```

**Immutable update pattern** (from `use-item-handler.ts` lines 55–58) — always spread, never push:
```typescript
draft.droppedItems = [...draft.droppedItems, itemId];
```

---

### `src/engine/action-handlers/take-handler.ts` (controller, request-response) — NEW FILE

**Analog:** `src/engine/action-handlers/use-item-handler.ts` (entire file, lines 1–81)

**Imports pattern** (lines 1–3):
```typescript
import type { Item } from '../../codex/schemas/entry-types';
import type { ActionHandler } from './types';
```

**Core handler signature** (line 14):
```typescript
export const handleTake: ActionHandler = async (action, ctx) => {
```

**Guard pattern — no target** (lines 15–18):
```typescript
  const itemId = action.target;
  if (!itemId) {
    return { status: 'error', message: '请指定要使用的物品。' };
  }
```

**State read + validation pattern** (lines 20–24):
```typescript
  const playerState = ctx.stores.player.getState();
  const hasItem = findItemTag(playerState.tags, itemId);
  if (!hasItem) {
    return { status: 'error', message: `背包里没有 ${itemId}。` };
  }
```

**Immutable state write + narration + turn increment pattern** (lines 55–80):
```typescript
  ctx.stores.player.setState(draft => {
    draft.tags = removeItemTag(draft.tags, itemId);
  });
  const currentLines = ctx.stores.scene.getState().narrationLines;
  const newLines = [...currentLines, narrationLine];
  ctx.stores.scene.setState(draft => {
    draft.narrationLines = newLines;
  });
  ctx.stores.game.setState(draft => {
    draft.turnCount += 1;
  });
  return { status: 'action_executed', action, narration: newLines };
```

**Full take-handler logic to build:**
- Read `ctx.stores.scene.getState().droppedItems`
- If no `action.target` and `droppedItems.length === 1`, auto-select the single item
- If no `action.target` and `droppedItems.length > 1`, list items and return error asking player to specify
- If `action.target` not in `droppedItems`, return `{ status: 'error', message: '地上没有该物品。' }`
- On success: remove from `droppedItems` (immutable filter), add `item:${itemId}` to `player.tags`, append narration line `你拾起了 [item.name]。`, increment `turnCount`
- Codex lookup for item name uses same `ctx.codexEntries?.get(itemId)` pattern as `use-item-handler.ts` lines 31–36

---

### `src/engine/action-handlers/index.ts` (config, request-response)

**Analog:** `src/engine/action-handlers/index.ts` (entire file, lines 1–91)

**Import addition pattern** (lines 1–18):
```typescript
import { handleUseItem } from './use-item-handler';
// ADD:
import { handleTake } from './take-handler';
```

**HANDLER_MAP entry pattern** (lines 49–71):
```typescript
const HANDLER_MAP: Record<string, ActionHandler> = {
  // ... existing entries ...
  use_item: handleUseItem,
  take: handleTake,  // ADD
};
```

No changes to `COMBAT_ACTIONS` set — `:take` is not a combat action.

---

### `src/engine/scene-manager.ts` (service, request-response)

**Analog:** `src/engine/scene-manager.ts` — `handleLook()` function (lines 268–301)

**Current no-target handleLook pattern** (lines 268–301) — where to inject `droppedItems` display:
```typescript
async function handleLook(target?: string): Promise<SceneManagerResult> {
  if (!target) {
    const state = stores.scene.getState();
    // ... narration lines built ...
    return { status: 'success', narration: state.narrationLines };
  }
  // ...
}
```

**Objects/NPC presence check pattern** (lines 304–308) — same pattern for droppedItems:
```typescript
const isNpc = state.npcsPresent.includes(target);
const isObject = state.objects.includes(target);
if (!isNpc && !isObject) {
  return { status: 'error', message: `找不到目标 "${target}"。` };
}
```

**Target pattern — append droppedItems line when non-empty:**
When building `narrationLines` for no-target look, after existing lines, append:
```typescript
const dropped = state.droppedItems;
if (dropped.length > 0) {
  const names = dropped.map(id => {
    const entry = queryById(codexEntries, id);
    return entry?.name ?? id;
  }).join('、');
  narrationLines.push(`地上有：${names}`);
}
```

The `queryById` helper is already imported/used in `scene-manager.ts` (see lines 97–99).

---

### `src/state/serializer.ts` (model, CRUD)

**Analog:** `src/state/serializer.ts` — version upgrade chain (lines 87–96, 134–151, 163–195)

**Version schema extend pattern** (lines 87–96):
```typescript
export const SaveDataV4Schema = SaveDataV3Schema.extend({
  version: z.literal(4),
});

export const SaveDataV5Schema = SaveDataV4Schema.extend({
  version: z.literal(5),
  narrativeState: NarrativeStateSchema,
});
```

**Target pattern — SaveDataV6Schema:**
```typescript
export const SaveDataV6Schema = SaveDataV5Schema.extend({
  version: z.literal(6),
  scene: SceneStateSchema,  // scene already includes droppedItems after store change
});
export type SaveDataV6 = z.infer<typeof SaveDataV6Schema>;
```

Note: Because `SceneStateSchema` is used directly in the save schema and `droppedItems` is added to `SceneStateSchema`, the scene field automatically carries `droppedItems`. The only required serializer changes are:
1. Add `SaveDataV6Schema` (extends V5 with `version: z.literal(6)`)
2. Update `snapshot()` to produce `version: 6`
3. Update `restore()` to parse V6 first in the fallback chain
4. Add `migrateV5ToV6` in `save-migrator.ts`

**Migrator pattern** (`src/persistence/save-migrator.ts` lines 47–56):
```typescript
export function migrateV4ToV5(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const data = raw as Record<string, unknown>;
  if (data['version'] !== 4) return raw;
  return {
    ...data,
    version: 5,
    narrativeState: getDefaultNarrativeState(),
  };
}
```

**Target `migrateV5ToV6` pattern:**
```typescript
export function migrateV5ToV6(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const data = raw as Record<string, unknown>;
  if (data['version'] !== 5) return raw;
  const scene = (data['scene'] as Record<string, unknown> | undefined) ?? {};
  return {
    ...data,
    version: 6,
    scene: { ...scene, droppedItems: scene['droppedItems'] ?? [] },
  };
}
```

**snapshot() data object pattern** (lines 134–151):
```typescript
const data: SaveDataV5 = {
  version: 5,
  // ... all stores ...
  scene,   // scene already has droppedItems from store
};
```

**restore() fallback chain pattern** (lines 163–195):
```typescript
const migrated = migrateV5ToV6(migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(raw)))));

const v6Result = SaveDataV6Schema.safeParse(migrated);
const v5Result = v6Result.success ? null : SaveDataV5Schema.safeParse(migrated);
// ... continue chain ...
const result = v6Result.success ? v6Result : (v5Result?.success ? v5Result : ...);
```

---

## Shared Patterns

### Immutable State Update
**Source:** `src/engine/action-handlers/use-item-handler.ts` lines 55–58, 63–66
**Apply to:** `take-handler.ts`, `combat-loop.ts` loot block
```typescript
ctx.stores.scene.setState(draft => {
  draft.droppedItems = draft.droppedItems.filter(id => id !== itemId);
});
```

### ActionHandler Signature
**Source:** `src/engine/action-handlers/types.ts` lines 44–47
**Apply to:** `take-handler.ts`
```typescript
export type ActionHandler = (
  action: GameAction,
  ctx: ActionContext,
) => Promise<ProcessResult>;
```

### Error Return Format
**Source:** `src/engine/action-handlers/use-item-handler.ts` lines 16–18
**Apply to:** `take-handler.ts` all guard branches
```typescript
return { status: 'error', message: '...' };
```

### Narration Append + Turn Increment
**Source:** `src/engine/action-handlers/use-item-handler.ts` lines 70–80
**Apply to:** `take-handler.ts`
```typescript
const currentLines = ctx.stores.scene.getState().narrationLines;
const newLines = [...currentLines, narrationLine];
ctx.stores.scene.setState(draft => {
  draft.narrationLines = newLines;
});
ctx.stores.game.setState(draft => {
  draft.turnCount += 1;
});
return { status: 'action_executed', action, narration: newLines };
```

### Codex Entry Lookup
**Source:** `src/engine/action-handlers/use-item-handler.ts` lines 31–36
**Apply to:** `take-handler.ts` (for item name display)
```typescript
if (!ctx.codexEntries) {
  return { status: 'error', message: '世界数据未加载。' };
}
const entry = ctx.codexEntries.get(itemId);
if (!entry || entry.type !== 'item') {
  return { status: 'error', message: `未知物品: ${itemId}。` };
}
const item = entry as Item;
```

### Version Migration Chain in save-migrator.ts
**Source:** `src/persistence/save-migrator.ts` lines 47–56
**Apply to:** new `migrateV5ToV6` function
Pattern: guard on version number, spread existing data, add new fields with defaults.

## No Analog Found

All files have close analogs in the codebase.

## Metadata

**Analog search scope:** `src/engine/action-handlers/`, `src/state/`, `src/engine/`, `src/codex/schemas/`, `src/persistence/`, `world-data/codex/`
**Files scanned:** 12
**Pattern extraction date:** 2026-04-30
