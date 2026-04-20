# Phase 2: Core Gameplay - Pattern Map

**Mapped:** 2026-04-21
**Files analyzed:** 30 new/modified files
**Analogs found:** 27 / 30

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/ai/providers.ts` | config | request-response | `src/state/game-store.ts` | partial (config+export pattern) |
| `src/ai/prompts/narrative-system.ts` | utility | transform | `src/input/intent-classifier.ts` | role-match (system prompt) |
| `src/ai/prompts/npc-system.ts` | utility | transform | `src/input/intent-classifier.ts` | role-match (system prompt) |
| `src/ai/prompts/retrieval-system.ts` | utility | transform | `src/input/intent-classifier.ts` | role-match (system prompt) |
| `src/ai/schemas/narration-output.ts` | model | transform | `src/types/intent.ts` | exact (Zod schema) |
| `src/ai/schemas/npc-dialogue.ts` | model | transform | `src/types/intent.ts` | exact (Zod schema) |
| `src/ai/schemas/retrieval-plan.ts` | model | transform | `src/types/intent.ts` | exact (Zod schema) |
| `src/ai/roles/narrative-director.ts` | service | streaming | `src/input/intent-classifier.ts` | role-match (AI SDK call) |
| `src/ai/roles/npc-actor.ts` | service | request-response | `src/input/intent-classifier.ts` | exact (generateObject) |
| `src/ai/roles/retrieval-planner.ts` | service | request-response | `src/input/intent-classifier.ts` | exact (generateObject) |
| `src/ai/roles/safety-filter.ts` | service | request-response | `src/input/intent-classifier.ts` | exact (generateObject) |
| `src/ai/utils/context-assembler.ts` | utility | transform | `src/codex/query.ts` | role-match (data assembly) |
| `src/ai/utils/fallback.ts` | utility | transform | (none -- new pattern) | no-analog |
| `src/engine/combat-loop.ts` | service | event-driven | `src/game-loop.ts` | role-match (game loop) |
| `src/engine/scene-manager.ts` | service | CRUD | `src/game-loop.ts` | role-match (state+codex) |
| `src/engine/character-creation.ts` | service | transform | `src/game-loop.ts` | partial (orchestration) |
| `src/state/character-creation-store.ts` | store | CRUD | `src/state/combat-store.ts` | exact (store pattern) |
| `src/state/dialogue-store.ts` | store | CRUD | `src/state/combat-store.ts` | exact (store pattern) |
| `src/state/npc-memory-store.ts` | store | CRUD | `src/state/scene-store.ts` | exact (store pattern) |
| `src/ui/screens/character-creation-screen.tsx` | component | event-driven | `src/ui/screens/title-screen.tsx` | role-match (screen) |
| `src/ui/panels/dialogue-panel.tsx` | component | request-response | `src/ui/panels/scene-panel.tsx` | exact (panel) |
| `src/ui/panels/combat-status-bar.tsx` | component | request-response | `src/ui/panels/status-bar.tsx` | exact (panel) |
| `src/ui/panels/combat-actions-panel.tsx` | component | event-driven | `src/ui/panels/actions-panel.tsx` | exact (panel) |
| `src/ui/panels/check-result-line.tsx` | component | request-response | `src/ui/panels/status-bar.tsx` | role-match (display) |
| `src/ui/hooks/use-ai-narration.ts` | hook | streaming | `src/ui/hooks/use-game-input.ts` | role-match (hook) |
| `src/data/codex/backgrounds.yaml` | config | static | `src/data/codex/races.yaml` | exact (codex YAML) |
| `src/data/codex/enemies.yaml` | config | static | `src/data/codex/npcs.yaml` | exact (codex YAML) |
| `src/data/codex/races.yaml` | config | static | (expand existing) | existing |
| `src/data/codex/professions.yaml` | config | static | (expand existing) | existing |
| `src/data/codex/npcs.yaml` | config | static | (expand existing) | existing |

## Pattern Assignments

---

### `src/ai/providers.ts` (config, request-response)

**Analog:** `src/state/game-store.ts` (lines 1-6 for typed config pattern) + `src/input/intent-classifier.ts` (lines 2,22 for model import)

**Imports pattern:**
```typescript
// Follow the project's import style: named imports, type imports, SDK providers
import type { LanguageModel } from 'ai';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
```

**Core pattern** -- typed config registry with readonly semantics:
```typescript
// From game-store.ts pattern: Zod enum + typed record
// src/state/game-store.ts lines 6-15
import { z } from 'zod';
export const GamePhaseSchema = z.enum(['title', 'game', 'combat', 'dialogue']);
export const GameStateSchema = z.object({
  day: z.number().int().min(1),
  timeOfDay: TimeOfDaySchema,
  phase: GamePhaseSchema,
  turnCount: z.number().int().min(0),
  isDarkTheme: z.boolean(),
});
export type GameState = z.infer<typeof GameStateSchema>;
```

**Apply:** Define `AiRole` as a Zod enum or string literal union. Define `RoleConfig` interface with `model`, `temperature`, `maxTokens`. Export `getRoleConfig(role)` function. Use `readonly` on all config fields.

---

### `src/ai/schemas/narration-output.ts` (model, transform)

**Analog:** `src/types/intent.ts` (exact Zod schema pattern)

**Full file pattern** (`src/types/intent.ts` lines 1-15):
```typescript
import { z } from 'zod';

