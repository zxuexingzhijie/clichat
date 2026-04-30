# Phase 19: AI Output Quality - Research

**Researched:** 2026-04-30
**Domain:** AI caller abstraction, schema validation, AbortSignal, cost tracking
**Confidence:** HIGH

## Summary

Phase 19 has three independent surgical changes, each touching exactly one file.
All three are internal refactors — the public API contracts (function signatures, return types) remain unchanged for callers.

The codebase is already in good shape: `callGenerateObject` exists and handles `recordUsage`/retry/event emission. The only work is (1) switching one call site in `narrative-director.ts` from `callGenerateText` to `callGenerateObject` with a Zod schema, (2) replacing a bare `generateObject` import in `intent-classifier.ts` with `callGenerateObject`, and (3) adding an `AbortSignal` parameter to `runSummarizerLoop` and wiring the signal from the React `useEffect` in `app.tsx`.

**Primary recommendation:** Implement as three single-file plans. Tests for (1) require changing the mock target from `generateText` to `generateObject`; tests for (2) require mocking `ai-caller` instead of `ai`; tests for (3) require asserting the loop exits cleanly without rejection.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**AI-05: generateObject for Narration**
- D-01: Replace `callGenerateText` in `generateNarration` with `callGenerateObject` using schema `{ text: z.string().min(10).max(300) }`.
- D-02: `streamNarration` is NOT changed — streaming stays as-is. Only the non-streaming `generateNarration` path moves to `generateObject`.
- D-03: Return type of `generateNarration` stays `Promise<string>` — callers unchanged.
- D-04: `callGenerateObject` already exists in `ai-caller.ts`. No new infrastructure needed.

**AI-06: Intent-Classifier Cost Tracking**
- D-05: Rewrite `classifyIntent` to call `callGenerateObject` (from `ai-caller.ts`) instead of calling `generateObject` directly.
- D-06: Use role `'retrieval-planner'` (same model, cost bucket already exists).
- D-07: All token usage from intent classification will then flow through `recordUsage` and appear in `:cost`.

**AI-07: Summarizer Graceful Shutdown**
- D-08: `runSummarizerLoop` signature changes to `runSummarizerLoop(signal: AbortSignal): Promise<void>`.
- D-09: At the top of each loop iteration, check `signal.aborted`. If true, log one line and return cleanly.
- D-10: No unhandled promise rejection on Ctrl-C.
- D-11: Callers that start the loop must pass an `AbortController.signal`. Wire `process.on('SIGINT', () => controller.abort())` at app startup.

### Claude's Discretion
- Exact log message wording for shutdown
- Whether to also check `signal.aborted` after each `dispatchTask` call (mid-task abort)

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Narration schema enforcement | API / Backend (AI layer) | — | Rules Engine / AI caller owns output contracts, not the UI |
| Intent classification cost tracking | API / Backend (AI layer) | — | Cost store is a backend concern; all AI calls route through ai-caller |
| Summarizer lifecycle management | API / Backend (AI layer) | Frontend Server (React effect) | Loop runs in backend; signal wired from React useEffect in app.tsx |

---

## Standard Stack

All libraries are already installed. No new dependencies.

### Core (already present)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` (Vercel AI SDK) | ^5.0.179 | `generateObject` — structured LLM output | Project constraint; already used via `callGenerateObject` in ai-caller |
| `zod` | ^4.3.6 | Output schema definition | Project constraint; required peer dep of AI SDK |
| `AbortController` / `AbortSignal` | Web/Node built-in | Cooperative cancellation | Standard Web API, available in Bun; no import needed |

### Installation
No new packages required.

---

## Architecture Patterns

### System Architecture Diagram

```
[generateNarration call site]
        │
        ▼
narrative-director.ts::generateNarration()
        │  callGenerateObject({ schema: NarrationSchema })
        ▼
ai-caller.ts::callGenerateObject<T>()
        │  generateObject(AI SDK)  ←  Zod schema enforces text.min(10).max(300)
        │  recordUsage('narrative-director', usage)
        ▼
cost-session-store  ←  :cost reflects narration tokens

[player NL input]
        │
        ▼
input-router.ts::routeInput()
        │  classifyIntent(input, sceneContext)
        ▼
intent-classifier.ts::classifyIntent()
        │  callGenerateObject({ role:'retrieval-planner', schema: IntentSchema })
        ▼
ai-caller.ts::callGenerateObject<T>()
        │  recordUsage('retrieval-planner', usage)
        ▼
cost-session-store  ←  :cost now shows retrieval-planner bucket

[app.tsx useEffect]
        │  new AbortController()
        │  process.on('SIGINT', controller.abort)
        │  runSummarizerLoop(controller.signal)
        ▼
summarizer-worker.ts::runSummarizerLoop(signal)
        │  while(true) { if signal.aborted → log + return }
        │  dispatchTask(task)
        │  [optional: check signal.aborted after dispatchTask]
        ▼
clean exit, no unhandled rejection
```

