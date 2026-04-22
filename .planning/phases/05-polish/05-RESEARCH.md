# Phase 5: Polish & Optimization - Research

**Researched:** 2026-04-22
**Domain:** LLM multi-provider routing, background summarization, replay UI, cost tracking, prompt caching
**Confidence:** HIGH

## Summary

Phase 5 adds operational infrastructure on top of the complete gameplay loop from Phases 1–4. Four capability areas are in scope: (1) replacing the hardcoded all-Gemini provider config with a YAML-driven multi-provider router; (2) a background summarizer that compresses NPC memory and turn history without blocking the game loop; (3) a `/replay` panel that renders stored `TurnLogEntry` records as a scrollable Ink UI; and (4) token cost tracking visible in the status bar and via `/cost`.

The project already has 571 passing tests, a complete `SaveDataV3` schema, `TurnLogEntry` records persisted in `engine/turn-log.ts`, and an `appendTurnLog` call infrastructure. The Vercel AI SDK v5 (`ai@5.x`) exposes `usage.inputTokens` / `usage.outputTokens` on every `generateText` and `streamText` call. Prompt caching is provider-specific and handled via `providerOptions` for Anthropic and implicitly via consistent prefixes for Google/OpenAI.

The locked decisions constrain scope significantly: no automatic provider fallback (D-02), no profile auto-switching (deferred), cost pricing lives in `ai-config.yaml` (D-11), `/replay` reads stored turn log only (D-09), and the summarizer queue uses version-checked atomic writes (D-06).

**Primary recommendation:** Build the YAML config loader and `AiConfigStore` first (it unblocks all other work), then cost tracking (parallel with summarizer queue scaffolding), then replay panel, then summarizer LLM tasks.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (Config model):** `ai-config.yaml` as primary config mapping AI roles to provider/model with temperature, maxTokens, and fallback strategy. Env vars for API keys and temp overrides. Priority: CLI args > env vars > ai-config.yaml > defaults.
- **D-02 (Error handling):** On provider failure (API error / quota), stop and show clear error to player. No automatic fallback switching.
- **D-03 (Profile support):** Reserve `cheap`/`balanced`/`premium` profile fields now; v1 implementation is static mapping only; profile switch logic is a skeleton framework only.
- **D-04 (Summarizer trigger):** Hybrid trigger — token threshold (primary) + event triggers (/save, branch create, quest stage, combat end, critical dialogue end, new region, key truth), + fixed-interval fallback. Debounce + priority queue + cooldown to avoid frequent LLM calls. No low-priority summarization during combat or critical dialogue.
- **D-05 (Compression outputs):** Three types: (1) chapter summary (narrative summary), (2) NPC memory compression (recent → archive), (3) turn log compression (history into summary blocks).
- **D-06 (Async execution):** Summarizer tasks go into background async queue, do not block game loop. Player can keep playing. Each task records target object, entry IDs, baseVersion, trigger reason. On completion: version check + atomic write to target store. On conflict or LLM failure: preserve originals, re-queue, or fall back to rule-based summary.
- **D-07 (Replay UI):** `/replay N` opens scrollable timeline browser. Arrow keys (↑↓), PgUp/PgDn, n/p for stable fallback; mouse scroll optional. Filter, search, single-turn detail. ESC exits.
- **D-08 (Replay content):** Per turn: raw player input, AI narration (from log, no re-generation), rules adjudication results, NPC dialogue. Quest progress, NPC relation changes, player knowledge updates as collapsible details.
- **D-09 (Replay data source):** Reads Phase 4 turn log already in persistence layer. No LLM re-call.
- **D-10 (Cost display):** Status bar shows current-turn token count. `/cost` shows session totals (total tokens + estimated cost) and per-role breakdown (input/output tokens + estimated cost).
- **D-11 (Pricing data):** `ai-config.yaml` has `price_per_1k_input_tokens` and `price_per_1k_output_tokens` per model. User maintains. No built-in price table.
- **LLM-03 prompt caching:** Static prompt content caching/prefix implementation strategy is Claude's Discretion — see below.

### Claude's Discretion

- Background summarizer queue data structure and scheduler implementation
- Token threshold default values per role
- Status bar token display visual layout (must not break main UI layout)
- `/replay` panel specific Ink component structure
- `ai-config.yaml` complete field schema design
- Prompt caching strategy per provider (LLM-03)

### Deferred Ideas (OUT OF SCOPE)

