# Phase 4: Differentiation - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Chronicle 的差异化特性上线——玩家可以像 git 一样分支剧情线、查看 ASCII 地图、浏览已发现的世界知识、使用键盘快捷键高效操作，AI 严格遵守认知边界（NPC 只知道该知道的事）。

Requirements: SAVE-02, SAVE-03, SAVE-04, CLI-02, CLI-03, CLI-04, LLM-04

</domain>

<decisions>
## Implementation Decisions

### 故事分支系统

- **D-01（分支模型）：** Branch Registry + Save Snapshot 混合模型。`branches.json` 维护分支元数据（分支ID、名称、当前 HEAD save、父分支、创建时间、说明），每个 save snapshot 在 meta 中保存 `branchId` 与 `parentSaveId`。`/branch` 命令创建新分支记录并基于当前 GameState 生成新 snapshot 作为起点。既复用 Phase 3 存档基础设施，又避免分支关系散落在文件名中
- **D-02（时间线隔离）：** 分支不是多个存档文件，而是多条时间线。NPC 记忆绑定 `branchId`/`saveId`/`turn`，读取时仅加载当前分支及其祖先分支在分叉点之前的共享记忆，不读取兄弟分支或未来存档。隔离范围包括：NPC 记忆、NPC 情绪、阵营声望、AI 可检索历史、玩家已发现的真相。采用 Copy-on-Write 策略——新分支继承父分支至分叉点的数据，分叉后独立写入。设计哲学：**分支树管命运线，NPC 记忆管因果账。因果不能串线**
- **D-03（分支树可视化）：** `/branch tree` 采用状态增强型 ASCII 树 + Ink 渲染。底层以 git-style ASCII tree 表达分支关系（保证终端兼容性与可复制性），UI 层使用 Ink 对当前分支、HEAD 存档和选中节点进行高亮并支持滚动浏览。每个节点默认显示存档名、游戏时间、当前位置与关键任务阶段；详情视图可展开查看剧情摘要、NPC 记忆变化、关键 NPC 关系变化（信任/敌意/怀疑/阵营声望）和分支来源
- **D-04（分支对比）：** `/compare` 采用渐进式分支对比方案。默认显示摘要层（差异数量 + 关键后果），随后按类别展示结构化 git-style diff（`+` 新增、`-` 缺失、`~` 变化、`!` 高影响分歧）。宽屏终端可切换并排对比视图。每项差异标注影响等级，并生成叙事影响摘要帮助玩家理解分支差异的实际意义。对比维度：任务进度、NPC 关系/记忆、背包、位置、阵营声望、已发现真相

### ASCII 地图系统

- **D-05（地图数据模型）：** 混合地图模型——地点关系以拓扑连接为主（exits 定义方向 + 目标 location_id），每个地点可选 x/y 坐标辅助渲染布局，重要区域可额外提供手绘 ASCII 地图模板文件
- **D-06（地图视觉风格）：** `/map` 采用分层 ASCII 地图视觉风格。默认视图使用紧凑图标节点图表达地点与路径关系（`[H]` 城镇、`[T]` 神殿、`[F]` 森林、`[D]` 地牢），当前位置高亮显示，未探索区域以 `?` 或弱化样式显示，任务相关地点使用 `!` 标记。地图底部提供选中地点详情面板（地点类型、危险等级、当前状态、可用出口、关联任务）
- **D-07（探索追踪模型）：** 五级分层发现模型：`unknown` → `rumored` → `known` → `visited` → `surveyed`。地图显示根据探索状态调整渲染。地点内部兴趣点独立追踪，只有主要兴趣点被发现或解决后该地点才进入 `surveyed`。系统同时记录地点发现来源、回合、可信度与说明，用于地图提示、AI 叙事和任务线索回溯

### Codex 浏览器与键盘快捷键

- **D-08（Codex 布局）：** `/codex` 采用搜索优先的自适应浏览布局。宽屏终端使用双栏结构（左侧搜索结果与分类过滤，右侧选中条目详情）；窄屏终端切换为单列列表，选中条目后进入独立详情页。详情页展示条目标题、类型、权威等级、可见性、来源、可信度、摘要与关联实体，支持 related entries 快速跳转
- **D-09（发现状态与揭示）：** 按可见性分级揭示——`public`/`discovered` 完整可读；`hidden`/`secret` 仅在玩家获得相关线索后显示 `???` 占位（暗示存在但隐藏内容）；`forbidden` 完全隐藏，直到正式解锁
- **D-10（快捷键设计）：** 渐进式快捷键设计。核心集（CLI-04 必须）：Tab 补全命令名/NPC 名/方向、↑↓ 历史、Ctrl-R 搜索历史、`?` 快速帮助、Esc 统一取消/返回。扩展集（可发现、可关闭、有命令兜底）：数字键选择动作、Alt-1~9 快速执行动作、`m`/`j`/`c`/`i`/`b` 单键打开地图/日志/Codex/背包/分支树（仅非文本输入状态生效）。避免绑定 Ctrl-S、Ctrl-M 等可能与终端行为冲突的组合键，所有快捷键均提供等价 `/` 命令

