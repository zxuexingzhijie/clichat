---
phase: 11-app-wiring
plan: P02
type: execute
wave: 2
depends_on:
  - 11-P01
files_modified:
  - src/app.tsx
autonomous: true
requirements:
  - WIRE-04
  - WIRE-05
  - WIRE-06
  - WIRE-07

must_haves:
  truths:
    - "GameScreen receives mapData prop derived from codex location entries and current scene store state"
    - "GameScreen receives branchTree, currentBranchId, branchDiffResult, compareBranchNames props from ctx.stores.branch"
    - "createSceneManager in app.tsx passes generateRetrievalPlanFn: generateRetrievalPlan"
    - "createCombatLoop in app.tsx passes generateNarrationFn: generateNarration"
  artifacts:
    - path: src/app.tsx
      provides: "WIRE-04/05/06/07 all satisfied — mapData, branchTree, RAG planner, combat narration wired"
    - path: src/engine/scene-manager.test.ts
      provides: "Test verifying generateRetrievalPlanFn is invoked during scene load"
  key_links:
    - from: "src/app.tsx AppInner"
      to: "GameScreen mapData prop"
      via: "useMemo deriving LocationMapData[] from allCodexEntries + useStoreState scene"
      pattern: "mapData.*locations"
    - from: "src/app.tsx AppInner"
      to: "GameScreen branchTree prop"
      via: "useState + useEffect subscribing to ctx.stores.branch"
      pattern: "branchTree.*BranchDisplayNode"
    - from: "src/app.tsx createSceneManager"
      to: "generateRetrievalPlan"
      via: "generateRetrievalPlanFn option"
      pattern: "generateRetrievalPlanFn.*generateRetrievalPlan"
---

<objective>
Wire WIRE-04 (mapData to GameScreen), WIRE-05 (branchTree/branchDiffResult to GameScreen), WIRE-06 (RAG retrieval planner to sceneManager), WIRE-07 (combat narration to combatLoop).

Purpose: Players can type :map and see locations; :branch renders the branch tree; scene loads trigger RAG; combat outcomes get AI narration.
Output: app.tsx updated with reactive mapData derivation, branch state subscription, and both AI function options wired.
</objective>

<execution_context>
@/Users/makoto/Downloads/work/cli/.planning/phases/11-app-wiring/11-CONTEXT.md
</execution_context>

<context>
@/Users/makoto/Downloads/work/cli/.planning/ROADMAP.md
@/Users/makoto/Downloads/work/cli/.planning/phases/11-app-wiring/11-P01-SUMMARY.md

<interfaces>
<!-- Key contracts. Read these before touching app.tsx. -->

From src/ui/screens/game-screen.tsx GameScreenProps:
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

From src/ui/panels/map-panel.tsx:
```typescript
type LocationMapData = {
  readonly id: string;
  readonly name: string;
  readonly mapIcon: string;
  readonly coordinates: { readonly x: number; readonly y: number };
  readonly exits: readonly { readonly direction: string; readonly targetId: string }[];
  readonly dangerLevel: number;
  readonly region: string;
  readonly explorationLevel: ExplorationLevel;
  readonly isQuestRelated: boolean;
};
```

From src/codex/schemas/entry-types.ts (Location type — subset relevant to mapData):
```typescript
// entry.type === 'location' entries have:
//   entry.id, entry.name, entry.map_icon (optional), entry.coordinates (optional {x,y}),
//   entry.exits (array of {direction, location_id}), entry.danger_level (number), entry.region (string)
//   entry.tags (string[]) — check for 'quest_related' tag
```

From src/state/branch-store.ts:
```typescript
export type BranchState = {
  branches: Record<string, BranchMeta>;
  currentBranchId: string;
};
export type BranchMeta = {
  id: string; name: string; parentBranchId: string | null;
  parentSaveId: string | null; headSaveId: string | null;
  createdAt: string; description: string;
};
```

