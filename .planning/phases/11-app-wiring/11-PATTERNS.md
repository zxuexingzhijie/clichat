# Phase 11: App Wiring - Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 14
**Analogs found:** 14 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app.tsx` | provider/orchestrator | request-response | `src/app.tsx` (current self) | exact — refactor in place |
| `src/context/game-context.ts` | context factory | CRUD | `src/context/game-context.ts` (already exists) | exact — consume as-is |
| `src/game-loop.ts` | service | request-response | `src/game-loop.ts` (fill option slots) | exact — fill `GameLoopOptions` |
| `src/engine/scene-manager.ts` | service | request-response | `src/engine/scene-manager.ts` | exact — add `generateRetrievalPlanFn` option |
| `src/engine/combat-loop.ts` | service | event-driven | `src/engine/combat-loop.ts` | exact — add `generateNarrationFn` option |
| `src/engine/quest-system.ts` | service | CRUD | `src/engine/quest-system.ts` | exact — wire with `ctx.stores` |
| `src/state/serializer.ts` | utility | CRUD | `src/state/serializer.ts` | exact — wire with `ctx.stores` |
| `src/persistence/save-file-manager.ts` | utility | file-I/O | `src/persistence/save-file-manager.ts` | exact — standalone functions |
| `src/engine/exploration-tracker.ts` | service | event-driven | `src/engine/exploration-tracker.ts` | exact — returns cleanup fn |
| `src/engine/knowledge-tracker.ts` | service | event-driven | `src/engine/knowledge-tracker.ts` | exact — returns cleanup fn |
| `src/ai/roles/retrieval-planner.ts` | service | request-response | `src/ai/roles/retrieval-planner.ts` | exact — pass as fn reference |
| `src/ai/summarizer/summarizer-worker.ts` | service | event-driven | `src/ai/summarizer/summarizer-worker.ts` | exact — fire-and-forget |
| `src/ui/screens/game-screen.tsx` | component | request-response | `src/ui/screens/game-screen.tsx` | exact — add missing props |
| `src/state/branch-store.ts` | store | CRUD | `src/state/branch-store.ts` + `src/persistence/branch-manager.ts` | exact — state shape + operations |

---

## Pattern Assignments

### `src/app.tsx` — refactor to `createGameContext()` pattern

**Current problem:** imports module-level singletons (`gameStore`, `playerStore`, `sceneStore`, etc.) and the module-level `eventBus`. After refactor, all stores come from one `useMemo(() => createGameContext(), [])`.

**Imports to add** (`src/context/game-context.ts` lines 1-17):
```typescript
import { createGameContext } from './context/game-context';
import { resolveDataDir } from './paths';
import { quickSave, saveGame, loadGame } from './persistence/save-file-manager';
import { createSerializer } from './state/serializer';
import { createQuestSystem } from './engine/quest-system';
import { createBranch, switchBranch, deleteBranch } from './persistence/branch-manager';
import { initExplorationTracker } from './engine/exploration-tracker';
import { initKnowledgeTracker } from './engine/knowledge-tracker';
import { generateRetrievalPlan } from './ai/roles/retrieval-planner';
import { runSummarizerLoop } from './ai/summarizer/summarizer-worker';
```

**Context factory pattern** (`src/context/game-context.ts` lines 40-61):
```typescript
// In AppInner — single useMemo replaces per-store imports
const ctx = useMemo(() => createGameContext(), []);
// ctx.stores.player, ctx.stores.quest, ctx.stores.branch, ctx.stores.turnLog, etc.
// ctx.eventBus — same instance used by all factories below
```

**useMemo factory pattern** (current `src/app.tsx` lines 84-116):
```typescript
// Pattern already used for sceneManager, dialogueManager, combatLoop
// Extend same pattern for quest, serializer, etc.:
const sceneManager = useMemo(
  () => createSceneManager(
    { scene: ctx.stores.scene, eventBus: ctx.eventBus },
    allCodexEntries as Map<string, CodexEntry>,
    { generateNarrationFn: generateNarration, generateRetrievalPlanFn: generateRetrievalPlan },
  ),
  [ctx, allCodexEntries],
);
```

**useEffect startup side-effect pattern** (current `src/app.tsx` lines 46-56 and 169-173):
```typescript
// Pattern for fire-and-forget + cleanup-returning effects already established:
useEffect(() => {
  initRoleConfigs(...).catch((err) => {
    console.error('[AI Config] Failed to load ai-config.yaml, using defaults:', ...);
  });
}, []);

