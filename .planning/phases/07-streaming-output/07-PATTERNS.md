# Phase 7: Streaming Output - Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 9 (3 new, 6 modified)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/ai/utils/sentence-buffer.ts` | utility | transform/streaming | `src/ai/utils/npc-knowledge-filter.ts` | role-match |
| `src/ai/utils/metadata-extractor.ts` | utility | transform | `src/ai/utils/fallback.ts` | role-match |
| `src/ui/hooks/use-npc-dialogue.ts` | hook | streaming | `src/ui/hooks/use-ai-narration.ts` | exact |
| `src/ai/roles/npc-actor.ts` | service | streaming | `src/ai/roles/narrative-director.ts` | exact |
| `src/ui/hooks/use-ai-narration.ts` | hook | streaming | (self -- existing file, modify in place) | exact |
| `src/ui/hooks/use-game-input.ts` | hook | event-driven | (self -- existing file, modify in place) | exact |
| `src/ui/panels/scene-panel.tsx` | component | streaming | (self -- existing file, modify in place) | exact |
| `src/ui/screens/game-screen.tsx` | component | request-response | (self -- existing file, modify in place) | exact |
| `src/events/event-types.ts` | config | event-driven | (self -- existing file, modify in place) | exact |

## Pattern Assignments

### `src/ai/utils/sentence-buffer.ts` (NEW -- utility, transform/streaming)

**Analog:** `src/ai/utils/npc-knowledge-filter.ts` (structural pattern), `src/ai/utils/fallback.ts` (export style)

Both analogs are small, focused utility files: typed inputs, pure functions, no dependencies on React or AI SDK.

**Imports pattern** (`npc-knowledge-filter.ts` lines 1):
```typescript
// AI utils use typed imports from project modules, no external dependencies
import type { CodexEntry } from '../../codex/schemas/entry-types';
```

For `sentence-buffer.ts`, no imports are needed -- it is a self-contained utility with only TypeScript primitives. Follow the same "typed export, no framework deps" convention.

**Core pattern** (`npc-knowledge-filter.ts` lines 11-40):
```typescript
// Pure function with readonly typed input, returns filtered result
export function filterCodexForNpc(
  entries: readonly CodexEntry[],
  npc: NpcFilterContext,
): readonly CodexEntry[] {
  return entries.filter(entry => {
    // ... deterministic filtering logic ...
  });
}
```

**Type definition pattern** (`npc-knowledge-filter.ts` lines 2-9):
```typescript
export type NpcFilterContext = {
  readonly npcId: string;
  readonly npcFactionIds: readonly string[];
  readonly npcProfession: string;
  readonly npcLocationId: string;
  readonly npcRegion: string;
};
```

The sentence buffer should export types (`SentenceBufferOptions`, `SentenceBuffer`) and a factory function (`createSentenceBuffer`) following the same `readonly` property convention.

**Test pattern** (`fallback.test.ts` lines 1-3):
```typescript
import { describe, test, expect } from 'bun:test';
import { getFallbackNarration, getFallbackDialogue } from './fallback';
```

Corresponding test file: `src/ai/utils/sentence-buffer.test.ts`, using `bun:test` with `describe/test/expect`.

---

### `src/ai/utils/metadata-extractor.ts` (NEW -- utility, transform)

**Analog:** `src/ai/utils/fallback.ts`

Small utility that takes raw text and returns a typed NpcDialogue-compatible metadata object. Same structural pattern as `fallback.ts`.

**Imports pattern** (`fallback.ts` line 1):
```typescript
import type { NpcDialogue } from '../schemas/npc-dialogue';
```

For `metadata-extractor.ts`, import the type or a subset type from the same schema file.

**Core pattern** (`fallback.ts` lines 18-25):
```typescript
// Returns a typed object matching NpcDialogueSchema structure
export function getFallbackDialogue(npcName: string): NpcDialogue {
  return {
    dialogue: `${npcName}沉默地看着你，似乎不想多说什么。`,
    emotionTag: 'neutral',
    shouldRemember: false,
    relationshipDelta: 0,
  };
}
```

The metadata extractor should return the same shape (minus `dialogue` field) from raw text analysis.