From src/ui/panels/branch-tree-panel.tsx:
```typescript
type BranchDisplayNode = {
  readonly branchMeta: BranchMeta;
  readonly saves: readonly BranchSaveInfo[];  // pass [] for now — save loading is SAVE-01 (Phase 12)
  readonly children: readonly BranchDisplayNode[];
};
```

From src/engine/scene-manager.ts SceneManagerOptions:
```typescript
export type SceneManagerOptions = {
  readonly generateNarrationFn?: GenerateNarrationFn;
  readonly generateRetrievalPlanFn?: GenerateRetrievalPlanFn;
};
```

From src/engine/combat-loop.ts CombatLoopOptions:
```typescript
export type CombatLoopOptions = {
  readonly rng?: () => number;
  readonly generateNarrationFn?: (context: NarrativeContext) => Promise<string>;
};
```

From src/ai/roles/retrieval-planner.ts:
```typescript
export async function generateRetrievalPlan(
  context: RetrievalPromptContext,
  options?: RetrievalPlannerOptions,
): Promise<RetrievalPlan>
// RetrievalPromptContext matches GenerateRetrievalPlanFn parameter shape in scene-manager.ts
```

From src/state/exploration-store.ts (ExplorationLevel type):
```typescript
type ExplorationLevel = 'unknown' | 'rumored' | 'known' | 'visited' | 'surveyed';
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Wire generateRetrievalPlanFn to sceneManager and generateNarrationFn to combatLoop</name>
  <files>src/app.tsx</files>
  <read_first>
    - src/app.tsx (full file — read the P01 result first; understand current sceneManager and combatLoop useMemo calls)
    - src/engine/scene-manager.ts (lines 1-30 — SceneManagerOptions type, createSceneManager signature)
    - src/engine/combat-loop.ts (lines 1-45 — CombatLoopOptions type, createCombatLoop signature)
    - src/ai/roles/retrieval-planner.ts (lines 1-25 — generateRetrievalPlan signature)
    - src/ai/roles/narrative-director.ts (lines 1-20 — generateNarration signature — confirm it matches CombatLoopOptions.generateNarrationFn shape)
  </read_first>
  <behavior>
    - sceneManager useMemo options object includes `generateRetrievalPlanFn: generateRetrievalPlan`
    - combatLoop useMemo options object includes `generateNarrationFn: generateNarration`
    - generateNarration is already imported (present in P01 result) — just add it to combatLoop options
    - generateRetrievalPlan is a NEW import from './ai/roles/retrieval-planner'
    - TypeScript: no type errors — confirm GenerateRetrievalPlanFn in scene-manager.ts and the actual generateRetrievalPlan function signature are compatible
  </behavior>
  <action>
    In src/app.tsx (after P01 changes):

    1. Add import: `import { generateRetrievalPlan } from './ai/roles/retrieval-planner';`

    2. Update the `sceneManager` useMemo to add `generateRetrievalPlanFn`:
       ```typescript
       const sceneManager = useMemo(
         () => createSceneManager(
           { scene: ctx.stores.scene, eventBus: ctx.eventBus },
           allCodexEntries as Map<string, CodexEntry>,
           { generateNarrationFn: generateNarration, generateRetrievalPlanFn: generateRetrievalPlan },
         ),
         [ctx, allCodexEntries],
       );
       ```

    3. Update the `combatLoop` useMemo to add `generateNarrationFn`:
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

    Per D-12 (generateRetrievalPlanFn) and D-13 (generateNarrationFn) from CONTEXT.md.
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bunx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "generateRetrievalPlanFn" src/app.tsx` returns a match with `generateRetrievalPlan`
    - `grep -n "generateNarrationFn" src/app.tsx` returns a match inside combatLoop useMemo
    - `bunx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>sceneManager options include generateRetrievalPlanFn: generateRetrievalPlan; combatLoop options include generateNarrationFn: generateNarration; TypeScript clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire mapData and branchTree props to GameScreen</name>
  <files>src/app.tsx</files>
  <read_first>
    - src/app.tsx (full file after Task 1 is done)
    - src/ui/panels/map-panel.tsx (lines 1-25 — LocationMapData type)
    - src/codex/schemas/entry-types.ts (lines 35-60 — LocationSchema, location entry fields)
    - src/state/exploration-store.ts (ExplorationLevel, ExplorationState shape)
    - src/ui/panels/branch-tree-panel.tsx (lines 1-30 — BranchDisplayNode, BranchSaveInfo types)
    - src/state/branch-store.ts (BranchState, BranchMeta — to understand getState() shape)
  </read_first>
  <behavior>
    - `mapData` is derived via `useMemo` from `allCodexEntries` (location entries) + reactive `sceneState.sceneId`. Subscribe to sceneStore state for reactive `currentLocationId`. Filter allCodexEntries to `entry.type === 'location'` and map each to `LocationMapData`.
    - Location codex entry fields map to LocationMapData: `id=entry.id`, `name=entry.name`, `mapIcon=entry.map_icon ?? ''`, `coordinates=entry.coordinates ?? {x:0,y:0}`, `exits=(entry.exits ?? []).map(e => ({direction: e.direction, targetId: e.location_id}))`, `dangerLevel=entry.danger_level ?? 0`, `region=entry.region ?? ''`, `explorationLevel=explorationState.locations[entry.id]?.level ?? 'unknown'`, `isQuestRelated=entry.tags?.includes('quest_related') ?? false`
    - `explorationState` subscribed reactively via `useState` + `useEffect` on `ctx.stores.exploration`
    - `branchTree` is derived via `useMemo` from `branchState.branches` — build flat `BranchDisplayNode[]` where root nodes have `parentBranchId === null`, children are nested. Pass `saves: []` (actual save data is Phase 12 SAVE-01 scope). Subscribe branchState reactively via `useState` + `useEffect` on `ctx.stores.branch`.
    - `currentBranchId` = `branchState.currentBranchId`
    - `branchDiffResult` and `compareBranchNames` = `undefined` (compare feature is Phase 12 scope — these props are optional)
    - All three props passed to `<GameScreen>` in JSX
    - `regionName` in mapData = first location's `region` field, or `''` if empty
  </behavior>
  <action>
    In src/app.tsx (after Task 1 is done):

    1. Add imports:
       ```typescript
       import type { LocationMapData } from './ui/panels/map-panel';
       import type { BranchDisplayNode } from './ui/panels/branch-tree-panel';
       import type { ExplorationState } from './state/exploration-store';
       import type { BranchState } from './state/branch-store';
       ```

    2. In `AppInner`, add reactive state subscriptions:
       ```typescript
       const [explorationState, setExplorationState] = useState<ExplorationState>(
         () => ctx.stores.exploration.getState()
       );
       useEffect(() => {
         return ctx.stores.exploration.subscribe(() => {
           setExplorationState(ctx.stores.exploration.getState());
         });
       }, [ctx]);

       const [branchState, setBranchState] = useState<BranchState>(
         () => ctx.stores.branch.getState()
       );
       useEffect(() => {
         return ctx.stores.branch.subscribe(() => {
           setBranchState(ctx.stores.branch.getState());
         });
       }, [ctx]);
       ```

    3. Add sceneId subscription for currentLocationId (may already exist via GameStoreCtx.useStoreState — check if sceneStore state is accessible via SceneStoreCtx.useStoreState):
       ```typescript
       const currentSceneId = SceneStoreCtx.useStoreState((s) => s.sceneId);
       ```

    4. Add `mapData` useMemo:
       ```typescript
       const mapData = useMemo(() => {
         const locationEntries = Array.from(allCodexEntries.values()).filter(e => e.type === 'location');
         const locations: LocationMapData[] = locationEntries.map(entry => ({
           id: entry.id,
           name: entry.name,
           mapIcon: (entry as any).map_icon ?? '',
           coordinates: (entry as any).coordinates ?? { x: 0, y: 0 },
           exits: ((entry as any).exits ?? []).map((ex: any) => ({
             direction: ex.direction,
             targetId: ex.location_id,
           })),
           dangerLevel: (entry as any).danger_level ?? 0,
           region: (entry as any).region ?? '',
           explorationLevel: explorationState.locations[entry.id]?.level ?? 'unknown',
           isQuestRelated: entry.tags?.includes('quest_related') ?? false,
         }));
         const regionName = locations[0]?.region ?? '';
         return { locations, currentLocationId: currentSceneId, regionName };
       }, [allCodexEntries, explorationState, currentSceneId]);
       ```

    5. Add `branchTree` useMemo:
       ```typescript
       const branchTree = useMemo((): readonly BranchDisplayNode[] => {
         const { branches } = branchState;
         function buildNodes(parentId: string | null): BranchDisplayNode[] {
           return Object.values(branches)
             .filter(b => b.parentBranchId === parentId)
             .map(b => ({ branchMeta: b, saves: [], children: buildNodes(b.id) }));
         }
         return buildNodes(null);
       }, [branchState]);
       ```

    6. Update the `<GameScreen>` JSX to pass the new props:
       ```typescript
       <GameScreen
         questTemplates={questTemplates}
         gameLoop={gameLoop}
         dialogueManager={dialogueManager}
         combatLoop={combatLoop}
         codexEntries={codexDisplayEntries}
         mapData={mapData}
         branchTree={branchTree}
         currentBranchId={branchState.currentBranchId}
       />
       ```

    Per D-09 (branchTree), D-11 (mapData), D-17 context (knowledgeStatus is addressed in P03).
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bunx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "mapData=" src/app.tsx` returns match in GameScreen JSX
    - `grep -n "branchTree=" src/app.tsx` returns match in GameScreen JSX
    - `grep -n "currentBranchId=" src/app.tsx` returns match in GameScreen JSX
    - `grep -n "explorationState" src/app.tsx` returns matches for useState + useEffect subscription
    - `bunx tsc --noEmit` exits 0
    - `bun test src/ui/screens/game-screen.test.ts` still passes
  </acceptance_criteria>
  <done>GameScreen receives mapData (LocationMapData[] derived from codex + exploration state) and branchTree (BranchDisplayNode[] derived from branch store); both update reactively; TypeScript clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| codex entry → LocationMapData | Codex YAML is read-only world data; location field access uses optional chaining with defaults |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-03 | Information Disclosure | generateRetrievalPlan receives scene context | accept | Retrieval planner only reads codex; no player secrets passed; AI call is backend-to-backend |
