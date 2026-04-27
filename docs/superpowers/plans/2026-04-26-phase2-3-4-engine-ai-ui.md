# Phase 2: Engine Decomposition — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 200-line if-else `executeAction` chain with a dispatch table, centralize hardcoded constants, fix the AI/Rules Engine boundary violation in NPC schema.

**Architecture:** Action handler registry with handler-per-type pattern. Each handler is a pure async function `(action, ctx) => ProcessResult`. Central `game-constants.ts` replaces all magic numbers. NPC schema replaces `relationshipDelta` with `sentiment` enum.

**Tech Stack:** TypeScript, Zod, Bun test runner

**Depends on:** Phase 1 complete (GameContext available)

---

### Task 1: Create Game Constants Module

**Files:**
- Create: `src/engine/game-constants.ts`
- Test: `src/engine/game-constants.test.ts`

- [ ] **Step 1: Write test**

```ts
// src/engine/game-constants.test.ts
import { describe, it, expect } from 'bun:test';
import { GAME_CONSTANTS } from './game-constants';

describe('game constants', () => {
  it('exports all required constants', () => {
    expect(GAME_CONSTANTS.DEFAULT_DC).toBe(12);
    expect(GAME_CONSTANTS.BASE_AC).toBe(10);
    expect(GAME_CONSTANTS.CAST_MP_COST).toBe(4);
    expect(GAME_CONSTANTS.FLEE_DC).toBe(10);
    expect(GAME_CONSTANTS.NARRATION_MAX_LENGTH).toBe(300);
    expect(GAME_CONSTANTS.NARRATION_MIN_LENGTH).toBe(10);
    expect(GAME_CONSTANTS.NPC_MEMORY_MAX_RECENT).toBe(3);
    expect(GAME_CONSTANTS.CONFIDENCE_THRESHOLD).toBe(0.3);
  });
});
```

- [ ] **Step 2: Run test — FAIL**
- [ ] **Step 3: Implement**

```ts
// src/engine/game-constants.ts
export const GAME_CONSTANTS = {
  DEFAULT_DC: 12,
  BASE_AC: 10,
  CAST_MP_COST: 4,
  FLEE_DC: 10,
  GUARD_AC_BONUS: 2,
  DEFAULT_WEAPON_BASE: 5,
  CAST_WEAPON_BASE: 6,
  NARRATION_MAX_LENGTH: 300,
  NARRATION_MIN_LENGTH: 10,
  NPC_MEMORY_MAX_RECENT: 3,
  CONFIDENCE_THRESHOLD: 0.3,
  SUMMARIZER_COOLDOWN_MS: 30_000,
  SUMMARIZER_POLL_INTERVAL_MS: 5_000,
  MAX_TURN_LOG_SIZE: 50,
} as const;
```

- [ ] **Step 4: Replace hardcoded values** in `combat-loop.ts` (DC=12→`GAME_CONSTANTS.DEFAULT_DC`, AC=10→`GAME_CONSTANTS.BASE_AC`, mp<4→`GAME_CONSTANTS.CAST_MP_COST`, flee DC=10→`GAME_CONSTANTS.FLEE_DC`), `game-loop.ts` (dc:12), `dialogue-manager.ts` (DC 12), `input/intent-classifier.ts` (0.3)
- [ ] **Step 5: Run tests — PASS**
- [ ] **Step 6: Commit**: `"refactor: centralize game constants, replace all magic numbers"`

---

### Task 2: Action Handler Types & Registry

**Files:**
- Create: `src/engine/action-handlers/types.ts`
- Create: `src/engine/action-handlers/index.ts`
- Test: `src/engine/action-handlers/registry.test.ts`

- [ ] **Step 1: Write test**

