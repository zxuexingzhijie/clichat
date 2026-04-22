# Phase 4: Differentiation - Pattern Map

**Mapped:** 2026-04-22
**Files analyzed:** 28 new/modified files
**Analogs found:** 28 / 28

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/state/branch-store.ts` | store | CRUD | `src/state/quest-store.ts` | exact |
| `src/state/exploration-store.ts` | store | CRUD | `src/state/quest-store.ts` | exact |
| `src/state/player-knowledge-store.ts` | store | CRUD | `src/state/npc-memory-store.ts` | exact |
| `src/persistence/branch-manager.ts` | service | file-I/O | `src/persistence/save-file-manager.ts` | exact |
| `src/persistence/save-migrator.ts` (extend) | service | transform | `src/persistence/save-migrator.ts` | exact (self) |
| `src/state/serializer.ts` (extend) | service | transform | `src/state/serializer.ts` | exact (self) |
| `src/engine/branch-diff.ts` | utility | transform | `src/codex/query.ts` | role-match |
| `src/engine/exploration-tracker.ts` | service | event-driven | `src/persistence/memory-persistence.ts` | exact |
| `src/engine/knowledge-tracker.ts` | service | event-driven | `src/persistence/memory-persistence.ts` | exact |
| `src/ai/utils/context-assembler.ts` (rewrite) | service | transform | `src/ai/utils/context-assembler.ts` | exact (self) |
| `src/ai/utils/npc-knowledge-filter.ts` | utility | transform | `src/codex/query.ts` | role-match |
| `src/ai/utils/epistemic-tagger.ts` | utility | transform | `src/codex/schemas/epistemic.ts` | role-match |
| `src/ui/panels/branch-tree-panel.tsx` | component | request-response | `src/ui/panels/journal-panel.tsx` | exact |
| `src/ui/panels/compare-panel.tsx` | component | request-response | `src/ui/panels/journal-panel.tsx` | exact |
| `src/ui/panels/map-panel.tsx` | component | request-response | `src/ui/panels/journal-panel.tsx` | exact |
| `src/ui/panels/codex-panel.tsx` | component | request-response | `src/ui/panels/journal-panel.tsx` | exact |
| `src/ui/panels/shortcut-help-panel.tsx` | component | request-response | `src/ui/panels/journal-panel.tsx` | exact |
| `src/ui/components/diff-line.tsx` | component | request-response | `src/ui/panels/check-result-line.tsx` | role-match |
| `src/ui/components/map-node.tsx` | component | request-response | `src/ui/panels/check-result-line.tsx` | role-match |
| `src/ui/components/category-tabs.tsx` | component | request-response | `src/ui/panels/actions-panel.tsx` | role-match |
| `src/ui/components/inline-confirm.tsx` | component | request-response | `src/ui/panels/input-area.tsx` | role-match |
| `src/ui/hooks/use-game-input.ts` (extend) | hook | request-response | `src/ui/hooks/use-game-input.ts` | exact (self) |
| `src/ui/hooks/use-tab-completion.ts` | hook | request-response | `src/ui/hooks/use-game-input.ts` | exact |
| `src/input/command-registry.ts` (extend) | config | request-response | `src/input/command-registry.ts` | exact (self) |
| `src/codex/schemas/entry-types.ts` (extend) | model | CRUD | `src/codex/schemas/entry-types.ts` | exact (self) |
| `src/types/game-action.ts` (extend) | model | CRUD | `src/types/game-action.ts` | exact (self) |
| `src/events/event-types.ts` (extend) | model | event-driven | `src/events/event-types.ts` | exact (self) |
| `src/ui/screens/game-screen.tsx` (extend) | component | request-response | `src/ui/screens/game-screen.tsx` | exact (self) |

## Pattern Assignments

### `src/state/branch-store.ts` (store, CRUD)

**Analog:** `src/state/quest-store.ts`

**Imports pattern** (lines 1-5):
```typescript
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';
import { gameStore } from './game-store';
```

**Schema pattern** (lines 7-21):
```typescript
export const QuestProgressSchema = z.object({
  status: z.enum(['unknown', 'active', 'completed', 'failed']),
  currentStageId: z.string().nullable(),
  completedObjectives: z.array(z.string()),
  discoveredClues: z.array(z.string()),
  flags: z.record(z.string(), z.unknown()),
  acceptedAt: z.number().nullable(),
  completedAt: z.number().nullable(),
});
export type QuestProgress = z.infer<typeof QuestProgressSchema>;

