# Phase 1: Foundation - Pattern Map

**Mapped:** 2026-04-20
**Files analyzed:** 30
**Analogs found:** 22 / 30

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/index.tsx` | config | request-response | `claude-code-main/src/entrypoints/cli.tsx` | role-match |
| `src/app.tsx` | component | request-response | `claude-code-main/src/components/App.tsx` | exact |
| `src/ui/screens/title-screen.tsx` | component | event-driven | (none -- unique figlet/gradient render) | no-analog |
| `src/ui/screens/game-screen.tsx` | component | event-driven | `claude-code-main/src/components/FullscreenLayout.tsx` | role-match |
| `src/ui/panels/title-bar.tsx` | component | transform | `claude-code-main/src/components/FullscreenLayout.tsx` (header section) | partial |
| `src/ui/panels/scene-panel.tsx` | component | transform | `claude-code-main/src/components/FullscreenLayout.tsx` (scrollable section) | partial |
| `src/ui/panels/status-bar.tsx` | component | transform | (derived from FullscreenLayout bottom slot pattern) | partial |
| `src/ui/panels/actions-panel.tsx` | component | event-driven | `claude-code-main/src/components/CustomSelect/select.tsx` | role-match |
| `src/ui/panels/input-area.tsx` | component | event-driven | `claude-code-main/src/components/BaseTextInput.tsx` | role-match |
| `src/ui/components/divider.tsx` | component | transform | `claude-code-main/src/components/design-system/Divider.tsx` | exact |
| `src/ui/components/outer-border.tsx` | component | transform | (none -- custom box-drawing border wrapper) | no-analog |
| `src/ui/components/adaptive-layout.tsx` | component | transform | `claude-code-main/src/components/FullscreenLayout.tsx` | partial |
| `src/ui/hooks/use-game-input.ts` | hook | event-driven | `claude-code-main/src/hooks/useExitOnCtrlCD.ts` | role-match |
| `src/ui/hooks/use-store.ts` | hook | event-driven | `claude-code-main/src/state/AppState.tsx` (useAppState) | exact |
| `src/state/create-store.ts` | utility | event-driven | `claude-code-main/src/state/store.ts` | exact |
| `src/state/player-store.ts` | store | CRUD | `claude-code-main/src/state/AppStateStore.ts` | role-match |
| `src/state/scene-store.ts` | store | CRUD | `claude-code-main/src/state/AppStateStore.ts` | role-match |
| `src/state/combat-store.ts` | store | CRUD | `claude-code-main/src/state/AppStateStore.ts` | role-match |
| `src/state/game-store.ts` | store | CRUD | `claude-code-main/src/state/AppStateStore.ts` | role-match |
| `src/state/serializer.ts` | utility | file-I/O | (none -- new pattern from RESEARCH.md) | no-analog |
| `src/events/event-bus.ts` | utility | pub-sub | (none -- mitt wrapper, pattern from RESEARCH.md) | no-analog |
| `src/events/event-types.ts` | model | pub-sub | (none -- domain event type definitions) | no-analog |
| `src/input/command-parser.ts` | service | request-response | (none -- Commander.js in-process, pattern from RESEARCH.md) | no-analog |
| `src/input/command-registry.ts` | config | request-response | (derives from command-parser pattern) | no-analog |
| `src/input/intent-classifier.ts` | service | request-response | (none -- AI SDK generateObject, pattern from RESEARCH.md) | no-analog |
| `src/engine/rules-engine.ts` | service | transform | (none -- pure deterministic logic) | no-analog |
| `src/engine/dice.ts` | utility | transform | (none -- pure math functions) | no-analog |
| `src/codex/schemas/*.ts` | model | transform | `claude-code-main/src/schemas/hooks.ts` (Zod schema pattern) | role-match |
| `src/codex/loader.ts` | service | file-I/O | (none -- YAML load + validate) | no-analog |
| `src/types/*.ts` | model | transform | `claude-code-main/src/types/` (type organization pattern) | role-match |

## Pattern Assignments

### `src/state/create-store.ts` (utility, event-driven)

**Analog:** `claude-code-main/src/state/store.ts`
**Match:** Exact -- core store pattern to extend with immer integration.

**Full pattern** (lines 1-34):
```typescript
type Listener = () => void
type OnChange<T> = (args: { newState: T; oldState: T }) => void

export type Store<T> = {
  getState: () => T
  setState: (updater: (prev: T) => T) => void
  subscribe: (listener: Listener) => () => void
}

export function createStore<T>(
  initialState: T,
  onChange?: OnChange<T>,
): Store<T> {
  let state = initialState
  const listeners = new Set<Listener>()

  return {
    getState: () => state,

    setState: (updater: (prev: T) => T) => {
      const prev = state
      const next = updater(prev)
      if (Object.is(next, prev)) return
      state = next
      onChange?.({ newState: next, oldState: prev })
      for (const listener of listeners) listener()
    },

    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
```

**Adaptation required:** Per D-35, change `setState` signature from `(updater: (prev: T) => T)` to `(recipe: (draft: T) => void)` and wrap with immer `produce()`. The Claude Code store takes an updater that returns a new state; Chronicle's stores use immer recipes that mutate a draft. RESEARCH.md Pattern 1 (lines 296-334) shows the exact modified version.

---

### `src/ui/hooks/use-store.ts` (hook, event-driven)

**Analog:** `claude-code-main/src/state/AppState.tsx` (useAppState function)

**React context + useSyncExternalStore pattern** (original source lines 117-163):
```typescript
// Context creation
export const AppStoreContext = React.createContext<AppStateStore | null>(null)

// Internal hook to get store from context
function useAppStore(): AppStateStore {
  const store = useContext(AppStoreContext)
  if (!store) {
    throw new ReferenceError(
      'useAppState/useSetAppState cannot be called outside of an <AppStateProvider />'
    )
  }
  return store
}

// Selector-based subscription -- only re-renders when selected value changes
export function useAppState<T>(selector: (state: AppState) => T): T {
  const store = useAppStore()
  const get = () => selector(store.getState())
  return useSyncExternalStore(store.subscribe, get, get)
}

// Write-only hook -- never re-renders from state changes
export function useSetAppState() {
  return useAppStore().setState
}
```

**Adaptation:** Chronicle needs multiple store contexts (PlayerStore, SceneStore, etc.). Create a generic `useStore<T>(context)` hook instead of a single `useAppState`. Each store gets its own React context and provider, following the same `useSyncExternalStore` pattern.

---

### `src/state/player-store.ts` (store, CRUD)

**Analog:** `claude-code-main/src/state/AppStateStore.ts`

**Type definition + default state pattern** (lines 89, 456-569):
```typescript
// Type definition with DeepImmutable wrapper
export type AppState = DeepImmutable<{
  settings: SettingsJson
  verbose: boolean
  // ... fields
}>

// Default state factory function
export function getDefaultAppState(): AppState {
  return {
    settings: getInitialSettings(),
    verbose: false,
    // ... all fields initialized
  }
}
```

**Adaptation:** Chronicle stores are much simpler. Each domain store (player, scene, combat, game) follows the same pattern:
1. Define state type with Zod schema (for validation on load)
2. Export `getDefault___State()` factory
3. Export store instance created via `createStore(getDefault___State(), onChange)`
4. `onChange` publishes typed domain events to the event bus

---

### `src/app.tsx` (component, request-response)

**Analog:** `claude-code-main/src/components/App.tsx`

**Root provider wrapping pattern** (original source):
```typescript
export function App({
  getFpsMetrics,
  stats,
  initialState,
  children,
}: Props): React.ReactNode {
  return (
    <FpsMetricsProvider getFpsMetrics={getFpsMetrics}>
      <StatsProvider store={stats}>
        <AppStateProvider
          initialState={initialState}
          onChangeAppState={onChangeAppState}
        >
          {children}
        </AppStateProvider>
      </StatsProvider>
    </FpsMetricsProvider>
  )
}
```

**Adaptation:** Chronicle's App wraps store providers + routes between TitleScreen and GameScreen:
```tsx
function App(): React.ReactNode {
  return (
    <GameStoreProvider>
      <PlayerStoreProvider>
        <SceneStoreProvider>
          {/* Screen routing based on game phase */}
        </SceneStoreProvider>
      </PlayerStoreProvider>
    </GameStoreProvider>
  )
}
```

---

### `src/ui/screens/game-screen.tsx` (component, event-driven)

**Analog:** `claude-code-main/src/components/FullscreenLayout.tsx`

**Fullscreen layout with slots pattern** (lines 31-67):
```typescript
type Props = {
  scrollable: ReactNode;    // Content that scrolls
  bottom: ReactNode;        // Content pinned to bottom
  overlay?: ReactNode;      // Floating content
  modal?: ReactNode;        // Dialog content
  // ...
}
```

**Key techniques from FullscreenLayout:**
1. Uses `useTerminalSize()` for responsive dimensions
2. Separates scrollable content from fixed bottom area
3. Uses `flexGrow={1}` for the main content area
4. Modal overlay with absolute positioning

**Adaptation:** GameScreen uses a simpler slot model -- four fixed panels (title-bar, scene, status, actions, input) separated by custom dividers inside a single bordered Box. See RESEARCH.md Pattern 5 (lines 458-522) for the exact layout implementation.

---

### `src/ui/components/divider.tsx` (component, transform)

**Analog:** `claude-code-main/src/components/design-system/Divider.tsx`

**Full divider pattern** (original source):
```typescript
type DividerProps = {
  width?: number;       // Defaults to terminal width
  color?: keyof Theme;  // Theme color, dimColor if not provided
  char?: string;        // Default '─'
  padding?: number;     // Subtract from width
  title?: string;       // Centered title
}