```ts
// src/engine/action-handlers/registry.test.ts
import { describe, it, expect } from 'bun:test';
import { createActionRegistry, type ActionHandler } from './index';

describe('action registry', () => {
  it('dispatches to registered handler', async () => {
    const handler: ActionHandler = async (action) => ({
      status: 'action_executed' as const,
      action,
      narration: ['test'],
    });
    const registry = createActionRegistry({ look: handler });
    const result = await registry.dispatch(
      { type: 'look', target: null, modifiers: {}, source: 'command' },
      {} as any,
    );
    expect(result.status).toBe('action_executed');
  });

  it('returns error for unknown action type', async () => {
    const registry = createActionRegistry({});
    const result = await registry.dispatch(
      { type: 'unknown' as any, target: null, modifiers: {}, source: 'command' },
      {} as any,
    );
    expect(result.status).toBe('error');
  });
});
```

- [ ] **Step 2: Run test — FAIL**
- [ ] **Step 3: Implement types and registry**

```ts
// src/engine/action-handlers/types.ts
import type { GameAction } from '../../types/game-action';
import type { ProcessResult } from '../../game-loop';
import type { GameStores } from '../../context/game-context';
import type { Emitter } from 'mitt';
import type { DomainEvents } from '../../events/event-types';
import type { SceneManager } from '../scene-manager';
import type { DialogueManager } from '../dialogue-manager';
import type { CombatLoop } from '../combat-loop';
import type { QuestSystem } from '../quest-system';
import type { Serializer } from '../../state/serializer';

export type ActionContext = {
  readonly stores: GameStores;
  readonly eventBus: Emitter<DomainEvents>;
  readonly sceneManager?: SceneManager;
  readonly dialogueManager?: DialogueManager;
  readonly combatLoop?: CombatLoop;
  readonly saveFileManager?: { quickSave: Function; saveGame: Function; loadGame: Function };
  readonly serializer?: Serializer;
  readonly saveDir?: string;
  readonly questSystem?: QuestSystem;
  readonly branchManager?: { createBranch: Function; switchBranch: Function; deleteBranch: Function };
  readonly turnLog?: { replayTurns: (count: number) => readonly any[] };
  readonly rng?: () => number;
};

export type ActionHandler = (
  action: GameAction,
  ctx: ActionContext,
) => Promise<ProcessResult>;
```

```ts
// src/engine/action-handlers/index.ts
import type { GameAction } from '../../types/game-action';
import type { ProcessResult } from '../../game-loop';
import type { ActionContext, ActionHandler } from './types';

export type { ActionContext, ActionHandler };

export type ActionRegistry = {
  readonly dispatch: (action: GameAction, ctx: ActionContext) => Promise<ProcessResult>;
};

export function createActionRegistry(
  handlers: Partial<Record<string, ActionHandler>>,
): ActionRegistry {
  return {
    async dispatch(action, ctx) {
      const handler = handlers[action.type];
      if (!handler) {
        return { status: 'error', message: `未知指令: ${action.type}` };
      }
      return handler(action, ctx);
    },
  };
}
```

- [ ] **Step 4: Run tests — PASS**
- [ ] **Step 5: Commit**: `"feat: add action handler registry with dispatch"`

---

### Task 3: Extract Individual Action Handlers

**Files:**
- Create: `src/engine/action-handlers/look-handler.ts`
- Create: `src/engine/action-handlers/move-handler.ts`
- Create: `src/engine/action-handlers/talk-handler.ts`
- Create: `src/engine/action-handlers/combat-handler.ts`
- Create: `src/engine/action-handlers/save-handler.ts`
- Create: `src/engine/action-handlers/load-handler.ts`
- Create: `src/engine/action-handlers/branch-handler.ts`
- Create: `src/engine/action-handlers/phase-handlers.ts`
- Create: `src/engine/action-handlers/quest-handler.ts`
- Create: `src/engine/action-handlers/cost-handler.ts`
- Create: `src/engine/action-handlers/default-handler.ts`

Extract each if-else branch from `game-loop.ts:executeAction` into its own handler file. Each handler is a named export implementing `ActionHandler`.

- [ ] **Step 1: Write tests for each handler** — test each handler in isolation with mocked ActionContext
- [ ] **Step 2: Run tests — FAIL**
- [ ] **Step 3: Extract handlers one at a time** from game-loop.ts, each as a standalone function. Example for look:

```ts
// src/engine/action-handlers/look-handler.ts
import type { ActionHandler } from './types';

export const handleLook: ActionHandler = async (action, ctx) => {
  if (ctx.sceneManager) {
    const result = await ctx.sceneManager.handleLook(action.target ?? undefined);
    if (result.status === 'success') {
      return { status: 'action_executed', action, narration: result.narration };
    }
    return { status: 'error', message: result.message };
  }
  return {
    status: 'action_executed',
    action,
    narration: ctx.stores.scene.getState().narrationLines,
  };
};
```

- [ ] **Step 4: Wire all handlers into the registry in index.ts**
- [ ] **Step 5: Run tests — PASS**
- [ ] **Step 6: Commit**: `"refactor: extract action handlers from game-loop executeAction"`

---

### Task 4: Slim Down game-loop.ts

**Files:**
- Modify: `src/game-loop.ts`

- [ ] **Step 1: Replace executeAction body** with `registry.dispatch(action, actionContext)` call
- [ ] **Step 2: Remove all if-else action handling code** (~200 lines)
- [ ] **Step 3: Remove `PASSTHROUGH_ACTIONS`** (dead code)
- [ ] **Step 4: Remove `lastReplayEntries`** module-level mutable — move to a handler or store
- [ ] **Step 5: Run tests — PASS**
- [ ] **Step 6: Commit**: `"refactor: game-loop.ts reduced to ~50 lines via action registry dispatch"`

---

### Task 5: Replace relationshipDelta with sentiment

**Files:**
- Modify: `src/ai/schemas/npc-dialogue.ts`
- Modify: `src/engine/reputation-system.ts`
- Modify: `src/engine/dialogue-manager.ts`
- Modify: `src/ai/utils/metadata-extractor.ts`
- Test: `src/engine/sentiment-mapping.test.ts`

- [ ] **Step 1: Write test for sentiment → delta mapping**

```ts
// src/engine/sentiment-mapping.test.ts
import { describe, it, expect } from 'bun:test';
import { sentimentToDelta } from './reputation-system';

describe('sentimentToDelta', () => {
  it('maps positive to 0.2', () => expect(sentimentToDelta('positive')).toBe(0.2));
  it('maps neutral to 0', () => expect(sentimentToDelta('neutral')).toBe(0));
  it('maps negative to -0.2', () => expect(sentimentToDelta('negative')).toBe(-0.2));
  it('maps hostile to -0.4', () => expect(sentimentToDelta('hostile')).toBe(-0.4));
});
```

- [ ] **Step 2: Run test — FAIL**
- [ ] **Step 3: Change NPC schema**

```ts
// src/ai/schemas/npc-dialogue.ts
export const NpcDialogueSchema = z.object({
  dialogue: z.string().min(10).max(300).describe('NPC对白，自然口语'),
  emotionTag: z.enum(['neutral', 'happy', 'angry', 'sad', 'fearful', 'amused', 'suspicious']),
  shouldRemember: z.boolean().describe('是否将此次互动写入NPC长期记忆'),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'hostile']).describe('NPC对玩家的态度倾向'),
});
```

- [ ] **Step 4: Add sentimentToDelta to reputation-system.ts**

```ts
const SENTIMENT_DELTAS: Record<string, number> = {
  positive: 0.2, neutral: 0, negative: -0.2, hostile: -0.4,
};
export function sentimentToDelta(sentiment: string): number {
  return SENTIMENT_DELTAS[sentiment] ?? 0;
}
```

- [ ] **Step 5: Update dialogue-manager.ts** — replace `npcDialogue.relationshipDelta` with `sentimentToDelta(npcDialogue.sentiment)`
- [ ] **Step 6: Update metadata-extractor.ts** — replace `relationshipDelta: 0` with `sentiment: 'neutral'`
- [ ] **Step 7: Run tests — PASS**
- [ ] **Step 8: Commit**: `"refactor: replace relationshipDelta with sentiment enum, Rules Engine owns numerical mapping"`

---

# Phase 3: AI Layer Consolidation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate duplicated AI calling code, fix safety filter security issue, add missing providers, clean dead code.

