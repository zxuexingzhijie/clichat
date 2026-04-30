# Phase 19: AI Output Quality - Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 6 (4 modified, 1 created, 1 test file with no existing analog)
**Analogs found:** 5 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/ai/schemas/narration-output.ts` | schema | transform | `src/ai/schemas/npc-dialogue.ts` | exact |
| `src/ai/roles/narrative-director.ts` | service | request-response | `src/ai/roles/narrative-director.ts` (self, pre-change) | self |
| `src/input/intent-classifier.ts` | service | request-response | `src/ai/roles/narrative-director.ts` (`callGenerateObject` pattern) | role-match |
| `src/ai/summarizer/summarizer-worker.ts` | service | event-driven | `src/app.tsx` useEffect cleanup pattern | partial |
| `src/app.tsx` | component | event-driven | `src/app.tsx` other useEffect blocks (lines 285-291) | self |
| Tests for each change | test | — | `src/ai/roles/narrative-director.test.ts`, `src/input/intent-classifier.test.ts`, `src/ai/summarizer/summarizer-worker.test.ts` | exact |

---

## Pattern Assignments

### `src/ai/schemas/narration-output.ts` (schema, transform) — NEW FILE

**Analog:** `src/ai/schemas/npc-dialogue.ts`

**Full file pattern** (lines 1-11):
```typescript
import { z } from 'zod';

export const NpcDialogueSchema = z.object({
  dialogue: z.string().min(10).max(300).describe('NPC对白，自然口语'),
  emotionTag: z.enum(['neutral', 'happy', 'angry', 'sad', 'fearful', 'amused', 'suspicious']),
  shouldRemember: z.boolean().describe('是否将此次互动写入NPC长期记忆'),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'hostile']).describe('NPC对玩家的态度倾向'),
});

