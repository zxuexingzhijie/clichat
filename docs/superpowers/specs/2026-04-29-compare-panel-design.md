# Compare Panel — Design Spec

**Date:** 2026-04-29
**Status:** Approved
**Scope:** Implement the `/compare` branch diff feature end-to-end

---

## Problem

The compare panel (`/compare`) exists in the UI but is permanently blank. `branchDiffResult` and `compareBranchNames` are hardcoded as `undefined` in `app.tsx`. The `compareBranches()` diff engine (`src/engine/branch-diff.ts`) exists and works but is never called.

---

## Approach: Self-Contained ComparePanel State Machine

`ComparePanel` owns the full lifecycle — branch selection, save loading, diff computation, LLM narration, and result display. No external state (no `branchDiffResult` props, no app.tsx state). The action handler only switches the game phase.

---

## State Machine

```
idle → selecting → loading → summarizing → ready
                                ↓ (error)
                             error → selecting (retry)
```

| State | Description |
|---|---|
| `idle` | Transient mount state, immediately transitions |
| `selecting` | Side-by-side branch picker UI |
| `loading` | Loads two `SaveDataV3` + calls `compareBranches()` |
| `summarizing` | Calls LLM to generate narrative summary |
| `ready` | Displays diff result with narrative |
| `error` | Load or LLM failure — shows message, allows retry |

**Command shortcut:** When `/compare branchA branchB` is typed, `handleCompare` writes `compareSpec: { source, target }` into `GameState`. On mount, `ComparePanel` reads this spec and skips directly to `loading`.

---

## UI Flow

### `selecting` state — side-by-side branch picker

```
┌─────────────────────────────────────────────────────┐
│              [ 选择要比较的分支 ]                      │
├──────────────────────┬──────────────────────────────┤
│   源分支 (当前)       │   目标分支                    │
│ ─────────────────   │ ─────────────────            │
│ ▶ main ●            │   main ●                     │
│   save_before_cave  │ ▶ save_before_cave           │
│   chapter2_start    │   chapter2_start             │
├──────────────────────┴──────────────────────────────┤
│  ←→ 切换列   ↑↓ 选择   Enter 确认   Esc 取消         │
└─────────────────────────────────────────────────────┘
```

- `←/→` switch focus between columns
- `↑/↓` move cursor within focused column
- `Enter` confirms selection for focused column; when both confirmed → `loading`
- `Esc` closes panel
- Current branch marked with `●`; confirmed selections highlighted

### `loading` / `summarizing` states

Uses existing `<Spinner>` component:
```
[ ⠋ ] 正在加载存档数据...
[ ⠙ ] 正在生成时间线对比...
```

### `ready` state

Reuses existing `ComparePanel` diff display (unified / side-by-side views, Tab to toggle). LLM `narrativeSummary` rendered as a header block above the diff table.

### `error` state

Shows error message with `[R] 重试` and `[Esc] 取消` options.

---

## Context Injection

`ComparePanel` receives three dependencies — passed as props from `PanelRouter` (which gets them from `GameCtx`):

| Dependency | Source | Purpose |
|---|---|---|
| `branchManager` | `ctx.persistence.branchManager` | List branches, resolve `headSaveId` |
| `saveFileManager` | `ctx.persistence.saveFileManager` | Load `SaveDataV3` by file path |
| `llmClient` | `ctx.ai.client` | Generate narrative summary |

---

## Props Changes

**Removed from `app.tsx`:**
```tsx
// DELETE these two lines:
branchDiffResult={undefined}
compareBranchNames={undefined}
```

**Removed from `GameScreen` props:**
```ts
// DELETE:
branchDiffResult?: BranchDiffResult
compareBranchNames?: { source: string; target: string }
```

**`PanelRouter` compare case simplified to:**
```tsx
compare: <ComparePanel
  branchManager={branchManager}
  saveFileManager={saveFileManager}
  llmClient={llmClient}
  compareSpec={game.compareSpec}   // from GameState, may be undefined
  onClose={onClose}
  width={width}
/>,
```

---

## Command Parsing

**`src/engine/action-handlers/phase-handlers.ts` — `handleCompare`:**

```ts
export const handleCompare: ActionHandler = async (action, ctx) => {
  const parts = action.target?.split(/\s+/) ?? [];
  const compareSpec = parts.length === 2
    ? { source: parts[0], target: parts[1] }
    : undefined;

  ctx.stores.game.setState(draft => {
    draft.phase = 'compare';
    draft.compareSpec = compareSpec ?? null;
  });

  return { status: 'action_executed', action, narration: [] };
};
```

**`GameState`** gains one new optional field: `compareSpec: { source: string; target: string } | null`.

---

## LLM Narrative Summary

**New file:** `src/ai/roles/branch-narrator.ts`

```ts
export async function generateBranchNarrative(
  sourceName: string,
  targetName: string,
  diffResult: BranchDiffResult,
  llmClient: LanguageModel
): Promise<string>
```

**Prompt structure:**
```
你是一个故事旁白，请用一句话（80-120字中文）描述以下两条时间线的关键差异，
语气富有故事感，避免技术性措辞。

源分支：{sourceName}
目标分支：{targetName}

差异摘要：
- 任务差异 {n} 项：{quest names joined}
- 关系变化 {n} 项：{npc names joined}
- 物品差异：{inventory delta summary}
- 位置差异：{location}
- 声望差异 {n} 项：{faction names joined}
```

**Model:** Fast model (Qwen-Plus / GPT-4o-mini). Non-streaming, await result.
**Failure handling:** If LLM throws or times out, `narrativeSummary` falls back to `""`. The `ready` state is entered regardless — diff is shown without narrative. No error shown to player.

---

## Files Changed

| File | Change |
|---|---|
| `src/state/game-store.ts` | Add `compareSpec` field to `GameState` |
| `src/engine/action-handlers/phase-handlers.ts` | Parse branch names from command target |
| `src/ui/panels/compare-panel.tsx` | Full rewrite — self-contained state machine |
| `src/ui/panels/panel-router.tsx` | Pass injected deps to ComparePanel; remove old props |
| `src/ui/screens/game-screen.tsx` | Remove `branchDiffResult` / `compareBranchNames` props |
| `src/app.tsx` | Remove hardcoded `undefined` props |
| `src/ai/roles/branch-narrator.ts` | New file — LLM narrative generation |

---

## Error Handling

| Failure Point | Behaviour |
|---|---|
| Branch name not found | `error` state: "找不到分支 {name}" |
| Save file missing | `error` state: "存档文件丢失" |
| `compareBranches()` throws | `error` state: "对比计算失败" |
| LLM timeout / error | Silent fallback — enter `ready` without narrative |

---

## Testing

- Unit test `branch-narrator.ts` with a mock LLM and fixed `BranchDiffResult`
- Unit test `handleCompare` branch spec parsing (two args vs zero args)
- Unit test `ComparePanel` state transitions using a mock `branchManager` + `saveFileManager`
- Manual UAT: `/compare`, select two branches with keyboard, verify diff + narrative renders
- Manual UAT: `/compare main save_before_cave`, verify skips selection and jumps to loading
