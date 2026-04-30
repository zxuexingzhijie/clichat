---
phase: 20-enemy-loot-system
plan: 01
status: complete
completed_at: "2026-04-30"
duration_min: 10
tasks_completed: 2
tasks_total: 2
commit: 9514687
files_modified:
  - world-data/codex/enemies.yaml
  - src/codex/schemas/entry-types.ts
  - src/state/scene-store.ts
  - src/engine/combat-loop.ts
  - src/engine/branch-diff.test.ts
  - src/engine/game-screen-controller.test.ts
key_decisions:
  - "combat-loop.ts 中 loot → loot_table 作为 Rule 1 自动修复（字段重命名导致属性访问错误）"
  - "branch-diff.test.ts + game-screen-controller.test.ts 中的 SceneState mock 补充 droppedItems: [] 作为 Rule 1 自动修复"
---

# Phase 20 Plan 01: enemies.yaml loot→loot_table + SceneState droppedItems 字段 Summary

**One-liner:** enemies.yaml 5个条目 loot 字段重命名为 loot_table，EnemySchema 同步更新，SceneStateSchema 新增 droppedItems: string[] 默认 []。

## What Was Done

### Task 1: enemies.yaml — loot → loot_table
- 将 5 个敌人条目（enemy_wolf、enemy_wolf_alpha、enemy_bandit、enemy_bandit_archer、enemy_shadow_assassin）的 `loot:` 字段全部重命名为 `loot_table:`
- 字段值（物品 ID 数组）保持不变

### Task 2: EnemySchema + SceneStateSchema
- `src/codex/schemas/entry-types.ts`：EnemySchema 中 `loot` → `loot_table`
- `src/state/scene-store.ts`：SceneStateSchema 新增 `droppedItems: z.array(z.string()).default([])`；`getDefaultSceneState()` 返回值新增 `droppedItems: []`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] combat-loop.ts 访问已不存在的 loot 属性**
- **Found during:** Task 2 tsc 验证
- **Issue:** `src/engine/combat-loop.ts:528` 仍用 `enemyData?.loot`，EnemySchema 重命名后 TypeScript 报错 TS2339
- **Fix:** 改为 `enemyData?.loot_table`
- **Files modified:** src/engine/combat-loop.ts
- **Commit:** 9514687（合并至同一提交）

**2. [Rule 1 - Bug] 测试 mock SceneState 缺少 droppedItems 字段**
- **Found during:** Task 2 tsc 验证
- **Issue:** branch-diff.test.ts（2处 inline scene mock）和 game-screen-controller.test.ts（makeSceneStore 基础对象）缺少 `droppedItems` 字段，tsc 报 TS2741
- **Fix:** 各处补充 `droppedItems: []`
- **Files modified:** src/engine/branch-diff.test.ts, src/engine/game-screen-controller.test.ts
- **Commit:** 9514687（合并至同一提交）

## Verification Results

```
grep -c "loot_table:" world-data/codex/enemies.yaml  → 5
grep "^  loot:" world-data/codex/enemies.yaml         → (无输出)
grep "loot_table" src/codex/schemas/entry-types.ts   → 有输出
grep "droppedItems" src/state/scene-store.ts          → 2 处
bun tsc --noEmit (过滤预存3个错误)                     → 无新增错误
bun test                                              → 1102 pass, 0 fail
```

## Self-Check: PASSED

- [x] world-data/codex/enemies.yaml 存在且含 5 处 loot_table
- [x] src/codex/schemas/entry-types.ts 含 loot_table
- [x] src/state/scene-store.ts 含 droppedItems（2处）
- [x] commit 9514687 存在
- [x] 1102 tests pass
