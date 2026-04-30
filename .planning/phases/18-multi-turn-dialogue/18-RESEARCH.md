# Phase 18: Multi-Turn Dialogue - Research

**Researched:** 2026-04-30
**Domain:** AI SDK v5 multi-turn messages API, DialogueState schema migration, React hook state accumulation
**Confidence:** HIGH

## Summary

Phase 18 upgrades NPC conversations from single-shot (every call resets context) to true multi-turn dialogue, where each LLM call forwards the accumulated `messages[]` array. Three components change: `ai-caller.ts` gains a new message-mode branch, `DialogueManager` migrates its history format, and `useNpcDialogue` accumulates turns internally for the guard creation flow.

The core API change is straightforward: AI SDK v5 already accepts `{ system?: string, messages: ModelMessage[] }` as separate top-level parameters (the `prompt` vs `messages` discriminated union). For Anthropic, cache control on the system string is applied via `providerOptions` on a `SystemModelMessage` object in the messages array — NOT via the current packed-user-message hack. The existing `anthropic_cache` mode in `ai-caller.ts` will be replaced by a new `multi_turn` mode that uses a proper system message object.

The biggest impact point is the `dialogueHistory` field migration: `{speaker, text}[]` → `{role:'user'|'assistant', content:string}[]`. This breaks three consumers — `dialogue-panel.tsx`, `game-screen.tsx`, and `dialogue-manager.ts` itself — all of which read `.speaker` and `.text`. Test coverage for the history shape exists in `dialogue-manager.test.ts` and must be updated alongside the source change.

**Primary recommendation:** Implement as three independent tasks in dependency order: (1) extend `ai-caller.ts` with `multi_turn` mode, (2) migrate `DialogueState.dialogueHistory` schema + all consumers, (3) wire `useNpcDialogue` to accumulate `messages[]` and pass through to `callStreamText`/`callGenerateObject`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** When passing messages[], use AI SDK's separate `system` param + `messages[]` format (not single user-message packing)
- **D-02:** For Anthropic provider, apply `providerOptions.anthropic.cacheControl: {type: 'ephemeral'}` on the `system` parameter to preserve system cache
- **D-03:** `buildAiCallMessages` gets a new messages[] mode branch; single-turn calls (no history) keep existing behavior unchanged
- **D-04:** Completely delete `historySection` from `buildNpcUserPrompt` once messages[] is in place
- **D-05:** No fallback text serialization — history goes through messages[] channel only
- **D-06:** `useNpcDialogue` hook maintains messages[] internally, not via DialogueManager
- **D-07:** `narrative-creation-screen.tsx` passes accumulated messages[] into hook on each round via `startDialogue`
- **D-08:** Hook appends `{role:'user', content: playerAction}` + `{role:'assistant', content: npcResponse}` after each round
- **D-09:** No history size limit — pass full conversation
- **D-10:** Each dialogue session is independent — `startDialogue` resets messages[] (not `endDialogue`)
- **D-11:** `dialogueHistory` in `DialogueState` migrates to `{role: 'user' | 'assistant', content: string}[]`
- **D-12:** UI layer reading `speaker`/`text` fields must be updated to `role`/`content`

### Claude's Discretion
- Exact combination of messages[] with existing retry logic in `callGenerateObject` / `callStreamText`
- Precise API shape for system + messages[] + Anthropic cacheControl in AI SDK v5

