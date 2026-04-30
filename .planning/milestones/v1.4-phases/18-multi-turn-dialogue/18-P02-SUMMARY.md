---
phase: 18-multi-turn-dialogue
plan: "02"
subsystem: dialogue-state
tags: [dialogue-history, schema-migration, tdd, role-content, atomic]
dependency_graph:
  requires: [18-01]
  provides: [DialogueEntrySchema-role-content, historySection-deleted]
  affects: [dialogue-store.ts, dialogue-manager.ts, dialogue-panel.tsx, game-screen.tsx, npc-system.ts, npc-actor.ts, use-npc-dialogue.ts]
tech_stack:
  added: []
  patterns: [atomic-schema-migration, tdd-red-green]
key_files:
  created: []
  modified:
    - src/state/dialogue-store.ts
    - src/engine/dialogue-manager.ts
    - src/ui/panels/dialogue-panel.tsx
    - src/ui/screens/game-screen.tsx
    - src/ai/prompts/npc-system.ts
    - src/ai/roles/npc-actor.ts
    - src/ui/hooks/use-npc-dialogue.ts
    - src/state/new-stores.test.ts
    - src/engine/dialogue-manager.test.ts
decisions:
  - "historySection deleted entirely — history only flows through messages[] channel (D-04, D-05)"
  - "NpcDialogueContext.conversationHistory migrated to {role,content}[] in use-npc-dialogue.ts (D-11, D-12)"
  - "npc-actor.ts conversationHistory removed from buildNpcUserPrompt call sites (Rule 1 auto-fix)"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-30"
  tasks_completed: 2
  files_modified: 9
---

# Phase 18 Plan 02: dialogueHistory {role,content} Migration Summary

**One-liner:** Atomic migration of `DialogueState.dialogueHistory` from `{speaker,text}` to `{role:'user'|'assistant', content}` format across all 4 consumers, with deletion of `historySection` text serialization from `npc-system.ts`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | [RED] Add failing DIAL-02 tests for {role,content} format | 8401a33 | src/engine/dialogue-manager.test.ts |
| 2 | [GREEN] Atomic migration of all consumers + historySection deletion | b042026 | 8 files |

## What Was Built

### Schema Migration (dialogue-store.ts)

`DialogueEntrySchema` field names changed:
- `speaker: z.enum(['npc','player','narration'])` → `role: z.enum(['user','assistant'])`
- `text: z.string()` → `content: z.string()`

`DialogueState` type is auto-derived from schema via `z.infer`, so all consumers receive updated types automatically.

### Write Site Migration (dialogue-manager.ts)

Three `dialogueHistory` write sites migrated:
- `startDialogue`: `{speaker:'npc', text:...}` → `{role:'assistant', content:...}`
- `processPlayerResponse`: player+NPC pair → `{role:'user', content:response.label}` + `{role:'assistant', content:npcDialogue.dialogue}`
- `processPlayerFreeText`: same pattern as above

`buildNpcLlmContext` parameter and return type annotations updated to `{role:'user'|'assistant', content:string}[]`.

### UI Consumer Migration

- **dialogue-panel.tsx**: local `DialogueEntry` type + render logic (`entry.speaker !== 'npc'` → `entry.role !== 'assistant'`, `entry.text` → `entry.content`)
- **game-screen.tsx**: filter/map chain (`e.speaker === 'npc'` → `e.role === 'assistant'`, `e.text` → `e.content`)

### historySection Deletion (npc-system.ts)

- Deleted `historySection` const (lines 96-101) — text serialization of conversation history
- Removed `conversationHistory` field from `NpcUserPromptContext` type
- Removed `${historySection}` from return template literal
- History now flows exclusively through `messages[]` channel via `NpcActorOptions.conversationHistory` → `ai-caller.ts` `history` param

## TDD Gate Compliance

- RED commit: `8401a33` — 2 failing tests (history[0].role === undefined, not 'assistant')
- GREEN commit: `b042026` — all 1093 tests pass

## Test Results

```
bun test src/engine/dialogue-manager.test.ts src/ai/prompts/npc-system.test.ts
52 pass, 0 fail

bun test (full suite)
1093 pass, 0 fail
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed stale conversationHistory from buildNpcUserPrompt call sites in npc-actor.ts**
- **Found during:** Task 2 TypeScript check
- **Issue:** `npc-actor.ts` was passing `conversationHistory: options?.conversationHistory` to `buildNpcUserPrompt`, but `NpcUserPromptContext.conversationHistory` was deleted as part of this plan. TypeScript reported type errors.
- **Fix:** Removed `conversationHistory` from both `buildNpcUserPrompt` call sites in `generateNpcDialogue` and `streamNpcDialogue`. History still flows correctly via `history: options?.conversationHistory` to `callGenerateObject`/`callStreamText`.
- **Files modified:** `src/ai/roles/npc-actor.ts`
- **Commit:** b042026

**2. [Rule 1 - Bug] Migrated use-npc-dialogue.ts NpcDialogueContext.conversationHistory type**
- **Found during:** Task 2 TypeScript check
- **Issue:** `NpcDialogueContext.conversationHistory` was still typed as `{speaker:string, text:string}[]`, causing TypeScript errors against the updated `NpcActorOptions.conversationHistory: {role,content}[]`.
- **Fix:** Migrated field type to `readonly { readonly role: 'user' | 'assistant'; readonly content: string }[]`
- **Files modified:** `src/ui/hooks/use-npc-dialogue.ts`
- **Commit:** b042026

**3. [Rule 1 - Bug] Migrated new-stores.test.ts dialogue history assertions**
- **Found during:** Task 2 TypeScript check
- **Issue:** `src/state/new-stores.test.ts` had `{speaker:'npc', text:'...'}` push and `.speaker` assertion that TypeScript rejected after schema change.
- **Fix:** Updated to `{role:'assistant', content:'...'}` and `.role` assertion.
- **Files modified:** `src/state/new-stores.test.ts`
- **Commit:** b042026

## Known Stubs

None — all migrations are complete; `dialogueHistory` writes use real `{role,content}` values sourced from NPC dialogue output and player input.

## Threat Flags

None — schema rename only affects internal game state representation. No new network endpoints or trust boundaries introduced.

## Self-Check

Checking modified files exist:
- FOUND: src/state/dialogue-store.ts
- FOUND: src/engine/dialogue-manager.ts
- FOUND: src/ui/panels/dialogue-panel.tsx
- FOUND: src/ui/screens/game-screen.tsx
- FOUND: src/ai/prompts/npc-system.ts
- FOUND: src/ai/roles/npc-actor.ts
- FOUND: src/ui/hooks/use-npc-dialogue.ts
- FOUND: src/state/new-stores.test.ts
- FOUND: src/engine/dialogue-manager.test.ts

Checking commits exist:
- FOUND commit: 8401a33
- FOUND commit: b042026

## Self-Check: PASSED
