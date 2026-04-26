# Chronicle CLI — Codebase Refactoring Design

**Date**: 2026-04-26
**Scope**: CRITICAL (4), HIGH (7), MEDIUM (9) issues from full code review
**Strategy**: 4 phases, dependency-ordered, each independently shippable

---

## Phase 1: Foundation — Store DI & State Consistency

**Goal**: Eliminate global singleton stores as the source of truth, unify all state into the store system, enable testability.

**Addresses**: #1 (global singletons), #5 (inconsistent DI), #9 (mutable state outside stores)

### 1.1 Introduce `GameContext` Container

Create a single dependency container that owns all store instances and subsystems.

```
src/context/game-context.ts
```

```ts
export type GameContext = {
  readonly stores: {
    readonly player: Store<PlayerState>;
    readonly scene: Store<SceneState>;
    readonly game: Store<GameState>;
    readonly combat: Store<CombatState>;
    readonly quest: Store<QuestState>;
    readonly relation: Store<RelationState>;
    readonly npcMemory: Store<NpcMemoryState>;
    readonly exploration: Store<ExplorationState>;
    readonly playerKnowledge: Store<PlayerKnowledgeState>;
    readonly branch: Store<BranchState>;
    readonly dialogue: Store<DialogueState>;
    readonly costSession: Store<CostSessionState>;
  };
  readonly eventBus: EventBus;
};

export function createGameContext(): GameContext { ... }
```

**Migration path**:
1. Create `GameContext` factory that creates fresh store instances
2. Each existing `xxxStore.ts` keeps its `getDefaultXxxState()` and `onChange` factory but stops exporting a singleton
3. Instead, export a `createXxxStore(eventBus)` factory function
4. Existing singleton exports become thin wrappers: `export const playerStore = defaultContext.stores.player` for backward compatibility during migration
5. Engine modules receive `GameContext` (or the specific stores they need) via constructor/factory injection
6. Tests create isolated `GameContext` per test case

**Files changed**: All 12 `src/state/*.ts` files, new `src/context/game-context.ts`

### 1.2 Absorb `questEventLog` and `turnLog` into Stores

Move the two module-level `let` arrays into their respective stores:

- `questEventLog` → `questStore` state as `eventLog: QuestEvent[]`
- `turnLog` → new field in `gameStore` state, or a dedicated `turnLogStore`

This ensures all mutable state goes through the store's `setState` → `onChange` → subscriber pipeline.

**Files changed**: `src/state/quest-store.ts`, `src/engine/turn-log.ts`, `src/state/serializer.ts`

### 1.3 Fix `combat_ended` Event Outcome

`combat-store.ts` line 47 hardcodes `outcome: 'victory'`. Fix:

- Add `outcome: 'victory' | 'defeat' | 'flee' | null` to `CombatState`
- `combat-loop.ts` sets outcome before setting `active: false`
- `onChange` reads `newState.outcome` instead of hardcoding

**Files changed**: `src/state/combat-store.ts`, `src/engine/combat-loop.ts`

### 1.4 Consistent DI in Engine Factories

Audit all factory functions (`createCombatLoop`, `createDialogueManager`, `createSceneManager`, `createQuestSystem`) and replace direct singleton imports with injected stores:

```ts
// Before:
import { combatStore } from '../state/combat-store';
export function createCombatLoop(options) { ... combatStore.getState() ... }

// After:
export function createCombatLoop(ctx: { stores: Pick<GameContext['stores'], 'combat' | 'player' | 'game'>; eventBus: EventBus }, options) { ... }
```

**Files changed**: `src/engine/combat-loop.ts`, `src/engine/dialogue-manager.ts`, `src/engine/quest-system.ts`, `src/engine/scene-manager.ts`, `src/engine/exploration-tracker.ts`, `src/engine/knowledge-tracker.ts`, `src/game-loop.ts`

---

## Phase 2: Engine Decomposition — Action Dispatch & Game Constants

**Goal**: Break the `executeAction` god method into a dispatch table, centralize hardcoded constants.

