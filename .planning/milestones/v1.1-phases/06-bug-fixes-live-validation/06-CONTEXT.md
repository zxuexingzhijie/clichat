# Phase 6: Bug Fixes & Live Validation - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

修复三个核心输入 bug（Enter 无响应、焦点切换失效、无可靠退出路径），并通过带真实 API 的自动化脚本验证 `/cost`、`/replay`、后台摘要器三项功能。

Requirements: BUG-01, BUG-02, BUG-03, CARRY-01

</domain>

<decisions>
## Implementation Decisions

### BUG-01: Enter 键推进游戏（BUG-01）

- **D-01（修复深度）：** 完整修复 — Enter 触发真实游戏回合：规则引擎裁决 → AI 叙事生成 → 世界状态更新。`handleActionExecute` 不能再是空壳。
- **D-02（执行顺序）：** 先裁决再叙事 — 规则引擎返回裁决结果后，才调用 AI 叙事生成。AI 写旁白，不决定结果。
- **D-03（Loading 状态）：** AI 生成叙事期间 UI 进入 `processing` 模式（显示 loading）；生成完成后返回 `action_select` 模式，展示新叙事内容。
- **D-04（失败处理）：** AI 叙事调用失败时，在场景面板中显示错误信息，允许玩家重试。不静默失败。

### BUG-02: `/` 键焦点切换（BUG-02）

- **D-05（触发键）：** `/` 和 Tab 都触发 — 将 `inputMode` 切换为 `input_active`，使 `InputArea` 激活。
- **D-06（视觉反馈）：** 切换到输入模式时，输入框提示符变色（从 dim `'> '` 变为亮青色 `'> '`），让玩家清楚光标已在输入框。`InputArea` 已有 `mode` prop，可扩展。
- **D-07（退出输入模式）：** 按 Escape 时：若输入框有内容则先清空，若已为空则退出输入模式返回 `action_select`。

### BUG-03: `:quit` / `:exit` 退出命令（BUG-03）

- **D-08（命令注册）：** 在 `command-registry.ts` 中注册 `:quit` 和 `:exit` 两个命令，触发退出流程。
- **D-09（确认流程）：** 退出前显示确认对话，复用已有的 `InlineConfirm` 组件（`src/ui/components/inline-confirm.tsx`），不新建面板。
- **D-10（Ctrl-C 一致性）：** Ctrl-C 也经过确认流程，与 `:quit` 行为一致。需要拦截 SIGINT（在 `index.tsx` 中替换当前的直接 `process.exit(0)`）。

### CARRY-01: 实时功能验证（CARRY-01）

- **D-11（验证方式）：** 编写自动化验证脚本，调用真实 API provider（需要环境变量中的 API Key）。
- **D-12（验证范围）：** 三项全部验证：
  1. `/cost` — 显示真实 token 数据（input/output tokens + 估算费用，按角色明细）
  2. `/replay N` — 面板可交互滚动，展示历史回合内容
  3. 后台摘要器 — 在一次真实会话结束后至少触发一次压缩任务
- **D-13（CI 策略）：** 需要 secrets，不在普通 CI 中自动运行。脚本独立存放，手动触发或在有 secrets 的 CI 环境中运行。

### Claude's Discretion

- `processing` 状态的具体 loading 动画样式（spinner 文字 / 颜色）
- 退出确认对话的具体文案（中文）
- 自动化验证脚本的文件路径和结构（e2e/ 或 scripts/ 目录）
- SIGINT 拦截的具体实现方式（useApp hook vs 进程级别）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 核心输入组件
- `src/ui/panels/input-area.tsx` — InputArea 组件，`isActive` / `mode` prop，切换到 input_active 时变色逻辑在此扩展
- `src/ui/hooks/use-game-input.ts` — `useGameInput` hook，`inputMode` 状态机（action_select / input_active / processing）
- `src/ui/screens/game-screen.tsx` — `useInput` 处理器（需加入 `/` 和 Tab 触发逻辑），`handleActionExecute`（需从 stub 改为真实调用）
- `src/ui/panels/actions-panel.tsx` — Enter 键触发 `onExecute`，已正确实现，问题在 handler 端

### 退出相关
- `src/index.tsx` — SIGINT / SIGTERM 处理器（需改为触发确认流程）
- `src/input/command-registry.ts` — 注册 `:quit` / `:exit` 命令的位置
- `src/ui/components/inline-confirm.tsx` — 退出确认对话复用此组件

### 游戏循环
- `src/game-loop.ts` — 游戏主循环，Enter 执行路径需要在此接入
- `src/input/command-registry.ts` — 命令路由基础设施

### CARRY-01 验证依赖
- `src/state/cost-session-store.ts` — `/cost` 数据来源
- `src/ui/panels/replay-panel.tsx` — `/replay` 面板实现
- `.planning/phases/05-polish/05-CONTEXT.md` §Background Summarizer — D-04/D-05/D-06 触发策略与压缩产物

### Requirements
- `.planning/REQUIREMENTS.md` §Bug Fixes — BUG-01, BUG-02, BUG-03
- `.planning/REQUIREMENTS.md` §Carry-over from v1.0 Active — CARRY-01

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/ui/components/inline-confirm.tsx` — 退出确认对话，直接复用，无需新建
- `src/ui/hooks/use-game-input.ts` — `inputMode` 状态已有 action_select / input_active / processing 三态，架构完整
- `src/ui/panels/actions-panel.tsx` — Enter 触发 `onExecute` 已实现，只缺 handler 端真实逻辑

### Established Patterns
- Store 模式：`createStore<T>` + immer produce，game-loop 状态更新遵循此模式
- `useInput` hook：Ink 7 键盘输入处理，`isActive` 参数控制是否响应
- 命令注册：`command-registry.ts` 统一注册所有 `:command` 格式命令

### Integration Points
- `handleActionExecute` (game-screen.tsx:128) → game-loop → rules engine → AI narration → store update
- `setInputMode('input_active')` 需在 game-screen.tsx `useInput` 处理器中补充 `/` 和 Tab 分支
- SIGINT 拦截：`index.tsx` 的 `process.on('SIGINT')` 需改为触发 React 层确认组件（可通过 store 标志位）

</code_context>

<specifics>
## Specific Ideas

- 退出确认使用 `inline-confirm.tsx`（已在项目中存在），保持 UI 一致性
- Ctrl-C 与 `:quit` 行为统一 — SIGINT 触发同一确认流程
- CARRY-01 自动化脚本调用真实 API，需 secrets 管理，不污染普通测试套件

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-bug-fixes-live-validation*
*Context gathered: 2026-04-23*