export const IntentActionSchema = z.enum([
  'move', 'look', 'talk', 'attack', 'use_item',
  'cast', 'guard', 'flee', 'inspect', 'trade',
]);

export const IntentSchema = z.object({
  action: IntentActionSchema,
  target: z.string().nullable(),
  modifiers: z.record(z.string(), z.string()).optional(),
  confidence: z.number().min(0).max(1),
  raw_interpretation: z.string(),
});
export type Intent = z.infer<typeof IntentSchema>;
```

**Apply to all AI schemas:** Same pattern -- `z.object()` with typed fields, exported schema + inferred type. For narration: `narration` (string, min 10 max 300), `sceneType`, `suggestedActions`. For NPC dialogue: `dialogue`, `emotionTag` (enum), `shouldRemember` (boolean), `relationshipDelta` (number min/max). For retrieval plan: `codexIds` (array max 3), `npcIds` (array max 2), `reasoning` (string).

---

### `src/ai/schemas/npc-dialogue.ts` (model, transform)

**Analog:** `src/types/intent.ts` (same as above)

**Apply:** Identical pattern. Schema fields from RESEARCH.md: `dialogue`, `emotionTag`, `shouldRemember`, `relationshipDelta`.

---

### `src/ai/schemas/retrieval-plan.ts` (model, transform)

**Analog:** `src/types/intent.ts` (same as above)

**Apply:** Identical pattern. Schema fields from RESEARCH.md: `codexIds`, `npcIds`, `questIds`, `reasoning`.

---

### `src/ai/roles/npc-actor.ts` (service, request-response)

**Analog:** `src/input/intent-classifier.ts` (exact -- `generateObject` with retry)

**Full file pattern** (`src/input/intent-classifier.ts` lines 1-42):
```typescript
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { IntentSchema, type Intent } from '../types/intent';

const INTENT_SYSTEM_PROMPT = `...`;

export type ClassifyIntentOptions = {
  readonly maxRetries?: number;
  readonly model?: Parameters<typeof generateObject>[0]['model'];
};

