# Phase 18: Multi-Turn Dialogue - Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 7 (modified), 1 (new test)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/ai/utils/ai-caller.ts` | utility (LLM transport) | request-response | self (existing file) | exact |
| `src/ai/roles/npc-actor.ts` | service (AI role) | request-response | self (existing file) | exact |
| `src/ai/prompts/npc-system.ts` | utility (prompt builder) | transform | `src/ai/prompts/guard-creation-prompt.ts` | role-match |
| `src/state/dialogue-store.ts` | store / schema | CRUD | `src/state/create-store.ts` | role-match |
| `src/engine/dialogue-manager.ts` | engine (session logic) | event-driven | self (existing file) | exact |
| `src/ui/hooks/use-npc-dialogue.ts` | hook (UI state) | streaming | self (existing file) | exact |
| `src/ui/screens/narrative-creation-screen.tsx` | screen (UI orchestrator) | event-driven | self (existing file) | exact |
| `src/ui/panels/dialogue-panel.tsx` | component (display) | request-response | self (existing file) | exact |
| `src/ui/screens/game-screen.tsx` | screen (consumer) | request-response | self (existing file) | exact |

---

## Pattern Assignments

### `src/ai/utils/ai-caller.ts` (utility, request-response)

**Change type:** Add `multi_turn` branch to `MessageMode` discriminated union and `buildAiCallMessages`.

**Existing MessageMode type** (lines 7-9):
```typescript
type MessageMode =
  | { readonly mode: 'standard'; readonly options: { readonly system: string; readonly prompt: string } }
  | { readonly mode: 'anthropic_cache'; readonly options: { readonly messages: Array<Record<string, unknown>> } };
```

**Target — add third variant:**
```typescript
type MessageMode =
  | { readonly mode: 'standard'; readonly options: { readonly system: string; readonly prompt: string } }
  | { readonly mode: 'anthropic_cache'; readonly options: { readonly messages: Array<Record<string, unknown>> } }
  | { readonly mode: 'multi_turn'; readonly options: { readonly messages: Array<Record<string, unknown>> } };
```

**Existing buildAiCallMessages signature** (lines 11-15):
```typescript
export function buildAiCallMessages(
  providerName: string,
  system: string,
  prompt: string,
): MessageMode {
```

**Target signature — add optional history param:**
```typescript
export function buildAiCallMessages(
  providerName: string,
  system: string,
  prompt: string,
  history?: ReadonlyArray<{ readonly role: 'user' | 'assistant'; readonly content: string }>,
): MessageMode {
```

**Core pattern for multi_turn branch** (modeled on existing `anthropic_cache` branch at lines 16-37):
```typescript
// When history is provided, use multi_turn regardless of provider
if (history && history.length > 0) {
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

**Call site spread pattern** (lines 81-86, 109-115, 132-142) — the `...msgOpts.options` spread is the integration point:
```typescript
const result = await generateObject({
  model: model(),
  schema,
  temperature,
  maxOutputTokens: maxTokens,
  ...msgOpts.options,  // spreads either {system, prompt} OR {messages} — never both
} as any);
```

**Key constraint:** `multi_turn` options must contain ONLY `messages` (no `prompt` key). AI SDK v5 enforces a discriminated union between `prompt: string` and `messages: ModelMessage[]`.

**Callers to update** — `callGenerateText`, `callGenerateObject`, `callStreamText` all call `buildAiCallMessages(providerName, system, prompt)`. Each needs to accept and forward the optional `history` parameter:
```typescript
// Current signature (line 74):
const { role, providerName, model, temperature, maxTokens, system, prompt } = opts;
const msgOpts = buildAiCallMessages(providerName, system, prompt);