### Deferred Ideas (OUT OF SCOPE)
- Persisting dialogue history to save files (NPC memory covers long-term context)
- Multi-turn support for other AI roles (narrative-director, retrieval-planner)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIAL-01 | `ai-caller.ts` accepts optional `messages: Array<{role:'user'\|'assistant', content:string}>` parameter; when present sends multi-turn structure to LLM API | New `multi_turn` MessageMode branch in `buildAiCallMessages`; AI SDK v5 `messages` param confirmed in type definitions |
| DIAL-02 | `DialogueManager` maintains `dialogueHistory` as proper `{role, content}` array per session; history passed to LLM via `messages[]` on each NPC turn | `DialogueStateSchema` migration in `dialogue-store.ts`; `buildNpcLlmContext` passes history through to `generateNpcDialogue` |
| DIAL-03 | Character creation guard dialogue (4 rounds) uses accumulated `messages[]` context | `useNpcDialogue` hook gains internal `messagesRef`; `narrative-creation-screen.tsx` passes prior rounds to hook via `startDialogue` context |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Multi-turn message structure | API / Backend (ai-caller.ts) | — | Single call site for all LLM requests; message formatting is a transport concern |
| Dialogue history accumulation (regular NPC) | Engine (dialogue-manager.ts) | State (dialogue-store.ts) | DialogueManager owns the session lifecycle and already writes dialogueHistory |
| Dialogue history accumulation (guard creation) | UI Hook (use-npc-dialogue.ts) | Screen (narrative-creation-screen.tsx) | Guard flow bypasses DialogueManager entirely; hook is the session controller |
| Schema field migration | State (dialogue-store.ts) | Engine + UI consumers | dialogue-store.ts owns the canonical type; consumers must follow |
| History serialization removal | AI Prompts (npc-system.ts) | — | historySection lives only in buildNpcUserPrompt |

## Standard Stack

### Core (already installed — no new dependencies)
| Library | Version | Purpose | Relevant API |
|---------|---------|---------|--------------|
| ai (Vercel AI SDK) | ^5.0.179 | LLM call abstraction | `generateObject`, `streamText`, `generateText` all accept `{ system?, messages: ModelMessage[] }` |
| @ai-sdk/anthropic | ^3.0.71 | Anthropic provider | Reads `providerOptions` on SystemModelMessage for cache_control |

**No new packages required for Phase 18.** [VERIFIED: node_modules inspection]

## Architecture Patterns

### AI SDK v5 — system + messages[] API

AI SDK v5 `generateObject`, `generateText`, `streamText` all accept a discriminated union for the prompt:

```typescript
// Source: node_modules/ai/dist/index.d.ts — Prompt type
type Prompt =
  | { prompt: string | Array<ModelMessage>; messages?: never; system?: string }
  | { messages: Array<ModelMessage>; prompt?: never; system?: string };
```

Key insight: `system` is always a **separate optional string param**, never inside `messages[]`. You can combine `system + messages[]` directly:

```typescript
// VERIFIED: AI SDK v5 type definitions
generateObject({
  model: model(),
  schema,
  system: 'You are NPC "X".',
  messages: [
    { role: 'user', content: 'greet' },
    { role: 'assistant', content: 'Hello traveler.' },
    { role: 'user', content: 'Tell me about the town.' },
  ],
  // ...
})
```

### Anthropic cacheControl on system param (AI SDK v5)

The Anthropic provider in v5 converts `SystemModelMessage` objects (role:'system' in messages[]) into Anthropic's `system` array with `cache_control`. [VERIFIED: node_modules/@ai-sdk/anthropic/dist/index.js lines 199-213]

The conversion: when a `SystemModelMessage` has `providerMetadata.anthropic.cacheControl`, the provider emits `{ type:'text', text: content, cache_control: { type: 'ephemeral' } }`.

**However**, D-01/D-02 specify using the top-level `system` string param + `providerOptions` on the call itself. The correct approach for AI SDK v5 `generateObject`/`streamText` with Anthropic cache on the system param is:

```typescript
// VERIFIED via Anthropic provider source: SystemModelMessage providerMetadata path
// Option A: pass system as SystemModelMessage inside messages[] with providerOptions
messages: [
  {
    role: 'system' as const,
    content: systemPrompt,
    providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
  },
  ...conversationMessages,
]
// Note: 'system' role in ModelMessage is SystemModelMessage type [VERIFIED: @ai-sdk/provider-utils types]
```

The existing `anthropic_cache` mode packs everything into a single user message with content-block-level providerOptions. For multi-turn, the system must be extracted as a separate SystemModelMessage so the subsequent user/assistant messages are real turns.

**New MessageMode shape for `buildAiCallMessages`:**