export async function classifyIntent(
  input: string,
  sceneContext: string,
  options?: ClassifyIntentOptions,
): Promise<Intent> {
  const maxRetries = options?.maxRetries ?? 1;
  const model = options?.model ?? openai('gpt-4o-mini');
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { object } = await generateObject({
        model,
        schema: IntentSchema,
        system: INTENT_SYSTEM_PROMPT,
        prompt: `Current scene: ${sceneContext}\nPlayer input: ${input}\n\nClassify the player's intent.`,
      });
      return object;
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    `Intent classification failed after ${maxRetries + 1} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}
```

**Apply to:** `npc-actor.ts`, `retrieval-planner.ts`, `safety-filter.ts` -- all use the same `generateObject` + retry pattern. Replace `IntentSchema` with the role-specific schema. Replace `openai('gpt-4o-mini')` with `getRoleConfig(role).model()`. Replace system prompt with role-specific builder function.

---

### `src/ai/roles/retrieval-planner.ts` (service, request-response)

**Analog:** `src/input/intent-classifier.ts` (same as above)

**Apply:** Same `generateObject` + retry pattern. Use `RetrievalPlanSchema`. Get model from `getRoleConfig('retrieval-planner')`.

---

### `src/ai/roles/safety-filter.ts` (service, request-response)

**Analog:** `src/input/intent-classifier.ts` (same as above)

**Apply:** Same `generateObject` pattern. Boolean/enum output schema. `getRoleConfig('safety-filter')`.

---

### `src/ai/roles/narrative-director.ts` (service, streaming)

**Analog:** `src/input/intent-classifier.ts` (partial -- uses `streamText` instead of `generateObject`)

**Base pattern** (from intent-classifier.ts lines 16-42 for retry + options structure):
```typescript
// Same function signature pattern but uses streamText + AsyncGenerator
import { streamText } from 'ai';

export async function* streamNarration(
  context: NarrativeContext,
  options?: { readonly maxRetries?: number },
): AsyncGenerator<string> {
  // Same retry loop structure as classifyIntent
  // But uses streamText instead of generateObject
  // And yields chunks from textStream
}
```

**Key difference:** `streamText` returns `{ textStream }` which is an `AsyncIterable<string>`. No Zod schema validation on streaming output (validate post-stream if needed). Use same retry pattern from intent-classifier for the initial API call.

---

### `src/ai/prompts/narrative-system.ts` (utility, transform)

**Analog:** `src/input/intent-classifier.ts` (lines 5-9 for system prompt constant)

**Pattern:**
```typescript
const INTENT_SYSTEM_PROMPT = `You are an intent classifier for a Chinese fantasy RPG game.
Classify the player's input into a structured game action.
Available actions: move, look, talk, attack, use_item, cast, guard, flee, inspect, trade.
Respond with the action type, target (if any), and your confidence level.
If the input is ambiguous, set confidence below 0.5 and provide your best interpretation.`;
```

**Apply:** Export functions that build system prompts per scene type (exploration, combat, dialogue, lore, horror). Each returns a `string`. Scene type determines narrative tone per D-07 decisions. Include constraints: 80-180 Chinese chars, no world fact invention, no state override.

---

### `src/ai/prompts/npc-system.ts` (utility, transform)

**Analog:** Same as narrative-system.ts pattern.

**Apply:** Export a builder function that takes NPC profile (identity, goals, personality_tags, backstory) and returns a system prompt string. Include personality tags at top of system prompt (high priority position per Pitfall 3). Constrain NPC to respond in character.

---

### `src/ai/prompts/retrieval-system.ts` (utility, transform)

**Analog:** Same as narrative-system.ts pattern.

**Apply:** Static system prompt. Instruct model to select relevant codex entries and NPC memories. Constrain max entries per category.

---

### `src/ai/utils/context-assembler.ts` (utility, transform)

**Analog:** `src/codex/query.ts` (lines 1-44 for data filtering/assembly pattern)

**Pattern** (`src/codex/query.ts` lines 4-26):
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

export function queryByTag(entries: Map<string, CodexEntry>, tag: string): CodexEntry[] {
  const result: CodexEntry[] = [];
  for (const entry of entries.values()) {
    if (entry.tags.includes(tag)) {
      result.push(entry);
    }
  }
  return result;
}

export function queryById(entries: Map<string, CodexEntry>, id: string): CodexEntry | undefined {
  return entries.get(id);
}
```

**Apply:** Pure function that takes a retrieval plan + codex Map + NPC memories + scene state + action and assembles a context object. Use `entries.get(id)` from codex query pattern. Filter and slice arrays (max 3 codex entries, max 3 NPC memories). Return a readonly `AssembledContext` interface.

---

### `src/engine/combat-loop.ts` (service, event-driven)

**Analog:** `src/game-loop.ts` (lines 40-112 for game loop orchestration pattern)

**Core pattern** (`src/game-loop.ts` lines 40-112):
```typescript
export function createGameLoop(options?: { readonly rng?: () => number }): GameLoop {
  const commandParser = createCommandParser();
  const rng = options?.rng;

  async function processInput(input: string, routeOptions?: RouteInputOptions): Promise<ProcessResult> {
    const sceneContext = sceneStore.getState().narrationLines.join(' ');
    const routeResult = await routeInput(input, commandParser, sceneContext, routeOptions);

    if (routeResult.status === 'error') {
      return { status: 'error', message: routeResult.message };
    }
    // ... action resolution + state update + event emission
    eventBus.emit('action_resolved', { action, result: checkResult });
    sceneStore.setState(draft => { draft.narrationLines = newNarration; });
    gameStore.setState(draft => { draft.turnCount += 1; });
    return { status: 'action_executed', action, checkResult, narration: newNarration };
  }

  function adjudicate(action: GameAction): CheckResult {
    const player = playerStore.getState();
    const attributeName = getRelevantAttribute(action.type);
    const attrMod = player.attributes[attributeName] ?? 0;
    const roll = rollD20(rng);
    const dc = 12;
    return resolveNormalCheck({ ... });
  }

  return { processInput, getCommandParser: () => commandParser };
}
```

**Apply:** Same factory pattern `createCombatLoop(options)`. Returns an interface with `startCombat`, `processPlayerAction`, `processEnemyTurn`, `checkCombatEnd`. Uses `combatStore.getState()` / `combatStore.setState()`. Calls `resolveNormalCheck` / `calculateDamage` from existing engine. Emits events via `eventBus.emit()`. Accepts `rng` for determinism.

**State machine phases:** `init -> player_turn -> resolving -> enemy_turn -> resolving -> check_end -> (player_turn | ended)`. Each phase transition updates combat store. AI narration is called after resolution, before advancing to next turn.

---

### `src/engine/scene-manager.ts` (service, CRUD)

**Analog:** `src/game-loop.ts` + `src/codex/query.ts`

**Apply:** Factory pattern `createSceneManager(codexEntries)`. Exposes `loadScene(locationId)`, `handleLook(target?)`, `handleInspect(target)`, `handleGo(direction)`. Reads from codex via `queryById`. Updates `sceneStore.setState()`. Returns data needed for AI narration. Emits `scene_changed` events.

---

### `src/engine/character-creation.ts` (service, transform)

**Analog:** `src/game-loop.ts` (partial -- orchestration pattern)

**Apply:** Factory pattern `createCharacterCreation(codexEntries)`. Exposes `getAvailableRaces()`, `getAvailableProfessions()`, `getBackgroundHooks()`, `buildCharacter(selections)`. Reads from codex. Pure logic: maps narrative choices to attribute distribution. Returns a `PlayerState` ready to store. No AI dependency (per RESEARCH.md recommendation).

---

### `src/state/character-creation-store.ts` (store, CRUD)

**Analog:** `src/state/combat-store.ts` (exact store pattern)

**Full file pattern** (`src/state/combat-store.ts` lines 1-41):
```typescript
import { z } from 'zod';
import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';

export const CombatStateSchema = z.object({
  active: z.boolean(),
  turnOrder: z.array(z.string()),
  currentTurnIndex: z.number(),
  enemies: z.array(z.object({
    id: z.string(),
    name: z.string(),
    hp: z.number(),
    maxHp: z.number(),
  })),
  roundNumber: z.number(),
});
export type CombatState = z.infer<typeof CombatStateSchema>;

export function getDefaultCombatState(): CombatState {
  return {
    active: false,
    turnOrder: [],
    currentTurnIndex: 0,
    enemies: [],
    roundNumber: 0,
  };
}

export const combatStore = createStore<CombatState>(
  getDefaultCombatState(),
  ({ newState, oldState }) => {
    if (newState.active && !oldState.active) {
      eventBus.emit('combat_started', { enemies: newState.enemies.map(e => e.name) });
    }
    if (!newState.active && oldState.active) {
      eventBus.emit('combat_ended', { outcome: 'victory' });
    }
  },
);
```

**Apply to all new stores:** Identical 3-part structure: (1) Zod schema + inferred type, (2) `getDefault*State()` factory, (3) `createStore()` call with event bus onChange handler. For `character-creation-store`: track wizard step, selected race/profession/background, attribute preview. For `dialogue-store`: active NPC, dialogue history, mode (inline/full), available responses. For `npc-memory-store`: per-NPC memory entries, keyed by NPC ID.

---

### `src/state/dialogue-store.ts` (store, CRUD)

**Analog:** `src/state/combat-store.ts` (same as above)

**Apply:** Same store pattern. Schema: `active` boolean, `npcId`, `npcName`, `mode` ('inline' | 'full'), `dialogueHistory` array, `availableResponses` array, `relationshipValue`. Emit dialogue events on state changes.

---

### `src/state/npc-memory-store.ts` (store, CRUD)

**Analog:** `src/state/scene-store.ts` (lines 1-56 for store with array data)

**Pattern** (`src/state/scene-store.ts` lines 1-21):
```typescript
import { z } from 'zod';
import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';

export const SceneStateSchema = z.object({
  sceneId: z.string(),
  locationName: z.string(),
  narrationLines: z.array(z.string()),
  actions: z.array(SceneActionSchema),
  npcsPresent: z.array(z.string()),
  exits: z.array(z.string()),
  objects: z.array(z.string()),
});
export type SceneState = z.infer<typeof SceneStateSchema>;
```

**Apply:** Schema with a `memories` record keyed by NPC ID, each containing an array of memory entries (event description, turn number, importance level). Use the same `createStore` pattern with optional event bus emission for memory writes.

---

### `src/ui/screens/character-creation-screen.tsx` (component, event-driven)

**Analog:** `src/ui/screens/title-screen.tsx` (screen pattern) + `src/ui/screens/game-screen.tsx` (complex screen with props)

**Title screen pattern** (`src/ui/screens/title-screen.tsx` lines 1-53):
```typescript
import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

type TitleScreenProps = {
  readonly onStart: () => void;
};

export function TitleScreen({ onStart }: TitleScreenProps): React.ReactNode {
  const [titleArt] = useState<string | null>(() => generateTitleArt());
  const handleInput = useCallback(() => { onStart(); }, [onStart]);
  useInput(handleInput);

  return (
    <Box flexGrow={1} justifyContent="center" alignItems="center" flexDirection="column">
      {/* ... */}
    </Box>
  );
}
```

**Game screen pattern** (`src/ui/screens/game-screen.tsx` lines 1-22):
```typescript
import React, { useCallback } from 'react';
import { Box, Text } from 'ink';
import { useScreenSize } from 'fullscreen-ink';

type GameScreenProps = {
  readonly gameState: GameState;
  readonly playerState: PlayerState;
  readonly sceneState: SceneState;
  readonly onSetGamePhase: (recipe: (draft: GameState) => void) => void;
};

export function GameScreen({ gameState, playerState, sceneState, onSetGamePhase }: GameScreenProps): React.ReactNode {
  const { width, height } = useScreenSize();
  // ...
}
```

**Apply:** Multi-step wizard screen. Props include `onComplete(playerState)` callback (like `onStart`). Internal state tracks wizard step. Uses `@inkjs/ui` Select component for race/profession/background choices. Renders narrative questions per D-02. On completion, emits finalized PlayerState.

---

### `src/ui/panels/dialogue-panel.tsx` (component, request-response)

**Analog:** `src/ui/panels/scene-panel.tsx` (exact panel pattern)

**Full file pattern** (`src/ui/panels/scene-panel.tsx` lines 1-18):
```typescript
import React from 'react';
import { Box, Text } from 'ink';

type ScenePanelProps = {
  readonly lines: readonly string[];
};

export function ScenePanel({ lines }: ScenePanelProps): React.ReactNode {
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {lines.length === 0 ? (
        <Text dimColor>周围一片寂静，什么也没有发生。</Text>
      ) : (
        lines.map((line, i) => <Text key={i}>{line}</Text>)
      )}
    </Box>
  );
}
```

**Apply:** Same structure. Props: `npcName`, `dialogueLines` (array), `relationshipStatus`, `responseOptions` (array), `onSelectResponse`. Renders NPC name in bold, dialogue lines, available responses with Select-style interaction.

---

### `src/ui/panels/combat-status-bar.tsx` (component, request-response)

**Analog:** `src/ui/panels/status-bar.tsx` (exact -- extended status bar)

**Key pattern** (`src/ui/panels/status-bar.tsx` lines 28-77):
```typescript
export function StatusBar({
  hp, maxHp, mp, maxMp, gold, location, quest, width,
}: StatusBarProps): React.ReactNode {
  const hpRatio = maxHp > 0 ? hp / maxHp : 1;
  const hpColor = hpRatio < 0.1 ? 'red' : hpRatio < 0.25 ? 'yellow' : undefined;
  const hpBold = hpRatio < 0.1;

  const fields: React.ReactNode[] = [];
  fields.push(<Text key="hp" color={hpColor} bold={hpBold}>HP {hp}/{maxHp}</Text>);
  fields.push(<Text key="mp">  MP {mp}/{maxMp}</Text>);

  if (width >= 45) { fields.push(<Text key="gold">  Gold {gold}</Text>); }
  if (width >= 55) { /* location */ }
  if (width >= 65) { /* quest */ }

  return (<Box paddingX={1}>{fields}</Box>);
}
```

**Apply:** Extend with enemy HP bars, turn order display, round number. Same width-responsive pattern (conditionally show fields based on terminal width). Add enemy HP with color coding. Keep same `fields: React.ReactNode[]` accumulation pattern.

---

### `src/ui/panels/combat-actions-panel.tsx` (component, event-driven)

**Analog:** `src/ui/panels/actions-panel.tsx` (exact -- combat-specific action menu)

**Full file pattern** (`src/ui/panels/actions-panel.tsx` lines 1-67):
```typescript
import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