**Schema reference** (`npc-dialogue.ts` lines 1-10):
```typescript
import { z } from 'zod';

export const NpcDialogueSchema = z.object({
  dialogue: z.string().min(10).max(300).describe('NPC对白，自然口语'),
  emotionTag: z.enum(['neutral', 'happy', 'angry', 'sad', 'fearful', 'amused', 'suspicious']),
  shouldRemember: z.boolean().describe('是否将此次互动写入NPC长期记忆'),
  relationshipDelta: z.number().min(-0.5).max(0.5).describe('关系值变化建议'),
});

export type NpcDialogue = z.infer<typeof NpcDialogueSchema>;
```

The extractor output must conform to the `emotionTag` enum values and `relationshipDelta` range defined here.

---

### `src/ui/hooks/use-npc-dialogue.ts` (NEW -- hook, streaming)

**Analog:** `src/ui/hooks/use-ai-narration.ts` (exact match)

This is a near-clone of `useAiNarration`, adapted for NPC dialogue streaming. Mirror the entire structure.

**Imports pattern** (lines 1-3):
```typescript
import { useState, useCallback, useRef } from 'react';
import type { NarrativeContext } from '../../ai/roles/narrative-director';
import { streamNarration } from '../../ai/roles/narrative-director';
```

For `use-npc-dialogue.ts`, replace with NPC actor imports:
```typescript
import { useState, useCallback, useRef } from 'react';
import type { NpcProfile } from '../../ai/prompts/npc-system';
// import { streamNpcDialogue } from '../../ai/roles/npc-actor';  // new function
```

**Return type pattern** (lines 5-11):
```typescript
export type UseAiNarrationReturn = {
  readonly narrationText: string;
  readonly isStreaming: boolean;
  readonly error: Error | null;
  readonly startNarration: (context: NarrativeContext) => void;
  readonly reset: () => void;
};
```

**Core hook pattern** (lines 13-58):
```typescript
export function useAiNarration(): UseAiNarrationReturn {
  const [narrationText, setNarrationText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cancelledRef = useRef(false);

  const startNarration = useCallback((context: NarrativeContext) => {
    cancelledRef.current = false;
    setIsStreaming(true);
    setError(null);
    setNarrationText('');

    (async () => {
      try {
        const stream = streamNarration(context);
        for await (const chunk of stream) {
          if (cancelledRef.current) break;
          setNarrationText(prev => prev + chunk);
        }
      } catch (err) {
        if (!cancelledRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelledRef.current) {
          setIsStreaming(false);
        }
      }
    })();
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    setNarrationText('');
    setIsStreaming(false);
    setError(null);
  }, []);

  return { narrationText, isStreaming, error, startNarration, reset };
}
```

The NPC dialogue hook mirrors this exactly but: (1) consumes `streamNpcDialogue()` instead, (2) adds `skippedRef` for skip-to-end, (3) integrates `createSentenceBuffer` for buffered flushing, (4) runs `extractNpcMetadata` on stream completion.

---

### `src/ai/roles/npc-actor.ts` (MODIFY -- service, streaming)

**Analog:** `src/ai/roles/narrative-director.ts` `streamNarration()` (lines 26-88)

The new `streamNpcDialogue()` async generator must mirror `streamNarration()` exactly, substituting NPC prompts for narrative prompts.

**Imports to add** (follow `narrative-director.ts` lines 1-2):
```typescript
import { streamText } from 'ai';
// generateObject already imported
```

**Async generator signature** (`narrative-director.ts` lines 26-29):
```typescript
export async function* streamNarration(
  context: NarrativeContext,
  options?: NarrativeOptions,
): AsyncGenerator<string> {
```

**Anthropic branching pattern** (`narrative-director.ts` lines 39-68):
```typescript
if (config.providerName === 'anthropic') {
  result = streamText({
    model: config.model(),
    temperature: config.temperature,
    maxOutputTokens: config.maxTokens,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: system,
            providerOptions: {
              anthropic: { cacheControl: { type: 'ephemeral' } },
            },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });
} else {
  result = streamText({
    model: config.model(),
    temperature: config.temperature,
    maxOutputTokens: config.maxTokens,
    system,
    prompt,
  });
}
```

