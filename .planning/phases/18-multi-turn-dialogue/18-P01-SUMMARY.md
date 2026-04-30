---
phase: 18-multi-turn-dialogue
plan: "01"
subsystem: ai-transport
tags: [multi-turn, ai-caller, npc-actor, tdd]
dependency_graph:
  requires: []
  provides: [multi_turn-message-mode, BaseCallOptions.history, NpcActorOptions.conversationHistory-v2]
  affects: [npc-actor.ts, dialogue-manager.ts, use-npc-dialogue.ts]
tech_stack:
  added: []
  patterns: [discriminated-union-extension, optional-parameter-forwarding]
key_files:
  created: []
  modified:
    - src/ai/utils/ai-caller.ts
    - src/ai/utils/ai-caller.test.ts
    - src/ai/roles/npc-actor.ts
    - src/ai/roles/npc-actor.test.ts
decisions:
  - "multi_turn mode uses SystemModelMessage (role:'system') as first messages[] element — not top-level system param — so all providers handle it uniformly"
  - "Anthropic provider gets providerOptions.anthropic.cacheControl on the SystemModelMessage in multi_turn mode"
  - "history=[] falls back to standard/anthropic_cache behavior (no multi_turn)"
  - "NpcActorOptions.conversationHistory type migrated to {role,content}[] but dialogue-manager.ts consumers deferred to Plan 02"
metrics:
  duration_minutes: 2
  completed_date: "2026-04-30"
  tasks_completed: 3
  files_modified: 4
---

# Phase 18 Plan 01: multi_turn Message Mode + NpcActor History Forwarding Summary

**One-liner:** Added `multi_turn` MessageMode branch to `ai-caller.ts` with SystemModelMessage + history array forwarding, and migrated `NpcActorOptions.conversationHistory` to `{role,content}[]` type with pass-through to LLM call sites.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | [RED] buildAiCallMessages multi_turn tests + history forwarding tests | a4bc3e4 | src/ai/utils/ai-caller.test.ts |
| 2 | [GREEN] Implement multi_turn branch + BaseCallOptions.history | 4800df2 | src/ai/utils/ai-caller.ts |
| 3 | [RED+GREEN] npc-actor.ts type migration + history forwarding | 57589eb | src/ai/roles/npc-actor.ts, src/ai/roles/npc-actor.test.ts |

## What Was Built

### ai-caller.ts

- `MessageMode` union extended with third variant: `{ mode: 'multi_turn'; options: { messages: Array<Record<string, unknown>> } }`
- `buildAiCallMessages` accepts optional fourth param `history?: ReadonlyArray<{role,content}>`
- When `history` is non-empty: constructs `multi_turn` mode with `[SystemModelMessage, ...history, currentUserTurn]`
- Anthropic provider: `SystemModelMessage` carries `providerOptions.anthropic.cacheControl.type:'ephemeral'`
- Non-Anthropic providers: `SystemModelMessage` is plain `{role:'system', content}`
- Empty `history` (or omitted): falls through to existing `standard` / `anthropic_cache` behavior unchanged
- `BaseCallOptions` gains optional `history` field; all three call functions (`callGenerateText`, `callGenerateObject`, `callStreamText`) forward `opts.history` to `buildAiCallMessages`

### npc-actor.ts

- `NpcActorOptions.conversationHistory` type migrated from `{speaker:string, text:string}[]` to `{role:'user'|'assistant', content:string}[]`
- `generateNpcDialogue` passes `history: options?.conversationHistory` to `callGenerateObject`
- `streamNpcDialogue` passes `history: options?.conversationHistory` to `callStreamText`

## TDD Gate Compliance

- RED commit: `a4bc3e4` — 8 failing multi_turn tests + 2 history forwarding tests
- GREEN commit: `4800df2` — all 20 ai-caller tests pass
- Task 3 RED+GREEN: new npc-actor test fails before implementation, passes after

## Test Results

```
bun test src/ai/utils/ai-caller.test.ts src/ai/roles/npc-actor.test.ts
27 pass, 0 fail
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no placeholder values introduced.

## Threat Flags

None — no new network endpoints or trust boundaries introduced. `multi_turn` messages are constructed from internal game state only.

## Downstream Impact (for Plan 02 awareness)

`dialogue-manager.ts` still passes `conversationHistory: {speaker,text}[]` (old format) into `NpcActorOptions`. TypeScript will flag this as a type error. Plan 02 migrates `DialogueState.dialogueHistory` and all consumers — that migration will resolve this mismatch atomically.

`use-npc-dialogue.ts` and `npc-system.ts` also retain old `{speaker,text}` type references — these are Plan 02/03 scope.

## Self-Check

Checking created/modified files exist:

- FOUND: src/ai/utils/ai-caller.ts
- FOUND: src/ai/utils/ai-caller.test.ts
- FOUND: src/ai/roles/npc-actor.ts
- FOUND: src/ai/roles/npc-actor.test.ts
- FOUND commit: a4bc3e4
- FOUND commit: 4800df2
- FOUND commit: 57589eb

## Self-Check: PASSED