export const QuestStateSchema = z.object({
  quests: z.record(z.string(), QuestProgressSchema),
});
export type QuestState = z.infer<typeof QuestStateSchema>;
```

**Default state factory** (lines 40-42):
```typescript
export function getDefaultQuestState(): QuestState {
  return { quests: {} };
}
```

**Store creation with onChange event emission** (lines 67-124):
```typescript
export const questStore = createStore<QuestState>(
  getDefaultQuestState(),
  ({ newState, oldState }) => {
    const turnNumber = gameStore.getState().turnCount;
    for (const questId of Object.keys(newState.quests)) {
      const newProgress = newState.quests[questId]!;
      const oldProgress = oldState.quests[questId];
      if (!oldProgress) {
        if (newProgress.status === 'active') {
          eventBus.emit('quest_started', { questId, questTitle: questId, turnNumber });
        }
        continue;
      }
      // ... state transition event emission
    }
  },
);
```

---

### `src/state/exploration-store.ts` (store, CRUD)

**Analog:** `src/state/quest-store.ts` (same pattern as branch-store)

Copy the same schema-first + createStore + onChange pattern. The exploration store tracks `z.record(z.string(), LocationExplorationSchema)` keyed by locationId, emitting `location_explored` events on level changes.

---

### `src/state/player-knowledge-store.ts` (store, CRUD)

**Analog:** `src/state/npc-memory-store.ts`

**Imports pattern** (lines 1-3):
```typescript
import { z } from 'zod';
import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';
```

**Schema with nested record** (lines 5-32):
```typescript
export const NpcMemoryEntrySchema = z.object({
  id: z.string(),
  npcId: z.string(),
  event: z.string(),
  turnNumber: z.number(),
  importance: z.enum(['low', 'medium', 'high']),
  emotionalValence: z.number().min(-1).max(1),
  participants: z.array(z.string()),
  locationId: z.string().optional(),
});
export type NpcMemoryEntry = z.infer<typeof NpcMemoryEntrySchema>;

