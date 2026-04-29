# Plan: Location description_overrides + scene-manager worldFlags lookup

**Phase**: 16 — Story Mainline & Narrative System
**Plan**: 16-P05
**Requirements**: D-21, D-22, D-23, D-24
**Depends on**: 16-P01 (narrativeStore exists), 16-P02 (SceneManagerOptions.narrativeStore defined), 16-P03 (worldFlags set by stage transitions)

## Goal

When this plan is complete, `LocationSchema` accepts an optional `description_overrides` field; `locations.yaml` has authored override texts for `loc_tavern`, `loc_north_gate`, and `loc_main_street` keyed by `worldFlags` names; `createSceneManager` accepts a `narrativeStore` dependency; and `handleLook` (no-target path) selects the highest-priority matching override before falling back to LLM narration or the static description.

## Success Criteria

1. `bun run tsc --noEmit` passes with no new errors
2. `bun test src/engine/scene-manager.test.ts` — all tests pass including override selection tests
3. YAML parses cleanly with `description_overrides` field
4. `handleLook()` for `loc_tavern` when `worldFlags.mayor_secret_known = true` returns the authored override string (not the default description)
5. `handleLook()` for `loc_tavern` when `worldFlags` is empty returns the default description or LLM narration (no override)
6. `handleLook()` for `loc_blacksmith` (no overrides defined) returns the default description regardless of worldFlags

## Tasks

### Task 1: Add description_overrides to LocationSchema

**File**: `src/codex/schemas/entry-types.ts`
**Action**: Edit

Add `description_overrides` as an optional field to `LocationSchema`:

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
  description_overrides: z.record(z.string(), z.string()).optional(),
});
```

The type is `Record<worldFlagKey, overrideText>` — simple string map. No priority ordering in schema; priority resolution is in the scene-manager code (Act 3 flags take priority over Act 2 flags).

### Task 2: Add description_overrides to loc_tavern, loc_north_gate, loc_main_street in locations.yaml

**File**: `world-data/codex/locations.yaml`
**Action**: Edit — add `description_overrides` field to 3 locations

**loc_tavern** — add after `map_icon`:
```yaml
description_overrides:
  act3_confrontation: "松木桶酒馆。炉火还是一样地烧着，老陈擦着杯子，不看你。每个人都在等待那个没有人说出口的结局。"
  mayor_secret_known: "松木桶酒馆。炉火还是一样地燃着，但你知道这份暖意是用什么换来的。烟火气里有什么东西沉了下去。"
  ritual_site_active: "松木桶酒馆。人声比平时稀少——又有人昨晚没有回来。老陈倒酒的手顿了一下，没有说什么。"
```

**loc_north_gate** — add after `map_icon`:
```yaml
description_overrides:
  act3_confrontation: "黑松镇北门。陈铁柱站在城门口，背对着你，油灯的光把他的影子拉得很长。守卫们假装什么都没看见。"
  mayor_secret_known: "黑松镇北门。石砌的城门还是一样巍峨，但你现在知道，五年前的那场灾难里，有多少人从这里出去，再也没回来。"
  ritual_site_active: "黑松镇北门。守卫比平时少了两人。陈铁柱的脸色比昨天更难看，他盯着北边的林子，一言不发。"
```

**loc_main_street** — add after `map_icon`:
```yaml
description_overrides:
  act3_confrontation: "黑松镇主街。叫卖声和人声一如往常，但有什么东西不对劲。没有人正眼看你——或者，每个人都在看你，只是你没有注意到。"
  mayor_secret_known: "黑松镇主街。熙攘的人群，热闹的集市。镇长的宅邸就在街的那一头，你知道里面坐着一个守了多少年秘密的老人。"
  truth_suppressed: "黑松镇主街。一切如常。风声、叫卖声、孩子的笑声。什么都没发生。这就是和之道的代价：什么都没发生。"
```

**Priority resolution rule** (for code in Task 3): Override keys are evaluated in this fixed priority order: `act3_confrontation` > `mayor_arrested` > `truth_suppressed` > `shadow_deal_made` > `mayor_secret_known` > `ritual_site_active`. The first key found in both `worldFlags` (with truthy value) and `description_overrides` wins.

### Task 3: Thread narrativeStore into createSceneManager + override selection in handleLook

**File**: `src/engine/scene-manager.ts`
**Action**: Edit

`SceneManagerOptions` already has `narrativeStore?: NarrativeStore` from P02. This task adds the override selection logic that consumes it.

**Add `selectLocationDescription` helper** (pure function, easy to test):

```typescript
const OVERRIDE_PRIORITY = [
  'act3_confrontation',
  'mayor_arrested',
  'truth_suppressed',
  'shadow_deal_made',
  'mayor_secret_known',
  'ritual_site_active',
] as const;

function selectLocationDescription(
  location: Location,
  worldFlags: Record<string, boolean>,
): string {
  if (location.description_overrides) {
    for (const key of OVERRIDE_PRIORITY) {
      if (worldFlags[key] && location.description_overrides[key]) {
        return location.description_overrides[key]!;
      }
    }
  }
  return location.description;
}
```

**Update `loadScene`**: Replace the `let narrationText = entry.description;` line with:

```typescript
const worldFlags = options?.narrativeStore?.getState().worldFlags ?? {};
let narrationText = selectLocationDescription(entry, worldFlags);
```

**Update `handleLook` (no-target branch)**: Before calling `generateNarrationFn`, check for an override. If an override matches, append it as a narration line directly (no LLM call) and return. Use `stores.scene.getState().sceneId` to look up the current location — do not rely on the `currentSceneId` closure variable, which may be stale in tests:

```typescript
async function handleLook(target?: string): Promise<SceneManagerResult> {
  if (!target) {
    const state = stores.scene.getState();
    const worldFlags = options?.narrativeStore?.getState().worldFlags ?? {};
    const locationEntry = stores.scene.getState().sceneId
      ? queryById(codexEntries, stores.scene.getState().sceneId!)
      : null;

    if (locationEntry && isLocation(locationEntry)) {
      const override = selectLocationDescription(locationEntry, worldFlags);
      if (override !== locationEntry.description) {
        // Override matched — use deterministic text, no LLM call (per D-23)
        const newLines = capNarrationLines([...state.narrationLines, override]);
        stores.scene.setState(draft => { draft.narrationLines = newLines; });
        return { status: 'success', narration: newLines };
      }
    }

    // No override — fall through to existing LLM or static path
    if (generateNarrationFn) {
      // ... existing code unchanged ...
    }
    return { status: 'success', narration: state.narrationLines };
  }
  // ... rest of existing handleLook unchanged ...
}
```

Write tests in `src/engine/scene-manager.test.ts`:
- `selectLocationDescription` with matching worldFlag returns override text
- `selectLocationDescription` with no matching flags returns `location.description`
- `selectLocationDescription` applies priority order correctly (higher-priority flag wins when both present)
- `handleLook()` with `narrativeStore` having `mayor_secret_known: true` returns override without calling `generateNarrationFn`
- `handleLook()` with no matching flags calls `generateNarrationFn` as normal
- `loadScene` uses override description when worldFlag matches

## Tests

- [ ] `src/engine/scene-manager.test.ts` — `selectLocationDescription` unit tests, handleLook override path
- [ ] `src/codex/schemas/entry-types.test.ts` or YAML smoke — `description_overrides` parses correctly
- [ ] `bun run tsc --noEmit` clean

## Commit Message

`feat(16-P05): location description_overrides + scene-manager worldFlags lookup in handleLook`
