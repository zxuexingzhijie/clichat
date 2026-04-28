# Phase 12: Combat & Save Correctness - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix 9 known bugs in the combat system (COMBAT-01..06) and save/branch system (SAVE-01..03). All systems already exist — this phase only fixes incorrect behavior. No new features.

**Not in scope:** Dialogue/reputation fixes (Phase 13), quest content (Phase 14), NPC content gaps (Phase 15).

</domain>

<decisions>
## Implementation Decisions

### COMBAT-01/02: Double enemy turn & flee still triggers enemy turn

- **D-01:** `combat-handler.ts` 中删除无条件的 `processEnemyTurn()` 调用（行 19）。
  保留 `game-screen-controller.ts` 的调用点（有 `phase === 'enemy_turn'` 检查保护）。
- **D-02:** `game-screen-controller.ts` 在调用 `processEnemyTurn()` 前，追加对 `combatResult.outcome` 的检查：仅当 outcome 不是 `'flee'` 且战斗未结束时才调用。

### COMBAT-03: 战斗发起逻辑

- **D-03:** 两路都实现：
  1. **自动触发**：`move-handler.ts` 处理 `:go` 时，检测目标场景 codex entry 的 `enemies[]` 字段，若非空则调用 `ctx.combatLoop.startCombat(enemyIds)`。
  2. **显式 `:attack NPC`**：`combat-handler.ts` 检查 NPC 类型是否为 `enemy`（通过 codex），若是则调用 `startCombat([npcId])`，随后继续战斗流程。
- **D-04:** 如果战斗已在进行中（`getCombatPhase() !== null`），移动到危险场景时不重复触发 `startCombat`。

### COMBAT-04: 敌方能力 — 完整实现

- **D-05:** `processEnemyTurn` 读取 enemy codex entry 的 `abilities[]` 字段，对以下所有已定义能力实现效果：
  - `pack_tactics`：多敌在场时攻击加成
  - `howl`：降低玩家下回合伤害减免
  - `backstab`：首次攻击必定暴击
  - `poison_blade`：造成持续毒伤
  - `vanish`：逃出战斗（如同玩家 flee）
- **D-06:** 未知能力类型静默跳过（forward-compatible）。

### COMBAT-05: 法术系统 — 完整实现

- **D-07:** `/cast <spell>` 从 `spells.yaml` 读取对应法术的 `mp_cost`、`effect_type`（`damage`/`heal`/`buff`）、`base_value`。
- **D-08:** 治疗法术（`effect_type: 'heal'`）恢复 HP，攻击法术（`effect_type: 'damage'`）造成伤害，不再使用固定常量。
- **D-09:** 法术名称传入 narration context，叙事中应体现施法行为（"你施放了 X 法术"）。
- **D-10:** MP 不足时返回错误消息（中文），不扣 MP，不消耗回合。

### COMBAT-06: use_item phase 卡死

- **D-11:** `processPlayerAction` 整体加 try/catch，异常时将 `combat.phase` reset 回 `'player_turn'`，确保任何运行时错误不会让战斗永久卡在 `'resolving'`。

### SAVE-01: snapshot() 参数化

- **D-12:** `snapshot()` 方法接受可选参数 `saveName?: string`（默认 `'Quick Save'`）。
- **D-13:** `createSerializer` 接受 `getPlaytime: () => number` 回调（或 `sessionStartTime: number`），`snapshot()` 内计算实际 playtime（毫秒转秒/分钟）。
- **D-14:** 所有调用 `snapshot()` 的地方（`quickSave`、`saveGame`）透传 `saveName`。

### SAVE-02: branch switch 加载存档状态

- **D-15:** `branch-handler.ts` 的 switch 分支：
  1. 取得 `branchMeta.headSaveId`
  2. 若 `headSaveId` 为 null → 返回错误消息"该分支没有存档可恢复"
  3. 若有 → 构造文件路径，调用 `ctx.saveFileManager.loadGame(filePath, ctx.serializer, ctx.saveDir)`
- **D-16:** `branch-handler` 依赖项（`saveFileManager`、`serializer`、`saveDir`）已通过 Phase 11 的 `createGameLoop` 选项注入，`ctx` 已可访问。