// Apply same pattern for summarizer (fire-and-forget):
useEffect(() => {
  runSummarizerLoop().catch((err) => {
    console.error('[Summarizer] loop error:', err instanceof Error ? err.message : String(err));
  });
}, []);

// Apply cleanup-returning pattern for trackers (mirrors event-listener teardown):
useEffect(() => {
  const cleanup = initExplorationTracker(
    { exploration: ctx.stores.exploration, game: ctx.stores.game },
    ctx.eventBus,
  );
  return cleanup;
}, [ctx]);

useEffect(() => {
  if (allCodexEntries.size === 0) return;
  const cleanup = initKnowledgeTracker(
    { playerKnowledge: ctx.stores.playerKnowledge, game: ctx.stores.game },
    ctx.eventBus,
  );
  return cleanup;
}, [ctx, allCodexEntries]);
```

**React Provider pattern — use ctx stores** (current `src/app.tsx` lines 176-189):
```typescript
// BEFORE (module-level singletons):
<GameStoreCtx.Provider store={gameStore}>
  <QuestStoreCtx.Provider store={questStore}>

// AFTER (ctx.stores instances):
<GameStoreCtx.Provider store={ctx.stores.game}>
  <QuestStoreCtx.Provider store={ctx.stores.quest}>
```

**saveDir resolution pattern** (CLI entry point uses same pattern):
```typescript
const saveDir = `${process.env.__CHRONICLE_DATA_DIR || resolveDataDir()}/saves`;
```

---

### `src/game-loop.ts` — fill `GameLoopOptions` slots

**Existing signature** (lines 84-88):
```typescript
export function createGameLoop(
  stores: GameLoopStores,
  eventBus: EventBus,
  options?: GameLoopOptions,
): GameLoop
```

**`GameLoopOptions` type** (lines 54-75) — all slots to wire:
```typescript
export type GameLoopOptions = {
  readonly rng?: () => number;
  readonly sceneManager?: SceneManager;
  readonly dialogueManager?: DialogueManager;
  readonly combatLoop?: CombatLoop;
  readonly saveFileManager?: {
    quickSave: (serializer: Serializer, saveDir: string) => Promise<string>;
    saveGame: (name: string, serializer: Serializer, saveDir: string) => Promise<string>;
    loadGame: (filePath: string, serializer: Serializer) => Promise<void>;
  };
  readonly serializer?: Serializer;
  readonly saveDir?: string;
  readonly questSystem?: QuestSystem;
  readonly branchManager?: {
    readonly createBranch: (name: string) => BranchMeta;
    readonly switchBranch: (branchId: string) => void;
    readonly deleteBranch: (branchId: string) => void;
  };
  readonly turnLog?: {
    readonly replayTurns: (count: number) => readonly TurnLogEntry[];
  };
};
```

**How to fill from `app.tsx`**:
```typescript
const questSystem = useMemo(
  () => createQuestSystem(
    { quest: ctx.stores.quest, relation: ctx.stores.relation, game: ctx.stores.game },
    allCodexEntries as Map<string, CodexEntry>,
  ),
  [ctx, allCodexEntries],
);