type ActionsPanelProps = {
  readonly actions: readonly Action[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  readonly onExecute: (index: number) => void;
  readonly isActive: boolean;
};

export function ActionsPanel({ actions, selectedIndex, onSelect, onExecute, isActive }: ActionsPanelProps): React.ReactNode {
  const handleInput = useCallback((input: string, key: { upArrow?: boolean; downArrow?: boolean; return?: boolean }) => {
    if (key.upArrow) { /* ... */ }
    else if (key.downArrow) { /* ... */ }
    else if (key.return) { onExecute(selectedIndex); }
    else { /* number key shortcut */ }
  }, [actions.length, selectedIndex, onSelect, onExecute]);

  useInput(handleInput, { isActive });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>可选行动</Text>
      {actions.map((action, i) => {
        const isSelected = i === selectedIndex;
        return (
          <Text key={action.id} bold={isSelected} color={isSelected ? 'cyan' : undefined} dimColor={!isSelected}>
            {isSelected ? '> ' : '  '}{i + 1}. {action.label}
          </Text>
        );
      })}
      <Text dimColor>...</Text>
    </Box>
  );
}
```

**Apply:** Same structure with combat-specific actions: attack, cast, guard, flee, use item, environment interaction. Same `useInput` keyboard handling. Same number-key shortcut pattern. Change header to "战斗行动".

---

### `src/ui/panels/check-result-line.tsx` (component, request-response)

**Analog:** `src/ui/panels/status-bar.tsx` (display formatting with conditional color)

**Pattern** (status-bar.tsx lines 38-41 for conditional color):
```typescript
const hpRatio = maxHp > 0 ? hp / maxHp : 1;
const hpColor = hpRatio < 0.1 ? 'red' : hpRatio < 0.25 ? 'yellow' : undefined;
const hpBold = hpRatio < 0.1;
```

**Apply:** Takes a `CheckResult` as prop. Renders `display` string with grade-based coloring: critical_success/great_success = green/bold, success = green, partial_success = yellow, failure = red, critical_failure = red/bold. Per D-17: show full check data first, then narration.

---

### `src/ui/hooks/use-ai-narration.ts` (hook, streaming)

**Analog:** `src/ui/hooks/use-game-input.ts` (React hook pattern)

**Pattern** (`src/ui/hooks/use-game-input.ts` lines 1-26):
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

**Apply:** Same hook structure. State: `narrationText` (string, accumulates stream chunks), `isStreaming` (boolean), `error` (Error | null). Expose `startNarration(context)` function that calls `streamNarration()` and updates state per chunk. Return `{ narrationText, isStreaming, error }`.

---

### `src/data/codex/backgrounds.yaml` (config, static)

**Analog:** `src/data/codex/races.yaml` (codex YAML format)

Need to read the YAML format.

---

### `src/data/codex/enemies.yaml` (config, static)

**Analog:** `src/data/codex/npcs.yaml` (codex YAML format with NPC-like entries)

**Apply:** Same YAML structure as npcs.yaml with additional combat fields: `hp`, `maxHp`, `attack`, `defense`, `dc`, `damage_base`, `abilities`. Must conform to CodexEntrySchema (need to extend entry-types.ts with `EnemySchema`).

---

## Shared Patterns

### Store Creation
**Source:** `src/state/create-store.ts` (lines 1-36) + `src/state/combat-store.ts` (lines 1-41)
**Apply to:** `character-creation-store.ts`, `dialogue-store.ts`, `npc-memory-store.ts`

Three-part structure used by ALL stores:
```typescript
// 1. Zod schema + type export
import { z } from 'zod';
import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';

