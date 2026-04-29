# Plan: narrativeState Store + SaveDataV5 + Event Wiring

**Phase**: 16 — Story Mainline & Narrative System
**Plan**: 16-P01
**Requirements**: D-11, D-12, D-13, D-25, D-26
**Depends on**: none

## Goal

When this plan is complete, a `narrativeState` Zod store exists at `src/state/narrative-state.ts` with the four required fields (`currentAct`, `atmosphereTags`, `worldFlags`, `playerKnowledgeLevel`), it is persisted in a new `SaveDataV5` schema, and a `createNarrativeStateWatcher` function subscribes to `quest_stage_advanced` events and updates narrative state based on a `narrative-transitions.yaml` mapping file.

## Success Criteria

1. `bun run tsc --noEmit` passes with no new errors
2. `bun test src/state/narrative-state.test.ts` — all tests pass
3. `bun test src/persistence/save-migrator.test.ts` — existing + new V4→V5 migration test passes
4. Serializer `snapshot()` output includes `narrativeState` field and `version: 5`; `restore()` round-trips it correctly
5. After emitting `quest_stage_advanced` with `newStageId: 'stage_disappearances'`, the store's `currentAct` becomes `'act1'` and `atmosphereTags` becomes `['mundane', 'curious', 'unsettled']`

## Tasks

### Task 1: narrativeState Zod schema and store

**File**: `src/state/narrative-state.ts`
**Action**: Create

Create new file following the exact pattern of `src/state/dialogue-store.ts` (Zod schema + `createStore` + singleton export).

```typescript
import { z } from 'zod';
import { createStore, type Store } from './create-store';

export const NarrativeActSchema = z.enum(['act1', 'act2', 'act3']);
export type NarrativeAct = z.infer<typeof NarrativeActSchema>;

export const NarrativeStateSchema = z.object({
  currentAct: NarrativeActSchema.default('act1'),
  atmosphereTags: z.array(z.string()).default(['mundane', 'curious']),
  worldFlags: z.record(z.string(), z.boolean()).default({}),
  playerKnowledgeLevel: z.number().int().min(0).max(5).default(0),
});
export type NarrativeState = z.infer<typeof NarrativeStateSchema>;

export function getDefaultNarrativeState(): NarrativeState {
  return NarrativeStateSchema.parse({});
}

export type NarrativeStore = Store<NarrativeState> & {
  restoreState: (data: NarrativeState) => void;
};

export function createNarrativeStore(): NarrativeStore {
  const store = createStore<NarrativeState>(getDefaultNarrativeState(), () => {});

  function restoreState(data: NarrativeState): void {
    store.setState(draft => { Object.assign(draft, data); });
  }

  return { ...store, restoreState };
}

export const narrativeStore = createNarrativeStore();
```

Write tests in `src/state/narrative-state.test.ts`:
- default state has `currentAct: 'act1'`
- `restoreState` round-trips cleanly via Zod parse
- `worldFlags` accepts arbitrary boolean keys
- `playerKnowledgeLevel` rejects values outside 0–5

### Task 2: narrative-transitions.yaml + createNarrativeStateWatcher

**Files**: `world-data/narrative-transitions.yaml`, `src/engine/narrative-state-watcher.ts`
**Action**: Create both

**`world-data/narrative-transitions.yaml`** — deterministic mapping from quest stage IDs to narrative state changes:

```yaml
transitions:
  - on_stage: stage_rumor
    set_act: act1
    set_atmosphere: [mundane, curious, unsettled]
    set_knowledge_level: 0
    set_world_flags: {}

  - on_stage: stage_disappearances
    set_act: act1
    set_atmosphere: [mundane, curious, unsettled]
    set_knowledge_level: 1
    set_world_flags: {}

  - on_stage: stage_truth_in_forest
    set_act: act2
    set_atmosphere: [dread, mystery, urgency]
    set_knowledge_level: 2
    set_world_flags:
      ritual_site_active: true

  - on_stage: stage_mayor_secret
    set_act: act2
    set_atmosphere: [dread, fractured_trust, urgency]
    set_knowledge_level: 3
    set_world_flags:
      mayor_secret_known: true

  - on_stage: stage_allies_decision
    set_act: act3
    set_atmosphere: [confrontation, grief, weight_of_truth]
    set_knowledge_level: 4
    set_world_flags: {}

  - on_stage: stage_consequence_justice
    set_act: act3
    set_atmosphere: [consequence, regret, grief]
    set_knowledge_level: 5
    set_world_flags:
      mayor_arrested: true

  - on_stage: stage_consequence_harmony
    set_act: act3
    set_atmosphere: [consequence, regret, silence]
    set_knowledge_level: 5
    set_world_flags:
      truth_suppressed: true

  - on_stage: stage_consequence_shadow
    set_act: act3
    set_atmosphere: [consequence, regret, shadow]
    set_knowledge_level: 5
    set_world_flags:
      shadow_deal_made: true
```

**`src/engine/narrative-state-watcher.ts`** — subscribes to `quest_stage_advanced` event and applies transitions:

