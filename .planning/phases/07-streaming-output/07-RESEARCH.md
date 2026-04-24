# Phase 7: Streaming Output - Research

**Researched:** 2026-04-24
**Domain:** AI SDK streaming, React/Ink terminal UI real-time rendering, async generator buffering
**Confidence:** HIGH

## Summary

Phase 7 transforms narration and NPC dialogue from batch (generate-then-display) to streaming (render-as-generated). The codebase already has the foundation: `streamNarration()` in `narrative-director.ts` is a working async generator wrapping AI SDK v5 `streamText`, and `useAiNarration` hook in `use-ai-narration.ts` already consumes it with cancel support. The work is: (1) add a punctuation-based buffer layer so UI refreshes at sentence boundaries, (2) wire the hook into `game-screen.tsx` replacing the current `generateNarration()` call, (3) create a parallel `streamNpcDialogue()` path in `npc-actor.ts` with post-extraction of metadata, and (4) implement skip-to-end via Enter/Space keypress during `processing` mode.

The key architectural challenge is the buffer: LLM tokens arrive as short fragments (1-5 Chinese chars), but the UI should refresh at sentence boundaries (。！？…) with a timeout fallback. This is a pure data-flow problem -- the buffer sits between the async generator and the React state setter. No new dependencies are needed.

**Primary recommendation:** Build a shared `createSentenceBuffer(onFlush)` utility that both narration and NPC dialogue hooks consume, keeping the buffer logic testable and UI-independent.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (Dual-layer architecture):** Bottom layer receives LLM tokens via `streamNarration()`; UI layer does lightweight buffering, flushing to ScenePanel at sentence/event-block boundaries. Not character-by-character rendering.
- **D-02 (Flush strategy):** Punctuation-first + timeout fallback -- flush buffer on Chinese sentence-ending punctuation (。！？…); if no punctuation arrives within a time threshold, force-flush current buffer content.
- **D-03 (Integration point):** `game-screen.tsx` `handleActionExecute` switches from `generateNarration()` to `useAiNarration` hook. ScenePanel needs a "streaming line" that becomes a normal line when stream completes.
- **D-04 (Stream-native):** Use AI SDK `streamText` native stream speed; no buffer-then-animate. Player sees content immediately as it arrives.
- **D-05 (Stream text + post-extract metadata):** NPC dialogue uses `streamText` for streaming display; metadata (emotion, memory flag, relationship delta) extracted from complete text after stream ends. Extraction via rule parsing or lightweight LLM post-processing.
- **D-06 (generateObject preserved):** Original `generateObject` path retained as fallback when `streamText` fails or metadata extraction is incomplete.
- **D-07 (UI consistency):** NPC dialogue and narration use identical sentence-boundary buffer flush strategy.
- **D-08 (Skip stops animation, not stream):** Skip-to-end immediately displays all received content; LLM stream continues in background to completion, then silently replaces displayed content with full text and runs metadata extraction.
- **D-09 (Trigger keys):** Only Enter or Space trigger skip-to-end. Other keys ignored during streaming.
- **D-10 (State transition):** After skip, `inputMode` stays `processing` until stream truly completes and post-processing finishes, then transitions to `action_select`.

### Claude's Discretion
- Buffer timeout threshold in milliseconds (recommended 300-800ms range)
- NPC dialogue metadata post-extraction implementation (regex vs lightweight LLM call)
- `useAiNarration` hook modification details (adding buffer layer, skip signal)
- ScenePanel streaming line cursor/indicator style (blinking cursor or dim ellipsis)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STREAM-01 | AI narration streams character-by-character as typewriter effect in scene panel | Existing `streamNarration()` async generator + `useAiNarration` hook provide the streaming pipeline. Buffer layer + ScenePanel streaming line prop complete the implementation. |
| STREAM-02 | NPC dialogue streams with same typewriter effect | New `streamNpcDialogue()` function in `npc-actor.ts` using `streamText` + shared buffer utility. `generateNpcDialogue` retained as fallback (D-06). |
| STREAM-03 | Player interrupts streaming with any key to see full text immediately | Enter/Space detection in `useInput` during `processing` mode; skip signal via ref; stream continues in background (D-08). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| LLM streaming (token generation) | API / Backend (AI SDK) | -- | `streamText` manages the HTTP connection to LLM providers |
| Token buffering (sentence boundaries) | Shared utility | -- | Pure function, no UI or API dependency; testable in isolation |
| Streaming text rendering | Frontend (React/Ink) | -- | ScenePanel component, React state updates |
| Skip-to-end input handling | Frontend (React/Ink) | -- | Ink `useInput` hook in game-screen |
| NPC metadata post-extraction | Shared utility | API (optional LLM) | Regex first, LLM fallback -- sits between AI and UI layers |
| Stream lifecycle management | Frontend (React hooks) | -- | `useAiNarration` / `useNpcDialogue` hooks own async lifecycle |

