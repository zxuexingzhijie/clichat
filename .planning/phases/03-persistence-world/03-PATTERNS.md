# Phase 3: Persistence & World - Pattern Map

**Mapped:** 2026-04-21
**Files analyzed:** 17 new/modified files
**Analogs found:** 17 / 17

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/state/quest-store.ts` | store | CRUD | `src/state/dialogue-store.ts` | exact |
| `src/state/relation-store.ts` | store | CRUD | `src/state/game-store.ts` | exact |
| `src/state/npc-memory-store.ts` (extend) | store | event-driven | `src/state/npc-memory-store.ts` (self) | self-extension |
| `src/state/serializer.ts` (upgrade) | serializer | batch | `src/state/serializer.ts` (self) | self-extension |
| `src/persistence/save-file-manager.ts` | service | file-I/O | `src/codex/loader.ts` | role-match |
| `src/persistence/memory-persistence.ts` | service | event-driven + file-I/O | `src/codex/loader.ts` | role-match |
| `src/persistence/save-migrator.ts` | utility | transform | `src/state/serializer.ts` | partial |
| `src/engine/quest-system.ts` | service | CRUD | `src/engine/combat-loop.ts` | role-match |
| `src/engine/reputation-system.ts` | utility | transform | `src/engine/rules-engine.ts` | exact |
| `src/engine/dialogue-manager.ts` (extend) | service | request-response | `src/engine/dialogue-manager.ts` (self) | self-extension |
| `src/codex/schemas/entry-types.ts` (extend) | schema | transform | `src/codex/schemas/entry-types.ts` (self) | self-extension |
| `src/ui/panels/journal-panel.tsx` | component | request-response | `src/ui/panels/dialogue-panel.tsx` | role-match |
| `src/ui/screens/game-screen.tsx` (extend) | component | request-response | `src/ui/screens/game-screen.tsx` (self) | self-extension |
| `src/input/command-registry.ts` (extend) | config | request-response | `src/input/command-registry.ts` (self) | self-extension |
| `src/events/event-types.ts` (extend) | config | event-driven | `src/events/event-types.ts` (self) | self-extension |
| `src/data/codex/quests.yaml` | data | file-I/O | `src/data/codex/npcs.yaml` | role-match |
| `src/data/codex/locations.yaml` (expand) | data | file-I/O | `src/data/codex/locations.yaml` (self) | self-extension |

---

## Pattern Assignments

### `src/state/quest-store.ts` (store, CRUD)

**Analog:** `src/state/dialogue-store.ts`

**Imports pattern** (`src/state/dialogue-store.ts` lines 1-5):
```typescript
import { z } from 'zod';
import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';
import { AttributeNameSchema } from '../types/common';
```

**Schema + default state pattern** (`src/state/dialogue-store.ts` lines 6-43):
```typescript
export const DialogueStateSchema = z.object({
  active: z.boolean(),
  npcId: z.string().nullable(),
  // ...all fields with Zod types
});

export type DialogueState = z.infer<typeof DialogueStateSchema>;

export function getDefaultDialogueState(): DialogueState {
  return {
    active: false,
    npcId: null,
    // ...matching defaults
  };
}
```

**Store creation with onChange event emission** (`src/state/dialogue-store.ts` lines 45-59):
```typescript
export const dialogueStore = createStore<DialogueState>(
  getDefaultDialogueState(),
  ({ newState, oldState }) => {
    if (newState.active && !oldState.active && newState.npcId) {
      eventBus.emit('dialogue_started', {
        npcId: newState.npcId,
        npcName: newState.npcName,
        mode: newState.mode,
      });
    }
    if (!newState.active && oldState.active && oldState.npcId) {
      eventBus.emit('dialogue_ended', { npcId: oldState.npcId });
    }
  },
);
```

**Apply to QuestStore:** Replace `active/npcId` with `quests` record + questEventLog array. In onChange, diff `quests[id].status` to detect transitions and emit `quest_started` / `quest_completed` / `quest_failed`. The questEventLog is a separate append-only array — do NOT put it inside `QuestStateSchema`; serialize it separately in SaveData v2.

---

### `src/state/relation-store.ts` (store, CRUD)

**Analog:** `src/state/game-store.ts`

**Schema + store with conditional event emit** (`src/state/game-store.ts` lines 1-37):
```typescript
import { z } from 'zod';
import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';