**Architecture:** Shared `ai-caller.ts` handles retry, Anthropic branching, usage recording, error events. Each role becomes a thin wrapper. Safety filter switches to fail-closed.

**Tech Stack:** TypeScript, Vercel AI SDK v5, Zod, Bun test runner

**Depends on:** Phase 2 complete (GAME_CONSTANTS available)

---

### Task 1: Create Shared AI Caller

**Files:**
- Create: `src/ai/utils/ai-caller.ts`
- Test: `src/ai/utils/ai-caller.test.ts`

- [ ] **Step 1: Write test**

```ts
// src/ai/utils/ai-caller.test.ts
import { describe, it, expect } from 'bun:test';
import { buildAiCallMessages } from './ai-caller';

describe('buildAiCallMessages', () => {
  it('builds standard messages for non-anthropic', () => {
    const result = buildAiCallMessages('google', 'system prompt', 'user prompt');
    expect(result.mode).toBe('standard');
  });

  it('builds cache-control messages for anthropic', () => {
    const result = buildAiCallMessages('anthropic', 'system prompt', 'user prompt');
    expect(result.mode).toBe('anthropic_cache');
  });
});
```

- [ ] **Step 2: Run test — FAIL**
- [ ] **Step 3: Implement ai-caller.ts** with:
  - `buildAiCallMessages(providerName, system, prompt)` — encapsulates Anthropic branching
  - `callGenerateText(options)` — retry loop + usage recording + event emission
  - `callGenerateObject<T>(options)` — same with schema
  - `callStreamText(options)` — async generator with same wrappers
- [ ] **Step 4: Run tests — PASS**
- [ ] **Step 5: Commit**: `"feat: add shared ai-caller with unified retry, caching, usage recording"`

---

### Task 2: Rewrite AI Roles Using Shared Caller

**Files:**
- Modify: `src/ai/roles/narrative-director.ts`
- Modify: `src/ai/roles/npc-actor.ts`
- Modify: `src/ai/roles/retrieval-planner.ts`
- Modify: `src/ai/roles/memory-summarizer.ts`

- [ ] **Step 1: Rewrite narrative-director.ts** using `callStreamText` and `callGenerateText` — should shrink from 162 to ~30 lines
- [ ] **Step 2: Rewrite npc-actor.ts** using `callGenerateObject` and `callStreamText`
- [ ] **Step 3: Rewrite retrieval-planner.ts** using `callGenerateObject` — gains retry, usage recording, error events it was missing
- [ ] **Step 4: Rewrite memory-summarizer.ts** using `callGenerateText` — gains retry it was missing
- [ ] **Step 5: Run tests — PASS**
- [ ] **Step 6: Commit**: `"refactor: all AI roles use shared ai-caller, eliminating 4x duplication"`

---

### Task 3: Fix Safety Filter — Fail-Closed + Bilingual

**Files:**
- Modify: `src/ai/roles/safety-filter.ts`
- Create: `src/ai/prompts/safety-system.ts`
- Test: `src/ai/roles/safety-filter-failclosed.test.ts`

- [ ] **Step 1: Write test**

