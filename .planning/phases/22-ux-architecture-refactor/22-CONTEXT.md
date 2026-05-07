# Phase 22: UX Architecture Refactor - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor GameScreen (558 lines) into a thin orchestrator (~80 lines) with 3 Context Providers (Atmosphere, Narrative, Input), replace ScenePanel with NarrativeRenderer (in-place), implement 7-state input state machine, and add injectable Clock abstraction. All 1115+ tests must remain green throughout.

</domain>

<decisions>
## Implementation Decisions

### Provider Boundary

- **D-01:** Streaming state (useAiNarration + useNpcDialogue) lives in **NarrativeProvider** as the single source of truth. InputProvider subscribes via a derived hook (e.g., `useIsStreaming()`) to know when to disable/modify input behavior.
- **D-02:** **AtmosphereProvider** is "wide" — it owns: scene atmosphere tags, time_of_day, weather, quest ecological context (activeQuests, activeQuestIds, activeQuestTags), toast events, and spinner/dimout effects. Exposes: `useAtmosphere()`, `useToast()`, `useActiveQuests()`.
- **D-03:** **NarrativeProvider** owns: streaming text/state for both narration and NPC dialogue, scene text content, narration errors. Exposes: `useNarrationStream()`, `useDialogueStream()`, `useNarrativeText()`.
- **D-04:** **InputProvider** owns: input mode, input value, selected action index, input state machine (7 states), controller action dispatch. Subscribes to NarrativeProvider's streaming state for skip/disable behavior.

### NarrativeRenderer

- **D-05:** ScenePanel (scene-panel.tsx) is **rewritten in-place** and renamed to NarrativeRenderer. No parallel file — git history preserved.
- **D-06:** Dialogue mode switching is **state-driven internal** to NarrativeRenderer. Same component instance, no re-mount. Mode state determines what content renders.
- **D-07:** Dialogue mode renders an **embedded DialogueView sub-component** inside NarrativeRenderer with its own layout (NPC name/glyph, player responses, message history scroll). Not shared text area with style variants.

### Input State Machine

- **D-08:** 7 states (EXPLORATION, DIALOGUE, COMBAT, MENU, CODEX, MAP, BRANCH) each have an **independent useInput** hook with `{ isActive: currentState === X }`. Only the active state's handler processes keys.
- **D-09:** State transitions are **EventBus-driven**. Systems emit events (combat_started, dialogue_started, panel_opened, etc.), InputProvider listens and switches state. Emitters don't need to know about input state.
- **D-10:** **Dual-layer keyboard**: a global layer (always active) handles cross-state keys (Esc, Ctrl-C, ? help). State-level handlers handle everything else. Global layer has priority; state handlers only fire if global doesn't consume the key.

### Refactoring Order

- **D-11:** Execution order: Clock abstraction → 3 Providers → NarrativeRenderer → Input state machine. Each step produces a committable, runnable intermediate state.
- **D-12:** Plan granularity: **5 plans** — (1) Clock, (2) AtmosphereProvider, (3) NarrativeProvider, (4) NarrativeRenderer in-place rewrite, (5) InputProvider + state machine.
- **D-13:** Test strategy: **full test suite runs after each plan**. Zero regressions tolerated at any intermediate state.

### Claude's Discretion

- **Controller placement:** Claude will place `createGameScreenController` inside InputProvider (it's fundamentally action dispatch) and adapt its dependencies to come from Provider hooks rather than direct store subscriptions.
- **Quest calculation:** Quest entries/active/ecological context computation moves into AtmosphereProvider as part of its "world perception" role.
- **Provider nesting order:** Claude determines optimal Provider nesting in the component tree (likely Atmosphere → Narrative → Input, outermost to innermost).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Design

- `.planning/ROADMAP.md` §Phase 22 — Success criteria (GameScreen <100 lines, providers testable in isolation, etc.)
- `.planning/REQUIREMENTS.md` §UX Architecture — UXA-01..05 requirement definitions
- `CLAUDE.md` §Architecture — Layer model, dual-input system, state management patterns

### Current Implementation (refactoring targets)

- `src/ui/screens/game-screen.tsx` — Primary refactoring target (558 lines → ~80)
- `src/ui/panels/scene-panel.tsx` — Will be rewritten in-place as NarrativeRenderer (143 lines)
- `src/engine/game-screen-controller.ts` — Controller logic (277 lines), moves into InputProvider
- `src/ui/hooks/use-game-input.ts` — Current input handling, basis for state machine
- `src/ui/hooks/use-ai-narration.ts` — Streaming hook, moves into NarrativeProvider
- `src/ui/hooks/use-npc-dialogue.ts` — NPC streaming, moves into NarrativeProvider
- `src/ui/hooks/use-game-event-toasts.ts` — Toast hook, moves into AtmosphereProvider
- `src/ui/hooks/use-timed-effect.ts` — Dimout/spinner, moves into AtmosphereProvider

### Known Issues (from codebase audit)

- `.planning/codebase/CONCERNS.md` — Combat double-fire, dialogue state leak, victory screen key handling — relevant to state machine design

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/events/event-bus.ts` (mitt-based): Already used throughout; InputProvider state transitions will subscribe to existing events (combat_started, combat_ended, dialogue_started, etc.)
- `src/state/create-store.ts`: Claude Code pattern store — Providers will use this for internal state
- `GameStoreCtx`, `PlayerStoreCtx`, `SceneStoreCtx`, etc. in `src/app.tsx`: Existing store context pattern to follow for new Providers
- `src/ui/hooks/use-game-input.ts`: Contains inputMode/setInputMode/selectedActionIndex — direct foundation for InputProvider

### Established Patterns

- Store context pattern: `createStoreContext<T>()` → `.Context` + `.useStoreState(selector)` — new Providers should follow this
- Event bus event naming: `snake_case` (combat_started, dialogue_ended, state_restored)
- Hook naming: `use[Domain][Action]` (useAiNarration, useNpcDialogue, useGameInput)
- Panel routing: `PanelRouter` switches based on `gameState.phase` — state machine must align with existing phase values

### Integration Points

- `src/app.tsx`: Provider wrapping happens here (above GameScreen)
- `src/engine/game-screen-controller.ts`: Currently receives stores + hooks as params; will become internal to InputProvider
- `src/ui/panels/panel-router.tsx`: Reads game phase to route panels — must remain compatible with state machine states
- `src/ui/panels/dialogue-panel.tsx`: Current standalone dialogue; will be absorbed into NarrativeRenderer's DialogueView

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following the established patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 22-UX Architecture Refactor*
*Context gathered: 2026-05-08*
