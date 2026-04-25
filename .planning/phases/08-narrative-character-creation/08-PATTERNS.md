# Phase 8: Narrative Character Creation - Pattern Map

**Mapped:** 2026-04-25
**Files analyzed:** 12 (7 new, 5 modified)
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/data/codex/guard-dialogue.yaml` | config | static data | `src/data/codex/backgrounds.yaml` | role-match |
| `src/engine/guard-dialogue-loader.ts` | service | file-I/O | `src/codex/loader.ts` | exact |
| `src/engine/weight-resolver.ts` | service | transform | `src/engine/character-creation.ts` | role-match |
| `src/ai/prompts/guard-creation-prompt.ts` | utility | request-response | `src/ai/prompts/npc-system.ts` | exact |
| `src/ui/screens/narrative-creation-screen.tsx` | component (screen) | event-driven | `src/ui/screens/character-creation-screen.tsx` | role-match |
| `src/ui/components/guard-dialogue-panel.tsx` | component (panel) | event-driven | `src/ui/panels/dialogue-panel.tsx` | exact |
| `src/ui/components/guard-name-input.tsx` | component (input) | request-response | (no direct analog -- uses `@inkjs/ui` TextInput) | no-analog |
| `src/ui/hooks/use-guard-streaming.ts` | hook | streaming | `src/ui/hooks/use-npc-dialogue.ts` | exact |
| `src/engine/weight-resolver.test.ts` | test | transform | `src/engine/character-creation.test.ts` | exact |
| `src/engine/guard-dialogue-loader.test.ts` | test | file-I/O | `src/codex/loader.test.ts` | exact |
| `src/state/game-store.ts` | store | CRUD | (self -- add enum value) | self-modify |
| `src/app.tsx` | component (root) | event-driven | (self -- add routing branch) | self-modify |

## Pattern Assignments

### `src/data/codex/guard-dialogue.yaml` (config, static data)

**Analog:** `src/data/codex/backgrounds.yaml`

No code excerpt needed -- this is a YAML data file. The structural pattern to follow is: top-level array or object, each entry has `id`, descriptive fields, and effect/weight fields. The schema is defined in `guard-dialogue-loader.ts` (Zod), not in the YAML itself.

Key constraint: IDs reference codex entries (e.g., `race_human`, `prof_mage`) but do NOT embed codex data. The YAML is loaded via `yaml` package + Zod validation, same as all other codex files.

---

### `src/engine/guard-dialogue-loader.ts` (service, file-I/O)

**Analog:** `src/codex/loader.ts`

**Imports pattern** (lines 1-3):
```typescript
import { parse as parseYaml } from "yaml";
import { CodexEntrySchema, type CodexEntry } from "./schemas/entry-types.ts";
```

**Core YAML loading + Zod validation pattern** (lines 5-33):
```typescript
export async function loadCodexFile(filePath: string): Promise<CodexEntry[]> {
  const file = Bun.file(filePath);
  const text = await file.text();
  const rawEntries = parseYaml(text);

  if (!Array.isArray(rawEntries)) {
    throw new Error(`Codex file ${filePath}: expected array of entries, got ${typeof rawEntries}`);
  }

  const validated: CodexEntry[] = [];

  for (let i = 0; i < rawEntries.length; i++) {
    const raw = rawEntries[i];
    const entryId = raw?.id ?? `(index ${i})`;
    const result = CodexEntrySchema.safeParse(raw);

    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new Error(
        `Codex file ${filePath}, entry "${entryId}" (index ${i}) validation failed:\n${issues}`
      );
    }

    validated.push(result.data);
  }

  return validated;
}
```

**Adaptation notes:** The guard-dialogue loader loads a single config object (not an array of entries), so use `GuardDialogueConfigSchema.parse(raw)` instead of iterating. Use `safeParse` + detailed error messages matching this pattern. The function signature is `loadGuardDialogue(filePath: string): Promise<GuardDialogueConfig>`.

---

### `src/engine/weight-resolver.ts` (service, transform)

**Analog:** `src/engine/character-creation.ts`

**Imports pattern** (lines 1-3):
```typescript
import type { CodexEntry, Race, Profession, Background } from '../codex/schemas/entry-types';
import { queryByType, queryById } from '../codex/query';
import type { PlayerState } from '../state/player-store';
```

**Pure function pattern with readonly types** (lines 5-10):
```typescript
type CharacterSelections = {
  readonly name: string;
  readonly raceId: string;
  readonly professionId: string;
  readonly backgroundIds: readonly string[];
};
```

**Attribute calculation pattern -- iterating + accumulating** (lines 59-83):
```typescript
const calculateAttributes = (
  raceId: string,
  professionId: string,
  backgroundIds: readonly string[],
): Record<string, number> => {
  const attrs = { ...BASE_ATTRIBUTES };

  const profession = queryById(codexEntries, professionId) as Profession | undefined;
  if (profession) {
    attrs[profession.primary_attribute] = (attrs[profession.primary_attribute] ?? 0) + 1;
  }

  for (const bgId of backgroundIds) {
    const bg = queryById(codexEntries, bgId) as Background | undefined;
    if (bg?.attribute_bias) {
      for (const [attr, value] of Object.entries(bg.attribute_bias)) {
        if (value !== undefined && attr in attrs) {
          (attrs as Record<string, number>)[attr] = ((attrs as Record<string, number>)[attr] ?? 0) + value;
        }
      }
    }
  }

  return attrs;
};
```

**Adaptation notes:** The weight resolver follows the same accumulation pattern but across 4 dialogue rounds instead of direct codex lookups. Key difference: `weight-resolver.ts` is a standalone pure-function module (NOT wrapped in `createCharacterCreation` factory). It exports `accumulateWeights(current, optionEffects)` and `resolveCharacter(accumulated, tiebreakerConfig)` as separate functions. All inputs/outputs are `readonly`. No codex dependency -- it works purely with weight numbers and codex IDs.

---

### `src/ai/prompts/guard-creation-prompt.ts` (utility, request-response)

**Analog:** `src/ai/prompts/npc-system.ts`

**Type + prompt builder pattern** (lines 1-21):
```typescript
export type NpcProfile = {
  readonly id: string;
  readonly name: string;
  readonly personality_tags: readonly string[];
  readonly goals: readonly string[];
  readonly backstory: string;
};