```typescript
// ASSUMED: exact implementation detail — confirmed from type inspection but not runtime-tested
type MessageMode =
  | { readonly mode: 'standard'; readonly options: { readonly system: string; readonly prompt: string } }
  | { readonly mode: 'anthropic_cache'; readonly options: { readonly messages: Array<Record<string, unknown>> } }
  | { readonly mode: 'multi_turn'; readonly options: { readonly messages: Array<Record<string, unknown>> } };

// multi_turn: system wrapped as SystemModelMessage + prior turns + current user turn
function buildMultiTurnMessages(
  providerName: string,
  system: string,
  prompt: string,
  history: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>,
): MessageMode {
  const systemMsg = providerName === 'anthropic'
    ? { role: 'system' as const, content: system, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } }
    : { role: 'system' as const, content: system };

  return {
    mode: 'multi_turn',
    options: {
      messages: [
        systemMsg,
        ...history.map(h => ({ role: h.role, content: h.content })),
        { role: 'user' as const, content: prompt },
      ],
    },
  };
}
```

### DialogueState schema migration

Current `dialogue-store.ts`:
```typescript
// VERIFIED: src/state/dialogue-store.ts lines 7-10
const DialogueEntrySchema = z.object({
  speaker: z.enum(['npc', 'player', 'narration']),
  text: z.string(),
});
```

Target after D-11:
```typescript
const DialogueEntrySchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});
```

### useNpcDialogue hook — messages[] accumulation pattern

Current hook uses `useRef` for streaming state (confirmed at line 34-36). Decision D-06 says messages[] accumulation also uses `useRef` (cross-render persistence without triggering re-renders).

```typescript
// ASSUMED: implementation pattern; consistent with existing useRef usage in hook
const messagesRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

// In startDialogue — D-10: reset on new session start (when no prior context)
// narrative-creation-screen.tsx calls startDialogue with accumulated context per D-07
// Hook appends to messagesRef AFTER stream completion (D-08)
```

### narrative-creation-screen.tsx — current vs target flow

Current: each `startDialogue` call is stateless — no history passed:
```typescript
// VERIFIED: narrative-creation-screen.tsx lines 109-114
npcDialogue.startDialogue({
  npcProfile: guardProfile,
  scene: sceneContext,
  playerAction,
  memories: [],
  // conversationHistory: undefined  <-- always empty
});
```

Target (D-07): screen must track `accumulatedMessages` state and pass it on each round. After each round completes, screen reads the hook's internal messages ref (or hook exposes accumulated messages) to build the next call.

Decision note: D-07 says "screen passes accumulated messages[] on each `startDialogue` call." D-08 says hook appends after each round. Two design options:

1. Hook owns full accumulation, screen just calls `startDialogue(context)` — hook detects continuation by checking if `conversationHistory` is absent vs present.
2. Screen owns accumulation state, passes current history into each `startDialogue` call.

D-06 ("useNpcDialogue internally maintains messages[]") and D-08 ("hook appends") point to option 1: hook owns the array, but screen must signal "this is a continuation" vs "this is a fresh session" (D-10 says startDialogue resets). This requires either: (a) an explicit `resetMessages()` call from screen before round 1, or (b) hook auto-resets only when screen calls some reset sentinel.

**[ASSUMED]:** The cleanest resolution consistent with all decisions: hook auto-resets `messagesRef` only on explicit `reset()` call, not on `startDialogue`. This means: screen calls `npcDialogue.reset()` before round 1 (which it already does on Escape), and subsequent rounds call `startDialogue` which appends. This matches the existing `reset()` call at line 190.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-turn message format | Custom chat format serializer | AI SDK ModelMessage[] | SDK handles provider-specific wire format (Anthropic vs OpenAI differ) |
| Anthropic cache on system | Manual cache_control injection | providerOptions on SystemModelMessage | Provider adapter owns the wire format; direct injection would bypass future SDK changes |

## Common Pitfalls

### Pitfall 1: Mixing `prompt` and `messages` in AI SDK v5
**What goes wrong:** Passing both `prompt: string` AND `messages: []` throws at runtime — SDK enforces a discriminated union.
**Why it happens:** The current `...msgOpts.options` spread passes either `{system, prompt}` or `{messages}`. If the new multi_turn mode still includes `prompt`, both keys end up in the spread.
**How to avoid:** The `multi_turn` mode options must NOT include a `prompt` key — only `messages`. The current user turn is appended as the last entry in messages[].
**Warning signs:** TypeScript `as any` cast on the `generateObject` call currently hides this — tests would catch it at runtime.

