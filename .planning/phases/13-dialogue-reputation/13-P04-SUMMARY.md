---
phase: 13-dialogue-reputation
plan: P04
subsystem: ai/dialogue
tags: [sentiment, streaming, react-hooks, double-fire]
dependency_graph:
  requires: [13-P03]
  provides: [DIAL-03, DIAL-06, DIAL-07]
  affects: [src/ai/utils/metadata-extractor.ts, src/ui/hooks/use-npc-dialogue.ts, src/ui/screens/game-screen.tsx]
tech_stack:
  added: []
  patterns: [useEffect-for-side-effects, fired-guard-ref]
key_files:
  modified:
    - src/ai/utils/metadata-extractor.ts
    - src/ai/utils/metadata-extractor.test.ts
    - src/ui/hooks/use-npc-dialogue.ts
    - src/ui/screens/game-screen.tsx
    - src/ui/screens/game-screen.test.ts
decisions:
  - "D-10: sentiment removed from extractNpcMetadata; fallback to generateNpcDialogue structured output when undefined"
  - "sentiment: 'neutral' supplied as default when spreading ExtractedNpcMetadata into NpcDialogue setMetadata calls"
  - "completionFiredRef guards useEffect in use-npc-dialogue; hasFiredRef guards handleNpcDialogueComplete in game-screen"
metrics:
  duration: 236s
  completed: "2026-04-28"
  tasks_completed: 2
  files_changed: 5
---

# Phase 13 Plan P04: Remove Hardcoded Sentiment; Streaming Completion in useEffect; Double-Fire Guards Summary

**One-liner:** Remove `sentiment: 'neutral'` hardcode from extractNpcMetadata and move streaming completion side-effect from render body into guarded useEffect with double-fire prevention refs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove hardcoded sentiment from extractNpcMetadata | 4d2c0b9 | metadata-extractor.ts, metadata-extractor.test.ts, use-npc-dialogue.ts |
| 2 | Move streaming completion to useEffect + add double-fire guard | 2fbc27f | use-npc-dialogue.ts, game-screen.tsx, game-screen.test.ts |

## What Was Done

**Task 1 (DIAL-03):**
- `ExtractedNpcMetadata.sentiment` changed from `NpcDialogue['sentiment']` (required) to `sentiment?: NpcDialogue['sentiment']` (optional)
- `extractNpcMetadata` no longer returns `sentiment: 'neutral'` — field is omitted entirely
- `isAllDefaults` check in `use-npc-dialogue.ts` updated from `extracted.sentiment === 'neutral'` to `!extracted.sentiment`, so `undefined` correctly triggers the structured `generateNpcDialogue` fallback
- `setMetadata` calls supply `sentiment: 'neutral'` as a base default before spreading `extracted`, satisfying the `NpcDialogue` type requirement
- Tests updated: 2 existing tests asserting `sentiment === 'neutral'` updated to `toBeUndefined()`, 1 new test added for neutral content

**Task 2 (DIAL-06, DIAL-07):**
- `use-npc-dialogue.ts`: removed render-body `prevIsStreaming` pattern entirely; added `completionFiredRef = useRef(false)`; streaming completion logic moved into `useEffect` with deps `[streaming.isStreaming, streaming.error, streaming.streamingText]`; separate `useEffect` resets `completionFiredRef` when `streaming.isStreaming` becomes true
- `game-screen.tsx`: added `hasFiredRef = useRef(false)`; `handleNpcDialogueComplete` effect now guards with `!hasFiredRef.current` before firing; separate `useEffect` resets `hasFiredRef` when `isNpcStreaming` becomes true
- New source-inspection tests added for DIAL-06 and DIAL-07

## Deviations from Plan

**1. [Rule 1 - Bug] TypeScript error: ExtractedNpcMetadata spread into NpcDialogue setMetadata**
- **Found during:** Task 1 tsc check
- **Issue:** After making `sentiment` optional in `ExtractedNpcMetadata`, spreading `{ ...extracted }` into `setMetadata()` failed type check because `NpcDialogue.sentiment` is required
- **Fix:** Added `sentiment: 'neutral'` as a spread-before-extracted default in both `setMetadata` call sites; if `extracted.sentiment` is defined it overrides the default
- **Files modified:** src/ui/hooks/use-npc-dialogue.ts
- **Commit:** 4d2c0b9

**2. [Rule 2 - Completeness] useEffect dep array uses streaming.streamingText not streaming.text**
- **Found during:** Task 2 implementation
- **Issue:** Plan template showed `streaming.text` in dep array but the actual `useStreamingText` hook exposes `streamingText` (not `text`); also used as the non-empty guard instead of `fullTextRef.current` (which is a ref, not reactive)
- **Fix:** Used `streaming.streamingText` as the reactive guard in the completion `useEffect` dep array; `fullTextRef.current` still used for the actual full text value passed to `extractNpcMetadata`
- **Files modified:** src/ui/hooks/use-npc-dialogue.ts
- **Commit:** 2fbc27f

## Known Stubs

None.

## Threat Flags

None. Changes are internal React hook correctness fixes with no new network surface.

## Self-Check: PASSED

- src/ai/utils/metadata-extractor.ts: exists, sentiment field removed
- src/ui/hooks/use-npc-dialogue.ts: exists, prevIsStreaming removed, completionFiredRef present, useEffect pattern in place
- src/ui/screens/game-screen.tsx: exists, hasFiredRef present at line 113
- Commit 4d2c0b9: verified in git log
- Commit 2fbc27f: verified in git log
- bun tsc --noEmit: zero errors
- All targeted tests pass (45/45)
