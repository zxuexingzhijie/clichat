# Phase 19: AI Output Quality - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve AI output reliability and observability:
1. Schema-validate narration output via `generateObject` (no manual string slicing)
2. Route intent-classifier through `ai-caller.ts` so token costs appear in `:cost`
3. Add graceful shutdown to the summarizer loop via `AbortSignal`

Out of scope: new AI roles, new cost display UI, changes to NPC dialogue schema.

</domain>

<decisions>
## Implementation Decisions

### AI-05: generateObject for Narration
- **D-01:** Replace `callGenerateText` in `generateNarration` with `callGenerateObject` using schema `{ text: z.string().min(10).max(300) }`.
- **D-02:** `streamNarration` is NOT changed — streaming stays as-is. Only the non-streaming `generateNarration` path moves to `generateObject`.
- **D-03:** Return type of `generateNarration` stays `Promise<string>` — callers unchanged.
- **D-04:** `callGenerateObject` already exists in `ai-caller.ts`. No new infrastructure needed.

### AI-06: Intent-Classifier Cost Tracking
- **D-05:** Rewrite `classifyIntent` to call `callGenerateObject` (from `ai-caller.ts`) instead of calling `generateObject` directly.
- **D-06:** Use role `'retrieval-planner'` (same model, cost bucket already exists).
- **D-07:** All token usage from intent classification will then flow through `recordUsage` and appear in `:cost`.

### AI-07: Summarizer Graceful Shutdown
- **D-08:** `runSummarizerLoop` signature changes to `runSummarizerLoop(signal: AbortSignal): Promise<void>`.
- **D-09:** At the top of each loop iteration, check `signal.aborted`. If true, log one line (e.g., `[summarizer] received abort signal — shutting down`) and return cleanly.
- **D-10:** No unhandled promise rejection on Ctrl-C.
- **D-11:** Callers that start the loop must pass an `AbortController.signal`. Where the loop is started (app startup), wire in `process.on('SIGINT', () => controller.abort())`.

### Claude's Discretion
- Exact log message wording for shutdown
- Whether to also check `signal.aborted` after each `dispatchTask` call (mid-task abort) — reasonable to add

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core files to modify
- `src/ai/roles/narrative-director.ts` — `generateNarration` function (line ~50)
- `src/ai/utils/ai-caller.ts` — `callGenerateObject` already present; `callGenerateText` pattern to follow
- `src/input/intent-classifier.ts` — `classifyIntent` directly calls `generateObject` (bypasses ai-caller)
- `src/ai/summarizer/summarizer-worker.ts` — `runSummarizerLoop` is the infinite `while(true)` loop
- `src/ai/schemas/npc-dialogue.ts` — reference for how Zod schemas are structured in this codebase

### Supporting files (read for context)
- `src/state/cost-session-store.ts` — `recordUsage` signature and role types
- `src/ai/providers.ts` — `AiRole` type (to confirm 'retrieval-planner' is valid)

### No external specs — requirements fully captured in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `callGenerateObject<T>` in `ai-caller.ts`: same interface as `callGenerateText`, just takes a `schema` param. Already handles `recordUsage`, retry, and event emission.
- `NpcDialogueSchema` in `src/ai/schemas/npc-dialogue.ts`: established pattern for Zod output schemas.

### Established Patterns
- All AI calls go through `ai-caller.ts` functions (`callGenerateText`, `callGenerateObject`, `callStreamText`) — not direct AI SDK calls.
- `recordUsage(role, usage)` is the cost tracking hook. Role must be a valid `AiRole`.
- `AbortSignal` is the standard Node/Web interrupt pattern — no custom flags needed.

### Integration Points
- `narrative-director.ts` is called by the game loop for scene narration — return type must stay `Promise<string>`.
- `intent-classifier.ts` is called by `input-router.ts` — signature must stay `classifyIntent(input, sceneContext, options?)`.
- `runSummarizerLoop` is started at app startup — the caller needs to pass an `AbortSignal`.

</code_context>

<specifics>
## Specific Ideas

No specific references — decisions above are precise enough for implementation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 19-ai-output-quality*
*Context gathered: 2026-04-30*