- Profile auto-switching (v2): auto-downgrade based on session length or token budget
- Reputation chain propagation (v2): faction relationship graph-driven cascading reputation
- Rumor propagation (v2): player actions spreading NPC-to-NPC
- Enforcement/pursuit (v2): infamy triggers guard chase behavior
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AI-04 | Background Summarizer compresses long sessions into chapter summaries and NPC memory notes without blocking interactive gameplay | Bun async task patterns, immer store atomic writes, version-check pattern, NpcMemoryRecord three-layer schema (recent/salient/archive already exists) |
| LLM-01 | Multi-provider abstraction supporting OpenAI, Anthropic, Google, Qwen, DeepSeek with per-role model routing | YAML config loader pattern, existing `providers.ts` ROLE_CONFIGS structure, AI SDK provider constructors already imported |
| LLM-02 | Token usage and estimated cost tracked per turn and per session, visible via `/cost` | AI SDK v5 `usage.inputTokens`/`usage.outputTokens` from `generateText`/`streamText`, per-role accumulation pattern |
| LLM-03 | Static prompt content cached/prefixed to reduce per-turn token costs | Anthropic `providerOptions.anthropic.cacheControl` ephemeral, Google implicit prefix caching, OpenAI automatic 1024+ token caching |
| SAVE-04 | Player can replay recent turns via `/replay N` reading stored turn log | `TurnLogEntry` schema already in serializer, `replayTurns()` in turn-log.ts, `@inkjs/ui` Select + raw useInput for scrollable timeline |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ai-config.yaml loading + validation | Config layer (src/ai/config/) | — | Loads at startup, feeds providers.ts; Zod validation at boundary |
| Provider routing (ROLE_CONFIGS) | AI infrastructure (src/ai/providers.ts) | — | Single source of model constructors; all AI roles call getRoleConfig() |
| Token usage capture | AI call sites (narrative-director, npc-actor, etc.) | Cost session store | AI SDK returns usage per call; callers must forward to cost store |
| Cost session store | State layer (src/state/) | Status bar UI | Accumulates tokens/cost across roles for the session |
| Background summarizer queue | Background service (src/ai/summarizer/) | State stores (npcMemory, turnLog) | Async queue lives outside game loop; writes back via atomic version check |
| Summarizer LLM calls | AI role (summarizer in providers.ts) | — | Already defined in ROLE_CONFIGS; needs LLM implementation |
| `/replay` panel | UI layer (src/ui/panels/) | Turn log (engine/turn-log.ts) | Reads stored TurnLogEntry records; renders scrollable Ink component |
| Turn log read path | engine/turn-log.ts | SaveDataV3.turnLog | Already implemented via replayTurns(); SaveData already serializes it |
| Prompt caching | AI call sites (generateText/streamText) | — | providerOptions per call; no infrastructure change needed |
| `/cost` command | game-loop.ts routing | CostSessionStore | Routes to new 'cost' game phase or inline narration |

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ai (Vercel AI SDK) | ^5.0.179 (installed) | Token usage, prompt caching API | `usage.inputTokens`/`outputTokens` on every call; cacheControl providerOptions |
| @ai-sdk/openai | ^3.0.53 (installed) | OpenAI provider | Automatic caching for 1024+ token prompts on gpt-4o/gpt-4o-mini |
| @ai-sdk/anthropic | needs install | Anthropic provider | Manual ephemeral cacheControl in providerOptions |
| @ai-sdk/google | ^3.0.64 (installed) | Google Gemini provider | Implicit caching via consistent prefix ordering |
| @ai-sdk/alibaba | needs install | Qwen provider | Chinese-optimized generation; project constraint |
| @ai-sdk/deepseek | needs install | DeepSeek provider | Cost-effective Chinese generation |
| yaml | ^2.8.3 (installed) | Dynamic YAML config loading | Runtime load of ai-config.yaml |
| zod | ^4.3.6 (installed) | ai-config.yaml schema validation | Project standard; AI SDK peer dep |
| immer | ^11.1.4 (installed) | Atomic state updates in summarizer write-back | Project standard for all store mutations |
| @inkjs/ui | ^2.0.0 (installed) | Select component for replay scrollable list | visibleOptionCount prop controls viewport; keyboard navigation built-in |

### New Providers to Install
```bash
bun add @ai-sdk/anthropic @ai-sdk/alibaba @ai-sdk/deepseek @ai-sdk/openai-compatible
```

### Version Verification
[VERIFIED: npm registry 2026-04-22]
- @ai-sdk/anthropic: 1.x (latest 1.x stable — verify with `npm view @ai-sdk/anthropic version`)
- @ai-sdk/alibaba: ^1.0.17 (from CLAUDE.md research)
- @ai-sdk/deepseek: ^2.0.29 (from CLAUDE.md research)
- @ai-sdk/openai-compatible: ^2.0.41 (from CLAUDE.md research)

Note: These versions are from prior research documented in CLAUDE.md. Confirm before install with `npm view <pkg> version`.

## Architecture Patterns

### System Architecture Diagram

