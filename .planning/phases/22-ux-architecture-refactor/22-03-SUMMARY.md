---
phase: 22-ux-architecture-refactor
plan: 03
subsystem: ui-architecture
tags: [narrative-provider, context-provider, streaming, react-ink, uxa-01, uxa-03]
requires:
  - phase: 22-02
    provides: [AtmosphereProvider, useAtmosphere, useToast, useActiveQuests]
provides:
  - NarrativeProvider single streaming source of truth
  - useNarrationStream/useDialogueStream selector hooks
  - useNarrativeText aggregated scene and stream state
  - useIsStreaming derived selector for future InputProvider work
affects:
  - src/ui/providers/narrative-provider.tsx
  - src/ui/providers/narrative-provider.test.ts
  - src/app.tsx
  - src/ui/screens/game-screen.tsx
  - src/ui/screens/game-screen.test.ts
tech-stack:
  added: []
  patterns: [React Context provider selector hooks, provider-owned streaming hooks, source-structure TDD tests]
key-files:
  created:
    - src/ui/providers/narrative-provider.tsx
    - src/ui/providers/narrative-provider.test.ts
  modified:
    - src/app.tsx
    - src/ui/screens/game-screen.tsx
    - src/ui/screens/game-screen.test.ts
key-decisions:
  - NarrativeProvider owns exactly one useAiNarration instance and one useNpcDialogue instance for the GameScreen subtree.
  - GameScreen now consumes provider selectors while preserving controller completion/error behavior.
  - NarrativeProvider is nested under AtmosphereProvider in App so later InputProvider can subscribe to useIsStreaming inside the same gameplay subtree.
requirements-completed: [UXA-01, UXA-03]
duration: 4m03s
completed: 2026-05-07T17:43:40Z
---

# Phase 22 Plan 03: NarrativeProvider Single Streaming Source of Truth Summary

**NarrativeProvider now centralizes AI narration and NPC dialogue streaming so GameScreen consumes stable selector hooks instead of owning stream hook instances directly.**

## Performance

- **Duration:** 4m03s
- **Started:** 2026-05-07T17:39:37Z
- **Completed:** 2026-05-07T17:43:40Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `NarrativeProvider` with provider-owned `useAiNarration()` and `useNpcDialogue()` instances.
- Exposed `useNarrationStream()`, `useDialogueStream()`, `useNarrativeText()`, and `useIsStreaming()` per D-01/D-03.
- Wired `AppInner` provider nesting as `AtmosphereProvider → NarrativeProvider → GameScreen`.
- Updated `GameScreen` to consume narrative provider selectors and stop directly calling `useAiNarration()` / `useNpcDialogue()`.
- Preserved existing controller behavior: `startNarration`, `resetNarration`, and `resetNpcDialogue` still flow into `createGameScreenController`; narration completion/error handling remains delegated to the controller.
- Updated `game-screen.test.ts` source-structure expectations to assert NarrativeProvider hook consumption.

## Task Commits

Each task was committed atomically with TDD RED/GREEN commits:

1. **Task 1: Create NarrativeProvider and isolated tests**
   - `1174ae7` test: add failing NarrativeProvider tests
   - `7a70d65` feat: implement NarrativeProvider
2. **Task 2: Wire NarrativeProvider into app and GameScreen**
   - `43c49db` test: add failing NarrativeProvider wiring tests
   - `1c945be` feat: wire NarrativeProvider into GameScreen

## Files Created/Modified

- `src/ui/providers/narrative-provider.tsx` — New provider, context guard, stream selector hooks, aggregated narrative text, and derived streaming state.
- `src/ui/providers/narrative-provider.test.ts` — Isolated source-structure tests for provider exports, owned hook instances, derived streaming state, context guard, app nesting, and GameScreen hook consumption.
- `src/app.tsx` — Imports `NarrativeProvider` and wraps the gameplay subtree under `AtmosphereProvider`.
- `src/ui/screens/game-screen.tsx` — Replaces direct narration/dialogue hook ownership with `useNarrationStream()`, `useDialogueStream()`, `useNarrativeText()`, and `useIsStreaming()`.
- `src/ui/screens/game-screen.test.ts` — Updates existing assertion from raw `useAiNarration` usage to `useNarrationStream` usage.

## Verification Evidence

Final plan verification completed successfully:

```bash
bun test src/ui/providers/narrative-provider.test.ts src/ui/screens/game-screen.test.ts src/ui/hooks/use-streaming-text.test.ts
bun run typecheck
bun test
```

Observed results:

- Focused provider/GameScreen/streaming tests: 50 pass, 0 fail, 111 assertions.
- Typecheck: `tsc --noEmit` exit 0.
- Full suite: 1318 pass, 0 fail, 9482 assertions.

## Decisions Made

- Kept `NarrativeProvider` UI-agnostic: it exposes stream/text state but does not render panels.
- Kept existing streaming event emissions and completion side effects inside `useAiNarration()` / `useNpcDialogue()` instead of duplicating stream state in the provider.
- Reused `SceneStoreCtx.useStoreState()` inside `NarrativeProvider` for current scene narration lines, making `useNarrativeText()` the single read surface for renderer work in Plan 04.

## Deviations from Plan

None - plan executed as written.

## TDD Gate Compliance

- RED for Task 1: `bun test src/ui/providers/narrative-provider.test.ts` failed because `narrative-provider.tsx` did not exist.
- GREEN for Task 1: provider tests for exports, owned hook instances, derived streaming state, narrative text, and context guard passed after adding `NarrativeProvider`.
- RED for Task 2: wiring tests failed because `App` did not yet wrap `GameScreen` with `NarrativeProvider` and `GameScreen` still consumed raw streaming hooks.
- GREEN for Task 2: focused tests, typecheck, and the full suite passed after app wiring and GameScreen provider hook consumption.

## Known Stubs

None. The only `null`/empty values in touched production files are explicit absence states (`NarrativeContext` initial context, stream errors, optional props, and existing combat outcome checks), not UI-rendered placeholders or unwired mock data.

## Threat Flags

None. This plan introduced no network endpoints, auth paths, file access trust boundaries, or schema changes. The planned AI stream → provider trust boundary preserves the existing rule that AI prose only updates narration/dialogue stream text while deterministic controller/rules code owns game-state changes.

## Issues Encountered

- Initial Task 1 source-structure tests looked for hook member names inside the provider wrapper body even though the TypeScript return types already guarantee passthrough shape. The tests were adjusted during Task 2 RED/GREEN to assert `UseAiNarrationReturn` / `UseNpcDialogueReturn` passthrough instead of duplicating implementation details.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04 can replace `ScenePanel` with `NarrativeRenderer` and consume `useNarrativeText()` as its single narrative read surface.
- Plan 05 can subscribe to `useIsStreaming()` from InputProvider instead of inspecting narration/dialogue hooks directly.

## Notes

- The working tree contained pre-existing `.planning` modifications/deletions outside Plan 22-03 scope. They were not touched or staged.
- Per execution rules for this orchestrated run, `STATE.md` and `ROADMAP.md` were not updated.

## Self-Check: PASSED

- FOUND: `src/ui/providers/narrative-provider.tsx`
- FOUND: `src/ui/providers/narrative-provider.test.ts`
- FOUND: `.planning/phases/22-ux-architecture-refactor/22-03-SUMMARY.md`
- FOUND commit: `1174ae7`
- FOUND commit: `7a70d65`
- FOUND commit: `43c49db`
- FOUND commit: `1c945be`
