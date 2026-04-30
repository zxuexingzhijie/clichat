---
phase: 20-enemy-loot-system
plan: 02
type: execute
wave: 2
depends_on:
  - "20-P01"
files_modified:
  - src/engine/combat-loop.ts
  - src/engine/action-handlers/take-handler.ts
  - src/engine/action-handlers/index.ts
  - src/engine/scene-manager.ts
autonomous: true
requirements:
  - GAME-01

must_haves:
  truths:
    - "击杀敌人后 sceneStore.droppedItems 含敌人的 loot_table 物品"
    - ":take [item_id] 成功时从 droppedItems 移除并加入 player.tags"
    - ":look 无参数时若 droppedItems 非空，输出「地上有：[物品名]」"
    - ":take 不带参数且只有一个物品时自动拾取"
    - ":take 不带参数且多个物品时列出并提示指定"
    - "不存在的物品返回「地上没有该物品。」"
  artifacts:
    - path: "src/engine/action-handlers/take-handler.ts"
      provides: "handleTake ActionHandler"
      exports: ["handleTake"]
    - path: "src/engine/action-handlers/index.ts"
      provides: "take 注册到 HANDLER_MAP"
      contains: "take: handleTake"
    - path: "src/engine/combat-loop.ts"
      provides: "战利品写入 droppedItems 而非 player.tags"
      contains: "droppedItems"
    - path: "src/engine/scene-manager.ts"
      provides: "handleLook 展示 droppedItems"
      contains: "droppedItems"
  key_links:
    - from: "combat-loop.ts checkCombatEnd"
      to: "stores.scene.droppedItems"
      via: "stores.scene.setState 不可变写入"
      pattern: "draft\\.droppedItems"
    - from: "take-handler.ts handleTake"
      to: "ctx.stores.scene.droppedItems"
      via: "filter 移除 + player.tags 追加"
      pattern: "droppedItems.filter"
    - from: "scene-manager.ts handleLook"
      to: "state.droppedItems"
      via: "length > 0 后 push narration line"
      pattern: "droppedItems\\.length"
---

<objective>
将战斗胜利的战利品写入 sceneStore.droppedItems（而非 player.tags），新建 :take 命令处理器，并在 :look 输出中展示掉落物品。

Purpose: 完成玩家可见的战利品流程——打倒敌人 → 场景显示掉落物 → 玩家捡起 → 进入背包。
Output: combat-loop.ts 修改、take-handler.ts 新建、index.ts 注册、scene-manager.ts 更新。
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/20-enemy-loot-system/20-P01-SUMMARY.md

<interfaces>
<!-- 来自 P01 建立的契约，执行者直接使用，无需重新探索代码库 -->

From src/state/scene-store.ts (after P01):
```typescript
export const SceneStateSchema = z.object({
  sceneId: z.string(),
  locationName: z.string(),
  narrationLines: z.array(z.string()),
  actions: z.array(SceneActionSchema),
  npcsPresent: z.array(z.string()),
  exits: z.array(z.string()),
  exitMap: z.record(z.string(), z.string()),
  objects: z.array(z.string()),
  droppedItems: z.array(z.string()).default([]),
});
export type SceneState = z.infer<typeof SceneStateSchema>;
```

From src/codex/schemas/entry-types.ts (after P01):
```typescript
export const EnemySchema = z.object({
  ...baseFields,
  type: z.literal("enemy"),
  hp: z.number().int().min(1),
  maxHp: z.number().int().min(1),
  attack: z.number().int(),
  defense: z.number().int(),
  dc: z.number().int().min(1),
  damage_base: z.number().int().min(0),
  abilities: z.array(z.string()),
  loot_table: z.array(z.string()).optional(),  // renamed from loot
  danger_level: z.number().min(0).max(10),
});
export type Enemy = z.infer<typeof EnemySchema>;
```

From src/engine/action-handlers/types.ts:
```typescript
export type ActionHandler = (
  action: GameAction,
  ctx: ActionContext,
) => Promise<ProcessResult>;

// ActionContext has: stores.player, stores.scene, stores.game, stores.combat, codexEntries
```