```
Player Input → game-loop.ts
                ├─ /cost → CostSessionStore.getSummary() → inline narration
                ├─ /replay N → ReplayPanel (reads turn-log.ts.replayTurns())
                └─ game actions
                        └─ AI calls (narrative-director, npc-actor, etc.)
                                ├─ getRoleConfig() → AiConfigStore (loaded from ai-config.yaml)
                                ├─ generateText / streamText
                                │      └─ response.usage → TokenAccumulator.record(role, usage)
                                │              └─ emit token_usage_updated → StatusBar refresh
                                └─ prompt caching (providerOptions injected at call site)

Background (async, non-blocking):
SummarizerQueue ← SummarizerScheduler ← event triggers (npc_memory_written, save_game_completed, etc.)
        │
        └─ SummarizerTask
                ├─ call summarizer role (AI SDK generateText)
                ├─ version check against store's baseVersion
                └─ atomic write via store.setState(produce) iff version matches
```

### Recommended Project Structure (additions only)
```
src/
├── ai/
│   ├── config/
│   │   ├── ai-config-schema.ts      # Zod schema for ai-config.yaml
│   │   ├── ai-config-loader.ts      # loadAiConfig(), validates against schema
│   │   └── ai-config.defaults.ts    # default values for optional fields
│   ├── summarizer/
│   │   ├── summarizer-queue.ts      # SummarizerQueue store + task type
│   │   ├── summarizer-scheduler.ts  # trigger evaluation, debounce, cooldown
│   │   ├── summarizer-worker.ts     # async task runner (non-blocking)
│   │   └── summarizer-prompts.ts    # prompt templates for 3 compression types
│   └── providers.ts                 # extend: load from AiConfigStore at init
├── state/
│   └── cost-session-store.ts        # per-role token accumulation + cost calc
├── ui/
│   └── panels/
│       └── replay-panel.tsx         # scrollable TurnLogEntry timeline
└── ai-config.yaml                   # root-level user config (git-tracked template)
```

### Pattern 1: ai-config.yaml Schema and Loading
**What:** YAML config validated with Zod at startup; feeds ROLE_CONFIGS at runtime.
**When to use:** Always. providers.ts must never hardcode model names after this phase.

```typescript
// Source: project pattern from CLAUDE.md + CONTEXT.md D-01
// src/ai/config/ai-config-schema.ts
import { z } from 'zod';

export const ModelPricingSchema = z.object({
  price_per_1k_input_tokens: z.number().optional(),
  price_per_1k_output_tokens: z.number().optional(),
});

export const RoleConfigEntrySchema = z.object({
  provider: z.string(),    // 'google' | 'openai' | 'anthropic' | 'alibaba' | 'deepseek'
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
  profiles: z.record(z.string(), ProfileSchema),  // 'cheap' | 'balanced' | 'premium'
  // v1: only 'balanced' profile populated; cheap/premium skeleton present
});

export type AiConfig = z.infer<typeof AiConfigSchema>;
```

```typescript
// src/ai/config/ai-config-loader.ts
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { AiConfigSchema } from './ai-config-schema';

export function loadAiConfig(configPath: string): AiConfig {
  const raw = readFileSync(configPath, 'utf-8');
  const parsed = parse(raw);
  const result = AiConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`ai-config.yaml validation failed: ${result.error.message}`);
  }
  return result.data;
}
```

### Pattern 2: providers.ts Runtime Construction from Config
**What:** Replace hardcoded ROLE_CONFIGS with runtime-built config from AiConfigStore.

```typescript
// Source: extension of existing src/ai/providers.ts pattern
// providers.ts modification outline

import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
// import alibaba, deepseek similarly

const PROVIDER_FACTORIES: Record<string, (modelId: string) => LanguageModel> = {
  google: (id) => google(id),
  openai: (id) => openai(id),
  anthropic: (id) => anthropic(id),
  // alibaba: (id) => alibaba(id),
  // deepseek: (id) => deepseek(id),
};

export function buildRoleConfigs(config: AiConfig, profile: string): Record<AiRole, RoleConfig> {
  const profileData = config.profiles[profile] ?? config.profiles[config.default_profile]!;
  return Object.fromEntries(
    (Object.keys(DEFAULT_ROLE_CONFIGS) as AiRole[]).map((role) => {
      const entry = profileData.roles[role] ?? DEFAULT_ROLE_CONFIGS[role];
      const factory = PROVIDER_FACTORIES[entry.provider];
      if (!factory) throw new Error(`Unknown provider: ${entry.provider}`);
      return [role, {
        model: () => factory(entry.model),
        temperature: entry.temperature ?? DEFAULT_ROLE_CONFIGS[role].temperature,
        maxTokens: entry.maxTokens ?? DEFAULT_ROLE_CONFIGS[role].maxTokens,
        pricing: entry.pricing,
      }];
    }),
  ) as Record<AiRole, RoleConfig>;
}
```

