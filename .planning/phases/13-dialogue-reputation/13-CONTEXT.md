# Phase 13: Dialogue & Reputation — Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix 11 known bugs in the dialogue system (DIAL-01..07) and reputation system (REP-01..04). All systems already exist — this phase only fixes incorrect behavior. No new features.

**In scope:** Reputation scale unification, inline dialogue text input, NPC role questions, streaming sentiment, endDialogue delta write, restore spurious events, faction reputation write path.

**Not in scope:** New dialogue types, new NPC content (Phase 15), quest dialogue (Phase 14), AI narration changes.

</domain>

<decisions>
## Implementation Decisions

### DIAL-01 / REP-04: 声望数值统一到 -100..+100

- **D-01:** 统一 scale 为 -100..+100 整数（与 `NpcDispositionSchema` 已有约束一致）。
- **D-02:** `sentimentToDelta` 改为返回整数：`positive → +10`, `neutral → 0`, `negative → -10`, `hostile → -20`。
- **D-03:** 删除 `dialogue-panel.tsx` 中重复的 `relationshipLabel` 函数，改为直接导入并调用 `getAttitudeLabel`（来自 `reputation-system.ts`）。

### DIAL-02: 内联对话输入框

- **D-04:** `dialogue-panel.tsx` 增加 `TextInput`（来自 `@inkjs/ui`），玩家可以直接打字回复 NPC。
- **D-05:** 输入框与编号选项同时显示。当 TextInput 激活时（玩家开始打字），屏蔽方向键/数字键的选项选择。按 Escape 退出文字输入模式，恢复方向键选项操作。
- **D-06:** TextInput 的值提交后，通过 `talk-handler` 的现有 NL 路径处理（与命令行 `:talk NPC <message>` 相同流程）。

### DIAL-03: NPC 角色问题覆盖

- **D-07:** 在 `dialogue-manager.ts` 的 `NPC_ROLE_QUESTIONS` 中补充三个角色：
  - `innkeeper`: 询问房间、餐食、镇上消息等
  - `hunter`: 询问猎物、路径危险、怪物信息等
  - `clergy` / `religious`: clergy 直接映射到已有 `religious` 条目，或合并为一个键
- **D-08:** 修复 tag 匹配逻辑：将「只检查 `npc.tags[0]`」改为「检查所有 `npc.tags`，取第一个匹配的角色」。

### DIAL-04: Streaming 情绪提取

- **D-09:** 删除 `extractNpcMetadata` 中硬编码的 `sentiment: 'neutral'`。
- **D-10:** Streaming 完成后，若无法从文本可靠提取 sentiment，全量回退到 `generateNpcDialogue`（结构化调用），使用其返回的 `sentiment` 字段。这是已有的 fallback 路径，只需确保触发条件正确（不再因 sentiment 始终为 neutral 而阻止回退）。

### DIAL-05 / DIAL-07: endDialogue 只写 sentiment delta

- **D-11:** `dialogue-store.relationshipValue` 初始值改为 `0`（当前写的是 `initial_disposition + sentimentToDelta(...)`）。
- **D-12:** `startDialogue` 不写 `initial_disposition` 到 `dialogue-store.relationshipValue`；仅用 `initial_disposition` 决定 NPC 的初始态度标签（展示用）。
- **D-13:** `processPlayerResponse` 的每轮 sentimentToDelta 累加到 `relationshipValue`（从 0 开始累加）。
- **D-14:** `endDialogue` 将 `dialogue-store.relationshipValue`（纯 delta，不含 initial_disposition）写入 `relation-store`，作为 `applyReputationDelta` 的参数。

### REP-01: 存档加载不触发 reputation_changed

- **D-15:** `relation-store` 增加 `restoreState(data: RelationState): void` 专用方法，内部直接调用底层 setState，**跳过** onChange 的 `reputation_changed` 广播。
- **D-16:** `serializer.restore()` 对 relations 调用 `stores.relations.restoreState(data.relations)` 而非 `stores.relations.setState(...)`。
- **D-17:** 正常游戏中的 `setState`（用于真实声望变化）继续触发 onChange，不受影响。

### REP-02 / REP-03: 派系声望写入路径