| T-11-04 | Denial of Service | runSummarizerLoop infinite polling | accept | Handled in P03; already fire-and-forget with error logging |
| T-11-05 | Tampering | branchTree built from store snapshot | mitigate | branchState is immutable snapshot from getState(); buildNodes creates new arrays via map/filter |
</threat_model>

<verification>
After completing both tasks:
1. `bunx tsc --noEmit` — zero errors
2. `bun test src/ui/screens/game-screen.test.ts` — all pass
3. `grep "generateRetrievalPlanFn.*generateRetrievalPlan" src/app.tsx` — returns match
4. `grep "generateNarrationFn.*generateNarration" src/app.tsx` — returns match inside combatLoop useMemo
5. `grep "mapData=" src/app.tsx` — returns match in GameScreen JSX
6. `grep "branchTree=" src/app.tsx` — returns match in GameScreen JSX
</verification>

<success_criteria>
- sceneManager created with generateRetrievalPlanFn: generateRetrievalPlan (WIRE-06)
- combatLoop created with generateNarrationFn: generateNarration (WIRE-07)
- GameScreen receives mapData derived from codex + exploration store (WIRE-04)
- GameScreen receives branchTree and currentBranchId from branch store (WIRE-05)
- TypeScript compiles clean
- game-screen.test.ts still passes
</success_criteria>

<output>
After completion, create `.planning/phases/11-app-wiring/11-P02-SUMMARY.md`
</output>
