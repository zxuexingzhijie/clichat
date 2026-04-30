---
phase: 20-enemy-loot-system
plan: 02
status: complete
completed_at: "2026-04-30"
duration_min: 7
tasks_completed: 3
tasks_total: 3
commits:
  - 1b42481
  - d1c0e60
  - b07db8b
  - 24fe70b
files_modified:
  - src/engine/combat-loop.ts
  - src/engine/combat-loop.test.ts
  - src/engine/action-handlers/take-handler.ts
  - src/engine/action-handlers/take-handler.test.ts
  - src/engine/action-handlers/index.ts
  - src/engine/scene-manager.ts
  - src/types/game-action.ts
key_decisions:
  - "GameActionTypeSchema 新增 take 类型（Rule 1 — 类型系统正确性）"
  - "take-handler 使用 droppedItems.includes 校验防止未授权拾取（T-20-03 mitigate）"
  - "handleLook 在所有路径（AI narration 和 fallback）均加入 droppedItems 展示"
---

# Phase 20 Plan 02: combat-loop loot redirect + take-handler + scene-manager look Summary

**One-liner:** 战斗胜利时将 loot_table 写入 sceneStore.droppedItems，新建 :take 处理器支持拾取和自动选择，:look 在两条输出路径中展示掉落物品。

## What Was Done

### Task 1: combat-loop.ts — 战利品写入 droppedItems（TDD）

- RED：在 combat-loop.test.ts 末尾添加 `loot drop on enemy defeat` describe 块，3 个测试（写入 droppedItems、不写 player.tags、空 loot_table 无操作）
- GREEN：`checkCombatEnd` 中将 `stores.player.setState(draft.tags push)` 改为 `sceneStore?.setState(draft.droppedItems spread)`
- 导入 `createStore` 和 `getDefaultSceneState` 到测试文件，通过 `options.sceneStore` 传入独立 store

### Task 2: take-handler.ts 新建 + index.ts 注册（TDD）

- RED：新建 take-handler.test.ts，6 个测试覆盖：指定 id 拾取、不存在 id 报错、无参自动选 1 项、无参多项列出、无参空列表、codexEntries 未加载
- GREEN：新建 take-handler.ts，实现全部 6 个行为；`droppedItems.includes` 校验防止未授权拾取（T-20-03）
- 在 index.ts HANDLER_MAP 注册 `take: handleTake`，不加入 COMBAT_ACTIONS

### Task 3: scene-manager.ts handleLook — 展示 droppedItems

- 在 generateNarrationFn 路径：AI narration 生成后，追加 `地上有：[names]` 行
- 在 fallback 路径：`dropped.length > 0` 时追加 drop line 并提前返回
- 两条路径均用 `queryById` 查物品名、`capNarrationLines` 控制长度

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] GameActionTypeSchema 缺少 'take' 导致 tsc 类型错误**
- **Found during:** Task 2 tsc 验证
- **Issue:** `GameActionTypeSchema` enum 不含 `'take'`，测试中 `{ type: 'take' }` 报 TS2345
- **Fix:** 在 `src/types/game-action.ts` enum 列表添加 `'take'`
- **Files modified:** src/types/game-action.ts
- **Commit:** 24fe70b

**2. [Rule 1 - Bug] take-handler.ts itemId 类型不兼容 GameAction.target**
- **Found during:** Task 2 tsc 验证
- **Issue:** `let itemId: string | undefined = action.target` — `action.target` 是 `string | null`，tsc TS2322
- **Fix:** 改为 `string | null | undefined`
- **Files modified:** src/engine/action-handlers/take-handler.ts
- **Commit:** 24fe70b

**3. [Rule 1 - Bug] 测试 WOLF_PELT_ENTRY.item_type 值不在 ItemSchema enum**
- **Found during:** Task 2 tsc 验证
- **Issue:** `item_type: 'material'` 不在 `["weapon","armor","consumable","key_item","misc"]`，tsc TS2322
- **Fix:** 改为 `item_type: 'misc'`
- **Files modified:** src/engine/action-handlers/take-handler.test.ts
- **Commit:** 24fe70b

**4. [Rule 2 - 安全] take-handler 测试 makeAction 辅助函数**
- **Found during:** Task 2 tsc 修复
- **Issue:** 测试直接构造 `{ type: 'take' }` 缺少 `target/modifiers/source` 必填字段
- **Fix:** 添加 `makeAction(type, target?)` 辅助函数，自动补全 GameAction 完整结构
- **Files modified:** src/engine/action-handlers/take-handler.test.ts
- **Commit:** 24fe70b

## Verification Results

```
grep "loot_table" src/engine/combat-loop.ts         → 有输出
grep "droppedItems" src/engine/combat-loop.ts        → 有输出
grep "player.tags.*item:" src/engine/combat-loop.ts  → 无输出（符合预期）
grep "take: handleTake" src/engine/action-handlers/index.ts → 有输出
grep -c "droppedItems" src/engine/scene-manager.ts   → 2
grep "地上有" src/engine/scene-manager.ts            → 2 处（AI路径 + fallback路径）
bun test                                             → 1111 pass, 0 fail
bun tsc --noEmit（过滤预存3个错误）                   → 无新增错误
```

## Known Stubs

无。所有功能均已完整实现和连接。

## Threat Surface Scan

T-20-03（Tampering）已按计划实施：`droppedItems.includes(itemId)` 校验阻止拾取不在掉落列表中的物品，玩家输入的 item ID 不可直接写入 player.tags。

## Self-Check: PASSED

- [x] src/engine/combat-loop.ts 存在且含 droppedItems
- [x] src/engine/action-handlers/take-handler.ts 存在
- [x] src/engine/action-handlers/index.ts 含 take: handleTake
- [x] src/engine/scene-manager.ts 含 droppedItems (2处) 和 地上有
- [x] commits 1b42481, d1c0e60, b07db8b, 24fe70b 存在
- [x] 1111 tests pass
