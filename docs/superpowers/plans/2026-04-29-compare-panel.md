# Compare Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `/compare` branch diff feature end-to-end — side-by-side branch selector, async save loading, `compareBranches()` diff, LLM narrative summary, and results display.

**Architecture:** `ComparePanel` becomes a self-contained state machine (`selecting → loading → summarizing → ready / error`). It receives `branches` and `readSaveData` as props; reads `compareSpec` from `GameStoreCtx`; imports `compareBranches` and `generateBranchNarrative` directly. `handleCompare` parses optional `branchA branchB` args into `game.compareSpec`. No state is lifted to `app.tsx`.

**Tech Stack:** React + Ink, Zod (SaveDataV3Schema), Vercel AI SDK (`callGenerateText`), existing `compareBranches` from `src/engine/branch-diff.ts`, `branchStore` from `src/state/branch-store.ts`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/persistence/save-file-manager.ts` | Modify | Add `readSaveData()` — read-only load, no side effects |
| `src/state/game-store.ts` | Modify | Add `compareSpec` field to `GameStateSchema` |
| `src/engine/action-handlers/phase-handlers.ts` | Modify | Parse two branch names from `/compare branchA branchB` |
| `src/ai/providers.ts` | Modify | Register `'branch-narrator'` role |
| `src/ai/roles/branch-narrator.ts` | Create | `generateBranchNarrative()` — LLM narrative summary |
| `src/ui/panels/compare-panel.tsx` | Rewrite | Self-contained state machine + selector + diff display |
| `src/ui/panels/panel-router.tsx` | Modify | Pass `branches` + `readSaveData` + `compareSpec` to ComparePanel; remove old diff props |
| `src/ui/screens/game-screen.tsx` | Modify | Remove `branchDiffResult`/`compareBranchNames` props; add `branches` + `readSaveData` |
| `src/app.tsx` | Modify | Remove `branchDiffResult={undefined}`, pass `branches` + `readSaveData` |

---

## Task 1: Add `readSaveData` to save-file-manager

**Why:** `loadGame` calls `serializer.restore()` which mutates global game state. Comparing two branches requires loading saves read-only without touching running state.

**Files:**
- Modify: `src/persistence/save-file-manager.ts`
- Test: `src/persistence/save-file-manager.test.ts` (create if missing)

- [ ] **Step 1: Write the failing test**

```ts
// src/persistence/save-file-manager.test.ts
import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import path from 'node:path';

// Mock Bun.file
const mockSaveData = {
  version: 3,
  meta: { saveId: 'test-save', timestamp: '2026-01-01T00:00:00.000Z', playerName: 'Hero', locationName: 'North Gate', playtime: 0 },
  branchId: 'main',
  parentSaveId: null,
  player: {},
  scene: {},
  combat: {},
  game: {},
  quest: {},
  relations: {},
  npcMemorySnapshot: {},
  questEventLog: [],
  exploration: {},
  playerKnowledge: {},
  turnLog: [],
};

mock.module('bun', () => ({
  file: (_path: string) => ({ json: async () => mockSaveData }),
}));

import { readSaveData, getSaveDir } from './save-file-manager';