From src/engine/action-handlers/use-item-handler.ts (模板):
```typescript
import type { Item } from '../../codex/schemas/entry-types';
import type { ActionHandler } from './types';

export const handleUseItem: ActionHandler = async (action, ctx) => {
  const itemId = action.target;
  if (!itemId) {
    return { status: 'error', message: '请指定要使用的物品。' };
  }
  if (!ctx.codexEntries) {
    return { status: 'error', message: '世界数据未加载。' };
  }
  const entry = ctx.codexEntries.get(itemId);
  if (!entry || entry.type !== 'item') {
    return { status: 'error', message: `未知物品: ${itemId}。` };
  }
  const item = entry as Item;
  // ... state writes ...
  const currentLines = ctx.stores.scene.getState().narrationLines;
  const newLines = [...currentLines, narrationLine];
  ctx.stores.scene.setState(draft => { draft.narrationLines = newLines; });
  ctx.stores.game.setState(draft => { draft.turnCount += 1; });
  return { status: 'action_executed', action, narration: newLines };
};
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: combat-loop.ts — 战利品写入 droppedItems</name>
  <files>src/engine/combat-loop.ts, src/engine/combat-loop.test.ts</files>
  <read_first>
    - src/engine/combat-loop.ts (lines 510–560，定位 checkCombatEnd loot 写入块)
    - src/engine/combat-loop.test.ts (定位现有战斗胜利测试，了解测试结构)
  </read_first>
  <behavior>
    - 测试 1：击败含 loot_table: ['item_wolf_pelt'] 的敌人后，scene store droppedItems 含 'item_wolf_pelt'
    - 测试 2：击败含 loot_table: ['item_wolf_pelt'] 的敌人后，player.tags 不包含 'item:item_wolf_pelt'（战利品不再直接入包）
    - 测试 3：击败 loot_table 为空/undefined 的敌人，droppedItems 保持 []
  </behavior>
  <action>
**TDD 流程：先写测试（RED），再改实现（GREEN）。**

**RED — 在 combat-loop.test.ts 中添加测试：**

找到现有战斗胜利相关测试块，追加以下测试（若文件结构不明，在最后新增 describe 块）：

```typescript
describe('loot drop on enemy defeat', () => {
  it('writes loot_table items to scene droppedItems', async () => {
    // mock enemy with loot_table: ['item_wolf_pelt']
    // run checkCombatEnd with enemy HP <= 0
    // assert sceneStore.getState().droppedItems includes 'item_wolf_pelt'
  });

  it('does NOT add loot to player.tags', async () => {
    // same setup
    // assert player.tags has no 'item:item_wolf_pelt'
  });

  it('does nothing when loot_table is empty', async () => {
    // enemy with loot_table: [] or undefined
    // assert droppedItems remains []
  });
});
```

**GREEN — 修改 combat-loop.ts checkCombatEnd loot 块（lines 525–533）：**

将：
```typescript
const lootItems = enemyData?.loot ?? [];
for (const itemId of lootItems) {
  stores.player.setState(draft => {
    draft.tags = [...draft.tags, `item:${itemId}`];
  });
}
```
改为：
```typescript
const lootItems = enemyData?.loot_table ?? [];
for (const itemId of lootItems) {
  stores.scene.setState(draft => {
    draft.droppedItems = [...draft.droppedItems, itemId];
  });
}
```

注意：不可变更新——始终用展开运算符，不用 push。
  </action>
  <verify>
    <automated>bun test src/engine/combat-loop.test.ts 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep "loot_table" src/engine/combat-loop.ts` 有输出（读 loot_table 字段）
    - `grep "loot\b" src/engine/combat-loop.ts` 仅匹配变量名，不再有 `enemyData?.loot` 的旧字段读取
    - `grep "droppedItems" src/engine/combat-loop.ts` 有输出（写入 droppedItems）
    - `grep "player.tags.*item:" src/engine/combat-loop.ts` 无输出（不再直接写 player.tags）
    - 3 个新增 loot drop 测试全部通过
    - `bun test src/engine/combat-loop.test.ts` 无回归失败
  </acceptance_criteria>
  <done>combat-loop.ts 战利品写入 droppedItems，不再写入 player.tags；相关测试通过。</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: take-handler.ts 新建 + action-handlers/index.ts 注册</name>
  <files>
    src/engine/action-handlers/take-handler.ts,
    src/engine/action-handlers/take-handler.test.ts,
    src/engine/action-handlers/index.ts
  </files>
  <read_first>
    - src/engine/action-handlers/use-item-handler.ts (结构模板，已在 context 中提供)
    - src/engine/action-handlers/index.ts (确认 HANDLER_MAP 当前内容)
    - src/engine/action-handlers/types.ts (确认 ActionContext 字段)
  </read_first>
  <behavior>
    - 测试 1：target 为 'item_wolf_pelt'，droppedItems 含该物品 → status: 'action_executed'，droppedItems 不再含该物品，player.tags 含 'item:item_wolf_pelt'
    - 测试 2：target 为不存在的 ID → { status: 'error', message: '地上没有该物品。' }
    - 测试 3：无 target，droppedItems 只有 1 个物品 → 自动拾取该物品（同测试 1 行为）
    - 测试 4：无 target，droppedItems 有 2+ 个物品 → { status: 'error', message 含物品列表并提示指定 }
    - 测试 5：无 target，droppedItems 为空 → { status: 'error', message: '地上没有可拾取的物品。' }
    - 测试 6：codexEntries 未加载 → { status: 'error', message: '世界数据未加载。' }
  </behavior>
  <action>