const serializer = useMemo(
  () => createSerializer(
    {
      player: ctx.stores.player,
      scene: ctx.stores.scene,
      combat: ctx.stores.combat,
      game: ctx.stores.game,
      quest: ctx.stores.quest,
      relations: ctx.stores.relation,
      npcMemory: ctx.stores.npcMemory,
      exploration: ctx.stores.exploration,
      playerKnowledge: ctx.stores.playerKnowledge,
      turnLog: ctx.stores.turnLog,
    },
    () => ctx.stores.branch.getState().currentBranchId,
    () => null,
  ),
  [ctx],
);

const gameLoop = useMemo(
  () => createGameLoop(
    { player: ctx.stores.player, scene: ctx.stores.scene, game: ctx.stores.game, combat: ctx.stores.combat },
    ctx.eventBus,
    {
      sceneManager,
      dialogueManager,
      combatLoop,
      saveFileManager: { quickSave, saveGame, loadGame },
      serializer,
      saveDir,
      questSystem,
      branchManager: { createBranch, switchBranch, deleteBranch },
      turnLog: ctx.stores.turnLog,
    },
  ),
  [sceneManager, dialogueManager, combatLoop, serializer, questSystem, saveDir, ctx],
);
```

---

### `src/engine/scene-manager.ts` — add `generateRetrievalPlanFn`

**`SceneManagerOptions` type** (lines 24-27) — slot already exists, just needs to be filled:
```typescript
export type SceneManagerOptions = {
  readonly generateNarrationFn?: GenerateNarrationFn;
  readonly generateRetrievalPlanFn?: GenerateRetrievalPlanFn;
};
```

**`GenerateRetrievalPlanFn` type** (lines 17-22):
```typescript
type GenerateRetrievalPlanFn = (context: {
  readonly currentScene: string;
  readonly playerAction: string;
  readonly activeNpcs: readonly string[];
  readonly activeQuests: readonly string[];
}) => Promise<RetrievalPlan>;
```

**`generateRetrievalPlan` in retrieval-planner.ts** (lines 17-20) — its `RetrievalPromptContext` matches the above shape:
```typescript
export async function generateRetrievalPlan(
  context: RetrievalPromptContext,
  options?: RetrievalPlannerOptions,
): Promise<RetrievalPlan>
```

Wire in `app.tsx` `createSceneManager` call:
```typescript
{ generateNarrationFn: generateNarration, generateRetrievalPlanFn: generateRetrievalPlan }
```

---

### `src/engine/combat-loop.ts` — add `generateNarrationFn`

**`CombatLoopOptions` type** (lines 35-38):
```typescript
export type CombatLoopOptions = {
  readonly rng?: () => number;
  readonly generateNarrationFn?: (context: NarrativeContext) => Promise<string>;
};
```

Wire in `app.tsx` `createCombatLoop` call:
```typescript
const combatLoop = useMemo(
  () => createCombatLoop(
    { combat: ctx.stores.combat, player: ctx.stores.player, game: ctx.stores.game },
    allCodexEntries as Map<string, CodexEntry>,
    { generateNarrationFn: generateNarration },
  ),
  [ctx, allCodexEntries],
);
```

---

### `src/engine/quest-system.ts` — wire with `ctx.stores`

**`createQuestSystem` signature** (lines 22-29):
```typescript
export function createQuestSystem(
  stores: {
    quest: Store<QuestState>;
    relation: Store<RelationState>;
    game: Store<GameState>;
  },
  codexEntries: Map<string, CodexEntry>,
): QuestSystem
```

Note: current `app.tsx` only passes `quest` store. The full stores object must include `relation` and `game` as well.

---

### `src/state/serializer.ts` — wire with `ctx.stores`

**`createSerializer` signature** (lines 89-104):
```typescript
export function createSerializer(
  stores: {
    player: Store<PlayerState>;
    scene: Store<SceneState>;
    combat: Store<CombatState>;
    game: Store<GameState>;
    quest: Store<QuestState>;
    relations: Store<RelationState>;
    npcMemory: Store<NpcMemoryState>;
    exploration: Store<ExplorationState>;
    playerKnowledge: Store<PlayerKnowledgeState>;
    turnLog: Store<TurnLogState>;
  },
  getBranchId: () => string,
  getParentSaveId: () => string | null,
): Serializer
```

Note: store key is `relations` (not `relation`) — must match exactly.

---

### `src/persistence/save-file-manager.ts` — standalone exported functions

**Function signatures** (lines 35-63):
```typescript
export async function quickSave(serializer: Serializer, saveDir: string): Promise<string>
export async function saveGame(name: string, serializer: Serializer, saveDir: string): Promise<string>
export async function loadGame(filePath: string, serializer: Serializer, saveDir?: string): Promise<void>
```

These are named exports — pass as object literal matching `GameLoopOptions.saveFileManager`:
```typescript
saveFileManager: { quickSave, saveGame, loadGame }
```

---

### `src/engine/exploration-tracker.ts` — returns cleanup function

**`initExplorationTracker` signature** (lines 13-16):
```typescript
export function initExplorationTracker(
  stores: { exploration: Store<ExplorationState>; game: Store<GameState> },
  eventBus: EventBus,
): () => void
```

Returns an unsubscribe/cleanup function — must be returned from `useEffect` for React cleanup.

---

### `src/engine/knowledge-tracker.ts` — returns cleanup function

**`initKnowledgeTracker` signature** (lines 64-67):
```typescript
export function initKnowledgeTracker(
  stores: { playerKnowledge: Store<PlayerKnowledgeState>; game: Store<GameState> },
  eventBus: EventBus,
): () => void
```

Same cleanup pattern as exploration tracker. Gate on `allCodexEntries.size > 0` if codex is needed — current implementation does not require codex entries (D-16 says `allCodexEntries` but the actual signature takes only stores + eventBus).

---

### `src/ai/roles/retrieval-planner.ts` — pass as function reference

**Export** (line 17):
```typescript
export async function generateRetrievalPlan(
  context: RetrievalPromptContext,
  options?: RetrievalPlannerOptions,
): Promise<RetrievalPlan>
```

`RetrievalPromptContext` (from `src/ai/prompts/retrieval-system.ts`) must be verified to match `GenerateRetrievalPlanFn` in `scene-manager.ts` — both expect `{ currentScene, playerAction, activeNpcs, activeQuests }`. Pass as direct reference: `generateRetrievalPlanFn: generateRetrievalPlan`.

---

### `src/ai/summarizer/summarizer-worker.ts` — fire-and-forget

**Export** (lines 92-108):
```typescript
export async function runSummarizerLoop(): Promise<void>
// Infinite loop with 5000ms polling — never resolves normally
```

Pattern: fire-and-forget `useEffect` with error logging to stderr, no cleanup needed:
```typescript
useEffect(() => {
  runSummarizerLoop().catch((err) => {
    console.error('[Summarizer] loop error:', err instanceof Error ? err.message : String(err));
  });
}, []);
```

Note: `summarizer-worker.ts` currently imports module-level singletons (`npcMemoryStore`, `sceneStore`) — this is a pre-existing coupling that is out of scope for Phase 11.

---

### `src/ui/screens/game-screen.tsx` — `GameScreenProps`

**`GameScreenProps` type** (lines 40-55) — existing optional props to now fill:
```typescript
type GameScreenProps = {
  readonly questTemplates: ReadonlyMap<string, QuestTemplate>;
  readonly dialogueManager?: DialogueManager;
  readonly combatLoop?: CombatLoop;
  readonly gameLoop?: GameLoop;
  readonly mapData?: {
    readonly locations: readonly LocationMapData[];
    readonly currentLocationId: string;
    readonly regionName: string;
  };
  readonly codexEntries?: readonly CodexDisplayEntry[];
  readonly branchTree?: readonly BranchDisplayNode[];
  readonly currentBranchId?: string;
  readonly branchDiffResult?: BranchDiffResult;
  readonly compareBranchNames?: { readonly source: string; readonly target: string };
};
```

**`BranchDisplayNode`** is imported from `src/ui/panels/branch-tree-panel`. Source data for `branchTree` comes from `ctx.stores.branch.getState()`.

**`codexDisplayEntries` — subscribe `knowledgeStatus` from playerKnowledge store** (D-17):
```typescript
// Current app.tsx line 70 hardcodes null:
knowledgeStatus: null,