### Recommended Project Structure
No structural changes. All edits are within existing files.

### Pattern 1: callGenerateObject with inline Zod schema (AI-05)

The `NarrationOutputSchema` should live in a new file mirroring `src/ai/schemas/npc-dialogue.ts`.
[VERIFIED: codebase grep — NpcDialogueSchema is the established schema pattern]

```typescript
// src/ai/schemas/narration-output.ts
import { z } from 'zod';

export const NarrationOutputSchema = z.object({
  text: z.string().min(10).max(300).describe('场景叙述文字，不超过300字'),
});

export type NarrationOutput = z.infer<typeof NarrationOutputSchema>;
```

Then in `narrative-director.ts::generateNarration`:

```typescript
// Source: codebase — callGenerateObject signature in ai-caller.ts line 117
import { NarrationOutputSchema } from '../schemas/narration-output';
import { callGenerateObject, callStreamText } from '../utils/ai-caller';

export async function generateNarration(
  context: NarrativeContext,
  options?: NarrativeOptions,
): Promise<string> {
  const config = getRoleConfig('narrative-director');
  const system = buildNarrativeSystemPrompt(context.sceneType, context.narrativeContext);
  const prompt = buildNarrativeUserPrompt(context as NarrativeUserPromptContext);

  try {
    const { object } = await callGenerateObject<{ text: string }>({
      role: 'narrative-director',
      providerName: config.providerName,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      system,
      prompt,
      maxRetries: options?.maxRetries,
      schema: NarrationOutputSchema,
    });
    return object.text;
  } catch {
    return getFallbackNarration(context.sceneType);
  }
}
```

Key observation: the manual `if (text.length > 300) return text.slice(0, 300)` and `if (text.length < 10) return getFallbackNarration(...)` guards are removed — Zod enforces these at schema validation time. If the LLM returns out-of-range text, `generateObject` throws a validation error, which the `catch` block handles by returning the fallback. [VERIFIED: codebase — ai-caller.ts line 127-136 shows generateObject throws on schema failure, propagating to retry loop]

### Pattern 2: Routing classifyIntent through callGenerateObject (AI-06)

Current: `intent-classifier.ts` imports `generateObject` from `'ai'` directly and has its own retry loop.
Target: Replace with `callGenerateObject` from `'../ai/utils/ai-caller'` — the retry loop inside `callGenerateObject` handles retries.

