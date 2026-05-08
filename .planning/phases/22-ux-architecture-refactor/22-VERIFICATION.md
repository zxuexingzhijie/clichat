---
phase: 22-ux-architecture-refactor
verified: 2026-05-08T03:24:42Z
status: gaps_found
score: 3/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Input state machine handles all 7 states (EXPLORATION, DIALOGUE, COMBAT, MENU, CODEX, MAP, BRANCH) with correct keyboard context per state"
    status: failed
    reason: "The 7 state names and EventBus transitions exist, but MAP/CODEX/BRANCH data dependencies are dropped in the new provider/GameScreen wiring, so those states cannot render their intended panels. InputProvider accepts map/codex/branch props but never uses or exposes them; GameScreen renders PanelRouter without passing mapData, codexEntries, branchTree, branches, readSaveData, or saveDir. PanelRouter therefore falls through to NarrativeRenderer for map/branch_tree/codex when required optional props are undefined. MAP/CODEX/BRANCH state handlers are also no-op placeholders while panel-local handlers still own behavior when mounted."
    artifacts:
      - path: "src/ui/providers/input-provider.tsx"
        issue: "Declares mapData/codexEntries/branchTree/currentBranchId/branches/readSaveData/saveDir props but does not destructure, store, expose, or pass them onward; MAP/CODEX/BRANCH handlers are empty."
      - path: "src/ui/screens/game-screen.tsx"
        issue: "PanelRouter call omits mapData, codexEntries, branchTree, currentBranchId, branches, readSaveData, and saveDir, disconnecting overlay data after App moved those props to InputProvider."
      - path: "src/ui/panels/panel-router.tsx"
        issue: "Map/codex/branch panels only render when optional props are provided; otherwise map and branch_tree are null and codex is null, causing fallback to exploration NarrativeRenderer."
    missing:
      - "Move panel/overlay data into a provider selector consumed by GameScreen, or pass it from InputProvider via selector hooks into PanelRouter."
      - "Implement MAP/CODEX/BRANCH keyboard ownership in InputProvider or explicitly gate panel-local useInput handlers by provider currentState."
  - truth: "All timing-dependent tests use injectable Clock; no flaky setTimeout-based assertions remain"
    status: failed
    reason: "The new Clock/ManualClock seam works for touched timing utilities, but timing-dependent test files still contain real setTimeout sleeps outside the converted set."
    artifacts:
      - path: "src/ui/hooks/use-streaming-text.test.ts"
        issue: "Contains `await new Promise(r => setTimeout(r, 10))`."
      - path: "src/ui/hooks/use-typewriter.test.ts"
        issue: "Contains real setTimeout waits of 50ms/80ms in typewriter timing assertions."
      - path: "src/ui/hooks/use-event-flash.test.ts"
        issue: "Contains a real setTimeout wait of 80ms."
    missing:
      - "Inject Clock or a deterministic scheduler into remaining timing hooks/tests, or narrow/update the roadmap criterion with an accepted override if these legacy waits are intentionally deferred."
---

# Phase 22: UX Architecture Refactor Verification Report

**Phase Goal:** GameScreen becomes a thin orchestrator; all state access flows through Context Providers with selector hooks; input handling covers all 7 game states cleanly.
**Verified:** 2026-05-08T03:24:42Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GameScreen component is under 100 lines; all domain logic delegated to Context Providers | ✓ VERIFIED | `src/ui/screens/game-screen.tsx` is 70 physical lines. It no longer contains `useInput(`, `useGameInput`, `useAiNarration`, `useNpcDialogue`, `useGameEventToasts`, or `createGameScreenController`; focused tests assert this and passed. |
| 2 | AtmosphereProvider, NarrativeProvider, and InputProvider each testable in isolation without rendering GameScreen | ✓ VERIFIED | Provider test files exist and focused Phase 22 tests passed: `atmosphere-provider.test.ts`, `narrative-provider.test.ts`, `input-provider.test.ts`; tests cover provider exports, derivation helpers, EventBus state, and source structure without requiring GameScreen rendering for core provider contracts. |
| 3 | NarrativeRenderer replaces ScenePanel entirely; switching to dialogue mode happens internally without parent re-mount | ✓ VERIFIED | `src/ui/panels/scene-panel.tsx` exports `NarrativeRenderer`, no `narrative-renderer.tsx` exists, and `PanelRouter` imports `NarrativeRenderer` from `./scene-panel` for exploration/dialogue/combat. It no longer imports or mounts `DialoguePanel`. |
| 4 | Input state machine handles all 7 states with correct keyboard context per state | ✗ FAILED | `InputStateName` and seven `useInput(..., { isActive: currentState === ... })` hooks exist, but MAP/CODEX/BRANCH panel data is disconnected: `InputProvider` receives those props but never uses/exposes them, and `GameScreen` calls `PanelRouter` without passing them. Overlay state can switch while the intended panel cannot render. |
| 5 | All timing-dependent tests use injectable Clock; no flaky setTimeout-based assertions remain | ✗ FAILED | Clock/ManualClock and converted tests pass, but grep still finds real setTimeout sleeps in `use-streaming-text.test.ts`, `use-typewriter.test.ts`, and `use-event-flash.test.ts`. |

