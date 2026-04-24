---
phase: 07-streaming-output
plan: 02
subsystem: ai
tags: [streaming, ai-sdk, npc-dialogue, async-generator, streamText]

requires:
  - phase: 02-core-gameplay
    provides: generateNpcDialogue, npc-actor role, providers.ts getRoleConfig
provides:
  - streamNpcDialogue async generator for NPC dialogue streaming
  - NPC dialogue streaming event types (npc_dialogue_streaming_started/completed)
affects: [07-04-use-npc-dialogue-hook, ui-streaming-integration]

tech-stack:
  added: []
  patterns: [async-generator-streaming-npc, anthropic-provider-branching-npc]

key-files:
  created: []
  modified:
    - src/ai/roles/npc-actor.ts
    - src/events/event-types.ts

key-decisions:
  - "streamNpcDialogue yields .dialogue string from getFallbackDialogue on exhausted retries (not the full NpcDialogue object)"
  - "No NPC streaming event bus emissions inside streamNpcDialogue itself -- event emission deferred to consumer hook (Plan 04)"

patterns-established:
  - "NPC streaming mirrors narrative-director streamNarration pattern exactly: retry loop, Anthropic branching, textStream consumption, recordUsage"

requirements-completed: [STREAM-02]

duration: 2min
completed: 2026-04-24
---

# Phase 7 Plan 02: NPC Dialogue Streaming Generator Summary

**streamNpcDialogue async generator added to npc-actor.ts mirroring streamNarration pattern with Anthropic cacheControl branching and fallback dialogue on retry exhaustion**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-24T15:29:27Z
- **Completed:** 2026-04-24T15:31:34Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `npc_dialogue_streaming_started` and `npc_dialogue_streaming_completed` event types to DomainEvents
- Added `streamNpcDialogue` async generator export to npc-actor.ts with full Anthropic provider branching
- Preserved existing `generateNpcDialogue` unchanged as D-06 fallback path

## Task Commits

Each task was committed atomically:

1. **Task 1: Add NPC streaming events to event-types.ts** - `1916ac8` (feat)
2. **Task 2: Add streamNpcDialogue async generator to npc-actor.ts** - `5382430` (feat)

## Files Created/Modified
- `src/events/event-types.ts` - Added npc_dialogue_streaming_started and npc_dialogue_streaming_completed event types
- `src/ai/roles/npc-actor.ts` - Added streamText import and streamNpcDialogue async generator function

## Decisions Made
- streamNpcDialogue yields `getFallbackDialogue(npcProfile.name).dialogue` (the string) on final failure, not the full NpcDialogue object, since the generator yields strings
- NPC streaming event bus emissions (started/completed) are not placed inside the generator itself -- these will be emitted by the consumer hook (Plan 04), matching the separation of concerns where the AI layer produces chunks and the UI layer tracks lifecycle

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- streamNpcDialogue is ready for consumption by use-npc-dialogue.ts hook (Plan 04)
- NPC streaming event types are available for the hook to emit lifecycle events
- generateNpcDialogue preserved as fallback for non-streaming paths

## Self-Check: PASSED

All files found, all commits verified.

---
*Phase: 07-streaming-output*
*Completed: 2026-04-24*
