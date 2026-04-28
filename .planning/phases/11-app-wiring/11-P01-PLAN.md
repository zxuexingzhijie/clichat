---
phase: 11-app-wiring
plan: P01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app.tsx
autonomous: true
requirements:
  - WIRE-01
  - WIRE-02
  - WIRE-03

must_haves:
  truths:
    - "app.tsx uses createGameContext() as single source of stores — no module-level singleton store imports remain (gameStore, playerStore, etc.)"
    - "All React Providers (GameStoreCtx, PlayerStoreCtx, SceneStoreCtx, DialogueStoreCtx, CombatStoreCtx, QuestStoreCtx) pass ctx.stores instances, not module-level singletons"
    - "serializer, questSystem created via useMemo from ctx.stores in AppInner"
    - "gameLoop receives saveFileManager, serializer, saveDir, questSystem, branchManager, turnLog in its options"
  artifacts:
    - path: src/app.tsx
      provides: "Refactored orchestration with createGameContext(), all WIRE-01/02/03 slots filled"
      min_lines: 100
  key_links:
    - from: "src/app.tsx AppInner"
      to: "createGameContext()"
      via: "useMemo(() => createGameContext(), [])"
      pattern: "createGameContext"
    - from: "src/app.tsx gameLoop useMemo"
      to: "saveFileManager, serializer, saveDir, questSystem, branchManager, turnLog"
      via: "options object in createGameLoop call"
      pattern: "saveFileManager.*quickSave|questSystem|turnLog.*ctx"
---

<objective>
Refactor app.tsx to use createGameContext() and wire WIRE-01 (save), WIRE-02 (quest/branch), WIRE-03 (replay/turnLog) into createGameLoop.

Purpose: Provides the ctx foundation all subsequent plans depend on. Without this, save/quest/branch/replay commands all silently do nothing because createGameLoop receives undefined for every option.
Output: Refactored src/app.tsx with ctx.stores plumbing, all three WIRE requirements satisfied.
</objective>

<execution_context>
@/Users/makoto/Downloads/work/cli/.planning/phases/11-app-wiring/11-CONTEXT.md
</execution_context>

<context>
@/Users/makoto/Downloads/work/cli/.planning/ROADMAP.md
@/Users/makoto/Downloads/work/cli/.planning/STATE.md

<interfaces>
<!-- Key contracts the executor needs. Read these before touching app.tsx. -->

From src/context/game-context.ts:
```typescript
export type GameStores = {
  readonly player: Store<PlayerState>;
  readonly scene: Store<SceneState>;
  readonly game: Store<GameState>;
  readonly combat: Store<CombatState>;
  readonly dialogue: Store<DialogueState>;
  readonly quest: Store<QuestState>;
  readonly relation: Store<RelationState>;
  readonly exploration: Store<ExplorationState>;
  readonly npcMemory: Store<NpcMemoryState>;
  readonly playerKnowledge: Store<PlayerKnowledgeState>;
  readonly branch: Store<BranchState>;
  readonly costSession: Store<CostSessionState>;
  readonly turnLog: Store<TurnLogState>;
};
export type GameContext = { readonly stores: GameStores; readonly eventBus: EventBus };
export function createGameContext(): GameContext
```

From src/game-loop.ts:
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

From src/state/serializer.ts (createSerializer):
```typescript
export function createSerializer(
  stores: {
    player: Store<PlayerState>;
    scene: Store<SceneState>;
    combat: Store<CombatState>;
    game: Store<GameState>;
    quest: Store<QuestState>;
    relations: Store<RelationState>;  // key is "relations", NOT "relation"
    npcMemory: Store<NpcMemoryState>;
    exploration: Store<ExplorationState>;
    playerKnowledge: Store<PlayerKnowledgeState>;
    turnLog: Store<TurnLogState>;
  },
  getBranchId: () => string,
  getParentSaveId: () => string | null,
): Serializer
```

From src/engine/quest-system.ts (createQuestSystem):
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

From src/persistence/save-file-manager.ts:
```typescript
export async function quickSave(serializer: Serializer, saveDir: string): Promise<string>
export async function saveGame(name: string, serializer: Serializer, saveDir: string): Promise<string>
export async function loadGame(filePath: string, serializer: Serializer, saveDir?: string): Promise<void>
```

From src/persistence/branch-manager.ts:
```typescript
export function createBranch(name: string, description?: string): BranchMeta
export function switchBranch(branchId: string): void
export function deleteBranch(branchId: string): void
```

