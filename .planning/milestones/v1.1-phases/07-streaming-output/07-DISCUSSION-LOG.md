# Phase 7: Streaming Output - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 07-streaming-output
**Areas discussed:** 打字机渲染策略, NPC对话流式输出, Skip-to-end行为

---

## 打字机渲染策略

| Option | Description | Selected |
|--------|-------------|----------|
| Stream-native | 使用 AI SDK 流式 chunks 直接作为渲染驱动，速度取决于 LLM provider | |
| Buffer-then-animate | 缓冲完整响应后以固定速度逐字符动画 | |
| Stream + per-char animation | 流式接收 + 每个 chunk 内逐字符延迟渲染 | |

**User's choice:** Stream-native 为基础，但 UI 层不逐字符渲染——底层按 token/短片段流式接收，界面按「句子或事件块」稳定刷新。
**Notes:** 用户明确要求视觉节奏稳定，避免逐字符闪烁。

### 刷新策略细节

| Option | Description | Selected |
|--------|-------------|----------|
| 按句子标点刷新 | 遇到句末标点（。！？…）刷新，未完成句子留在 buffer | |
| 标点优先 + 超时兜底 | 标点刷新为主，超时强制刷新防止长句卡住 | ✓ |
| Claude 自行决定 | 具体阈值和策略细节由 Claude 决定 | |

**User's choice:** 标点优先 + 超时兜底
**Notes:** None

### ScenePanel 集成方式

**User's choice:** 用户对"streaming line prop vs overlay"问题要求澄清后明确了底层策略（按句子块刷新），具体 ScenePanel 改造方式归入 Claude's Discretion。

---

## NPC 对话流式输出

| Option | Description | Selected |
|--------|-------------|----------|
| 双调用：元数据 + 流式文本 | 保留 generateObject 取元数据，额外用 streamText 生成对话文本 | |
| 流式文本 + 后提取元数据 | 改用 streamText 流式生成对话，流结束后提取元数据 | ✓ |
| streamObject 流式结构化 | 用 AI SDK streamObject 流式填充 JSON 字段 | |

**User's choice:** 流式文本 + 后提取元数据
**Notes:** generateObject 路径保留作 fallback

---

## Skip-to-end 行为

### LLM 流处理

| Option | Description | Selected |
|--------|-------------|----------|
| 停动画不停流 | UI 停止刷新动画，LLM stream 继续后台运行至完成 | ✓ |
| 停动画且停流 | UI 停止刷新，同时取消 LLM stream 请求 | |
| Claude 自行决定 | 根据实际情况决定 | |

**User's choice:** 停动画不停流
**Notes:** 不浪费已消耗的 token，流完成后静默替换为完整文本

### 触发键

| Option | Description | Selected |
|--------|-------------|----------|
| 任意键 | 任何按键触发 skip | |
| Enter/Space 专用键 | 只有 Enter 或 Space 触发 skip | ✓ |

**User's choice:** Enter/Space 专用键
**Notes:** 避免误触

---

## Claude's Discretion

- buffer 超时兜底的具体毫秒数
- NPC 对话元数据后提取的具体实现方式
- useAiNarration hook 的改造细节
- ScenePanel 流式行的视觉样式

## Deferred Ideas

None