export function Divider({
  width,
  color,
  char = '─',
  padding = 0,
  title,
}: DividerProps): React.ReactNode {
  const { columns: terminalWidth } = useTerminalSize()
  const effectiveWidth = Math.max(0, (width ?? terminalWidth) - padding)
  // renders char.repeat(effectiveWidth) with optional centered title
}
```

**Adaptation:** Chronicle's divider needs box-drawing junction characters (`├───┤`) instead of plain `───`. The width must account for the outer border (subtract 2 for `│` on each side). The `char` prop stays as `─` but the component renders `├` + `─`.repeat(innerWidth) + `┤` as a complete row.

---

### `src/ui/panels/actions-panel.tsx` (component, event-driven)

**Analog:** `claude-code-main/src/components/CustomSelect/select.tsx`

**Selection list pattern:**
The CustomSelect directory contains a complete selection UI with:
- `use-select-navigation.ts` -- arrow key navigation state
- `use-select-state.ts` -- selection state management
- `select-input-option.tsx` -- individual option rendering
- `select.tsx` -- orchestrator component

**Key pattern:** Separation of navigation state (hook) from rendering (component). The selection index is managed via a custom hook, not inline state.

**Adaptation:** Actions panel renders a numbered list with `cursor` cursor indicator. Simpler than CustomSelect since options are always a flat list of 3-5 actions. Use `useInput` for arrow key navigation with `isActive` flag to prevent conflicts with TextInput.

---

### `src/ui/hooks/use-game-input.ts` (hook, event-driven)

**Analog:** `claude-code-main/src/hooks/useExitOnCtrlCD.ts`

**Input handling hook pattern** (lines 45-95):
```typescript
export function useExitOnCtrlCD(
  useKeybindingsHook: UseKeybindingsHook,
  onInterrupt?: () => boolean,
  onExit?: () => void,
  isActive = true,
): ExitState {
  const { exit } = useApp()
  const [exitState, setExitState] = useState<ExitState>({
    pending: false,
    keyName: null,
  })
  // ... handler composition via useCallback/useMemo
  useKeybindingsHook(handlers, { context: 'Global', isActive })
  return exitState
}
```

**Key pattern:** The `isActive` parameter controls whether input capture is active -- critical for preventing keystroke conflicts between parent components and focused TextInput children.

**Adaptation:** `use-game-input` routes input between command mode (`/` prefix -> CommandParser) and natural language mode (everything else -> IntentClassifier). Uses `isActive` to disable game input when TextInput has focus.

---

### `src/codex/schemas/*.ts` (model, transform)

**Analog:** `claude-code-main/src/schemas/hooks.ts`

**Zod schema organization pattern** (lines 31-189):
```typescript
// Build schemas in a factory function to allow composition
function buildHookSchemas() {
  const BashCommandHookSchema = z.object({
    type: z.literal('command').describe('Shell command hook type'),
    command: z.string().describe('Shell command to execute'),
    timeout: z.number().positive().optional(),
    // ...
  })

  const PromptHookSchema = z.object({
    type: z.literal('prompt').describe('LLM prompt hook type'),
    prompt: z.string().describe('Prompt to evaluate'),
    // ...
  })

  return { BashCommandHookSchema, PromptHookSchema, /* ... */ }
}