// Target — add history to BaseCallOptions and forward:
const msgOpts = buildAiCallMessages(providerName, system, prompt, opts.history);
```

**Test pattern** (from `ai-caller.test.ts` lines 1-46):
```typescript
// Existing test structure to copy for multi_turn cases:
it('builds multi_turn messages with SystemModelMessage + history + current user turn', () => {
  const result = buildAiCallMessages('google', 'sys', 'current', [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: 'hello' },
  ]);
  expect(result.mode).toBe('multi_turn');
  const msgs = (result.options as any).messages;
  expect(msgs[0].role).toBe('system');
  expect(msgs[1]).toEqual({ role: 'user', content: 'hi' });
  expect(msgs[2]).toEqual({ role: 'assistant', content: 'hello' });
  expect(msgs[3]).toEqual({ role: 'user', content: 'current' });
  expect(result.options).not.toHaveProperty('prompt');
});
```

---

### `src/ai/roles/npc-actor.ts` (service, request-response)

**Change type:** Migrate `NpcActorOptions.conversationHistory` type; forward history to `callGenerateObject`/`callStreamText`.

**Current type** (lines 8-13):
```typescript
export type NpcActorOptions = {
  readonly maxRetries?: number;
  readonly archiveSummary?: string;
  readonly relevantCodex?: readonly string[];
  readonly conversationHistory?: readonly { readonly speaker: string; readonly text: string }[];
};
```

**Target type:**
```typescript
export type NpcActorOptions = {
  readonly maxRetries?: number;
  readonly archiveSummary?: string;
  readonly relevantCodex?: readonly string[];
  readonly conversationHistory?: readonly { readonly role: 'user' | 'assistant'; readonly content: string }[];
};
```

**Core pattern — forwarding history to callGenerateObject** (lines 36-46):
```typescript
const { object } = await callGenerateObject<NpcDialogue>({
  role: 'npc-actor',
  providerName: config.providerName,
  model: config.model,
  temperature: config.temperature,
  maxTokens: config.maxTokens,
  system,
  prompt,
  schema: NpcDialogueSchema,
  maxRetries: options?.maxRetries,
  history: options?.conversationHistory,  // NEW — thread to ai-caller
});
```

**Same pattern for callStreamText** (lines 74-83):
```typescript
yield* callStreamText({
  role: 'npc-actor',
  providerName: config.providerName,
  model: config.model,
  temperature: config.temperature,
  maxTokens: config.maxTokens,
  system,
  prompt,
  maxRetries: options?.maxRetries,
  history: options?.conversationHistory,  // NEW
});
```

**Test pattern** (from `npc-actor.test.ts` lines 133-136) — how to assert call args:
```typescript
const callArgs = (mockGenerateObject.mock.calls[0] as unknown as [Record<string, unknown>])[0];
expect(callArgs.system).toContain('...');
// For history test:
expect(callArgs.messages).toBeDefined();
expect((callArgs.messages as any[])[0].role).toBe('system');
```

---

### `src/ai/prompts/npc-system.ts` (utility, transform)

**Change type:** Delete `historySection` from `buildNpcUserPrompt`; remove `conversationHistory` from `NpcUserPromptContext`.

**Current historySection** (lines 96-101) — DELETE entirely:
```typescript
const historySection = context.conversationHistory?.length
  ? `\n本轮对话历史：\n${context.conversationHistory
      .slice(-6)
      .map((h) => `${h.speaker === 'player' ? '玩家' : '你'}：${h.text}`)
      .join('\n')}`
  : '';
```

**Current NpcUserPromptContext** (lines 75-83) — remove `conversationHistory` field:
```typescript
export type NpcUserPromptContext = {
  readonly scene: string;
  readonly playerAction: string;
  readonly memories: readonly string[];
  readonly emotionHint?: string;
  readonly archiveSummary?: string;
  readonly relevantCodex?: readonly string[];
  // DELETE: readonly conversationHistory?: readonly { readonly speaker: string; readonly text: string }[];
};
```

**buildNpcUserPrompt return** (lines 103-107) — remove `${historySection}` from template literal:
```typescript
return `场景：${context.scene}
玩家动作：${context.playerAction}
你对这个玩家的记忆：${memoriesText}${archiveSection}${codexSection}
当前情绪倾向：${context.emotionHint ?? '中立'}
请以角色身份回应。`;
```

---

### `src/state/dialogue-store.ts` (store/schema, CRUD)

**Change type:** Migrate `DialogueEntrySchema` field names.

**Current schema** (lines 7-10):
```typescript
const DialogueEntrySchema = z.object({
  speaker: z.enum(['npc', 'player', 'narration']),
  text: z.string(),
});
```

**Target schema:**
```typescript
const DialogueEntrySchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});
```

**Store creation pattern** (lines 46-62) — unchanged, copy as reference for store wiring:
```typescript
export function createDialogueStore(bus: EventBus): Store<DialogueState> {
  return createStore<DialogueState>(
    getDefaultDialogueState(),
    ({ newState, oldState }) => {
      if (newState.active && !oldState.active && newState.npcId) {
        bus.emit('dialogue_started', { npcId: newState.npcId, npcName: newState.npcName, mode: newState.mode });
      }
      if (!newState.active && oldState.active && oldState.npcId) {
        bus.emit('dialogue_ended', { npcId: oldState.npcId });
      }
    },
  );
}
```

---

### `src/engine/dialogue-manager.ts` (engine, event-driven)

**Change type:** (1) Migrate all `{speaker, text}` writes to `{role, content}`; (2) update `buildNpcLlmContext` return type; (3) pass history to `doGenerateDialogue` via messages[].

**buildNpcLlmContext return type** (lines 336-368) — migrate field name in return type and conversationHistory assignment:
```typescript
// Current return type annotation (line 339-344):
function buildNpcLlmContext(
  npc: Npc,
  memoryRecord: NpcMemoryRecord | undefined,
  dialogueHistory: readonly { readonly speaker: string; readonly text: string }[],
): {
  // ...
  conversationHistory: readonly { readonly speaker: string; readonly text: string }[];
}

