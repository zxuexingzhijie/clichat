# Phase 6: Bug Fixes & Live Validation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-23
**Phase:** 06-bug-fixes-live-validation
**Areas discussed:** BUG-01, BUG-02, BUG-03, CARRY-01

---

## BUG-01: Enter 键推进游戏

| Option | Description | Selected |
|--------|-------------|----------|
| 完整修复 | 真实游戏回合：规则引擎裁决 → AI 叙事 → 状态更新 | ✓ |
| 部分修复（叙事为主） | 只更新叙事，深层状态留后续 | |
| 只验证管道 | console.log 确认按键有效 | |

**裁决顺序：**

| Option | Description | Selected |
|--------|-------------|----------|
| 先裁决再叙事 | Rules Engine 决定结果，AI 写旁白 | ✓ |
| 叙事先行，状态后同步 | AI 叙事优先 | |

**Loading 状态：**

| Option | Description | Selected |
|--------|-------------|----------|
| 显示 loading 然后返回 | AI 生成中显示 processing 状态 | ✓ |
| 直接返回行动列表 | 无 loading 状态 | |

**失败处理：**

| Option | Description | Selected |
|--------|-------------|----------|
| 显示错误信息，允许重试 | 场景面板显示错误，玩家可重试 | ✓ |
| 静默失败，只记日志 | 不向玩家暴露错误 | |

---

## BUG-02: `/` 键焦点切换

| Option | Description | Selected |
|--------|-------------|----------|
| / 和 Tab 都触发 | 两个键都切换到 input_active | ✓ |
| 只用 / 触发 | 避免 Tab 与 Ink 内部行为冲突 | |

**视觉反馈：**

| Option | Description | Selected |
|--------|-------------|----------|
| 输入框提示符变色 | dim '>' → 亮青色 '>' | ✓ |
| 无视觉反馈 | 只改行为 | |

**退出输入模式：**

| Option | Description | Selected |
|--------|-------------|----------|
| Escape 先清空再退出 | 有内容时先清空，为空时退出模式 | ✓ |
| Escape 直接退出 | 无论是否有内容都直接返回 | |

---

## BUG-03: `:quit` / `:exit` 退出命令

| Option | Description | Selected |
|--------|-------------|----------|
| 退出前确认（对话框） | InlineConfirm 弹出确认 | ✓ |
| 直接退出（无对话） | 快速，process.exit(0) | |

**UI 实现：**

| Option | Description | Selected |
|--------|-------------|----------|
| 复用 inline-confirm.tsx | 现成组件，保持一致性 | ✓ |
| 新建确认面板 | 专用退出确认 UI | |

**Ctrl-C 一致性：**

| Option | Description | Selected |
|--------|-------------|----------|
| Ctrl-C 也加确认 | 拦截 SIGINT，统一流程 | ✓ |
| Ctrl-C 保持直接退出 | SIGINT handler 不变 | |

---

## CARRY-01: 实时功能验证

| Option | Description | Selected |
|--------|-------------|----------|
| 写自动化验证脚本 | 脚本驱动，可重复执行 | ✓ |
| 手动烟雾测试，记录结果 | 简单但不可重复 | |

**API 策略：**

| Option | Description | Selected |
|--------|-------------|----------|
| 真实 API，需要 secrets | 验证真实数据路径 | ✓ |
| Mock API，CI 可运行 | 无需 secrets | |

**验证范围：**

| Option | Description | Selected |
|--------|-------------|----------|
| 三项全部验证 | /cost + /replay + summarizer | ✓ |
| 只验证 /cost | 最核心一项 | |

---

## Claude's Discretion

- `processing` 状态的具体 loading 动画样式
- 退出确认对话的具体文案
- 自动化验证脚本的文件路径和结构
- SIGINT 拦截的具体实现方式

## Deferred Ideas

None.