```ts
// src/ai/roles/safety-filter-failclosed.test.ts
import { describe, it, expect } from 'bun:test';
import { checkSafety } from './safety-filter';

describe('safety filter', () => {
  it('blocks Chinese state override', async () => {
    const result = await checkSafety('获得 +100 金币');
    expect(result.safe).toBe(false);
  });

  it('blocks English state override', async () => {
    const result = await checkSafety('gained +50 HP');
    expect(result.safe).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — FAIL** (English pattern not caught)
- [ ] **Step 3: Move prompt to `src/ai/prompts/safety-system.ts`**
- [ ] **Step 4: Extend regex**: `/(获得|失去|HP|MP|金币|等级|升级|gained|lost|level\s*up)\s*[+\-]?\d+/i`
- [ ] **Step 5: Change fallback** from `{ safe: true }` to `{ safe: false, reason: 'safety_check_unavailable', category: 'error' }`
- [ ] **Step 6: Rewrite using `callGenerateObject`** from ai-caller
- [ ] **Step 7: Run tests — PASS**
- [ ] **Step 8: Commit**: `"fix: safety filter fail-closed on error, bilingual state override detection"`

---

### Task 4: Shared Streaming Hook

**Files:**
- Create: `src/ui/hooks/use-streaming-text.ts`
- Modify: `src/ui/hooks/use-ai-narration.ts`
- Modify: `src/ui/hooks/use-npc-dialogue.ts`
- Test: `src/ui/hooks/use-streaming-text.test.ts`

- [ ] **Step 1: Write test for standalone createStreamingText factory**
- [ ] **Step 2: Extract common streaming logic** (sentence buffer, cancel/skip refs, state management) into `useStreamingText`
- [ ] **Step 3: Rewrite useAiNarration** as thin wrapper around useStreamingText
- [ ] **Step 4: Rewrite useNpcDialogue** as useStreamingText + metadata extraction
- [ ] **Step 5: Run tests — PASS**
- [ ] **Step 6: Commit**: `"refactor: extract shared useStreamingText hook, DRY narration and dialogue"`

---

### Task 5: Add Missing Providers + Fix Profile Fallback

**Files:**
- Modify: `src/ai/providers.ts`
- Test: `src/ai/providers-extended.test.ts`

- [ ] **Step 1: Write test**

```ts
import { describe, it, expect } from 'bun:test';
import { buildRoleConfigs } from './providers';

describe('provider config', () => {
  it('empty profile inherits from default_profile', () => {
    const config = {
      default_profile: 'balanced',
      profiles: {
        balanced: { roles: { 'narrative-director': { provider: 'deepseek', model: 'deepseek-v4-flash' } } },
        cheap: { roles: {} },
      },
    };
    const result = buildRoleConfigs(config as any, 'cheap');
    expect(result['narrative-director'].providerName).toBe('deepseek');
  });
});
```

- [ ] **Step 2: Run test — FAIL**
- [ ] **Step 3: Add alibaba and openai-compatible to PROVIDER_FACTORIES**
- [ ] **Step 4: Fix `buildRoleConfigs`** to merge default_profile roles under empty profiles
- [ ] **Step 5: Run tests — PASS**
- [ ] **Step 6: Commit**: `"feat: add alibaba/openai-compatible providers, fix empty profile fallback"`

---

### Task 6: Delete Dead Code

**Files:**
- Delete: `src/ai/schemas/narration-output.ts`
- Modify: `src/ai/utils/epistemic-tagger.ts` (remove `npc_belief` if unused)
- Modify: `src/ui/hooks/use-tab-completion.ts` (delete)
- Delete: `src/ui/hooks/use-tab-completion.test.ts`

- [ ] **Step 1: Verify no imports** of each file via grep
- [ ] **Step 2: Delete files**
- [ ] **Step 3: Run tests — PASS**
- [ ] **Step 4: Commit**: `"chore: remove dead code — NarrationOutputSchema, useTabCompletion, npc_belief"`

---

# Phase 4: UI Layer Restructuring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Decompose GameScreen god component, fix prop drilling, add error boundaries, fix questTemplates.

**Architecture:** Extract business logic to a controller. Replace ternary chain with PanelRouter map. Export all store contexts for direct consumption. Wrap panels in error boundaries.

**Tech Stack:** TypeScript, React 19, Ink 7, Bun test runner

**Depends on:** Phase 3 complete (cleaned hooks available)

---

### Task 1: Export All Store Contexts + Fix Prop Drilling

**Files:**
- Modify: `src/app.tsx`
- Modify: `src/ui/screens/game-screen.tsx`

- [ ] **Step 1: Export all 6 contexts** from app.tsx (currently only 3 exported)
- [ ] **Step 2: In GameScreen, use context hooks** instead of props for store state
- [ ] **Step 3: Reduce GameScreenProps** from 17 to ~8 (only non-store deps: gameLoop, dialogueManager, combatLoop, mapData, codexEntries, branchTree, branchDiffResult, compareBranchNames)
- [ ] **Step 4: Run app to verify** rendering is identical
- [ ] **Step 5: Commit**: `"refactor: GameScreen consumes stores via context, props reduced from 17 to 8"`

---

### Task 2: Extract GameScreen Controller

**Files:**
- Create: `src/engine/game-screen-controller.ts`
- Modify: `src/ui/screens/game-screen.tsx`
- Test: `src/engine/game-screen-controller.test.ts`

- [ ] **Step 1: Write test** for controller methods (handleActionExecute, handlePanelClose, handlePhaseSwitch)
- [ ] **Step 2: Extract all business logic** from GameScreen into `createGameScreenController(stores, eventBus, deps)`
- [ ] **Step 3: GameScreen calls controller methods** instead of containing business logic
- [ ] **Step 4: Run tests — PASS**
- [ ] **Step 5: Commit**: `"refactor: extract GameScreenController, GameScreen is now pure rendering"`

---

### Task 3: Create PanelRouter

**Files:**
- Create: `src/ui/panels/panel-router.tsx`
- Modify: `src/ui/screens/game-screen.tsx`

- [ ] **Step 1: Create PanelRouter** with declarative map: `{ journal: JournalPanel, map: MapPanel, ... }`
- [ ] **Step 2: Replace 9-deep ternary** in GameScreen with `<PanelRouter phase={phase} {...panelProps} />`
- [ ] **Step 3: Run app to verify** all panels render correctly
- [ ] **Step 4: Commit**: `"refactor: replace 9-deep ternary with declarative PanelRouter"`

---

### Task 4: Add Error Boundaries

**Files:**
- Create: `src/ui/components/error-boundary.tsx`
- Modify: `src/ui/panels/panel-router.tsx`
- Modify: `src/app.tsx`

- [ ] **Step 1: Implement GameErrorBoundary** as a React class component (error boundaries require class components)

```tsx
// src/ui/components/error-boundary.tsx
import React from 'react';
import { Box, Text } from 'ink';