export function buildNpcSystemPrompt(npc: NpcProfile): string {
  return `你扮演NPC "${npc.name}"。
性格特征：${npc.personality_tags.join('、')}
目标：${npc.goals.join('、')}
背景：${npc.backstory}

规则：
- 用符合角色性格的语气说话
- 只谈论你应该知道的事情
- 输出对白，不超过300字
- 不发明世界事实
- 不声明机械效果`;
}
```

**User prompt builder with context** (lines 23-38):
```typescript
export type NpcUserPromptContext = {
  readonly scene: string;
  readonly playerAction: string;
  readonly memories: readonly string[];
  readonly emotionHint?: string;
};

export function buildNpcUserPrompt(context: NpcUserPromptContext): string {
  const memoriesText = context.memories.slice(0, 3).join('\n') || '（无）';

  return `场景：${context.scene}
玩家动作：${context.playerAction}
你对这个玩家的记忆：${memoriesText}
当前情绪倾向：${context.emotionHint ?? '中立'}
请以角色身份回应。`;
}
```

**Adaptation notes:** The guard creation prompt reuses `NpcProfile` type (import it, don't redefine). Export a `buildGuardCreationSystemPrompt(npc, round, playerSelection?)` that adds creation-specific rules (round number, 150-char limit, no game mechanics disclosure). Export a `buildGuardCreationUserPrompt(round, guardPromptHint, playerSelection?)` for the per-round user prompt. Keep the same template string interpolation pattern.

---

### `src/ui/screens/narrative-creation-screen.tsx` (component/screen, event-driven)

**Analog:** `src/ui/screens/character-creation-screen.tsx`

**Imports pattern** (lines 1-6):
```typescript
import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { createCharacterCreation } from '../../engine/character-creation';
import { loadAllCodex } from '../../codex/loader';
import type { CodexEntry, Race, Profession, Background } from '../../codex/schemas/entry-types';
import type { PlayerState } from '../../state/player-store';
```

**Props type and component signature** (lines 8-10):
```typescript
type Props = {
  readonly onComplete: (playerState: PlayerState) => void;
};
```

**Codex loading in useEffect** (lines 38-43):
```typescript
useEffect(() => {
  loadAllCodex('src/data/codex').then((entries) => {
    setCodex(entries);
    setLoading(false);
  });
}, []);
```

**useInput handler with step-gated logic** (lines 68-90):
```typescript
useInput((input, key) => {
  if (loading) return;

  if (step < 4) {
    if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
    else if (key.downArrow) setCursor((c) => Math.min(options.length - 1, c + 1));
    else if (key.return && options[cursor]) {
      const selected = options[cursor].id;
      if (step === 0) { setSelectedRace(selected); setStep(1); }
      // ...
    } else if (input >= '1' && input <= '9') {
      const idx = parseInt(input, 10) - 1;
      if (idx < options.length) setCursor(idx);
    }
  }
});
```

**Loading state render** (lines 92-98):
```typescript
if (loading) {
  return (
    <Box flexGrow={1} justifyContent="center" alignItems="center">
      <Text dimColor>加载中...</Text>
    </Box>
  );
}
```

**Option list rendering** (lines 151-159):
```typescript
{options.map((opt, i) => (
  <Box key={opt.id}>
    <Text color={i === cursor ? 'yellow' : undefined}>
      {i === cursor ? '> ' : '  '}{i + 1}. {opt.name}
    </Text>
    <Text dimColor> — {opt.description}</Text>
  </Box>
))}
```

**Adaptation notes:** Replace multi-useState with `useReducer` for the state machine (CreationPhase discriminated union). Replace direct codex step logic with guard dialogue rounds + streaming phases. The `useInput` handler must be gated by `phase.type` (only active during `round_selecting` and `name_input`). Loading state loads both codex AND guard-dialogue.yaml. The `onComplete` callback calls `buildCharacter` after weight resolution.

---

### `src/ui/components/guard-dialogue-panel.tsx` (component/panel, event-driven)

**Analog:** `src/ui/panels/dialogue-panel.tsx`

**Imports pattern** (lines 1-2):
```typescript
import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
```

**NPC header with name + metadata** (lines 81-85):
```typescript
<Box flexDirection="row" justifyContent="space-between">
  <Text bold color="cyan">【{npcName}】</Text>
  <Text dimColor>关系: {relLabel} ({relationshipValue.toFixed(1)})</Text>
