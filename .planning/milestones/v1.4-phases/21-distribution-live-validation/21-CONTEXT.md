---
phase: 21
name: Distribution & Live Validation
status: context_complete
date: 2026-04-30
---

# Phase 21 Context

## Domain

将 Chronicle 打包成可发布状态，并通过 Live API 会话验证关键 AI 功能正确运行。

## Canonical Refs

- `.planning/ROADMAP.md` — Phase 21 success criteria (DIST-01, UAT-01)
- `.planning/PROJECT.md` — requirements DIST-01, UAT-01
- `package.json` — 当前 1.1.0，需升级
- `.github/workflows/release.yml` — Homebrew dispatch 流程
- `.github/workflows/ci.yml` — CI pipeline

## Decisions

### DIST-01: 版本号

**决定：** `package.json` version 升至 `1.4.0`

理由：项目已完成 v1.4 milestone，保持与 ROADMAP 一致。

### DIST-02: author 字段

**决定：** `"author": "Makoto"`

`package.json` 目前缺少 `author` 字段，Phase 21 补全。

### DIST-03: npm publish 验证标准

**决定：** `npm publish --dry-run` 无 error（warn 可接受）即为通过

当前状态：已有 1 个 warn（`repository.url` 自动修正），需运行 `npm pkg fix` 消除。

### UAT-01: Live UAT 验证方式

**决定：** 写成人工执行 checklist，不阻塞 phase 完成

Phase 21 产物包含 `21-UAT-CHECKLIST.md`，内容：
- `:cost` 显示 token 数（含 intent classification）
- `:replay` 回放最近 5 轮正确
- 背景 summarizer 10+ 次交互后压缩 NPC 记忆，无 unhandled rejection

**Automation scope：** `bun test`（1115 tests）+ `bun tsc --noEmit` + `npm publish --dry-run` 全部通过即可标记自动化验证通过。

### DIST-04: Homebrew tap 验证

**决定：** Phase 21 需验证 `release.yml` → `zxuexingzhijie/homebrew-chronicle` dispatch 流程可用

- Homebrew tap repo 已存在（`zxuexingzhijie/homebrew-chronicle`）
- 验证方式：检查 `HOMEBREW_TAP_TOKEN` secret 是否配置，review release workflow dispatch payload 格式是否与 tap repo 的 event handler 匹配
- 不需要实际触发 release，只需确认配置正确

## Scope Boundary

**In scope:**
- `package.json` 版本 + author + `npm pkg fix`
- `npm publish --dry-run` 通过
- Homebrew dispatch 流程 review + 验证
- Live UAT checklist 文档（不要求执行结果）

**Out of scope:**
- 实际执行 `npm publish`（需用户手动操作）
- 实际触发 GitHub Release（需 tag push）
- Live API UAT 执行（人工 checklist）

## Prior Decisions Carried Forward

- 无需替换 OWNER placeholder（workflows 已使用真实 username `zxuexingzhijie`）
- `repository.url` 需 `npm pkg fix` 修正格式
