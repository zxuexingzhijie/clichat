# Phase 22: UX Architecture Refactor - Research

**Researched:** 2026-05-08 [VERIFIED: system date]
**Domain:** TypeScript React + Ink terminal UI architecture refactor: Context Providers, selector hooks, event-driven input state, deterministic timing tests [VERIFIED: .planning/ROADMAP.md; .planning/REQUIREMENTS.md; 22-CONTEXT.md]
**Confidence:** HIGH for codebase patterns and phase constraints; MEDIUM for external framework guidance because Context7 MCP was unavailable and official docs/READMEs were used via WebFetch [VERIFIED: codebase read; CITED: react.dev/reference/react/useSyncExternalStore; CITED: github.com/vadimdemedes/ink]


<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Provider Boundary

- **D-01:** Streaming state (useAiNarration + useNpcDialogue) lives in **NarrativeProvider** as the single source of truth. InputProvider subscribes via a derived hook (e.g., `useIsStreaming()`) to know when to disable/modify input behavior.
- **D-02:** **AtmosphereProvider** is "wide" — it owns: scene atmosphere tags, time_of_day, weather, quest ecological context (activeQuests, activeQuestIds, activeQuestTags), toast events, and spinner/dimout effects. Exposes: `useAtmosphere()`, `useToast()`, `useActiveQuests()`.
- **D-03:** **NarrativeProvider** owns: streaming text/state for both narration and NPC dialogue, scene text content, narration errors. Exposes: `useNarrationStream()`, `useDialogueStream()`, `useNarrativeText()`.
- **D-04:** **InputProvider** owns: input mode, input value, selected action index, input state machine (7 states), controller action dispatch. Subscribes to NarrativeProvider's streaming state for skip/disable behavior.

#### NarrativeRenderer

- **D-05:** ScenePanel (scene-panel.tsx) is **rewritten in-place** and renamed to NarrativeRenderer. No parallel file — git history preserved.
- **D-06:** Dialogue mode switching is **state-driven internal** to NarrativeRenderer. Same component instance, no re-mount. Mode state determines what content renders.
- **D-07:** Dialogue mode renders an **embedded DialogueView sub-component** inside NarrativeRenderer with its own layout (NPC name/glyph, player responses, message history scroll). Not shared text area with style variants.

#### Input State Machine

- **D-08:** 7 states (EXPLORATION, DIALOGUE, COMBAT, MENU, CODEX, MAP, BRANCH) each have an **independent useInput** hook with `{ isActive: currentState === X }`. Only the active state's handler processes keys.
- **D-09:** State transitions are **EventBus-driven**. Systems emit events (combat_started, dialogue_started, panel_opened, etc.), InputProvider listens and switches state. Emitters don't need to know about input state.
- **D-10:** **Dual-layer keyboard**: a global layer (always active) handles cross-state keys (Esc, Ctrl-C, ? help). State-level handlers handle everything else. Global layer has priority; state handlers only fire if global doesn't consume the key.

#### Refactoring Order

- **D-11:** Execution order: Clock abstraction → 3 Providers → NarrativeRenderer → Input state machine. Each step produces a committable, runnable intermediate state.
- **D-12:** Plan granularity: **5 plans** — (1) Clock, (2) AtmosphereProvider, (3) NarrativeProvider, (4) NarrativeRenderer in-place rewrite, (5) InputProvider + state machine.
- **D-13:** Test strategy: **full test suite runs after each plan**. Zero regressions tolerated at any intermediate state.

### Claude's Discretion

