# Phase 5: Polish & Optimization - Pattern Map

**Mapped:** 2026-04-22
**Files analyzed:** 10 new/modified files
**Analogs found:** 9 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/ai/config/ai-config-loader.ts` | utility | file-I/O + transform | `src/codex/loader.ts` | exact |
| `src/ai/config/ai-config-schema.ts` | config | transform | `src/codex/schemas/entry-types.ts` | role-match |
| `src/ai/providers.ts` (modify) | config | request-response | `src/ai/providers.ts` (self) | self |
| `src/state/cost-session-store.ts` | store | event-driven | `src/state/branch-store.ts` | exact |
| `src/ai/summarizer/summarizer-queue.ts` | store | event-driven | `src/state/quest-store.ts` | exact |
| `src/ai/roles/memory-summarizer.ts` | service | request-response | `src/ai/roles/narrative-director.ts` | exact |
| `src/state/serializer.ts` (modify) | utility | transform | `src/state/serializer.ts` (self) | self |
| `src/ui/screens/game-screen.tsx` (modify) | component | event-driven | `src/ui/screens/game-screen.tsx` (self) | self |
| `src/ui/panels/replay-panel.tsx` | component | request-response | `src/ui/panels/codex-panel.tsx` | exact |
| `src/input/command-registry.ts` (modify) | utility | request-response | `src/input/command-registry.ts` (self) | self |
| `src/game-loop.ts` (modify) | controller | request-response | `src/game-loop.ts` (self) | self |
| `ai-config.yaml` | config | file-I/O | none | no analog |

---

## Pattern Assignments

### `src/ai/config/ai-config-loader.ts` (utility, file-I/O)

**Analog:** `src/codex/loader.ts`

**Imports pattern** (lines 1-3):
```typescript
import { parse as parseYaml } from 'yaml';
import { AiConfigSchema, type AiConfig } from './ai-config-schema';
```

**Core pattern** (lines 5-17 of `src/codex/loader.ts`):
```typescript
export async function loadAiConfig(configPath: string): Promise<AiConfig> {
  const file = Bun.file(configPath);
  const text = await file.text();
  const parsed = parseYaml(text);
  const result = AiConfigSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`ai-config.yaml validation failed:\n${issues}`);
  }

  return result.data;
}
```

**Key difference from codex/loader.ts:** ai-config.yaml is a single object (not an array), so no loop over entries. Use `AiConfigSchema.safeParse(parsed)` directly (not per-item).

**Error handling pattern** (lines 20-27 of `src/codex/loader.ts`):
```typescript
if (!result.success) {
  const issues = result.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Codex file ${filePath}, entry "${entryId}" (index ${i}) validation failed:\n${issues}`
  );
}
```

---

### `src/ai/config/ai-config-schema.ts` (config, transform)

**Analog:** `src/codex/schemas/entry-types.ts` (Zod schema definition style)

**Imports pattern** (lines 1-2 of `src/codex/schemas/entry-types.ts`):
```typescript
import { z } from "zod";
```

**Core Zod schema pattern** (lines 4-18 of `src/codex/schemas/entry-types.ts`):
```typescript
const baseFields = {
  id: z.string().min(1),
  name: z.string(),
  // ...
};

export const SomeSchema = z.object({
  ...baseFields,
  type: z.literal("value"),
  optionalField: z.string().optional(),
});
export type SomeType = z.infer<typeof SomeSchema>;
```

**Schema design for ai-config.yaml** (from RESEARCH.md Pattern 1):
```typescript
export const ModelPricingSchema = z.object({
  price_per_1k_input_tokens: z.number().optional(),
  price_per_1k_output_tokens: z.number().optional(),
});

export const RoleConfigEntrySchema = z.object({
  provider: z.string(),
  model: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  pricing: ModelPricingSchema.optional(),
});

export const ProfileSchema = z.object({
  roles: z.record(z.string(), RoleConfigEntrySchema),
});

export const AiConfigSchema = z.object({
  default_profile: z.string().default('balanced'),
  profiles: z.record(z.string(), ProfileSchema),
});

export type AiConfig = z.infer<typeof AiConfigSchema>;
```

---

### `src/ai/providers.ts` (modify existing, config, request-response)

**Self-analog:** `src/ai/providers.ts` lines 1-57

**Current structure to extend** (lines 1-53):
```typescript
import type { LanguageModel } from 'ai';
import { google } from '@ai-sdk/google';

export type AiRole = 'narrative-director' | 'npc-actor' | 'retrieval-planner' | 'safety-filter' | 'summarizer' | 'quest-planner';

export type RoleConfig = {
  readonly model: () => LanguageModel;
  readonly temperature: number;
  readonly maxTokens: number;
};

const ROLE_CONFIGS: Record<AiRole, RoleConfig> = { ... };

export function getRoleConfig(role: AiRole): RoleConfig {
  return ROLE_CONFIGS[role];
}
```

**Extension pattern** — add `pricing` to `RoleConfig` and add `buildRoleConfigs()`:
```typescript
export type RoleConfig = {
  readonly model: () => LanguageModel;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly pricing?: { readonly price_per_1k_input_tokens?: number; readonly price_per_1k_output_tokens?: number };
};

const PROVIDER_FACTORIES: Record<string, (modelId: string) => LanguageModel> = {
  google: (id) => google(id),
  // add openai, anthropic, alibaba, deepseek when installed
};

export function buildRoleConfigs(config: AiConfig, profile: string): Record<AiRole, RoleConfig> {
  const profileData = config.profiles[profile] ?? config.profiles[config.default_profile]!;
  return Object.fromEntries(
    (Object.keys(ROLE_CONFIGS) as AiRole[]).map((role) => {
      const entry = profileData.roles[role] ?? /* fallback to defaults */;
      const factory = PROVIDER_FACTORIES[entry.provider];
      if (!factory) throw new Error(`Unknown provider: ${entry.provider}`);
      return [role, { model: () => factory(entry.model), temperature: entry.temperature ?? ROLE_CONFIGS[role].temperature, maxTokens: entry.maxTokens ?? ROLE_CONFIGS[role].maxTokens, pricing: entry.pricing }];
    }),
  ) as Record<AiRole, RoleConfig>;
}
```

`getRoleConfig()` becomes a lookup against a runtime-built map (initialized at app startup via `buildRoleConfigs()`).

---

### `src/state/cost-session-store.ts` (store, event-driven)

**Analog:** `src/state/branch-store.ts` (createStore + eventBus emission on change)

**Imports pattern** (lines 1-3 of `src/state/branch-store.ts`):
```typescript
import { z } from 'zod';
import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';
```

**createStore with onChange event emission** (lines 39-70 of `src/state/branch-store.ts`):
```typescript
export const branchStore = createStore<BranchState>(
  getDefaultBranchState(),
  ({ newState, oldState }) => {
    // diff newState vs oldState, emit events for changed fields
    if (newState.someField !== oldState.someField) {
      eventBus.emit('some_event', { ... });
    }
  },
);
```

**Cost store pattern** (from RESEARCH.md Pattern — Cost Session Store):
```typescript
import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';
import type { AiRole } from '../ai/providers';

export type RoleCostEntry = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCost: number;
};

export type CostSessionState = {
  readonly byRole: Partial<Record<AiRole, RoleCostEntry>>;
  readonly lastTurnTokens: number;
};

function getDefaultCostSessionState(): CostSessionState {
  return { byRole: {}, lastTurnTokens: 0 };
}

export const costSessionStore = createStore<CostSessionState>(
  getDefaultCostSessionState(),
  ({ newState }) => {
    eventBus.emit('token_usage_updated', { lastTurnTokens: newState.lastTurnTokens });
  },
);
```

**Note:** `token_usage_updated` must be added to `DomainEvents` in `src/events/event-types.ts`.

**Note:** Cost store is ephemeral — NOT serialized in SaveData. Subscribe to `state_restored` on `eventBus` to reset all counters to zero on game load (see RESEARCH.md Pitfall 5).

---

### `src/ai/summarizer/summarizer-queue.ts` (store, event-driven)

**Analog:** `src/state/quest-store.ts` (createStore + Zod schemas + event log pattern)

**Imports pattern** (lines 1-5 of `src/state/quest-store.ts`):
```typescript
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';
import { gameStore } from './game-store';
```

**Zod + createStore pattern** (lines 7-124 of `src/state/quest-store.ts`):
```typescript
export const SomeEntrySchema = z.object({
  id: z.string(),
  type: z.enum(['type_a', 'type_b']),
  // ...
});
export type SomeEntry = z.infer<typeof SomeEntrySchema>;

export const SomeStateSchema = z.object({
  items: z.array(SomeEntrySchema),
  isRunning: z.boolean(),
});

export function getDefaultState(): SomeState {
  return { items: [], isRunning: false };
}

export const someStore = createStore<SomeState>(
  getDefaultState(),
  ({ newState, oldState }) => {
    // emit events based on diffs
  },
);
```

**Append-to-immutable-array pattern** (lines 46-57 of `src/state/quest-store.ts`):
```typescript
export let questEventLog: QuestEvent[] = [];

export function appendQuestEvent(event: Omit<QuestEvent, 'id' | 'timestamp'>): void {
  questEventLog = [
    ...questEventLog,
    {
      ...event,
      id: nanoid(),
      timestamp: new Date().toISOString(),
    },
  ];
}
```

**SummarizerQueue task type** (from RESEARCH.md Pattern 5):
```typescript
export type SummarizerTask = {
  readonly id: string;
  readonly type: 'chapter_summary' | 'npc_memory_compress' | 'turn_log_compress';
  readonly targetId: string;
  readonly entryIds: readonly string[];
  readonly baseVersion: number;
  readonly priority: 1 | 2 | 3;
  readonly triggerReason: string;
  readonly createdAt: string;
  readonly status: 'pending' | 'running' | 'done' | 'failed';
};
```

---

### `src/ai/roles/memory-summarizer.ts` (service, request-response)

**Analog:** `src/ai/roles/narrative-director.ts` (exact role structure)

**Imports pattern** (lines 1-9 of `src/ai/roles/narrative-director.ts`):
```typescript
import { generateText, streamText } from 'ai';
import { getRoleConfig } from '../providers';
import {
  buildNarrativeSystemPrompt,
  buildNarrativeUserPrompt,
  type SceneType,
  type NarrativeUserPromptContext,
} from '../prompts/narrative-system';
import { getFallbackNarration } from '../utils/fallback';
```

**generateText pattern with retry** (lines 56-88 of `src/ai/roles/narrative-director.ts`):
```typescript
export async function generateNarration(
  context: NarrativeContext,
  options?: NarrativeOptions,
): Promise<string> {
  const config = getRoleConfig('narrative-director');
  const maxRetries = options?.maxRetries ?? 2;
  const system = buildNarrativeSystemPrompt(context.sceneType);
  const prompt = buildNarrativeUserPrompt(context as NarrativeUserPromptContext);
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { text } = await generateText({
        model: config.model(),
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        system,
        prompt,
      });
      // validate output
      return text;
    } catch (err) {
      lastError = err;
    }
  }

  return fallbackResult;
}
```

**Difference for memory-summarizer:** use `getRoleConfig('summarizer')`, no streaming needed (background task), and capture `usage` from `generateText` for cost tracking:

```typescript
const { text, usage } = await generateText({
  model: config.model(),
  temperature: config.temperature,
  maxTokens: config.maxTokens,
  system,
  prompt,
});
// usage.inputTokens, usage.outputTokens
costSessionStore.record('summarizer', usage);
```

---

### `src/state/serializer.ts` (modify existing, utility, transform)

**Self-analog:** `src/state/serializer.ts` lines 1-175

**SaveDataV3 → SaveDataV4 extension pattern** (lines 60-81):
```typescript
export const SaveDataV3Schema = z.object({
  version: z.literal(3),
  meta: SaveMetaSchema,
  branchId: z.string(),
  // ... existing fields
  turnLog: z.array(TurnLogEntrySchema),
  externalRefs: z.object({ ... }).optional(),
});
```

New SaveDataV4 adds:
- `npcDialogue?: readonly string[]` to `TurnLogEntrySchema` (extend in-place with `.optional()`)
- `version: z.number().int().default(0)` to `NpcMemoryRecordSchema` in `src/state/npc-memory-store.ts` (for atomic write-back)

**Migration pattern** (lines 145-148):
```typescript
const migrated = migrateV2ToV3(migrateV1ToV2(raw));
const result = SaveDataV3Schema.safeParse(migrated);
```

Add `migrateV3ToV4()` to `src/persistence/save-migrator.ts` and chain it here.

**restore() store hydration pattern** (lines 157-166):
```typescript
stores.player.setState(draft => { Object.assign(draft, data.player); });
stores.scene.setState(draft => { Object.assign(draft, data.scene); });
// ... etc for each store
```

---

### `src/ui/panels/replay-panel.tsx` (component, request-response)

**Analog:** `src/ui/panels/codex-panel.tsx` (exact: useInput + offset navigation + wide/narrow layout + onClose)

**Imports pattern** (lines 1-7 of `src/ui/panels/codex-panel.tsx`):
```typescript
import React, { useCallback, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useScreenSize } from 'fullscreen-ink';
```

**useInput keyboard navigation pattern** (lines 151-239 of `src/ui/panels/codex-panel.tsx`):
```typescript
useInput(useCallback((input: string, key: {
  upArrow: boolean;
  downArrow: boolean;
  escape: boolean;
  return: boolean;
  tab: boolean;
}) => {
  if (key.escape) { onClose(); return; }
  if (key.upArrow) { setSelectedIndex(prev => Math.max(0, prev - 1)); }
  if (key.downArrow) { setSelectedIndex(prev => Math.min(items.length - 1, prev + 1)); }
}, [onClose, items.length]));
```

**PgUp/PgDn extension** (from RESEARCH.md Pattern 6, Option B):
```typescript
const PAGE_SIZE = 5;
useInput(useCallback((input: string, key) => {
  if (key.escape) { onClose(); return; }
  if (key.upArrow || input === 'p') setOffset(o => Math.max(0, o - 1));
  if (key.downArrow || input === 'n') setOffset(o => Math.min(entries.length - 1, o + 1));
  if (key.pageUp) setOffset(o => Math.max(0, o - PAGE_SIZE));
  if (key.pageDown) setOffset(o => Math.min(entries.length - 1, o + PAGE_SIZE));
}, [onClose, entries.length]));
```

**Two-pane wide/narrow layout pattern** (lines 315-373 of `src/ui/panels/codex-panel.tsx`):
```typescript
const { width } = useScreenSize();
const isWide = width >= 100;

if (isWide) {
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="cyan">{'【标题】'}</Text>
        <Text dimColor>Esc 返回</Text>
      </Box>
      <Box flexGrow={1} marginTop={1}>
        <Box flexDirection="column" width="40%">
          {listContent}
        </Box>
        <Text>{'│'}</Text>
        <Box flexDirection="column" width="60%" paddingLeft={1}>
          {detailContent}
        </Box>
      </Box>
      <Text dimColor>{'↑↓/p/n 选择  PgUp/PgDn 翻页  Esc 返回'}</Text>
    </Box>
  );
}
// narrow: stack vertically
```

**Entry list highlight pattern** (lines 270-291 of `src/ui/panels/codex-panel.tsx`):
```typescript
{filteredEntries.map((entry, i) => {
  const isSelected = i === selectedIndex;
  return (
    <Box key={entry.id} flexDirection="row" justifyContent="space-between">
      <Text bold={isSelected} color={isSelected ? 'cyan' : undefined}>
        {isSelected ? '❯ ' : '  '}{entry.name}
      </Text>
    </Box>
  );
})}
```

**Props type pattern** (lines 22-25 of `src/ui/panels/codex-panel.tsx`):
```typescript
type ReplayPanelProps = {
  readonly entries: readonly TurnLogEntry[];
  readonly onClose: () => void;
};
```

---

### `src/ui/screens/game-screen.tsx` (modify existing, component, event-driven)

**Self-analog:** `src/ui/screens/game-screen.tsx` lines 1-383

**Panel integration pattern** — how existing panels are wired in (lines 96-102, 284-317):
```typescript
const isInCodex = gameState.phase === 'codex';
const isInReplay = gameState.phase === 'replay';  // new

// In scenePanelNode chain:
: isInCodex && codexEntries
  ? <CodexPanel entries={codexEntries} onClose={handlePanelClose} />
  : isInReplay && replayEntries
    ? <ReplayPanel entries={replayEntries} onClose={handlePanelClose} />
    : <ScenePanel lines={sceneLines} />;
```

**handlePanelClose pattern** (lines 162-164):
```typescript
const handlePanelClose = useCallback(() => {
  gameStore.setState(draft => { draft.phase = 'game'; });
}, []);
```

**StatusBar token display** — add `lastTurnTokens` prop to `StatusBar`:
```typescript
// Existing StatusBar field addition pattern (lines 52-68):
if (width >= 45) {
  fields.push(<Text key="gold">  Gold {gold}</Text>);
}
if (width >= 85) {
  fields.push(<Text key="tokens" dimColor>  Tokens {lastTurnTokens}</Text>);
}
```

**GamePhaseSchema** must be extended in `src/state/game-store.ts` (line 6) to include `'replay'` and `'cost'` phases.

---

### `src/input/command-registry.ts` (modify existing, utility, request-response)

**Self-analog:** `src/input/command-registry.ts` lines 1-175

**Command registration pattern** (lines 163-174):
```typescript
program
  .command('replay')
  .argument('[count]', 'number of turns to replay')
  .action((count?: string) => {
    setResult({
      type: 'replay',
      target: count ?? '10',
      modifiers: {},
      source: 'command',
    });
  });
```

**Note:** `replay` command is already registered (lines 164-174). Only `cost` needs to be added following the same pattern.

**New `/cost` command:**
```typescript
program
  .command('cost')
  .action(() => {
    setResult({ type: 'cost', target: null, modifiers: {}, source: 'command' });
  });
```

`GameAction` type in `src/types/game-action.ts` must add `'cost'` and `'replay'` (if not already present) to the action type union.

---

### `src/game-loop.ts` (modify existing, controller, request-response)

**Self-analog:** `src/game-loop.ts` lines 1-320

**Action routing pattern** (lines 102-261):
```typescript
if (action.type === 'codex') {
  gameStore.setState(draft => { draft.phase = 'codex'; });
  return { status: 'action_executed', action, narration: [] };
}

if (action.type === 'replay') {
  const count = parseInt(action.target ?? '10', 10);
  if (!turnLog) return { status: 'error', message: '回放系统未初始化' };
  const entries = turnLog.replayTurns(isNaN(count) ? 10 : count);
  const lines = entries.flatMap(e => [`[回合 ${e.turnNumber}] ${e.action}`, ...e.narrationLines]);
  return { status: 'action_executed', action, narration: lines };
}
```

**`/replay` modification** — current implementation (lines 256-262) returns flat narration lines. Phase 5 changes it to set `gameState.phase = 'replay'` and pass entries to the UI panel instead:
```typescript
if (action.type === 'replay') {
  const count = parseInt(action.target ?? '10', 10);
  if (!turnLog) return { status: 'error', message: '回放系统未初始化' };
  gameStore.setState(draft => { draft.phase = 'replay'; });
  // store replay entries for panel to read via a dedicated store or prop
  return { status: 'action_executed', action, narration: [] };
}
```

**`/cost` routing** (new, following same pattern):
```typescript
if (action.type === 'cost') {
  const summary = costSessionStore.getSummary();
  return { status: 'action_executed', action, narration: formatCostSummary(summary) };
}
```

**Token counting wiring** — after each AI call in processInput, forward `usage` to cost store via `costSessionStore.setState(draft => { ... })`. This happens inside AI role call sites (narrative-director, npc-actor), not inside game-loop directly.

---

## Shared Patterns

### createStore + immer
**Source:** `src/state/create-store.ts` lines 1-36
**Apply to:** `src/state/cost-session-store.ts`, `src/ai/summarizer/summarizer-queue.ts`

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

### eventBus emission in store onChange
**Source:** `src/state/quest-store.ts` lines 67-124, `src/state/branch-store.ts` lines 39-70
**Apply to:** `src/state/cost-session-store.ts`

```typescript
import { eventBus } from '../events/event-bus';

export const someStore = createStore<SomeState>(
  getDefaultState(),
  ({ newState, oldState }) => {
    if (newState.relevantField !== oldState.relevantField) {
      eventBus.emit('some_event', { data: newState.relevantField });
    }
  },
);
```

### Zod schema + safeParse error formatting
**Source:** `src/codex/loader.ts` lines 17-29
**Apply to:** `src/ai/config/ai-config-loader.ts`

```typescript
const result = SomeSchema.safeParse(raw);
if (!result.success) {
  const issues = result.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Validation failed:\n${issues}`);
}
```

### useInput + ESC close + arrow navigation in panel
**Source:** `src/ui/panels/codex-panel.tsx` lines 151-239
**Apply to:** `src/ui/panels/replay-panel.tsx`

```typescript
useInput(useCallback((input: string, key) => {
  if (key.escape) { onClose(); return; }
  if (key.upArrow) setSelectedIndex(prev => Math.max(0, prev - 1));
  if (key.downArrow) setSelectedIndex(prev => Math.min(items.length - 1, prev + 1));
}, [onClose, items.length]));
```

### Bun.file() async YAML read
**Source:** `src/codex/loader.ts` lines 5-8
**Apply to:** `src/ai/config/ai-config-loader.ts`

```typescript
const file = Bun.file(configPath);
const text = await file.text();
const parsed = parseYaml(text);
```

### generateText with getRoleConfig
**Source:** `src/ai/roles/narrative-director.ts` lines 28-52
**Apply to:** `src/ai/roles/memory-summarizer.ts`

```typescript
const config = getRoleConfig('summarizer');
const { text, usage } = await generateText({
  model: config.model(),
  temperature: config.temperature,
  maxTokens: config.maxTokens,
  system,
  prompt,
});
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `ai-config.yaml` | config | file-I/O | No YAML config files at project root yet (codex YAMLs are world data, not app config) |

---

## Schema Extension Notes

The following existing files need schema additions (plan must include these as explicit tasks):

| File | Field to Add | Reason |
|------|-------------|--------|
| `src/state/npc-memory-store.ts` | `version: z.number().int().default(0)` on `NpcMemoryRecordSchema` | Atomic write-back requires version stamping (RESEARCH.md Pitfall 1) |
| `src/state/serializer.ts` | `npcDialogue?: z.array(z.string())` on `TurnLogEntrySchema` | D-08 requires NPC dialogue in replay (RESEARCH.md Pitfall 6, verify first at A2) |
| `src/state/game-store.ts` | `'replay' \| 'cost'` added to `GamePhaseSchema` z.enum | New phases for UI routing |
| `src/events/event-types.ts` | `token_usage_updated: { lastTurnTokens: number }` | Cost store onChange emits this |

---

## Metadata

**Analog search scope:** `src/ai/`, `src/state/`, `src/ui/panels/`, `src/ui/screens/`, `src/input/`, `src/codex/`, `src/game-loop.ts`, `src/events/`
**Files scanned:** 18
**Pattern extraction date:** 2026-04-22