export const MyStateSchema = z.object({ /* ... */ });
export type MyState = z.infer<typeof MyStateSchema>;

// 2. Default state factory
export function getDefaultMyState(): MyState {
  return { /* ... */ };
}

// 3. Store instance with event bus onChange
export const myStore = createStore<MyState>(
  getDefaultMyState(),
  ({ newState, oldState }) => {
    // Emit domain events on meaningful state changes
  },
);
```

### AI SDK v5 generateObject Call
**Source:** `src/input/intent-classifier.ts` (lines 1-42)
**Apply to:** `npc-actor.ts`, `retrieval-planner.ts`, `safety-filter.ts`

```typescript
import { generateObject } from 'ai';

// 1. Import schema from ../schemas/
// 2. Define system prompt or prompt builder
// 3. Export async function with retry loop:
const { object } = await generateObject({
  model,
  schema: MySchema,
  system: SYSTEM_PROMPT,
  prompt: buildPrompt(context),
});
return object;
```

### React/Ink Panel Component
**Source:** `src/ui/panels/scene-panel.tsx` (lines 1-18)
**Apply to:** `dialogue-panel.tsx`, `combat-status-bar.tsx`, `combat-actions-panel.tsx`, `check-result-line.tsx`

```typescript
import React from 'react';
import { Box, Text } from 'ink';