### Pitfall 2: ai-caller.ts `as any` cast hides type errors
**What goes wrong:** All three call sites (`callGenerateText`, `callGenerateObject`, `callStreamText`) use `} as any` to suppress type errors. New code can silently pass wrong shapes.
**Why it happens:** The existing `anthropic_cache` mode packs messages in non-standard ways the SDK types don't match.
**How to avoid:** After adding the `multi_turn` branch, add a test that explicitly checks the messages array shape passed to the SDK mock.
**Warning signs:** Tests for `buildAiCallMessages` currently only check `mode` and `options` shape — add a test for the multi-turn case.

### Pitfall 3: dialogueHistory consumers reading `.speaker` / `.text` after migration
**What goes wrong:** TypeScript will catch these, but only if `DialogueEntrySchema` is migrated first.
**Affected files (VERIFIED: grep):**
- `src/ui/panels/dialogue-panel.tsx` lines 105-106: `entry.speaker`, `entry.text`
- `src/ui/screens/game-screen.tsx` lines 317-318: `e.speaker === 'npc'`, `e.text`
- `src/engine/dialogue-manager.ts` lines 339, 344, 411, 493-497, 602-606: writes `{speaker, text}`
- `src/ai/roles/npc-actor.ts` line 12: `NpcActorOptions.conversationHistory` type
- `src/ui/hooks/use-npc-dialogue.ts` line 17: `NpcDialogueContext.conversationHistory` type

All must migrate in the same plan or TypeScript compilation breaks.

### Pitfall 4: useNpcDialogue metadata extraction runs after stream completion
**What goes wrong:** The hook's completion `useEffect` (lines 68-108) runs `generateNpcDialogue` again for metadata extraction. This second call will NOT have access to history unless messagesRef is passed to it too.
**Why it matters:** The second call to `generateNpcDialogue` uses `ctx.conversationHistory` from the context snapshot. If context carries the history, it gets forwarded. If not, the metadata call is single-turn.
**How to avoid:** When adding messages[] accumulation to `streamNpcDialogue`, also thread it through the fallback `generateNpcDialogue` call in the completion handler.

### Pitfall 5: `narrative-creation-screen.tsx` reset() call timing
**What goes wrong:** `npcDialogue.reset()` is called in `handleOptionSelected` (line 190) before setting the next phase. If `reset()` clears `messagesRef`, it would wipe history before round N+1 can pick it up.
**Why it happens:** D-10 says "startDialogue resets messages[]" — but if reset() also clears it, the guard flow breaks.
**How to avoid:** `reset()` should clear streaming state only (as it does now). Messages[] accumulation should be cleared only on `startDialogue` when the hook decides this is a new session (e.g., when `roundNumber === 1` or screen signals fresh start).

## Code Examples

### Current ai-caller.ts buildAiCallMessages (for reference)
```typescript
// Source: src/ai/utils/ai-caller.ts lines 7-39 [VERIFIED]
type MessageMode =
  | { readonly mode: 'standard'; readonly options: { readonly system: string; readonly prompt: string } }
  | { readonly mode: 'anthropic_cache'; readonly options: { readonly messages: Array<Record<string, unknown>> } };

// anthropic_cache currently packs BOTH system and prompt into a single user message
// This must change for multi-turn: system becomes a separate SystemModelMessage
```

### Current NpcActorOptions.conversationHistory type (must migrate)
```typescript
// Source: src/ai/roles/npc-actor.ts lines 8-13 [VERIFIED]
export type NpcActorOptions = {
  readonly conversationHistory?: readonly { readonly speaker: string; readonly text: string }[];
  // ...
};
// After migration: { readonly role: 'user' | 'assistant'; readonly content: string }[]
```

### Current dialogue-manager.ts history writes (all must migrate)
```typescript
// Source: src/engine/dialogue-manager.ts line 411 [VERIFIED]
draft.dialogueHistory = [{ speaker: 'npc', text: npcDialogue.dialogue }];

// Source: lines 493-497 [VERIFIED]
draft.dialogueHistory = [
  ...state.dialogueHistory,
  { speaker: 'player', text: response.label },
  { speaker: 'npc', text: npcDialogue.dialogue },
];
```

After migration:
```typescript
draft.dialogueHistory = [{ role: 'assistant', content: npcDialogue.dialogue }];
// ...
draft.dialogueHistory = [
  ...state.dialogueHistory,
  { role: 'user', content: response.label },
  { role: 'assistant', content: npcDialogue.dialogue },
];
```