export type NpcDialogue = z.infer<typeof NpcDialogueSchema>;
export type NpcSentiment = NpcDialogue['sentiment'];
```

**Adaptation for narration-output.ts:** Single-field schema with same `.min(10).max(300)` bounds. Export both the schema and its inferred type. File stays under 15 lines.

---

### `src/ai/roles/narrative-director.ts` — MODIFY `generateNarration` (lines 50-75)

**Analog:** `src/ai/utils/ai-caller.ts` `callGenerateObject` (lines 117-144) and existing `streamNarration` (lines 26-48)

**Current imports** (lines 1-10):
```typescript
import { getRoleConfig } from '../providers';
import { callGenerateText, callStreamText } from '../utils/ai-caller';
import {
  buildNarrativeSystemPrompt,
  buildNarrativeUserPrompt,
  type SceneType,
  type NarrativeUserPromptContext,
  type NarrativePromptContext,
} from '../prompts/narrative-system';
import { getFallbackNarration } from '../utils/fallback';
```

**Required import change:** Replace `callGenerateText` with `callGenerateObject` in the import on line 2. Add import for `NarrationOutputSchema` from `'../schemas/narration-output'`.

**callGenerateObject signature** (from `ai-caller.ts` lines 117-119):
```typescript
export async function callGenerateObject<T>(
  opts: GenerateObjectOptions<T>,  // BaseCallOptions + { schema: unknown }
): Promise<{ readonly object: T }>
```

**`GenerateObjectOptions<T>` shape** (from `ai-caller.ts` lines 70-72):
```typescript
type GenerateObjectOptions<T> = BaseCallOptions & {
  readonly schema: unknown;
};
```

**`BaseCallOptions` shape** (from `ai-caller.ts` lines 58-68) — all fields available from `getRoleConfig` + prompt builders:
```typescript
type BaseCallOptions = {
  readonly role: AiRole;
  readonly providerName: string;
  readonly model: () => LanguageModel;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly system: string;
  readonly prompt: string;
  readonly maxRetries?: number;
  readonly history?: ReadonlyArray<...>;
};
```

**Current `generateNarration` core** (lines 50-75 — the section being replaced):
```typescript
export async function generateNarration(
  context: NarrativeContext,
  options?: NarrativeOptions,
): Promise<string> {
  const config = getRoleConfig('narrative-director');
  const system = buildNarrativeSystemPrompt(context.sceneType, context.narrativeContext);
  const prompt = buildNarrativeUserPrompt(context as NarrativeUserPromptContext);

  try {
    const { text } = await callGenerateText({
      role: 'narrative-director',
      providerName: config.providerName,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      system,
      prompt,
      maxRetries: options?.maxRetries,
    });
    if (text.length > 300) return text.slice(0, 300);
    if (text.length < 10) return getFallbackNarration(context.sceneType);
    return text;
  } catch {
    return getFallbackNarration(context.sceneType);
  }
}
```

**Key delta:** Replace `callGenerateText(...)` → `callGenerateObject<{ text: string }>(...)` adding `schema: NarrationOutputSchema`. Destructure `{ object }` instead of `{ text }`. Return `object.text`. Remove the manual `.slice(0,300)` and `.length < 10` guards — Zod enforces them. The `catch` block and return type stay identical.

**`streamNarration` stays unchanged** (lines 26-48) — D-02 is locked.

---

### `src/input/intent-classifier.ts` — MODIFY `classifyIntent` (full file, 43 lines)

**Analog:** `src/ai/roles/narrative-director.ts` (pattern of `callGenerateObject` + `getRoleConfig`)

**Current imports** (lines 1-3):
```typescript
import { generateObject } from 'ai';
import { IntentSchema, type Intent } from '../types/intent';
import { getModel } from '../ai/providers';
```

**Required import change:** Drop `generateObject` from `'ai'` and `getModel` from providers. Add `callGenerateObject` from `'../ai/utils/ai-caller'` and `getRoleConfig` from `'../ai/providers'`.

**Current `ClassifyIntentOptions` type** (lines 11-14):
```typescript
export type ClassifyIntentOptions = {
  readonly maxRetries?: number;
  readonly model?: Parameters<typeof generateObject>[0]['model'];
};
```

**Required change:** Drop the `model?` field — `callGenerateObject` gets the model from `getRoleConfig`. Keep only `maxRetries?`.

**Current `classifyIntent` body** (lines 16-42) showing the retry loop to be replaced:
```typescript
export async function classifyIntent(
  input: string,
  sceneContext: string,
  options?: ClassifyIntentOptions,
): Promise<Intent> {
  const maxRetries = options?.maxRetries ?? 1;
  const model = (options?.model ?? getModel('retrieval-planner')) as import('ai').LanguageModel;
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
    `Intent classification failed after ${maxRetries + 1} attempts: ${...}`,
  );
}
```

**Key delta:** Replace the manual retry loop + `generateObject` call with a single `callGenerateObject` call using `role: 'retrieval-planner'` and the config from `getRoleConfig('retrieval-planner')`. `callGenerateObject` already handles retry, `recordUsage`, and `emitFailure`. The custom error message at line 39-41 is removed — `callGenerateObject` rethrows `lastError` directly.

**`getRoleConfig` return shape** (from `providers.ts` lines 24-30):
```typescript
export type RoleConfig = {
  readonly model: () => LanguageModel;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly providerName: string;
  readonly pricing?: ModelPricing;
};
```

**`'retrieval-planner'` role validity** (from `providers.ts` line 13): confirmed valid `AiRole`.

---

### `src/ai/summarizer/summarizer-worker.ts` — MODIFY `runSummarizerLoop` (lines 97-113)

**Analog:** No direct analog for AbortSignal loop pattern. Closest reference is `useEffect` cleanup in `src/app.tsx` (lines 279-283) which is the caller side.

**Current `runSummarizerLoop`** (lines 97-113 — full section being modified):
```typescript
export async function runSummarizerLoop(): Promise<void> {
  while (true) {
    const task = dequeuePending();
    if (!task) {
      await new Promise<void>((r) => setTimeout(r, 5000));
      continue;
    }

    markRunning(task.id);
    try {
      await dispatchTask(task);
      markDone(task.id);
    } catch {
      markFailed(task.id);
    }
  }
}
```

**Key delta:** Add `signal: AbortSignal` parameter. At the top of each iteration, add `if (signal.aborted) { console.error(...); return; }`. Optionally add a second check after `await dispatchTask(task)` (Claude's discretion — recommended for responsiveness). No other changes to the function body.

**`AbortSignal` is a Web API built-in** — no import needed.

---

### `src/app.tsx` — MODIFY `useEffect` at lines 279-283

**Analog:** The adjacent `useEffect` at lines 285-291 (cleanup-returning pattern):
```typescript
useEffect(() => {
  const cleanup = initExplorationTracker(
    { exploration: ctx.stores.exploration, game: ctx.stores.game },
    ctx.eventBus,
  );
  return cleanup;
}, [ctx]);
```

**Current summarizer useEffect** (lines 279-283 — the section being replaced):
```typescript
useEffect(() => {
  runSummarizerLoop().catch((err) => {
    console.error('[Summarizer] loop error:', err instanceof Error ? err.message : String(err));
  });
}, []);
```

**Key delta:** Add `AbortController` creation, `SIGINT` listener wiring via `process.on`, and return a cleanup function that calls both `controller.abort()` and `process.off('SIGINT', handleSigint)`. Pass `controller.signal` to `runSummarizerLoop(controller.signal)`. The `.catch` handler stays intact for other errors.

**`AbortController` is a Web API built-in** — no import needed.

---

## Shared Patterns

### `callGenerateObject` call shape
**Source:** `src/ai/utils/ai-caller.ts` lines 117-144
**Apply to:** `narrative-director.ts` (AI-05) and `intent-classifier.ts` (AI-06)

Required fields on every call:
```typescript
const config = getRoleConfig('<role>');
const { object } = await callGenerateObject<OutputType>({
  role: '<role>',
  providerName: config.providerName,
  model: config.model,
  temperature: config.temperature,
  maxTokens: config.maxTokens,
  system,
  prompt,
  maxRetries: options?.maxRetries,
  schema: SomeZodSchema,
});
return object.<field>;
```
`callGenerateObject` returns `{ readonly object: T }` — destructure `object`, not `text`.

### Zod schema file structure
**Source:** `src/ai/schemas/npc-dialogue.ts` lines 1-11
**Apply to:** `src/ai/schemas/narration-output.ts` (new file)

Pattern: `z.object({...})` export + `z.infer<typeof Schema>` type export. One schema per file. Filename matches schema name in kebab-case.

### Error handling in AI service functions
**Source:** `src/ai/roles/narrative-director.ts` lines 58-74
**Apply to:** `narrative-director.ts` modified `generateNarration`

```typescript
try {
  const { object } = await callGenerateObject<T>({ ... });
  return object.field;
} catch {
  return getFallback();
}
```
`callGenerateObject` already retries and emits failure internally. The outer `catch` is only for final-fallback after all retries exhausted.

### useEffect with cleanup
**Source:** `src/app.tsx` lines 285-291
**Apply to:** `src/app.tsx` summarizer `useEffect` (AI-07)

Pattern: cleanup function returned from `useEffect`. Named function references (not inline arrows) required for `process.off` de-registration by identity.

---

## Test Pattern Changes

### `narrative-director.test.ts` — mock target changes
**Source:** `src/ai/roles/narrative-director.test.ts` lines 1-39

Current mock setup mocks `generateText` from `'ai'` (line 4) and asserts `mockGenerateText.toHaveBeenCalledTimes(1)`. After the change:
- `mockGenerateText` assertions become stale — replace with `mockGenerateObject`
- `mockGenerateObject` must return `{ object: { text: '...' }, usage: mockUsage }` (the `object` wrapper is mandatory — `callGenerateObject` destructures `result.object`)
- The `mockGenerateObject` mock at line 17 is already declared but unused — it becomes the primary mock
- The truncation test (line 69-75) changes: instead of asserting `result.length <= 300`, assert that the call returns fallback when schema rejects out-of-range text (or remove the truncation test — Zod handles it at the AI SDK level)

**Current mock declarations** (lines 3-23) — both mocks already declared:
```typescript
const mockUsage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };
const mockGenerateText = mock(() => Promise.resolve({ text: '', usage: mockUsage }));
// ...
const mockGenerateObject = mock(() => Promise.resolve({ object: {}, usage: mockUsage }));