type MyPanelProps = {
  readonly field1: Type1;
  readonly field2: Type2;
};

export function MyPanel({ field1, field2 }: MyPanelProps): React.ReactNode {
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {/* content */}
    </Box>
  );
}
```

### Interactive Panel with useInput
**Source:** `src/ui/panels/actions-panel.tsx` (lines 1-67)
**Apply to:** `combat-actions-panel.tsx`, `character-creation-screen.tsx`

```typescript
import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// useInput(handler, { isActive }) for keyboard handling
// Arrow keys for navigation, Enter for selection, number keys for shortcuts
```

### Event Bus Domain Events
**Source:** `src/events/event-types.ts` (lines 1-23) + `src/events/event-bus.ts` (lines 1-4)
**Apply to:** All new stores and engine modules that need cross-system communication

```typescript
// 1. Add new event types to DomainEvents
export type DomainEvents = {
  // Existing...
  // NEW for Phase 2:
  dialogue_started: { npcId: string; mode: 'inline' | 'full' };
  dialogue_ended: { npcId: string };
  npc_memory_written: { npcId: string; event: string };
  character_created: { name: string; race: string; profession: string };
  combat_action_resolved: { action: string; checkResult: CheckResult };
};

// 2. Emit from stores and engine modules
import { eventBus } from '../events/event-bus';
eventBus.emit('dialogue_started', { npcId: 'guard', mode: 'full' });
```

### Codex Schema Extension
**Source:** `src/codex/schemas/entry-types.ts` (lines 1-104)
**Apply to:** New `EnemySchema`, `BackgroundSchema` additions

```typescript
// Follow the baseFields pattern:
const baseFields = {
  id: z.string().min(1),
  name: z.string(),
  tags: z.array(z.string()),
  description: z.string(),
  epistemic: EpistemicMetadataSchema,
};