// Target:
function buildNpcLlmContext(
  npc: Npc,
  memoryRecord: NpcMemoryRecord | undefined,
  dialogueHistory: readonly { readonly role: 'user' | 'assistant'; readonly content: string }[],
): {
  // ...
  conversationHistory: readonly { readonly role: 'user' | 'assistant'; readonly content: string }[];
}
```

**startDialogue history write** (line 411) — migrate:
```typescript
// Current:
draft.dialogueHistory = [{ speaker: 'npc', text: npcDialogue.dialogue }];
// Target:
draft.dialogueHistory = [{ role: 'assistant', content: npcDialogue.dialogue }];
```

**processPlayerResponse history write** (lines 493-497) — migrate:
```typescript
// Current:
draft.dialogueHistory = [
  ...state.dialogueHistory,
  { speaker: 'player', text: response.label },
  { speaker: 'npc', text: npcDialogue.dialogue },
];
// Target:
draft.dialogueHistory = [
  ...state.dialogueHistory,
  { role: 'user', content: response.label },
  { role: 'assistant', content: npcDialogue.dialogue },
];
```

**processPlayerFreeText history write** (lines 602-606) — same pattern:
```typescript
// Current:
draft.dialogueHistory = [
  ...state.dialogueHistory,
  { speaker: 'player', text },
  { speaker: 'npc', text: npcDialogue.dialogue },
];
// Target:
draft.dialogueHistory = [
  ...state.dialogueHistory,
  { role: 'user', content: text },
  { role: 'assistant', content: npcDialogue.dialogue },
];
```

**History threading to doGenerateDialogue** — `buildNpcLlmContext` already returns `conversationHistory` and it is passed as `options.conversationHistory` (lines 396, 481, 590). After migrating the type, `npc-actor.ts` forwards it as `history` to `ai-caller.ts` — no change needed at the `dialogue-manager.ts` call site.

**Immutability pattern** (line 292-303) — use existing `setState` + immer draft pattern for all history writes, never mutate array directly:
```typescript
stores.dialogue.setState((draft) => {
  draft.dialogueHistory = [
    ...state.dialogueHistory,
    { role: 'user', content: response.label },
    { role: 'assistant', content: npcDialogue.dialogue },
  ];
});
```

---

### `src/ui/hooks/use-npc-dialogue.ts` (hook, streaming)

**Change type:** (1) Migrate `NpcDialogueContext.conversationHistory` type; (2) add internal `messagesRef` for guard creation flow accumulation; (3) append to `messagesRef` after stream completion.

**Current conversationHistory type in NpcDialogueContext** (lines 10-18):
```typescript
export type NpcDialogueContext = {
  readonly npcProfile: NpcProfile;
  readonly scene: string;
  readonly playerAction: string;
  readonly memories: readonly string[];
  readonly archiveSummary?: string;
  readonly relevantCodex?: readonly string[];
  readonly conversationHistory?: readonly { readonly speaker: string; readonly text: string }[];
};
```

**Target — migrate field type:**
```typescript
readonly conversationHistory?: readonly { readonly role: 'user' | 'assistant'; readonly content: string }[];
```

**Existing useRef pattern** (lines 34-36) — copy for messagesRef:
```typescript
const contextRef = useRef<NpcDialogueContext | null>(null);
const streaming = useStreamingText();
const completionFiredRef = useRef(false);
// NEW — same pattern:
const messagesRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
```

**Existing reset pattern** (lines 56-60) — reset clears streaming only, NOT messagesRef (per RESEARCH Pitfall 5):
```typescript
const originalReset = streaming.reset;
const reset = useCallback(() => {
  originalReset();
  setMetadata(null);
  // Do NOT clear messagesRef here
}, [originalReset]);
```

**Append pattern after stream completion** (lines 68-108 completion useEffect) — add after `setMetadata` call:
```typescript
// After stream completes, append this round's exchange to messagesRef
// Uses spread to maintain immutability (per project rules)
messagesRef.current = [
  ...messagesRef.current,
  { role: 'user' as const, content: ctx.playerAction },
  { role: 'assistant' as const, content: fullText },
];
```

**startDialogue reset on new session** (line 38-54) — add messagesRef reset at top of `startDialogue` when signaling new session. Per RESEARCH open question resolution: screen calls `reset()` before round 1 which clears streaming only; `messagesRef` is NOT cleared in `reset()`. Instead, clear `messagesRef` only when `context.conversationHistory` is explicitly empty/undefined AND this is signaled as a fresh session (or add explicit `resetMessages()` to return type):
```typescript
const startDialogue = useCallback((context: NpcDialogueContext) => {
  contextRef.current = context;
  setMetadata(null);
  // Thread accumulated messages into the stream call:
  streaming.start(streamNpcDialogue(npcProfile, scene, playerAction, memories, {
    archiveSummary: context.archiveSummary,
    relevantCodex: context.relevantCodex,
    conversationHistory: messagesRef.current.length > 0 ? messagesRef.current : context.conversationHistory,
  }));
}, [streaming.start]);
```

**Return type** — expose `resetMessages` to allow screen to clear accumulated history between unrelated conversations:
```typescript
export type UseNpcDialogueReturn = {
  // ... existing fields ...
  readonly resetMessages: () => void;  // NEW
};
```

**Fallback generateNpcDialogue call** (lines 83-97) — also thread history (per RESEARCH Pitfall 4):
```typescript
generateNpcDialogue(
  ctx.npcProfile,
  ctx.scene,
  ctx.playerAction,
  ctx.memories,
  {
    archiveSummary: ctx.archiveSummary,
    relevantCodex: ctx.relevantCodex,
    conversationHistory: messagesRef.current.length > 0 ? messagesRef.current : ctx.conversationHistory,
  },
)
```

---

### `src/ui/screens/narrative-creation-screen.tsx` (screen, event-driven)

**Change type:** Call `npcDialogue.resetMessages()` before round 1; `startDialogue` calls carry existing `messagesRef` context automatically (hook-owned accumulation).

**Current startDialogue call** (lines 109-114):
```typescript
npcDialogue.startDialogue({
  npcProfile: guardProfile,
  scene: sceneContext,
  playerAction,
  memories: [],
});
```

**After Phase 18** — no change needed to the call site IF the hook owns accumulation. The hook reads its own `messagesRef` internally on each `startDialogue`.

**reset() usage** (lines 190, 220, 257) — `npcDialogue.reset()` is called before each phase transition. This must NOT wipe `messagesRef` (hook's reset clears streaming state only).

**resetMessages() call site** — call before round 1 (in the load useEffect at line 86 when `setPhase({ type: 'round_streaming', round: 1 })`) or expose `resetMessages` and call it before the guard flow begins:
```typescript
// In the load effect after setting guardProfile and dialogueConfig:
npcDialogue.resetMessages();  // fresh session for this guard conversation
setPhase({ type: 'round_streaming', round: 1 });
```

---

### `src/ui/panels/dialogue-panel.tsx` (component, request-response)

**Change type:** Migrate local `DialogueEntry` type and rendering logic from `entry.speaker`/`entry.text` to `entry.role`/`entry.content`.

**Current local type** (lines 14-17):
```typescript
type DialogueEntry = {
  readonly speaker: string;
  readonly text: string;
};
```

**Target:**
```typescript
type DialogueEntry = {
  readonly role: string;
  readonly content: string;
};
```

**Current render** (lines 104-107):
```typescript
{recentHistory.map((entry, i) => (
  <Text key={i} dimColor={entry.speaker !== 'npc'}>
    {entry.speaker === 'npc' ? `"${entry.text}"` : `你："${entry.text}"`}
  </Text>
))}
```

**Target render:**
```typescript
{recentHistory.map((entry, i) => (
  <Text key={i} dimColor={entry.role !== 'assistant'}>
    {entry.role === 'assistant' ? `"${entry.content}"` : `你："${entry.content}"`}
  </Text>
))}
```

---

### `src/ui/screens/game-screen.tsx` (screen consumer, request-response)

**Change type:** Migrate field references at lines 317-318.

**Current** (lines 316-318):
```typescript
...dialogueState.dialogueHistory
  .filter((e) => e.speaker === 'npc')
  .map((e) => `${dialogueState.npcName}："${e.text}"`),