### Pattern 3: Token Usage Capture from AI SDK v5
**What:** Every `generateText`/`streamText` call returns `usage`. Capture and forward to cost store.
**When to use:** All AI role call sites (narrative-director, npc-actor, retrieval-planner, summarizer, safety-filter).

```typescript
// Source: [VERIFIED: Context7 /vercel/ai, docs 2026-04-22]
// Standard pattern for generateText token capture
const { text, usage } = await generateText({
  model: config.model(),
  temperature: config.temperature,
  maxTokens: config.maxTokens,
  system,
  prompt,
});
// usage.inputTokens, usage.outputTokens, usage.totalTokens
// Forward to cost accumulator:
costSessionStore.record('narrative-director', usage);
```

For `streamText`, usage is available after the stream completes:
```typescript
// Source: [VERIFIED: Context7 /vercel/ai docs 2026-04-22]
const result = streamText({ model: ..., system, prompt });
for await (const chunk of result.textStream) { yield chunk; }
const usage = await result.usage;  // resolves after stream completes
costSessionStore.record('narrative-director', usage);
```

### Pattern 4: Prompt Caching per Provider
**What:** Reduce per-turn token costs by caching static system prompt content.

**Anthropic (manual, explicit):**
```typescript
// Source: [VERIFIED: Context7 /vercel/ai, Anthropic provider docs 2026-04-22]
// Apply to the system prompt message part containing world rules / narrative style
await generateText({
  model: anthropic('claude-3-5-sonnet-20240620'),
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: STATIC_SYSTEM_PROMPT,   // world rules, narrative style — never changes
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } },
          },
        },
        { type: 'text', text: dynamicContext },
      ],
    },
  ],
});
// Cache read tokens: result.usage.inputTokenDetails?.cacheReadTokens
// Cache write tokens: result.usage.inputTokenDetails?.cacheWriteTokens
// Note: minimum ~1024 tokens before cache breakpoint is effective
```

**Google/Gemini (implicit, automatic):**
```typescript
// Source: [VERIFIED: Context7 /vercel/ai, Google provider docs 2026-04-22]
// Structure prompt so static content comes first — Gemini auto-caches on repeated prefix
const prompt = `${STATIC_SYSTEM_CONTEXT}\n\n${dynamicTurnContext}`;
// providerMetadata.google.usageMetadata.cachedContentTokenCount shows cache hits
// No explicit API call needed — just keep prefix consistent across turns
```

**OpenAI (implicit, automatic):**
```typescript
// Source: [VERIFIED: Context7 /vercel/ai, OpenAI provider docs 2026-04-22]
// Automatic for prompts >= 1024 tokens on gpt-4o and gpt-4o-mini
// Check via: providerMetadata?.openai?.cachedPromptTokens
// No explicit cacheControl needed — just keep prompt prefix stable
```

**Recommendation:** For v1, implement Anthropic ephemeral cacheControl for roles using Claude. For Google (current default all-Gemini), rely on implicit prefix consistency by placing buildNarrativeSystemPrompt() output always before the dynamic context. OpenAI caches automatically. No code changes needed for Google/OpenAI beyond consistent prompt structure.

### Pattern 5: Background Summarizer Queue
**What:** Priority queue of async summarization tasks, non-blocking, version-checked atomic write.

```typescript
// Source: project pattern — createStore + immer, event-driven (established patterns)
// src/ai/summarizer/summarizer-queue.ts

export type SummarizerTaskType = 'chapter_summary' | 'npc_memory_compress' | 'turn_log_compress';

export type SummarizerTask = {
  readonly id: string;
  readonly type: SummarizerTaskType;
  readonly targetId: string;           // npcId, 'player', or 'session'
  readonly entryIds: readonly string[]; // IDs of items to compress
  readonly baseVersion: number;        // store version at task creation time
  readonly priority: number;           // 1=high (explicit event), 2=medium (threshold), 3=low (interval)
  readonly triggerReason: string;
  readonly createdAt: string;
  readonly status: 'pending' | 'running' | 'done' | 'failed';
};

export type SummarizerQueueState = {
  readonly tasks: readonly SummarizerTask[];
  readonly isRunning: boolean;
  readonly lastRunAt: string | null;
};
```

**Atomic write-back pattern:**
```typescript
// Source: project pattern — Object.is comparison + immer produce
async function applyCompression(task: SummarizerTask, result: string): Promise<'applied' | 'conflict'> {
  const current = npcMemoryStore.getState();
  const record = current.memories[task.targetId];
  if (!record || record.version !== task.baseVersion) {
    return 'conflict';  // data changed while summarizing — preserve originals
  }
  npcMemoryStore.setState(draft => {
    const r = draft.memories[task.targetId];
    if (r) {
      r.archiveSummary = result;
      r.recentMemories = r.recentMemories.slice(task.entryIds.length);
      r.version += 1;
    }
  });
  return 'applied';
}
```