## Standard Stack

### Core (already installed -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ai (AI SDK v5) | 5.0.179 | `streamText` for LLM streaming | Already used in `streamNarration()`. Provides `textStream` async iterable, `onFinish`/`onAbort` callbacks, `abortSignal` support. [VERIFIED: node_modules/ai/package.json] |
| React | 19.2.5 | Component model, hooks (`useState`, `useCallback`, `useRef`, `useEffect`) | Already the UI foundation. [VERIFIED: package.json] |
| ink | 7.0.1 | Terminal renderer, `useInput` for keyboard capture | Already used. `useInput` provides `key.return` (Enter) and `input === ' '` (Space) detection needed for skip. [VERIFIED: Context7 /vadimdemedes/ink] |
| mitt | 3.0.1 | Event bus for stream lifecycle events | Already used. Event types `narration_streaming_started` and `narration_streaming_completed` already defined in `event-types.ts`. [VERIFIED: src/events/event-types.ts] |

### Supporting (no new packages needed)

No new packages required. The sentence buffer is a ~30-line utility function. Metadata post-extraction uses regex on Chinese text patterns already present in the NPC prompt system.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom sentence buffer | RxJS Observable with `bufferWhen` | Massive dependency for a 30-line function. Not worth it. |
| Regex metadata extraction | Always use LLM for post-extraction | Adds latency and cost after every NPC turn. Regex handles 90%+ of cases. |
| `streamText` for NPC | `streamObject` (AI SDK) | `streamObject` streams partial JSON -- but we need readable text for the typewriter effect, not partial schema fragments. D-05 explicitly chose streamText + post-extract. |

**Installation:** No new packages to install.

## Architecture Patterns

### System Architecture Diagram

```
Player Action (Enter on suggested action)
        |
        v
game-screen.tsx handleActionExecute
        |
        +---> gameLoop.processInput(action)  [Rules Engine adjudicates]
        |
        v
useAiNarration hook / useNpcDialogue hook
        |
        v
streamNarration() / streamNpcDialogue()  [AI layer -- async generators]
        |
        +---> AI SDK streamText()  [HTTP stream to LLM provider]
        |
        v
Async generator yields token chunks (1-5 chars each)
        |
        v
createSentenceBuffer(onFlush)  [Buffer layer]
        |
        +---> Accumulates tokens
        +---> On 。！？… punctuation --> flush to React state
        +---> On timeout (e.g. 500ms) --> force-flush
        |
        v
ScenePanel renders:
  - Existing lines: string[]           (static, completed)
  - Streaming line: streamingText?      (animated, in-progress)
        |
        |   [Player presses Enter/Space during streaming]
        v
Skip signal (ref.current = true)
        |
        +---> UI immediately shows all buffered content as complete line
        +---> Stream continues in background
        +---> onFinish: silently replace with full text + extract metadata
        +---> inputMode transitions processing --> action_select
```

### Recommended Project Structure