- **Controller placement:** Claude will place `createGameScreenController` inside InputProvider (it's fundamentally action dispatch) and adapt its dependencies to come from Provider hooks rather than direct store subscriptions.
- **Quest calculation:** Quest entries/active/ecological context computation moves into AtmosphereProvider as part of its "world perception" role.
- **Provider nesting order:** Claude determines optimal Provider nesting in the component tree (likely Atmosphere → Narrative → Input, outermost to innermost).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>


<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UXA-01 | 3 Context Providers (Atmosphere, Narrative, Input) wrap GameScreen with selector hooks | Existing `createStoreContext<T>()` already exposes Provider + selector-based `useStoreState(selector)` via `useSyncExternalStore`; new providers should follow this pattern rather than inventing new subscription mechanics. [VERIFIED: REQUIREMENTS.md; VERIFIED: src/ui/hooks/use-store.ts; CITED: react.dev/reference/react/useSyncExternalStore] |
| UXA-02 | NarrativeRenderer replaces ScenePanel entirely; DialogueRenderer as internal mode within NarrativeRenderer | Current `PanelRouter` conditionally swaps `ScenePanel` and `DialoguePanel`; plan must rewrite `scene-panel.tsx` in place and make dialogue an internal mode to avoid parent remount. [VERIFIED: REQUIREMENTS.md; VERIFIED: src/ui/panels/panel-router.tsx; VERIFIED: 22-CONTEXT.md] |
| UXA-03 | GameScreen reduced from ~559 to ~80 lines via Provider delegation and component extraction | Current `GameScreen` is 559 lines and owns store reads, quest derivation, streaming hooks, timers, controller creation, keyboard handling, and layout; those concerns map directly to Atmosphere/Narrative/Input providers. [VERIFIED: REQUIREMENTS.md; VERIFIED: src/ui/screens/game-screen.tsx] |
| UXA-04 | 7-state input state machine with DIALOGUE state, visual cues, and keyboard context switching | Existing code has scattered `useInput` handlers in `GameScreen`, panels, actions, combat actions, dialogue panel, map/codex/branch panels; plan must centralize state-level activation while preserving panel-specific navigation. [VERIFIED: REQUIREMENTS.md; VERIFIED: grep_content `useInput(` in src/ui; VERIFIED: 22-UI-SPEC.md] |
| UXA-05 | Injectable Clock abstraction for deterministic timing tests (D18) | Current timing hooks/managers use direct `setTimeout` and tests await real time; plan must introduce Clock before providers so `useTimedEffect`, `useToast`, and relevant UI timing tests can be deterministic. [VERIFIED: REQUIREMENTS.md; VERIFIED: src/ui/hooks/use-timed-effect.ts; VERIFIED: src/ui/hooks/use-toast.ts; VERIFIED: grep_content `setTimeout`] |
</phase_requirements>

## Summary

Phase 22 is not a new-feature phase; it is a high-risk UI architecture refactor where the current 559-line `GameScreen` must become a thin layout orchestrator while behavior remains stable. [VERIFIED: src/ui/screens/game-screen.tsx; VERIFIED: .planning/ROADMAP.md] The current implementation concentrates state selection, quest derivation, streaming orchestration, toast/timing effects, input mode, controller wiring, and panel routing props inside `GameScreen`, so the planner should structure work by extracting those responsibilities into the locked providers in the exact order decided in CONTEXT.md. [VERIFIED: src/ui/screens/game-screen.tsx; VERIFIED: 22-CONTEXT.md]

The standard architecture should reuse existing project mechanisms: `createStore` + `createStoreContext` selector hooks, the existing typed mitt event bus, Bun test, React Context/hooks, and Ink `useInput` with `isActive`; no new dependency is needed for this phase. [VERIFIED: src/state/create-store.ts; VERIFIED: src/ui/hooks/use-store.ts; VERIFIED: src/events/event-bus.ts; VERIFIED: package.json; CITED: github.com/vadimdemedes/ink] The most important planning constraint is to make each intermediate plan runnable and testable: first replace direct timers with an injectable Clock, then move atmosphere and narrative state, then rewrite `ScenePanel` in place, and finally move keyboard/controller ownership into InputProvider. [VERIFIED: 22-CONTEXT.md]

**Primary recommendation:** Plan five commits exactly matching D-12: Clock → AtmosphereProvider → NarrativeProvider → in-place `NarrativeRenderer` rewrite → InputProvider/state machine, with `bun test` and targeted provider tests after every step. [VERIFIED: 22-CONTEXT.md; VERIFIED: package.json]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Atmosphere derivation, quest ecological context, toast/spinner/dimout | React terminal UI provider layer | Engine/event bus for source events | Current `GameScreen` derives active quest context and subscribes to UI events; D-02 assigns this to AtmosphereProvider. [VERIFIED: src/ui/screens/game-screen.tsx; VERIFIED: 22-CONTEXT.md] |
| Narration + NPC streaming state | React terminal UI provider layer | AI role streams as data source | Current `useAiNarration` and `useNpcDialogue` are React hooks used directly by `GameScreen`; D-01/D-03 assign them to NarrativeProvider. [VERIFIED: src/ui/hooks/use-ai-narration.ts; VERIFIED: src/ui/hooks/use-npc-dialogue.ts; VERIFIED: 22-CONTEXT.md] |
| Input mode, selected indexes, keyboard dispatch, controller action dispatch | React terminal UI provider layer | Engine controller/actions for domain execution | Current `GameScreen` owns `useGameInput`, multiple `useInput` handlers, and controller creation; D-04 assigns this to InputProvider. [VERIFIED: src/ui/screens/game-screen.tsx; VERIFIED: src/ui/hooks/use-game-input.ts; VERIFIED: 22-CONTEXT.md] |
| Rules, combat outcomes, save/load, relationship/resource mutation | Engine/state layer | UI providers display and dispatch only | CLAUDE.md states AI/UI must not decide success, resources, or relationship changes; Rules Engine owns deterministic decisions. [VERIFIED: CLAUDE.md] |
| Narrative prose and NPC dialogue generation | AI roles layer | NarrativeProvider streams output | CLAUDE.md states AI writes prose and NPC dialogue but must not decide game truth/state changes. [VERIFIED: CLAUDE.md] |

## Standard Stack

### Core

| Library / Tool | Installed Version | Current Registry Version | Purpose | Why Standard for Phase 22 |
|----------------|-------------------|--------------------------|---------|----------------------------|
| Bun runtime/test runner | `>=1.3.12` engine; local `1.3.12` | n/a | Run TypeScript and `bun test` | Project engine requires Bun >=1.3.12 and scripts use `bun test`, `bun run build`, and `tsc --noEmit`. [VERIFIED: package.json; VERIFIED: environment probe; CITED: bun.sh/docs/cli/test] |
| TypeScript | peer `^6.0.3` | `6.0.3`, npm modified 2026-04-16 | Static typing for provider interfaces, selectors, state machine types | Existing package declares TypeScript peer and codebase is TS/TSX. [VERIFIED: package.json; VERIFIED: npm registry] |
| React | installed range `^19.2.5` | `19.2.6`, npm modified 2026-05-06 | Context Providers, hooks, `useSyncExternalStore` selector subscriptions | Existing Ink UI is React-based; selector hooks already use React `useSyncExternalStore`. [VERIFIED: package.json; VERIFIED: src/ui/hooks/use-store.ts; VERIFIED: npm registry; CITED: react.dev/reference/react/useSyncExternalStore] |
| Ink | installed range `^7.0.1` | `7.0.2`, npm modified 2026-05-05 | Terminal rendering and keyboard hooks | Current UI imports `Box`, `Text`, `useInput`, and `useApp` from Ink; official README documents Flexbox-based terminal UI and `useInput`. [VERIFIED: package.json; VERIFIED: src/ui/screens/game-screen.tsx; VERIFIED: npm registry; CITED: github.com/vadimdemedes/ink] |
| fullscreen-ink | installed `^0.1.0` | not re-queried in this session | Fullscreen layout/screen size | Current `GameScreen` and `ScenePanel` use `useScreenSize`; Phase 22 preserves the current fullscreen stack. [VERIFIED: package.json; VERIFIED: src/ui/screens/game-screen.tsx; VERIFIED: src/ui/panels/scene-panel.tsx; VERIFIED: 22-UI-SPEC.md] |
| mitt | installed `^3.0.1` | `3.0.1`, npm modified 2025-10-13 | Typed event bus for state transitions | Current `src/events/event-bus.ts` is a typed mitt emitter; D-09 requires EventBus-driven state transitions. [VERIFIED: src/events/event-bus.ts; VERIFIED: 22-CONTEXT.md; VERIFIED: npm registry; CITED: github.com/developit/mitt] |
| immer | installed `^11.1.4` | `11.1.7`, npm modified 2026-05-06 | Immutable store updates | Current `createStore` wraps state recipes in `produce`; providers should use the existing store pattern instead of direct mutable objects. [VERIFIED: src/state/create-store.ts; VERIFIED: package.json; VERIFIED: npm registry] |
| @inkjs/ui | installed `^2.0.0` | `2.0.0`, npm modified 2024-05-22 | Terminal input widgets | Current DialoguePanel uses `TextInput`; Phase 22 should preserve existing `@inkjs/ui` usage rather than replacing input components. [VERIFIED: src/ui/panels/dialogue-panel.tsx; VERIFIED: package.json; VERIFIED: npm registry] |

### Supporting

| Library / Pattern | Version | Purpose | When to Use |
|-------------------|---------|---------|-------------|
| Existing `createStore<T>` | local | Small immutable external store with `getState`, `setState`, `subscribe` | Use for provider-internal state that must be testable without rendering `GameScreen`. [VERIFIED: src/state/create-store.ts; VERIFIED: 22-CONTEXT.md] |
| Existing `createStoreContext<T>()` | local | Context + selector hook wrapper over `useSyncExternalStore` | Use for provider selector hooks; do not create a second selector system. [VERIFIED: src/ui/hooks/use-store.ts] |
| Existing `eventBus` / `DomainEvents` | local mitt | Transition source for combat/dialogue/state restore and new panel/input events if needed | Use for InputProvider state transitions and keep event names snake_case. [VERIFIED: src/events/event-bus.ts; VERIFIED: src/events/event-types.ts; VERIFIED: 22-CONTEXT.md] |
| Existing `string-width` | `^8.2.0` installed | CJK/Unicode width safety | Use when truncating/alignment changes are introduced in NarrativeRenderer/status text. [VERIFIED: package.json; VERIFIED: DESIGN.md; VERIFIED: 22-UI-SPEC.md] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing `createStoreContext` | Zustand / Redux Toolkit / `use-context-selector` | Not recommended: phase scope says no new external dependency should be assumed, and existing code already has selector hooks. [VERIFIED: user research_scope; VERIFIED: src/ui/hooks/use-store.ts; VERIFIED: package.json] |
| Existing mitt `eventBus` | Node EventEmitter or custom dispatcher | Not recommended: current events and tests already use typed mitt; replacing it would expand scope and risk event regressions. [VERIFIED: src/events/event-bus.ts; VERIFIED: src/events/event-bus.test.ts] |
| Injectable Clock abstraction | Bun fake timers or global monkey-patching only | Not recommended as the architecture: requirement asks injectable Clock, and current tests already use real `setTimeout`, so explicit Clock dependency is the stable seam. [VERIFIED: REQUIREMENTS.md; VERIFIED: src/ui/hooks/use-timed-effect.test.ts] |
| In-place `NarrativeRenderer` | New parallel `narrative-renderer.tsx` beside `scene-panel.tsx` | Forbidden by D-05; rewrite/rename `scene-panel.tsx` in place to preserve history and avoid parallel surfaces. [VERIFIED: 22-CONTEXT.md] |

**Installation:**

```bash
# No new runtime dependency recommended for Phase 22.
# Use existing dependencies from package.json.
```

**Version verification:** `npm view` verified latest registry versions for React, Ink, @inkjs/ui, mitt, immer, and TypeScript on 2026-05-08. [VERIFIED: npm registry]

## Architecture Patterns

### Recommended Project Structure

```text
src/
├── ui/
│   ├── providers/
│   │   ├── atmosphere-provider.tsx     # AtmosphereProvider + useAtmosphere/useToast/useActiveQuests [recommended; based on D-02]
│   │   ├── narrative-provider.tsx      # NarrativeProvider + stream selector hooks [recommended; based on D-01/D-03]
│   │   └── input-provider.tsx          # InputProvider + 7-state state machine [recommended; based on D-04/D-08]
│   ├── panels/
│   │   ├── scene-panel.tsx             # Rewrite in place; export NarrativeRenderer [VERIFIED: 22-CONTEXT.md]
│   │   └── panel-router.tsx            # Keep overlays; route default surface to NarrativeRenderer [VERIFIED: current file]
│   └── hooks/
│       ├── use-store.ts                # Existing selector context primitive [VERIFIED: current file]
│       └── use-clock.ts                # Optional hook wrapper around Clock if needed [recommended; based on UXA-05]
├── time/
│   └── clock.ts                        # Clock interface + system/manual/test clocks [recommended; based on UXA-05]
└── engine/
    └── game-screen-controller.ts       # Keep pure factory; InputProvider owns construction/wiring [VERIFIED: 22-CONTEXT.md]
```

### System Architecture Diagram

```text
Domain stores + engine actions
  ├─ combat/dialogue/game/scene/quest stores emit domain events [VERIFIED: src/state/combat-store.ts; src/state/dialogue-store.ts]
  └─ GameLoop / DialogueManager / CombatLoop execute deterministic state changes [VERIFIED: src/engine/game-screen-controller.ts]
          │
          ▼
Typed EventBus (mitt, snake_case events) [VERIFIED: src/events/event-bus.ts; 22-CONTEXT.md]
          │
          ├─ AtmosphereProvider: quest context, toasts, time/weather/tags, dim/spinner [VERIFIED: 22-CONTEXT.md]
          ├─ NarrativeProvider: narration stream, NPC stream, errors, displayed narrative text [VERIFIED: 22-CONTEXT.md]
          └─ InputProvider: current UX input state, global layer, state-level useInput handlers, controller dispatch [VERIFIED: 22-CONTEXT.md]
                  │
                  ▼
GameScreen (<100 lines): fullscreen shell + TitleBar + NarrativeRenderer/overlays + Status + Actions + Input [VERIFIED: ROADMAP.md]
                  │
                  ▼
NarrativeRenderer: in-place scene-panel rewrite; exploration/dialogue/combat/empty/error modes in one surface [VERIFIED: 22-UI-SPEC.md]
```

### Pattern 1: Selector Context over External Store

**What:** Use the existing `createStoreContext<T>()` for provider contexts so components select only the state they need. [VERIFIED: src/ui/hooks/use-store.ts]

**When to use:** Use for AtmosphereProvider, NarrativeProvider, and InputProvider selector hooks because UXA-01 requires selector hooks and testable isolated providers. [VERIFIED: REQUIREMENTS.md]

**Why:** React official docs state `useSyncExternalStore` subscribes to external stores, compares snapshots with `Object.is`, and requires repeated `getSnapshot` calls to return the same value while unchanged. [CITED: react.dev/reference/react/useSyncExternalStore]

**Planning rule:** Select primitive or stable object references; avoid selectors that allocate new objects every render unless cached, because React documents that uncached snapshots can cause infinite-loop errors. [CITED: react.dev/reference/react/useSyncExternalStore]

### Pattern 2: Provider-Owned Derived State, Not GameScreen-Owned Domain Logic

**What:** Move calculations currently in `GameScreen` into domain providers: active quest lists/ecological context into AtmosphereProvider, streaming and completion/error side effects into NarrativeProvider, input mode and controller dispatch into InputProvider. [VERIFIED: src/ui/screens/game-screen.tsx; VERIFIED: 22-CONTEXT.md]

**When to use:** Use whenever a calculation is not purely layout shell composition. [VERIFIED: ROADMAP.md success criterion GameScreen <100 lines]

**Planner implication:** `GameScreen` should keep only screen size/layout branching, chrome composition, and pending quit confirmation if not moved to InputProvider; it should not directly call `useAiNarration`, `useNpcDialogue`, `useGameInput`, `useGameEventToasts`, or `createGameScreenController`. [VERIFIED: current GameScreen imports/use; VERIFIED: 22-CONTEXT.md]

### Pattern 3: Event-Driven Input State Machine

**What:** InputProvider listens to domain events (`combat_started`, `combat_ended`, `dialogue_started`, `dialogue_ended`, `state_restored`, `game_phase_changed`) and maps them to one of the seven UI input states. [VERIFIED: src/events/event-types.ts; VERIFIED: 22-CONTEXT.md]

**When to use:** Use for cross-system transitions where the emitter should not know the input UX state. [VERIFIED: 22-CONTEXT.md]

**State mapping recommendation:**

| Input State | Primary transition sources | Current code source |
|-------------|----------------------------|---------------------|
| EXPLORATION | `game.phase === 'game'` and no active combat/full dialogue/overlay | [VERIFIED: src/ui/screens/game-screen.tsx] |
| DIALOGUE | `dialogue_started` with `mode: 'full'`; leave on `dialogue_ended` | [VERIFIED: src/events/event-types.ts; src/state/dialogue-store.ts] |
| COMBAT | `combat_started`; leave on `combat_ended` | [VERIFIED: src/events/event-types.ts; src/state/combat-store.ts] |
| MENU | overlay phases such as `journal`, `inventory`, `shortcuts`, `replay`, `chapter_summary` | [VERIFIED: src/ui/screens/game-screen.tsx OVERLAY_PHASES; src/ui/panels/panel-router.tsx] |
| CODEX | `game.phase === 'codex'` | [VERIFIED: src/ui/panels/panel-router.tsx] |
| MAP | `game.phase === 'map'` | [VERIFIED: src/ui/panels/panel-router.tsx] |
| BRANCH | `game.phase === 'branch_tree'` or `compare` | [VERIFIED: src/ui/panels/panel-router.tsx; VERIFIED: 22-UI-SPEC.md] |

### Pattern 4: Ink `useInput` Activation Isolation

**What:** Keep one global `useInput` layer always mounted and one state-level `useInput` hook per state with `{ isActive: currentState === X }`. [VERIFIED: 22-CONTEXT.md; CITED: github.com/vadimdemedes/ink]

**When to use:** Use in InputProvider and keep panel-level handlers only when they are scoped by provider state and cannot leak across modes. [VERIFIED: grep_content `useInput(`]

**Risk:** Current code has `useInput` in `GameScreen`, `ScenePanel`, `DialoguePanel`, `ActionsPanel`, `CombatActionsPanel`, and multiple overlay panels; without an explicit active-state contract, key handling can double-fire or leak. [VERIFIED: grep_content `useInput(`]

### Pattern 5: Injectable Clock Before Timing Refactors

**What:** Introduce a small `Clock` interface (`now`, `setTimeout`, `clearTimeout`) and pass it into timer-based functions/hooks/managers. [VERIFIED: REQUIREMENTS.md; VERIFIED: direct `setTimeout` in src/ui/hooks]

**When to use:** Use before moving `useTimedEffect`, `useToast`, spinner dimout, and future BPM/delight timings into providers. [VERIFIED: src/ui/hooks/use-timed-effect.ts; VERIFIED: src/ui/hooks/use-toast.ts; VERIFIED: DESIGN.md]

**Planner implication:** Plan 1 should update the pure extracted managers first (`createTimedEffect`, `createToastManager`) and then hook wrappers, because those are easiest to test without rendering `GameScreen`. [VERIFIED: src/ui/hooks/use-timed-effect.ts; VERIFIED: src/ui/hooks/use-toast.ts]

### Anti-Patterns to Avoid

- **Allocating new selector snapshots on every render:** React warns `getSnapshot` results must be cached/stable while unchanged; avoid selector hooks that return fresh object literals from external store state. [CITED: react.dev/reference/react/useSyncExternalStore]
- **Keeping fallback logic in `GameScreen` during extraction:** Leaving duplicated state derivation in `GameScreen` and providers creates split-brain state. [VERIFIED: current GameScreen concentration; VERIFIED: ROADMAP.md]
- **Adding a parallel `NarrativeRenderer` file:** D-05 requires in-place rewrite/rename of `scene-panel.tsx`. [VERIFIED: 22-CONTEXT.md]
- **Global `useInput` doing state-specific work:** D-10 requires global keys first, state-level handlers second; global handler should only consume cross-state keys. [VERIFIED: 22-CONTEXT.md]
- **Using real-time sleeps in timing tests:** UXA-05 and existing flaky-style tests require injectable Clock instead. [VERIFIED: REQUIREMENTS.md; VERIFIED: src/ui/hooks/use-timed-effect.test.ts]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Selector subscriptions | A custom context-selector library or event subscription API | Existing `createStoreContext<T>()` over `useSyncExternalStore` | Codebase already has selector hook infrastructure and React documents this exact external-store hook. [VERIFIED: src/ui/hooks/use-store.ts; CITED: react.dev/reference/react/useSyncExternalStore] |
| Event dispatcher | A new pub/sub or stringly-typed emitter | Existing typed mitt `eventBus` + `DomainEvents` | Domain events and tests already use mitt; D-09 locks EventBus-driven transitions. [VERIFIED: src/events/event-bus.ts; VERIFIED: src/events/event-types.ts; VERIFIED: 22-CONTEXT.md] |
| Terminal input widgets | Custom text input | Existing `@inkjs/ui` `TextInput` where text entry is required | Dialogue free-text already uses `TextInput`; replacing it is not required. [VERIFIED: src/ui/panels/dialogue-panel.tsx] |
| Timing control | Test sleeps, global fake timer monkey patches only | Injectable `Clock` interface with SystemClock and Manual/TestClock | Requirement explicitly asks injectable Clock and current direct timers are localized enough to refactor. [VERIFIED: REQUIREMENTS.md; VERIFIED: grep_content `setTimeout`] |
| Layout engine | Manual terminal cursor positioning | Ink `Box`/`Text`/Flexbox primitives | Official Ink README says Ink uses Yoga/Flexbox and text must be wrapped in `Text`; current UI follows that. [CITED: github.com/vadimdemedes/ink; VERIFIED: src/ui/**/*.tsx] |
| CJK truncation/alignment | `string.length` or byte counts | Existing `string-width` dependency | DESIGN.md and UI-SPEC require CJK width calculations via `string-width`. [VERIFIED: DESIGN.md; VERIFIED: 22-UI-SPEC.md; VERIFIED: package.json] |

**Key insight:** This phase should reduce hand-rolled orchestration in `GameScreen`, not add new infrastructure; the project already has the required primitives, and the risk is ownership boundaries, not missing libraries. [VERIFIED: current codebase files; VERIFIED: 22-CONTEXT.md]

## Runtime State Inventory

> Refactor phase trigger: this phase changes architecture and component/file names but does not migrate persisted game save schema. [VERIFIED: ROADMAP.md; VERIFIED: REQUIREMENTS.md]

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | No persisted save/schema field named `GameScreen`, `ScenePanel`, `NarrativeRenderer`, `InputProvider`, `AtmosphereProvider`, or `NarrativeProvider` was identified in required planning docs or source targets read; current work is code architecture. [VERIFIED: required docs; VERIFIED: canonical target files read] | None for data migration; keep save/load behavior unchanged. [VERIFIED: phase scope] |
| Live service config | None identified; Phase 22 is local terminal UI code and uses no external service configuration for provider/input refactor. [VERIFIED: package.json scripts; VERIFIED: phase scope] | None. |
| OS-registered state | None identified; no launchd/systemd/pm2/task scheduler state is part of this phase. [VERIFIED: package.json; VERIFIED: phase scope] | None. |
| Secrets/env vars | No secret or env var rename is required; existing env usage observed is `__CHRONICLE_DATA_DIR` in app paths, unrelated to UX provider names. [VERIFIED: src/app.tsx] | None; do not rename env vars in this phase. |
| Build artifacts / installed packages | `dist/cli.js` may become stale after source refactor because build output is generated by `bun run build`. [VERIFIED: package.json] | Run `bun run build` only as verification/build step if planner includes it; no data migration. [VERIFIED: package.json] |

## Common Pitfalls

### Pitfall 1: Selector Hooks That Re-render Forever

**What goes wrong:** A selector returns a fresh object on every `getSnapshot`, causing React to see a changed snapshot repeatedly. [CITED: react.dev/reference/react/useSyncExternalStore]

**Why it happens:** `useSyncExternalStore` compares snapshots with `Object.is`; fresh object literals are never identical. [CITED: react.dev/reference/react/useSyncExternalStore]

**How to avoid:** Select primitives/arrays already stored in state, or memoize derived objects inside provider state before exposing them. [CITED: react.dev/reference/react/useSyncExternalStore; VERIFIED: src/ui/hooks/use-store.ts]

**Warning signs:** Provider selector tests hang, React logs snapshot caching warnings, or provider consumers re-render on unrelated state changes. [CITED: react.dev/reference/react/useSyncExternalStore]

### Pitfall 2: Input Double-Fire Between Global, Panel, and State Handlers

**What goes wrong:** A key both closes an overlay and triggers a gameplay action, or Enter/Space both skips streaming and executes a new action. [VERIFIED: current `GameScreen` skip branch; VERIFIED: grep_content `useInput(`]

**Why it happens:** Current input handlers are spread across `GameScreen`, panels, actions, combat actions, and dialogue, so priority is implicit. [VERIFIED: src/ui/screens/game-screen.tsx; VERIFIED: src/ui/panels/dialogue-panel.tsx; VERIFIED: grep_content `useInput(`]

**How to avoid:** Implement the D-10 dual-layer contract: global handler consumes first, then only the active state handler runs. [VERIFIED: 22-CONTEXT.md]

**Warning signs:** Tests need source-string assertions for `!isTyping && !isInCombat && !isInDialogueMode && !isInOverlayPanel`, or bug reports mention victory/dialogue/combat key leakage. [VERIFIED: src/ui/screens/game-screen.test.ts; VERIFIED: .planning/codebase/CONCERNS.md]

### Pitfall 3: Dialogue Remount Regression

**What goes wrong:** Entering dialogue swaps the whole narrative surface and loses scroll/history/local visual state. [VERIFIED: current `PanelRouter` returns `DialoguePanel` instead of `ScenePanel`; VERIFIED: 22-CONTEXT.md]

**Why it happens:** `PanelRouter` currently branches `if (isInDialogueMode) return <DialoguePanel .../>`; D-06 requires internal mode switching in the same component instance. [VERIFIED: src/ui/panels/panel-router.tsx; VERIFIED: 22-CONTEXT.md]

**How to avoid:** Keep `NarrativeRenderer` mounted for exploration/dialogue/combat narration and render `DialogueView` inside it based on provider-selected narrative mode. [VERIFIED: 22-CONTEXT.md; VERIFIED: 22-UI-SPEC.md]

**Warning signs:** `PanelRouter` still imports `DialoguePanel` as a top-level replacement after Phase 22, or tests cannot assert same component surface across dialogue transitions. [VERIFIED: current `PanelRouter` import]

### Pitfall 4: Provider Extraction Without Isolation Tests

**What goes wrong:** Providers pass integration tests only when `GameScreen` renders, violating UXA-01/02 isolation success criteria. [VERIFIED: ROADMAP.md]

**Why it happens:** Existing UI tests often inspect source strings or simulate logic outside React rather than mounting isolated provider surfaces. [VERIFIED: src/ui/screens/game-screen.test.ts; VERIFIED: src/ui/hooks/use-game-input.test.ts]

**How to avoid:** Add provider-specific unit tests per plan before deleting `GameScreen` logic: AtmosphereProvider quest/toast selectors, NarrativeProvider streaming/derived `useIsStreaming`, InputProvider transition table. [VERIFIED: REQUIREMENTS.md; VERIFIED: 22-CONTEXT.md]

**Warning signs:** A provider has no test file, or the only coverage is a `GameScreen.toString()` assertion. [VERIFIED: existing test patterns]

### Pitfall 5: Clock Interface Added Too Late

**What goes wrong:** Provider tests retain `await new Promise(resolve => setTimeout(...))`, making refactor tests slow/flaky. [VERIFIED: src/ui/hooks/use-timed-effect.test.ts; VERIFIED: grep_content `setTimeout`]

**Why it happens:** Existing `useTimedEffect`, `createTimedEffect`, `useToast`, and `createToastManager` directly call global `setTimeout`. [VERIFIED: src/ui/hooks/use-timed-effect.ts; VERIFIED: src/ui/hooks/use-toast.ts]

**How to avoid:** First plan introduces Clock and updates timing utilities before moving them into providers. [VERIFIED: 22-CONTEXT.md D-11]

**Warning signs:** New tests include arbitrary 50–80ms sleeps, or production code still calls global `setTimeout` in Phase 22 UI timing paths. [VERIFIED: existing tests; VERIFIED: grep_content]

### Pitfall 6: Violating AI/Rules Boundary During UI Refactor

**What goes wrong:** InputProvider or NarrativeProvider starts deciding outcomes, resources, combat success, or relationship deltas. [VERIFIED: CLAUDE.md]

**Why it happens:** Moving controller wiring can accidentally pull engine responsibilities into UI providers. [VERIFIED: src/engine/game-screen-controller.ts; VERIFIED: 22-CONTEXT.md]

**How to avoid:** Providers may dispatch actions and display state, but Rules Engine / GameLoop / CombatLoop / DialogueManager remain responsible for game truth changes. [VERIFIED: CLAUDE.md; VERIFIED: current controller dependencies]

**Warning signs:** Provider code mutates player HP/MP/reputation directly or generates AI adjudication from raw NL input. [VERIFIED: CLAUDE.md]

## Code Examples

Verified patterns from current codebase and official sources.

### Existing Store Context Selector Pattern

```typescript
// Source: src/ui/hooks/use-store.ts [VERIFIED: codebase]
export function createStoreContext<T>() {
  const Context = createContextContext<Store<T> | null>(null);

  function Provider({ store, children }: { store: Store<T>; children: React.ReactNode }) {
    return React.createElement(Context.Provider, { value: store }, children);
  }

  function useStoreState<S>(selector: (state: T) => S): S {
    const store = useContext(Context);
    if (!store) {
      throw new ReferenceError('useStoreState must be used within a StoreProvider');
    }
    const get = () => selector(store.getState());
    return useSyncExternalStore(store.subscribe, get, get);
  }

  return { Provider, useStoreState, useSetState, Context };
}
```

### Recommended Provider Shell Pattern

```typescript
// Source: adapts existing createStore/createStoreContext pattern [VERIFIED: src/state/create-store.ts; src/ui/hooks/use-store.ts]
type InputUxState = {
  readonly currentState: 'EXPLORATION' | 'DIALOGUE' | 'COMBAT' | 'MENU' | 'CODEX' | 'MAP' | 'BRANCH';
  readonly inputMode: 'action_select' | 'input_active' | 'processing';
  readonly inputValue: string;
  readonly selectedActionIndex: number;
};

const InputUxCtx = createStoreContext<InputUxState>();

export function useInputState() {
  return InputUxCtx.useStoreState((s) => s.currentState);
}

export function useCommandInput() {
  return InputUxCtx.useStoreState((s) => s.inputValue);
}
```

### Recommended Clock Interface

```typescript
// Source: requirement UXA-05 + current setTimeout usage [VERIFIED: REQUIREMENTS.md; src/ui/hooks/use-timed-effect.ts]
export type Clock = {
  readonly now: () => number;
  readonly setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  readonly clearTimeout: (id: ReturnType<typeof setTimeout>) => void;
};

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
};
```

### Recommended Timed Effect Refactor Seam

```typescript
// Source: refactors current createTimedEffect [VERIFIED: src/ui/hooks/use-timed-effect.ts]
export function createTimedEffect(durationMs: number, clock: Clock = systemClock): TimedEffectInstance {
  let active = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const trigger = (): void => {
    if (timer !== null) clock.clearTimeout(timer);
    active = true;
    timer = clock.setTimeout(() => {
      active = false;
      timer = null;
    }, durationMs);
  };

  const cleanup = (): void => {
    if (timer !== null) clock.clearTimeout(timer);
    timer = null;
    active = false;
  };

  return { isActive: () => active, trigger, cleanup };
}
```

### Recommended Event Transition Subscription

```typescript
// Source: existing mitt eventBus and DomainEvents [VERIFIED: src/events/event-bus.ts; src/events/event-types.ts]
useEffect(() => {
  const onCombatStarted = () => setInputUxState((draft) => { draft.currentState = 'COMBAT'; });
  const onCombatEnded = () => setInputUxState((draft) => { draft.currentState = 'EXPLORATION'; });
  const onDialogueStarted = (p: DomainEvents['dialogue_started']) => {
    if (p.mode === 'full') setInputUxState((draft) => { draft.currentState = 'DIALOGUE'; });
  };
  const onDialogueEnded = () => setInputUxState((draft) => { draft.currentState = 'EXPLORATION'; });

  eventBus.on('combat_started', onCombatStarted);
  eventBus.on('combat_ended', onCombatEnded);
  eventBus.on('dialogue_started', onDialogueStarted);
  eventBus.on('dialogue_ended', onDialogueEnded);
  return () => {
    eventBus.off('combat_started', onCombatStarted);
    eventBus.off('combat_ended', onCombatEnded);
    eventBus.off('dialogue_started', onDialogueStarted);
    eventBus.off('dialogue_ended', onDialogueEnded);
  };
}, [eventBus, setInputUxState]);
```

### Recommended Ink Input Activation Pattern

```typescript
// Source: locked D-08 and Ink useInput isActive option [VERIFIED: 22-CONTEXT.md; CITED: github.com/vadimdemedes/ink]
useInput(globalHandler); // global layer: Ctrl-C/Esc/? only

useInput(explorationHandler, { isActive: currentState === 'EXPLORATION' });
useInput(dialogueHandler, { isActive: currentState === 'DIALOGUE' });
useInput(combatHandler, { isActive: currentState === 'COMBAT' });
useInput(menuHandler, { isActive: currentState === 'MENU' });
useInput(codexHandler, { isActive: currentState === 'CODEX' });
useInput(mapHandler, { isActive: currentState === 'MAP' });
useInput(branchHandler, { isActive: currentState === 'BRANCH' });
```

## Project Constraints (from CLAUDE.md)

- Chronicle is a CLI-first, Chinese-first AI-driven interactive novel game, not a chatbot. [VERIFIED: CLAUDE.md]
- Core loop is Perceive Scene → Express Intent → System Adjudicates → AI Narrates → World State Updates → Next Turn. [VERIFIED: CLAUDE.md]
- AI writes prose and NPC dialogue; AI must not decide success, resource consumption, or relationship changes. [VERIFIED: CLAUDE.md]
- Rules Engine owns deterministic game state decisions. [VERIFIED: CLAUDE.md]
- Dual input must preserve both structured commands and natural-language intent recognition; raw NL must go through intent recognition before narrative/adjudication. [VERIFIED: CLAUDE.md]
- CLI UX principles include scene panel/status/suggested actions/input area, keyboard shortcuts, accessibility, and save/branch prompts. [VERIFIED: CLAUDE.md]
- Security boundary: player input, community content, mod text, and retrieved knowledge chunks are untrusted input. [VERIFIED: CLAUDE.md]
- Prompt-injection defense requires NPC dialogue and narration skills not to modify game state; only Rules Engine can. [VERIFIED: CLAUDE.md]
- Tech stack constraints: TypeScript + Bun, React + Ink, Commander.js, file-based YAML/JSON RAG with no vector DB. [VERIFIED: CLAUDE.md]
- State management standard is the custom store pattern; do not introduce unnecessary state libraries for this phase. [VERIFIED: CLAUDE.md; VERIFIED: src/state/create-store.ts]
- Always read DESIGN.md before visual/UI decisions; Phase 22 must preserve the approved terminal design system. [VERIFIED: CLAUDE.md; VERIFIED: DESIGN.md]
- Do not make direct repo edits outside a GSD workflow unless explicitly asked; this research is a GSD workflow artifact. [VERIFIED: CLAUDE.md]
- Project skills directories `.cursor/` and `.agents/` were not present in this workspace; no project `SKILL.md` guidance was available. [VERIFIED: list_dir]

## State of the Art

| Old / Current Local Approach | Required Phase 22 Approach | When Changed / Source | Impact |
|------------------------------|----------------------------|-----------------------|--------|
| `GameScreen` directly owns state reads, streaming hooks, timing effects, controller creation, and input handlers | `GameScreen` becomes <100-line orchestrator under providers | Phase 22 requirement UXA-03 and D-01..D-04 [VERIFIED: REQUIREMENTS.md; VERIFIED: 22-CONTEXT.md] | Planner must split tasks by ownership extraction, not by visual panel order. |
| `PanelRouter` replaces ScenePanel with DialoguePanel for full dialogue | `NarrativeRenderer` stays mounted and renders DialogueView internally | D-05..D-07 [VERIFIED: 22-CONTEXT.md] | Planner must avoid parent remount and verify mode switch happens inside one narrative surface. |
| Input state inferred from `inputMode`, `gameState.phase`, combat/dialogue flags, and scattered panel handlers | Explicit 7-state input state machine with global-first priority | D-08..D-10 [VERIFIED: 22-CONTEXT.md] | Planner must add transition table tests and key isolation tests. |
| Direct `setTimeout` in timing utilities and real sleeps in tests | Injectable Clock abstraction and deterministic advancement | UXA-05 / D18 [VERIFIED: REQUIREMENTS.md; VERIFIED: STATE.md] | Planner must schedule Clock first so later provider tests do not become flaky. |

**Deprecated/outdated for this phase:**

- `GameScreen.toString()` source-inspection tests as primary verification are not enough for new provider behavior; keep compatibility if needed, but add behavioral provider tests. [VERIFIED: src/ui/screens/game-screen.test.ts; VERIFIED: ROADMAP.md]
- Direct global `setTimeout` in Phase 22 UI timing paths should be replaced or wrapped with Clock injection. [VERIFIED: REQUIREMENTS.md; VERIFIED: src/ui/hooks/use-timed-effect.ts; VERIFIED: src/ui/hooks/use-toast.ts]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|

**This table is empty:** All recommendations were derived from required docs, current codebase files, npm registry probes, or official documentation fetched in this session. [VERIFIED: sources listed below]

## Open Questions (RESOLVED)

1. **RESOLVED: Pending-quit ownership**
   - Decision: InputProvider owns pending-quit key handling, state transitions, and exit dispatch because pending quit is part of the global keyboard layer and controller dispatch. `GameScreen` may render `InlineConfirm` only as layout chrome if doing so still keeps it under 100 lines. [VERIFIED: D-04 input ownership; VERIFIED: D-10 global key contract; VERIFIED: Plan 22-05]

2. **RESOLVED: Overlay panel input ownership**
   - Decision: InputProvider owns top-level state activation and global priority. Existing panel-local `useInput` handlers may remain only when their `isActive` gate is driven by provider state and they cannot leak into other states. Do not centralize every panel navigation handler if that would duplicate panel internals; enforce state isolation instead. [VERIFIED: D-08 independent handlers; VERIFIED: 22-UI-SPEC.md; VERIFIED: current panel patterns]

3. **RESOLVED: Panel transition events**
   - Decision: Prefer deriving overlay input state from `game.phase` and existing store state. Add typed `panel_opened` / `panel_closed` events only if execution discovers a transition cannot be observed from current stores. Emitters must not import input internals either way. [VERIFIED: D-09 EventBus transition rule; VERIFIED: current `DomainEvents`; VERIFIED: Plan 22-05]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Bun | Run tests/build | ✓ | 1.3.12 | Blocking if unavailable; no fallback because project engine requires Bun. [VERIFIED: environment probe; VERIFIED: package.json] |
| Node.js | npm version verification and tooling | ✓ | v24.14.0 | Not runtime target for app. [VERIFIED: environment probe] |
| npm/npx | Registry verification | ✓ | 11.9.0 | Could use Bun package manager for installs, but no new install recommended. [VERIFIED: environment probe] |
| TypeScript compiler | `bun run typecheck` script | not directly probed as binary; dependency declared via package | Use `bun run typecheck` through project script. [VERIFIED: package.json] |

**Missing dependencies with no fallback:**
- None found for research/planning. [VERIFIED: environment probe]

**Missing dependencies with fallback:**
- None found. [VERIFIED: environment probe]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bun test, built into Bun runtime; official docs describe Jest-like API, TypeScript/JSX support, lifecycle hooks, mocks, snapshots, and watch mode. [CITED: bun.sh/docs/cli/test] |
| Config file | `bunfig.toml`; `package.json` script `test: bun test`. [VERIFIED: glob_path; VERIFIED: package.json] |
| Quick run command | `bun test src/ui/hooks/use-timed-effect.test.ts src/ui/hooks/use-toast.test.ts src/ui/hooks/use-game-input.test.ts` [VERIFIED: existing files] |
| Full suite command | `bun test` [VERIFIED: package.json] |
| Typecheck command | `bun run typecheck` [VERIFIED: package.json] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| UXA-01 | Atmosphere/Narrative/Input providers wrap `GameScreen` and expose selector hooks | Unit + integration | `bun test src/ui/providers/atmosphere-provider.test.ts src/ui/providers/narrative-provider.test.ts src/ui/providers/input-provider.test.ts` | ❌ Wave 0 [VERIFIED: glob_path tests] |
| UXA-02 | NarrativeRenderer replaces ScenePanel and internal dialogue mode does not remount parent surface | Unit/component source + behavior | `bun test src/ui/panels/scene-panel.test.ts src/ui/panels/narrative-renderer.test.ts` | ❌ Wave 0 for new renderer tests; existing `scene-panel.tsx` has no listed test in glob output. [VERIFIED: glob_path] |
| UXA-03 | `GameScreen` under 100 lines and no domain hook/controller imports | Static/unit | `bun test src/ui/screens/game-screen.test.ts` | ✅ Existing but must be updated from old source-string expectations. [VERIFIED: src/ui/screens/game-screen.test.ts] |
| UXA-04 | 7-state input state machine and key isolation | Unit | `bun test src/ui/providers/input-provider.test.ts src/ui/hooks/use-game-input.test.ts` | ❌ provider test Wave 0; old hook test exists. [VERIFIED: src/ui/hooks/use-game-input.test.ts] |
| UXA-05 | All Phase 22 timing tests use injectable Clock; no UI timing sleeps remain | Unit | `bun test src/time/clock.test.ts src/ui/hooks/use-timed-effect.test.ts src/ui/hooks/use-toast.test.ts` | ❌ Clock test Wave 0; old timing tests exist and use real sleeps. [VERIFIED: src/ui/hooks/use-timed-effect.test.ts; grep_content `setTimeout`] |

### Sampling Rate

- **Per task commit:** targeted command for touched provider/hook/panel plus `bun run typecheck`. [VERIFIED: package.json]
- **Per wave merge / after each plan:** `bun test` as locked D-13 full-suite requirement. [VERIFIED: 22-CONTEXT.md; VERIFIED: package.json]
- **Phase gate:** `bun test` and `bun run typecheck` green before `/gsd-verify-work`. [VERIFIED: package.json]

### Wave 0 Gaps

- [ ] `src/time/clock.ts` and `src/time/clock.test.ts` — covers UXA-05 deterministic clock seam. [VERIFIED: no current file found in read/glob context]
- [ ] `src/ui/providers/atmosphere-provider.tsx` and `.test.ts` — covers UXA-01/D-02. [VERIFIED: 22-CONTEXT.md]
- [ ] `src/ui/providers/narrative-provider.tsx` and `.test.ts` — covers UXA-01/D-01/D-03. [VERIFIED: 22-CONTEXT.md]
- [ ] `src/ui/providers/input-provider.tsx` and `.test.ts` — covers UXA-01/UXA-04/D-04/D-08..D-10. [VERIFIED: 22-CONTEXT.md]
- [ ] `src/ui/panels/scene-panel.test.ts` or updated renderer test — covers UXA-02 in-place rewrite. [VERIFIED: current scene-panel file]
- [ ] Update `src/ui/screens/game-screen.test.ts` so it validates slim orchestrator behavior instead of old `GameScreen.toString()` expectations. [VERIFIED: existing test]

## Security Domain

Security enforcement is not explicitly disabled in `.planning/config.json`, so security domain is included. [VERIFIED: .planning/config.json]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | No | Single-player CLI refactor does not add auth. [VERIFIED: phase scope; VERIFIED: REQUIREMENTS.md] |
| V3 Session Management | No | Phase 22 does not change account/session management. [VERIFIED: phase scope] |
| V4 Access Control | No | Local game UI refactor; no user roles introduced. [VERIFIED: phase scope] |
| V5 Input Validation | Yes | Preserve command parser/intent-recognition boundary; do not pass raw NL directly to AI adjudication. [VERIFIED: CLAUDE.md] |
| V6 Cryptography | No | Phase 22 does not add crypto. [VERIFIED: phase scope] |
| V8 Data Protection | Indirect | Do not expose system prompts/admin lore/player secrets in terminal output. [VERIFIED: CLAUDE.md] |
| V12 Files/Resources | Indirect | No save/schema migration planned; do not change save paths or env vars in this phase. [VERIFIED: Runtime State Inventory] |

### Known Threat Patterns for React + Ink CLI Refactor

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection through player/community/retrieved text | Tampering / Elevation of Privilege | Providers display/dispatch only; Rules Engine remains only owner of state mutation and AI output cannot modify game truth. [VERIFIED: CLAUDE.md] |
| Raw natural language bypasses intent recognition | Tampering | InputProvider must dispatch to existing GameLoop/command parser path, not directly to narrative generation. [VERIFIED: CLAUDE.md; VERIFIED: src/engine/game-screen-controller.ts] |
| Error copy leaks stack traces to player | Information Disclosure | UI-SPEC requires short Chinese recovery copy and no raw stack traces in terminal UI. [VERIFIED: 22-UI-SPEC.md] |
| Keyboard leakage triggers destructive branch switch | Tampering | BRANCH state requires confirmation `(y/N)` before destructive switch; no immediate destructive single-key action. [VERIFIED: 22-UI-SPEC.md] |

## Sources

### Primary (HIGH confidence)

- `/Users/makoto/.claude/agents/gsd-phase-researcher.md` — role/output/source provenance instructions. [VERIFIED: read_file]
- `CLAUDE.md` — architecture boundaries, stack constraints, security boundaries, GSD workflow, design rules. [VERIFIED: read_file]
- `.planning/STATE.md` — D10, D18, D19, DD1/DD2/DD5 and current Phase 22 position. [VERIFIED: read_file]
- `.planning/ROADMAP.md` — Phase 22 goal, requirements, success criteria. [VERIFIED: read_file]
- `.planning/REQUIREMENTS.md` — UXA-01..UXA-05. [VERIFIED: read_file]
- `.planning/phases/22-ux-architecture-refactor/22-CONTEXT.md` — locked decisions D-01..D-13 and canonical refs. [VERIFIED: read_file]
- `.planning/phases/22-ux-architecture-refactor/22-UI-SPEC.md` — terminal UI contract, NarrativeRenderer contract, 7-state keyboard contract. [VERIFIED: read_file]
- `DESIGN.md` — Chronicle terminal design system and CJK/string-width constraints. [VERIFIED: read_file]
- `package.json` — installed dependencies and scripts. [VERIFIED: read_file]
- Current code files: `src/ui/screens/game-screen.tsx`, `src/ui/panels/scene-panel.tsx`, `src/ui/panels/panel-router.tsx`, `src/ui/panels/dialogue-panel.tsx`, `src/ui/hooks/use-store.ts`, `src/state/create-store.ts`, `src/events/event-bus.ts`, `src/events/event-types.ts`, `src/ui/hooks/use-timed-effect.ts`, `src/ui/hooks/use-toast.ts`, `src/ui/hooks/use-ai-narration.ts`, `src/ui/hooks/use-npc-dialogue.ts`, `src/engine/game-screen-controller.ts`. [VERIFIED: read_file]
- npm registry probes for React, Ink, @inkjs/ui, mitt, immer, TypeScript. [VERIFIED: npm registry]
- React official docs `useSyncExternalStore`. [CITED: react.dev/reference/react/useSyncExternalStore]
- Bun official test docs. [CITED: bun.sh/docs/cli/test]
- Ink official GitHub README. [CITED: github.com/vadimdemedes/ink]
- mitt official GitHub README. [CITED: github.com/developit/mitt]

### Secondary (MEDIUM confidence)

- None required; all main findings are from codebase, required docs, registry, or official docs. [VERIFIED: source list]

### Tertiary (LOW confidence)

- None. [VERIFIED: source list]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — package versions and installed dependencies verified from package.json, npm registry, and environment probes. [VERIFIED: package.json; VERIFIED: npm registry; VERIFIED: environment probe]
- Architecture: HIGH — provider boundaries, execution order, and NarrativeRenderer/input contracts are locked in CONTEXT.md/UI-SPEC and mapped to current code. [VERIFIED: 22-CONTEXT.md; VERIFIED: 22-UI-SPEC.md; VERIFIED: codebase]
- Pitfalls: HIGH — pitfalls are grounded in current code concentration, current scattered `useInput` handlers, existing timer tests, official React `useSyncExternalStore` caveats, and codebase concerns. [VERIFIED: codebase; CITED: react.dev/reference/react/useSyncExternalStore]
- Validation: HIGH — test framework and scripts verified from package.json, existing test files, Bun docs, and config enabling Nyquist validation. [VERIFIED: package.json; VERIFIED: glob_path; CITED: bun.sh/docs/cli/test; VERIFIED: .planning/config.json]

**Research date:** 2026-05-08 [VERIFIED: system date]
**Valid until:** 2026-06-07 for codebase-specific architecture; re-check npm/doc versions if dependency upgrades are planned. [VERIFIED: current research date]