// New schema extends baseFields with type-specific fields:
export const EnemySchema = z.object({
  ...baseFields,
  type: z.literal("enemy"),
  // ... enemy-specific fields
});

// Add to discriminated union:
export const CodexEntrySchema = z.discriminatedUnion("type", [
  RaceSchema, ProfessionSchema, LocationSchema, FactionSchema,
  NpcSchema, SpellSchema, ItemSchema, HistoryEventSchema,
  EnemySchema, BackgroundSchema, // NEW
]);
```

### Test Pattern (Mocked AI)
**Source:** `src/input/intent-classifier.test.ts` (lines 1-183)
**Apply to:** All AI role tests (`narrative-director.test.ts`, `npc-actor.test.ts`, `retrieval-planner.test.ts`)

```typescript
import { describe, it, expect, mock, beforeEach } from 'bun:test';

// 1. Mock AI SDK modules BEFORE importing tested module
const mockGenerateObject = mock(() => Promise.resolve({ object: {} }));
mock.module('ai', () => ({ generateObject: mockGenerateObject }));
mock.module('@ai-sdk/openai', () => ({ openai: () => 'mock-model' }));

// 2. Dynamic import of tested module AFTER mocks
const { myFunction } = await import('./my-module');

// 3. Tests with mockResolvedValueOnce / mockRejectedValueOnce
describe('myFunction', () => {
  beforeEach(() => { mockGenerateObject.mockReset(); });

  it('returns structured output', async () => {
    mockGenerateObject.mockResolvedValueOnce({ object: expectedOutput });
    const result = await myFunction(input);
    expect(result).toEqual(expectedOutput);
  });

  it('handles failure with retry', async () => {
    mockGenerateObject
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ object: expectedOutput });
    const result = await myFunction(input, { maxRetries: 1 });
    expect(mockGenerateObject).toHaveBeenCalledTimes(2);
  });
});
```

### Test Pattern (Engine/Pure Logic)
**Source:** `src/engine/rules-engine.test.ts` (lines 1-127)
**Apply to:** `combat-loop.test.ts`, `scene-manager.test.ts`, `character-creation.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { createSeededRng } from "./dice.ts";