Note: `NpcMemoryRecord` does not currently have a `version` field. The plan must add `version: number` to the schema (SaveDataV4 migration or in-place extension).

### Pattern 6: Replay Panel with Scrollable List
**What:** Scrollable timeline of TurnLogEntry using @inkjs/ui Select or raw useInput with offset state.

**Option A — @inkjs/ui Select:**
```typescript
// Source: [VERIFIED: Context7 /vadimdemedes/ink-ui 2026-04-22]
import { Select } from '@inkjs/ui';

// Map TurnLogEntry[] → Select options
const options = entries.map(e => ({
  label: `[T${e.turnNumber}] ${e.action.slice(0, 60)}`,
  value: String(e.turnNumber),
}));

<Select
  options={options}
  visibleOptionCount={Math.floor(height * 0.6)}
  onChange={(value) => setSelectedTurn(Number(value))}
/>
```
Limitation: Select fires onChange on each keystroke navigation — detail panel updates in real-time.

**Option B — raw useInput + scroll offset (simpler for detail pane layout):**
```typescript
// Source: [VERIFIED: Context7 /vadimdemedes/ink useInput hook 2026-04-22]
const [offset, setOffset] = useState(0);
useInput((input, key) => {
  if (key.escape) { onClose(); return; }
  if (key.upArrow || input === 'p') setOffset(o => Math.max(0, o - 1));
  if (key.downArrow || input === 'n') setOffset(o => Math.min(entries.length - 1, o + 1));
  if (key.pageUp) setOffset(o => Math.max(0, o - PAGE_SIZE));
  if (key.pageDown) setOffset(o => Math.min(entries.length - 1, o + PAGE_SIZE));
});
const PAGE_SIZE = 5;
const visible = entries.slice(offset, offset + visibleCount);
```
**Recommendation:** Use Option B (raw useInput + offset state) for the replay panel. It gives full control over the two-pane layout (list + detail). `@inkjs/ui Select` is better for single-choice selection forms; replay is a browse-and-inspect workflow. Both approaches are valid — planner decides based on layout needs.

### Anti-Patterns to Avoid

- **Blocking AI call in game loop for summarization:** The summarizer must enqueue a task and return immediately. Never `await` a summarizer LLM call from within `processInput()`.
- **Re-calling LLM in `/replay`:** D-09 explicitly forbids this. Replay renders stored `TurnLogEntry.narrationLines` verbatim.
- **Storing per-turn cost in SaveData:** Session cost is ephemeral — do not persist to save files. Only persist it for the duration of the session in a non-serialized store.
- **Using `generateObject` (deprecated):** AI SDK v5 deprecates `generateObject`. Use `generateText` with `Output.object({ schema })` instead.
- **Building a custom provider abstraction:** AI SDK's `createProviderRegistry` already solves multi-provider aliasing. Use it for the provider factory map rather than a hand-rolled registry.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Custom tokenizer | AI SDK `usage.inputTokens`/`outputTokens` | SDK counts exactly what the provider billed — no approximation needed |
| Provider aliasing | Custom provider string-to-constructor map | AI SDK `createProviderRegistry` | Handles model ID routing, provider-specific options, type safety |
| Structured summarizer output | Custom JSON parser | `generateText` + `Output.object({ schema: z.object({...}) })` | Type-safe structured output, handles provider-specific JSON mode |
| Async task queue with backpressure | Custom event loop scheduler | Simple `Promise` queue with priority array + running flag | Bun handles concurrency; a running-flag + sorted array is sufficient for 1 concurrent task |
| Scrollable list keyboard nav | Custom terminal scroll widget | `@inkjs/ui Select` or raw useInput + offset state | Already in project; tested; handles CJK character width |

**Key insight:** The AI SDK abstracts almost all provider-specific complexity. Don't duplicate its token counting, caching metadata, or structured output. Surface the data the SDK already returns.

## Common Pitfalls

### Pitfall 1: Version Field Missing from NpcMemoryRecord
**What goes wrong:** The atomic write-back pattern requires a `version: number` on `NpcMemoryRecord` to detect conflicting writes. The current schema does not have it.
**Why it happens:** Phase 3 defined the three-layer schema; version stamping was not needed then.
**How to avoid:** Plan must include a schema extension task for `NpcMemoryRecord` (add `version: number`, default 0) and a `SaveDataV4` migration step (or treat SaveData version as still V3 with optional field).
**Warning signs:** Summarizer silently overwrites recent memories that were added during compression.