```typescript
import narrativeTransitions from '../../world-data/narrative-transitions.yaml';
import type { NarrativeStore } from '../state/narrative-state';
import type { EventBus } from '../events/event-bus';

type TransitionEntry = {
  on_stage: string;
  set_act: 'act1' | 'act2' | 'act3';
  set_atmosphere: string[];
  set_knowledge_level: number;
  set_world_flags: Record<string, boolean>;
};

export function createNarrativeStateWatcher(
  narrativeStore: NarrativeStore,
  bus: EventBus,
): () => void {
  const transitions = (narrativeTransitions as { transitions: TransitionEntry[] }).transitions;

  const onStageAdvanced = ({ newStageId }: { questId: string; newStageId: string; turnNumber: number }) => {
    const match = transitions.find(t => t.on_stage === newStageId);
    if (!match) return;

    narrativeStore.setState(draft => {
      draft.currentAct = match.set_act;
      draft.atmosphereTags = match.set_atmosphere;
      draft.playerKnowledgeLevel = match.set_knowledge_level;
      for (const [key, value] of Object.entries(match.set_world_flags)) {
        draft.worldFlags[key] = value;
      }
    });
  };

  bus.on('quest_stage_advanced', onStageAdvanced);
  return () => bus.off('quest_stage_advanced', onStageAdvanced);
}
```

Write tests in `src/engine/narrative-state-watcher.test.ts`:
- emitting `quest_stage_advanced` with `newStageId: 'stage_truth_in_forest'` sets `currentAct: 'act2'` and `worldFlags.ritual_site_active: true`
- unknown stage IDs are ignored (store unchanged)
- cleanup function removes listener

### Task 3: SaveDataV5 schema + serializer integration

**Files**: `src/state/serializer.ts`, `src/persistence/save-migrator.ts`
**Action**: Edit both

**In `src/state/serializer.ts`**:

Add import for `NarrativeStateSchema`, `NarrativeState`, and `NarrativeStore`. Extend `SaveDataV4Schema` to `SaveDataV5Schema`:

```typescript
import { NarrativeStateSchema, type NarrativeState, type NarrativeStore } from './narrative-state';

export const SaveDataV5Schema = SaveDataV4Schema.extend({
  version: z.literal(5),
  narrativeState: NarrativeStateSchema,
});
export type SaveDataV5 = z.infer<typeof SaveDataV5Schema>;
```

Update `createSerializer` to:
- Accept `narrativeStore: NarrativeStore` in the `stores` parameter
- Include `narrativeState: stores.narrativeStore.getState()` in `snapshot()` output with `version: 5` (the `data` const must be typed as `SaveDataV5`, not `SaveDataV4`)
- In `restore()`: update the migration chain to call `migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(raw))))`, then try `SaveDataV5Schema.safeParse(migrated)` first, fall through to `SaveDataV4Schema`, then `SaveDataV3Schema` if V5 parse fails, and call `stores.narrativeStore.restoreState(data.narrativeState)` after a successful V5 parse

The updated `restore()` parse chain must look like:

```typescript
const migrated = migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(raw))));

const v5Result = SaveDataV5Schema.safeParse(migrated);
const v4Result = v5Result.success ? null : SaveDataV4Schema.safeParse(migrated);
const v3Fallback = (v5Result.success || v4Result?.success) ? null : SaveDataV3Schema.safeParse(migrated);
const result = v5Result.success ? v5Result : (v4Result?.success ? v4Result : v3Fallback);

if (!result || !result.success) {
  const firstIssue = v5Result.error?.issues?.[0];
  // ... error handling unchanged ...
}

const data = result.data;
// ... restore all existing stores unchanged ...
if (v5Result.success) {
  stores.narrativeStore.restoreState(data.narrativeState);
}
```

This ensures:
- V5 saves restore correctly (narrative state included)
- V4/V3 saves still restore (narrative store gets default state, not called here — watcher will set it on next quest advance)
- The version literal mismatch (`version: 5` vs `version: 4`) is handled correctly — V5 schema won't accept a V4 literal, so the fallback is necessary

**In `src/persistence/save-migrator.ts`**:

Add `migrateV4ToV5`:

```typescript
import { getDefaultNarrativeState } from '../state/narrative-state';

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

Update `save-file-manager.ts` `readSaveData` to parse with `SaveDataV5Schema`.

Write tests:
- `migrateV4ToV5` adds `narrativeState` with default values when given a V4 snapshot
- Serializer `snapshot()` for a V5 save includes `version: 5` and `narrativeState.currentAct === 'act1'`
- Serializer `restore()` round-trips `narrativeState.worldFlags` correctly for a V5 save
- Serializer `restore()` succeeds on a V4 snapshot (via migration) without calling `narrativeStore.restoreState` directly

## Tests

- [ ] `src/state/narrative-state.test.ts` — schema validation, store defaults, restoreState
- [ ] `src/engine/narrative-state-watcher.test.ts` — stage transitions, unknown stage no-op, cleanup
- [ ] `src/persistence/save-migrator.test.ts` — V4→V5 migration adds narrativeState defaults
- [ ] `src/state/serializer.test.ts` — snapshot includes version 5 + narrativeState, restore round-trips, V4 restore fallback works

## Commit Message

`feat(16-P01): narrativeState store + V5 save schema + quest_stage_advanced watcher`