export const NpcMemoryStateSchema = z.object({
  memories: z.record(z.string(), NpcMemoryRecordSchema),
});
export type NpcMemoryState = z.infer<typeof NpcMemoryStateSchema>;
```

**Store with length-change detection in onChange** (lines 38-57):
```typescript
export const npcMemoryStore = createStore<NpcMemoryState>(
  getDefaultNpcMemoryState(),
  ({ newState, oldState }) => {
    for (const npcId of Object.keys(newState.memories)) {
      const newLen = newState.memories[npcId]?.recentMemories.length ?? 0;
      const oldLen = oldState.memories[npcId]?.recentMemories.length ?? 0;
      if (newLen > oldLen) {
        const latest = newState.memories[npcId]!.recentMemories[newState.memories[npcId]!.recentMemories.length - 1];
        if (latest) {
          eventBus.emit('npc_memory_written', { npcId, event: latest.event, turnNumber: latest.turnNumber });
        }
      }
    }
  },
);
```

PlayerKnowledgeStore follows this pattern: record keyed by codex entry ID, entries with knowledge status, emit `knowledge_discovered` on new additions.

---

### `src/persistence/branch-manager.ts` (service, file-I/O)

**Analog:** `src/persistence/save-file-manager.ts`

**Imports pattern** (lines 1-5):
```typescript
import envPaths from 'env-paths';
import * as nodeFs from 'node:fs';
import path from 'node:path';
import type { Serializer } from '../state/serializer';
import type { SaveMeta } from '../state/serializer';
```

**Injected fs for testability** (line 13):
```typescript
export const _fs = nodeFs;
```

**Directory ensure pattern** (lines 22-24):
```typescript
export async function ensureSaveDirExists(saveDir: string): Promise<void> {
  _fs.mkdirSync(saveDir, { recursive: true });
}
```

**Name sanitization** (line 40):
```typescript
const safeName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '-');
```

**Path traversal guard** (lines 48-53):
```typescript
const resolvedPath = path.resolve(filePath);
if (saveDir) {
  const resolvedSaveDir = path.resolve(saveDir);
  if (!resolvedPath.startsWith(resolvedSaveDir + path.sep) && resolvedPath !== resolvedSaveDir) {
    throw new Error(`Path traversal detected: ${filePath} is outside save directory`);
  }
}
```

**File read with Bun.file()** (lines 55-57):
```typescript
const file = Bun.file(resolvedPath);
const json = await file.text();
```

**File write with Bun.write()** (line 34):
```typescript
await Bun.write(filePath, json);
```

**List with sort pattern** (lines 60-82):
```typescript
export async function listSaves(saveDir: string): Promise<SaveListEntry[]> {
  const files = _fs.readdirSync(saveDir).filter((f: string) => f.endsWith('.json'));
  const entries: SaveListEntry[] = [];
  for (const fileName of files) {
    const filePath = `${saveDir}/${fileName}`;
    try {
      // ... read + parse + push
    } catch {
      // Skip files that cannot be parsed
    }
  }
  return entries.sort((a, b) =>
    new Date(b.meta.timestamp).getTime() - new Date(a.meta.timestamp).getTime()
  );
}
```

---

### `src/persistence/save-migrator.ts` (extend: add V2->V3 migration)

**Analog:** `src/persistence/save-migrator.ts` (self -- extend existing chain)

**Migration function pattern** (lines 21-38):
```typescript
export function migrateV1ToV2(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const data = raw as Record<string, unknown>;
  if (data['version'] !== 1) return raw;
  return {
    ...data,
    version: 2,
    meta: buildMetaFromV1(data),
    quest: getDefaultQuestState(),
    relations: getDefaultRelationState(),
    npcMemorySnapshot: npcMemory !== undefined && npcMemory !== null ? npcMemory : getDefaultNpcMemoryState(),
    questEventLog: [],
  };
}
```

New `migrateV2ToV3` follows the same guard-and-spread pattern: check `data['version'] !== 2`, return raw if not V2, otherwise spread + add `branchId: 'main'`, `parentSaveId: null`, default branch state.

---

### `src/state/serializer.ts` (extend: V2->V3 schema + new stores)

**Analog:** `src/state/serializer.ts` (self)

**Schema pattern** (lines 30-46):
```typescript
export const SaveDataV2Schema = z.object({
  version: z.literal(2),
  meta: SaveMetaSchema,
  player: PlayerStateSchema,
  scene: SceneStateSchema,
  combat: CombatStateSchema,
  game: GameStateSchema,
  quest: QuestStateSchema,
  relations: RelationStateSchema,
  npcMemorySnapshot: NpcMemoryStateSchema,
  questEventLog: z.array(QuestEventSchema),
  externalRefs: z.object({ worldPack: z.string(), rulesPack: z.string() }).optional(),
});
```

V3 extends with: `branchId: z.string()`, `parentSaveId: z.string().nullable()`, `exploration: ExplorationStateSchema`, `playerKnowledge: PlayerKnowledgeStateSchema`, `turnLog: z.array(TurnLogEntrySchema).optional()`.

**Serializer snapshot/restore pattern** (lines 48-125):
```typescript
export function createSerializer(stores: { ... }, getQuestEventLog: () => QuestEvent[]): Serializer {
  return {
    snapshot(): string {
      const data: SaveDataV3 = { version: 3, meta, /* all stores */ };
      return JSON.stringify(data);
    },
    restore(json: string): void {
      const migrated = migrateV2ToV3(migrateV1ToV2(raw));
      const result = SaveDataV3Schema.safeParse(migrated);
      // ... restore all stores
    },
  };
}
```

---

### `src/engine/branch-diff.ts` (utility, transform)

**Analog:** `src/codex/query.ts`

**Pure function pattern** (lines 4-44):
```typescript
export function queryByType(entries: Map<string, CodexEntry>, type: string): CodexEntry[] {
  const result: CodexEntry[] = [];
  for (const entry of entries.values()) {
    if (entry.type === type) {
      result.push(entry);
    }
  }
  return result;
}