mock.module('ai', () => ({
  generateText: mockGenerateText,
  generateObject: mockGenerateObject,
  streamText: mockStreamText,
}));
```

### `intent-classifier.test.ts` — error message assertion update
**Source:** `src/input/intent-classifier.test.ts` lines 99-107

Current test asserts exact error string `'Intent classification failed after 2 attempts'` (line 106). After switching to `callGenerateObject`, the error is rethrown from the AI SDK mock directly — update to `.rejects.toThrow(Error)` (any error) or match the mock's error message.

The `mockGenerateObject` mock at the `'ai'` module boundary continues to work (same mock target as now) — no mock location change needed.

New test to add: assert `recordUsage` was called with role `'retrieval-planner'` after a successful `classifyIntent` call. Requires mocking `'../../state/cost-session-store'` in the test file.

### `summarizer-worker.test.ts` — new tests for AbortSignal
**Source:** `src/ai/summarizer/summarizer-worker.test.ts` (existing structure — no `runSummarizerLoop` tests currently)

The existing mock setup (lines 1-27) mocks `summarizer-queue`, `npc-memory-store`, and `memory-summarizer`. The new tests need to import `runSummarizerLoop` alongside `applyNpcMemoryCompression`.

New tests required:
1. Signal pre-aborted: create `AbortController`, call `.abort()` before `runSummarizerLoop(controller.signal)`, assert resolves without rejection and `dequeuePending` is never called
2. Signal aborted after first idle cycle: assert loop exits without unhandled rejection when signal aborts while waiting in the 5000ms timeout

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `runSummarizerLoop` AbortSignal pattern | service | event-driven | No existing AbortSignal-accepting infinite loop in codebase; closest is `useEffect` cleanup side |

---

## Metadata

**Analog search scope:** `src/ai/`, `src/input/`, `src/app.tsx`
**Files scanned:** 8 source files + 3 test files
**Pattern extraction date:** 2026-04-30