**Score:** 3/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/time/clock.ts` | Clock interface and systemClock | ✓ VERIFIED | Exports `TimeoutId`, `Clock`, `systemClock`; timing tests pass. |
| `src/time/manual-clock.ts` | ManualClock deterministic test implementation | ✓ VERIFIED | Implements `advanceBy`, `advanceTo`, `pendingCount`; tests verify chronological firing and clearing. |
| `src/ui/providers/atmosphere-provider.tsx` | Wide world-perception provider | ✓ VERIFIED | Owns quest derivation, toast events, scene/spinner dimout with injected Clock; exposes `useAtmosphere`, `useToast`, `useActiveQuests`. |
| `src/ui/providers/narrative-provider.tsx` | Single streaming source provider | ✓ VERIFIED | Owns one `useAiNarration()` and one `useNpcDialogue()` instance; exposes `useNarrationStream`, `useDialogueStream`, `useNarrativeText`, `useIsStreaming`. |
| `src/ui/providers/input-provider.tsx` | Input state machine, controller ownership, selector hooks | ✗ PARTIAL | Owns controller and seven state names/handlers, but map/codex/branch data props are unused and MAP/CODEX/MAP/BRANCH overlay handlers are empty. |
| `src/ui/screens/game-screen.tsx` | Thin under-100-line layout orchestrator | ✗ PARTIAL | Thinness achieved, but PanelRouter call omits map/codex/branch dependencies after those dependencies moved to InputProvider. |
| `src/ui/panels/scene-panel.tsx` | In-place NarrativeRenderer with embedded DialogueView | ✓ VERIFIED | Substantive renderer with exploration/dialogue/combat branches, embedded `DialogueView`, history, free-text, spinner/toast support. |
| `src/ui/panels/panel-router.tsx` | Routes narrative modes and overlay panels | ⚠️ HOLLOW for overlay data | Routes NarrativeRenderer correctly, but overlay panel props are not supplied by GameScreen after refactor. |
| `src/app.tsx` | Provider nesting above GameScreen | ✓ VERIFIED | Gameplay tree is `AtmosphereProvider → NarrativeProvider → InputProvider → GameScreen`. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `src/app.tsx` | `AtmosphereProvider` | `<AtmosphereProvider questTemplates={questTemplates} eventBus={ctx.eventBus}>` | ✓ WIRED | Present under store providers and above GameScreen. |
| `src/app.tsx` | `NarrativeProvider` | `<NarrativeProvider>` under AtmosphereProvider | ✓ WIRED | Present above InputProvider/GameScreen. |
| `src/app.tsx` | `InputProvider` | `<InputProvider ...>` under NarrativeProvider | ✓ WIRED | Runtime dependencies passed to InputProvider. |
| `InputProvider` | `NarrativeProvider` | `useIsStreaming`, `useNarrationStream`, `useDialogueStream`, `useNarrativeText` | ✓ WIRED | Streaming state controls global skip and controller narration callbacks. |
| `InputProvider` | `AtmosphereProvider` | `useActiveQuests`, `useAtmosphereProcessing` | ✓ WIRED | Active quest IDs/tags flow into controller; processing state drives spinner dimout. |
| `PanelRouter` | `NarrativeRenderer` | `import { NarrativeRenderer } from './scene-panel'` | ✓ WIRED | Exploration, dialogue, and combat all route through NarrativeRenderer. |
| `GameScreen` | `PanelRouter` overlay data | `mapData/codexEntries/branchTree/branches/readSaveData/saveDir` props | ✗ NOT_WIRED | Props are defined by PanelRouter and passed to InputProvider by App, but never reach PanelRouter. |
| Timing utilities | `Clock` | Optional Clock defaults to systemClock | ✓ PARTIAL | `use-timed-effect`, `use-toast`, and `sentence-buffer` converted; remaining timing tests still use real sleeps. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `GameScreen` / `PanelRouter` | `activeQuests`, `completedQuests`, `failedQuests`, `toast`, dimout flags | AtmosphereProvider hooks from QuestStore/EventBus/Clock | Yes | ✓ FLOWING |
| `GameScreen` / `PanelRouter` | `sceneLines`, `streamingText`, `isStreaming` | NarrativeProvider from SceneStore + streaming hooks | Yes | ✓ FLOWING |
| `InputProvider` / controller | `activeQuestIds`, `activeQuestTags`, stream callbacks | AtmosphereProvider + NarrativeProvider selectors | Yes | ✓ FLOWING |
| `PanelRouter` map/codex/branch props | `mapData`, `codexEntries`, `branchTree`, `branches`, `readSaveData`, `saveDir` | App computes them and passes to InputProvider, but InputProvider does not expose them and GameScreen does not pass them to PanelRouter | No | ✗ DISCONNECTED |
| Remaining timing tests | timer advancement | Real `setTimeout` sleeps in several test files | No deterministic Clock | ✗ STATIC/TIME-SLEEP |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Focused Phase 22 provider/renderer/GameScreen tests pass | `/Users/makoto/.bun/bin/bun test src/ui/providers/input-provider.test.ts src/ui/providers/atmosphere-provider.test.ts src/ui/providers/narrative-provider.test.ts src/ui/panels/scene-panel.test.ts src/ui/screens/game-screen.test.ts` | 75 pass, 0 fail, 246 assertions | ✓ PASS |
| TypeScript typecheck passes | `/Users/makoto/.bun/bin/bun run typecheck` | `tsc --noEmit` exit 0 | ✓ PASS |
| Focused deterministic timing tests pass | `/Users/makoto/.bun/bin/bun test src/time/clock.test.ts src/ui/hooks/use-timed-effect.test.ts src/ui/hooks/use-toast.test.ts src/ai/utils/sentence-buffer.test.ts` | 33 pass, 0 fail, 50 assertions | ✓ PASS |
| Search for remaining real sleeps in timing tests | `grep_content setTimeout/await new Promise/sleep/advanceBy under src/ui/hooks/*.test.ts and sentence-buffer.test.ts` | Real setTimeout sleeps found in `use-streaming-text.test.ts`, `use-typewriter.test.ts`, `use-event-flash.test.ts` | ✗ FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| UXA-01 | 22-02, 22-03, 22-05 | 3 Context Providers wrap GameScreen with selector hooks | ✓ SATISFIED | App nesting is `AtmosphereProvider → NarrativeProvider → InputProvider → GameScreen`; hooks exist and focused tests pass. |
| UXA-02 | 22-04 | NarrativeRenderer replaces ScenePanel entirely; DialogueRenderer internal mode | ✓ SATISFIED | `scene-panel.tsx` exports `NarrativeRenderer`; PanelRouter no longer imports `DialoguePanel`; dialogue mode is internal `DialogueView`. |
| UXA-03 | 22-02, 22-03, 22-04, 22-05 | GameScreen reduced from ~559 to ~80 lines via Provider delegation and extraction | ✓ SATISFIED for line count/delegation, ⚠️ regression noted | GameScreen is 70 lines and forbidden ownership imports are absent; however overlay data was dropped during delegation. |
| UXA-04 | 22-05 | 7-state input state machine with DIALOGUE state, visual cues, keyboard context switching | ✗ BLOCKED | Seven state names/handlers exist, but MAP/CODEX/BRANCH are not cleanly working because panel data is disconnected and state handlers are no-op. |
| UXA-05 | 22-01 | Injectable Clock abstraction for deterministic timing tests | ✗ BLOCKED | Clock exists and touched tests are deterministic, but broad roadmap criterion is unmet because real sleeps remain in timing-dependent hook tests. |

No orphaned Phase 22 requirement IDs found in `REQUIREMENTS.md`: UXA-01 through UXA-05 are all claimed by Phase 22 plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| `src/ui/providers/input-provider.tsx` | 34-44 | Declared props for `mapData`, `codexEntries`, `branchTree`, `branches`, `readSaveData`, `saveDir` are unused | 🛑 Blocker | App moved overlay data into InputProvider, but no provider selector exposes it; PanelRouter loses map/codex/branch data. |
| `src/ui/providers/input-provider.tsx` | 261-275 | Empty MENU/CODEX/MAP/BRANCH state handlers | ⚠️ Warning | Seven handlers exist structurally, but several states do not own behavior; behavior remains panel-local if panels mount. |
| `src/ui/screens/game-screen.tsx` | 57 | PanelRouter call omits overlay data props | 🛑 Blocker | Map/codex/branch overlays cannot render their real data. |
| `src/ui/hooks/use-streaming-text.test.ts` | 47 | Real `setTimeout` sleep | 🛑 Blocker | Violates roadmap timing criterion. |
| `src/ui/hooks/use-typewriter.test.ts` | 29, 40, 60 | Real `setTimeout` sleeps | 🛑 Blocker | Violates roadmap timing criterion. |
| `src/ui/hooks/use-event-flash.test.ts` | 30 | Real `setTimeout` sleep | 🛑 Blocker | Violates roadmap timing criterion. |

### Human Verification Required

None at this time. Automated source/data-flow checks found blocking gaps before visual or live playthrough verification would be meaningful.

### Gaps Summary

Phase 22 achieved the major structural refactor: GameScreen is thin, the three providers exist and are nested, NarrativeRenderer replaced ScenePanel in place, controller ownership moved into InputProvider, and the focused tests/typecheck pass.

Two roadmap-level gaps remain:

1. **7-state input handling is not actually clean for MAP/CODEX/BRANCH.** The state machine shell exists, but overlay data was dropped when App moved map/codex/branch dependencies into InputProvider. InputProvider does not expose those dependencies, and GameScreen does not pass them to PanelRouter. This breaks the user-visible panels for several required input states.
2. **The injectable Clock criterion is only partially complete.** The new Clock seam works for touched utilities, but real sleep-based timing tests still exist in other timing-dependent hook tests.

---

_Verified: 2026-05-08T03:24:42Z_
_Verifier: Claude (gsd-verifier)_