// Pattern for reactive subscription (mirrors costSessionStore.subscribe in game-screen.tsx lines 159-163):
const [knowledgeState, setKnowledgeState] = useState(
  () => ctx.stores.playerKnowledge.getState()
);
useEffect(() => {
  return ctx.stores.playerKnowledge.subscribe(() => {
    setKnowledgeState(ctx.stores.playerKnowledge.getState());
  });
}, [ctx]);
```

---

### `src/state/branch-store.ts` — state shape and branch operations

**`BranchState` shape** (lines 17-21):
```typescript
export const BranchStateSchema = z.object({
  branches: z.record(z.string(), BranchMetaSchema),
  currentBranchId: z.string(),
});
export type BranchState = z.infer<typeof BranchStateSchema>;
```

**Branch operations** come from `src/persistence/branch-manager.ts` (lines 29-78), not the store itself. These are currently singletons operating on the module-level `branchStore`. To pass as `GameLoopOptions.branchManager`:
```typescript
import { createBranch, switchBranch, deleteBranch } from './persistence/branch-manager';

branchManager: { createBranch, switchBranch, deleteBranch }
```

Note: `branch-manager.ts` imports the module-level `branchStore` singleton — it cannot currently operate on `ctx.stores.branch`. This is a pre-existing coupling; Phase 11 wires the interface, not a refactor of branch-manager internals.

---

## Shared Patterns

### Store subscription for reactive state in React

**Source:** `src/ui/screens/game-screen.tsx` lines 159-163
**Apply to:** `branchTree` and `knowledgeStatus` derivations in `app.tsx`
```typescript
useEffect(() => {
  return costSessionStore.subscribe(() => {
    setLastTurnTokens(costSessionStore.getState().lastTurnTokens);
  });
}, []);
```

### `useEffect` with returned cleanup for event listeners

**Source:** `src/ui/screens/game-screen.tsx` lines 149-153 and `src/engine/exploration-tracker.ts` lines 40-44
**Apply to:** `initExplorationTracker` and `initKnowledgeTracker` calls in `app.tsx`
```typescript
useEffect(() => {
  const handler = () => { triggerSceneFade(); };
  eventBus.on('scene_changed', handler);
  return () => { eventBus.off('scene_changed', handler); };
}, [triggerSceneFade]);
```

### `useMemo` factory instantiation

**Source:** `src/app.tsx` lines 84-116
**Apply to:** all new factory calls (`questSystem`, `serializer`, updated `gameLoop`)
```typescript
const factory = useMemo(
  () => createFactory(deps),
  [dep1, dep2],
);
```

### Error logging pattern for background effects

**Source:** `src/app.tsx` lines 46-56 and 169-173
**Apply to:** `runSummarizerLoop` and `initRoleConfigs` calls
```typescript
somePromise().catch((err) => {
  console.error('[Tag] message:', err instanceof Error ? err.message : String(err));
});
```

---

## No Analog Found

None. All 14 files exist in the codebase; this phase only wires them together.

---

## Metadata

**Analog search scope:** `src/app.tsx`, `src/context/`, `src/game-loop.ts`, `src/engine/`, `src/state/`, `src/persistence/`, `src/ai/roles/`, `src/ai/summarizer/`, `src/ui/screens/`, `src/ui/hooks/`
**Files scanned:** 14 primary + 4 supporting (`use-store.ts`, `paths.ts`, `branch-manager.ts`, `player-knowledge-store.ts`)
**Pattern extraction date:** 2026-04-28
