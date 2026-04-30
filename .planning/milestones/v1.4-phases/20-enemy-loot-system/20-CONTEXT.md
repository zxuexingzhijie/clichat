---
phase: 20
name: Enemy Loot System
status: context_complete
created: "2026-04-30"
---

# Phase 20 — Enemy Loot System: Context

## Domain

Defeating enemies yields items that persist in the scene and can be picked up by the player. Items survive save/load.

## Canonical Refs

- `world-data/codex/enemies.yaml` — enemy definitions with `loot` field (to be renamed `loot_table`)
- `world-data/codex/items.yaml` — item definitions (all referenced loot items already present)
- `src/engine/combat-loop.ts` — `checkCombatEnd()` handles victory logic (currently puts loot in player.tags)
- `src/state/scene-store.ts` — SceneState schema (add `droppedItems` field)
- `src/engine/action-handlers/` — action handler registry (add `:take` handler)
- `src/engine/scene-manager.ts` — `:look` display logic
- `src/persistence/serializer.ts` — save/load schema (needs droppedItems)

## Decisions

### LOOT-01: loot_table 字段命名
**决策：** 将 `enemies.yaml` 中所有敌人的 `loot` 字段重命名为 `loot_table`。内容保持字符串数组不变（`[item_id, ...]`），无概率权重扩展。EnemySchema 同步更新字段名。

**理由：** 满足 ROADMAP GAME-01 的命名要求，同时保持实现最简单。

### LOOT-02: 战利品掉落至场景
**决策：** `SceneState` 新增 `droppedItems: string[]`（默认 `[]`）。

- `combat-loop.ts` 的 `checkCombatEnd()` 在胜利时：将 `loot_table` 物品写入 `sceneStore.droppedItems`，**不再** push 到 `player.tags`
- `:look` 展示场景时，若 `droppedItems` 非空，单独列出掉落物品（如：「地上有：灰狼皮」）
- `droppedItems` 跟随场景切换重置（离开场景后物品消失）——简单策略，不需要跨场景持久化
- 存档序列化需包含当前场景的 `droppedItems`

**理由：** 语义清晰，与 `objects[]`（固定场景物件）不混淆，`:take` 逻辑简单。

### LOOT-03: :take 命令
**决策：** 新增 `:take [item_id]` 命令，只能取 `droppedItems` 中的物品。

- 成功：从 `droppedItems` 移除该物品，加入 `player.tags`（`item:${itemId}`），输出「你拾起了 [物品名]。」
- 目标不存在或已被取走：返回错误「地上没有该物品。」
- 不带参数：若 `droppedItems` 只有一个物品，自动取；若有多个，列出并提示指定
- `:take` 不能取 `objects[]`（固定场景物件如 notice_board）

**理由：** 行为明确，避免误操作取走非战利品物件。

### ITEMS-01: items.yaml 无需修改
**发现：** 检查确认 `item_wolf_pelt`、`item_short_bow`、`item_lockpick_set`、`item_healing_potion`、`item_iron_sword` 全部已存在，字段完整（item_type、value、description）。

## Codebase Context

**已有基础（可复用）：**
- `combat-loop.ts:525-533`：loot 读取逻辑已存在，只需将目标从 `player.tags` 改为 `sceneStore.droppedItems`
- `src/engine/action-handlers/use-item-handler.ts`：`:use_item` 处理器，`:take` 参照此模式新建
- `SceneState.objects: string[]`：现有场景物件字段，`droppedItems` 同类型

**需要修改的文件：**
1. `world-data/codex/enemies.yaml` — `loot` → `loot_table`（5 个敌人）
2. `src/codex/schemas/entry-types.ts` — `EnemySchema` 字段重命名
3. `src/state/scene-store.ts` — 新增 `droppedItems` 字段 + 默认值
4. `src/engine/combat-loop.ts` — `checkCombatEnd()` loot 写入目标改为 `sceneStore.droppedItems`
5. `src/engine/action-handlers/take-handler.ts` — 新建 `:take` 处理器
6. `src/engine/action-handlers/index.ts` or registry — 注册 `take` handler
7. `src/engine/scene-manager.ts` — `:look` 输出加入 droppedItems 展示
8. `src/persistence/serializer.ts` — SaveData schema 加入 droppedItems

## Success Criteria (from ROADMAP)

1. 至少一个敌人在 YAML 中有 `loot_table` 字段
2. 击杀该敌人后 `:look` 能看到掉落物品
3. 玩家可 `:take [item]` 将物品移入背包，存档/读档后物品持久化

## Deferred Ideas

- 概率掉落（带 weight 的 loot_table 对象）— 可在后续版本扩展
- `:take all` 一次性捡起全部物品
- 离开场景后物品持久化（跨场景寻宝）