### dialogue-panel.tsx consumer (must migrate field names)
```typescript
// Source: src/ui/panels/dialogue-panel.tsx lines 104-107 [VERIFIED]
{recentHistory.map((entry, i) => (
  <Text key={i} dimColor={entry.speaker !== 'npc'}>
    {entry.speaker === 'npc' ? `"${entry.text}"` : `你："${entry.text}"`}
  </Text>
))}
// After migration: entry.role !== 'assistant', entry.role === 'assistant', entry.content
```

### game-screen.tsx consumer (must migrate field names)
```typescript
// Source: src/ui/screens/game-screen.tsx lines 316-318 [VERIFIED]
...dialogueState.dialogueHistory
  .filter((e) => e.speaker === 'npc')
  .map((e) => `${dialogueState.npcName}："${e.text}"`),
// After migration: e.role === 'assistant', e.content
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pack system+history into single user message | Separate `system` param + `messages[]` | AI SDK v5 | Cleaner token accounting; Anthropic cache applies per-block |
| Text-serialize history into user prompt | Native messages[] array | Phase 18 | LLM receives typed role/content; no prompt engineering for history format |

**Deprecated/outdated:**
- `historySection` in `buildNpcUserPrompt`: replaced by messages[] — will be deleted per D-04

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `reset()` should clear streaming state only (not messagesRef); startDialogue signals fresh session by round being 1 | Common Pitfalls #5, Patterns | Guard flow loses accumulated context if reset() wipes messagesRef at wrong time |
| A2 | multi_turn mode passes system as SystemModelMessage (role:'system') inside messages[], not as top-level `system` string param — so all providers see it correctly | Architecture Patterns | Non-Anthropic providers may not handle SystemModelMessage in messages[] the same way |
| A3 | The fallback `generateNpcDialogue` call in useNpcDialogue completion handler also needs history threaded through | Common Pitfalls #4 | Metadata extraction call will be single-turn; acceptable degradation but impure |

## Open Questions

1. **Does the `system` top-level string param coexist with `messages[]` in AI SDK v5?**
   - What we know: `Prompt` type shows `system?: string` alongside `messages: Array<ModelMessage>` — they are separate fields
   - What's unclear: Whether Anthropic provider handles `system` string + `messages[]` correctly, or whether SystemModelMessage in messages[] is the only path
   - Recommendation: Use SystemModelMessage inside messages[] (consistent with how existing `anthropic_cache` mode works; avoids two separate parameters)

2. **How does narrative-creation-screen signal "new session" vs "continuation" to useNpcDialogue?**
   - What we know: `reset()` is called before each round change; `startDialogue` is called after
   - What's unclear: If reset() clears messagesRef, round 1's startDialogue has empty history (correct). Round 2+ should have history. But reset() is called before every round, which would wipe it.
   - Recommendation: Screen must either (a) accumulate messages[] in its own state and pass via conversationHistory in the context object, OR (b) hook treats reset() as "wipe streaming only" and adds a separate `resetMessages()` API. Option (a) is simpler and keeps the hook stateless about session identity.

## Environment Availability

Step 2.6: SKIPPED — Phase 18 is code-only changes with no new external dependencies.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | bun test (built-in) |
| Config file | none — bun detects automatically |
| Quick run command | `bun test src/ai/utils/ai-caller.test.ts src/engine/dialogue-manager.test.ts src/ui/hooks/use-npc-dialogue.test.ts 2>/dev/null` |
| Full suite command | `bun test 2>/dev/null` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIAL-01 | `buildAiCallMessages` with history[] returns multi_turn mode with SystemModelMessage + prior turns + current user turn | unit | `bun test src/ai/utils/ai-caller.test.ts -t "multi_turn"` | ❌ Wave 0 |
| DIAL-01 | `callGenerateObject` with messages[] forwards them to SDK without including `prompt` key | unit | `bun test src/ai/utils/ai-caller.test.ts -t "callGenerateObject.*messages"` | ❌ Wave 0 |
| DIAL-01 | Anthropic provider path applies cacheControl on system message inside messages[] | unit | `bun test src/ai/utils/ai-caller.test.ts -t "anthropic.*multi_turn"` | ❌ Wave 0 |
| DIAL-02 | `DialogueManager.startDialogue` writes `{role:'assistant', content}` format (not speaker/text) | unit | `bun test src/engine/dialogue-manager.test.ts` | ✅ (existing tests will break — need update) |
| DIAL-02 | `processPlayerResponse` appends `{role:'user'}` + `{role:'assistant'}` entries to history | unit | `bun test src/engine/dialogue-manager.test.ts -t "history"` | ❌ Wave 0 |
| DIAL-02 | `generateNpcDialogue` called with prior history passes it as messages[] to callGenerateObject | unit | `bun test src/ai/roles/npc-actor.test.ts -t "messages\[\]"` | ❌ Wave 0 |
| DIAL-03 | `useNpcDialogue` accumulates messages[] across 3 calls without reset | unit | `bun test src/ui/hooks/use-npc-dialogue.test.ts -t "accumulate"` | ❌ Wave 0 |
| DIAL-03 | Guard's third response references prior rounds (integration: 3-turn sequence) | unit | `bun test src/ui/hooks/use-npc-dialogue.test.ts -t "3.turn\|three.turn"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test src/ai/utils/ai-caller.test.ts src/engine/dialogue-manager.test.ts`
- **Per wave merge:** `bun test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] New test cases in `src/ai/utils/ai-caller.test.ts` — covers DIAL-01 multi_turn branch
- [ ] New test cases in `src/engine/dialogue-manager.test.ts` — update existing `{speaker,text}` assertions + add history-passing tests for DIAL-02
- [ ] New test cases in `src/ai/roles/npc-actor.test.ts` — verify conversationHistory threaded as messages[]
- [ ] New test file `src/ui/hooks/use-npc-dialogue.test.ts` (does not currently exist) — covers DIAL-03 accumulation

