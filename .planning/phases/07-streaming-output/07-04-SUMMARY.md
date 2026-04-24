---
phase: "07-streaming-output"
plan: "04"
subsystem: "ui/streaming"
tags: [npc-dialogue, streaming, hooks, typewriter, metadata-extraction]
dependency_graph:
  requires: [07-01, 07-02, 07-03]
  provides: [useNpcDialogue-hook, npc-streaming-in-game-screen]
  affects: [game-screen, scene-panel]
tech_stack:
  added: []
  patterns: [react-hooks, sentence-buffer, metadata-extraction-fallback]
key_files:
  created:
    - src/ui/hooks/use-npc-dialogue.ts
  modified:
    - src/ui/screens/game-screen.tsx
decisions:
  - "NPC streaming text rendered via ScenePanel streamingText prop with open-quote format, not appended to inlineDialogueLines"
  - "Metadata fallback uses generateNpcDialogue when regex returns all defaults on text >50 chars"
  - "isAnyStreaming combines narration and NPC streaming for unified skip and UI disable logic"
metrics:
  duration: "~2 min"
  completed: "2026-04-24"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 07 Plan 04: NPC Dialogue Streaming Summary

useNpcDialogue hook with sentence-boundary typewriter streaming, metadata post-extraction with generateNpcDialogue fallback, wired into game-screen for inline dialogue mode with unified skip support.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create useNpcDialogue hook | eb674a5 | src/ui/hooks/use-npc-dialogue.ts |
| 2 | Wire NPC dialogue streaming into game-screen.tsx | 3992ed3 | src/ui/screens/game-screen.tsx |

## Implementation Details

### Task 1: useNpcDialogue Hook

Created `src/ui/hooks/use-npc-dialogue.ts` mirroring the `useAiNarration` pattern:

- **Streaming**: Consumes `streamNpcDialogue` async generator with sentence-boundary buffering via `createSentenceBuffer`
- **Skip-to-end**: `skipToEnd()` sets skippedRef, flushes buffer, shows full text immediately
- **Metadata extraction**: After stream completes, runs `extractNpcMetadata` on raw text
- **Fallback**: When extracted metadata is all-defaults (neutral emotion, no remember, 0 delta) AND text is substantive (>50 chars), falls back to `generateNpcDialogue` for structured metadata via Zod schema validation
- **Events**: Emits `npc_dialogue_streaming_started` and `npc_dialogue_streaming_completed`
- **Context storage**: Stores `NpcDialogueContext` in ref for fallback call access

### Task 2: Game Screen Integration

Modified `src/ui/screens/game-screen.tsx`:

- Added `useNpcDialogue()` hook instantiation with destructured aliases (npcStreamingText, isNpcStreaming, etc.)
- Computed `isAnyStreaming = isNarrationStreaming || isNpcStreaming` for unified streaming state
- Updated skip handler: Enter/Space during processing dispatches to both `skipNarration()` and `skipNpcDialogue()`
- ScenePanel receives NPC streaming text formatted as `{npcName}："{streamingText}` (open-quote while streaming)
- ActionsPanel disabled during any streaming via `isAnyStreaming`
- Added useEffect that commits completed NPC dialogue to `sceneStore.narrationLines` with closing quote, then resets hook and returns to action_select mode

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `bun test`: 688 pass, 0 fail
- `useNpcDialogue` exported from hook file
- `isAnyStreaming` computed and used in game-screen
- Skip handler fires for both narration and NPC streaming
- ScenePanel receives NPC formatted streaming text
- ActionsPanel uses `isAnyStreaming`

## Self-Check: PASSED
