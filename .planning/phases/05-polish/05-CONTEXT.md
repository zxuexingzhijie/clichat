# Phase 5: Polish & Optimization - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

长会话保持高速与低成本——后台摘要压缩历史记录、/replay 让玩家回顾历史回合、多 provider LLM 路由按角色优化成本与质量、token 用量实时可见。

Requirements: AI-04, LLM-01, LLM-02, LLM-03, SAVE-04

</domain>

<decisions>
## Implementation Decisions

### 多 Provider 路由（LLM-01）

- **D-01（配置模型）：** `ai-config.yaml` 作为主配置，定义每个 AI 角色（Narrative Director、NPC Actor、Intent Classifier、Memory Summarizer、Codex Assistant 等）到 provider/model 的映射，以及各角色的温度、maxTokens 与 fallback 策略。环境变量用于配置 API Key 与临时模型覆盖。优先级：**命令行参数 > 环境变量 > ai-config.yaml > 默认配置**
- **D-02（故障处理）：** Provider 调用失败（API 错误/超配额）时直接报错停止，不自动切换 fallback。向玩家显示清晰错误信息，允许重试
- **D-03（Profile 支持）：** 预留 `cheap`/`balanced`/`premium` profile 字段设计，当前 v1 实现以配置文件静态映射为主，profile 切换逻辑在本 Phase 作为框架骨架实现，后续版本激活

### Background Summarizer（AI-04）

- **D-04（触发策略）：** 混合触发——**token 阈值**为主触发条件（对话历史、NPC recentMemories、战斗日志、任务事件日志各有独立阈值），辅以特定事件触发（/save、分支创建、任务阶段推进、战斗结束、关键 NPC 对话结束、进入新区域、重要真相发现）；每隔固定回合数兜底检查（仅内容达到压缩价值时执行）。采用**防抖 + 优先级队列 + 冷却时间**机制避免频繁 LLM 调用；战斗中与关键对话中不主动触发低优先级摘要
- **D-05（压缩产物）：** 三类压缩产物：
  1. **Chapter summary**：叙事摘要（如"第二章：玩家协助村长击退巡徒，获得信任"）
  2. **NPC memory 压缩**：recent → archive，释放 recent 层空间，压缩时保留关键情节与情感标记
  3. **Turn log 压缩**：历史 turn log 压缩为摘要块，避免 log 无限增长
- **D-06（异步执行）：** 摘要任务进入**后台异步队列**，不阻塞主游戏循环。玩家可继续输入，任务完成前原始数据保持可读。每个任务记录目标对象、待压缩条目 ID、baseVersion 与触发原因；完成后通过**版本检查 + 原子提交**写入目标 store，避免覆盖摘要期间新增的数据。版本冲突或 LLM 调用失败时保留原始数据并重新排队，或降级为规则摘要

### Replay 系统（SAVE-04）

- **D-07（UI 交互）：** `/replay N` 打开**可滚动时间线浏览器**。键盘翻页为稳定兜底（↑↓、PgUp/PgDn、n/p），鼠标滚轮/触控板滚动为增强能力（终端支持时启用）。提供筛选、搜索和单回合详情查看。ESC 退出
- **D-08（展示内容）：** 每回合展示：玩家输入原文、AI 叙事输出（原文不重新生成）、规则引擎裁决结果（伤害/检定/资源变化）、NPC 对话原文。任务推进、NPC 关系变化、玩家知识更新作为折叠细节可展开查看
- **D-09（数据来源）：** 读取 Phase 4 已实装的 turn log（存储于持久化层），不重新调用 LLM

### Cost Tracking（LLM-02）

- **D-10（展示方式）：** 状态栏实时显示当前回合 token 用量；`/cost` 命令显示详情：本次 session 总 token + 总估算费用，以及按 AI 角色的明细（每个角色的 input/output token 与估算成本）
- **D-11（定价数据）：** 在 `ai-config.yaml` 中为每个 model 配置 `price_per_1k_input_tokens` 与 `price_per_1k_output_tokens`，用户自行维护。系统不内置价格表

### Prompt Caching（LLM-03）

- **Claude's Discretion：** 静态 prompt 内容（世界规则、叙述风格、角色骨架）的缓存/前缀实现策略，由 planner 根据 AI SDK v5 的 provider caching API 能力决定

### Claude's Discretion