// Discriminated union from individual schemas
export const HookCommandSchema = lazySchema(() => {
  const { BashCommandHookSchema, PromptHookSchema, AgentHookSchema, HttpHookSchema } = buildHookSchemas()
  return z.discriminatedUnion('type', [
    BashCommandHookSchema, PromptHookSchema, AgentHookSchema, HttpHookSchema,
  ])
})

// Inferred types from schemas
export type HookCommand = z.infer<ReturnType<typeof HookCommandSchema>>
```

**Key patterns:**
1. Schema factory functions for composability
2. `z.discriminatedUnion` for type-safe variants
3. `z.infer<>` to derive TypeScript types from schemas
4. `.describe()` annotations on fields for documentation
5. `.default()` for optional fields with defaults

**Adaptation:** Codex schemas follow the same pattern: individual entry type schemas (RaceSchema, LocationSchema, etc.) composed into a discriminated union `CodexEntrySchema`. The epistemic metadata schema is shared across all entry types via `z.object().extend()`. Types are always inferred from schemas, never hand-written separately.

---

### `src/state/game-store.ts` (store, CRUD)

**Analog:** `claude-code-main/src/state/onChangeAppState.ts`

**onChange side-effect pattern** (lines 43-171):
```typescript
export function onChangeAppState({
  newState,
  oldState,
}: {
  newState: AppState
  oldState: AppState
}) {
  // Diff specific fields and trigger side effects
  const prevMode = oldState.toolPermissionContext.mode
  const newMode = newState.toolPermissionContext.mode
  if (prevMode !== newMode) {
    // Notify external systems of the change
    notifyPermissionModeChanged(newMode)
  }

  // Another field diff
  if (newState.mainLoopModel !== oldState.mainLoopModel) {
    updateSettingsForSource('userSettings', { model: newState.mainLoopModel })
  }
}
```

**Key pattern:** The `onChange` callback receives `{ newState, oldState }` and performs targeted diffs on specific fields. Side effects (event emission, persistence, notifications) only fire when the relevant field actually changed.

**Adaptation:** Each Chronicle store's `onChange` publishes typed domain events to the event bus:
```typescript
function onPlayerStateChange({ newState, oldState }: { newState: PlayerState; oldState: PlayerState }) {
  if (newState.hp !== oldState.hp) {
    eventBus.emit('player_damaged', { amount: oldState.hp - newState.hp, source: 'unknown' });
  }
}
```

---

### `src/index.tsx` (config, request-response)

**Analog:** `claude-code-main/src/entrypoints/cli.tsx`

**Entry point pattern** (lines 33-41):
```typescript
async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Fast-path for flags
  if (args.length === 1 && (args[0] === '--version' || args[0] === '-v')) {
    console.log(`${MACRO.VERSION} (Claude Code)`)
    return
  }

  // Dynamic imports for lazy loading
  const { profileCheckpoint } = await import('../utils/startupProfiler.js')
  // ... boot sequence
}
```

**Adaptation:** Chronicle's entry point uses fullscreen-ink's `withFullScreen` and renders `<App />`. Much simpler -- no dynamic imports needed since it's a game, not a CLI tool with multiple modes.

---

### `src/state/selectors.ts` reference

**Analog:** `claude-code-main/src/state/selectors.ts`

**Selector pattern** (lines 1-76):
```typescript
// Selectors are pure functions that derive computed state
// They accept the minimal state slice needed (via Pick<>)