### 认知分离系统（Epistemic Separation）

- **D-11（NPC 认知边界）：** NPC Actor 的认知边界由 Context Assembler 通过 **NPC Knowledge Access Policy** 控制。六维过滤：Codex `known_by` 显式白名单 + NPC 身份/阵营/职业属性推断 + 地域常识 + NPC 个人记忆 + 当前场景可见事实 + 条目 `authority`/`visibility`/`truth_status` 过滤。NPC 不是百科全书接口，是一个有身份、有偏见、有记忆、有盲区的人。Context Assembler 的任务不是"找最全资料"，而是"只给这个人此时此地该知道的资料"。对于未知/隐藏/禁忌信息，NPC 可以表示不知道、引用传闻、回避或撒谎，但绝不泄露未授权的世界真相
- **D-12（认知上下文传递）：** 采用 **Cognitive Context Envelope** 机制。Context Assembler 将信息分为 `world_truth`、`npc_belief`、`player_knowledge`、`scene_visible`、`npc_memory` 五类独立上下文块，每个 AI 角色拥有不同的可访问层级：
  - NPC Actor：不可访问 `world_truth`，只读取自身 `npc_belief`、`npc_memory` 与 `scene_visible`
  - Narrative Director：可读取 `world_truth` 保持剧情一致性，但必须以 `player_knowledge` 控制可输出边界
  - Codex Browser：只展示 `public`/`discovered`/`hinted` 内容
  - 所有上下文块带显式认知标签，prompt 明确禁止 AI 混用、泄露或暗示未授权层级信息
- **D-13（玩家知识管理）：** 采用 **PlayerKnowledgeStore** 自动追踪。玩家通过探索、对话、任务推进、检定成功、物品阅读或战斗观察获得的信息自动写入，记录来源、回合、可信度、关联 Codex 条目与知识状态。知识状态包括 `heard`（传闻）、`suspected`（推断）、`confirmed`（已证实）、`contradicted`（被推翻），用于区分信息可靠性。`/journal` 按任务展示调查认知，`/codex` 按条目展示已知事实与传闻来源。Narrative Director 以 `player_knowledge` 为信息输出边界

### Claude's Discretion
- branches.json 的精确字段命名与存储格式
- ASCII 地图的自动布局算法（拓扑图→坐标映射）
- 地图图标符号的具体选择
- Codex 搜索的匹配算法（模糊匹配/拼音/标签权重）
- Tab 补全的具体实现方式
- NPC Knowledge Access Policy 各维度的优先级和冲突解决策略
- Cognitive Context Envelope 的 prompt 模板细节
- PlayerKnowledgeStore 的 Zod schema 字段设计

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 架构与系统设计
- `CLAUDE.md` — 完整架构规范：层模型、双输入系统、RAG 策略、Save/Branch 系统、CLI UX 原则
- `CLAUDE.md` §Save/Branch System — "Modeled after git: quick save, named save, branch save"
- `CLAUDE.md` §RAG Strategy — 四层记忆架构、Skills-Based RAG Integration、Truth vs. Cognition Separation

### Phase 1-3 基础
- `.planning/phases/01-foundation/01-CONTEXT.md` — CLI 布局（D-01~D-11）、Rules Engine、NL 意图、World Codex schema、状态管理
- `.planning/phases/02-core-gameplay/02-CONTEXT.md` — NPC 对话系统（D-11~D-15）、AI 叙述风格（D-07~D-10）、战斗系统
- `.planning/phases/03-persistence-world/03-CONTEXT.md` — 存档系统（D-01~D-06）、NPC 记忆持久化（D-07~D-10）、声望/关系系统（D-15~D-18）、世界内容

