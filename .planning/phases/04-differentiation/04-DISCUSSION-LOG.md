# Phase 4: Differentiation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 04-differentiation
**Areas discussed:** Story branching, ASCII map system, Codex browser & shortcuts, Epistemic separation

---

## Story Branching

### 分支与存档系统的关系模型

| Option | Description | Selected |
|--------|-------------|----------|
| Save-based branches | 分支是特殊存档文件，附带 parent 指针。简单，直接基于现有存档基础设施 | |
| Branch registry model | 独立 branches.json 注册表，追踪分支名/HEAD/parent/时间戳。更接近 git 模型 | |
| 用户自定义 | Branch Registry + Save Snapshot 混合模型 | ✓ |

**User's choice:** Branch Registry + Save Snapshot 混合。branches.json 管元数据，存档文件 meta 中带 branchId + parentSaveId
**Notes:** 用户明确提出混合方案，兼顾 registry 的集中管理和 snapshot 的基础设施复用

### 分支间NPC记忆隔离策略

| Option | Description | Selected |
|--------|-------------|----------|
| 完整复制 | 创建分支时完整复制 NPC 记忆目录。简单但磁盘占用大 | |
| COW (写时复制) | 记录快照点，新分支写入 overlay 层，读取时合并 base + overlay | |
| 延后处理 | Phase 4 暂不隔离，标记为已知限制 | |
| 用户自定义 | 时间线级隔离 + COW 策略，绑定 branchId/saveId/turn | ✓ |

**User's choice:** 时间线级隔离 + COW。NPC 记忆绑定 branchId/saveId/turn，隔离范围包括记忆/情绪/声望/AI历史/已发现真相
**Notes:** 用户强调"分支不是多个存档文件而已，而是多条时间线"。核心哲学："分支树管命运线，NPC记忆管因果账"

### /branch tree 可视化形式

| Option | Description | Selected |
|--------|-------------|----------|
| ASCII 文本树 | 纯文本缩进树，类似 git log --graph | |
| Ink 组件树 | Box/Text 组件渲染带颜色的树状图 | |
| 带状态的 ASCII 树 | ASCII 树 + 每个节点显示简要状态 | |
| 用户自定义 | 状态增强型 ASCII 树 + Ink 渲染混合方案 | ✓ |

**User's choice:** Git-style ASCII 底层 + Ink 高亮/滚动 UI 层。节点显示存档名/游戏时间/位置/任务阶段，详情视图展开NPC关系变化
**Notes:** 用户要求显示关键 NPC 关系变化摘要（信任/敌意/怀疑/阵营声望变化）

### /compare 分支对比呈现方式

| Option | Description | Selected |
|--------|-------------|----------|
| 结构化 diff 文本 | git diff 风格，+/- 标记增删 | |
| 并排对比视图 | 左右双列对比，颜色区分变化 | |
| 摘要 + 展开详情 | 先显示摘要，按类别展开 | |
| 用户自定义 | 渐进式：摘要 → 结构化 diff → 可选并排 → 影响解释 | ✓ |

**User's choice:** 渐进式方案融合三种模式。+/-/~/! 四种标记，影响等级标注，叙事影响摘要
**Notes:** 用户强调每项差异需标注影响等级并生成叙事影响摘要

---

## ASCII Map System

### 地图数据组织方式

| Option | Description | Selected |
|--------|-------------|----------|
| 坐标网格 | 每个 location 添加 x/y 坐标 | |
| 拓扑图自动布局 | 只定义连接关系，渲染器自动布局 | |
| 手绘模板 + 标记点 | 手绘 ASCII 模板，标记 location ID | |
| 用户自定义 | 混合：拓扑连接为主 + 可选坐标 + 手绘模板 | ✓ |

**User's choice:** 混合地图模型——拓扑连接为主，可选坐标辅助，重要区域手绘模板
**Notes:** 兼顾自动化与美观度

### /map 视觉风格

| Option | Description | Selected |
|--------|-------------|----------|
| 简约图标式 | 节点用图标，路径用连线，当前位置高亮 | |
| 详细信息式 | 每个地点占多行，显示名称+小图案+危险等级 | |
| Claude 决定 | | |
| 用户自定义 | 分层 ASCII + 底部详情面板 | ✓ |

**User's choice:** 紧凑图标节点图 + 当前位置高亮 + ?未探索 + !任务相关 + 底部选中地点详情面板
**Notes:** 兼顾 CLI 可读性、空间利用率与探索反馈

### 地点探索追踪粒度