export function queryRelationships(
  edges: readonly RelationshipEdge[],
  filter: RelationshipFilter,
): RelationshipEdge[] {
  return edges.filter((edge) => {
    if (filter.source_id !== undefined && edge.source_id !== filter.source_id) return false;
    // ...
    return true;
  });
}
```

`compareBranches` follows the same pattern: pure function, takes two typed inputs (SaveDataV3), returns `readonly DiffItem[]`. No side effects, no store access.

---

### `src/engine/exploration-tracker.ts` (service, event-driven)

**Analog:** `src/persistence/memory-persistence.ts`

**Event listener init pattern** (lines 76-82):
```typescript
export function initMemoryPersistence(memoryDir: string): void {
  eventBus.on('npc_memory_written', ({ npcId }) => {
    writeMemoryToDisk(npcId, memoryDir).catch(err => {
      console.error(`[memory-persistence] write failed for ${npcId}:`, err);
    });
  });
}
```

`initExplorationTracker` follows the same pattern: `eventBus.on('scene_changed', ...)` -> update ExplorationStore via `explorationStore.setState(...)`.

---

### `src/engine/knowledge-tracker.ts` (service, event-driven)

**Analog:** `src/persistence/memory-persistence.ts` (same pattern as exploration-tracker)

Listens to `dialogue_ended`, `quest_stage_advanced`, `quest_completed`, `scene_changed` events. Updates PlayerKnowledgeStore.

---

### `src/ai/utils/context-assembler.ts` (rewrite: add cognitive envelope)

**Analog:** `src/ai/utils/context-assembler.ts` (self -- extend existing)

**Existing function signatures to preserve** (lines 31-63, 65-82):
```typescript
export function assembleNarrativeContext(
  retrievalPlan: { readonly codexIds: readonly string[]; readonly npcIds: readonly string[] },
  codexEntries: Map<string, CodexEntry>,
  npcMemories: readonly NpcMemory[],
  sceneState: SceneState,
  action: string,
  checkResult?: { readonly display: string },
): AssembledContext { ... }

export function assembleNpcContext(
  npcProfile: NpcProfile,
  memories: readonly NpcMemory[],
  sceneDescription: string,
  playerAction: string,
): NpcContext { ... }
```

**Extension strategy:** Add new `assembleFilteredNpcContext` that wraps `assembleNpcContext` with NPC Knowledge Filter. Keep existing functions backward-compatible. Add `CognitiveContextEnvelope` type and `buildCognitiveEnvelope` function.

---

### `src/ai/utils/npc-knowledge-filter.ts` (utility, transform)

**Analog:** `src/codex/query.ts`

Same pure-function-with-filter pattern. Takes codex entries + NPC profile + epistemic metadata, returns filtered entries. Six-dimension filter uses the established `EpistemicMetadataSchema` fields (`known_by`, `visibility`, `authority`, `truth_status`).

---

### `src/ai/utils/epistemic-tagger.ts` (utility, transform)

**Analog:** `src/codex/schemas/epistemic.ts`

Uses the existing `EpistemicMetadataSchema` types. Pure function: takes context chunks + epistemic metadata, returns `TaggedContextChunk[]` with epistemic level labels.

---

### `src/ui/panels/branch-tree-panel.tsx` (component, request-response)

**Analog:** `src/ui/panels/journal-panel.tsx`

**Imports pattern** (lines 1-5):
```typescript
import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
```

**Props type pattern** (lines 11-16):
```typescript
type JournalPanelProps = {
  readonly activeQuests: readonly QuestDisplayEntry[];
  readonly completedQuests: readonly QuestDisplayEntry[];
  readonly failedQuests: readonly QuestDisplayEntry[];
  readonly onClose: () => void;
};
```

**useInput for Esc close** (lines 45-47):
```typescript
useInput(useCallback((_input: string, key: { escape: boolean }) => {
  if (key.escape) onClose();
}, [onClose]));
```

**Panel layout with Chinese headers** (lines 49-71):
```typescript
return (
  <Box flexDirection="column" flexGrow={1} paddingX={1}>
    <Box flexDirection="row" justifyContent="space-between">
      <Text bold color="cyan">【任务日志】</Text>
    </Box>
    <Text> </Text>
    <Text bold color="yellow">进行中</Text>
    {/* ... sections with dimColor for empty state */}
    <Text dimColor>Esc 关闭日志</Text>
  </Box>
);
```

All 5 new panels (BranchTreePanel, ComparePanel, MapPanel, CodexPanel, ShortcutHelpPanel) follow this exact structure.

---

### `src/ui/panels/compare-panel.tsx` (component, request-response)

**Analog:** `src/ui/panels/journal-panel.tsx` (same as branch-tree-panel)

Additionally uses diff-line sub-component for `+`/`-`/`~`/`!` styled lines.

---

### `src/ui/panels/map-panel.tsx` (component, request-response)

**Analog:** `src/ui/panels/journal-panel.tsx` (same structure)

Uses `useScreenSize` from `fullscreen-ink` for adaptive layout (wide = map + detail, narrow = map only with detail on select).

---

### `src/ui/panels/codex-panel.tsx` (component, request-response)

**Analog:** `src/ui/panels/journal-panel.tsx` (same structure)

Additionally uses `TextInput` from `@inkjs/ui` for search. Uses `useScreenSize` for two-column (wide) vs single-column (narrow).

---

### `src/ui/panels/shortcut-help-panel.tsx` (component, request-response)

**Analog:** `src/ui/panels/journal-panel.tsx` (simplest variant -- static content + Esc close)

---

### `src/ui/hooks/use-game-input.ts` (extend: add panel shortcuts)

**Analog:** `src/ui/hooks/use-game-input.ts` (self)

**Current hook structure** (lines 1-26):
```typescript
import { useState, useCallback } from 'react';