```

**Target:**
```typescript
...dialogueState.dialogueHistory
  .filter((e) => e.role === 'assistant')
  .map((e) => `${dialogueState.npcName}："${e.content}"`),
```

---

## Shared Patterns

### Immutable Array Updates
**Source:** `src/state/create-store.ts` + immer `produce` pattern throughout `dialogue-manager.ts`
**Apply to:** All `dialogueHistory` writes in `dialogue-manager.ts` and `messagesRef` accumulation in `use-npc-dialogue.ts`
```typescript
// Store writes: always inside setState (immer draft) with spread
stores.dialogue.setState((draft) => {
  draft.dialogueHistory = [...state.dialogueHistory, newEntry];
});
// Ref accumulation: spread, never push()
messagesRef.current = [...messagesRef.current, newEntry];
```

### useRef for Cross-Render State
**Source:** `src/ui/hooks/use-npc-dialogue.ts` lines 34-36
**Apply to:** `messagesRef` in `use-npc-dialogue.ts`
```typescript
// Pattern: useRef for values that must persist across renders without triggering re-renders
const contextRef = useRef<NpcDialogueContext | null>(null);
const completionFiredRef = useRef(false);
// Copy for: messagesRef
```

### Mock Pattern for AI Tests
**Source:** `src/ai/utils/ai-caller.test.ts` lines 1-15 and `src/ai/roles/npc-actor.test.ts` lines 1-25
**Apply to:** New test cases in both test files and new `use-npc-dialogue.test.ts`
```typescript
// Top-level mock declarations before imports
const mockGenerateObject = mock(() => Promise.resolve({ object: {}, usage: mockUsage }));
mock.module('ai', () => ({ generateObject: mockGenerateObject, ... }));
// Dynamic import AFTER mocks are declared
const { callGenerateObject } = await import('./ai-caller');
```

### Zod Schema + TypeScript Infer Pattern
**Source:** `src/state/dialogue-store.ts` lines 7-31
**Apply to:** `DialogueEntrySchema` migration
```typescript
const DialogueEntrySchema = z.object({ ... });
// Type auto-derived from schema:
export const DialogueStateSchema = z.object({
  dialogueHistory: z.array(DialogueEntrySchema),
  // ...
});
export type DialogueState = z.infer<typeof DialogueStateSchema>;
```

---

## No Analog Found

All files in Phase 18 are modifications to existing files with clear self-analogs. No new files require external pattern reference.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/ui/hooks/use-npc-dialogue.test.ts` | test | — | New test file; copy mock pattern from `ai-caller.test.ts` (lines 1-15) + React hook test pattern if needed |