describe('readSaveData', () => {
  it('returns parsed SaveDataV3 without mutating game state', async () => {
    const saveDir = getSaveDir();
    const result = await readSaveData('test-save.json', saveDir);
    expect(result.version).toBe(3);
    expect(result.branchId).toBe('main');
  });

  it('rejects path traversal attempts', async () => {
    const saveDir = getSaveDir();
    await expect(readSaveData('../../../etc/passwd', saveDir)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/makoto/Downloads/work/cli
bun test src/persistence/save-file-manager.test.ts 2>&1 | tail -20
```

Expected: FAIL — `readSaveData is not a function`

- [ ] **Step 3: Implement `readSaveData`**

Open `src/persistence/save-file-manager.ts`. Add after the existing imports, add `SaveDataV3Schema` import and the new function at the bottom of the file:

```ts
// At top of file, add to imports:
import { SaveDataV3Schema, type SaveDataV3 } from '../state/serializer';

// Add at end of file:
export async function readSaveData(filePath: string, saveDir?: string): Promise<SaveDataV3> {
  const dir = saveDir ?? getSaveDir();
  const resolved = path.resolve(dir, filePath);
  if (!resolved.startsWith(path.resolve(dir))) {
    throw new Error('Invalid save file path: path traversal detected');
  }
  const raw = await Bun.file(resolved).json();
  return SaveDataV3Schema.parse(raw);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/makoto/Downloads/work/cli
bun test src/persistence/save-file-manager.test.ts 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/persistence/save-file-manager.ts src/persistence/save-file-manager.test.ts
git commit -m "feat(persistence): add readSaveData — read-only save load without state mutation"
```

---

## Task 2: Add `compareSpec` to GameState + update `handleCompare`

**Files:**
- Modify: `src/state/game-store.ts`
- Modify: `src/engine/action-handlers/phase-handlers.ts`
- Test: `src/engine/action-handlers/phase-handlers.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/action-handlers/phase-handlers.test.ts
import { describe, it, expect } from 'bun:test';
import { handleCompare } from './phase-handlers';
import { createGameStore } from '../../state/game-store';
import { eventBus } from '../../events/event-bus';

function makeCtx(target?: string) {
  const gameStore = createGameStore(eventBus);
  return {
    stores: { game: gameStore } as any,
    action: { verb: 'compare', target },
    eventBus,
  };
}

describe('handleCompare', () => {
  it('sets phase to compare', async () => {
    const ctx = makeCtx();
    await handleCompare({ verb: 'compare' } as any, ctx as any);
    expect(ctx.stores.game.getState().phase).toBe('compare');
  });

  it('parses two branch names into compareSpec', async () => {
    const ctx = makeCtx();
    await handleCompare({ verb: 'compare', target: 'main feature-branch' } as any, ctx as any);
    expect(ctx.stores.game.getState().compareSpec).toEqual({ source: 'main', target: 'feature-branch' });
  });

  it('sets compareSpec to null when no args given', async () => {
    const ctx = makeCtx();
    await handleCompare({ verb: 'compare' } as any, ctx as any);
    expect(ctx.stores.game.getState().compareSpec).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/makoto/Downloads/work/cli
bun test src/engine/action-handlers/phase-handlers.test.ts 2>&1 | tail -20
```

Expected: FAIL — `compareSpec` not on GameState

- [ ] **Step 3: Add `compareSpec` to GameStateSchema**

In `src/state/game-store.ts`, add `compareSpec` to `GameStateSchema` and `getDefaultGameState()`:

```ts
// In GameStateSchema z.object({...}), add:
compareSpec: z.object({
  source: z.string(),
  target: z.string(),
}).nullable().default(null),
```

```ts
// In getDefaultGameState(), add:
compareSpec: null,
```

- [ ] **Step 4: Update `handleCompare`**

In `src/engine/action-handlers/phase-handlers.ts`, replace the existing `handleCompare`:

```ts
export const handleCompare: ActionHandler = async (action, ctx) => {
  const parts = (action.target ?? '').trim().split(/\s+/).filter(Boolean);
  const compareSpec = parts.length >= 2
    ? { source: parts[0]!, target: parts[1]! }
    : null;

  ctx.stores.game.setState(draft => {
    draft.phase = 'compare';
    draft.compareSpec = compareSpec;
  });

  return { status: 'action_executed', action, narration: [] };
};
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /Users/makoto/Downloads/work/cli
bun test src/engine/action-handlers/phase-handlers.test.ts 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 6: Run full test suite to check no regressions**

```bash
cd /Users/makoto/Downloads/work/cli
bun test --timeout 10000 2>&1 | tail -10
```

Expected: all existing tests pass

- [ ] **Step 7: Commit**

```bash
git add src/state/game-store.ts src/engine/action-handlers/phase-handlers.ts src/engine/action-handlers/phase-handlers.test.ts
git commit -m "feat(state): add compareSpec to GameState + handleCompare parses branch args"
```

---

## Task 3: Register `branch-narrator` AI role + create `generateBranchNarrative`

**Files:**
- Modify: `src/ai/providers.ts`
- Create: `src/ai/roles/branch-narrator.ts`
- Test: `src/ai/roles/branch-narrator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/roles/branch-narrator.test.ts
import { describe, it, expect, mock } from 'bun:test';
import type { BranchDiffResult } from '../../engine/branch-diff';

const mockText = '在这条支线中，你选择帮助猎人，声望更高，但错过了暗影刺客的线索。';

mock.module('../providers', () => ({
  getRoleConfig: () => ({
    providerName: 'google',
    model: () => ({}),
    temperature: 0.7,
    maxTokens: 200,
  }),
}));

mock.module('../utils/ai-caller', () => ({
  callGenerateText: async () => ({ text: mockText }),
}));

import { generateBranchNarrative } from './branch-narrator';

const mockDiff: BranchDiffResult = {
  diffs: [
    { category: 'quest', marker: '+', key: 'quest_wolf_bounty', description: '完成狼群悬赏', isHighImpact: true },
    { category: 'npc_relation', marker: '~', key: 'npc_hunter', description: '与猎人关系改善', isHighImpact: false },
  ],
  totalCount: 2,
  highImpactCount: 1,
  summary: '2 differences',
};

describe('generateBranchNarrative', () => {
  it('returns LLM-generated narrative string', async () => {
    const result = await generateBranchNarrative('main', 'hunter-path', mockDiff);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty string on LLM error', async () => {
    mock.module('../utils/ai-caller', () => ({
      callGenerateText: async () => { throw new Error('LLM timeout'); },
    }));
    // Re-import after mock change
    const { generateBranchNarrative: gen } = await import('./branch-narrator');
    const result = await gen('main', 'hunter-path', mockDiff);
    expect(result).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/makoto/Downloads/work/cli
bun test src/ai/roles/branch-narrator.test.ts 2>&1 | tail -20
```

Expected: FAIL — module not found

- [ ] **Step 3: Register role in `src/ai/providers.ts`**

Add `'branch-narrator'` to the `RoleName` union type and the config object:

```ts
// In the RoleName union, add:
| 'branch-narrator'

// In the ROLE_CONFIGS object, add:
'branch-narrator': {
  model: () => google('gemini-2.0-flash') as unknown as LanguageModel,
  temperature: 0.7,
  maxTokens: 200,
  providerName: 'google',
},
```

- [ ] **Step 4: Create `src/ai/roles/branch-narrator.ts`**

```ts
import { getRoleConfig } from '../providers';
import { callGenerateText } from '../utils/ai-caller';
import type { BranchDiffResult, DiffItem } from '../../engine/branch-diff';

function buildPrompt(
  sourceName: string,
  targetName: string,
  diffResult: BranchDiffResult,
): string {
  const format = (items: readonly DiffItem[]) =>
    items.map(d => d.description).join('、') || '无';

  const quests = format(diffResult.diffs.filter(d => d.category === 'quest'));
  const relations = format(diffResult.diffs.filter(d => d.category === 'npc_relation'));
  const inventory = format(diffResult.diffs.filter(d => d.category === 'inventory'));
  const factions = format(diffResult.diffs.filter(d => d.category === 'faction'));

  return [
    '你是一个故事旁白，请用一句话（80-120字中文）描述以下两条时间线的关键差异，语气富有故事感，避免技术性措辞。',
    '',
    `源分支：${sourceName}`,
    `目标分支：${targetName}`,
    '',
    '差异摘要：',
    `- 任务差异 ${diffResult.diffs.filter(d => d.category === 'quest').length} 项：${quests}`,
    `- 关系变化 ${diffResult.diffs.filter(d => d.category === 'npc_relation').length} 项：${relations}`,
    `- 物品差异：${inventory}`,
    `- 声望差异 ${diffResult.diffs.filter(d => d.category === 'faction').length} 项：${factions}`,
  ].join('\n');
}

export async function generateBranchNarrative(
  sourceName: string,
  targetName: string,
  diffResult: BranchDiffResult,
): Promise<string> {
  const config = getRoleConfig('branch-narrator');
  const prompt = buildPrompt(sourceName, targetName, diffResult);

  try {
    const { text } = await callGenerateText({
      role: 'branch-narrator',
      providerName: config.providerName,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      system: '你是一个中文故事旁白，只输出叙述文字，不加任何标签或格式。',
      prompt,
    });
    return text.trim();
  } catch {
    return '';
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /Users/makoto/Downloads/work/cli
bun test src/ai/roles/branch-narrator.test.ts 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ai/providers.ts src/ai/roles/branch-narrator.ts src/ai/roles/branch-narrator.test.ts
git commit -m "feat(ai): branch-narrator role — generateBranchNarrative with LLM fallback"
```

---

## Task 4: Rewrite `ComparePanel` as self-contained state machine

**Files:**
- Rewrite: `src/ui/panels/compare-panel.tsx`
- Test: `src/ui/panels/compare-panel.test.tsx` (create)

The panel manages its own async flow. It reads `compareSpec` from `GameStoreCtx` and `branches` as a prop. When `compareSpec` is set (from `/compare branchA branchB`), it skips the selector and jumps straight to loading.

- [ ] **Step 1: Write the failing test**

```tsx
// src/ui/panels/compare-panel.test.tsx
import { describe, it, expect, mock } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import type { BranchMeta } from '../../state/branch-store';
import type { SaveDataV3 } from '../../state/serializer';

// Mock GameStoreCtx
mock.module('../../app', () => ({
  GameStoreCtx: {
    useStoreState: (sel: any) => sel({ compareSpec: null, phase: 'compare' }),
  },
}));

mock.module('../../engine/branch-diff', () => ({
  compareBranches: () => ({
    diffs: [],
    totalCount: 0,
    highImpactCount: 0,
    summary: '0 differences',
  }),
}));

mock.module('../../ai/roles/branch-narrator', () => ({
  generateBranchNarrative: async () => '',
}));

import { ComparePanel } from './compare-panel';

const mockBranches: Record<string, BranchMeta> = {
  'branch-main': { id: 'branch-main', name: 'main', parentBranchId: null, parentSaveId: null, headSaveId: 'save1.json', createdAt: '2026-01-01', description: '' },
  'branch-alt': { id: 'branch-alt', name: 'chapter2', parentBranchId: 'branch-main', parentSaveId: 'save1.json', headSaveId: 'save2.json', createdAt: '2026-01-02', description: '' },
};

const mockReadSaveData = async (_path: string): Promise<SaveDataV3> => ({} as SaveDataV3);

describe('ComparePanel', () => {
  it('renders branch selector when no compareSpec', () => {
    const { lastFrame } = render(
      <ComparePanel
        branches={mockBranches}
        readSaveData={mockReadSaveData}
        onClose={() => {}}
        width={120}
      />
    );
    expect(lastFrame()).toContain('选择要比较的分支');
  });

  it('shows branch names in selector columns', () => {
    const { lastFrame } = render(
      <ComparePanel
        branches={mockBranches}
        readSaveData={mockReadSaveData}
        onClose={() => {}}
        width={120}
      />
    );
    expect(lastFrame()).toContain('main');
    expect(lastFrame()).toContain('chapter2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/makoto/Downloads/work/cli
bun test src/ui/panels/compare-panel.test.tsx 2>&1 | tail -20
```

Expected: FAIL

- [ ] **Step 3: Rewrite `src/ui/panels/compare-panel.tsx`**

Replace the entire file with:

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner } from '@inkjs/ui';
import { GameStoreCtx } from '../../app';
import { compareBranches, type BranchDiffResult, type DiffItem, type DiffCategory } from '../../engine/branch-diff';
import { generateBranchNarrative } from '../../ai/roles/branch-narrator';
import type { BranchMeta } from '../../state/branch-store';
import type { SaveDataV3 } from '../../state/serializer';

// ── Types ──────────────────────────────────────────────────────────────────

type SelectingState = {
  stage: 'selecting';
  leftFocus: boolean;
  leftIdx: number;
  rightIdx: number;
  confirmedSource: string | null;
  confirmedTarget: string | null;
};

type CompareState =
  | SelectingState
  | { stage: 'loading' }
  | { stage: 'summarizing'; diffResult: BranchDiffResult }
  | { stage: 'ready'; diffResult: BranchDiffResult; narrativeSummary: string; sourceName: string; targetName: string }
  | { stage: 'error'; message: string };

type ViewMode = 'unified' | 'side-by-side';

// ── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<DiffCategory, string> = {
  quest: '任务',
  npc_relation: 'NPC关系',
  inventory: '物品',
  location: '位置',
  faction: '阵营声望',
  knowledge: '知识',
};

const CATEGORY_ORDER: DiffCategory[] = ['quest', 'npc_relation', 'inventory', 'location', 'faction', 'knowledge'];

// ── Props ──────────────────────────────────────────────────────────────────

type ComparePanelProps = {
  readonly branches: Record<string, BranchMeta>;
  readonly readSaveData: (filePath: string) => Promise<SaveDataV3>;
  readonly onClose: () => void;
  readonly width?: number;
};

// ── Main Component ─────────────────────────────────────────────────────────

export function ComparePanel({ branches, readSaveData, onClose, width = 80 }: ComparePanelProps) {
  const compareSpec = GameStoreCtx.useStoreState(s => s.compareSpec);
  const branchList = Object.values(branches);

  const [state, setState] = useState<CompareState>(() => {
    if (compareSpec) {
      return { stage: 'loading' };
    }
    return { stage: 'selecting', leftFocus: true, leftIdx: 0, rightIdx: 0, confirmedSource: null, confirmedTarget: null };
  });

  const [viewMode, setViewMode] = useState<ViewMode>('unified');

  // ── Load + diff + summarize ──────────────────────────────────────────────

  const runCompare = useCallback(async (sourceName: string, targetName: string) => {
    setState({ stage: 'loading' });

    try {
      const sourceMeta = branchList.find(b => b.name === sourceName);
      const targetMeta = branchList.find(b => b.name === targetName);

      if (!sourceMeta) throw new Error(`找不到分支：${sourceName}`);
      if (!targetMeta) throw new Error(`找不到分支：${targetName}`);
      if (!sourceMeta.headSaveId) throw new Error(`分支 ${sourceName} 没有存档`);
      if (!targetMeta.headSaveId) throw new Error(`分支 ${targetName} 没有存档`);

      const [sourceData, targetData] = await Promise.all([
        readSaveData(sourceMeta.headSaveId),
        readSaveData(targetMeta.headSaveId),
      ]);

      const diffResult = compareBranches(sourceData, targetData);
      setState({ stage: 'summarizing', diffResult });

      const narrativeSummary = await generateBranchNarrative(sourceName, targetName, diffResult);
      setState({ stage: 'ready', diffResult, narrativeSummary, sourceName, targetName });
    } catch (err) {
      setState({ stage: 'error', message: err instanceof Error ? err.message : '对比失败' });
    }
  }, [branchList, readSaveData]);

  // Trigger comparison on mount when compareSpec is provided
  useEffect(() => {
    if (compareSpec) {
      void runCompare(compareSpec.source, compareSpec.target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keyboard ─────────────────────────────────────────────────────────────

  useInput((input, key) => {
    if (key.escape) { onClose(); return; }

    if (state.stage === 'ready' && key.tab) {
      if (width >= 100) setViewMode(m => m === 'unified' ? 'side-by-side' : 'unified');
      return;
    }

    if (state.stage === 'error' && (input === 'r' || input === 'R')) {
      if (compareSpec) void runCompare(compareSpec.source, compareSpec.target);
      else setState({ stage: 'selecting', leftFocus: true, leftIdx: 0, rightIdx: 0, confirmedSource: null, confirmedTarget: null });
      return;
    }

    if (state.stage !== 'selecting') return;

    const s = state as SelectingState;

    if (key.leftArrow) { setState({ ...s, leftFocus: true }); return; }
    if (key.rightArrow) { setState({ ...s, leftFocus: false }); return; }

    if (key.upArrow) {
      if (s.leftFocus) setState({ ...s, leftIdx: Math.max(0, s.leftIdx - 1) });
      else setState({ ...s, rightIdx: Math.max(0, s.rightIdx - 1) });
      return;
    }

    if (key.downArrow) {
      if (s.leftFocus) setState({ ...s, leftIdx: Math.min(branchList.length - 1, s.leftIdx + 1) });
      else setState({ ...s, rightIdx: Math.min(branchList.length - 1, s.rightIdx + 1) });
      return;
    }

    if (key.return) {
      const newSource = s.leftFocus ? branchList[s.leftIdx]?.name ?? null : s.confirmedSource;
      const newTarget = s.leftFocus ? s.confirmedTarget : branchList[s.rightIdx]?.name ?? null;
      const next = { ...s, confirmedSource: newSource, confirmedTarget: newTarget };

      if (next.confirmedSource && next.confirmedTarget) {
        void runCompare(next.confirmedSource, next.confirmedTarget);
      } else {
        setState(next);
      }
    }
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} width={width}>
      {state.stage === 'selecting' && (
        <SelectorView
          branches={branchList}
          state={state as SelectingState}
          width={width}
        />
      )}
      {(state.stage === 'loading' || state.stage === 'summarizing') && (
        <LoadingView stage={state.stage} />
      )}
      {state.stage === 'ready' && (
        <ReadyView
          state={state}
          viewMode={viewMode}
          width={width}
          canSideBySide={width >= 100}
        />
      )}
      {state.stage === 'error' && (
        <ErrorView message={state.message} />
      )}
    </Box>
  );
}

// ── Sub-views ─────────────────────────────────────────────────────────────

function SelectorView({ branches, state, width }: { branches: BranchMeta[]; state: SelectingState; width: number }) {
  const colWidth = Math.floor((width - 6) / 2);

  return (
    <Box flexDirection="column">
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="cyan">[ 选择要比较的分支 ]</Text>
      </Box>
      <Box flexDirection="row">
        <Box flexDirection="column" width={colWidth} borderStyle="single" borderColor={state.leftFocus ? 'cyan' : 'gray'} paddingX={1}>
          <Text bold color={state.leftFocus ? 'cyan' : 'white'}>
            源分支{state.confirmedSource ? ` ✓ ${state.confirmedSource}` : ''}
          </Text>
          {branches.map((b, i) => (
            <Text key={b.id} color={i === state.leftIdx && state.leftFocus ? 'cyan' : 'white'}>
              {i === state.leftIdx ? '▶ ' : '  '}
              {b.name}
              {state.confirmedSource === b.name ? ' ●' : ''}
            </Text>
          ))}
        </Box>
        <Box flexDirection="column" width={colWidth} borderStyle="single" borderColor={!state.leftFocus ? 'cyan' : 'gray'} paddingX={1}>
          <Text bold color={!state.leftFocus ? 'cyan' : 'white'}>
            目标分支{state.confirmedTarget ? ` ✓ ${state.confirmedTarget}` : ''}
          </Text>
          {branches.map((b, i) => (
            <Text key={b.id} color={i === state.rightIdx && !state.leftFocus ? 'cyan' : 'white'}>
              {i === state.rightIdx ? '▶ ' : '  '}
              {b.name}
              {state.confirmedTarget === b.name ? ' ●' : ''}
            </Text>
          ))}
        </Box>
      </Box>
      <Box marginTop={1} justifyContent="center">
        <Text dimColor>←→ 切换列  ↑↓ 选择  Enter 确认  Esc 取消</Text>
      </Box>
    </Box>
  );
}

function LoadingView({ stage }: { stage: 'loading' | 'summarizing' }) {
  return (
    <Box flexDirection="column" alignItems="center" paddingY={2}>
      <Spinner label={stage === 'loading' ? '正在加载存档数据...' : '正在生成时间线对比...'} />
    </Box>
  );
}

function ReadyView({ state, viewMode, width, canSideBySide }: {
  state: { diffResult: BranchDiffResult; narrativeSummary: string; sourceName: string; targetName: string };
  viewMode: ViewMode;
  width: number;
  canSideBySide: boolean;
}) {
  const grouped = CATEGORY_ORDER
    .map(cat => ({ cat, items: state.diffResult.diffs.filter(d => d.category === cat) }))
    .filter(g => g.items.length > 0);

  return (
    <Box flexDirection="column">
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="cyan">
          {state.sourceName} → {state.targetName}
          {'  '}
          <Text dimColor>({state.diffResult.totalCount} 处差异)</Text>
        </Text>
      </Box>

      {state.narrativeSummary.length > 0 && (
        <Box borderStyle="single" borderColor="yellow" paddingX={1} marginBottom={1}>
          <Text color="yellow">{state.narrativeSummary}</Text>
        </Box>
      )}

      {grouped.map(({ cat, items }) => (
        <Box key={cat} flexDirection="column" marginBottom={1}>
          <Text bold underline>{CATEGORY_LABELS[cat]}</Text>
          {items.map(item => (
            <DiffRow key={item.key} item={item} viewMode={viewMode} width={width} />
          ))}
        </Box>
      ))}

      {state.diffResult.totalCount === 0 && (
        <Box justifyContent="center" paddingY={1}>
          <Text dimColor>两条时间线完全相同</Text>
        </Box>
      )}

      <Box marginTop={1} justifyContent="center">
        <Text dimColor>
          Esc 关闭{canSideBySide ? '  Tab 切换视图' : ''}
        </Text>
      </Box>
    </Box>
  );
}

function DiffRow({ item, viewMode, width }: { item: DiffItem; viewMode: ViewMode; width: number }) {
  const color = item.marker === '+' ? 'green' : item.marker === '-' ? 'red' : 'yellow';
  const marker = item.marker === '+' ? '＋' : item.marker === '-' ? '－' : '～';

  if (viewMode === 'side-by-side' && item.sourceValue !== undefined && item.targetValue !== undefined) {
    const colW = Math.floor((width - 6) / 2);
    return (
      <Box flexDirection="row">
        <Box width={colW}>
          <Text color={color}>{marker} </Text>
          <Text>{item.sourceValue.slice(0, colW - 4)}</Text>
        </Box>
        <Box width={colW}>
          <Text color={color}>{marker} </Text>
          <Text>{item.targetValue.slice(0, colW - 4)}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Text color={color}>{marker} </Text>
      <Text color={item.isHighImpact ? 'white' : 'gray'}>{item.description}</Text>
    </Box>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <Box flexDirection="column" alignItems="center" paddingY={2}>
      <Text color="red">⚠ {message}</Text>
      <Box marginTop={1}>
        <Text dimColor>[R] 重试  [Esc] 取消</Text>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/makoto/Downloads/work/cli
bun test src/ui/panels/compare-panel.test.tsx 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/panels/compare-panel.tsx src/ui/panels/compare-panel.test.tsx
git commit -m "feat(ui): ComparePanel rewrite — self-contained state machine with branch selector"
```

---

## Task 5: Wire `ComparePanel` into PanelRouter, GameScreen, and app.tsx

**Files:**
- Modify: `src/ui/panels/panel-router.tsx`
- Modify: `src/ui/screens/game-screen.tsx`
- Modify: `src/app.tsx`

No new tests needed here — this is prop plumbing. Full suite verifies correctness.

- [ ] **Step 1: Update `src/ui/panels/panel-router.tsx`**

Add new import and update the `compare` case. Find the existing imports and add:

```ts
import { ComparePanel } from './compare-panel';
import type { BranchMeta } from '../../state/branch-store';
import type { SaveDataV3 } from '../../state/serializer';
```

In `PanelRouterProps`, add two new props (remove the old `branchDiffResult` and `compareBranchNames`):

```ts
// REMOVE:
readonly branchDiffResult?: BranchDiffResult;
readonly compareBranchNames?: { readonly source: string; readonly target: string };

// ADD:
readonly branches?: Record<string, BranchMeta>;
readonly readSaveData?: (filePath: string) => Promise<SaveDataV3>;
```

Update the `compare` entry in `panelMap`:

```ts
// REPLACE the compare entry with:
compare: branches && readSaveData ? (
  <ComparePanel
    branches={branches}
    readSaveData={readSaveData}
    onClose={onClose}
    width={width}
  />
) : <Box><Text dimColor>正在初始化...</Text></Box>,
```

Remove the old `ComparePanel` import (with the old props-based version):
```ts
// REMOVE old import if it exists (the old ComparePanel was imported with diffResult/compareBranchNames props)
```

- [ ] **Step 2: Update `src/ui/screens/game-screen.tsx`**

In `GameScreenProps`, replace old compare props with new ones:

```ts
// REMOVE:
readonly branchDiffResult?: BranchDiffResult;
readonly compareBranchNames?: { readonly source: string; readonly target: string };

// ADD:
readonly branches?: Record<string, BranchMeta>;
readonly readSaveData?: (filePath: string) => Promise<SaveDataV3>;
```

In the `<PanelRouter ...>` call, replace the old props:

```tsx
// REMOVE:
branchDiffResult={branchDiffResult}
compareBranchNames={compareBranchNames}

// ADD:
branches={branches}
readSaveData={readSaveData}
```

Add the necessary imports for `BranchMeta` and `SaveDataV3` if not present.

- [ ] **Step 3: Update `src/app.tsx`**

First, add `readSaveData` import:

```ts
import { readSaveData } from './persistence/save-file-manager';
```

In the `<GameScreen ...>` JSX, replace:

```tsx
// REMOVE:
branchDiffResult={undefined}
compareBranchNames={undefined}

// ADD:
branches={branchState.branches}
readSaveData={readSaveData}
```

- [ ] **Step 4: Run TypeScript check**

```bash
cd /Users/makoto/Downloads/work/cli
bun tsc --noEmit 2>&1
```

Expected: no errors. If there are type errors about removed props (e.g., `BranchDiffResult` still imported somewhere), remove the unused imports.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/makoto/Downloads/work/cli
bun test --timeout 10000 2>&1 | tail -10
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/ui/panels/panel-router.tsx src/ui/screens/game-screen.tsx src/app.tsx
git commit -m "feat(ui): wire ComparePanel into panel-router + game-screen + app — remove hardcoded undefined props"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ State machine: idle→selecting→loading→summarizing→ready/error (Task 4)
- ✅ Side-by-side selector UI (Task 4 `SelectorView`)
- ✅ `/compare branchA branchB` command shortcut (Task 2 + Task 4 `useEffect`)
- ✅ LLM narrative summary (Task 3 + Task 4 `generateBranchNarrative`)
- ✅ LLM fallback to `""` on error (Task 3 `catch`)
- ✅ `readSaveData` read-only load (Task 1)
- ✅ Props cleanup in app.tsx/game-screen (Task 5)
- ✅ `compareSpec` in GameState (Task 2)

**Type consistency:**
- `readSaveData` signature is `(filePath: string) => Promise<SaveDataV3>` — consistent across Task 1, Task 4 props, Task 5 plumbing
- `branches` is `Record<string, BranchMeta>` — consistent across Task 4 props, Task 5 plumbing
- `compareSpec` is `{ source: string; target: string } | null` — consistent across Task 2 (GameStateSchema) and Task 4 (`useStoreState`)
- `generateBranchNarrative(sourceName, targetName, diffResult)` — matches Task 3 definition and Task 4 call site

**No placeholders:** All steps contain actual code. ✅
