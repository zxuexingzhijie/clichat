# Phase 7: Streaming Output - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

AI 叙事（Narrative Director）和 NPC 对话（NPC Actor）以打字机式流式效果渲染到场景面板；玩家可跳过动画立即查看全文。

Requirements: STREAM-01, STREAM-02, STREAM-03

</domain>

<decisions>
## Implementation Decisions

### 打字机渲染策略（STREAM-01）

- **D-01（双层架构）：** 底层通过 `streamNarration()` 逐 token/短片段接收 LLM 流式输出；UI 层在中间做轻量 buffer，按句子/事件块边界刷新到 ScenePanel。不逐字符渲染。
- **D-02（刷新策略）：** 标点优先 + 超时兜底——遇到中文句末标点（。！？…）时将 buffer 刷新到 ScenePanel；若超过一定时间未遇到标点，强制刷新当前 buffer 内容，防止长句时 UI 无反馈。
- **D-03（接入方式）：** `game-screen.tsx` 中 `handleActionExecute` 从当前的 `generateNarration()`（非流式）改为使用 `useAiNarration` hook（已存在，消费 `streamNarration()` async generator）。ScenePanel 需支持一个"正在流式输出"的行，流完成后变为普通行。
- **D-04（stream-native）：** 使用 AI SDK `streamText` 的原生流速，不做 buffer-then-animate（即不等全部生成完再播放动画）。玩家立即看到内容开始出现。

### NPC 对话流式输出（STREAM-02）

- **D-05（流式文本 + 后提取元数据）：** NPC 对话改用 `streamText` 生成对话文本（流式展示给玩家），流结束后从完整文本中提取情绪标签（emotion）、记忆标记（memoryFlag）、关系变化建议（relationshipDelta）等元数据。提取方式为规则解析或轻量 LLM 后处理。
- **D-06（generateObject 保留）：** 原有 `generateObject` 路径保留作 fallback——当 `streamText` 失败或提取元数据不完整时，回退到结构化生成。
- **D-07（UI 一致性）：** NPC 对话与叙事使用相同的句子边界 buffer 刷新策略，视觉体验统一。

### Skip-to-end 行为（STREAM-03）

- **D-08（停动画不停流）：** 玩家按键 skip 时，UI 立即停止逐句刷新动画，将已接收内容全量显示到 ScenePanel。LLM stream 继续在后台运行至完成，完成后静默替换显示内容为完整文本，并执行元数据提取。不浪费已消耗的 token。
- **D-09（触发键）：** 只有 Enter 或 Space 触发 skip-to-end。其他按键在流式输出期间不响应。避免误触。
- **D-10（状态切换）：** skip 后 inputMode 保持 `processing` 直到流真正完成并处理完毕，再切回 `action_select`。

### Claude's Discretion

- buffer 超时兜底的具体毫秒数（建议 300-800ms 区间）
- NPC 对话元数据后提取的具体实现方式（正则 vs 轻量 LLM 调用）
- `useAiNarration` hook 的具体改造细节（添加 buffer 层、skip 信号）
- ScenePanel 流式行的光标/提示样式（如闪烁光标或 dim 省略号）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### AI 流式基础设施
- `src/ai/roles/narrative-director.ts` — `streamNarration()` async generator（已实现 AI SDK `streamText`），`generateNarration()` 非流式路径
- `src/ai/roles/npc-actor.ts` — 当前 `generateObject` 结构化输出，需改造为 `streamText` + 后提取
- `src/ai/providers.ts` — RoleConfig / `getRoleConfig()`，provider 抽象层
- `src/ai/schemas/npc-dialogue.ts` — `NpcDialogueSchema` Zod schema，元数据后提取目标结构

### UI 流式消费
- `src/ui/hooks/use-ai-narration.ts` — `useAiNarration` hook（已实现流式消费 `streamNarration()`，含 cancel 机制），需添加 buffer 层和 skip 信号
- `src/ui/panels/scene-panel.tsx` — 当前静态 `lines: string[]` 渲染，需支持流式行
- `src/ui/screens/game-screen.tsx` — `handleActionExecute`（line 137-172）当前调用非流式 `generateNarration()`，需改为 hook 消费
- `src/ui/hooks/use-game-input.ts` — `inputMode` 状态机（action_select / input_active / processing）

### Requirements
- `.planning/REQUIREMENTS.md` §Streaming Output — STREAM-01, STREAM-02, STREAM-03

### 先前阶段上下文
- `.planning/phases/05-polish/05-CONTEXT.md` §多 Provider 路由 — D-01/D-02 provider 配置与失败处理
- `.planning/phases/06-bug-fixes-live-validation/06-CONTEXT.md` §BUG-01 — D-03 processing 状态 loading 行为

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/ai/roles/narrative-director.ts:streamNarration()` — 核心流式生成器，已用 AI SDK `streamText`，含重试和 fallback 逻辑
- `src/ui/hooks/use-ai-narration.ts` — React hook，消费 streamNarration 并维护 narrationText/isStreaming 状态，含 cancelledRef 取消机制
- `src/ai/utils/fallback.ts` — fallback 叙事和对话，流式失败时复用
- `src/events/event-bus.ts` — mitt event bus，可用于流式状态事件（stream_start / stream_end / stream_skipped）

### Established Patterns
- Store 模式：`createStore<T>` + immer produce，ScenePanel 读取 `sceneStore.narrationLines`
- `useInput` hook：Ink 7 键盘处理，`isActive` 控制是否响应——skip 键检测在此实现
- AI 调用模式：所有角色都有 retry + fallback + recordUsage，流式路径需保持一致

### Integration Points
- `game-screen.tsx:handleActionExecute` → 从 `generateNarration()` 改为 `useAiNarration` hook 消费
- `ScenePanel` → 新增 `streamingText?: string` 或类似 prop 支持流式行
- `npc-actor.ts` → 新增 `streamNpcDialogue()` 流式路径，保留 `generateNpcDialogue()` 作 fallback
- `use-game-input.ts` → skip 信号需要在 `processing` 模式下检测 Enter/Space

</code_context>

<specifics>
## Specific Ideas

- 底层按 token/短片段流式接收，界面按「句子或事件块」稳定刷新——强调视觉节奏稳定，不要逐字符闪烁
- NPC 对话和叙事使用统一的 buffer 刷新策略，保持体验一致
- Skip 是停动画不停流——不浪费已花费的 token，后台跑完后静默替换

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-streaming-output*
*Context gathered: 2026-04-24*