</Box>
```

**Option list with cursor, number keys, bold+cyan selection** (lines 104-129):
```typescript
{responseOptions.map((option, i) => {
  const isSelected = i === selectedIndex;
  return (
    <Box key={option.id} flexDirection="row">
      <Text
        bold={isSelected}
        color={isSelected ? 'cyan' : undefined}
        dimColor={!isSelected}
      >
        {isSelected ? '❯ ' : '  '}
        {i + 1}. {option.label}
      </Text>
    </Box>
  );
})}
```

**Keyboard hint bar** (line 131):
```typescript
<Text dimColor>↑↓ 选择    Enter 确认    Esc 结束对话</Text>
```

**Also reference ActionsPanel** (`src/ui/panels/actions-panel.tsx` lines 52-65) for the simpler list variant:
```typescript
{actions.map((action, i) => {
  const isSelected = i === selectedIndex;
  return (
    <Text
      key={action.id}
      bold={isSelected}
      color={isSelected ? 'cyan' : undefined}
      dimColor={!isSelected}
    >
      {isSelected ? '❯ ' : '  '}
      {i + 1}. {action.label}
    </Text>
  );
})}
```

**Adaptation notes:** The guard dialogue panel combines streaming text display (from ScenePanel pattern) with option selection (from DialoguePanel pattern). During `round_streaming`, show streaming text with `...` indicator (ScenePanel lines 18-22). During `round_selecting`, show option list with cursor. The `useInput` handler must respect `isActive` prop gating, same as both analogs.

**ScenePanel streaming pattern** (`src/ui/panels/scene-panel.tsx` lines 18-22):
```typescript
{isStreaming && (
  <Text>
    {streamingText}
    <Text dimColor>...</Text>
  </Text>
)}
```

---

### `src/ui/components/guard-name-input.tsx` (component/input, request-response)

**No direct analog in codebase.** Uses `@inkjs/ui` TextInput which is not yet used anywhere.

**Closest partial analog for layout:** `src/ui/panels/input-area.tsx` (uses `useInput` for text handling).

**Pattern from RESEARCH.md code example** (verified against Context7 docs):
```tsx
import { TextInput } from '@inkjs/ui';

// TextInput accepts: placeholder, defaultValue, onChange, onSubmit
// Tab key handling requires a separate useInput since TextInput doesn't expose onTab
```

**Adaptation notes:** This is the one truly new pattern. Wrap `TextInput` in a Box with the guard's name prompt. Gate via `isDisabled` prop when not in `name_input` phase. Handle Tab via a parallel `useInput` that is only active during `name_input` phase. Validate with `string-width` for CJK width, max ~20 chars. Empty submit falls back to `'旅人'`.

---

### `src/ui/hooks/use-guard-streaming.ts` (hook, streaming)

**Analog:** `src/ui/hooks/use-npc-dialogue.ts`

**Full hook pattern** (lines 1-158) -- the entire file is the pattern. Key excerpts:

**State + refs setup** (lines 30-39):
```typescript
const [streamingText, setStreamingText] = useState('');
const [isStreaming, setIsStreaming] = useState(false);
const [error, setError] = useState<Error | null>(null);
const [metadata, setMetadata] = useState<NpcDialogue | null>(null);