```typescript
// Source: codebase — callGenerateObject signature in ai-caller.ts
import { callGenerateObject } from '../ai/utils/ai-caller';
import { getRoleConfig } from '../ai/providers';
import { IntentSchema, type Intent } from '../types/intent';

export async function classifyIntent(
  input: string,
  sceneContext: string,
  options?: ClassifyIntentOptions,
): Promise<Intent> {
  const config = getRoleConfig('retrieval-planner');
  const { object } = await callGenerateObject<Intent>({
    role: 'retrieval-planner',
    providerName: config.providerName,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    system: INTENT_SYSTEM_PROMPT,
    prompt: `Current scene: ${sceneContext}\nPlayer input: ${input}\n\nClassify the player's intent.`,
    maxRetries: options?.maxRetries ?? 1,
    schema: IntentSchema,
  });
  return object;
}
```

Important notes:
- The `options?.model` override in the current signature is dropped because `callGenerateObject` gets the model from `getRoleConfig`. [VERIFIED: codebase — ai-caller.ts BaseCallOptions has `model: () => LanguageModel`]
- The `ClassifyIntentOptions` type loses its `model` field. Callers in `input-router.ts` use only `maxRetries` — confirmed by grep.
- `callGenerateObject` throws on all retries exhausted; the error message will differ from the current `'Intent classification failed after N attempts'`. Tests that assert the exact error message must be updated.
- `callGenerateObject` calls `emitFailure` on final failure; this is acceptable extra behavior.

### Pattern 3: AbortSignal for runSummarizerLoop (AI-07)

[VERIFIED: codebase — summarizer-worker.ts line 97-113 shows the `while(true)` loop with no exit mechanism]
[VERIFIED: codebase — app.tsx line 279-283 shows `runSummarizerLoop().catch(...)` in a `useEffect([], [])`]

```typescript
// summarizer-worker.ts
export async function runSummarizerLoop(signal: AbortSignal): Promise<void> {
  while (true) {
    if (signal.aborted) {
      console.error('[summarizer] received abort signal — shutting down');
      return;
    }

    const task = dequeuePending();
    if (!task) {
      await new Promise<void>((r) => setTimeout(r, 5000));
      continue;
    }

    markRunning(task.id);
    try {
      await dispatchTask(task);
      // Optional mid-task abort check (Claude's discretion)
      if (signal.aborted) {
        console.error('[summarizer] received abort signal — shutting down');
        return;
      }
      markDone(task.id);
    } catch {
      markFailed(task.id);
    }
  }
}
```

App startup wiring in `app.tsx`:

```typescript
// app.tsx — replace the useEffect block at line 279
useEffect(() => {
  const controller = new AbortController();

  const handleSigint = () => controller.abort();
  process.on('SIGINT', handleSigint);

  runSummarizerLoop(controller.signal).catch((err) => {
    console.error('[Summarizer] loop error:', err instanceof Error ? err.message : String(err));
  });

  return () => {
    controller.abort();
    process.off('SIGINT', handleSigint);
  };
}, []);
```

Note on the `setTimeout` during abort: when `signal.aborted` is true, the 5000ms wait still runs if the check is only at the top of the loop. Adding the check after the `await new Promise(..., 5000)` as well ensures the loop exits without waiting for the full sleep. This is under Claude's discretion — the most responsive approach checks after the sleep too.

### Anti-Patterns to Avoid
- **Don't add `schema` to `BaseCallOptions`:** `schema` is on `GenerateObjectOptions<T>` only. [VERIFIED: ai-caller.ts line 70-72]
- **Don't change `streamNarration`:** D-02 is locked — streaming path stays on `callStreamText`.
- **Don't pass `signal` to the `setTimeout` promise:** Bun/Node `setTimeout` does not accept AbortSignal natively; check `signal.aborted` before/after `await` instead.
- **Don't use `process.exit()` on SIGINT:** The loop should return cleanly, not force-exit, allowing React/Ink cleanup to run.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text length enforcement | Manual `slice(0, 300)` | `z.string().max(300)` | Zod validates at schema parse time; throws clearly on violation |
| Retry logic in classifyIntent | Custom retry loop | `callGenerateObject` built-in retry | ai-caller already handles retry, emitFailure, recordUsage |
| Custom abort flag | `let shouldStop = false` | `AbortSignal` | Web standard; composable; works with `addEventListener('abort')` if needed later |

---

## Common Pitfalls

### Pitfall 1: Test mocks target `'ai'` module directly
**What goes wrong:** `narrative-director.test.ts` currently mocks `generateText` from `'ai'`. After the switch to `callGenerateObject`, the mock needs to target `generateObject` from `'ai'` instead (since `callGenerateObject` internally calls it). The test file's `mockGenerateText` assertions all become stale.
**Why it happens:** `callGenerateObject` is a thin wrapper — it still calls `generateObject` from `'ai'` internally. Tests mock at the AI SDK boundary.
**How to avoid:** In the updated test file, replace `mockGenerateText` with `mockGenerateObject` returning `{ object: { text: '...' }, usage: mockUsage }`. The `object` wrapper is mandatory — `callGenerateObject` destructures `result.object`.
**Warning signs:** Test passes but assertions check `mockGenerateText.toHaveBeenCalledTimes(1)` — will always be 0 after the change.

### Pitfall 2: intent-classifier.test.ts mocks `'ai'` — must switch to mock `ai-caller`
**What goes wrong:** Current test mocks `generateObject` from `'ai'`. After switching to `callGenerateObject`, the test must mock `callGenerateObject` from `'../ai/utils/ai-caller'` instead, OR continue mocking `generateObject` from `'ai'` (since `callGenerateObject` calls it internally). Either works, but the `recordUsage` side effect won't be exercised unless mocking at the `'ai'` level.
**How to avoid:** Continue mocking at the `'ai'` level (same as now) to keep test isolation. Add one new test that asserts `recordUsage` was called with role `'retrieval-planner'` — this requires mocking `cost-session-store` separately.
**Warning signs:** Test for "retries" (`mockGenerateObject.toHaveBeenCalledTimes(2)`) — `callGenerateObject` has its own retry loop. The retry count assertion remains valid only if `maxRetries` is passed correctly.

### Pitfall 3: Error message mismatch in classifyIntent failure test
**What goes wrong:** Current test asserts: `rejects.toThrow('Intent classification failed after 2 attempts')`. After switching to `callGenerateObject`, the error thrown is the raw AI SDK error — `callGenerateObject` re-throws `lastError` without wrapping it in a custom message.
**How to avoid:** Update the failure test to assert `rejects.toThrow(Error)` (any error) or update the error string expectation. The exact error comes from the AI SDK mock.
**Warning signs:** The test `'throws after all retries exhausted'` will fail with a message mismatch, not a logic failure.

### Pitfall 4: SIGINT handler accumulates on hot reload
**What goes wrong:** In development with Bun `--watch`, the `useEffect` cleanup may not fire before re-registration, leading to multiple SIGINT handlers.
**How to avoid:** The `return () => { process.off('SIGINT', handleSigint); controller.abort(); }` cleanup in the effect prevents this. Ensure `handleSigint` is captured as a named variable (not an inline arrow) so `process.off` can remove it by reference.

### Pitfall 5: Zod .max() on narration causes catch-fallback on valid LLM output
**What goes wrong:** Some LLM providers return Chinese text that counts characters (Unicode code points) — Zod's `.max(300)` counts JavaScript string `.length` which is UTF-16 code units. For CJK characters (U+4E00–U+9FFF) this is still 1 per character. But emoji or supplementary characters are 2. In practice, 300-char Chinese narration is safe.
**Why it matters:** If the LLM consistently returns 301+ characters, every call falls through to `getFallbackNarration`. The system prompt already asks for 80-180 characters, so 300 is generous.
**How to avoid:** No action needed for now; monitor in live UAT.

---

## Code Examples

### callGenerateObject signature (verified)
```typescript
// Source: src/ai/utils/ai-caller.ts line 117-144
export async function callGenerateObject<T>(
  opts: GenerateObjectOptions<T>,  // BaseCallOptions + { schema: unknown }
): Promise<{ readonly object: T }>
```

### NpcDialogueSchema — reference pattern for NarrationOutputSchema
```typescript
// Source: src/ai/schemas/npc-dialogue.ts
export const NpcDialogueSchema = z.object({
  dialogue: z.string().min(10).max(300).describe('NPC对白，自然口语'),
  emotionTag: z.enum([...]),
  shouldRemember: z.boolean(),
  sentiment: z.enum([...]),
});
```

### recordUsage signature
```typescript
// Source: src/state/cost-session-store.ts line 45
export function recordUsage(
  role: AiRole,
  usage: { inputTokens: number; outputTokens: number; totalTokens: number },
): void
```

### AiRole type — 'retrieval-planner' is valid
```typescript
// Source: src/ai/providers.ts line 10-17
export type AiRole =
  | 'narrative-director'
  | 'npc-actor'
  | 'retrieval-planner'   // ← valid for classifyIntent
  | 'safety-filter'
  | 'summarizer'
  | 'quest-planner'
  | 'branch-narrator';