// 1. Direct import (no mocks needed for pure logic)
// 2. Use createSeededRng for deterministic testing
// 3. Test specific input -> output mappings
describe("combat loop", () => {
  test("player attack with seeded rng produces deterministic result", () => {
    const rng = createSeededRng(42);
    const result = processCombatAction(action, context, rng);
    expect(result.checkResult.roll).toBeDefined();
  });
});
```

### App Routing (Phase Extension)
**Source:** `src/app.tsx` (lines 1-56) + `src/state/game-store.ts` (line 6)
**Apply to:** Extending `App` to route to character creation screen

```typescript
// game-store.ts line 6 -- extend GamePhaseSchema:
export const GamePhaseSchema = z.enum(['title', 'character_creation', 'game', 'combat', 'dialogue']);

// app.tsx lines 30-43 -- extend phase routing:
if (phase === 'title') {
  return <TitleScreen onStart={handleStart} />;
}
if (phase === 'character_creation') {
  return <CharacterCreationScreen onComplete={handleCharacterCreated} />;
}
return <GameScreen ... />;
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/ai/utils/fallback.ts` | utility | transform | No fallback/static narration pattern exists yet. This is a new concept: return canned Chinese narration strings when AI fails. Pattern is simple (switch on scene type, return static string), no complex analog needed. |
| `src/data/npc-memory/*.json` | data | static | No JSON memory file pattern exists. These are runtime-generated per-NPC files. Structure is new to the codebase. Use Bun.file()/Bun.write() for I/O per CLAUDE.md stack. |
| `tests/ai-eval/promptfoo.yaml` | config | static | Promptfoo is new tooling. No eval config exists yet. Follow promptfoo docs for YAML format. |

## Metadata

**Analog search scope:** `src/` directory (all 54 TS/TSX files + 9 YAML data files)
**Files scanned:** 63
**Pattern extraction date:** 2026-04-21
