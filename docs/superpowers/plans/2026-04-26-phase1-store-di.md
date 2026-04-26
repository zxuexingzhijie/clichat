# Phase 1: Store DI & State Consistency — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace global singleton stores with a dependency-injectable GameContext container, absorb orphaned mutable state (`questEventLog`, `turnLog`), and fix the `combat_ended` event bug.

**Architecture:** Each store file gets a factory function `createXxxStore(eventBus)` alongside its existing singleton. A `GameContext` type owns all 12 store instances + eventBus. The default singletons are re-wired through a default context for backward compatibility. Engine factories receive their needed stores via parameters instead of importing singletons.

**Tech Stack:** TypeScript, Immer, Mitt, Zod, Bun test runner

---

## File Structure

**Create:**
- `src/events/event-bus.ts` — add `EventBus` type export (modify)
- `src/context/game-context.ts` — `GameContext` type + `createGameContext()` factory
- `src/context/__tests__/game-context.test.ts` — isolated context tests
- `src/state/__tests__/store-factories.test.ts` — factory function tests
- `src/state/__tests__/combat-outcome.test.ts` — combat_ended outcome tests
- `src/state/__tests__/quest-event-log.test.ts` — absorbed questEventLog tests
- `src/state/turn-log-store.ts` — new store absorbing turn-log module
- `src/state/__tests__/turn-log-store.test.ts` — turn-log store tests

**Modify:**
- All 12 `src/state/*.ts` store files — add factory exports
- `src/state/combat-store.ts` — add `outcome` field to schema
- `src/state/quest-store.ts` — absorb `questEventLog` into state
- `src/engine/combat-loop.ts` — set outcome before `active: false`
- `src/engine/turn-log.ts` — re-export from new store (thin wrapper)
- `src/state/serializer.ts` — read/write logs from stores instead of module functions
- `src/engine/combat-loop.ts` — accept stores via DI
- `src/engine/dialogue-manager.ts` — accept stores via DI
- `src/engine/scene-manager.ts` — accept stores via DI
- `src/engine/quest-system.ts` — accept stores via DI
- `src/engine/exploration-tracker.ts` — accept stores via DI
- `src/engine/knowledge-tracker.ts` — accept stores via DI
- `src/game-loop.ts` — accept GameContext
- `src/app.tsx` — create GameContext and thread through

---

### Task 1: Export EventBus Type

**Files:**
- Modify: `src/events/event-bus.ts`

- [ ] **Step 1: Add EventBus type export**

```ts
// src/events/event-bus.ts
import mitt from 'mitt';
import type { DomainEvents } from './event-types';

export type EventBus = ReturnType<typeof mitt<DomainEvents>>;
export const eventBus: EventBus = mitt<DomainEvents>();
```

- [ ] **Step 2: Verify no type errors**

Run: `bunx tsc --noEmit`
Expected: PASS (no regressions)

- [ ] **Step 3: Commit**

```bash
git add src/events/event-bus.ts
git commit -m "refactor: export EventBus type from event-bus module"
```

---

### Task 2: Create Store Factory Functions (Template: player-store)

**Files:**
- Modify: `src/state/player-store.ts`
- Create: `src/state/__tests__/store-factories.test.ts`

- [ ] **Step 1: Write failing test for createPlayerStore factory**

```ts
// src/state/__tests__/store-factories.test.ts
import { describe, it, expect } from 'bun:test';
import mitt from 'mitt';
import type { DomainEvents } from '../../events/event-types';
import { createPlayerStore, getDefaultPlayerState } from '../player-store';

describe('createPlayerStore', () => {
  it('creates an isolated store with default state', () => {
    const bus = mitt<DomainEvents>();
    const store = createPlayerStore(bus);
    expect(store.getState()).toEqual(getDefaultPlayerState());
  });

  it('emits player_damaged on the injected eventBus', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('player_damaged', (e) => events.push(e));

    const store = createPlayerStore(bus);
    store.setState((draft) => { draft.hp = 20; });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ amount: 10, source: 'unknown' });
  });

  it('does not affect another store instance', () => {
    const bus1 = mitt<DomainEvents>();
    const bus2 = mitt<DomainEvents>();
    const store1 = createPlayerStore(bus1);
    const store2 = createPlayerStore(bus2);

    store1.setState((draft) => { draft.hp = 5; });
    expect(store2.getState().hp).toBe(getDefaultPlayerState().hp);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/state/__tests__/store-factories.test.ts`
Expected: FAIL — `createPlayerStore` is not exported

- [ ] **Step 3: Add createPlayerStore factory to player-store.ts**

Add this function before the singleton export (before line 37):

```ts
export function createPlayerStore(bus: EventBus): Store<PlayerState> {
  return createStore<PlayerState>(
    getDefaultPlayerState(),
    ({ newState, oldState }) => {
      if (newState.hp !== oldState.hp) {
        const delta = newState.hp - oldState.hp;
        if (delta < 0) {
          bus.emit('player_damaged', { amount: Math.abs(delta), source: 'unknown' });
        } else {
          bus.emit('player_healed', { amount: delta, source: 'unknown' });
        }
      }
      if (newState.gold !== oldState.gold) {
        bus.emit('gold_changed', { delta: newState.gold - oldState.gold, newTotal: newState.gold });
      }
    },
  );
}
```

Add the import at the top of the file:

```ts
import type { EventBus } from '../events/event-bus';
```

Then change the singleton to use the factory:

```ts
export const playerStore = createPlayerStore(eventBus);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/state/__tests__/store-factories.test.ts`
Expected: PASS