const cancelledRef = useRef(false);
const skippedRef = useRef(false);
const fullTextRef = useRef('');
const bufferRef = useRef<SentenceBuffer | null>(null);
```

**Sentence buffer creation** (lines 52-56):
```typescript
bufferRef.current = createSentenceBuffer({
  onFlush: (text: string) => {
    setStreamingText(prev => prev + text);
  },
});
```

**Stream consumption loop** (lines 65-84):
```typescript
(async () => {
  try {
    const stream = streamNpcDialogue(npcProfile, scene, playerAction, memories);
    for await (const chunk of stream) {
      if (cancelledRef.current) break;
      fullTextRef.current += chunk;
      if (!skippedRef.current) {
        bufferRef.current?.push(chunk);
      }
    }
  } catch (err) {
    if (!cancelledRef.current) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsStreaming(false);
      return;
    }
  } finally {
    if (!cancelledRef.current) {
      bufferRef.current?.flush();
      bufferRef.current?.dispose();
      setStreamingText(fullTextRef.current);
      // ... metadata extraction, event emission ...
      setIsStreaming(false);
    }
  }
})();
```

**skipToEnd** (lines 131-137):
```typescript
const skipToEnd = useCallback(() => {
  if (!skippedRef.current && isStreaming) {
    skippedRef.current = true;
    bufferRef.current?.flush();
    bufferRef.current?.dispose();
    setStreamingText(fullTextRef.current);
  }
}, [isStreaming]);
```

**Adaptation notes:** The guard streaming hook is a thin wrapper. It can either directly use `useNpcDialogue` (preferred -- avoid duplication) or create a simplified version that skips the metadata extraction / fallback generateNpcDialogue logic (since guard creation doesn't need emotion tags or relationship deltas). If wrapping, just re-export `useNpcDialogue` with a preset `NpcProfile` for `npc_guard`.

---

### `src/engine/weight-resolver.test.ts` (test, transform)

**Analog:** `src/engine/character-creation.test.ts`

**Test file structure** (lines 1-12):
```typescript
import { describe, it, expect, beforeAll } from 'bun:test';
import { loadAllCodex } from '../codex/loader';
import { createCharacterCreation } from './character-creation';
import type { CodexEntry } from '../codex/schemas/entry-types';

let codexEntries: Map<string, CodexEntry>;
let cc: ReturnType<typeof createCharacterCreation>;

beforeAll(async () => {
  codexEntries = await loadAllCodex('src/data/codex');
  cc = createCharacterCreation(codexEntries);
});
```

**Pure function assertion pattern** (lines 54-67):
```typescript
describe('calculateAttributes', () => {
  it('applies base + profession primary + background biases', () => {
    const attrs = cc.calculateAttributes('race_human', 'prof_adventurer', ['bg_refugee', 'bg_secret_debt']);
    expect(attrs.physique).toBe(2 + 1 + 1 + 1);
    expect(attrs.finesse).toBe(2);
    expect(attrs.mind).toBe(2);
  });
});
```

**Adaptation notes:** Weight resolver tests should NOT depend on codex loading. Use inline test fixtures (hardcoded effects objects). Test structure: `accumulateWeights` (round-by-round accumulation), `resolveByWeight` (highest weight wins), `resolveCharacter` (full 4-round scenario), tiebreaker edge cases (all 4 layers). Each test verifies exact numeric outputs from known inputs.

---

### `src/engine/guard-dialogue-loader.test.ts` (test, file-I/O)

**Analog:** `src/codex/loader.test.ts`

**Test file structure** (lines 1-8):
```typescript
import { describe, it, expect, beforeAll } from "bun:test";
import { loadCodexFile, loadAllCodex } from "./loader.ts";
import { queryByType, queryByTag, queryById, queryRelationships } from "./query.ts";
import type { CodexEntry } from "./schemas/entry-types.ts";
import type { RelationshipEdge } from "./schemas/relationship.ts";
import { resolve } from "path";