export type InputMode = 'action_select' | 'input_active' | 'processing';

type UseGameInputReturn = {
  readonly inputMode: InputMode;
  readonly setInputMode: (mode: InputMode) => void;
  readonly selectedActionIndex: number;
  readonly setSelectedActionIndex: (index: number) => void;
  readonly isTyping: boolean;
};

export function useGameInput(): UseGameInputReturn {
  const [inputMode, setInputMode] = useState<InputMode>('action_select');
  const [selectedActionIndex, setSelectedActionIndex] = useState(0);
  const isTyping = inputMode === 'input_active';
  return { inputMode, setInputMode, selectedActionIndex, setSelectedActionIndex, isTyping };
}
```

Extend with: `activePanel` state, single-key handler guarded by `!isTyping`, panel switching logic.

---

### `src/ui/hooks/use-tab-completion.ts` (hook, request-response)

**Analog:** `src/ui/hooks/use-game-input.ts`

Same hook pattern: `useState` + `useCallback`, return readonly object. Takes completion candidates as input, manages completion state.

---

### `src/input/command-registry.ts` (extend: add 5+ new commands)

**Analog:** `src/input/command-registry.ts` (self)

**Command registration pattern** (lines 8-13):
```typescript
program
  .command('look')
  .argument('[target]', 'what to look at')
  .action((target?: string) => {
    setResult({ type: 'look', target: target ?? null, modifiers: {}, source: 'command' });
  });
```

**Subcommand with action argument** (lines 108-119):
```typescript
program
  .command('quest')
  .argument('<action>', 'accept|list|abandon')
  .argument('[id]', 'quest id')
  .action((action: string, id?: string) => {
    setResult({
      type: 'quest',
      target: action,
      modifiers: id ? { id } : {},
      source: 'command',
    });
  });