- [ ] **Step 5: Verify no regressions**

Run: `bun test`
Expected: All existing tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/state/player-store.ts src/state/__tests__/store-factories.test.ts
git commit -m "refactor: add createPlayerStore factory with DI for eventBus"
```

---

### Task 3: Apply Factory Pattern to All Remaining Stores

**Files:**
- Modify: `src/state/scene-store.ts`
- Modify: `src/state/game-store.ts`
- Modify: `src/state/dialogue-store.ts`
- Modify: `src/state/combat-store.ts`
- Modify: `src/state/quest-store.ts`
- Modify: `src/state/relation-store.ts`
- Modify: `src/state/exploration-store.ts`
- Modify: `src/state/npc-memory-store.ts`
- Modify: `src/state/player-knowledge-store.ts`
- Modify: `src/state/branch-store.ts`
- Modify: `src/state/cost-session-store.ts`
- Modify: `src/state/__tests__/store-factories.test.ts`

Apply the same pattern from Task 2 to each store. For each store:
1. Import `EventBus` type
2. Add `createXxxStore(bus: EventBus)` factory that takes `onChange`'s eventBus as parameter
3. Change singleton to `export const xxxStore = createXxxStore(eventBus)`

- [ ] **Step 1: Add factories and tests for simple stores (no cross-store deps)**

These stores have no cross-store dependencies in their `onChange`:
- `scene-store.ts` → `createSceneStore(bus)`
- `game-store.ts` → `createGameStore(bus)`
- `dialogue-store.ts` → `createDialogueStore(bus)`
- `relation-store.ts` → `createRelationStore(bus)`
- `exploration-store.ts` → `createExplorationStore(bus)`
- `npc-memory-store.ts` → `createNpcMemoryStore(bus)`
- `player-knowledge-store.ts` → `createPlayerKnowledgeStore(bus)`
- `branch-store.ts` → `createBranchStore(bus)`

Each follows the exact same transformation as Task 2: extract `onChange` body into factory, inject `bus` parameter.

Add a test for each in `store-factories.test.ts`:

```ts
import { createSceneStore, getDefaultSceneState } from '../scene-store';
import { createGameStore, getDefaultGameState } from '../game-store';
import { createDialogueStore, getDefaultDialogueState } from '../dialogue-store';
import { createRelationStore, getDefaultRelationState } from '../relation-store';
import { createExplorationStore, getDefaultExplorationState } from '../exploration-store';
import { createNpcMemoryStore, getDefaultNpcMemoryState } from '../npc-memory-store';
import { createPlayerKnowledgeStore, getDefaultPlayerKnowledgeState } from '../player-knowledge-store';
import { createBranchStore, getDefaultBranchState } from '../branch-store';

describe('simple store factories', () => {
  it('createSceneStore emits scene_changed on injected bus', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('scene_changed', (e) => events.push(e));
    const store = createSceneStore(bus);
    store.setState((d) => { d.sceneId = 'new_scene'; });
    expect(events).toHaveLength(1);
  });

  it('createGameStore emits time_advanced on injected bus', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('time_advanced', (e) => events.push(e));
    const store = createGameStore(bus);
    store.setState((d) => { d.day = 2; });
    expect(events).toHaveLength(1);
  });

  it('createDialogueStore emits dialogue_started on injected bus', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('dialogue_started', (e) => events.push(e));
    const store = createDialogueStore(bus);
    store.setState((d) => { d.active = true; d.npcId = 'npc1'; d.npcName = 'Guard'; });
    expect(events).toHaveLength(1);
  });

  it('createRelationStore emits reputation_changed on injected bus', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('reputation_changed', (e) => events.push(e));
    const store = createRelationStore(bus);
    store.setState((d) => { d.npcDispositions['npc1'] = { value: 10, publicReputation: 0, personalTrust: 0, fear: 0, infamy: 0, credibility: 0 }; });
    expect(events).toHaveLength(1);
  });

  it('createBranchStore emits branch_created on injected bus', () => {
    const bus = mitt<DomainEvents>();
    const events: unknown[] = [];
    bus.on('branch_created', (e) => events.push(e));
    const store = createBranchStore(bus);
    store.setState((d) => {
      d.branches['alt'] = { id: 'alt', name: 'alt', parentBranchId: 'main', parentSaveId: null, headSaveId: null, createdAt: '', description: '' };
    });
    expect(events).toHaveLength(1);
  });

  it('each factory produces independent instances', () => {
    const bus = mitt<DomainEvents>();
    const s1 = createGameStore(bus);
    const s2 = createGameStore(bus);
    s1.setState((d) => { d.turnCount = 99; });
    expect(s2.getState().turnCount).toBe(0);
  });
});
```

- [ ] **Step 2: Handle quest-store (cross-store dep on gameStore)**

`quest-store.ts` onChange reads `gameStore.getState().turnCount`. The factory needs a `getTurnCount` getter:

```ts
import type { EventBus } from '../events/event-bus';
import type { Store } from './create-store';
import type { GameState } from './game-store';