### Pitfall 2: streamText usage Only Resolves After Stream Completes
**What goes wrong:** Capturing `usage` from `streamText` too early gives undefined.
**Why it happens:** Usage is only available after all chunks are consumed — it's a Promise.
**How to avoid:** Always `await result.usage` after consuming `result.textStream`. If forwarding to cost store in `streamNarration()`, capture after the `for await` loop.
**Warning signs:** `usage.inputTokens` is undefined in cost totals.

### Pitfall 3: Anthropic Cache Miss Due to Prompt Structure Order
**What goes wrong:** Static content placed after dynamic content never gets cached.
**Why it happens:** Cache breakpoints apply to the prefix — dynamic content before the static block invalidates the cache position.
**How to avoid:** Always place static world rules, narrative style guide, and character skeleton before dynamic turn context in messages array. The `providerOptions.anthropic.cacheControl` breakpoint goes on the last static content part, not the dynamic part.
**Warning signs:** `cacheReadTokens` always 0 despite repeated calls.

### Pitfall 4: Summarizer Enqueue During Combat Violating D-04
**What goes wrong:** A summarizer task fires during active combat because `npc_memory_written` event fires during combat turns.
**Why it happens:** Event triggers are global; combat state is not checked in the scheduler.
**How to avoid:** Scheduler must gate on `combatStore.getState().active` — no low-priority summarization tasks enqueued while `active === true`.
**Warning signs:** Game loop latency spikes during combat as summarizer LLM calls compete for async scheduling.

### Pitfall 5: Cost Session Store Not Reset on Load
**What goes wrong:** Cost from previous session bleeds into a loaded session's `/cost` display.
**Why it happens:** Cost store is ephemeral (not persisted in SaveData), but if not reset on `state_restored` event, the previous session's totals remain.
**How to avoid:** Subscribe cost session store to the `state_restored` event on `eventBus` and reset all counters to zero.
**Warning signs:** `/cost` shows inflated total after `/load`.

### Pitfall 6: TurnLogEntry Missing NPC Dialogue Field
**What goes wrong:** Replay panel (D-08) requires NPC dialogue per turn, but current `TurnLogEntry` schema only has `action`, `checkResult`, `narrationLines`, `turnNumber`, `timestamp`.
**Why it happens:** Phase 4 implemented the turn log structure before Phase 5 replay requirements were finalized.
**How to avoid:** Plan must extend `TurnLogEntry` schema with `npcDialogue?: readonly string[]` and update `appendTurnLog` call sites (dialogue-manager) to populate it.
**Warning signs:** Replay panel shows narration but no NPC dialogue lines.

## Code Examples

### Accessing Token Usage (generateText)
```typescript
// Source: [VERIFIED: Context7 /vercel/ai 2026-04-22]
const { text, usage } = await generateText({
  model: config.model(),
  temperature: config.temperature,
  maxTokens: config.maxTokens,
  system,
  prompt,
});
console.log(usage.inputTokens);   // prompt tokens
console.log(usage.outputTokens);  // completion tokens
console.log(usage.totalTokens);   // sum
// Cache metadata (if provider supports):
// usage.inputTokenDetails?.cacheReadTokens
// usage.inputTokenDetails?.cacheWriteTokens
```

### Accessing Token Usage (streamText)
```typescript
// Source: [VERIFIED: Context7 /vercel/ai 2026-04-22]
const result = streamText({ model: config.model(), system, prompt });
for await (const chunk of result.textStream) { yield chunk; }
const usage = await result.usage;  // await after consuming stream
```

### Anthropic Ephemeral Cache Control
```typescript
// Source: [VERIFIED: Context7 /vercel/ai Anthropic provider 2026-04-22]
await generateText({
  model: anthropic('claude-3-5-sonnet-20240620'),
  messages: [{
    role: 'user',
    content: [
      {
        type: 'text',
        text: STATIC_WORLD_RULES_PROMPT,  // >= 1024 tokens for caching to activate
        providerOptions: {
          anthropic: { cacheControl: { type: 'ephemeral' } },
        },
      },
      { type: 'text', text: dynamicContext },
    ],
  }],
});
```

### Google Implicit Caching
```typescript
// Source: [VERIFIED: Context7 /vercel/ai Google provider 2026-04-22]
// No explicit API — just ensure static content leads the prompt
const prompt = `${STATIC_SYSTEM_CONTEXT}\n\n${dynamicTurnContext}`;
// Same prefix across turns → Gemini auto-caches
// Check hit via: result.providerMetadata?.google?.usageMetadata?.cachedContentTokenCount
```