| Option | Description | Selected |
|--------|-------------|----------|
| 二元状态 | 已探索/未探索 | |
| 多级探索度 | 多级渐进发现 | ✓ |
| Claude 决定 | | |

**User's choice:** 五级分层发现模型（unknown → rumored → known → visited → surveyed），兴趣点独立追踪
**Notes:** 记录发现来源、回合、可信度与说明

---

## Codex Browser & Shortcuts

### /codex 浏览器交互布局

| Option | Description | Selected |
|--------|-------------|----------|
| 双栏分类浏览 | 左侧分类树，右侧详情 | |
| 搜索优先单列 | 单列列表 + 搜索/过滤栏 | |
| 自适应布局 | 宽屏双栏，窄屏单列 | |
| 用户自定义 | 搜索优先的自适应浏览布局 | ✓ |

**User's choice:** 搜索优先 + 自适应（宽屏双栏/窄屏单列），related entries 快速跳转
**Notes:** 详情页展示权威等级、可见性、来源、可信度、关联实体

### 未发现条目的处理方式

| Option | Description | Selected |
|--------|-------------|----------|
| 严格过滤 | 只显示 public/discovered | |
| 占位暗示 | hidden/secret 显示为 ??? | |
| Claude 决定 | | |
| 用户自定义 | 按可见性分级揭示 | ✓ |

**User's choice:** public/discovered 可读；hidden/secret 获线索后显示 ???；forbidden 完全隐藏
**Notes:** 分级揭示平衡防剧透与探索动力

### 键盘快捷键范围

| Option | Description | Selected |
|--------|-------------|----------|
| 最小必要集 | CLI-04 要求的核心快捷键 | |
| 扩展快捷键集 | 核心 + Alt-/单键面板切换等 | |
| Claude 决定 | | |
| 用户自定义 | 渐进式设计：核心集 + 扩展集 | ✓ |

**User's choice:** 核心集（Tab/↑↓/Ctrl-R/?/Esc）+ 扩展集（数字/Alt-1~9/m,j,c,i,b 单键，非文本输入状态生效）
**Notes:** 避免终端冲突键，所有快捷键有等价 / 命令兜底

---

## Epistemic Separation

### NPC Actor 认知边界

| Option | Description | Selected |
|--------|-------------|----------|
| known_by 白名单过滤 | 只用 codex known_by 字段过滤 | |
| 属性推断 + known_by | known_by + faction/location/profession 推断 | |
| Claude 决定 | | |
| 用户自定义 | NPC Knowledge Access Policy（六维过滤） | ✓ |

**User's choice:** 六维过滤：显式 known_by + 身份推断 + 地域常识 + 个人记忆 + 可见场景 + 权威等级过滤
**Notes:** "NPC 不是百科全书接口，是一个有身份、有偏见、有记忆、有盲区的人"

### 认知层级标签传递

| Option | Description | Selected |
|--------|-------------|----------|
| 前缀标签 + prompt约束 | 每条信息带认知层级前缀 | |
| 三列表分离注入 | 按角色类型选择性注入 | |
| Claude 决定 | | |
| 用户自定义 | Cognitive Context Envelope（五类上下文块） | ✓ |

**User's choice:** 五类独立上下文块（world_truth/npc_belief/player_knowledge/scene_visible/npc_memory），每个 AI 角色不同访问层级
**Notes:** NPC Actor 不碰 world_truth，Narrative Director 可读但以 player_knowledge 控制输出边界

### 玩家知识管理

| Option | Description | Selected |
|--------|-------------|----------|
| 自动追踪 | 发现信息自动写入，玩家不可控 | |
| 自动追踪 + 可视化 | 自动追踪 + journal/codex 中可查看 | ✓ |
| Claude 决定 | | |

**User's choice:** PlayerKnowledgeStore 自动追踪，知识状态四级（heard/suspected/confirmed/contradicted），journal+codex 可视化
**Notes:** 记录来源、回合、可信度、关联 Codex 条目。Narrative Director 以 player_knowledge 为信息输出边界

---

## Claude's Discretion

- branches.json 精确字段命名与存储格式
- ASCII 地图自动布局算法
- Codex 搜索匹配算法
- NPC Knowledge Access Policy 各维度优先级
- Cognitive Context Envelope prompt 模板
- PlayerKnowledgeStore Zod schema 字段

## Deferred Ideas

- 声望连锁传播（Phase 5）
- LLM 记忆压缩（Phase 5）
- 传闻扩散系统（Phase 5）
- 执法追缉（Phase 5）