export function createQuestStore(
  bus: EventBus,
  deps: { gameStore: Store<GameState> },
): Store<QuestState> {
  return createStore<QuestState>(
    getDefaultQuestState(),
    ({ newState, oldState }) => {
      const turnNumber = deps.gameStore.getState().turnCount;
      // ... rest of onChange body unchanged, using bus.emit instead of eventBus.emit
    },
  );
}
```

Update singleton:
```ts
export const questStore = createQuestStore(eventBus, { gameStore });
```

Note: This creates an import of `gameStore` from `./game-store` — same as the current code. No new circular dependency.

Test:
```ts
describe('createQuestStore', () => {
  it('uses injected gameStore for turnNumber', () => {
    const bus = mitt<DomainEvents>();
    const mockGameStore = createGameStore(bus);
    mockGameStore.setState((d) => { d.turnCount = 42; });

    const events: unknown[] = [];
    bus.on('quest_started', (e) => events.push(e));

    const store = createQuestStore(bus, { gameStore: mockGameStore });
    store.setState((d) => {
      d.quests['q1'] = {
        status: 'active', currentStageId: null, completedObjectives: [],
        discoveredClues: [], flags: {}, acceptedAt: null, completedAt: null,
      };
    });

    expect(events[0]).toEqual(expect.objectContaining({ turnNumber: 42 }));
  });
});
```

- [ ] **Step 3: Handle cost-session-store (external dep on getRoleConfig)**

`cost-session-store.ts` has `recordUsage` which calls `getRoleConfig` from `../ai/providers`. Keep this as a module-level function. The factory only needs eventBus for the onChange:

```ts
import type { EventBus } from '../events/event-bus';

export function createCostSessionStore(bus: EventBus): Store<CostSessionState> {
  return createStore<CostSessionState>(
    getDefaultState(),
    ({ newState }) => {
      bus.emit('token_usage_updated', { lastTurnTokens: newState.lastTurnTokens });
    },
  );
}

export const costSessionStore = createCostSessionStore(eventBus);
```

Note: `recordUsage` and `getCostSummary` still reference the singleton `costSessionStore` directly. This is acceptable — they are module-level helpers bound to the default store. The factory enables testing with isolated instances.

Also, move the `eventBus.on('state_restored', ...)` listener (line 98) into the factory:

```ts
export function createCostSessionStore(bus: EventBus): Store<CostSessionState> {
  const store = createStore<CostSessionState>(
    getDefaultState(),
    ({ newState }) => {
      bus.emit('token_usage_updated', { lastTurnTokens: newState.lastTurnTokens });
    },
  );
  bus.on('state_restored', () => {
    store.setState((draft) => { draft.byRole = {}; draft.lastTurnTokens = 0; });
  });
  return store;
}
```

- [ ] **Step 4: Run all tests**

Run: `bun test`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/state/*.ts src/state/__tests__/store-factories.test.ts
git commit -m "refactor: add factory functions to all 12 stores with eventBus DI"
```

---

### Task 4: Create GameContext Type and Factory

**Files:**
- Create: `src/context/game-context.ts`
- Create: `src/context/__tests__/game-context.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/context/__tests__/game-context.test.ts
import { describe, it, expect } from 'bun:test';
import { createGameContext } from '../game-context';

describe('createGameContext', () => {
  it('creates a context with all 12 stores', () => {
    const ctx = createGameContext();
    expect(ctx.stores.player).toBeDefined();
    expect(ctx.stores.scene).toBeDefined();
    expect(ctx.stores.game).toBeDefined();
    expect(ctx.stores.combat).toBeDefined();
    expect(ctx.stores.dialogue).toBeDefined();
    expect(ctx.stores.quest).toBeDefined();
    expect(ctx.stores.relation).toBeDefined();
    expect(ctx.stores.exploration).toBeDefined();
    expect(ctx.stores.npcMemory).toBeDefined();
    expect(ctx.stores.playerKnowledge).toBeDefined();
    expect(ctx.stores.branch).toBeDefined();
    expect(ctx.stores.costSession).toBeDefined();
    expect(ctx.eventBus).toBeDefined();
  });

  it('creates isolated instances per call', () => {
    const ctx1 = createGameContext();
    const ctx2 = createGameContext();
    ctx1.stores.player.setState((d) => { d.hp = 1; });
    expect(ctx2.stores.player.getState().hp).toBe(30);
  });

  it('shares eventBus across stores within a context', () => {
    const ctx = createGameContext();
    const events: unknown[] = [];
    ctx.eventBus.on('player_damaged', (e) => events.push(e));
    ctx.stores.player.setState((d) => { d.hp = 20; });
    expect(events).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/context/__tests__/game-context.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement GameContext**

```ts
// src/context/game-context.ts
import mitt from 'mitt';
import type { DomainEvents } from '../events/event-types';
import type { EventBus } from '../events/event-bus';
import type { Store } from '../state/create-store';
import { createPlayerStore, type PlayerState } from '../state/player-store';
import { createSceneStore, type SceneState } from '../state/scene-store';
import { createGameStore, type GameState } from '../state/game-store';
import { createCombatStore, type CombatState } from '../state/combat-store';
import { createDialogueStore, type DialogueState } from '../state/dialogue-store';
import { createQuestStore, type QuestState } from '../state/quest-store';
import { createRelationStore, type RelationState } from '../state/relation-store';
import { createExplorationStore, type ExplorationState } from '../state/exploration-store';
import { createNpcMemoryStore, type NpcMemoryState } from '../state/npc-memory-store';
import { createPlayerKnowledgeStore, type PlayerKnowledgeState } from '../state/player-knowledge-store';
import { createBranchStore, type BranchState } from '../state/branch-store';
import { createCostSessionStore, type CostSessionState } from '../state/cost-session-store';

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
};

export type GameContext = {
  readonly stores: GameStores;
  readonly eventBus: EventBus;
};