export const GameStateSchema = z.object({
  day: z.number().int().min(1),
  timeOfDay: TimeOfDaySchema,
  phase: GamePhaseSchema,
  turnCount: z.number().int().min(0),
  isDarkTheme: z.boolean(),
});
export type GameState = z.infer<typeof GameStateSchema>;

export function getDefaultGameState(): GameState {
  return { day: 1, timeOfDay: 'night', phase: 'title', turnCount: 0, isDarkTheme: true };
}

export const gameStore = createStore<GameState>(
  getDefaultGameState(),
  ({ newState, oldState }) => {
    if (newState.day !== oldState.day || newState.timeOfDay !== oldState.timeOfDay) {
      eventBus.emit('time_advanced', { day: newState.day, timeOfDay: newState.timeOfDay });
    }
    if (newState.phase !== oldState.phase) {
      eventBus.emit('game_phase_changed', { phase: newState.phase });
    }
  },
);
```

**Apply to RelationStore:** Replace game fields with `npcDispositions: z.record(z.string(), NpcDispositionSchema)` and `factionReputations: z.record(z.string(), z.number().min(-100).max(100))`. In onChange, diff each npcId and factionId to detect value changes and emit `reputation_changed`.

---

### `src/state/npc-memory-store.ts` (extend — three-layer schema)

**Self-extension — current shape** (`src/state/npc-memory-store.ts` lines 1-46):

Current `NpcMemoryStateSchema` (line 18-20):
```typescript
export const NpcMemoryStateSchema = z.object({
  memories: z.record(z.string(), z.array(NpcMemoryEntrySchema)),
});
```

**Change required:** Replace `z.array(NpcMemoryEntrySchema)` with a new `NpcMemoryRecordSchema`:
```typescript
export const NpcMemoryRecordSchema = z.object({
  npcId: z.string(),
  recentMemories: z.array(NpcMemoryEntrySchema).max(15),
  salientMemories: z.array(NpcMemoryEntrySchema).max(50),
  archiveSummary: z.string(),
  lastUpdated: z.string(),
});

export const NpcMemoryStateSchema = z.object({
  memories: z.record(z.string(), NpcMemoryRecordSchema),
});
```

The onChange handler pattern (lines 30-46) stays the same — still diffing for new memory entries and emitting `npc_memory_written`. Update the diff logic to check `recentMemories.length` instead of the flat array.

**Warning:** `src/state/new-stores.test.ts` tests the old flat-array shape (lines 196-265). Update those tests first before changing the schema.

---

### `src/state/serializer.ts` (upgrade to v2)

**Self-extension — current v1 shape** (`src/state/serializer.ts` lines 1-67):

**Snapshot pattern** (lines 31-41):
```typescript
snapshot(): string {
  const data: SaveData = {
    version: 1,
    timestamp: new Date().toISOString(),
    player: stores.player.getState(),
    scene: stores.scene.getState(),
    combat: stores.combat.getState(),
    game: stores.game.getState(),
  };
  return JSON.stringify(data);
},
```

**Restore with safeParse + error detail** (lines 43-65):
```typescript
restore(json: string): void {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Invalid save data: malformed JSON');
  }

  const result = SaveDataSchema.safeParse(raw);
  if (!result.success) {
    const firstIssue = result.error.issues?.[0];
    const detail = firstIssue
      ? `${firstIssue.path.join('.')} — ${firstIssue.message}`
      : result.error.message;
    throw new Error(`Invalid save data: ${detail}`);
  }

  const data = result.data;
  stores.player.setState(draft => { Object.assign(draft, data.player); });
  // ...other stores
},
```

**v2 change:** Before `safeParse`, insert migration check:
```typescript
if ((raw as { version?: unknown }).version === 1) {
  raw = migrateV1ToV2(raw); // from save-migrator.ts
}
const result = SaveDataV2Schema.safeParse(raw);
```

Extend `createSerializer` signature to accept new stores: `quest`, `relations`, `npcMemory`. Add all to snapshot and restore. The `questEventLog` array is also included in the snapshot (read from a standalone array, not a store).

---

### `src/persistence/save-file-manager.ts` (service, file-I/O)

**Analog:** `src/codex/loader.ts`

**Bun file I/O pattern** (`src/codex/loader.ts` lines 1-34):
```typescript
import { parse as parseYaml } from "yaml";