- **D-18:** 在 `reputation-system.ts` 中增加 `applyFactionReputationDelta(stores, factionId, delta)` 函数（与 `applyReputationDelta` 对称）。
- **D-19:** `endDialogue` 如果 NPC 属于某派系（codex entry 有 `faction` 字段），同时调用 `applyFactionReputationDelta`（delta 为 npc delta 的一半，向下取整）。

### Claude's Discretion

- innkeeper/hunter/clergy 的具体中文问题内容（需符合世界设定，中文优先）
- TextInput 的占位符文案（「直接输入你的回应…」之类）
- clergy vs religious 的键名选择（合并或保留两个键都可）
- `generateNpcDialogue` fallback 触发条件的具体阈值

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 对话系统
- `src/engine/dialogue-manager.ts` — `startDialogue`, `processPlayerResponse`, `endDialogue`, `NPC_ROLE_QUESTIONS`
- `src/ui/panels/dialogue-panel.tsx` — 对话面板 UI，含 `relationshipLabel`（需删除）和 TextInput 插入点
- `src/ai/utils/metadata-extractor.ts` — `extractNpcMetadata`，sentiment 硬编码 'neutral'（line 33）
- `src/ui/hooks/use-npc-dialogue.ts` — streaming 完成后 fallback 逻辑（lines 62-82）
- `src/engine/action-handlers/talk-handler.ts` — 对话发起路径

### 声望系统
- `src/engine/reputation-system.ts` — `sentimentToDelta`（lines 3-12），`getAttitudeLabel`（lines 14-20），`applyReputationDelta`
- `src/state/relation-store.ts` — `NpcDispositionSchema`（min/max -100..+100），`onChange` 广播（lines 30-71）
- `src/state/dialogue-store.ts` — `relationshipValue` 字段（初始值需改为 0）
- `src/state/serializer.ts` — `restore()` 调用 relations setState 的位置

</canonical_refs>

<code_context>
## Existing Code Insights

### Bug 精确位置
- `reputation-system.ts:3-12` — sentimentToDelta 返回 ±0.2/0.4（需改为 ±10/20）
- `reputation-system.ts:14-20` — getAttitudeLabel 使用 -100..+100（正确，保留）
- `dialogue-panel.tsx:31-37` — 重复的 relationshipLabel 函数（使用 -1.0..+1.0，需删除）
- `dialogue-panel.tsx` — 无 TextInput，仅有数字键/方向键处理（需添加）
- `dialogue-manager.ts:37-44` — NPC_ROLE_QUESTIONS 缺少 innkeeper/hunter/clergy
- `dialogue-manager.ts:69` — tag 匹配仅检查 `npc.tags` 第一项（需改为全量检查）
- `metadata-extractor.ts:33` — `sentiment: 'neutral'` 硬编码（DIAL-04 根因）
- `dialogue-manager.ts:227` — startDialogue 写 `initial_disposition + delta` 到 relationshipValue（DIAL-05 根因）
- `dialogue-manager.ts:344` — endDialogue 将含 initial_disposition 的值写成 delta（DIAL-07 根因）
- `relation-store.ts:38-50` — onChange 在所有 setState 后广播 reputation_changed（REP-01 根因）
- `serializer.ts` — restore() 使用普通 setState（REP-01 触发点）

### 已注入的依赖（Phase 11/12 成果）
- `ctx.stores.relations` — RelationStore 实例（已注入）
- `stores.dialogue` — DialogueStore（dialogue-manager 直接使用）
- 错误消息用中文，状态更新走 `setState(draft => ...)`

</code_context>

<specifics>
## Specific Ideas

- DIAL-04 直接回退到 generateNpcDialogue（不尝试关键词匹配），避免引入新的 regex 维护成本
- D-15 restoreState 是最干净的修复方式，不污染正常的 onChange 路径
- dialogue-panel TextInput 和编号选项可以共存，类似 Chronicle 的双输入模式设计理念

</specifics>

<deferred>
## Deferred Ideas

- 对话历史记录/回放 — v1.3
- NPC 情绪可视化（头像表情变化） — v1.3
- 派系声望 UI 面板 — v1.3
- 关键词匹配 sentiment 提取（作为 generateNpcDialogue 的替代方案）— v1.3

</deferred>

---

*Phase: 13-dialogue-reputation*
*Context gathered: 2026-04-28*