- Background Summarizer 队列的具体数据结构与调度器实现
- token 阈值的默认值（各角色初始阈值）
- 状态栏 token 展示的视觉占位方案（不影响主 UI 布局）
- /replay 面板的具体 Ink 组件结构
- ai-config.yaml 的完整字段 schema 设计

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 架构与系统设计
- `CLAUDE.md` — 完整架构规范：多模型策略（AI Roles → Model Tiers）、Cost Optimization 策略、Multi-Model Strategy 表
- `CLAUDE.md` §Multi-Model Strategy — AI 角色分层（Narrative/NPC/Retrieval/Summarizer/Quest-Planner/Safety）
- `CLAUDE.md` §Cost Optimization — 静态内容缓存、会话间摘要、不累积原始对话历史

### 现有 AI 基础设施
- `src/ai/providers.ts` — 当前 ROLE_CONFIGS（全部 hardcoded 到 gemini-2.0-flash），Phase 5 在此基础上引入 ai-config.yaml 驱动
- `src/ai/roles/narrative-director.ts` — Narrative Director 实现，了解当前 AI 调用模式
- `src/ai/utils/context-assembler.ts` — Context 组装框架，了解 context 传入 AI 的方式
- `src/ai/utils/fallback.ts` — 现有 fallback 机制

### 现有持久化基础设施
- `src/persistence/save-file-manager.ts` — 存档读写基础设施
- `src/state/serializer.ts` — SaveDataV3Schema（Phase 4 产物），Summarizer 状态和 cost session 数据在此扩展
- `src/state/npc-memory-store.ts` — NPC 三层记忆（recent/salient/archive），Summarizer 压缩 recent → archive

### Phase 4 产物（Replay 依赖）
- `.planning/phases/04-differentiation/04-CONTEXT.md` §认知分离系统 — turn log 存储位置与字段设计

### Requirements
- `.planning/REQUIREMENTS.md` §AI System — AI-04（Background Summarizer）
- `.planning/REQUIREMENTS.md` §LLM Infrastructure — LLM-01（多 provider）、LLM-02（cost tracking）、LLM-03（prompt caching）、SAVE-04（replay）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/ai/providers.ts`：ROLE_CONFIGS 结构直接扩展为 ai-config.yaml 驱动，lazy model constructor 模式保留
- `src/state/npc-memory-store.ts`：三层记忆结构，Summarizer 直接操作 recent → archive 压缩
- `src/ui/components/adaptive-layout.tsx`：自适应布局，Replay 面板复用宽窄屏切换
- `src/input/command-registry.ts`：命令注册，添加 /cost、/replay 命令
- Turn log：Phase 4 已实装，Replay 直接读取

### Established Patterns
- Store 模式：`createStore<T>(initialState, onChange)` + immer produce（SummarizerQueue store 遵循此模式）
- Zod schema 验证：ai-config.yaml 加载时用 Zod 校验
- 事件驱动：mitt event bus（摘要完成、token 计数更新等事件）
- 自适应 UI：宽窄屏自适应布局（Phase 1 D-01 确定）

### Integration Points
- `src/ai/providers.ts`：引入 config loader，ROLE_CONFIGS 改为运行时从 ai-config.yaml 构建
- `src/game-loop.ts`：接入 /cost、/replay 路由；每回合 token 计数后发布事件
- `src/state/serializer.ts`：扩展 SaveData 以持久化 cost session 数据和 summarizer 状态
- `src/ui/screens/game-screen.tsx`：状态栏增加 token 实时展示；新增 ReplayPanel
- `src/state/`：新增 SummarizerQueue store（后台任务队列）

</code_context>

<specifics>
## Specific Ideas

- "长会话不应该越来越卡" —— Background Summarizer 是保证游戏流畅性的关键，不是 nice-to-have
- ai-config.yaml 应该对非开发者玩家也可读，注释说清楚每个角色的作用
- /cost 展示要让玩家直观感知"这次冒险花了多少钱"，不只是工程数字
- Replay 面板定位：复盘向（让玩家回顾关键决策），不是观赏向，所以键盘翻页比自动播放更合适
- Profile（cheap/balanced/premium）的框架现在就埋好，即使 v1 只有一个 profile，升级时不用改架构

</specifics>

<deferred>
## Deferred Ideas

- **Profile 自动切换（v2）：** 根据 session 长度或剩余 token 预算自动降级 profile
- **声望连锁传播（v2）：** 从 Phase 4 延续的阵营关系图驱动连锁声望
- **传闻扩散系统（v2）：** 玩家行为在 NPC 间口耳相传
- **执法追缉（v2）：** 恶名值触发守卫追捕行为

</deferred>

---

*Phase: 05-polish*
*Context gathered: 2026-04-22*