export async function loadCodexFile(filePath: string): Promise<CodexEntry[]> {
  const file = Bun.file(filePath);
  const text = await file.text();
  // ...
}
```

**Write pattern** (Bun built-in, consistent with project):
```typescript
await Bun.write(filePath, JSON.stringify(data, null, 2));
```

**Directory creation guard (required before first write):**
```typescript
import { mkdirSync } from 'node:fs';
mkdirSync(saveDir, { recursive: true });
```

**Key behaviors to implement:**
- `getSaveDir(opts?)` — uses `env-paths` (install `bun add env-paths`) or a `process.platform` switch
- `listSaves(saveDir)` — reads directory, parses only `meta` field from each file (not full parse)
- `saveGame(name, serializer)` — creates filename `name_timestamp.json`, calls `serializer.snapshot()`, writes
- `quickSave(serializer)` — writes to `quicksave.json`
- `loadGame(filePath, serializer)` — reads file, calls `serializer.restore(json)`

---

### `src/persistence/memory-persistence.ts` (service, event-driven + file-I/O)

**Analog:** `src/codex/loader.ts` (file I/O) + `src/state/npc-memory-store.ts` (event subscription pattern)

**Event subscription pattern** (`src/state/npc-memory-store.ts` lines 28-46):
```typescript
export const npcMemoryStore = createStore<NpcMemoryState>(
  getDefaultNpcMemoryState(),
  ({ newState, oldState }) => {
    for (const npcId of Object.keys(newState.memories)) {
      const newMemories = newState.memories[npcId] ?? [];
      const oldMemories = oldState.memories[npcId] ?? [];
      if (newMemories.length > oldMemories.length) {
        const latest = newMemories[newMemories.length - 1];
        if (latest) {
          eventBus.emit('npc_memory_written', { npcId, event: latest.event, turnNumber: latest.turnNumber });
        }
      }
    }
  },
);
```

**Disk write pattern:** `memory-persistence.ts` subscribes to `npc_memory_written` via `eventBus.on(...)`. On each event, it:
1. Reads/creates `memory/index.json`
2. Reads/creates `memory/{region}/{npcId}.json`
3. Applies three-layer retention logic (promote recent → salient at limit 15, assemble archiveSummary when salient hits 50)
4. Calls `await Bun.write(...)` on both files — async, fire-and-forget; log errors but do NOT block the game loop

**Directory structure:**
```
memory/
  index.json            # { [npcId]: { filePath, region, updatedAt } }
  blackpine_town/
    npc_guard.json      # NpcMemoryRecord
    npc_bartender.json
