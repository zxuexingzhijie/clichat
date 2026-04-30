---
phase: 21-distribution-live-validation
plan: "03"
type: execute
wave: 1
depends_on: [21-P01]
files_modified:
  - .planning/phases/21-distribution-live-validation/21-UAT-CHECKLIST.md
autonomous: true
requirements: [UAT-01]
must_haves:
  truths:
    - "21-UAT-CHECKLIST.md 存在，包含 automation gate 区块和 3 个手工测试项"
    - "automation gate 列出 bun test / bun tsc --noEmit / npm publish --dry-run 三个命令"
    - "3 个测试项分别覆盖 :cost、:replay、background summarizer"
    - "每个测试项有 expected 行和 result: pending 行"
  artifacts:
    - path: ".planning/phases/21-distribution-live-validation/21-UAT-CHECKLIST.md"
      provides: "Live API UAT 人工执行清单"
      contains: ":cost"
  key_links:
    - from: "21-UAT-CHECKLIST.md"
      to: "src/engine/cost-tracker.ts"
      via: ":cost 命令验证 Phase 19 intent classification token 追踪"
      pattern: ":cost"
---

<objective>
创建 21-UAT-CHECKLIST.md — Live API 人工 UAT 清单，记录三个必须手工验证的 AI 功能测试项。

Purpose: UAT-01 决策要求 Phase 21 产物包含此清单；automation gate 通过即可标记自动化验证完成，手工清单不阻塞 phase 完成。
Output: .planning/phases/21-distribution-live-validation/21-UAT-CHECKLIST.md，可直接由开发者执行。
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/21-distribution-live-validation/21-CONTEXT.md
</context>

<interfaces>
<!-- Phase 19 相关实现，UAT 测试项的技术依据 -->
<!-- From STATE.md Decisions: -->
<!-- 19-P01: NarrationOutputSchema enforces min(10)/max(300) via Zod; callGenerateObject replaces callGenerateText in generateNarration -->
<!-- 19-P02: classifyIntent uses callGenerateObject with role 'retrieval-planner'; intent classification tokens now visible in :cost -->
<!-- 19-P03: runSummarizerLoop checks signal.aborted at 3 points; SIGINT handler stored as named const for process.off deregistration -->
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: 创建 21-UAT-CHECKLIST.md</name>
  <files>.planning/phases/21-distribution-live-validation/21-UAT-CHECKLIST.md</files>
  <read_first>
    - .planning/phases/21-distribution-live-validation/21-CONTEXT.md (UAT-01 决策；automation scope)
    - .planning/STATE.md (decisions 19-P01/19-P02/19-P03 — UAT 测试项技术依据)
  </read_first>
  <action>
创建文件，内容如下（完整写入，不省略）：

```markdown
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
```
  </action>
  <verify>
    <automated>test -f .planning/phases/21-distribution-live-validation/21-UAT-CHECKLIST.md && grep -c "result: \[pending" .planning/phases/21-distribution-live-validation/21-UAT-CHECKLIST.md | xargs -I{} test {} -eq 3</automated>
  </verify>
  <acceptance_criteria>
    - `test -f .planning/phases/21-distribution-live-validation/21-UAT-CHECKLIST.md` → 存在
    - `grep "bun test" .planning/phases/21-distribution-live-validation/21-UAT-CHECKLIST.md` → 有输出（automation gate）
    - `grep ":cost" .planning/phases/21-distribution-live-validation/21-UAT-CHECKLIST.md` → 有输出
    - `grep ":replay" .planning/phases/21-distribution-live-validation/21-UAT-CHECKLIST.md` → 有输出
    - `grep "summarizer" .planning/phases/21-distribution-live-validation/21-UAT-CHECKLIST.md` → 有输出
    - `grep -c "result: \[pending" .planning/phases/21-distribution-live-validation/21-UAT-CHECKLIST.md` → 输出 3
  </acceptance_criteria>
  <done>21-UAT-CHECKLIST.md 存在，包含 automation gate 区块 + 3 个带 expected/result 的测试项，status: pending</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| 人工 UAT → live API | 测试者使用真实 API Key；本计划不涉及 Key 存储或传输 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-21-07 | Information Disclosure | UAT 执行时的 API Key 泄露 | accept | UAT checklist 为文档，不涉及 Key 处理；Key 管理属于执行者职责，在 .env 中配置 |
| T-21-08 | Tampering | UAT 结果篡改（result 字段） | accept | 文档由开发者本人维护，无多方信任边界；无需保护 |
</threat_model>

<verification>
```bash
test -f .planning/phases/21-distribution-live-validation/21-UAT-CHECKLIST.md && echo "EXISTS"
grep "bun test" .planning/phases/21-distribution-live-validation/21-UAT-CHECKLIST.md
grep ":cost" .planning/phases/21-distribution-live-validation/21-UAT-CHECKLIST.md
grep ":replay" .planning/phases/21-distribution-live-validation/21-UAT-CHECKLIST.md
grep -c "result: \[pending" .planning/phases/21-distribution-live-validation/21-UAT-CHECKLIST.md
# 最后一条应输出 3
```
</verification>

<success_criteria>
- 21-UAT-CHECKLIST.md 存在，YAML frontmatter status: pending (per UAT-01)
- Automation gate 区块列出 3 个命令（bun test / bun tsc --noEmit / npm publish --dry-run）
- 3 个测试项覆盖 :cost（含 intent classification）、:replay（5 轮历史）、summarizer（10+ 交互无 unhandled rejection）
- 每个测试项包含 expected 和 result: [pending] 行
- 文件不阻塞 phase 完成 (per UAT-01)
</success_criteria>

<output>
After completion, create `.planning/phases/21-distribution-live-validation/21-P03-SUMMARY.md`
</output>
