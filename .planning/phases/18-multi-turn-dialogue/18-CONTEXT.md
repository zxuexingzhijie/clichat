# Phase 18: Multi-Turn Dialogue - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

将 NPC 对话从单轮（每次都重置上下文）升级为真正的多轮对话——每次 NPC 回复都在之前交流的基础上继续，而不是从零开始。涵盖三个交付物：
1. `ai-caller.ts` 支持 `messages[]` 参数（DIAL-01）
2. `DialogueManager` 维护 `{role, content}[]` 对话历史（DIAL-02）
3. 守卫创建对话（4 轮）使用 messages[] 积累上下文（DIAL-03）

不包括：NPC 记忆持久化（已在 Phase 3/14 完成）、对话 UI 改版、cost tracking 改进（Phase 19）。

</domain>

<decisions>
## Implementation Decisions

### Anthropic 缓存与 messages[] 的共存
- **D-01:** 传入 messages[] 时，使用 AI SDK 的独立 `system` 参数 + `messages[]` 格式（非单条 user 消息的打包格式）
- **D-02:** 对 Anthropic provider，在 `system` 参数上加 `providerOptions.anthropic.cacheControl: {type: 'ephemeral'}` 以保留 system 缓存
- **D-03:** `buildAiCallMessages` 需要新增一个 messages[] 模式分支，单轮调用（无历史）保持现有行为不变

### prompt 中历史文本序列化
- **D-04:** messages[] 就位后，**完全删除** `buildNpcUserPrompt` 中的 `historySection`
- **D-05:** 不保留 fallback 文本序列化——历史只走 messages[] 通道

### 守卫创建对话配线（DIAL-03）
- **D-06:** `useNpcDialogue` hook 内部维护 `messages[]`，不经过 DialogueManager
- **D-07:** `narrative-creation-screen.tsx` 每轮调用 `startDialogue` 时，把当前积累的 messages[] 传入 hook
- **D-08:** hook 在 `startDialogue` 时将上一轮的 `{role:'user', content: playerAction}` + `{role:'assistant', content: npcResponse}` 追加到内部 messages[]

### 对话历史大小
- **D-09:** 不限制历史长度，传入全部对话记录（sessions 内累积）
- **D-10:** 每个对话 session 独立——`startDialogue` 时重置 messages[]（`endDialogue` 不影响新 session）

### 数据格式迁移
- **D-11:** `dialogueHistory` 在 `DialogueState` 里改为 `{role: 'user' | 'assistant', content: string}[]`（从 `{speaker: string, text: string}[]` 迁移）
- **D-12:** UI 层（guard-dialogue-panel 等）如果引用了 `speaker`/`text` 字段，同步更新字段名

### Claude's Discretion
- `callGenerateObject` 和 `callStreamText` 中 messages[] 与现有 retry 逻辑的具体结合方式
- AI SDK v5 中 system + messages[] + Anthropic cacheControl 的精确 API 用法（researcher 负责确认）

</decisions>

<specifics>
## Specific Ideas

- DIAL-03 的验收标准：守卫第 3 问需要「明显引用」玩家之前的回答，而不是独立生成
- 无状态要求：对话历史**不**需要持久化到存档文件（save/load 后 NPC 记忆走 npc-memory-store，对话 messages[] 属于临时 session 数据）

</specifics>

<canonical_refs>
## Canonical References

**下游 agent 在规划/实现前必须阅读以下文件。**

### 需求定义
- `.planning/REQUIREMENTS.md` §DIAL — DIAL-01/02/03 的精确验收标准
- `.planning/ROADMAP.md` §Phase 18 — 成功标准（4 条）

### 现有 AI 调用基础设施
- `src/ai/utils/ai-caller.ts` — `buildAiCallMessages`、`callGenerateObject`、`callStreamText` 的现有实现；messages[] 扩展在此文件
- `src/ai/roles/npc-actor.ts` — `generateNpcDialogue`/`streamNpcDialogue`；NpcActorOptions.conversationHistory 的当前用法
- `src/ai/prompts/npc-system.ts` — `buildNpcUserPrompt`；`historySection` 需要删除
- `src/ai/prompts/guard-creation-prompt.ts` — 守卫对话的 system/user prompt 构建函数

### 对话状态与流程
- `src/engine/dialogue-manager.ts` — DialogueState.dialogueHistory 的现有结构；需迁移字段名
- `src/ui/hooks/use-npc-dialogue.ts` — 守卫对话路径；需要在此处积累 messages[]
- `src/ui/screens/narrative-creation-screen.tsx` — 守卫 4 轮对话的调用时序

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildAiCallMessages`（ai-caller.ts）：现有的 provider 分支逻辑可以复用，只需新增 messages[] 分支
- `NpcActorOptions.conversationHistory`：已经是 `{speaker, text}[]`，只需改格式并改变传递方式

### Established Patterns
- `callGenerateObject`/`callStreamText` 使用 spread `...msgOpts.options` 传参，新增 messages 模式后需确保 spread 包含正确字段
- `useNpcDialogue` hook 用 `useRef` 管理流式状态，messages[] 积累也应用 ref（跨渲染不变）

### Integration Points
- `ai-caller.ts` 是唯一改动点（单一调用层），上层的 `npc-actor.ts`、`narrative-director.ts` 通过参数传入
- `DialogueState.dialogueHistory` 改字段名会影响 `dialogue-manager.ts` 和任何读取该字段的 UI 组件
- `narrative-creation-screen.tsx` 每轮都调用 `npcDialogue.startDialogue()`，需要设计 hook 如何区分「重置」和「继续」

</code_context>

<deferred>
## Deferred Ideas

- 对话历史持久化到存档（save/load 后恢复 messages[]）——over-engineering，NPC 记忆已覆盖长期上下文需求
- 其他 AI 角色（narrative-director、retrieval-planner）的多轮支持——Phase 18 仅限 NPC Actor

</deferred>

---

*Phase: 18-multi-turn-dialogue*
*Context gathered: 2026-04-30*