Current src/app.tsx imports to REMOVE (module-level singletons):
- gameStore, playerStore, sceneStore, dialogueStore, combatStore, questStore
- npcMemoryStore, relationStore
- eventBus (from events/event-bus)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Replace singleton imports with createGameContext() in AppInner</name>
  <files>src/app.tsx</files>
  <read_first>
    - src/app.tsx (the full file — understand every current import and usage before touching anything)
    - src/context/game-context.ts (GameContext, GameStores, createGameContext)
    - src/persistence/branch-manager.ts (createBranch, switchBranch, deleteBranch signatures)
    - src/persistence/save-file-manager.ts (quickSave, saveGame, loadGame signatures)
    - src/state/serializer.ts (createSerializer — note "relations" key, not "relation")
    - src/engine/quest-system.ts (createQuestSystem stores shape)
  </read_first>
  <behavior>
    - After refactor: `const ctx = useMemo(() => createGameContext(), [])` inside AppInner; no singleton store imports remain at top of file
    - `createSerializer` called with `relations: ctx.stores.relation` (key "relations", value ctx.stores.relation)
    - `createQuestSystem` called with `{ quest: ctx.stores.quest, relation: ctx.stores.relation, game: ctx.stores.game }`
    - `gameLoop` useMemo receives `saveFileManager: { quickSave, saveGame, loadGame }`, `serializer`, `saveDir`, `questSystem`, `branchManager: { createBranch, switchBranch, deleteBranch }`, `turnLog: ctx.stores.turnLog`
    - `saveDir` = `` `${process.env.__CHRONICLE_DATA_DIR || resolveDataDir()}/saves` `` (computed once, not inside useMemo)
    - All `useMemo` factories that previously used `sceneStore`, `gameStore` etc. now use `ctx.stores.scene`, `ctx.stores.game`, etc.
    - `handleCharacterCreated` callback uses `ctx.stores.player.setState(...)` not `playerStore.setState(...)`
    - `App()` Providers must pass `store={ctx.stores.game}` etc. — but `ctx` is created inside `AppInner`, so `App()` still wraps with providers; the providers' stores must come from `ctx`. Correct approach: move the `useMemo(() => createGameContext(), [])` into `App()` and pass `ctx` down as prop to `AppInner`, OR create context at `App()` level — choose whichever avoids prop drilling and matches existing code structure (ctx created inside `App()`, passed to `AppInner` via prop is cleanest).
  </behavior>
  <action>
    Rewrite src/app.tsx:

    1. Remove all module-level singleton store imports: `gameStore`, `playerStore`, `sceneStore`, `dialogueStore`, `combatStore`, `questStore`, `npcMemoryStore`, `relationStore`, `eventBus` from `events/event-bus`.

    2. Add imports:
       ```typescript
       import { createGameContext } from './context/game-context';
       import { quickSave, saveGame, loadGame } from './persistence/save-file-manager';
       import { createSerializer } from './state/serializer';
       import { createQuestSystem } from './engine/quest-system';
       import { createBranch, switchBranch, deleteBranch } from './persistence/branch-manager';
       import type { GameContext } from './context/game-context';
       ```

    3. In `App()`: add `const ctx = useMemo(() => createGameContext(), []);` and pass `ctx` as prop to `AppInner`. Add `type AppInnerProps = { ctx: GameContext }` type.

    4. Update all 6 Providers in `App()` to use `ctx.stores.*`:
       - `store={ctx.stores.game}`, `store={ctx.stores.player}`, `store={ctx.stores.scene}`, `store={ctx.stores.dialogue}`, `store={ctx.stores.combat}`, `store={ctx.stores.quest}`

    5. In `AppInner({ ctx })`:
       - Compute `const saveDir = \`${process.env.__CHRONICLE_DATA_DIR || resolveDataDir()}/saves\`` (outside all hooks, stable string).
       - Replace per-factory store references with `ctx.stores.*` and `ctx.eventBus`.
       - Add `const serializer = useMemo(() => createSerializer({ player: ctx.stores.player, scene: ctx.stores.scene, combat: ctx.stores.combat, game: ctx.stores.game, quest: ctx.stores.quest, relations: ctx.stores.relation, npcMemory: ctx.stores.npcMemory, exploration: ctx.stores.exploration, playerKnowledge: ctx.stores.playerKnowledge, turnLog: ctx.stores.turnLog }, () => ctx.stores.branch.getState().currentBranchId, () => null), [ctx]);`
       - Add `const questSystem = useMemo(() => createQuestSystem({ quest: ctx.stores.quest, relation: ctx.stores.relation, game: ctx.stores.game }, allCodexEntries as Map<string, CodexEntry>), [ctx, allCodexEntries]);`
       - Update `gameLoop` useMemo to pass full options: `{ sceneManager, dialogueManager, combatLoop, saveFileManager: { quickSave, saveGame, loadGame }, serializer, saveDir, questSystem, branchManager: { createBranch, switchBranch, deleteBranch }, turnLog: ctx.stores.turnLog }`.
       - Update `handleCharacterCreated` to use `ctx.stores.player.setState(...)` and `ctx.stores.game` via `GameStoreCtx.useSetState()` (which reads from Provider ctx — already correct after Provider fix).

    6. Update all other factory calls (sceneManager, dialogueManager, combatLoop, gameLoop) to use `ctx.stores.*` and `ctx.eventBus` instead of singleton references.

    7. Keep the existing `questTemplates` useMemo, `codexDisplayEntries` useMemo, and codex loading useEffect unchanged in structure (only update store references).

    Per D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-10, D-18 from CONTEXT.md.
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bunx tsc --noEmit 2>&1 | head -40</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "from './state/game-store'" src/app.tsx` returns only type imports (no `gameStore` value import)
    - `grep -n "from './state/player-store'" src/app.tsx` returns only type imports
    - `grep -n "from './events/event-bus'" src/app.tsx` finds NO import (eventBus now from ctx)
    - `grep -n "createGameContext" src/app.tsx` returns at least 1 match (usage in App())
    - `grep -n "saveFileManager" src/app.tsx` returns a match with `{ quickSave, saveGame, loadGame }`
    - `grep -n "questSystem" src/app.tsx` returns match in gameLoop options
    - `grep -n "turnLog: ctx.stores.turnLog" src/app.tsx` returns a match
    - `grep -n "relations: ctx.stores.relation" src/app.tsx` returns a match (note "relations" key)
    - `bunx tsc --noEmit` exits 0 with no errors
  </acceptance_criteria>
  <done>app.tsx uses createGameContext(); all 6 Providers receive ctx.stores instances; createGameLoop receives all WIRE-01/02/03 options; no module-level singleton store imports remain; TypeScript clean.</done>
</task>

<task type="auto">
  <name>Task 2: Add/update integration tests for wired gameLoop options</name>
  <files>src/game-loop.test.ts</files>
  <read_first>
    - src/game-loop.test.ts (full file — understand current test patterns and mock setup)
    - src/game-loop.ts (GameLoopOptions type, lines 54-75)
    - src/state/serializer.ts (Serializer interface — what methods does it expose?)
    - src/engine/quest-system.ts (QuestSystem interface)
  </read_first>
  <behavior>
    - Test: createGameLoop with saveFileManager option — processInput('/save') calls saveFileManager.quickSave
    - Test: createGameLoop with questSystem option — processInput('/quest') calls questSystem.getActiveQuests (or equivalent method)
    - Test: createGameLoop with turnLog option — processInput('/replay 3') calls turnLog.replayTurns(3)
    - Tests use mock implementations (mock functions), not real implementations
    - Tests do NOT break existing tests
  </behavior>
  <action>
    Add a new describe block to src/game-loop.test.ts named "createGameLoop options wiring".

    Create three tests:
    1. `/save` calls `saveFileManager.quickSave` when option is provided
    2. `/quest` calls `questSystem` method (inspect which method game-loop delegates to for /quest)
    3. `/replay 3` calls `turnLog.replayTurns(3)`

    Use `mock(() => Promise.resolve('save-id'))` for saveFileManager functions.
    Use `mock(() => [])` for questSystem and turnLog methods.

    Pattern from existing tests: mock at top, `const loop = createGameLoop(stores, eventBus, { ...options })`, then `await loop.processInput('/save')`, then `expect(mockFn).toHaveBeenCalled()`.

    Do NOT break existing test cases. Only add to the file.
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/game-loop.test.ts 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `bun test src/game-loop.test.ts` exits 0 with all tests passing
    - New describe block "createGameLoop options wiring" appears in test output
    - No existing tests regressed
  </acceptance_criteria>
  <done>game-loop.test.ts includes tests verifying that saveFileManager, questSystem, and turnLog options are passed through to the game loop; all tests pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| useEffect → createGameContext | ctx created once; mutation of ctx.stores state must go through setState only |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-01 | Tampering | ctx.stores shared across components | mitigate | All stores use immutable setState pattern; direct property mutation is not possible via Store<T> interface |
| T-11-02 | Information Disclosure | saveDir derived from env var | accept | __CHRONICLE_DATA_DIR is a dev/test env var, not a secret; path traversal is addressed in SAVE-03 (Phase 12) |
</threat_model>

<verification>
After completing both tasks:
1. `bunx tsc --noEmit` — zero errors
2. `bun test src/game-loop.test.ts` — all pass
3. `grep -c "createGameContext" src/app.tsx` — returns >= 1
4. `grep "gameStore\b" src/app.tsx | grep -v "type\|GameState\|GameStoreCtx"` — returns empty (no singleton value imports)
</verification>

<success_criteria>
- app.tsx imports createGameContext and uses it as the store source
- All 6 React Providers use ctx.stores instances
- createGameLoop receives saveFileManager, serializer, saveDir, questSystem, branchManager, turnLog
- serializer created with `relations: ctx.stores.relation` (correct key)
- TypeScript compiles clean
- game-loop.test.ts passes with new option-wiring tests
</success_criteria>

<output>
After completion, create `.planning/phases/11-app-wiring/11-P01-SUMMARY.md`
</output>