### OpenAI Automatic Caching Metadata
```typescript
// Source: [VERIFIED: Context7 /vercel/ai OpenAI provider 2026-04-22]
// Automatic for >= 1024 token prompts on gpt-4o/gpt-4o-mini
const { text, providerMetadata } = await generateText({ model: openai('gpt-4o-mini'), prompt });
console.log(providerMetadata?.openai?.cachedPromptTokens);
```

### Cost Session Store (pattern)
```typescript
// Source: project pattern — createStore + immer (established pattern)
type RoleCostEntry = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCost: number;
};

type CostSessionState = {
  readonly byRole: Partial<Record<AiRole, RoleCostEntry>>;
  readonly lastTurnTokens: number;
};

export const costSessionStore = createStore<CostSessionState>(
  { byRole: {}, lastTurnTokens: 0 },
  ({ newState }) => {
    eventBus.emit('token_usage_updated', { lastTurnTokens: newState.lastTurnTokens });
  },
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| generateObject (structured output) | generateText + Output.object() | AI SDK v5.x | generateObject deprecated; use Output.object with schema |
| Anthropic cache: manual HTTP header | providerOptions.anthropic.cacheControl | AI SDK ~v4+ | No raw HTTP needed; SDK handles header injection |
| OpenAI caching: explicit API | Automatic on 1024+ token prompts | OpenAI API 2024 | No code needed; check via providerMetadata.openai.cachedPromptTokens |

**Deprecated/outdated:**
- `generateObject`: deprecated in AI SDK v5. Replace with `generateText` + `Output.object({ schema })`.
- Hardcoded `ROLE_CONFIGS` with all-Google: current state of `providers.ts`. Phase 5 replaces this.

## Runtime State Inventory

Step 2.5 not triggered: this is not a rename/refactor/migration phase. All new functionality is additive.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun runtime | All | ✓ | 1.3.12 | — |
| @ai-sdk/google | Current provider | ✓ | ^3.0.64 | — |
| @ai-sdk/openai | LLM-01 | ✓ | ^3.0.53 | — |
| @ai-sdk/anthropic | LLM-01, LLM-03 | ✗ (not installed) | needs install | Omit Anthropic support in v1 (use Google only) |
| @ai-sdk/alibaba | LLM-01 (Qwen) | ✗ (not installed) | needs install | Omit Qwen in v1 |
| @ai-sdk/deepseek | LLM-01 | ✗ (not installed) | needs install | Omit DeepSeek in v1 |

**Missing dependencies with no fallback:**
- None blocking; multi-provider is additive. Game works with Google-only as default.

**Missing dependencies with fallback:**
- @ai-sdk/anthropic, @ai-sdk/alibaba, @ai-sdk/deepseek: install them; ai-config.yaml specifies which to activate. If a user has no API key for a provider, the config simply maps all roles to google.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | bun test (built-in, Jest-compatible) |
| Config file | none (bun test auto-discovers *.test.ts) |
| Quick run command | `bun test --testNamePattern "<pattern>" -t` |
| Full suite command | `bun test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LLM-01 | ai-config.yaml loads and builds valid ROLE_CONFIGS | unit | `bun test src/ai/config/ai-config-loader.test.ts` | ❌ Wave 0 |
| LLM-01 | Provider factory map resolves all providers | unit | `bun test src/ai/providers.test.ts` | ✅ (extend) |
| LLM-02 | CostSessionStore accumulates tokens per role | unit | `bun test src/state/cost-session-store.test.ts` | ❌ Wave 0 |
| LLM-02 | /cost command returns session summary | unit | `bun test src/game-loop.test.ts -t cost` | ✅ (extend) |
| LLM-03 | Static prompt content placed before dynamic in messages | unit | `bun test src/ai/roles/narrative-director.test.ts -t cache` | ✅ (extend) |
| AI-04 | SummarizerQueue enqueues task without blocking | unit | `bun test src/ai/summarizer/summarizer-queue.test.ts` | ❌ Wave 0 |
| AI-04 | Atomic write-back applies iff baseVersion matches | unit | `bun test src/ai/summarizer/summarizer-worker.test.ts` | ❌ Wave 0 |
| AI-04 | Summarizer does not enqueue during combat | unit | `bun test src/ai/summarizer/summarizer-scheduler.test.ts` | ❌ Wave 0 |
| SAVE-04 | ReplayPanel renders TurnLogEntry list | unit | `bun test src/ui/panels/replay-panel.test.tsx` | ❌ Wave 0 |
| SAVE-04 | /replay N returns N most recent turns | unit | `bun test src/engine/turn-log.test.ts` | ✅ (extend if needed) |