## Project Constraints (from CLAUDE.md)

- **TypeScript + Bun runtime** — all code must run natively under Bun
- **Immutability** — no in-place mutation; history arrays built via spread/concat
- **Functions < 50 lines** — if `buildAiCallMessages` grows past 50 lines, extract helper
- **No hardcoded values** — message role strings ('user', 'assistant') are fine as enum values in Zod schema
- **Error handling** — retry logic in `callGenerateObject`/`callStreamText` must continue to work with messages[] path
- **No mutation** — `messagesRef.current` accumulation must use spread: `[...prev, newEntry]` not `push()`

## Sources

### Primary (HIGH confidence)
- `node_modules/ai/dist/index.d.ts` — confirmed `Prompt` discriminated union: `messages: Array<ModelMessage>` vs `prompt: string`; `system?: string` is separate top-level field
- `node_modules/@ai-sdk/anthropic/dist/index.js` lines 195-213 — confirmed SystemModelMessage → Anthropic `system[]` with `cache_control` conversion path
- `node_modules/@ai-sdk/provider-utils/dist/index.d.ts` — confirmed `ModelMessage = SystemModelMessage | UserModelMessage | AssistantModelMessage | ToolModelMessage`
- `src/ai/utils/ai-caller.ts` — verified existing MessageMode type and buildAiCallMessages implementation
- `src/engine/dialogue-manager.ts` — verified all `{speaker, text}` write sites
- `src/ui/panels/dialogue-panel.tsx` — verified `entry.speaker`, `entry.text` read sites
- `src/ui/screens/game-screen.tsx` — verified `e.speaker`, `e.text` read sites
- `src/state/dialogue-store.ts` — verified DialogueEntrySchema current shape
- `src/ui/hooks/use-npc-dialogue.ts` — verified useRef pattern, startDialogue/reset call chain
- `src/ui/screens/narrative-creation-screen.tsx` — verified all 3 startDialogue call sites and reset() usage

### Secondary (MEDIUM confidence)
- Anthropic SDK source code inspection — cacheControl path via providerMetadata confirmed at runtime code level (not type definition)

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — no new packages; existing SDK confirmed via type inspection
- Architecture: HIGH — all file locations and field names verified from source
- Pitfalls: HIGH — consumer files and test assertions verified by grep
- API shape (multi_turn mode): MEDIUM-HIGH — types confirmed, wire format inferred from existing anthropic_cache implementation pattern

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (AI SDK v5 stable; Anthropic provider interface stable)