type Props = { children: React.ReactNode; onReset?: () => void };
type State = { error: Error | null };

export class GameErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <Box flexDirection="column" paddingX={1}>
          <Text color="red" bold>发生错误</Text>
          <Text color="red">{this.state.error.message}</Text>
          <Text dimColor>按 Esc 返回</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: Wrap each panel** in PanelRouter with `<GameErrorBoundary>`
- [ ] **Step 3: Wrap GameScreen** in AppInner with `<GameErrorBoundary>`
- [ ] **Step 4: Commit**: `"feat: add GameErrorBoundary, wrap all panels and GameScreen"`

---

### Task 5: Fix questTemplates

**Files:**
- Modify: `src/app.tsx`

- [ ] **Step 1: Load quest templates from codex** in AppInner or via a useMemo

```tsx
// In AppInner, add:
const questTemplates = useMemo(() => {
  // If codex entries are available, extract quest templates
  // For now, load from the codex query system
  return new Map<string, QuestTemplate>();
}, []);
```

The proper fix requires codex entries to be loaded at app level. If they aren't yet, add a useEffect that loads them and passes to GameScreen.

- [ ] **Step 2: Pass loaded questTemplates** to GameScreen
- [ ] **Step 3: Verify JournalPanel** displays quest details
- [ ] **Step 4: Commit**: `"fix: load quest templates from codex, journal panel now displays quest details"`

---

### Task 6: Standardize Async I/O

**Files:**
- Modify: `src/codex/loader.ts`
- Modify: `src/persistence/memory-persistence.ts`
- Modify: `src/persistence/save-file-manager.ts`
- Modify: `src/persistence/branch-manager.ts`

- [ ] **Step 1: Replace `readdirSync`** with `readdir` from `node:fs/promises` in `loader.ts`
- [ ] **Step 2: Replace `mkdirSync`** with `mkdir` in persistence files
- [ ] **Step 3: Ensure all callers await** the now-async functions
- [ ] **Step 4: Run tests — PASS**
- [ ] **Step 5: Commit**: `"refactor: replace sync I/O with async equivalents across codex and persistence"`