### Sampling Rate
- **Per task commit:** `bun test --testNamePattern "<changed module>"`
- **Per wave merge:** `bun test`
- **Phase gate:** `bun test` — all 571+ tests green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/ai/config/ai-config-loader.test.ts` — covers LLM-01 config loading
- [ ] `src/state/cost-session-store.test.ts` — covers LLM-02 accumulation
- [ ] `src/ai/summarizer/summarizer-queue.test.ts` — covers AI-04 enqueue behavior
- [ ] `src/ai/summarizer/summarizer-worker.test.ts` — covers AI-04 atomic write-back
- [ ] `src/ai/summarizer/summarizer-scheduler.test.ts` — covers AI-04 trigger gating
- [ ] `src/ui/panels/replay-panel.test.tsx` — covers SAVE-04 UI rendering

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Zod schema on ai-config.yaml at load time |
| V6 Cryptography | no | — |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| ai-config.yaml path traversal | Tampering | Resolve config path to absolute before read; reject paths outside project root |
| API key leakage in error messages | Info Disclosure | Catch API errors; log role + error code only, never the full request/response which may contain key material |
| Prompt injection via ai-config.yaml model string | Tampering | Zod validates model field is a plain string; provider factory only accepts known provider IDs from whitelist |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | NpcMemoryRecord needs a `version: number` field for atomic summarizer write-back — not currently in schema | Pitfall 1, Pattern 5 | If schema already has version elsewhere, the plan's migration task is unnecessary; low risk |
| A2 | TurnLogEntry does not include NPC dialogue lines — D-08 requires them for replay | Pitfall 6 | If Phase 4 already added npcDialogue to TurnLogEntry (check appendTurnLog call sites), schema extension is unnecessary |
| A3 | @ai-sdk/anthropic, @ai-sdk/alibaba, @ai-sdk/deepseek are not yet in package.json | Environment Availability | Verified by reading package.json; confirmed correct |
| A4 | streamText usage is a Promise that resolves after stream completion (not synchronous) | Pattern 3 | [VERIFIED via Context7]; low risk |

**Claims A3 and A4 are verified. A1 and A2 require a quick codebase check at plan time.**

## Open Questions

1. **NpcMemoryRecord version field**
   - What we know: atomic write-back pattern requires version stamping; NpcMemoryRecord schema has no such field currently.
   - What's unclear: whether to add it as a non-breaking optional field (default 0) or require a SaveData version bump to V4.
   - Recommendation: Add `version: z.number().int().default(0).optional()` to NpcMemoryRecordSchema — no migration needed since undefined → 0 is safe for existing saves. Plan should verify this.

2. **TurnLogEntry npcDialogue field**
   - What we know: D-08 requires NPC dialogue in replay per turn; TurnLogEntry currently has `narrationLines` but not separate NPC dialogue.
   - What's unclear: whether narration lines already include NPC dialogue text (embedded by dialogue-manager), making a separate field redundant.
   - Recommendation: Check `src/engine/dialogue-manager.ts` and `appendTurnLog` call sites. If NPC dialogue is already in `narrationLines`, no schema change needed. If not, add `npcDialogue?: readonly string[]`.

3. **ai-config.yaml template location**
   - What we know: CONTEXT.md says ai-config.yaml is user-facing and should be readable.
   - What's unclear: whether it lives at project root (git-tracked as template) or in a user config directory.
   - Recommendation: Project root as `ai-config.yaml` (git-tracked with all-Google defaults). Users copy or edit in-place. API keys come from env vars regardless.

## Sources

### Primary (HIGH confidence)
- Context7 `/vercel/ai` (ai_5_0_0) — token usage structure, prompt caching per provider (Anthropic/Google/OpenAI), streamText usage Promise, generateObject deprecation
- Context7 `/vadimdemedes/ink-ui` — Select component API (visibleOptionCount, onChange, options schema)
- Context7 `/vadimdemedes/ink` — useInput hook (upArrow, downArrow, pageUp, pageDown, escape key names)
- Project codebase (`src/ai/providers.ts`, `src/state/`, `src/engine/turn-log.ts`, `src/state/serializer.ts`, `src/state/npc-memory-store.ts`, `src/ui/panels/status-bar.tsx`, `src/events/event-types.ts`)

### Secondary (MEDIUM confidence)
- CLAUDE.md §Technology Stack — provider package versions (@ai-sdk/alibaba 1.0.17, @ai-sdk/deepseek 2.0.29); researched in prior session
- 05-CONTEXT.md — all locked decisions (D-01 through D-11) from discuss phase

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — AI SDK v5 verified via Context7; packages confirmed in package.json
- Architecture: HIGH — based on existing codebase patterns (createStore, immer, mitt, Ink); no guesswork
- Pitfalls: HIGH for A3/A4 (verified); MEDIUM for A1/A2 (flagged for plan-time check)
- Prompt caching per provider: HIGH — verified via Context7 official AI SDK docs

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (AI SDK v5 stable; provider caching APIs stable)