**Stream consumption + usage recording** (`narrative-director.ts` lines 70-74):
```typescript
for await (const chunk of result.textStream) {
  yield chunk;
}
const usage = await result.usage;
recordUsage('narrative-director', { inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0, totalTokens: usage.totalTokens ?? 0 });
```

**Error handling + fallback** (`narrative-director.ts` lines 76-87):
```typescript
} catch (err) {
  if (attempt === maxRetries) {
    eventBus.emit('ai_call_failed', {
      role: 'narrative-director',
      error: err instanceof Error ? err.message : String(err),
    });
    recordUsage('narrative-director', { inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    yield getFallbackNarration(context.sceneType);
    return;
  }
}
```

For `npc-actor.ts`, change role to `'npc-actor'`, use `buildNpcSystemPrompt`/`buildNpcUserPrompt`, and yield `getFallbackDialogue(npcProfile.name).dialogue` on final failure.

---

### `src/ui/hooks/use-ai-narration.ts` (MODIFY -- hook, streaming)

**Self-analog** -- the existing file is the starting point. Modifications add:

1. `skippedRef` alongside existing `cancelledRef`
2. `createSentenceBuffer` integration between stream loop and `setNarrationText`
3. `handleSkip` callback exposed in return type
4. `fullTextRef` to accumulate all received text regardless of skip state

The existing cancel pattern (lines 17, 29, 44-46) shows how to use refs for flow control:
```typescript
const cancelledRef = useRef(false);
// ...
if (cancelledRef.current) break;
// ...
cancelledRef.current = true;
```

The skip pattern should mirror this but NOT break the loop -- just flush buffer and stop animation while stream continues.

---

### `src/ui/hooks/use-game-input.ts` (MODIFY -- hook, event-driven)

**Self-analog** -- current file is 46 lines. Modifications are minimal: no structural changes needed in this file itself. Skip detection happens in `game-screen.tsx`'s `useInput` callback (lines 218-240), which already handles keyboard dispatch during different modes.

The skip-to-end key detection pattern should follow the existing `useInput` structure in `game-screen.tsx` (line 218):
```typescript
useInput(useCallback((input: string, key: { escape: boolean; tab?: boolean }) => {
  // ... mode-specific key handling ...
}, [/* deps */]));
```

Add a branch for `inputMode === 'processing'` that checks `key.return || input === ' '` and calls the skip handler.

---

### `src/ui/panels/scene-panel.tsx` (MODIFY -- component, streaming)

**Self-analog** -- current file is 18 lines.

**Current props pattern** (lines 4-6):
```typescript
type ScenePanelProps = {
  readonly lines: readonly string[];
};
```

Add `streamingText?: string` and `isStreaming?: boolean` props. The streaming line renders below static lines with a dim indicator.