```

New commands `/branch`, `/compare`, `/map`, `/codex`, `/replay` follow the `quest` pattern (action + optional args).

---

### `src/types/game-action.ts` (extend: add action types)

**Analog:** `src/types/game-action.ts` (self)

**Enum extension pattern** (lines 3-7):
```typescript
export const GameActionTypeSchema = z.enum([
  'move', 'look', 'talk', 'attack', 'use_item',
  'cast', 'guard', 'flee', 'inspect', 'trade',
  'help', 'save', 'load', 'journal', 'quest', 'unknown',
]);
```

Add: `'branch'`, `'compare'`, `'map'`, `'codex'`, `'replay'`.

---

### `src/events/event-types.ts` (extend: add domain events)

**Analog:** `src/events/event-types.ts` (self)

**Event type declaration pattern** (lines 4-52):
```typescript
export type DomainEvents = {
  scene_changed: { sceneId: string; previousSceneId: string | null };
  quest_started: { questId: string; questTitle: string; turnNumber: number };
  reputation_changed: { targetId: string; targetType: 'npc' | 'faction'; delta: number; newValue: number };
  // ...
};
```

Add: `branch_created`, `branch_switched`, `branch_deleted`, `knowledge_discovered`, `location_explored`, `location_discovery_level_changed`.

---

### `src/codex/schemas/entry-types.ts` (extend: LocationSchema)

**Analog:** `src/codex/schemas/entry-types.ts` (self)

**Current LocationSchema** (lines 28-36):
```typescript
export const LocationSchema = z.object({
  ...baseFields,
  type: z.literal("location"),
  region: z.string(),
  danger_level: z.number().min(0).max(10),
  exits: z.array(z.string()),
  notable_npcs: z.array(z.string()),
  objects: z.array(z.string()),
});
```

Extend `exits` to `z.array(z.union([z.string(), SpatialExitSchema]))` for backward compatibility. Add optional `coordinates: z.object({ x: z.number(), y: z.number() }).optional()` and `map_icon: z.string().optional()`.

---

### `src/ui/screens/game-screen.tsx` (extend: add panel slot entries)

**Analog:** `src/ui/screens/game-screen.tsx` (self)

**Panel slot replacement pattern** (lines 203-229):
```typescript
const scenePanelNode = isInCombat
  ? combatSceneContent
  : isInDialogueMode
    ? <DialoguePanel ... />
    : isInJournal
      ? <JournalPanel ... />
      : <ScenePanel lines={sceneLines} />;
```

**Phase boolean derivation** (lines 69-72):
```typescript
const isInCombat = combatState.active;
const isInDialogueMode = dialogueState.active && dialogueState.mode === 'full';
const isInJournal = gameState.phase === 'journal';
const isWide = width >= 100;
```

**Wide/narrow adaptive layout** (lines 231-294):
```typescript
if (isWide) {
  const sceneWidth = Math.floor(innerWidth * 0.6);
  const actionsWidth = innerWidth - sceneWidth - 1;
  return (
    <Box flexDirection="column" width={width} height={height} borderStyle="single">
      <TitleBar ... />
      <Divider width={innerWidth} />
      <Box flexGrow={1}>
        <Box width={sceneWidth} flexDirection="column">{scenePanelNode}</Box>
        <Text>{'|'}</Text>
        <Box width={actionsWidth} flexDirection="column">{actionsNode}</Box>
      </Box>
      {/* ... */}
    </Box>
  );
}
```

Add `isInMap`, `isInCodex`, `isInBranchTree`, `isInCompare` booleans and extend the ternary chain.

---

## Shared Patterns

### Store Creation (createStore + immer + eventBus)
**Source:** `src/state/create-store.ts` (lines 1-36)
**Apply to:** `branch-store.ts`, `exploration-store.ts`, `player-knowledge-store.ts`
```typescript
import { produce } from 'immer';

type Listener = () => void;
type OnChange<T> = (args: { newState: T; oldState: T }) => void;

export type Store<T> = {
  getState: () => T;
  setState: (recipe: (draft: T) => void) => void;
  subscribe: (listener: Listener) => () => void;
};

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

### Event Bus Usage
**Source:** `src/events/event-bus.ts` (lines 1-4) + `src/events/event-types.ts`
**Apply to:** All stores (onChange emission), all trackers (event subscription)
```typescript
import mitt from 'mitt';
import type { DomainEvents } from './event-types';
export const eventBus = mitt<DomainEvents>();
```

### Event Listener Init Pattern
**Source:** `src/persistence/memory-persistence.ts` (lines 76-82)
**Apply to:** `exploration-tracker.ts`, `knowledge-tracker.ts`
```typescript
export function initExplorationTracker(): void {
  eventBus.on('scene_changed', ({ sceneId }) => {
    // update ExplorationStore
  });
}
```