```
src/
  ai/
    roles/
      narrative-director.ts        # [MODIFY] already has streamNarration(), no changes needed
      npc-actor.ts                 # [MODIFY] add streamNpcDialogue() async generator
    utils/
      sentence-buffer.ts           # [NEW] createSentenceBuffer utility
      metadata-extractor.ts        # [NEW] extractNpcMetadata from raw dialogue text
  ui/
    hooks/
      use-ai-narration.ts          # [MODIFY] add buffer layer, skip signal, flush to ScenePanel
      use-npc-dialogue.ts          # [NEW] hook for streaming NPC dialogue (mirrors useAiNarration)
      use-game-input.ts            # [MODIFY] add skip detection during processing mode
    panels/
      scene-panel.tsx              # [MODIFY] add streamingText prop for in-progress line
    screens/
      game-screen.tsx              # [MODIFY] wire useAiNarration, handle skip, update ScenePanel
  events/
    event-types.ts                 # [MODIFY] add npc_dialogue_streaming_started/completed if needed
```

### Pattern 1: Sentence Boundary Buffer

**What:** A stateless utility that accepts token chunks and calls `onFlush(bufferedText)` at sentence boundaries or after a timeout.

**When to use:** Between async generator output and React state updates for both narration and NPC dialogue (D-07 mandates shared strategy).

**Example:**
```typescript
// Source: Custom pattern based on D-01, D-02 decisions
type SentenceBufferOptions = {
  readonly onFlush: (text: string) => void;
  readonly timeoutMs?: number; // default 500ms
};

type SentenceBuffer = {
  readonly push: (chunk: string) => void;
  readonly flush: () => void;
  readonly dispose: () => void;
};

const SENTENCE_END_PATTERN = /[。！？…\n]/;

function createSentenceBuffer(options: SentenceBufferOptions): SentenceBuffer {
  const timeoutMs = options.timeoutMs ?? 500;
  let buffer = '';
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const doFlush = () => {
    if (timerId) { clearTimeout(timerId); timerId = null; }
    if (buffer.length > 0) {
      options.onFlush(buffer);
      buffer = '';
    }
  };

  const resetTimer = () => {
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(doFlush, timeoutMs);
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      if (SENTENCE_END_PATTERN.test(chunk)) {
        doFlush();
      } else {
        resetTimer();
      }
    },
    flush: doFlush,
    dispose() {
      if (timerId) clearTimeout(timerId);
      buffer = '';
    },
  };
}
```
[ASSUMED — pattern derived from D-01/D-02 decisions, not from an external library]

### Pattern 2: Skip-to-End with Background Stream Continuation

**What:** When skip is triggered, UI immediately renders all received text. The LLM stream continues to completion in the background, after which the displayed text is silently replaced with the full output.

**When to use:** D-08 mandates this -- "stop animation, not stream."

**Example:**
```typescript
// Source: Custom pattern based on D-08, D-09, D-10 decisions
// In the useAiNarration hook:

const skippedRef = useRef(false);
const fullTextRef = useRef('');

// When skip signal fires:
const handleSkip = useCallback(() => {
  skippedRef.current = true;
  // Show everything received so far as a complete line
  commitCurrentTextToScenePanel(fullTextRef.current);
  // Stream keeps running -- onFinish will handle final replacement
}, []);

// In the streaming loop:
for await (const chunk of stream) {
  fullTextRef.current += chunk;
  if (!skippedRef.current) {
    sentenceBuffer.push(chunk);
  }
  // If skipped, we still accumulate but don't animate
}

// After stream completes:
// Replace displayed text with fullTextRef.current (may have more content)
// Run metadata extraction if NPC dialogue
// Transition inputMode to action_select
```
[ASSUMED — pattern derived from D-08 decision]

### Pattern 3: NPC Metadata Post-Extraction

**What:** After streaming NPC dialogue text completes, extract structured metadata (emotionTag, shouldRemember, relationshipDelta) from the raw text using regex patterns.

**When to use:** D-05 mandates streaming text first, metadata extraction after.