**TDD 流程：先写测试，再写实现。**

**RED — 新建 take-handler.test.ts：**

参照 use-item-handler.test.ts 的 mock 结构（若存在），或手动 mock ActionContext：

```typescript
import { handleTake } from './take-handler';

const makeMockCtx = (overrides?: Partial<{
  droppedItems: string[];
  playerTags: string[];
  codexEntries: Map<string, unknown>;
}>) => {
  // 构建 mock stores: scene.getState().droppedItems, player.getState().tags, game
  // 构建 mock codexEntries: Map with item entry { type: 'item', name: '灰狼皮' }
};

describe('handleTake', () => {
  // 6 个测试用例
});
```

**GREEN — 新建 take-handler.ts：**

```typescript
import type { Item } from '../../codex/schemas/entry-types';
import type { ActionHandler } from './types';

export const handleTake: ActionHandler = async (action, ctx) => {
  if (!ctx.codexEntries) {
    return { status: 'error', message: '世界数据未加载。' };
  }

  const sceneState = ctx.stores.scene.getState();
  const droppedItems = sceneState.droppedItems;

  // 解析目标 itemId（含无参数自动选择逻辑）
  let itemId: string | undefined = action.target;

  if (!itemId) {
    if (droppedItems.length === 0) {
      return { status: 'error', message: '地上没有可拾取的物品。' };
    }
    if (droppedItems.length === 1) {
      itemId = droppedItems[0];
    } else {
      const names = droppedItems.map(id => {
        const e = ctx.codexEntries!.get(id);
        return (e as Item | undefined)?.name ?? id;
      }).join('、');
      return { status: 'error', message: `地上有多个物品：${names}。请指定要拾取的物品。` };
    }
  }

  if (!droppedItems.includes(itemId)) {
    return { status: 'error', message: '地上没有该物品。' };
  }

  const entry = ctx.codexEntries.get(itemId);
  const itemName = (entry as Item | undefined)?.name ?? itemId;

  // 不可变写入：从 droppedItems 移除
  ctx.stores.scene.setState(draft => {
    draft.droppedItems = draft.droppedItems.filter(id => id !== itemId);
  });

  // 不可变写入：加入 player.tags
  ctx.stores.player.setState(draft => {
    draft.tags = [...draft.tags, `item:${itemId}`];
  });

  const narrationLine = `你拾起了${itemName}。`;
  const currentLines = ctx.stores.scene.getState().narrationLines;
  const newLines = [...currentLines, narrationLine];
  ctx.stores.scene.setState(draft => {
    draft.narrationLines = newLines;
  });

  ctx.stores.game.setState(draft => {
    draft.turnCount += 1;
  });

  return { status: 'action_executed', action, narration: newLines };
};
```

**index.ts — 注册 take handler：**

1. 在 import 区追加：
```typescript
import { handleTake } from './take-handler';
```

2. 在 HANDLER_MAP 的 `use_item: handleUseItem,` 之后追加：
```typescript
  take: handleTake,
```

注意：`take` 不是战斗动作，不加入 `COMBAT_ACTIONS` set。
  </action>
  <verify>
    <automated>bun test src/engine/action-handlers/take-handler.test.ts 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `ls src/engine/action-handlers/take-handler.ts` 文件存在
    - `grep "handleTake" src/engine/action-handlers/index.ts` 至少 2 处（import + HANDLER_MAP 赋值）
    - `grep "take: handleTake" src/engine/action-handlers/index.ts` 有输出
    - `grep "COMBAT_ACTIONS" src/engine/action-handlers/index.ts | grep "take"` 无输出（take 不是战斗动作）
    - 6 个 take-handler 测试全部通过（GREEN）
    - `bun test src/engine/action-handlers/` 无回归失败
  </acceptance_criteria>
  <done>take-handler.ts 已建立并覆盖所有 6 个行为场景；index.ts 已注册 take handler；测试全通过。</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: scene-manager.ts handleLook — 展示 droppedItems</name>
  <files>src/engine/scene-manager.ts</files>
  <read_first>
    - src/engine/scene-manager.ts (lines 268–310，handleLook 函数完整逻辑)
  </read_first>
  <action>