### Zod Schema + Type Export
**Source:** All schema files
**Apply to:** All new schemas (BranchMeta, ExplorationState, PlayerKnowledge, SaveDataV3, SpatialExit, DiffItem, TurnLogEntry, CognitiveContextEnvelope)
```typescript
export const FooSchema = z.object({ ... });
export type Foo = z.infer<typeof FooSchema>;
```

### Panel Component Structure
**Source:** `src/ui/panels/journal-panel.tsx` (lines 1-71)
**Apply to:** All 5 new panels
```typescript
import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

type FooPanelProps = {
  readonly data: readonly FooItem[];
  readonly onClose: () => void;
};

export function FooPanel({ data, onClose }: FooPanelProps): React.ReactNode {
  useInput(useCallback((_input: string, key: { escape: boolean }) => {
    if (key.escape) onClose();
  }, [onClose]));

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Text bold color="cyan">【面板标题】</Text>
      {/* ... content sections */}
      <Text dimColor>Esc 关闭</Text>
    </Box>
  );
}
```

### Command Registration
**Source:** `src/input/command-registry.ts` (lines 108-119)
**Apply to:** New `/branch`, `/compare`, `/map`, `/codex`, `/replay` commands
```typescript
program
  .command('branch')
  .argument('[action]', 'create|switch|tree|delete')
  .argument('[name]', 'branch name')
  .action((action?: string, name?: string) => {
    setResult({
      type: 'branch',
      target: action ?? 'tree',
      modifiers: name ? { name } : {},
      source: 'command',
    });
  });
```

### File I/O Safety
**Source:** `src/persistence/save-file-manager.ts` (lines 38-57)
**Apply to:** `branch-manager.ts` (branches.json read/write)
- Sanitize names: `name.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '-')`
- Path traversal guard: resolve + startsWith check
- Injected `_fs` for testability
- `Bun.write()` / `Bun.file()` for I/O

### Test Structure
**Source:** `src/state/quest-store.test.ts` (lines 1-332) + `src/persistence/save-migrator.test.ts` (lines 1-85)
**Apply to:** All new test files
```typescript
import { describe, test, expect, beforeEach, mock } from 'bun:test';

describe('SchemaName', () => {
  test('validates a correct object', () => {
    const parsed = Schema.parse(validInput);
    expect(parsed.field).toBe(expected);
  });
  test('rejects invalid input', () => {
    expect(() => Schema.parse(invalidInput)).toThrow();
  });
});

describe('storeName', () => {
  beforeEach(() => {
    store.setState(() => getDefaultState());
  });
  test('getState() returns default', () => { ... });
  test('emits event on state change', () => {
    const handler = mock(() => {});
    eventBus.on('event_name', handler);
    store.setState(draft => { /* mutate */ });
    expect(handler).toHaveBeenCalledTimes(1);
    eventBus.off('event_name', handler);
  });
});
```

### Migration Test Structure
**Source:** `src/persistence/save-migrator.test.ts` (lines 1-85)
**Apply to:** V2->V3 migration tests
```typescript
const validV2 = { version: 2, /* ... full valid V2 object */ };

describe('migrateV2ToV3', () => {
  it('returns object with version: 3 for valid v2 input', () => {
    const result = migrateV2ToV3(validV2) as Record<string, unknown>;
    expect(result['version']).toBe(3);
  });
  it('injects default branch fields', () => { ... });
  it('returns non-v2 object unchanged (identity)', () => { ... });
  it('returns null input unchanged', () => { ... });
});
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | -- | -- | All files have strong analogs in the existing codebase |

Every new file maps to an established pattern. The codebase from Phases 1-3 provides comprehensive coverage for stores, services, UI panels, event listeners, pure utility functions, schemas, hooks, commands, and migrations.

## Metadata

**Analog search scope:** `src/state/`, `src/persistence/`, `src/engine/`, `src/ai/`, `src/ui/`, `src/input/`, `src/codex/`, `src/events/`, `src/types/`
**Files scanned:** 12 analog files read in full
**Pattern extraction date:** 2026-04-22