### 现有代码
- `src/persistence/save-file-manager.ts` — 现有存档基础设施（quickSave/saveGame/loadGame/listSaves）
- `src/state/serializer.ts` — SaveDataV2Schema（7 stores + externalRefs），分支系统在此基础上扩展
- `src/codex/schemas/epistemic.ts` — 完整 EpistemicMetadataSchema（authority/truth_status/scope/visibility/confidence/source_type/known_by/contradicts/volatility）
- `src/ai/utils/context-assembler.ts` — 当前 context 组装逻辑，Phase 4 需添加认知过滤
- `src/codex/query.ts` — queryByType/queryByTag/queryById/queryRelationships，Codex 浏览器复用
- `src/state/npc-memory-store.ts` — NPC 三层记忆结构（recent/salient/archive），分支隔离在此扩展
- `src/state/relation-store.ts` — 声望/关系数据，分支隔离需覆盖
- `src/state/quest-store.ts` — 任务进度数据，分支隔离需覆盖
- `src/ui/screens/game-screen.tsx` — 主游戏界面，新增 map/codex/branch 面板入口
- `src/ui/components/adaptive-layout.tsx` — 自适应布局组件，codex/map 面板复用

### Requirements
- `.planning/REQUIREMENTS.md` §Save & Branch — SAVE-02（分支）、SAVE-03（对比）、SAVE-04（回放）
- `.planning/REQUIREMENTS.md` §CLI UX — CLI-02（地图）、CLI-03（Codex 浏览器）、CLI-04（快捷键）
- `.planning/REQUIREMENTS.md` §LLM Infrastructure — LLM-04（认知层级标签）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/persistence/save-file-manager.ts`：存档读写基础设施，分支系统直接扩展
- `src/state/serializer.ts`：SaveDataV2Schema，需升级支持 branchId/parentSaveId
- `src/codex/schemas/epistemic.ts`：完整认知元数据 schema，直接用于 NPC Knowledge Access Policy
- `src/codex/query.ts`：4 种查询方法，Codex 浏览器核心检索复用
- `src/ai/utils/context-assembler.ts`：context 组装框架，添加 Cognitive Context Envelope 过滤层
- `src/state/npc-memory-store.ts`：三层 NPC 记忆，扩展 branchId 绑定
- `src/state/relation-store.ts`：声望数据结构，扩展分支隔离
- `src/ui/components/adaptive-layout.tsx`：自适应宽窄屏切换，codex/map 面板直接复用
- `src/input/command-registry.ts`：命令注册机制，添加 /branch /compare /map /codex 等命令

### Established Patterns
- Store 模式：`createStore<T>(initialState, onChange)` + immer produce（PlayerKnowledgeStore、BranchStore 等新 store 遵循此模式）
- Schema 验证：Zod schemas for all state types
- 事件驱动：mitt event bus + typed domain events（分支创建、知识发现等事件）
- 输入路由：command parser + intent classifier → game action
- 自适应 UI：宽窄屏自适应布局（Phase 1 D-01 确定的模式）

### Integration Points
- `src/game-loop.ts`：接入 /branch /compare /map /codex 命令路由
- `src/persistence/save-file-manager.ts`：扩展分支感知的存档管理
- `src/ai/utils/context-assembler.ts`：核心改造点——添加 NPC Knowledge Access Policy + Cognitive Context Envelope
- `src/ui/screens/game-screen.tsx`：新增 MapPanel、CodexPanel、BranchTreePanel
- `src/state/`：新增 PlayerKnowledgeStore、BranchStore、ExplorationStore
- `src/data/codex/locations.yaml`：扩展坐标/exits 空间关系数据

</code_context>

<specifics>
## Specific Ideas

- "分支树管命运线，NPC 记忆管因果账。因果不能串线，不然阿琳会在没被背叛的世界里突然骂你渣男"
- NPC 不是百科全书接口，是一个有身份、有偏见、有记忆、有盲区的人
- Context Assembler 的任务不是"找最全资料"，而是"只给这个人此时此地该知道的资料"
- 地图是探索向力的可视化——五级发现状态让玩家始终知道还有什么没探索到
- Codex 浏览器兼顾世界观百科与防剧透——??? 占位激发好奇心但不泄露真相
- 快捷键避免终端冲突（不绑 Ctrl-S/Ctrl-M），单键面板切换仅非输入状态生效

</specifics>

<deferred>
## Deferred Ideas

- **声望连锁传播（Phase 5）：** 阵营关系图驱动的连锁声望变化（从 Phase 3 延续）
- **LLM 记忆压缩（Phase 5）：** archiveSummary 升级为 AI-04 Background Summarizer 驱动
- **传闻扩散系统（Phase 5）：** 玩家行为在 NPC 间口耳相传
- **执法追缉（Phase 5）：** 恶名值触发守卫追捕行为

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-differentiation*
*Context gathered: 2026-04-22*