在 `handleLook(target?: string)` 函数中，找到无 target 分支。

该分支当前在 `generateNarrationFn` 缺失时返回：
```typescript
return { status: 'success', narration: state.narrationLines };
```

需要在返回前注入 droppedItems 展示逻辑。

**精确注入点：** 在所有现有逻辑（worldFlags override、generateNarrationFn 调用）执行完毕后，在 `return { status: 'success', narration: state.narrationLines }` 之前，添加以下逻辑：

```typescript
const dropped = state.droppedItems;
if (dropped.length > 0) {
  const names = dropped.map(id => {
    const entry = queryById(codexEntries, id);
    return entry?.name ?? id;
  }).join('、');
  const dropLine = `地上有：${names}`;
  const updatedLines = capNarrationLines([...state.narrationLines, dropLine]);
  stores.scene.setState(draft => {
    draft.narrationLines = updatedLines;
  });
  return { status: 'success', narration: updatedLines };
}
return { status: 'success', narration: state.narrationLines };
```

注意：
- `queryById` 已在 scene-manager.ts 中导入/可用（PATTERNS.md lines 296 确认）
- `capNarrationLines` 已在 scene-manager.ts 中可用（现有 handleLook 代码使用了该函数）
- 若 `generateNarrationFn` 存在路径也需要能展示 droppedItems：在 `generateNarrationFn` 分支中，`narration` 生成后同样追加 droppedItems 行（若非空）。做法：在 AI narration 写回 `newLines` 之后，追加相同的 droppedItems 处理（check dropped，push dropLine，写回 store，更新 newLines）。
  </action>
  <verify>
    <automated>grep -n "droppedItems" src/engine/scene-manager.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "droppedItems" src/engine/scene-manager.ts` 输出 >= 2（至少在无 AI 路径和有 AI 路径各出现一次）
    - `grep "地上有" src/engine/scene-manager.ts` 有输出（含中文展示字符串）
    - `bun test src/engine/scene-manager` 通过（若该测试文件存在）
    - `bun test` 全量无回归（1062+ tests）
  </acceptance_criteria>
  <done>handleLook 无 target 时，若 droppedItems 非空，在叙述行末追加「地上有：[物品名]」；现有测试无回归。</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| 玩家输入 action.target → take-handler | 玩家输入的 item_id 不可信，需与 droppedItems 实际内容核对 |
| codexEntries → item 展示 | 从 codex 读取的 item.name 用于展示，不用于状态决策 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20-03 | Tampering | handleTake action.target | mitigate | 以 droppedItems.includes(itemId) 校验，不在列表中则拒绝；item ID 从场景状态读取，不相信玩家输入的 ID 直接写入 |
| T-20-04 | Elevation of Privilege | take-handler 绕过 Rules Engine | accept | take 是简单状态转移（droppedItems→player.tags），无需 Rules Engine 仲裁；不影响 combat/faction 逻辑 |
| T-20-05 | Denial of Service | droppedItems 无限积累 | accept | droppedItems 在场景切换时重置（P01 SceneState 默认值 []），且通过 capNarrationLines 控制叙述行长度 |
</threat_model>

<verification>
1. `bun test src/engine/combat-loop.test.ts` → loot drop 测试 3 个通过
2. `bun test src/engine/action-handlers/take-handler.test.ts` → 6 个场景测试通过
3. `grep "take: handleTake" src/engine/action-handlers/index.ts` → 有输出
4. `grep "droppedItems" src/engine/scene-manager.ts` → 至少 2 处
5. `bun test` → 全量通过，无回归
6. `bun tsc --noEmit` → 无新增类型错误
</verification>

<success_criteria>
- 战斗胜利时战利品写入 sceneStore.droppedItems，不再直接写 player.tags
- :take [item_id] 功能完整：拾取成功、目标不存在、无参自动选择三种情况均正确处理
- :look 展示 droppedItems 中的物品（若非空）
- 全量测试通过，无回归
</success_criteria>

<output>
完成后创建 `.planning/phases/20-enemy-loot-system/20-P02-SUMMARY.md`
</output>
