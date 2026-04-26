---
phase: 07-streaming-output
plan: 03
subsystem: ui
tags: [streaming, narration, sentence-buffer, skip-to-end, scene-panel]

requires:
  - phase: 07-streaming-output
    plan: 01
    provides: createSentenceBuffer utility

provides:
  - useAiNarration hook with sentence buffer integration and skip-to-end
  - ScenePanel streaming text rendering with dim ellipsis indicator
  - ActionsPanel streaming hint text
  - GameScreen streaming narration wiring with skip via Enter/Space

affects: []

tech-stack:
  added: []
  patterns:
    - "Sentence buffer mediates between LLM stream and React state setter"
    - "Skip-to-end via ref flag bypasses buffer while stream continues in background"
    - "useEffect commits streamed text to sceneStore when isStreaming transitions to false"

key-files:
  created: []
  modified:
    - src/ui/hooks/use-ai-narration.ts
    - src/ui/panels/scene-panel.tsx
    - src/ui/panels/actions-panel.tsx
    - src/ui/screens/game-screen.tsx
    - src/ui/screens/game-screen.test.ts

key-decisions:
  - "streamingText replaces narrationText in hook return type for clarity"
  - "fullTextRef accumulates all chunks regardless of skip state for final commit"
  - "useEffect (not finally block) handles post-stream state transition to avoid race conditions"
  - "ActionsPanel isActive includes !isNarrationStreaming guard to prevent action selection during streaming"

patterns-established:
  - "useAiNarration returns streamingText/isStreaming/skipToEnd for consumer wiring"
  - "ScenePanel accepts optional streamingText/isStreaming props for streaming line"

requirements-completed: [STREAM-01, STREAM-03]

duration: 4min
completed: 2026-04-24
---

# Phase 7 Plan 03: Streaming Narration UI Wiring Summary

**Sentence-buffered narration streaming wired into GameScreen/ScenePanel with Enter/Space skip-to-end, replacing batch generateNarration() call -- 688 tests green, 0 regressions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-24T15:38:50Z
- **Completed:** 2026-04-24T15:42:55Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- useAiNarration hook integrates createSentenceBuffer for sentence-boundary batched rendering
- Hook exposes skipToEnd function that instantly displays all received text while stream continues in background
- ScenePanel renders streaming text with dim ellipsis indicator during active streaming
- ActionsPanel shows "Enter/Space 跳过动画" hint during streaming
- GameScreen replaces generateNarration() with useAiNarration hook
- GameScreen useInput handler detects Enter/Space during processing+streaming for skip
- useEffect commits final streamed text to sceneStore.narrationLines on stream completion
- useEffect handles narrationError with Chinese error message pattern
- eventBus emits narration_streaming_started/completed events

## Task Commits

1. **Task 1: Rewire useAiNarration hook with sentence buffer and skip signal**
   - Commit: `a48bf40`
   - Files: src/ui/hooks/use-ai-narration.ts

2. **Task 2: Update ScenePanel, ActionsPanel, and wire game-screen.tsx**
   - Commit: `4c7a196`
   - Files: src/ui/panels/scene-panel.tsx, src/ui/panels/actions-panel.tsx, src/ui/screens/game-screen.tsx, src/ui/screens/game-screen.test.ts

## Files Created/Modified

- `src/ui/hooks/use-ai-narration.ts` -- Rewired with createSentenceBuffer, skipToEnd, fullTextRef, eventBus emissions
- `src/ui/panels/scene-panel.tsx` -- Added streamingText/isStreaming props, renders dim ellipsis during streaming
- `src/ui/panels/actions-panel.tsx` -- Added isStreaming prop, conditional hint text for skip
- `src/ui/screens/game-screen.tsx` -- Replaced generateNarration import with useAiNarration hook, added streaming effects and skip handler
- `src/ui/screens/game-screen.test.ts` -- Updated test to verify useAiNarration wiring instead of generateNarration

## Decisions Made

- streamingText (renamed from narrationText) clarifies that the value represents in-progress streaming content
- fullTextRef accumulates all chunks regardless of skip state, ensuring final text is always complete
- Post-stream state transition uses useEffect watching isNarrationStreaming rather than finally block to avoid React state update races
- ActionsPanel isActive now includes !isNarrationStreaming to prevent action selection during streaming

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated game-screen.test.ts to reflect new API**
- **Found during:** Task 2
- **Issue:** Existing test asserted GameScreen.toString() contains 'generateNarration', but we replaced it with useAiNarration/startNarration
- **Fix:** Updated test to check for 'useAiNarration' and 'startNarration' instead
- **Files modified:** src/ui/screens/game-screen.test.ts
- **Commit:** 4c7a196

---

**Total deviations:** 1 auto-fixed (test assertion updated for new API)
**Impact on plan:** Trivial test update. No scope change.

## Threat Surface Scan

T-07-03-01 accepted: Streamed text is display-only in Ink Text component. No HTML/script injection risk in terminal context.

T-07-03-02 mitigated: Timer leak prevented by buffer.dispose() in reset() and finally block. cancelledRef breaks stream loop on unmount/reset.

No new threat surface introduced beyond what the plan's threat model covers.

## Known Stubs

None -- all streaming wiring is fully functional with no placeholder data or TODO markers.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Streaming narration fully wired: Plan 04 (NPC dialogue streaming) can use the same pattern
- createSentenceBuffer proven in both test and integration contexts
- ScenePanel streaming props pattern established for reuse

## Self-Check: PASSED

- [x] src/ui/hooks/use-ai-narration.ts -- FOUND
- [x] src/ui/panels/scene-panel.tsx -- FOUND
- [x] src/ui/panels/actions-panel.tsx -- FOUND
- [x] src/ui/screens/game-screen.tsx -- FOUND
- [x] src/ui/screens/game-screen.test.ts -- FOUND
- [x] Commit a48bf40 -- FOUND
- [x] Commit 4c7a196 -- FOUND

---
*Phase: 07-streaming-output*
*Completed: 2026-04-24*
