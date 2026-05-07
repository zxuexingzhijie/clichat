# Phase 22: UX Architecture Refactor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 22-UX Architecture Refactor
**Areas discussed:** Provider 边界划分, NarrativeRenderer 替换策略, Input state machine 设计, 重构顺序/策略

---

## Provider 边界划分

### Streaming 归属

| Option | Description | Selected |
|--------|-------------|----------|
| Streaming 归 NarrativeProvider | NarrativeProvider 拥有 streaming 状态, 暴露 hooks | |
| Streaming 归 InputProvider | InputProvider 拥有 streaming 因为直接影响键盘行为 | |
| Narrative 主导 + Input 订阅 | streaming 留 NarrativeProvider, InputProvider 通过 derived hook 订阅 | ✓ |

**User's choice:** Narrative 主导 + Input 订阅
**Notes:** 单一信源但跨 provider 流动

### Quest 计算归属

| Option | Description | Selected |
|--------|-------------|----------|
| Quest 归 AtmosphereProvider | 作为"世界状态感知"归入 Atmosphere | ✓ |
| Quest 留在 GameScreen 透传 | Provider 只负责 UI 状态 | |
| 新增第4个 QuestProvider | 独立 Provider 但增加复杂度 | |

**User's choice:** "按照你觉得最佳实践来" → Claude discretion (选择宽 Atmosphere 包含 quest)
**Notes:** 后续确认为宽 AtmosphereProvider（含 quest + toast）

### AtmosphereProvider 范围

| Option | Description | Selected |
|--------|-------------|----------|
| 宽 Atmosphere（含 quest + toast） | 包含 scene tags, time_of_day, weather, quest context, toast, spinner | ✓ |
| 窄 Atmosphere（纯场景气氛） | 只含 scene atmosphere tags, time_of_day, weather | |
| You decide | Claude discretion | |

**User's choice:** 宽 Atmosphere

### Controller 位置

| Option | Description | Selected |
|--------|-------------|----------|
| Controller 留在 GameScreen | 只接收 Provider hooks 返回值 | |
| Controller 归 InputProvider | 主要处理用户输入→动作分发 | |
| You decide | Claude discretion | ✓ |

**User's choice:** You decide → Claude will place in InputProvider

---

## NarrativeRenderer 替换策略

### 过渡方式

| Option | Description | Selected |
|--------|-------------|----------|
| In-place 重写 ScenePanel | 直接在 ScenePanel 文件上改造, 重命名 | ✓ |
| 新建 + 一次性替换 | 并行新建, 开发完整后替换引用 | |
| Feature flag 共存 | 新旧 renderer 共存, 可切换 | |

**User's choice:** In-place 重写 ScenePanel

### Dialogue mode 切换

| Option | Description | Selected |
|--------|-------------|----------|
| State-driven 内部切换 | 同一组件实例, mode state 决定渲染内容 | ✓ |
| Conditional render 两个组件 | 父级 conditional render, 每次切换重新挂载 | |

**User's choice:** State-driven 内部切换

### 对话布局

| Option | Description | Selected |
|--------|-------------|----------|
| 共用文本区 + 样式变体 | 对话在主文本区域展示, 只是样式不同 | |
| 内嵌 DialogueView 子组件 | 独立布局: NPC名/glyph, 消息历史, 玩家响应 | ✓ |
| You decide | Claude discretion | |

**User's choice:** 内嵌 DialogueView 子组件

---

## Input State Machine 设计

### 键盘处理架构

| Option | Description | Selected |
|--------|-------------|----------|
| 统一 dispatcher + handler map | 一个 useInput, 内部 switch(state) 分发 | |
| Per-state useInput | 每个状态独立 useInput({ isActive: state === X }) | ✓ |
| You decide | Claude discretion | |

**User's choice:** Per-state useInput

### 状态切换触发

| Option | Description | Selected |
|--------|-------------|----------|
| EventBus 驱动 | 系统发事件, InputProvider 监听切换状态 | ✓ |
| Store 派生 | 直接订阅 combatState.active 等, useEffect 派生 | |
| You decide | Claude discretion | |

**User's choice:** EventBus 驱动

### 全局快捷键

| Option | Description | Selected |
|--------|-------------|----------|
| 全局层 + 状态层双层 | 全局 useInput 始终活跃 (Esc/Ctrl-C/?), 状态层处理其余 | ✓ |
| 全部在状态层 | 每个状态 handler 自己处理 Esc/Ctrl-C | |
| You decide | Claude discretion | |

**User's choice:** 全局层 + 状态层双层

---

## 重构顺序/策略

### 执行顺序

| Option | Description | Selected |
|--------|-------------|----------|
| Clock → Provider → Renderer → Input | 基础设施先行, 逐步瘦身 GameScreen | ✓ |
| Renderer → Provider → Input → Clock | 先解决 UI 层再抽状态 | |
| Provider → Renderer → Input → Clock | 最大量工作先做 | |
| You decide | Claude discretion | |

**User's choice:** Clock → Provider → Renderer → Input

### 测试策略

| Option | Description | Selected |
|--------|-------------|----------|
| 每步全量测试 | 每步重构后跑全量 1115+ 测试 | ✓ |
| 相关测试 + 最终全量 | 每步只跑相关文件测试, 最后全量 | |
| You decide | Claude discretion | |

**User's choice:** 每步全量测试

### Plan 粒度

| Option | Description | Selected |
|--------|-------------|----------|
| 细粒度 5 plans | Clock / AtmosphereProvider / NarrativeProvider / NarrativeRenderer / InputProvider+SM | ✓ |
| 粗粒度 3 plans | (Clock+Providers) / Renderer / Input | |
| You decide | Claude discretion | |

**User's choice:** 细粒度 5 plans

---

## Claude's Discretion

- Controller placement (→ InputProvider)
- Quest calculation location (→ AtmosphereProvider)
- Provider nesting order (→ Atmosphere > Narrative > Input)

## Deferred Ideas

None — discussion stayed within phase scope.