```

---

## Runtime State Inventory

> Not applicable — this is a code refactor phase. No stored data, live service config, OS state, secrets, or build artifacts embed the changed identifiers.

---

## Environment Availability

> Step 2.6 SKIPPED — no external dependencies. All changes are internal TypeScript refactors using already-installed packages.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | bun:test (built-in) |
| Config file | package.json `"test": "bun test"` |
| Quick run command | `bun test src/ai/roles/narrative-director.test.ts` |
| Full suite command | `bun test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AI-05 | generateNarration returns schema-validated text (10-300 chars) | unit | `bun test src/ai/roles/narrative-director.test.ts` | ✅ (needs update) |
| AI-05 | generateNarration returns fallback when object schema validation fails | unit | `bun test src/ai/roles/narrative-director.test.ts` | ✅ (needs update) |
| AI-05 | generateNarration does NOT manually slice — relies on Zod | unit | `bun test src/ai/roles/narrative-director.test.ts` | ✅ (update existing truncation test) |
| AI-06 | classifyIntent calls go through callGenerateObject (cost tracked) | unit | `bun test src/input/intent-classifier.test.ts` | ✅ (needs update) |
| AI-06 | recordUsage called with role='retrieval-planner' after classify | unit | `bun test src/input/intent-classifier.test.ts` | ❌ Wave 0 — new test |
| AI-07 | runSummarizerLoop exits cleanly when signal.aborted=true | unit | `bun test src/ai/summarizer/summarizer-worker.test.ts` | ❌ Wave 0 — new test |
| AI-07 | no unhandled promise rejection on abort | unit | `bun test src/ai/summarizer/summarizer-worker.test.ts` | ❌ Wave 0 — new test |