```

---

### `src/persistence/save-migrator.ts` (utility, transform)

**Analog:** `src/state/serializer.ts` (restore pattern with safeParse)

**Migration function shape:**
```typescript
function migrateV1ToV2(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const data = raw as Record<string, unknown>;
  if (data['version'] !== 1) return raw;
  return {
    ...data,
    version: 2,
    meta: buildMetaFromV1(data),       // assemble SaveMeta from v1 player/scene fields
    quest: getDefaultQuestState(),
    relations: getDefaultRelationState(),
    npcMemorySnapshot: data['npcMemory'] ?? getDefaultNpcMemoryState(),
    questEventLog: [],
    externalRefs: undefined,
  };
}
```

No imports from external libraries needed. Imports `getDefaultQuestState`, `getDefaultRelationState`, `getDefaultNpcMemoryState` from their respective store files.

---

### `src/engine/quest-system.ts` (service, CRUD)

**Analog:** `src/engine/combat-loop.ts`

**Factory function pattern** (`src/engine/combat-loop.ts` lines 53-60):
```typescript
export function createCombatLoop(
  codexEntries: Map<string, CodexEntry>,
  options?: CombatLoopOptions,
): CombatLoop {
  const rng = options?.rng;
  // ...inner functions close over codexEntries and options

  return { startCombat, processPlayerAction, processEnemyTurn, checkCombatEnd, getCombatPhase };
}
```

**Apply to QuestSystem:** Same factory pattern — `createQuestSystem(codexEntries, questStore, relationStore, questEventLog)`. Returns interface with `acceptQuest(id)`, `completeObjective(questId, objectiveId)`, `advanceStage(questId, stageId)`, `failQuest(questId)`.

**Reputation gate check (inside `acceptQuest`):**
```typescript
// Read from RelationStore, not dialogueStore.relationshipValue
const disposition = relationStore.getState().npcDispositions[npcId]?.value ?? 0;
const minRep = template.min_reputation ?? -100;
if (disposition < minRep) {
  return { status: 'gated', reason: '声望不足' };
}
```

**Quest state mutation — immer pattern** (`src/engine/dialogue-manager.ts` lines 252-267):
```typescript
npcMemoryStore.setState((draft) => {
  draft.memories[npcId] = [
    ...existing,
    { id: nanoid(), npcId, event, turnNumber, ... },
  ];
});
```

Apply same pattern: `questStore.setState(draft => { draft.quests[id].status = 'active'; ... })`.

---

### `src/engine/reputation-system.ts` (utility, transform)

**Analog:** `src/engine/rules-engine.ts`

**Pure function pattern** (`src/engine/rules-engine.ts` lines 14-28):
```typescript
export function resolveAction(
  _action: GameAction,
  context: ActionContext,
  rng?: () => number,
): CheckResult {
  const roll = rollD20(rng);
  return resolveNormalCheck({ ... });
}
```

**Apply to ReputationSystem:** Pure functions with no side effects. No stores imported directly. Callers pass in current values and receive computed results.

Key functions:
- `getAttitudeLabel(dispositionValue: number): string` — threshold switch (-60/-20/20/60)
- `applyReputationDelta(current: NpcDisposition, delta: Partial<NpcDisposition>): NpcDisposition` — returns new object, never mutates
- `filterResponsesByReputation(responses, npcId, relationStore): ResponseWithLock[]`

The caller (dialogue-manager or quest-system) calls these functions and then calls `relationStore.setState(...)` with the result.

---

### `src/engine/dialogue-manager.ts` (extend)

**Self-extension — add reputation gates and quest triggers.**

**Current NPC mode check pattern** (`src/engine/dialogue-manager.ts` lines 23-29):
```typescript
function requiresFullMode(npc: Npc): boolean {
  return (
    isQuestNpc(npc) ||
    npc.initial_disposition < -0.2 ||
    npc.initial_disposition > 0.5
  );
}
```

**Current memory write pattern** (lines 249-267):
```typescript
function writeMemory(npcId: string, event: string): void {
  const turnNumber = gameStore.getState().turnCount;
  const existing = npcMemoryStore.getState().memories[npcId] ?? [];
  npcMemoryStore.setState((draft) => {
    draft.memories[npcId] = [...existing, { id: nanoid(), npcId, event, ... }];
  });
}
```

**endDialogue — flush delta to RelationStore** (lines 239-247):
```typescript
function endDialogue(): void {
  dialogueStore.setState((draft) => {
    Object.assign(draft, getDefaultDialogueState());
  });
  gameStore.setState((draft) => { draft.phase = 'game'; });
}
```

**Phase 3 extension:** After resetting dialogueStore in `endDialogue()`, flush `dialogueStore.getState().relationshipValue` as a delta to `RelationStore`:
```typescript
// After Object.assign reset:
relationStore.setState(draft => {
  const npcId = oldState.npcId;
  if (npcId) {
    const current = draft.npcDispositions[npcId]?.value ?? 0;
    draft.npcDispositions[npcId] = applyReputationDelta(
      draft.npcDispositions[npcId] ?? defaultDisposition(),
      { value: current + delta }
    );
  }
});
```

**Quest trigger in startDialogue:** After generating NPC dialogue, check if `npc.goals` contains quest-related keywords and auto-offer quest via `questSystem.acceptQuest(questId)`.

---

### `src/codex/schemas/entry-types.ts` (extend)

**Self-extension — add QuestTemplateSchema to discriminated union.**

**Current discriminated union pattern** (lines 113-124):
```typescript
export const CodexEntrySchema = z.discriminatedUnion("type", [
  RaceSchema,
  ProfessionSchema,
  LocationSchema,
  FactionSchema,
  NpcSchema,
  SpellSchema,
  ItemSchema,
  HistoryEventSchema,
  EnemySchema,
  BackgroundSchema,
]);
```

**Existing baseFields pattern** (lines 4-10):
```typescript
const baseFields = {
  id: z.string().min(1),
  name: z.string(),
  tags: z.array(z.string()),
  description: z.string(),
  epistemic: EpistemicMetadataSchema,
};
```

**Apply to QuestTemplateSchema:**
```typescript
export const QuestTemplateSchema = z.object({
  ...baseFields,
  type: z.literal('quest'),
  quest_type: z.enum(['main', 'side', 'faction']),
  region: z.string().optional(),
  required_npc_id: z.string().optional(),
  min_reputation: z.number().optional(),
  stages: z.array(QuestStageSchema),
  rewards: z.object({
    gold: z.number().optional(),
    items: z.array(z.string()).optional(),
    reputation_delta: z.record(z.string(), z.number()).optional(),
    relation_delta: z.record(z.string(), z.number()).optional(),
  }),
});
```

Add `QuestTemplateSchema` to the `z.discriminatedUnion(...)` array. Also export `QuestTemplate = z.infer<typeof QuestTemplateSchema>`.

**Warning per RESEARCH.md Pitfall #4:** Add QuestTemplateSchema to the union BEFORE adding `quests.yaml` to `src/data/codex/`. Otherwise `loadAllCodex()` throws validation errors for every quest entry.

---

### `src/ui/panels/journal-panel.tsx` (component, request-response)

**Analog:** `src/ui/panels/dialogue-panel.tsx`

**Component structure pattern** (`src/ui/panels/dialogue-panel.tsx` lines 1-134):

**Props type (read-only, typed)** (lines 17-28):
```typescript
type DialoguePanelProps = {
  readonly npcName: string;
  readonly dialogueHistory: readonly DialogueEntry[];
  readonly relationshipValue: number;
  readonly emotionHint: string | null;
  readonly responseOptions: readonly ResponseOption[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  readonly onExecute: (index: number) => void;
  readonly isActive: boolean;
  readonly onEscape: () => void;
};
```

**Ink Box/Text rendering with sections** (lines 80-134):
```typescript
return (
  <Box flexDirection="column" flexGrow={1} paddingX={1}>
    <Box flexDirection="row" justifyContent="space-between">
      <Text bold color="cyan">【{npcName}】</Text>
      <Text dimColor>关系: {relLabel} ({relationshipValue.toFixed(1)})</Text>
    </Box>
    <Text> </Text>
    {/* content sections */}
    <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
      <Text> </Text>
    </Box>
    {responseOptions.map((option, i) => (
      <Box key={option.id} flexDirection="row">
        <Text bold={isSelected} color={isSelected ? 'cyan' : undefined} dimColor={!isSelected}>
          {isSelected ? '❯ ' : '  '}{i + 1}. {option.label}
        </Text>
      </Box>
    ))}
    <Text dimColor>↑↓ 选择    Enter 确认    Esc 关闭</Text>
  </Box>
);
```

**Apply to JournalPanel:** No keyboard navigation needed (read-only display). Props: `activeQuests`, `completedQuests`, `failedQuests` (each `QuestProgress & QuestTemplate`), `onClose`. Use same `Box/Text` structure. Group quests by status with `<Text bold color="yellow">进行中</Text>` section headers. Show quest name, current stage description, discovered clues (✓), pending objectives (□) per D-13.

**Disposition label helper pattern** (lines 30-36):
```typescript
function relationshipLabel(value: number): string {
  if (value < -0.5) return '敌对';
  if (value < -0.1) return '冷淡';
  if (value <= 0.1) return '中立';
  if (value <= 0.5) return '友好';
  return '信任';
}
```

Copy this threshold-switch pattern for `reputationAttitudeLabel(value: number)` in `reputation-system.ts` (thresholds -60/-20/20/60 per D-16).

---

### `src/ui/screens/game-screen.tsx` (extend)

**Self-extension — integrate JournalPanel.**

**Panel conditional rendering pattern** (`src/ui/screens/game-screen.tsx` lines 109-195):
```typescript
const isInCombat = combatState.active;
const isInDialogueMode = dialogueState.active && dialogueState.mode === 'full';

const scenePanelNode = isInCombat
  ? combatSceneContent
  : isInDialogueMode
    ? <DialoguePanel ... />
    : <ScenePanel lines={sceneLines} />;
```

**Apply:** Add `isInJournal` boolean (from game phase or a local state flag triggered by `:journal` command). Extend the conditional chain:
```typescript
const scenePanelNode = isInCombat
  ? combatSceneContent
  : isInDialogueMode
    ? <DialoguePanel ... />
    : isInJournal
      ? <JournalPanel ... onClose={() => setIsInJournal(false)} />
      : <ScenePanel lines={sceneLines} />;
```

Wire `questState` as a prop from `questStore`. Pass active quest name to `StatusBar` (replace `quest={null}` stub at line 154 with actual active quest from `questStore`).

---

### `src/input/command-registry.ts` (extend)

**Self-extension — add `:load`, `:journal`, `:quest` commands.**

**Existing command registration pattern** (`src/input/command-registry.ts` lines 88-94):
```typescript
program
  .command('save')
  .argument('[name]', 'save name')
  .action((name?: string) => {
    setResult({ type: 'save', target: name ?? null, modifiers: {}, source: 'command' });
  });
```

**Apply:** Register three new commands following the exact same pattern:
```typescript
program.command('load').argument('[name]', 'save name or "list"')
  .action((name?: string) => {
    setResult({ type: 'load', target: name ?? null, modifiers: {}, source: 'command' });
  });

program.command('journal')
  .action(() => {
    setResult({ type: 'journal', target: null, modifiers: {}, source: 'command' });
  });

program.command('quest')
  .argument('<action>', 'accept|list|abandon')
  .argument('[id]', 'quest id')
  .action((action: string, id?: string) => {
    setResult({ type: 'quest', target: action, modifiers: id ? { id } : {}, source: 'command' });
  });
```

Also add `'load' | 'journal' | 'quest'` to the `GameAction` type union in `src/types/game-action.ts`.

---

### `src/events/event-types.ts` (extend)

**Self-extension — add Phase 3 domain events.**

**Existing event type declaration pattern** (`src/events/event-types.ts` lines 1-41):
```typescript
export type DomainEvents = {
  action_resolved: { action: GameAction; result: CheckResult };
  damage_dealt: { result: DamageResult; targetId: string };
  // ... one event per line, typed payload
  npc_memory_written: { npcId: string; event: string; turnNumber: number };
};
```

**New events to add:**
```typescript
quest_started: { questId: string; questTitle: string; turnNumber: number };
quest_stage_advanced: { questId: string; newStageId: string; turnNumber: number };
quest_objective_completed: { questId: string; objectiveId: string };
quest_completed: { questId: string; rewards: unknown };
quest_failed: { questId: string; reason: string };
reputation_changed: { targetId: string; targetType: 'npc' | 'faction'; delta: number; newValue: number };
save_game_requested: { saveName: string | null };
save_game_completed: { filePath: string };
load_game_requested: { saveName: string | null };
load_game_completed: undefined;
```

---

### `src/data/codex/quests.yaml` (data, file-I/O)

**Analog:** `src/data/codex/npcs.yaml` (pattern for codex YAML file structure)

YAML array of entries, each matching the `QuestTemplateSchema` discriminated type. Every entry requires `id`, `name`, `type: quest`, `tags`, `description`, `epistemic`, `quest_type`, `stages`, and `rewards`. Optional: `region`, `required_npc_id`, `min_reputation`.

Structure matches how existing codex files are organized — one YAML file, array root, loaded by `loadCodexFile()` in `loader.ts`. The `loadAllCodex()` function automatically picks up `quests.yaml` once `QuestTemplateSchema` is added to the discriminated union.

---

## Shared Patterns

### Store Creation (applies to ALL new stores)

**Source:** `src/state/create-store.ts` (lines 1-36)
**Apply to:** `quest-store.ts`, `relation-store.ts`

```typescript
import { produce } from 'immer';

export function createStore<T>(initialState: T, onChange?: OnChange<T>): Store<T> {
  let state = initialState;
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    setState: (recipe: (draft: T) => void) => {
      const prev = state;
      const next = produce(prev, recipe);
      if (Object.is(next, prev)) return;
      state = next;
      onChange?.({ newState: next, oldState: prev });
      for (const listener of listeners) listener();
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
```

### Schema Validation with Error Detail

**Source:** `src/state/serializer.ts` (lines 51-57)
**Apply to:** `save-file-manager.ts` (on load), `memory-persistence.ts` (on disk read)

```typescript
const result = SaveDataSchema.safeParse(raw);
if (!result.success) {
  const firstIssue = result.error.issues?.[0];
  const detail = firstIssue
    ? `${firstIssue.path.join('.')} — ${firstIssue.message}`
    : result.error.message;
  throw new Error(`Invalid save data: ${detail}`);
}
```

### Codex Entry Validation Loop

**Source:** `src/codex/loader.ts` (lines 14-33)
**Apply to:** Any new file loading YAML arrays

```typescript
for (let i = 0; i < rawEntries.length; i++) {
  const raw = rawEntries[i];
  const entryId = raw?.id ?? `(index ${i})`;
  const result = CodexEntrySchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Codex file ${filePath}, entry "${entryId}" (index ${i}) validation failed:\n${issues}`);
  }
  validated.push(result.data);
}
```

### Event Bus Subscription (for async side effects)

**Source:** `src/state/npc-memory-store.ts` (lines 28-46)
**Apply to:** `memory-persistence.ts` (subscribe to `npc_memory_written`)

```typescript
import { eventBus } from '../events/event-bus';
eventBus.on('npc_memory_written', ({ npcId, event, turnNumber }) => {
  // fire-and-forget async write — do NOT await in-band
  writeMemoryToDisk(npcId).catch(err => {
    console.error(`[memory-persistence] write failed for ${npcId}:`, err);
  });
});
```

### Ink Panel with Read-Only Display (no keyboard input)

**Source:** `src/ui/panels/scene-panel.tsx` (simpler than dialogue-panel — no `useInput`)
**Apply to:** `journal-panel.tsx` (read-only display, only Esc to close)

Use `useInput` only for the Escape key. All other rendering is pure data mapping using `Box/Text` from `ink`.

---

## No Analog Found

All Phase 3 files have close analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `src/state/`, `src/engine/`, `src/ui/panels/`, `src/ui/screens/`, `src/codex/`, `src/input/`, `src/events/`, `src/persistence/` (new)
**Files scanned:** 17 source files read directly
**Pattern extraction date:** 2026-04-21
