---
status: pending
phase: 21-distribution-live-validation
type: human-required
started: ~
updated: ~
---

# Chronicle v1.4 — Live API UAT Checklist

不阻塞 Phase 21 完成。Automation gate 通过后，由开发者使用真实 API Key 手工执行。

## Automation Gate

手工 UAT 前先确认自动化全部通过：

- [ ] `bun test` — 必须全部通过（1115+ tests，0 failures）
- [ ] `bun tsc --noEmit` — 必须通过（预存错误除外：summarizer-worker、quest-handler.test、game-loop.test）
- [ ] `npm publish --dry-run` — 必须通过（0 errors；warn 可接受）

## Current Test

[not started — 需要配置真实 API Key 的 live 会话]

## Tests

### 1. :cost 显示含 intent classification 的 token 统计

执行步骤：
1. 配置真实 API Key（OPENAI_API_KEY 或 ANTHROPIC_API_KEY 等）
2. `bun run src/cli.ts` 启动游戏
3. 进入场景后，输入至少 2 条自由文本指令（非 :command 格式，触发 intent classification）
4. 输入 `:cost`

expected: :cost 面板显示至少两行 token 统计 — 一行来自 narration（callGenerateObject），一行来自 intent-classifier（role: retrieval-planner）；两行 token 数均为正整数，累计 total 为两者之和
result: [pending — requires live API session]

---

### 2. :replay 回放最近 5 轮叙事正确

执行步骤：
1. 在 live 会话中完成至少 5 轮交互（移动、对话、战斗各至少 1 轮）
2. 输入 `:replay`

expected: 终端依次显示最近 5 轮的叙事内容，顺序与实际游戏历史一致；第 1 条为最早的那轮，第 5 条为最新的那轮；内容不重复、不乱序、不显示占位符文本
result: [pending — requires live API session]

---

### 3. 背景 summarizer 在 10+ 次 NPC 交互后压缩记忆

执行步骤：
1. 选择一个有 NPC 的场景（如 市场 或 酒馆）
2. 与同一 NPC 进行 10 次以上对话（每次 `:talk <npc>`，回复后结束对话，再重新开始）
3. 观察终端是否出现 unhandled rejection 或 summarizer error 日志

expected: 第 10+ 次交互后，无 unhandled promise rejection 出现在终端；后台 summarizer 静默运行完成 NPC 记忆压缩（可通过 :save 后检查存档中 NPC memory 条数减少来间接确认）
result: [pending — requires live API session]

---

## Summary

total: 3
passed: 0
failed: 0
pending: 3

## Gaps

[none yet — update after execution]