const CODEX_DIR = resolve(import.meta.dir, "../data/codex");
```

**File load + validation test** (lines 10-17):
```typescript
describe("loadCodexFile", () => {
  it("loads and validates locations.yaml", async () => {
    const entries = await loadCodexFile(resolve(CODEX_DIR, "locations.yaml"));
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of entries) {
      expect(entry.type).toBe("location");
    }
  });
```

**Invalid data rejection test** (lines 75-93):
```typescript
it("throws on invalid YAML data with entry id and field info", async () => {
  const invalidYaml = `...`;
  const tmpPath = resolve(CODEX_DIR, "__test_invalid.yaml");
  await Bun.write(tmpPath, invalidYaml);
  try {
    await expect(loadCodexFile(tmpPath)).rejects.toThrow();
  } finally {
    const { unlinkSync } = await import("fs");
    unlinkSync(tmpPath);
  }
});
```

**Adaptation notes:** Test `loadGuardDialogue` against the real `guard-dialogue.yaml` file (happy path). Test that the Zod schema rejects malformed data (missing rounds, invalid weights, non-integer round numbers). Use `Bun.write` for temp files + cleanup in `finally` blocks, matching the existing pattern.

---

### `src/state/game-store.ts` (store, CRUD -- MODIFIED)

**Self-modification.** Add `'narrative_creation'` to the `GamePhaseSchema` enum.

**Current enum** (line 6):
```typescript
export const GamePhaseSchema = z.enum(['title', 'character_creation', 'game', 'combat', 'dialogue', 'journal', 'map', 'codex', 'branch_tree', 'compare', 'shortcuts', 'replay', 'cost']);
```

**Target:** Replace `'character_creation'` with `'narrative_creation'` in the enum array.

---

### `src/app.tsx` (component/root, event-driven -- MODIFIED)

**Self-modification.** Replace `character_creation` routing with `narrative_creation`.

**Current routing pattern** (lines 38-63):
```typescript
const handleStart = useCallback(() => {
  setGameState((draft) => {
    draft.phase = 'character_creation';
  });
}, [setGameState]);

// ...

if (phase === 'character_creation') {
  return (
    <SizeGuard>
      <CharacterCreationScreen onComplete={handleCharacterCreated} />
    </SizeGuard>
  );
}
```

**Target:** Replace `'character_creation'` with `'narrative_creation'`, import `NarrativeCreationScreen` instead of `CharacterCreationScreen`, same `onComplete` callback shape.

---

## Shared Patterns

### Streaming Hook Pattern
**Source:** `src/ui/hooks/use-npc-dialogue.ts` (full file) and `src/ui/hooks/use-ai-narration.ts` (full file)
**Apply to:** `use-guard-streaming.ts`, `narrative-creation-screen.tsx`

Both hooks share identical structure: `useState` for text/streaming/error, `useRef` for cancellation/skip/buffer, `createSentenceBuffer` for sentence-level flush, async IIFE for stream consumption, `skipToEnd`/`reset` callbacks. The guard streaming hook should reuse `useNpcDialogue` directly or copy this exact structure.

### Option List Selection Pattern
**Source:** `src/ui/panels/actions-panel.tsx` (lines 52-65) and `src/ui/panels/dialogue-panel.tsx` (lines 104-129)
**Apply to:** `guard-dialogue-panel.tsx`, `narrative-creation-screen.tsx`

Consistent across the codebase: `❯` prefix for selected, number (i+1) prefix, bold+cyan for selected, dimColor for unselected. Number key direct-select (`parseInt(input, 10)` -> index). Arrow key wrap-around. `useInput` with `{ isActive }` gating.

### Store + Event Bus Pattern
**Source:** `src/state/create-store.ts` (full file), `src/events/event-bus.ts` (full file), `src/events/event-types.ts` (lines 30-32)
**Apply to:** `game-store.ts` modification, `event-types.ts` modification

Store uses `createStore<T>(initial, onChange)` with immer `produce`. Event bus uses `mitt<DomainEvents>()`. Character creation events already exist: `character_creation_started`, `character_creation_step_changed`, `character_created`. These should be reused or renamed for the narrative creation flow.

### YAML Loading + Zod Validation Pattern
**Source:** `src/codex/loader.ts` (lines 5-33)
**Apply to:** `guard-dialogue-loader.ts`

`Bun.file(path).text()` -> `parseYaml(text)` -> `Schema.safeParse(raw)` -> detailed error with file path, entry ID, field paths. This is the canonical data loading pattern for the project.

### NPC Prompt Template Pattern
**Source:** `src/ai/prompts/npc-system.ts` (full file)
**Apply to:** `guard-creation-prompt.ts`

Type definition for profile/context, template literal string builder function, Chinese prompt text, constraint rules list at the end. Prompt stays lean -- no conversation history, minimal context per call.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/ui/components/guard-name-input.tsx` | component | request-response | No `@inkjs/ui` TextInput usage exists in the codebase yet. Use RESEARCH.md code example (verified against Context7 docs) as the pattern source. |

---

## Metadata

**Analog search scope:** `src/` (all subdirectories)
**Files scanned:** 12 analog files read in full
**Pattern extraction date:** 2026-04-25
