---
phase: 18-multi-turn-dialogue
plan: "03"
subsystem: ui-hook
tags: [multi-turn, use-npc-dialogue, messagesRef, tdd, guard-creation]
dependency_graph:
  requires: [18-01, 18-02]
  provides: [messagesRef-accumulation, resetMessages-api, guard-session-boundary]
  affects: [use-npc-dialogue.ts, narrative-creation-screen.tsx]
tech_stack:
  added: []
  patterns: [useRef-cross-render-state, factory-function-testable-hook, spread-immutable-array]
key_files:
  created:
    - src/ui/hooks/use-npc-dialogue.test.ts
  modified:
    - src/ui/hooks/use-npc-dialogue.ts
    - src/ui/screens/narrative-creation-screen.tsx
decisions:
  - "createNpcDialogueState factory exported alongside useNpcDialogue hook for testability without React DOM (mirrors createStreamingText pattern)"
  - "messagesRef accumulation appended via spread [...messagesRef.current, user, assistant] after stream completion — immutable update"
  - "reset() only clears streaming state; resetMessages() is the explicit session-boundary reset"
  - "conversationHistory falls through: messagesRef.current if non-empty, else context.conversationHistory (backward compat)"
metrics:
  duration_minutes: 3
  completed_date: "2026-04-30"
  tasks_completed: 2
  files_modified: 3
---

# Phase 18 Plan 03: useNpcDialogue messagesRef Accumulation Summary

**One-liner:** Added `messagesRef` to `useNpcDialogue` hook to accumulate `{role,content}[]` history across rounds, with `resetMessages()` for explicit session boundaries, enabling guard 4-round dialogue to reference prior answers.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | [RED] use-npc-dialogue.test.ts — messagesRef + resetMessages tests | 810448b | src/ui/hooks/use-npc-dialogue.test.ts |
| 2 | [GREEN] Implement messagesRef accumulation + resetMessages + screen wiring | a6fc1e1 | src/ui/hooks/use-npc-dialogue.ts, src/ui/screens/narrative-creation-screen.tsx |

## What Was Built

### use-npc-dialogue.ts

- Exported `createNpcDialogueState` factory function for pure unit testing (no React DOM needed) — mirrors the `createStreamingText` / `useStreamingText` split pattern
- Added `messagesRef = useRef<HistoryEntry[]>([])` alongside existing `contextRef` in `useNpcDialogue`
- `startDialogue` now passes `messagesRef.current` as `conversationHistory` when non-empty (falls back to `context.conversationHistory` for zero-history case)
- Fallback `generateNpcDialogue` call also receives `messagesRef.current` (per PATTERNS Pitfall 4)
- After stream completion, `messagesRef` is updated via spread: `[...messagesRef.current, {role:'user', content:playerAction}, {role:'assistant', content:fullText}]`
- `reset()` unchanged — only clears streaming state and metadata, does NOT touch `messagesRef`
- Added `resetMessages = useCallback(() => { messagesRef.current = []; }, [])` as separate API
- `UseNpcDialogueReturn` type gains `readonly resetMessages: () => void`

### narrative-creation-screen.tsx

- Added `npcDialogue.resetMessages()` call in `loadRetryKey` useEffect, immediately before `setPhase({ type: 'round_streaming', round: 1 })` — establishes fresh session boundary for each guard conversation

## TDD Gate Compliance

- RED commit: `810448b` — 6 failing tests (createNpcDialogueState not yet exported)
- GREEN commit: `a6fc1e1` — all 6 tests pass; full suite 0 new failures

## Test Results

```
bun test src/ai/utils/ai-caller.test.ts src/engine/dialogue-manager.test.ts src/ui/hooks/use-npc-dialogue.test.ts
60 pass, 0 fail

bun test (full suite, pre-existing failures excluded)
1080 pass, 19 fail (all 19 failures are pre-existing, not from this plan)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Pattern] Exported createNpcDialogueState factory for testability**
- **Found during:** Task 1 design
- **Issue:** `useNpcDialogue` uses React hooks (`useState`, `useEffect`, `useCallback`, `useRef`) internally; bun test has no React DOM and cannot call hooks directly. The plan specified "function-unit approach" but the hook wasn't structured as a factory.
- **Fix:** Extracted `createNpcDialogueState` factory (pure function, no React) alongside the React hook — mirrors the established `createStreamingText` / `useStreamingText` split pattern in the codebase. The factory contains the testable core logic: `startDialogue`, `startDialogueAndWait`, `reset`, `resetMessages`, `getMessages`.
- **Files modified:** `src/ui/hooks/use-npc-dialogue.ts`
- **Commit:** a6fc1e1

## Known Stubs

None — messagesRef accumulation uses real playerAction strings and real NPC response text from stream.

## Threat Flags

None — messagesRef is an internal accumulation buffer built from hook-controlled data (fixed option labels and AI-generated NPC text). No new network endpoints or trust boundaries introduced.

## Self-Check

Checking files exist:
- FOUND: src/ui/hooks/use-npc-dialogue.test.ts
- FOUND: src/ui/hooks/use-npc-dialogue.ts
- FOUND: src/ui/screens/narrative-creation-screen.tsx
- FOUND commit: 810448b
- FOUND commit: a6fc1e1

## Self-Check: PASSED
