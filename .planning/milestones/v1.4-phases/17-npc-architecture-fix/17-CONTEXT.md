# Phase 17 Context — NPC Architecture Fix

## Phase Boundary

**Goal:** 修复两个关键架构漏洞：
1. `narrativeContext` 在 npc-actor.ts 被 `void` 丢弃，导致 v1.3 act/atmosphere 系统对 NPC 对话完全无效
2. NPC sentiment 直接变成 relationship delta，LLM 绕过 Rules Engine 修改游戏状态

**范围内：** npc-actor.ts 接线、buildNpcSystemPrompt 扩展、adjudicateTalkResult 新增、dialogue-manager 调用改写
**范围外：** NpcDialogueSchema 结构变更、存档格式、其他 AI 角色（narrative-director 等）、多轮对话（Phase 18）

---

## Implementation Decisions

### narrativeContext 注入方式

**决定：扩展 `buildNpcSystemPrompt` 第三参数**

```ts
function buildNpcSystemPrompt(
  npc: NpcProfile,
  trustLevel: number = 0,
  narrativeCtx?: NarrativePromptContext  // 新增可选参数
): string
```

在 system prompt 末尾追加 act 语气段落（当 narrativeCtx 存在时）：
```
当前故事阶段：{currentAct}
氛围：{atmosphereTags.join('、')}
请用符合当前氛围的语气说话。
```

**npc-actor.ts 改动：**
- 删除 `void narrativeContext;`
- `generateNpcDialogue` 中：`buildNpcSystemPrompt(npcProfile, trustLevel, narrativeContext)`
- `streamNpcDialogue` 同步修复：补上 `trustLevel` 参数（目前调用时缺失），并接受 `narrativeContext`

### adjudicateTalkResult 设计

**决定：rules-engine.ts 新增薄包装函数，内部复用 sentimentToDelta**

```ts
export function adjudicateTalkResult(
  sentiment: NpcSentiment
): { relationshipDelta: number } {
  return { relationshipDelta: sentimentToDelta(sentiment) };
}
```

**原因：**
- 在 LLM 输出和游戏状态之间建立明确边界
- 未来可在此处加条件逻辑（声望门槛、quest 状态修正等）无需改 dialogue-manager
- 符合 CLAUDE.md 核心原则："AI does NOT decide whether relationships change — the Rules Engine owns those decisions"

**dialogue-manager.ts 改动（第 487、595 行）：**
```ts
// 改前：
const newRelationship = state.relationshipValue + sentimentToDelta(npcDialogue.sentiment);

// 改后：
const newRelationship = state.relationshipValue + adjudicateTalkResult(npcDialogue.sentiment).relationshipDelta;
```

### 向下兼容策略

- `NpcDialogueSchema` 的 `sentiment` 字段**保留不动**（LLM 仍然输出 sentiment，只是消费方式变了）
- `buildNpcSystemPrompt` 第三参数为可选（`?`），现有调用不传时行为不变，测试无需全量修改
- `streamNpcDialogue` 的流式路径不返回 sentiment，不涉及关系变化逻辑，只补 trustLevel 参数

### Claude's Discretion

- act 语气段落的中文措辞由 planner 决定（参考 narrative-system.ts 的现有 act 描述）
- `adjudicateTalkResult` 的返回类型可扩展（如未来加 `factionDelta`），但本 phase 只实现 `relationshipDelta`

---

## Canonical References

- `src/ai/roles/npc-actor.ts` — void bug 所在，generateNpcDialogue + streamNpcDialogue
- `src/ai/prompts/npc-system.ts` — buildNpcSystemPrompt 实现
- `src/engine/dialogue-manager.ts:487,595` — sentiment 直接变 delta 的两处位置
- `src/engine/rules-engine.ts` — adjudicateTalkResult 新增位置，sentimentToDelta 所在
- `src/ai/prompts/narrative-system.ts` — NarrativePromptContext 类型定义，act 描述参考
- `src/ai/schemas/npc-dialogue.ts` — NpcDialogueSchema，NpcSentiment 类型
- `CLAUDE.md` — 核心架构原则："Rules Engine owns relationship changes"

---

## Existing Code Insights

**可复用：**
- `sentimentToDelta()` 已实现，返回 `10/0/-10/-20` 整数，直接在 adjudicateTalkResult 内调用
- `NarrativePromptContext` 类型已在 narrative-system.ts 定义，直接 import
- `buildNarrativeSystemPrompt` 中 act 语气注入的实现方式可作为 NPC 侧的参考模板

**注意：**
- `streamNpcDialogue` 目前调用 `buildNpcSystemPrompt(npcProfile)` 连 trustLevel 都没传，一并修复
- `dialogue-manager.ts` 有两处 sentimentToDelta 调用（第 487 行 generateNpcDialogue 路径，第 595 行 streamNpcDialogue 完成回调），两处都要改

---

*Created: 2026-04-30 for Phase 17 discuss-phase*
