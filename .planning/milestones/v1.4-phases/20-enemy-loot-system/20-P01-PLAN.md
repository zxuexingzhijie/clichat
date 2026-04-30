---
phase: 20-enemy-loot-system
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - world-data/codex/enemies.yaml
  - src/codex/schemas/entry-types.ts
  - src/state/scene-store.ts
autonomous: true
requirements:
  - GAME-01

must_haves:
  truths:
    - "EnemySchema 中 loot_table 字段存在，loot 字段已消失"
    - "SceneState 类型包含 droppedItems: string[] 字段，默认值为 []"
    - "enemies.yaml 中所有 5 个敌人条目的 loot 字段已重命名为 loot_table"
  artifacts:
    - path: "world-data/codex/enemies.yaml"
      provides: "5 个敌人条目含 loot_table 字段"
      contains: "loot_table:"
    - path: "src/codex/schemas/entry-types.ts"
      provides: "EnemySchema 含 loot_table 字段"
      exports: ["EnemySchema", "Enemy"]
    - path: "src/state/scene-store.ts"
      provides: "SceneStateSchema 含 droppedItems 字段"
      exports: ["SceneStateSchema", "SceneState", "getDefaultSceneState"]
  key_links:
    - from: "src/codex/schemas/entry-types.ts EnemySchema"
      to: "world-data/codex/enemies.yaml"
      via: "loot_table 字段名必须一致"
      pattern: "loot_table"
    - from: "src/state/scene-store.ts SceneStateSchema"
      to: "src/engine/combat-loop.ts"
      via: "stores.scene.setState droppedItems (Wave 2 使用)"
      pattern: "droppedItems"
---

<objective>
重命名 enemies.yaml + EnemySchema 中的 loot 字段为 loot_table，并在 SceneStateSchema 中新增 droppedItems 字段。

Purpose: 建立 Wave 2 所需的数据契约——combat-loop 读 loot_table，take-handler 写/读 droppedItems。
Output: 三个修改后的文件，类型检查通过，现有测试不回归。
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: enemies.yaml — loot → loot_table 重命名</name>
  <files>world-data/codex/enemies.yaml</files>
  <read_first>
    - world-data/codex/enemies.yaml (确认当前所有 loot 字段位置及值)
  </read_first>
  <action>
将文件中所有 5 个敌人条目的 `loot:` 字段重命名为 `loot_table:`。字段值（字符串数组）不变。

涉及敌人（按 PATTERNS.md 记录）：grey_wolf、bandit_scout、dark_cultist、shadow_hound、elder_troll（或文件中实际存在的 5 个 enemy 条目）。

每处改动仅将 `  loot:` 替换为 `  loot_table:`，缩进保持一致（2 空格）。不增删任何物品 ID。
  </action>
  <verify>
    <automated>grep -c "loot_table:" world-data/codex/enemies.yaml</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "loot_table:" world-data/codex/enemies.yaml` 输出 5（或等于敌人条目数）
    - `grep "^  loot:" world-data/codex/enemies.yaml` 无输出（旧字段名已全部消除）
    - 文件内容中各条目 loot_table 下仍为 YAML 字符串数组（`- item_*` 格式）
  </acceptance_criteria>
  <done>enemies.yaml 中所有 loot 字段均已重命名为 loot_table，无旧字段残留。</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: EnemySchema — loot → loot_table + SceneStateSchema — 新增 droppedItems</name>
  <files>src/codex/schemas/entry-types.ts, src/state/scene-store.ts</files>
  <read_first>
    - src/codex/schemas/entry-types.ts (确认 EnemySchema 当前字段，lines 113–128)
    - src/state/scene-store.ts (确认 SceneStateSchema 和 getDefaultSceneState 当前内容)
  </read_first>
  <action>
**entry-types.ts（EnemySchema 字段重命名）：**

将 EnemySchema 中的：
```typescript
  loot: z.array(z.string()).optional(),
```
改为：
```typescript
  loot_table: z.array(z.string()).optional(),
```
其余字段不动。`Enemy` 类型通过 `z.infer<typeof EnemySchema>` 自动更新，无需手动修改类型导出。

**scene-store.ts（新增 droppedItems）：**

1. 在 `SceneStateSchema` 的 `z.object({ ... })` 中，在 `objects: z.array(z.string()),` 之后追加：
```typescript
  droppedItems: z.array(z.string()).default([]),
```

2. 在 `getDefaultSceneState()` 的返回对象中，在 `objects: ['notice_board', 'oil_lamp'],` 之后追加：
```typescript
    droppedItems: [],
```

`SceneState` 类型通过 `z.infer<typeof SceneStateSchema>` 自动更新，无需手动修改。
  </action>
  <verify>
    <automated>bun tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep "loot_table" src/codex/schemas/entry-types.ts` 有输出
    - `grep "^  loot:" src/codex/schemas/entry-types.ts` 无输出
    - `grep "droppedItems" src/state/scene-store.ts` 有输出（出现在 SceneStateSchema 和 getDefaultSceneState 两处）
    - `bun tsc --noEmit` 无新增类型错误（原有 3 个预存错误可保留）
    - `bun test src/state/scene-store` 通过（若该测试文件存在）
  </acceptance_criteria>
  <done>EnemySchema.loot_table 字段存在；SceneStateSchema.droppedItems 字段存在且默认值为 []；TypeScript 编译无新增错误。</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| YAML 解析 → EnemySchema | enemies.yaml 是静态内容文件，由开发者控制，非玩家输入 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20-01 | Tampering | enemies.yaml loot_table | accept | 文件由开发者管理，git 版本控制，非运行时可修改内容 |
| T-20-02 | Information Disclosure | droppedItems in SceneState | accept | droppedItems 仅含 item ID 字符串，无敏感数据 |
</threat_model>

<verification>
1. `grep -c "loot_table:" world-data/codex/enemies.yaml` → 等于文件中 enemy 条目数（至少 5）
2. `grep "^  loot:" world-data/codex/enemies.yaml` → 空输出
3. `grep "loot_table" src/codex/schemas/entry-types.ts` → 有输出
4. `grep "droppedItems" src/state/scene-store.ts` → 至少 2 处
5. `bun tsc --noEmit 2>&1 | grep -v "summarizer-worker\|quest-handler.test\|game-loop.test"` → 无额外错误
6. `bun test` → 全部通过（1062+ tests）
</verification>

<success_criteria>
- enemies.yaml 中 loot 字段全部改为 loot_table，无旧字段残留
- EnemySchema 中 loot_table: z.array(z.string()).optional() 存在
- SceneStateSchema 中 droppedItems: z.array(z.string()).default([]) 存在
- getDefaultSceneState() 返回值含 droppedItems: []
- TypeScript 编译无新增错误，现有测试全部通过
</success_criteria>

<output>
完成后创建 `.planning/phases/20-enemy-loot-system/20-P01-SUMMARY.md`
</output>