### Sampling Rate
- **Per task commit:** `bun test src/ai/roles/narrative-director.test.ts src/input/intent-classifier.test.ts src/ai/summarizer/summarizer-worker.test.ts`
- **Per wave merge:** `bun test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/input/intent-classifier.test.ts` — add test: `recordUsage` called with `'retrieval-planner'` (AI-06 cost tracking verification)
- [ ] `src/ai/summarizer/summarizer-worker.test.ts` — add test: `runSummarizerLoop(signal)` exits without rejection when `signal.aborted = true` before first iteration
- [ ] `src/ai/summarizer/summarizer-worker.test.ts` — add test: loop exits mid-wait when signal aborts after `setTimeout` starts

---

## Security Domain

> security_enforcement: not explicitly disabled — evaluating applicable ASVS categories.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Zod schema validates LLM output before use (AI-05) |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LLM output injection (prompt injection via narration text) | Tampering | Zod schema bounds (max 300 chars) limit injection surface; narration does not execute as code |
| Token cost exhaustion via NL input loop | DoS | Existing `maxRetries` cap in `callGenerateObject`; unchanged |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `process.off('SIGINT', handler)` works in Bun/Ink environment to remove a previously registered SIGINT listener | Pitfall 4 / Pattern 3 | If Bun doesn't support `process.off`, the cleanup function silently fails and handlers accumulate; low risk in production (app restarts) |

[ASSUMED] — not verified against Bun process docs in this session; Node.js EventEmitter `process.off` is standard, and Bun claims Node.js process compatibility.

---

## Open Questions (RESOLVED)

1. **Does Zod `.max(300)` validation failure cause `callGenerateObject` to exhaust all retries before falling to the catch block?**
   - What we know: `callGenerateObject` retries on any thrown error (line 107-112). Zod validation in `generateObject` (AI SDK) throws if schema fails.
   - What's unclear: Whether the AI SDK retries internally on schema failure before throwing, causing double-retry.
   - Recommendation: Set `maxRetries: 0` in the narration Zod failure test to confirm single-failure behavior; adjust if needed.
   - RESOLVED: Plans use `maxRetries: 0` in Zod-failure tests to isolate single-failure behavior. Acceptable approach — double-retry is bounded by `maxRetries` regardless.

2. **Should `NarrationOutputSchema` live in `src/ai/schemas/` (new file) or be inlined in `narrative-director.ts`?**
   - What we know: `NpcDialogueSchema` lives in `src/ai/schemas/npc-dialogue.ts` as its own file.
   - Recommendation: Follow the established pattern — create `src/ai/schemas/narration-output.ts`. Inline is acceptable if the schema is trivial (single field), but consistency with the NPC schema pattern is cleaner.
   - RESOLVED: New file `src/ai/schemas/narration-output.ts` chosen — consistent with NpcDialogueSchema pattern in the same directory.

---

## Sources

### Primary (HIGH confidence)
- `src/ai/utils/ai-caller.ts` — verified `callGenerateObject` signature, retry logic, `recordUsage` call
- `src/ai/roles/narrative-director.ts` — verified current `callGenerateText` usage and manual slice guards
- `src/input/intent-classifier.ts` — verified direct `generateObject` import bypassing ai-caller
- `src/ai/summarizer/summarizer-worker.ts` — verified `while(true)` with no exit, current signature
- `src/app.tsx` lines 279-283 — verified `runSummarizerLoop().catch(...)` in `useEffect([], [])`
- `src/ai/providers.ts` — verified `'retrieval-planner'` is a valid `AiRole`
- `src/state/cost-session-store.ts` — verified `recordUsage(role, usage)` signature
- `src/ai/schemas/npc-dialogue.ts` — verified schema pattern with `.min(10).max(300)`

### Secondary (MEDIUM confidence)
- `src/ai/roles/narrative-director.test.ts` — existing test structure; mocks at `'ai'` SDK boundary
- `src/input/intent-classifier.test.ts` — existing test structure; retry count assertions need updating
- `src/ai/summarizer/summarizer-worker.test.ts` — no `runSummarizerLoop` tests exist yet

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries verified in codebase
- Architecture: HIGH — all patterns verified by reading actual source files
- Pitfalls: HIGH — derived from concrete mock patterns in existing test files
- AbortSignal pattern: MEDIUM — standard Web API; one ASSUMED claim about `process.off` in Bun

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable internal codebase; no external API dependencies)