**Addresses**: #4 (executeAction if-else), #8 (combat_ended — already fixed in Phase 1), #12 (hardcoded constants), #13 (relationshipDelta boundary violation)

### 2.1 Action Handler Registry

Replace the 200-line if-else chain with a handler map:

```
src/engine/action-handlers/
  index.ts           — registry + dispatch
  look-handler.ts
  move-handler.ts
  talk-handler.ts
  combat-handler.ts  — attack/cast/guard/flee routing
  save-handler.ts
  load-handler.ts
  branch-handler.ts
  phase-handlers.ts  — journal/map/codex/compare/replay/shortcuts/chapter_summary/quit
  quest-handler.ts
  cost-handler.ts
  default-handler.ts — adjudicate + narrate fallback
```

Each handler implements:

```ts
export type ActionHandler = (
  action: GameAction,
  ctx: ActionContext,
) => Promise<ProcessResult>;

export type ActionContext = {
  readonly stores: GameContext['stores'];
  readonly eventBus: EventBus;
  readonly sceneManager?: SceneManager;
  readonly dialogueManager?: DialogueManager;
  readonly combatLoop?: CombatLoop;
  readonly saveFileManager?: SaveFileManager;
  readonly serializer?: Serializer;
  readonly saveDir?: string;
  readonly questSystem?: QuestSystem;
  readonly branchManager?: BranchManager;
  readonly turnLog?: TurnLog;
  readonly rng?: () => number;
};
```

`game-loop.ts` becomes ~50 lines: create parser, build context, dispatch via registry.

### 2.2 Game Constants Module

```
src/engine/game-constants.ts
```

Centralize all scattered magic numbers:

```ts
export const GAME_CONSTANTS = {
  DEFAULT_DC: 12,
  BASE_AC: 10,
  CAST_MP_COST: 4,
  FLEE_DC: 10,
  NARRATION_MAX_LENGTH: 300,
  NARRATION_MIN_LENGTH: 10,
  NPC_MEMORY_MAX_RECENT: 3,
  CONFIDENCE_THRESHOLD: 0.3,
  SUMMARIZER_COOLDOWN_MS: 30_000,
  SUMMARIZER_POLL_INTERVAL_MS: 5_000,
} as const;
```

Replace all hardcoded values with references to this module.

### 2.3 Remove `relationshipDelta` from NPC Schema

The LLM should not suggest game-mechanical values. Replace:

```ts
// Before (npc-dialogue.ts schema):
relationshipDelta: z.number().min(-0.5).max(0.5)

// After:
sentiment: z.enum(['positive', 'neutral', 'negative', 'hostile'])
```

The Rules Engine maps sentiment to actual delta values:

```ts
// engine/reputation-system.ts:
const SENTIMENT_DELTAS = { positive: 0.2, neutral: 0, negative: -0.2, hostile: -0.4 };
```

This maintains the boundary: AI classifies tone, Rules Engine decides numerical impact.

---

## Phase 3: AI Layer Consolidation

**Goal**: Eliminate duplication, fix security, add missing providers.

**Addresses**: #3 (safety fail-open), #6 (inconsistent error handling), #7 (Anthropic duplication), #11 (hook duplication), #14 (streaming metadata loss), #16 (missing providers), #17 (dead NarrationOutputSchema), #18 (dead filterForNarrativeDirector)

### 3.1 Shared AI Call Utilities

```
src/ai/utils/ai-caller.ts
```

Extract three reusable wrappers:

```ts
// Handles: retry loop, Anthropic cache branching, usage recording, error event emission
export async function callGenerateText(options: AiCallOptions): Promise<AiTextResult> { ... }
export async function callGenerateObject<T>(options: AiObjectCallOptions<T>): Promise<T> { ... }
export async function* callStreamText(options: AiCallOptions): AsyncGenerator<string> { ... }
```

`AiCallOptions`:

```ts
type AiCallOptions = {
  readonly role: AiRole;
  readonly system: string;
  readonly prompt: string;
  readonly maxRetries?: number;
  readonly onFallback?: () => string;      // called when all retries fail
  readonly failBehavior?: 'throw' | 'fallback';
};
```

This eliminates:
- 4x Anthropic `providerName === 'anthropic'` branches
- 7x retry loop implementations (4 in narrative-director/npc-actor, 1 in safety-filter, 1 in retrieval-planner, 1 in intent-classifier)
- Inconsistent `recordUsage` / `eventBus.emit` calls

Each role file shrinks to ~20 lines: build prompt, call wrapper, post-process.

### 3.2 Safety Filter: Fail-Closed + Bilingual

```ts
// safety-filter.ts — on all retries exhausted:
return { safe: false, reason: 'safety_check_unavailable', category: 'error' };
```

Extend regex to cover English patterns:

```ts
const STATE_OVERRIDE_PATTERN = /(获得|失去|HP|MP|金币|等级|升级|gained|lost|level\s*up)\s*[+\-]?\d+/i;
```

Move `SAFETY_SYSTEM_PROMPT` to `src/ai/prompts/safety-system.ts` for consistency.

### 3.3 Shared Streaming Hook

```
src/ui/hooks/use-streaming-text.ts
```

Extract the common streaming infrastructure from `useAiNarration` and `useNpcDialogue`:

```ts
export function useStreamingText(options: StreamingTextOptions) {
  // sentence buffer, cancel ref, skip ref, streaming state, error state
  return { streamingText, isStreaming, error, start, skipToEnd, reset };
}
```

Then:
- `useAiNarration` = `useStreamingText` + narration-specific `start` wrapper
- `useNpcDialogue` = `useStreamingText` + metadata extraction + fallback structured call

### 3.4 Add Missing Providers

```ts
// providers.ts — PROVIDER_FACTORIES:
alibaba: (model: string) => createAlibaba({ ... })(model),
'openai-compatible': (model: string) => createOpenAICompatible({ ... })(model),
```

Fix profile fallback so empty profiles inherit from `default_profile`:

```ts
const profileData = config.profiles[profile];
const roles = {
  ...(config.profiles[config.default_profile]?.roles ?? {}),
  ...(profileData?.roles ?? {}),
};
```

### 3.5 Cleanup Dead Code

- Delete `src/ai/schemas/narration-output.ts` (unused schema)
- Delete `filterForNarrativeDirector` from `src/ai/utils/epistemic-tagger.ts` (imported but never called in production)
- Delete `PASSTHROUGH_ACTIONS` from `game-loop.ts`
- Delete `useTabCompletion` hook (unused)

---

## Phase 4: UI Layer Restructuring

**Goal**: Decompose god component, fix prop drilling, add error boundaries.

**Addresses**: #2 (GameScreen god component), #10 (prop drilling), #15 (questTemplates empty), #19 (no error boundary), #20 (mixed I/O)

### 4.1 GameScreen Controller Extraction

Move all business logic out of `GameScreen` into a controller:

```
src/engine/game-screen-controller.ts
```

```ts
export type GameScreenController = {
  readonly handleActionExecute: (index: number) => Promise<void>;
  readonly handleInputSubmit: (text: string) => void;
  readonly handleDialogueExecute: (index: number) => void;
  readonly handleDialogueEscape: () => void;
  readonly handleCombatExecute: (index: number) => void;
  readonly handlePanelClose: () => void;
  readonly handlePhaseSwitch: (phase: string) => void;
};

export function createGameScreenController(ctx: GameContext, deps: ControllerDeps): GameScreenController { ... }
```

`GameScreen` becomes a pure rendering component that calls controller methods.

### 4.2 Panel Router Extraction

Replace the 10-deep ternary chain with a declarative panel map:

```
src/ui/panels/panel-router.tsx
```