### SAVE-03: load path traversal 修复

- **D-17:** `load-handler.ts` 调用 `loadGame()` 时传第三个参数 `ctx.saveDir`，确保路径穿越检查生效。
- **D-18:** 一行修复：`ctx.saveFileManager.loadGame(filePath, ctx.serializer, ctx.saveDir)`。

### Claude's Discretion

- 具体 narration 模板内容（只需符合中文优先原则）
- `getPlaytime` 回调的具体实现方式（传入 startTime 还是函数）
- 能力效果数值（参考 YAML，合理即可）
- 法术未找到时的错误消息措辞

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 战斗系统
- `src/engine/combat-loop.ts` — `processEnemyTurn`、`processPlayerAction`、`startCombat`、`getCombatPhase` 实现
- `src/engine/action-handlers/combat-handler.ts` — 当前双重 processEnemyTurn 调用点（行 19 需删除）
- `src/engine/game-screen-controller.ts` — screen-controller 的 `processEnemyTurn` 调用（行 214-215，保留并加 flee 检查）
- `src/engine/action-handlers/move-handler.ts` — 需在此添加自动战斗触发
- `src/codex/schemas/entry-types.ts` — Enemy schema，abilities[] 字段定义
- `world-data/codex/spells.yaml` — 法术数据（mp_cost, effect_type, base_value）

### 存档系统
- `src/state/serializer.ts` — `snapshot()` 行 111-121，hardcoded saveName/playtime（需参数化）
- `src/persistence/save-file-manager.ts` — `loadGame` 签名（行 52），第三个参数 saveDir
- `src/engine/action-handlers/branch-handler.ts` — switch 分支（行 19-28，需加 loadGame 调用）
- `src/engine/action-handlers/load-handler.ts` — loadGame 调用（行 3-9，需传 ctx.saveDir）
- `src/state/branch-store.ts` — `BranchMeta.headSaveId` 字段

</canonical_refs>

<code_context>
## Existing Code Insights

### Bug 精确位置
- `combat-handler.ts:19` — 无条件 `processEnemyTurn()` 调用（COMBAT-01 根因）
- `game-screen-controller.ts:214` — 有 phase 检查的 `processEnemyTurn()` 调用（保留并加 flee 检查）
- `combat-loop.ts:120-122` — `processPlayerAction` 在处理具体动作前设 phase 为 `resolving`（COMBAT-06 风险点）
- `serializer.ts:111-121` — hardcoded `saveName: 'Quick Save'`, `playtime: 0`（SAVE-01 根因）
- `branch-handler.ts:19-28` — switch 只更新 branchId，无 loadGame 调用（SAVE-02 根因）
- `load-handler.ts:3-9` — loadGame 调用缺少第三个参数 saveDir（SAVE-03 根因）

### 已注入的依赖（Phase 11 成果）
- `ctx.saveFileManager`：`{ quickSave, saveGame, loadGame }` — Phase 11 P01 已注入
- `ctx.serializer`：`Serializer` 实例 — Phase 11 P01 已注入
- `ctx.saveDir`：`string` — Phase 11 P01 已注入
- `ctx.combatLoop.startCombat` — `CombatLoop` 接口已定义，需要调用

### 模式
- 所有 handler 通过 `ctx` 访问依赖，不直接 import 单例
- 错误消息用中文（"你现在不在战斗中"、"MP 不足"）
- 不可变状态：所有 store 更新走 `setState(draft => ...)`

</code_context>

<specifics>
## Specific Ideas

- COMBAT-04/05 完整实现所有 YAML 定义的能力和法术（不是骨架验证）
- COMBAT-03 两路触发：自动（进入危险场景）+ 显式（`:attack NPC`）
- SAVE-02 branch switch 无 headSaveId 时要给清晰的中文错误消息

</specifics>

<deferred>
## Deferred Ideas

- 法术系统扩展（新法术类型、连击法术）— v1.3
- 能力系统扩展（自定义能力触发条件）— v1.3
- 存档自动清理/轮换 — v1.3

</deferred>

---

*Phase: 12-combat-save-correctness*
*Context gathered: 2026-04-28*