export function getViewedTeammateTask(
  appState: Pick<AppState, 'viewingAgentTaskId' | 'tasks'>,
): InProcessTeammateTaskState | undefined {
  const { viewingAgentTaskId, tasks } = appState
  if (!viewingAgentTaskId) return undefined
  const task = tasks[viewingAgentTaskId]
  if (!task) return undefined
  if (!isInProcessTeammateTask(task)) return undefined
  return task
}

// Discriminated union return types for type-safe branching
export type ActiveAgentForInput =
  | { type: 'leader' }
  | { type: 'viewed'; task: InProcessTeammateTaskState }
```

**Key patterns:**
1. `Pick<State, ...>` for minimal dependency declaration
2. Discriminated union return types
3. Pure functions, no side effects
4. Early returns for guard clauses

**Adaptation:** Chronicle stores should have selectors in separate files (e.g., `src/state/player-selectors.ts`) for derived data like effective attribute values, combat modifiers, etc.

---

## Shared Patterns

### Store + immer + onChange (applies to all stores)

**Source:** `claude-code-main/src/state/store.ts` + `claude-code-main/src/state/onChangeAppState.ts`
**Apply to:** `src/state/create-store.ts`, `src/state/player-store.ts`, `src/state/scene-store.ts`, `src/state/combat-store.ts`, `src/state/game-store.ts`

Every store follows this lifecycle:
1. `createStore<T>(initialState, onChange)` -- create with immer-integrated setState
2. `onChange` diffs old vs new state and emits typed domain events
3. React components subscribe via `useSyncExternalStore` through context-based hooks
4. State updates always go through `store.setState(draft => { /* immer recipe */ })`

### React Context + useSyncExternalStore (applies to all stores exposed to UI)

**Source:** `claude-code-main/src/state/AppState.tsx` lines 27, 117-179
**Apply to:** `src/ui/hooks/use-store.ts`, all store provider components

Pattern: Create a context per store, provide the store instance, consume via `useSyncExternalStore` with a selector function. Write-only access via `useSet___State()` hook that returns only `store.setState`.

### Zod Schema + Type Inference (applies to all data models)

**Source:** `claude-code-main/src/schemas/hooks.ts`
**Apply to:** `src/codex/schemas/*.ts`, `src/types/intent.ts`, `src/types/game-action.ts`, all store state types

Pattern: Define Zod schema first, derive TypeScript type via `z.infer<>`. Never write the type separately from the schema. Use `.describe()` for documentation. Use `z.discriminatedUnion` for variant types.

### Input isActive Guard (applies to all input hooks)

**Source:** `claude-code-main/src/hooks/useExitOnCtrlCD.ts` line 49
**Apply to:** `src/ui/hooks/use-game-input.ts`, `src/ui/panels/actions-panel.tsx`, `src/ui/panels/input-area.tsx`

Pattern: Every `useInput` or keybinding hook accepts an `isActive` parameter. When TextInput has focus, parent input hooks must be deactivated to prevent keystroke conflicts. Track focus state explicitly.

### Divider Width Calculation (applies to all layout components)

**Source:** `claude-code-main/src/components/design-system/Divider.tsx`
**Apply to:** `src/ui/components/divider.tsx`, `src/ui/screens/game-screen.tsx`

Pattern: Use terminal width from `useScreenSize()` (fullscreen-ink), subtract padding/border, use `string-width` for any CJK text measurement. Never use `String.length` for layout calculations.

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason | RESEARCH.md Pattern Reference |
|------|------|-----------|--------|-------------------------------|
| `src/ui/screens/title-screen.tsx` | component | event-driven | Unique figlet + gradient-string rendering. No equivalent in Claude Code. | RESEARCH.md: figlet + gradient-string usage (Stack section) |
| `src/ui/components/outer-border.tsx` | component | transform | Custom single-border wrapper with `├───┤` divider slots. Ink's built-in `borderStyle` insufficient. | RESEARCH.md: Pattern 5 (lines 458-522), Open Question 1 |
| `src/events/event-bus.ts` | utility | pub-sub | New typed mitt wrapper. No existing event bus in reference. | RESEARCH.md: Pattern 3 (lines 394-415) |
| `src/events/event-types.ts` | model | pub-sub | Domain event type definitions unique to game systems. | RESEARCH.md: Pattern 3 DomainEvents type |
| `src/input/command-parser.ts` | service | request-response | Commander.js in-process parsing. Claude Code doesn't use Commander this way. | RESEARCH.md: Pattern 2 (lines 336-392) |
| `src/input/command-registry.ts` | config | request-response | Game command definitions (/look, /go, /talk, etc.). | CONTEXT.md: D-37 through D-40 |
| `src/input/intent-classifier.ts` | service | request-response | AI SDK v5 generateObject for NL intent. No LLM classification in reference. | RESEARCH.md: Pattern 4 (lines 417-456) |
| `src/engine/rules-engine.ts` | service | transform | Pure deterministic D20 resolver. No game logic equivalent. | RESEARCH.md: Code Examples (lines 600-657) |
| `src/engine/dice.ts` | utility | transform | Seedable PRNG for D20/percentage rolls. Pure math. | RESEARCH.md: Code Examples -- CheckParams interface |
| `src/codex/loader.ts` | service | file-I/O | YAML loading + Zod validation. Bun-specific file I/O. | RESEARCH.md: Don't Hand-Roll section (yaml package) |
| `src/state/serializer.ts` | utility | file-I/O | Multi-store snapshot/restore. New pattern. | RESEARCH.md: Store Serialization pattern (lines 711-742) |

---

## Metadata

**Analog search scope:** `claude-code-main/src/` (state/, components/, hooks/, screens/, entrypoints/, schemas/, types/)
**Files scanned:** ~50 reference files examined across state, components, hooks, schemas, and entrypoints directories
**Pattern extraction date:** 2026-04-20
**Reference implementation:** Claude Code source snapshot at `claude-code-main/`