export function createGameContext(): GameContext {
  const eventBus: EventBus = mitt<DomainEvents>();

  const gameStore = createGameStore(eventBus);
  const stores: GameStores = {
    player: createPlayerStore(eventBus),
    scene: createSceneStore(eventBus),
    game: gameStore,
    combat: createCombatStore(eventBus),
    dialogue: createDialogueStore(eventBus),
    quest: createQuestStore(eventBus, { gameStore }),
    relation: createRelationStore(eventBus),
    exploration: createExplorationStore(eventBus),
    npcMemory: createNpcMemoryStore(eventBus),
    playerKnowledge: createPlayerKnowledgeStore(eventBus),
    branch: createBranchStore(eventBus),
    costSession: createCostSessionStore(eventBus),
  };

  return { stores, eventBus };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/context/__tests__/game-context.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/context/game-context.ts src/context/__tests__/game-context.test.ts
git commit -m "feat: add GameContext container with createGameContext factory"
```

---

### Task 5: Fix combat_ended Outcome Bug

**Files:**
- Modify: `src/state/combat-store.ts:6-21,38-57`
- Modify: `src/engine/combat-loop.ts:321-340`
- Create: `src/state/__tests__/combat-outcome.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/state/__tests__/combat-outcome.test.ts
import { describe, it, expect } from 'bun:test';
import mitt from 'mitt';
import type { DomainEvents } from '../../events/event-types';
import { createCombatStore } from '../combat-store';

describe('combat_ended outcome', () => {
  it('emits outcome from state instead of hardcoded victory', () => {
    const bus = mitt<DomainEvents>();
    const events: Array<{ outcome: string }> = [];
    bus.on('combat_ended', (e) => events.push(e));

    const store = createCombatStore(bus);
    // Start combat
    store.setState((d) => {
      d.active = true;
      d.enemies = [{ id: 'e1', name: 'Goblin', hp: 10, maxHp: 10 }];
    });
    // End with defeat
    store.setState((d) => {
      d.outcome = 'defeat';
      d.active = false;
    });

    expect(events).toHaveLength(1);
    expect(events[0]!.outcome).toBe('defeat');
  });

  it('emits flee outcome correctly', () => {
    const bus = mitt<DomainEvents>();
    const events: Array<{ outcome: string }> = [];
    bus.on('combat_ended', (e) => events.push(e));

    const store = createCombatStore(bus);
    store.setState((d) => { d.active = true; });
    store.setState((d) => {
      d.outcome = 'flee';
      d.active = false;
    });

    expect(events[0]!.outcome).toBe('flee');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/state/__tests__/combat-outcome.test.ts`
Expected: FAIL — `outcome` property doesn't exist on CombatState

- [ ] **Step 3: Add outcome field to CombatState schema**

In `src/state/combat-store.ts`, add `outcome` to the schema (after line 20, before `guardActive`):

```ts
outcome: z.enum(['victory', 'defeat', 'flee']).nullable(),
```

Add to `getDefaultCombatState()`:
```ts
outcome: null,
```

Update `onChange` handler — replace the hardcoded `'victory'` line:

```ts
// Before (line 47):
eventBus.emit('combat_ended', { outcome: 'victory' });

// After:
bus.emit('combat_ended', { outcome: newState.outcome ?? 'victory' });
```

The `?? 'victory'` fallback ensures backward compatibility if old code sets `active: false` without setting outcome.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/state/__tests__/combat-outcome.test.ts`
Expected: PASS

- [ ] **Step 5: Update combat-loop.ts to set outcome before active:false**

In `src/engine/combat-loop.ts`:

**Victory path** (around line 321-325, in `checkCombatEnd`):
```ts
// Before:
combatStore.setState((d) => { d.active = false; d.phase = 'ended'; });

// After:
combatStore.setState((d) => { d.outcome = 'victory'; d.active = false; d.phase = 'ended'; });
```

**Defeat path** (around line 334-338):
```ts
// Before:
combatStore.setState((d) => { d.active = false; d.phase = 'ended'; });

// After:
combatStore.setState((d) => { d.outcome = 'defeat'; d.active = false; d.phase = 'ended'; });
```

**Flee path** (around line 185-188):
```ts
// Before:
combatStore.setState((d) => { d.active = false; d.phase = 'ended'; });

// After:
combatStore.setState((d) => { d.outcome = 'flee'; d.active = false; d.phase = 'ended'; });
```

Also reset outcome when combat starts (around line 87-97, in `startCombat`):
```ts
combatStore.setState((d) => {
  d.active = true;
  d.outcome = null;
  // ... rest of init
});
```

- [ ] **Step 6: Run all tests**

Run: `bun test`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/state/combat-store.ts src/engine/combat-loop.ts src/state/__tests__/combat-outcome.test.ts
git commit -m "fix: combat_ended event now emits actual outcome instead of hardcoded victory"
```

---

### Task 6: Absorb questEventLog into Quest Store

**Files:**
- Modify: `src/state/quest-store.ts:44-65`
- Create: `src/state/__tests__/quest-event-log.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/state/__tests__/quest-event-log.test.ts
import { describe, it, expect } from 'bun:test';
import mitt from 'mitt';
import type { DomainEvents } from '../../events/event-types';
import { createQuestStore } from '../quest-store';
import { createGameStore } from '../game-store';

describe('questEventLog in store', () => {
  it('appends events into store state', () => {
    const bus = mitt<DomainEvents>();
    const gameStore = createGameStore(bus);
    const store = createQuestStore(bus, { gameStore });

    store.setState((d) => {
      d.eventLog = [
        ...d.eventLog,
        {
          id: 'e1',
          questId: 'q1',
          type: 'quest_started',
          turnNumber: 1,
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      ];
    });

    expect(store.getState().eventLog).toHaveLength(1);
    expect(store.getState().eventLog[0]!.questId).toBe('q1');
  });

  it('is isolated per store instance', () => {
    const bus = mitt<DomainEvents>();
    const gameStore = createGameStore(bus);
    const store1 = createQuestStore(bus, { gameStore });
    const store2 = createQuestStore(bus, { gameStore });

    store1.setState((d) => {
      d.eventLog = [{
        id: 'e1', questId: 'q1', type: 'quest_started',
        turnNumber: 1, timestamp: '',
      }];
    });

    expect(store2.getState().eventLog).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/state/__tests__/quest-event-log.test.ts`
Expected: FAIL — `eventLog` not in QuestState

- [ ] **Step 3: Add eventLog to QuestState and update functions**

In `src/state/quest-store.ts`:

Add `eventLog` to the schema:
```ts
export const QuestStateSchema = z.object({
  quests: z.record(z.string(), QuestProgressSchema),
  eventLog: z.array(QuestEventSchema),
});
```

Update default state:
```ts
export function getDefaultQuestState(): QuestState {
  return { quests: {}, eventLog: [] };
}
```

Update `appendQuestEvent` to use the store instead of module variable:
```ts
// Keep the module-level variable for backward compat during migration
export let questEventLog: QuestEvent[] = [];

export function appendQuestEvent(
  event: Omit<QuestEvent, 'id' | 'timestamp'>,
): void {
  const newEvent = {
    ...event,
    id: nanoid(),
    timestamp: new Date().toISOString(),
  };
  // Write to both: store (new) and module var (legacy compat)
  questStore.setState((d) => {
    d.eventLog = [...d.eventLog, newEvent];
  });
  questEventLog = [...questEventLog, newEvent];
}

export function resetQuestEventLog(): void {
  questEventLog = [];
  questStore.setState((d) => { d.eventLog = []; });
}

export function restoreQuestEventLog(events: QuestEvent[]): void {
  questEventLog = [...events];
  questStore.setState((d) => { d.eventLog = [...events]; });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/state/__tests__/quest-event-log.test.ts`
Expected: PASS

- [ ] **Step 5: Run all tests**

Run: `bun test`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/state/quest-store.ts src/state/__tests__/quest-event-log.test.ts
git commit -m "refactor: absorb questEventLog into QuestState store"
```

---

### Task 7: Create Turn-Log Store

**Files:**
- Create: `src/state/turn-log-store.ts`
- Create: `src/state/__tests__/turn-log-store.test.ts`
- Modify: `src/engine/turn-log.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/state/__tests__/turn-log-store.test.ts
import { describe, it, expect } from 'bun:test';
import mitt from 'mitt';
import type { DomainEvents } from '../../events/event-types';
import { createTurnLogStore, MAX_TURN_LOG_SIZE } from '../turn-log-store';

describe('TurnLogStore', () => {
  it('appends entries to store state', () => {
    const bus = mitt<DomainEvents>();
    const store = createTurnLogStore(bus);

    store.setState((d) => {
      d.entries = [...d.entries, {
        turnNumber: 1,
        action: 'look',
        checkResult: null,
        narrationLines: ['You look around.'],
        timestamp: '2026-01-01T00:00:00.000Z',
      }];
    });

    expect(store.getState().entries).toHaveLength(1);
  });

  it('is capped at MAX_TURN_LOG_SIZE', () => {
    const bus = mitt<DomainEvents>();
    const store = createTurnLogStore(bus);

    const entries = Array.from({ length: MAX_TURN_LOG_SIZE + 10 }, (_, i) => ({
      turnNumber: i,
      action: 'look',
      checkResult: null,
      narrationLines: [],
      timestamp: '',
    }));

    store.setState((d) => { d.entries = entries; });
    // Cap is enforced by consumers, not the store itself
    expect(store.getState().entries.length).toBe(MAX_TURN_LOG_SIZE + 10);
  });

  it('is isolated per instance', () => {
    const bus = mitt<DomainEvents>();
    const s1 = createTurnLogStore(bus);
    const s2 = createTurnLogStore(bus);

    s1.setState((d) => {
      d.entries = [{ turnNumber: 1, action: 'look', checkResult: null, narrationLines: [], timestamp: '' }];
    });

    expect(s2.getState().entries).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/state/__tests__/turn-log-store.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement turn-log-store.ts**

```ts
// src/state/turn-log-store.ts
import { z } from 'zod';
import { createStore, type Store } from './create-store';
import type { EventBus } from '../events/event-bus';
import { TurnLogEntrySchema } from './serializer';

export const MAX_TURN_LOG_SIZE = 50;

export const TurnLogStateSchema = z.object({
  entries: z.array(TurnLogEntrySchema),
});
export type TurnLogState = z.infer<typeof TurnLogStateSchema>;

export function getDefaultTurnLogState(): TurnLogState {
  return { entries: [] };
}

export function createTurnLogStore(bus: EventBus): Store<TurnLogState> {
  return createStore<TurnLogState>(getDefaultTurnLogState());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/state/__tests__/turn-log-store.test.ts`
Expected: PASS

- [ ] **Step 5: Update src/engine/turn-log.ts to delegate to store**

Make `turn-log.ts` a thin wrapper that delegates to a store instance. Import the default singleton for backward compat:

```ts
// src/engine/turn-log.ts
import type { TurnLogEntry } from '../state/serializer';
import { createTurnLogStore, MAX_TURN_LOG_SIZE, type TurnLogState } from '../state/turn-log-store';
import { eventBus } from '../events/event-bus';
import type { Store } from '../state/create-store';

const defaultStore = createTurnLogStore(eventBus);

// Legacy module-level variable kept for backward compat during migration
let turnLog: TurnLogEntry[] = [];

export function appendTurnLog(entry: Omit<TurnLogEntry, 'timestamp'>): void {
  const fullEntry: TurnLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  turnLog = [...turnLog, fullEntry];
  if (turnLog.length > MAX_TURN_LOG_SIZE) {
    turnLog = turnLog.slice(turnLog.length - MAX_TURN_LOG_SIZE);
  }
  // Also write to store
  defaultStore.setState((d) => {
    d.entries = [...d.entries, fullEntry].slice(-MAX_TURN_LOG_SIZE);
  });
}

export function getTurnLog(): readonly TurnLogEntry[] {
  return turnLog.map(e => ({ ...e }));
}

export function replayTurns(count: number): readonly TurnLogEntry[] {
  const start = Math.max(0, turnLog.length - count);
  return turnLog.slice(start).map(e => ({ ...e }));
}

export function resetTurnLog(): void {
  turnLog = [];
  defaultStore.setState((d) => { d.entries = []; });
}

export function restoreTurnLog(entries: readonly TurnLogEntry[]): void {
  turnLog = [...entries].slice(-MAX_TURN_LOG_SIZE);
  defaultStore.setState((d) => { d.entries = [...entries].slice(-MAX_TURN_LOG_SIZE); });
}

export { defaultStore as turnLogStore };
```

- [ ] **Step 6: Run all tests**

Run: `bun test`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/state/turn-log-store.ts src/state/__tests__/turn-log-store.test.ts src/engine/turn-log.ts
git commit -m "refactor: create TurnLogStore and delegate from turn-log module"
```

---

### Task 8: Add TurnLog Store to GameContext

**Files:**
- Modify: `src/context/game-context.ts`
- Modify: `src/context/__tests__/game-context.test.ts`

- [ ] **Step 1: Update GameContext to include turnLog store**

In `src/context/game-context.ts`, add:

```ts
import { createTurnLogStore, type TurnLogState } from '../state/turn-log-store';
```

Add to `GameStores`:
```ts
readonly turnLog: Store<TurnLogState>;
```

Add to `createGameContext`:
```ts
turnLog: createTurnLogStore(eventBus),
```

- [ ] **Step 2: Update test**

In `game-context.test.ts`, add:
```ts
expect(ctx.stores.turnLog).toBeDefined();
```

- [ ] **Step 3: Run tests**

Run: `bun test src/context/__tests__/game-context.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/context/game-context.ts src/context/__tests__/game-context.test.ts
git commit -m "refactor: add turnLog store to GameContext"
```

---

### Task 9: Update Serializer to Use Store-Based Logs

**Files:**
- Modify: `src/state/serializer.ts:89-178`

- [ ] **Step 1: Update createSerializer signature**

Replace the `getQuestEventLog` and `getTurnLog` function params with store reads. The serializer already receives `stores` — extend it:

```ts
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
): Serializer {
```

Add import at top:
```ts
import type { TurnLogState } from './turn-log-store';
```

- [ ] **Step 2: Update snapshot() to read from stores**

```ts
snapshot(): string {
  // ... existing code ...
  const data: SaveDataV4 = {
    // ... existing fields ...
    questEventLog: stores.quest.getState().eventLog,
    turnLog: stores.turnLog.getState().entries,
  };
  return JSON.stringify(data);
},
```

Remove the `getQuestEventLog` and `getTurnLog` params from the function signature.

- [ ] **Step 3: Update restore() to write to stores**

Replace the module-level function calls:

```ts
// Before:
resetQuestEventLog();
restoreQuestEventLog(data.questEventLog);
resetTurnLog();
restoreTurnLogEntries(data.turnLog);

// After:
stores.quest.setState((draft) => { draft.eventLog = data.questEventLog; });
stores.turnLog.setState((draft) => { draft.entries = data.turnLog; });
```

Remove the imports of `resetQuestEventLog`, `restoreQuestEventLog`, `resetTurnLog`, `restoreTurnLogEntries`.

- [ ] **Step 4: Update all callers of createSerializer**

Search for `createSerializer(` across the codebase and update the call signatures. The main caller is in `app.tsx` or `game-loop.ts` — remove the function params and add `turnLog` to the stores object.

- [ ] **Step 5: Run all tests**

Run: `bun test`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/state/serializer.ts src/game-loop.ts src/app.tsx
git commit -m "refactor: serializer reads questEventLog and turnLog from stores"
```

---

### Task 10: DI for combat-loop

**Files:**
- Modify: `src/engine/combat-loop.ts:1-10,53`

- [ ] **Step 1: Update createCombatLoop signature**

Replace singleton imports with parameter injection:

```ts
// Remove these imports:
// import { combatStore } from '../state/combat-store';
// import { playerStore } from '../state/player-store';
// import { gameStore } from '../state/game-store';

// Add:
import type { Store } from '../state/create-store';
import type { CombatState } from '../state/combat-store';
import type { PlayerState } from '../state/player-store';
import type { GameState } from '../state/game-store';

export function createCombatLoop(
  stores: {
    combat: Store<CombatState>;
    player: Store<PlayerState>;
    game: Store<GameState>;
  },
  codexEntries: Map<string, CodexEntry>,
  options?: CombatLoopOptions,
): CombatLoop {
```

- [ ] **Step 2: Replace all combatStore/playerStore/gameStore references with stores.combat/stores.player/stores.game**

This is a mechanical find-and-replace within the file:
- `combatStore` → `stores.combat`
- `playerStore` → `stores.player`
- `gameStore` → `stores.game`

- [ ] **Step 3: Run all tests**

Run: `bun test`
Expected: May FAIL if callers still use old signature — fix callers (game-loop.ts, app.tsx) to pass stores.

- [ ] **Step 4: Update callers**

In `game-loop.ts` (or wherever `createCombatLoop` is called), update:

```ts
// Before:
const combatLoop = createCombatLoop(codexEntries, options);

// After:
const combatLoop = createCombatLoop(
  { combat: combatStore, player: playerStore, game: gameStore },
  codexEntries,
  options,
);
```

- [ ] **Step 5: Run all tests**

Run: `bun test`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/engine/combat-loop.ts src/game-loop.ts
git commit -m "refactor: combat-loop accepts stores via DI instead of importing singletons"
```

---

### Task 11: DI for dialogue-manager

**Files:**
- Modify: `src/engine/dialogue-manager.ts:1-10,91`

- [ ] **Step 1: Update createDialogueManager signature**

Replace 6 singleton imports with parameter injection:

```ts
// Remove:
// import { dialogueStore, getDefaultDialogueState } from '../state/dialogue-store';
// import { npcMemoryStore } from '../state/npc-memory-store';
// import { sceneStore } from '../state/scene-store';
// import { gameStore } from '../state/game-store';
// import { playerStore } from '../state/player-store';
// import { relationStore, getDefaultNpcDisposition } from '../state/relation-store';

// Add:
import type { Store } from '../state/create-store';
import type { DialogueState } from '../state/dialogue-store';
import { getDefaultDialogueState } from '../state/dialogue-store';
import type { NpcMemoryState } from '../state/npc-memory-store';
import type { SceneState } from '../state/scene-store';
import type { GameState } from '../state/game-store';
import type { PlayerState } from '../state/player-store';
import type { RelationState } from '../state/relation-store';
import { getDefaultNpcDisposition } from '../state/relation-store';

export function createDialogueManager(
  stores: {
    dialogue: Store<DialogueState>;
    npcMemory: Store<NpcMemoryState>;
    scene: Store<SceneState>;
    game: Store<GameState>;
    player: Store<PlayerState>;
    relation: Store<RelationState>;
  },
  codexEntries: Map<string, CodexEntry>,
  options?: DialogueManagerOptions,
): DialogueManager {
```

- [ ] **Step 2: Replace all store references with stores.xxx**

Mechanical find-and-replace:
- `dialogueStore` → `stores.dialogue`
- `npcMemoryStore` → `stores.npcMemory`
- `sceneStore` → `stores.scene`
- `gameStore` → `stores.game`
- `playerStore` → `stores.player`
- `relationStore` → `stores.relation`

- [ ] **Step 3: Update callers and run tests**

Update wherever `createDialogueManager` is called. Run `bun test`. Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add src/engine/dialogue-manager.ts src/game-loop.ts
git commit -m "refactor: dialogue-manager accepts stores via DI instead of importing singletons"
```

---

### Task 12: DI for Remaining Engine Modules

**Files:**
- Modify: `src/engine/scene-manager.ts`
- Modify: `src/engine/quest-system.ts`
- Modify: `src/engine/exploration-tracker.ts`
- Modify: `src/engine/knowledge-tracker.ts`

Apply the same DI pattern to each:

- [ ] **Step 1: scene-manager — inject sceneStore**

```ts
export function createSceneManager(
  stores: { scene: Store<SceneState> },
  codexEntries: Map<string, CodexEntry>,
  options?: SceneManagerOptions,
): SceneManager {
```

Replace `sceneStore` → `stores.scene`. Remove unused `eventBus` import (it was imported but never used).

- [ ] **Step 2: quest-system — inject questStore, relationStore, gameStore**

```ts
export function createQuestSystem(
  stores: {
    quest: Store<QuestState>;
    relation: Store<RelationState>;
    game: Store<GameState>;
  },
  codexEntries: Map<string, CodexEntry>,
): QuestSystem {
```

Replace `questStore` → `stores.quest`, `relationStore` → `stores.relation`, `gameStore` → `stores.game`.

Note: `appendQuestEvent` is a module-level function that writes to the singleton. For now, keep importing it — it will be removed when we fully eliminate the module-level `questEventLog` variable (post-migration cleanup).

- [ ] **Step 3: exploration-tracker — inject explorationStore, gameStore, eventBus**

```ts
export function initExplorationTracker(
  stores: { exploration: Store<ExplorationState>; game: Store<GameState> },
  eventBus: EventBus,
): () => void {
```

Replace `explorationStore` → `stores.exploration`, `gameStore` → `stores.game`.

- [ ] **Step 4: knowledge-tracker — inject playerKnowledgeStore, gameStore, eventBus**

```ts
export function initKnowledgeTracker(
  stores: { playerKnowledge: Store<PlayerKnowledgeState>; game: Store<GameState> },
  eventBus: EventBus,
): () => void {
```

Replace `playerKnowledgeStore` → `stores.playerKnowledge`, `gameStore` → `stores.game`.

- [ ] **Step 5: Update all callers**

Update `game-loop.ts` / `app.tsx` to pass stores to each factory.

- [ ] **Step 6: Run all tests**

Run: `bun test`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/engine/scene-manager.ts src/engine/quest-system.ts src/engine/exploration-tracker.ts src/engine/knowledge-tracker.ts src/game-loop.ts src/app.tsx
git commit -m "refactor: remaining engine modules accept stores via DI"
```

---

### Task 13: DI for game-loop

**Files:**
- Modify: `src/game-loop.ts:1-30`

- [ ] **Step 1: Update createGameLoop to accept stores**

```ts
// Remove singleton imports:
// import { playerStore } from './state/player-store';
// import { sceneStore } from './state/scene-store';
// import { gameStore } from './state/game-store';
// import { combatStore } from './state/combat-store';
// import { getCostSummary } from './state/cost-session-store';

// Add:
import type { Store } from './state/create-store';
import type { PlayerState } from './state/player-store';
import type { SceneState } from './state/scene-store';
import type { GameState } from './state/game-store';
import type { CombatState } from './state/combat-store';
import type { CostSessionState } from './state/cost-session-store';

export type GameLoopStores = {
  player: Store<PlayerState>;
  scene: Store<SceneState>;
  game: Store<GameState>;
  combat: Store<CombatState>;
  costSession: Store<CostSessionState>;
};

export function createGameLoop(
  stores: GameLoopStores,
  options?: GameLoopOptions,
): GameLoop {
```

- [ ] **Step 2: Replace all singleton references**

- `playerStore` → `stores.player`
- `sceneStore` → `stores.scene`
- `gameStore` → `stores.game`
- `combatStore` → `stores.combat`
- `getCostSummary()` → build from `stores.costSession.getState()` (or keep importing `getCostSummary` as a utility since it's a pure read function)

For `getCostSummary`, since it's a stateless computation, keep importing it. The critical DI is for the stores themselves.

Replace `eventBus` import with parameter injection:

```ts
export function createGameLoop(
  stores: GameLoopStores,
  eventBus: EventBus,
  options?: GameLoopOptions,
): GameLoop {
```

- [ ] **Step 3: Update callers (app.tsx)**

```ts
const gameLoop = useMemo(
  () => createGameLoop(
    {
      player: playerStore,
      scene: sceneStore,
      game: gameStore,
      combat: combatStore,
      costSession: costSessionStore,
    },
    eventBus,
  ),
  [],
);
```

- [ ] **Step 4: Run all tests**

Run: `bun test`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/game-loop.ts src/app.tsx
git commit -m "refactor: game-loop accepts stores and eventBus via DI"
```

---

### Task 14: Wire GameContext Through app.tsx

**Files:**
- Modify: `src/app.tsx`

This is the final integration task. All engine modules now accept stores via DI. Wire them through a `GameContext` created in app.tsx.

- [ ] **Step 1: Create GameContext in app.tsx**

For now, use the default singletons to create a context-like object (not `createGameContext()` yet, since existing code still uses singletons via React contexts):

```ts
import type { GameContext } from './context/game-context';

// Build a GameContext from existing singletons (bridge during migration)
const defaultGameContext: GameContext = {
  stores: {
    player: playerStore,
    scene: sceneStore,
    game: gameStore,
    combat: combatStore,
    dialogue: dialogueStore,
    quest: questStore,
    relation: relationStore,
    exploration: explorationStore,
    npcMemory: npcMemoryStore,
    playerKnowledge: playerKnowledgeStore,
    branch: branchStore,
    costSession: costSessionStore,
    turnLog: turnLogStore,
  },
  eventBus,
};
```

- [ ] **Step 2: Thread context into engine module creation**

Update `useMemo` calls to use `defaultGameContext.stores`:

```ts
const gameLoop = useMemo(
  () => createGameLoop(
    {
      player: defaultGameContext.stores.player,
      scene: defaultGameContext.stores.scene,
      game: defaultGameContext.stores.game,
      combat: defaultGameContext.stores.combat,
      costSession: defaultGameContext.stores.costSession,
    },
    defaultGameContext.eventBus,
  ),
  [],
);
```

This is mechanically identical to the previous state but establishes the `GameContext` as the single source of truth for store references.

- [ ] **Step 3: Add missing store imports to app.tsx**

Import stores that aren't currently imported:

```ts
import { explorationStore } from './state/exploration-store';
import { npcMemoryStore } from './state/npc-memory-store';
import { playerKnowledgeStore } from './state/player-knowledge-store';
import { relationStore } from './state/relation-store';
import { branchStore } from './state/branch-store';
import { costSessionStore } from './state/cost-session-store';
import { turnLogStore } from './engine/turn-log';
```

- [ ] **Step 4: Run all tests**

Run: `bun test`
Expected: All PASS

- [ ] **Step 5: Run type check**

Run: `bunx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/app.tsx
git commit -m "refactor: wire GameContext through app.tsx as single source of store references"
```

---

## Verification Checklist

After all tasks complete, verify:

- [ ] `createGameContext()` creates fully isolated store instances (test exists)
- [ ] All 12 stores export factory functions that accept `EventBus`
- [ ] `combat_ended` event emits actual outcome (`victory`/`defeat`/`flee`)
- [ ] `questEventLog` lives inside `QuestState.eventLog`
- [ ] `turnLog` lives inside `TurnLogState.entries`
- [ ] Serializer reads/writes logs from stores, not module-level variables
- [ ] All engine factories (`createCombatLoop`, `createDialogueManager`, `createSceneManager`, `createQuestSystem`) accept stores via parameters
- [ ] `createGameLoop` accepts stores + eventBus via parameters
- [ ] No singleton store imports remain in engine layer (except backward-compat wrappers)
- [ ] All existing tests still pass
- [ ] `bunx tsc --noEmit` passes