---

## Critical Pitfall Notes for Planner

1. **`prompt` + `messages` mutual exclusion** — `multi_turn` mode options object must have ONLY `messages` key. The `...msgOpts.options` spread in all three call sites ensures this IF the mode's options object is correctly shaped.

2. **Migration atomicity** — `DialogueEntrySchema` in `dialogue-store.ts` must be migrated in the same plan/wave as all consumers (`dialogue-panel.tsx`, `game-screen.tsx`, `dialogue-manager.ts`, `npc-actor.ts`, `use-npc-dialogue.ts`). TypeScript will fail to compile if the schema changes but consumers don't.

3. **`reset()` vs `resetMessages()`** — `reset()` in `use-npc-dialogue.ts` clears streaming state only. Messages accumulation requires a separate `resetMessages()` to be exposed and called from `narrative-creation-screen.tsx` before the guard flow begins.

4. **Fallback generateNpcDialogue call** — The completion handler in `use-npc-dialogue.ts` (lines 83-97) calls `generateNpcDialogue` again. This second call must also receive the accumulated `messagesRef.current` as `conversationHistory`, otherwise metadata extraction is single-turn.

---

## Metadata

**Analog search scope:** `src/ai/`, `src/engine/`, `src/state/`, `src/ui/`
**Files scanned:** 11
**Pattern extraction date:** 2026-04-30
