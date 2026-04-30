---
phase: 21-distribution-live-validation
verified: 2026-04-30T22:35:00Z
status: human_needed
score: 1/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Live API session: :cost 显示含 intent classification 的 token 统计"
    expected: ":cost 面板显示至少两行 token 统计 — narration + intent-classifier，均为正整数"
    why_human: "需真实 API Key 启动游戏执行；无法静态验证 token 计数行为"
  - test: "Live API session: :replay 回放最近 5 轮叙事正确"
    expected: "依次显示最近 5 轮叙事，顺序与游戏历史一致，无占位符"
    why_human: "需 live 会话完成 5 轮交互后验证；纯文件扫描无法覆盖"
  - test: "Live API session: 背景 summarizer 在 10+ 次 NPC 交互后压缩记忆无错误"
    expected: "无 unhandled promise rejection；NPC memory 条数减少"
    why_human: "需 live 会话累计 10+ 次对话；异步运行时行为无法静态验证"
---

# Phase 21: Distribution & Live Validation 验证报告

**Phase Goal:** 包体可发布，live API 行为与实现声明一致
**Verified:** 2026-04-30T22:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `npm publish --dry-run` 无 error — package.json/workflows 无 OWNER 占位符 | VERIFIED | package.json: version=1.4.0, author=Makoto, repository.url=git+https://... P01-SUMMARY: dry-run exit 0 confirmed. commit d7c4c06 实际修改 package.json 已验证 |
| 2 | Live API: `:cost` 显示含 intent classification 的 token 统计 | ? NEEDS HUMAN | UAT-CHECKLIST result: pending — 需真实 API Key |
| 3 | Live API: `:replay` 回放最近 5 轮叙事正确 | ? NEEDS HUMAN | UAT-CHECKLIST result: pending — 需 live 会话 |
| 4 | Live API: 背景 summarizer 压缩 NPC 记忆无错误 | ? NEEDS HUMAN | UAT-CHECKLIST result: pending — 需 10+ 次交互 |

**Score:** 1/4 truths verified (3 deferred to human — non-blocking per UAT-01)

**注：** CONTEXT.md UAT-01 决策明确："automation gate（bun test + tsc + dry-run）通过即可标记自动化验证通过；Live UAT 不阻塞 phase 完成"。三项 live 测试为人工 checklist 项，状态 human_needed 为预期设计。

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | version 1.4.0, author Makoto, git+https:// url | VERIFIED | 三字段均已确认 |
| `.planning/phases/21-distribution-live-validation/21-HOMEBREW-REVIEW.md` | 5 PASS 检查项 | VERIFIED | 5 项全 PASS，commit 5e10616 存在 |
| `.planning/phases/21-distribution-live-validation/21-UAT-CHECKLIST.md` | automation gate + 3 手工测试项 | VERIFIED | 文件存在，内容完整，commit f94af05 存在 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| package.json version | npm publish --dry-run | npm CLI | WIRED | P01-SUMMARY 明确记录 exit 0 |
| release.yml update-homebrew | zxuexingzhijie/homebrew-chronicle | HOMEBREW_TAP_TOKEN dispatch | VERIFIED (static) | 5 项静态检查全 PASS；PAT secret 存在需用户手动确认 |

### Data-Flow Trace (Level 4)

不适用 — Phase 21 为发布元数据 + 文档产物，无动态数据渲染组件。

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| package.json version 字段 | `grep '"version": "1.4.0"' package.json` | 匹配成功 | PASS |
| package.json author 字段 | `grep '"author": "Makoto"' package.json` | 匹配成功 | PASS |
| repository.url 格式 | 直接读取文件确认 | `git+https://github.com/zxuexingzhijie/clichat.git` | PASS |
| commit d7c4c06 存在 | `git show d7c4c06 --stat` | package.json 修改确认 | PASS |
| commit 5e10616 存在 | `git show 5e10616 --stat` | 21-HOMEBREW-REVIEW.md 创建确认 | PASS |
| commit f94af05 存在 | `git show f94af05 --stat` | 21-UAT-CHECKLIST.md 创建确认 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|----------|
| DIST-01 | 21-P01 | version 1.4.0, author, npm publish dry-run | SATISFIED | package.json 已确认；dry-run exit 0 per P01-SUMMARY |
| DIST-02 | 21-P01 | author "Makoto" | SATISFIED | package.json line 34 |
| DIST-03 | 21-P01 | repository.url git+https:// | SATISFIED | package.json line 37 |
| DIST-04 | 21-P02 | Homebrew dispatch 配置可用 | SATISFIED (static) | 5 项 PASS per 21-HOMEBREW-REVIEW.md |
| UAT-01 | 21-P03 | Live API 人工 UAT checklist | CHECKLIST CREATED | 21-UAT-CHECKLIST.md 存在；执行结果 pending（非阻塞） |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | 无 | — | package.json 为元数据变更；21-*.md 为文档；无代码 anti-pattern |

### Human Verification Required

#### 1. :cost token 统计含 intent classification

**Test:** 配置真实 API Key，启动 `bun run src/cli.ts`，输入 2+ 条自由文本指令后执行 `:cost`
**Expected:** 显示 narration + intent-classifier 两行 token 统计，均为正整数，total 为两者之和
**Why human:** 需真实 API 调用；token 计数在运行时动态产生，静态扫描无法验证

#### 2. :replay 回放 5 轮叙事

**Test:** 完成 5+ 轮交互（移动/对话/战斗各至少 1 轮）后执行 `:replay`
**Expected:** 依次显示最近 5 轮叙事，顺序正确，无占位符文本
**Why human:** 需 live 会话历史；行为依赖运行时状态

#### 3. 背景 summarizer 10+ 次交互后压缩无错误

**Test:** 同一 NPC 进行 10+ 次 `:talk` 对话，观察终端错误输出
**Expected:** 无 unhandled promise rejection；NPC memory 条数减少
**Why human:** 异步后台任务，需 live 运行时观察；Phase 19 P03 实现了 AbortSignal + SIGINT wiring，静态可信，但运行时行为需人工确认

### Gaps Summary

无阻塞性 gap。Phase 21 的自动化范围（package.json 元数据 + npm publish dry-run + Homebrew 配置静态审查 + UAT checklist 创建）全部完成并验证。

三项 live API 测试按 CONTEXT.md UAT-01 决策设计为人工 checklist（非阻塞），状态 `human_needed` 为预期结果，不代表实现缺陷。

---

_Verified: 2026-04-30T22:35:00Z_
_Verifier: Ducc (gsd-verifier)_