**Example:**
```typescript
// Source: Custom pattern based on D-05 decision + existing NpcDialogueSchema
type ExtractedMetadata = {
  readonly emotionTag: string;
  readonly shouldRemember: boolean;
  readonly relationshipDelta: number;
};

function extractNpcMetadata(rawText: string, npcName: string): ExtractedMetadata {
  // Emotion detection via Chinese sentiment keywords
  const emotionPatterns: Record<string, RegExp> = {
    angry: /[怒愤恨]/,
    happy: /[笑喜乐]/,
    sad: /[哭悲伤]/,
    fearful: /[怕惧恐]/,
    suspicious: /[疑狐嫌]/,
    amused: /[趣哈嘿]/,
  };

  let emotionTag = 'neutral';
  for (const [tag, pattern] of Object.entries(emotionPatterns)) {
    if (pattern.test(rawText)) { emotionTag = tag; break; }
  }

  const shouldRemember = rawText.length > 50; // meaningful dialogue
  const relationshipDelta = 0; // neutral default; adjustable

  return { emotionTag, shouldRemember, relationshipDelta };
}
```
[ASSUMED — the specific regex patterns are a starting point; Claude's Discretion allows choosing between regex and LLM]

### Anti-Patterns to Avoid

- **Buffer-then-animate:** Waiting for the full LLM response, then playing a typewriter animation on the complete text. Violates D-04 (stream-native). The player must see content arriving as the LLM generates it.
- **Character-by-character React state updates:** Calling `setState` for every single character. React/Ink will batch but this creates unnecessary render overhead. The sentence buffer exists precisely to batch at meaningful boundaries.
- **Cancelling the LLM stream on skip:** Violates D-08. Tokens are already paid for. Let the stream complete, use the full result.
- **Putting buffer logic inside React components:** The buffer is pure data flow; keeping it as a standalone utility makes it testable without React rendering infrastructure.
- **Using `streamObject` for NPC dialogue streaming:** `streamObject` emits partial JSON, not readable Chinese text. The typewriter effect needs coherent text fragments, not `{"dialogue":"你好..."}`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM token streaming | Custom HTTP/SSE parser | AI SDK `streamText` + `textStream` iterable | AI SDK handles all provider differences, retries, abort signals, and usage tracking |
| Keyboard input detection | Raw stdin listener | Ink `useInput` hook | Ink already normalizes key events across terminals; `key.return` and `input === ' '` are all we need for D-09 |
| Async generator iteration | Manual Promise chains | `for await...of` on `textStream` | Native async iteration is the correct pattern for consuming AI SDK streams |
| State management | React Context / Redux | Existing `createStore` + `sceneStore.setState` | Established project pattern; adding another state layer would be inconsistent |

**Key insight:** This phase requires zero new dependencies. Every building block already exists in the codebase or in the standard language/framework APIs.

## Common Pitfalls

### Pitfall 1: Race Condition Between Skip and Stream Completion
**What goes wrong:** Player presses skip at the exact moment the stream finishes. Two code paths (skip handler and onFinish handler) both try to commit text to ScenePanel simultaneously.
**Why it happens:** Async generator completion and keyboard events are independent async channels.
**How to avoid:** Use a single atomic ref (`skippedRef`) checked in both paths. The `onFinish` path always runs the "finalize" logic (metadata extraction, inputMode transition) regardless of skip state. The skip handler only controls animation, not lifecycle.
**Warning signs:** Text appearing twice in ScenePanel, or inputMode getting stuck in `processing`.

### Pitfall 2: Timer Leak on Unmount
**What goes wrong:** The sentence buffer's timeout fires after the component unmounts, calling `setState` on an unmounted component.
**Why it happens:** `setTimeout` callbacks aren't automatically cleaned up.
**How to avoid:** Call `sentenceBuffer.dispose()` in the hook's cleanup (`useEffect` return). Also clear on stream completion.
**Warning signs:** React warnings about setState on unmounted components (though Ink may not surface these the same way browsers do).

### Pitfall 3: Stale Closure in useCallback Skip Handler
**What goes wrong:** The skip handler captures an old `fullTextRef.current` value because it was defined in a stale closure.
**Why it happens:** React's useCallback memoizes the function body; if the ref is read inside a closure that doesn't update, you get stale data.
**How to avoid:** Refs (`useRef`) don't suffer from stale closures because they're accessed via `.current` at call time, not at definition time. Ensure skip reads from refs, not state variables.
**Warning signs:** Skip shows empty or partial text when it should show everything received so far.

### Pitfall 4: ScenePanel Re-renders on Every Buffer Flush
**What goes wrong:** Every flush triggers a full ScenePanel re-render including all historical lines.
**Why it happens:** ScenePanel receives `lines: string[]` as a prop; if the array reference changes, React re-renders.
**How to avoid:** Only the streaming line prop (`streamingText`) changes during active streaming. Historical `lines` array should remain referentially stable (same object) while streaming is active. Split the props: `lines` for completed content, `streamingText` for the in-progress line.
**Warning signs:** Visible flicker or sluggishness during rapid token arrival.

### Pitfall 5: NPC Metadata Extraction Fails Silently
**What goes wrong:** Regex-based metadata extraction returns incorrect defaults, and the game proceeds with wrong emotion/relationship data.
**Why it happens:** Chinese text patterns are complex; the regex may not match the LLM's actual output format.
**How to avoid:** D-06 mandates `generateObject` as fallback. If regex extraction returns all-default values (neutral emotion, 0 delta, false remember) AND the dialogue is substantive (>50 chars), fall back to `generateObject` for that turn's metadata.
**Warning signs:** All NPCs always showing "neutral" emotion after streaming is enabled.

### Pitfall 6: Anthropic Provider Message Format + Streaming
**What goes wrong:** Anthropic provider requires messages array with `cacheControl` in content parts, not `system`/`prompt` style. If the new `streamNpcDialogue` function doesn't handle this, it throws on Anthropic models.
**Why it happens:** The existing code in `narrative-director.ts` has a `providerName === 'anthropic'` branch for exactly this reason.
**How to avoid:** Copy the same Anthropic branching pattern from `streamNarration()` into `streamNpcDialogue()`. The pattern is established and tested.
**Warning signs:** Stream fails only when using Anthropic provider, works fine with Google/OpenAI.

## Code Examples

### AI SDK v5 `streamText` Result Properties (Verified)

```typescript
// Source: [VERIFIED: node_modules/ai/dist/index.d.ts lines 2020-2199]
// StreamTextResult<TOOLS, PARTIAL_OUTPUT> interface:

const result = streamText({
  model: config.model(),
  temperature: config.temperature,
  maxOutputTokens: config.maxTokens,
  system: systemPrompt,
  prompt: userPrompt,
  abortSignal: abortController.signal, // optional cancellation
  onFinish({ text, usage, finishReason }) {
    // Called when stream completes normally
    recordUsage('npc-actor', {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: usage.totalTokens ?? 0,
    });
  },
  onAbort({ steps }) {
    // Called when stream is aborted via AbortSignal
    // NOTE: onFinish is NOT called when aborted
  },
});

// Consume as async iterable:
for await (const chunk of result.textStream) {
  // chunk is a string fragment (typically 1-5 Chinese chars)
  yield chunk;
}

// OR access resolved promises:
const fullText = await result.text;   // complete text after stream ends
const usage = await result.usage;     // token usage
```

### Ink `useInput` Key Properties (Verified)

```typescript
// Source: [VERIFIED: Context7 /vadimdemedes/ink useInput docs]
import { useInput } from 'ink';

useInput((input, key) => {
  // key.return: true when Enter is pressed
  // key.tab: true when Tab is pressed
  // key.escape: true when Escape is pressed
  // input === ' ': true when Space is pressed (input is the character)

  // For D-09 skip detection:
  if (key.return || input === ' ') {
    handleSkip();
  }
});
```

### Existing `streamNarration()` Pattern (Reference)

```typescript
// Source: [VERIFIED: src/ai/roles/narrative-director.ts lines 26-88]
// This is the established pattern. streamNpcDialogue should mirror it.
export async function* streamNarration(
  context: NarrativeContext,
  options?: NarrativeOptions,
): AsyncGenerator<string> {
  const config = getRoleConfig('narrative-director');
  // ... retry loop with anthropic branch ...
  for await (const chunk of result.textStream) {
    yield chunk;
  }
  const usage = await result.usage;
  recordUsage('narrative-director', { ... });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AI SDK v5 `streamText` | AI SDK v6 deprecated `generateObject`, new `Output.object` pattern | v6.0.0 (2026) | Not relevant -- project locks to v5. v5 `streamText` is stable and actively maintained. [VERIFIED: package.json ai@^5.0.179] |
| `streamObject` for structured streaming | `streamText` + post-extract for visible text | Project decision D-05 | `streamObject` streams JSON fragments; not useful for Chinese typewriter rendering. |
| Ink 6 `useInput` | Ink 7 `useInput` with `key.return` (not `key.enter`) | Ink 7.0.0 | Ink 7 renamed some key properties. `key.return` is the correct property for Enter. [VERIFIED: Context7 /vadimdemedes/ink] |

**Deprecated/outdated:**
- Ink 7 uses `key.return` for Enter, not `key.enter`. The Context7 docs show both but `key.return` is the canonical Ink 7 property. [VERIFIED: Context7 /vadimdemedes/ink useInput API docs]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Buffer timeout of ~500ms is appropriate for Chinese LLM output cadence | Architecture Patterns, Pattern 1 | If too short, causes micro-flushes; if too long, player waits. Claude's Discretion allows 300-800ms. Low risk -- tunable constant. |
| A2 | Regex-based emotion extraction from Chinese NPC dialogue text is viable for 90%+ of cases | Architecture Patterns, Pattern 3 | If LLM output doesn't contain expected sentiment markers, fallback to `generateObject` adds latency. Medium risk -- but D-06 provides the fallback path. |
| A3 | `shouldRemember` can be heuristically determined by dialogue length (>50 chars) | Architecture Patterns, Pattern 3 | May miss short but important dialogue or remember trivial exchanges. Low risk -- conservative default. |
| A4 | Enter key in Ink 7 is detected via `key.return` (not `key.enter`) | Code Examples | If wrong, skip-to-end won't trigger on Enter. VERIFIED via Context7 docs, but worth a quick manual test. |

## Open Questions

1. **Buffer timeout sweet spot**
   - What we know: D-02 specifies punctuation-first + timeout fallback. Claude's Discretion sets range at 300-800ms.
   - What's unclear: Optimal value depends on LLM provider latency characteristics (Gemini Flash vs Qwen-Plus have different token arrival rates).
   - Recommendation: Default to 500ms. Make it configurable via a constant. Tune during live testing.

2. **NPC metadata extraction accuracy**
   - What we know: D-05 allows regex or lightweight LLM. D-06 provides generateObject fallback.
   - What's unclear: How often will regex extraction match the LLM's actual emotion expression patterns?
   - Recommendation: Start with regex. Track fallback rate. If >30% of turns fall back to generateObject, revisit the regex patterns or switch to LLM extraction.

3. **ScenePanel streaming indicator visual style**
   - What we know: Claude's Discretion includes "blinking cursor or dim ellipsis."
   - What's unclear: Which visual cue feels better in a CJK terminal context.
   - Recommendation: Dim ellipsis (`...`) appended to the streaming line during active streaming. Simpler to implement, works well with CJK text width calculations.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | bun test (built-in, Jest-compatible API) |
| Config file | none (Bun auto-discovers `*.test.ts` files) |
| Quick run command | `bun test --filter "stream"` |
| Full suite command | `bun test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STREAM-01 | Narration streams via sentence buffer to ScenePanel | unit | `bun test src/ai/utils/sentence-buffer.test.ts -x` | Wave 0 |
| STREAM-01 | useAiNarration hook integrates buffer and flushes | unit | `bun test src/ui/hooks/use-ai-narration.test.ts -x` | Wave 0 |
| STREAM-02 | NPC dialogue streams via streamNpcDialogue | unit | `bun test src/ai/roles/npc-actor.test.ts -x` | Exists (needs extension) |
| STREAM-02 | Metadata post-extraction from raw text | unit | `bun test src/ai/utils/metadata-extractor.test.ts -x` | Wave 0 |
| STREAM-03 | Skip on Enter/Space shows full text immediately | unit | `bun test src/ui/hooks/use-ai-narration.test.ts -x` | Wave 0 |
| STREAM-03 | inputMode stays processing until stream completes | unit | `bun test src/ui/screens/game-screen.test.ts -x` | Exists (needs extension) |

### Sampling Rate
- **Per task commit:** `bun test --filter "stream\|narration\|npc-actor\|sentence-buffer\|metadata"`
- **Per wave merge:** `bun test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/ai/utils/sentence-buffer.test.ts` -- covers STREAM-01 buffer logic
- [ ] `src/ai/utils/metadata-extractor.test.ts` -- covers STREAM-02 metadata extraction
- [ ] `src/ui/hooks/use-ai-narration.test.ts` -- covers STREAM-01 hook integration + STREAM-03 skip

*(Existing test files `narrative-director.test.ts`, `npc-actor.test.ts`, `game-screen.test.ts` need extension, not creation)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | yes | Zod schema validation on NPC metadata extraction output; validate extracted emotionTag is in the allowed enum before use |
| V6 Cryptography | no | -- |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via streamed NPC text | Tampering | NPC dialogue cannot modify game state (existing boundary); metadata extraction uses predefined enum values, not arbitrary LLM output as keys |
| DoS via infinite stream | Denial of Service | AI SDK `maxOutputTokens` config already limits token count per call; existing `maxTokens: 400` for npc-actor and `maxTokens: 512` for narrative-director |

## Project Constraints (from CLAUDE.md)

- **Tech stack:** TypeScript + Bun runtime
- **Terminal UI:** React + Ink
- **LLM:** AI SDK v5 (not v6) with multi-provider abstraction
- **No vector DB:** File-based retrieval (not relevant to this phase)
- **World data:** YAML/JSON (not relevant to this phase)
- **Critical boundary:** AI writes prose and NPC dialogue. AI does NOT decide game outcomes -- Rules Engine owns that. Streaming changes nothing about this boundary.
- **Immutability:** All state updates via immutable patterns (spread, immer produce)
- **File organization:** Small focused files (<800 lines)
- **Error handling:** Comprehensive error handling at every level

## Sources

### Primary (HIGH confidence)
- [VERIFIED: node_modules/ai/dist/index.d.ts] -- AI SDK v5.0.179 `streamText` function signature, `StreamTextResult` interface, `textStream`, `onFinish`, `onAbort`, `abortSignal`
- [VERIFIED: Context7 /vadimdemedes/ink] -- Ink 7 `useInput` hook API: `key.return`, `key.tab`, `key.escape`, `input` character string
- [VERIFIED: Context7 /vercel/ai] -- `streamText` `onFinish` callback parameters (text, finishReason, usage, steps)
- [VERIFIED: src/ai/roles/narrative-director.ts] -- Existing `streamNarration()` async generator pattern with Anthropic branching
- [VERIFIED: src/ui/hooks/use-ai-narration.ts] -- Existing hook with `cancelledRef`, `isStreaming`, `narrationText` state
- [VERIFIED: src/ai/roles/npc-actor.ts] -- Existing `generateNpcDialogue()` with `generateObject` and retry logic
- [VERIFIED: src/events/event-types.ts] -- Existing `narration_streaming_started/completed` event types
- [VERIFIED: package.json] -- ai@^5.0.179, ink@^7.0.1, react@^19.2.5, mitt@^3.0.1

### Secondary (MEDIUM confidence)
- [CITED: Context7 /vercel/ai stopping-streams.mdx] -- `abortSignal`, `onAbort` callback behavior (onFinish NOT called when aborted)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in use; APIs verified from type declarations and Context7
- Architecture: HIGH -- all integration points verified from source code; patterns derived from locked decisions in CONTEXT.md
- Pitfalls: HIGH -- race conditions, timer leaks, and Anthropic branching are concrete concerns derived from code inspection

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (stable -- no dependency changes expected)