**Current render pattern** (lines 8-18):
```typescript
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

Extend with a conditional streaming line after the `lines.map()` block. Use `<Text dimColor>` for the streaming indicator (matching existing dim style on line 12).

---

### `src/ui/screens/game-screen.tsx` (MODIFY -- component, request-response)

**Self-analog** -- the `handleActionExecute` callback (lines 137-172) is the primary modification target.

**Current non-streaming narration call** (lines 150-159):
```typescript
try {
  const narration = await generateNarration({
    sceneType: 'exploration',
    codexEntries: [],
    playerAction: action.label,
    recentNarration: sceneState.narrationLines.slice(-3),
    sceneContext: sceneState.locationName ?? '',
  });
  sceneStore.setState(draft => {
    draft.narrationLines = [...draft.narrationLines, narration];
  });
```

Replace with `useAiNarration` hook consumption. The hook is already instantiated elsewhere -- wire `startNarration()` call here. The `sceneStore.setState` pattern for appending lines (line 158-160) remains the same for committing final text.

**Import pattern** (line 27):
```typescript
import { generateNarration } from '../../ai/roles/narrative-director';
```

Replace/augment with hook import:
```typescript
import { useAiNarration } from '../hooks/use-ai-narration';
```

**useInput handler for skip** (lines 218-240) -- add a processing-mode branch:
```typescript
// Existing pattern:
useInput(useCallback((input: string, key: { escape: boolean; tab?: boolean }) => {
  if ((input === '/' || key.tab) && !isTyping && ...) {
    setInputMode('input_active');
    return;
  }
  // ... Add here:
  // if (inputMode === 'processing' && (key.return || input === ' ')) {
  //   handleSkip();
  //   return;
  // }
```

---

### `src/events/event-types.ts` (MODIFY -- config, event-driven)

**Self-analog** -- add NPC streaming events following the existing narration streaming event pattern.

**Existing narration events** (lines 37-38):
```typescript
narration_streaming_started: { sceneType: string };
narration_streaming_completed: { charCount: number };
```

Add parallel NPC events:
```typescript
npc_dialogue_streaming_started: { npcId: string; npcName: string };
npc_dialogue_streaming_completed: { npcId: string; charCount: number };
```

---

## Shared Patterns

### Retry + Anthropic Branch + Usage Recording (AI Layer)
**Source:** `src/ai/roles/narrative-director.ts` lines 35-87
**Apply to:** New `streamNpcDialogue()` in `npc-actor.ts`

Every AI role function follows this exact structure:
1. `for (let attempt = 0; attempt <= maxRetries; attempt++)` retry loop
2. `if (config.providerName === 'anthropic')` branch for message format
3. `recordUsage(role, { ... })` after stream completes
4. `eventBus.emit('ai_call_failed', { role, error })` on final failure
5. Fallback return/yield on exhausted retries

```typescript
for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    let result: ReturnType<typeof streamText>;
    if (config.providerName === 'anthropic') {
      result = streamText({ /* messages format */ });
    } else {
      result = streamText({ /* system/prompt format */ });
    }
    for await (const chunk of result.textStream) { yield chunk; }
    const usage = await result.usage;
    recordUsage(role, { /* ... */ });
    return;
  } catch (err) {
    if (attempt === maxRetries) {
      eventBus.emit('ai_call_failed', { role, error: /* ... */ });
      yield fallbackText;
      return;
    }
  }
}
```

### Hook Lifecycle Pattern (UI Layer)
**Source:** `src/ui/hooks/use-ai-narration.ts` lines 13-58
**Apply to:** New `use-npc-dialogue.ts`

All streaming hooks follow:
1. `useState` for text, isStreaming, error
2. `useRef` for cancellation/skip control
3. `useCallback` wrapping an IIFE async function
4. `for await` consuming the async generator with ref checks
5. `finally` block for cleanup
6. `reset` callback that sets ref + clears state

### Store State Update Pattern
**Source:** `src/ui/screens/game-screen.tsx` lines 158-160
**Apply to:** All places that commit streamed text to ScenePanel

```typescript
sceneStore.setState(draft => {
  draft.narrationLines = [...draft.narrationLines, narration];
});
```

Immutable array spread inside immer `setState` -- consistent with project's immutability convention.

### Event Bus Emission Pattern
**Source:** `src/events/event-bus.ts` + `src/events/event-types.ts`
**Apply to:** Stream lifecycle events in hooks

```typescript
import { eventBus } from '../../events/event-bus';

// Emit typed events
eventBus.emit('narration_streaming_started', { sceneType: '...' });
eventBus.emit('narration_streaming_completed', { charCount: fullText.length });
```

### Test File Pattern
**Source:** `src/ai/utils/fallback.test.ts` lines 1-3
**Apply to:** All new test files (`sentence-buffer.test.ts`, `metadata-extractor.test.ts`, `use-ai-narration.test.ts`)

```typescript
import { describe, test, expect } from 'bun:test';
import { targetFunction } from './target-module';

describe('targetFunction', () => {
  test('does the thing', () => {
    expect(targetFunction(input)).toBe(expected);
  });
});
```

Uses `bun:test` (not jest), `describe/test/expect` (not `it`). Note: `use-game-input.test.ts` uses `it` instead of `test` -- prefer `test` to match the more common convention in `fallback.test.ts`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | -- | -- | All files have close analogs in the existing codebase |

Every new file has an exact or role-match analog. The sentence buffer is novel in concept but structurally follows the same "typed pure utility" pattern as other `src/ai/utils/` files.

## Metadata

**Analog search scope:** `src/ai/`, `src/ui/`, `src/events/`
**Files scanned:** 15 (7 primary analogs + 4 test files + 4 supporting files)
**Pattern extraction date:** 2026-04-24