```tsx
const PANEL_MAP: Record<string, React.ComponentType<PanelProps>> = {
  journal: JournalPanel,
  map: MapPanel,
  codex: CodexPanel,
  branch_tree: BranchTreePanel,
  compare: ComparePanel,
  shortcuts: ShortcutHelpPanel,
  replay: ReplayPanel,
  chapter_summary: ChapterSummaryPanel,
};

export function PanelRouter({ phase, ...panelProps }: PanelRouterProps) {
  const Panel = PANEL_MAP[phase];
  if (Panel) return <Panel {...panelProps} />;
  // Default: ScenePanel for combat/dialogue/game
  return <ActiveScenePanel {...panelProps} />;
}
```

### 4.3 Fix Prop Drilling — Export All Store Contexts

In `app.tsx`:
1. Export all 6 store contexts (currently only 3 are exported)
2. `GameScreen` consumes stores via `useContext` hooks instead of receiving 17 props
3. Only pass non-store props (gameLoop, dialogueManager, combatLoop, mapData, codexEntries, branchTree, etc.)

Target: `GameScreenProps` shrinks from 17 fields to ~8.

### 4.4 Error Boundaries

```
src/ui/components/error-boundary.tsx
```

```tsx
export function GameErrorBoundary({ children, onReset }: Props) {
  // Catches render errors in any child panel
  // Displays: "发生错误：{message}，按 Esc 返回"
  // Resets on Escape press
}
```

Wrap:
- Each panel in `PanelRouter` with `<GameErrorBoundary>`
- `<GameScreen>` itself in `<AppInner>`

### 4.5 Fix `questTemplates`

`app.tsx` line 75 passes `new Map()`. The quest templates need to be loaded from codex:

```ts
// app.tsx or a useEffect in AppInner:
const questTemplates = useMemo(() => {
  const entries = codexQuery.queryByType(codexEntries, 'quest');
  return new Map(entries.map(e => [e.id, e as QuestTemplate]));
}, [codexEntries]);
```

### 4.6 Standardize Async I/O

Replace all `readdirSync`, `mkdirSync`, `readFileSync` with async equivalents:
- `readdirSync` → `readdir` from `node:fs/promises`
- `mkdirSync` → `mkdir` from `node:fs/promises`

Files: `src/codex/loader.ts`, `src/persistence/memory-persistence.ts`, `src/persistence/save-file-manager.ts`, `src/persistence/branch-manager.ts`

---

## Execution Order & Dependencies

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
(stores)    (engine)     (ai)        (ui)
```

- **Phase 1 → Phase 2**: Action handlers need `GameContext` from Phase 1
- **Phase 2 → Phase 3**: AI caller wrapper needs `GAME_CONSTANTS` for config, sentiment schema for NPC output
- **Phase 3 → Phase 4**: Controller extraction needs the cleaned AI hooks from Phase 3
- **Phase 4 can partially overlap Phase 3**: Error boundaries and prop drilling fixes are independent of AI changes

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Store migration breaks existing code | Keep backward-compatible singleton re-exports during Phase 1; remove only after all consumers are migrated |
| Action handler refactor misses edge cases | Each handler gets a test that mirrors the existing if-else branch behavior before refactoring |
| Safety filter fail-closed blocks legitimate input | Add monitoring: emit `safety_filter_unavailable` event, log to cost-session, show user-facing message "安全检查暂时不可用，请重试" |
| GameScreen decomposition breaks UI | Decompose incrementally: extract controller first, verify rendering is identical, then extract PanelRouter |

## Estimated Scope per Phase

| Phase | Files Changed | Files Created | Complexity |
|-------|--------------|---------------|------------|
| 1 | ~20 | 2 | High (touches every layer) |
| 2 | ~8 | ~12 | Medium (mostly extraction) |
| 3 | ~12 | 3 | Medium (consolidation) |
| 4 | ~8 | 3 | Medium (UI restructuring) |

## Out of Scope

- Localization system (Chinese/English label inconsistency — tracked as LOW)
- Dead event type cleanup (aspirational events may be needed later)
- Indexing for codex queries (premature optimization at current scale)
- `CategoryTabs.onSelect` unused prop (trivial)
