---
phase: 21-distribution-live-validation
plan: "02"
type: execute
wave: 1
depends_on: [21-P01]
files_modified: []
autonomous: true
requirements: [DIST-01]
must_haves:
  truths:
    - "release.yml dispatch payload 键名与 tap repo handler 匹配"
    - "HOMEBREW_TAP_TOKEN secret 引用格式正确"
    - "target repo 路径 zxuexingzhijie/homebrew-chronicle 与 CONTEXT.md 决策一致"
    - "event-type: update-formula 已文档化为 tap repo 所需触发器"
  artifacts:
    - path: ".planning/phases/21-distribution-live-validation/21-HOMEBREW-REVIEW.md"
      provides: "Homebrew dispatch 配置审查报告"
      contains: "HOMEBREW_TAP_TOKEN"
  key_links:
    - from: ".github/workflows/release.yml"
      to: "zxuexingzhijie/homebrew-chronicle"
      via: "peter-evans/repository-dispatch@v3 event-type: update-formula"
      pattern: "repository: zxuexingzhijie/homebrew-chronicle"
---

<objective>
审查 release.yml Homebrew dispatch 配置，生成配置合规性报告，确认无需修改（只读审查）。

Purpose: DIST-04 决策要求验证 Homebrew tap dispatch 流程配置正确，但不实际触发 release。
Output: .planning/phases/21-distribution-live-validation/21-HOMEBREW-REVIEW.md — 审查报告，记录每个检查项的状态和结论。
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.github/workflows/release.yml
</context>

<tasks>

<task type="auto">
  <name>Task 1: 审查 release.yml Homebrew dispatch 块并生成审查报告</name>
  <files>.planning/phases/21-distribution-live-validation/21-HOMEBREW-REVIEW.md</files>
  <read_first>
    - .github/workflows/release.yml (全文，重点 update-homebrew job，lines 90–119)
    - .planning/phases/21-distribution-live-validation/21-CONTEXT.md (DIST-04 决策内容)
  </read_first>
  <action>
读取 release.yml 的 update-homebrew job，对照以下检查清单逐项审查，然后将结果写入 21-HOMEBREW-REVIEW.md：

**检查清单（5 项）：**

1. **Token secret 引用**
   - 检查项：`token: ${{ secrets.HOMEBREW_TAP_TOKEN }}` 格式正确
   - 通过条件：secret 名称为 `HOMEBREW_TAP_TOKEN`（与 DIST-04 决策一致）
   - 注：secret 是否已在仓库 Settings 中配置无法在 workflow 文件层面验证；记录"需用户确认已在 GitHub repo Settings > Secrets 中添加 HOMEBREW_TAP_TOKEN"

2. **目标仓库路径**
   - 检查项：`repository: zxuexingzhijie/homebrew-chronicle`
   - 通过条件：与 CONTEXT.md DIST-04 决策中的 tap repo 名称完全一致

3. **event-type 键名**
   - 检查项：`event-type: update-formula`
   - 通过条件：event-type 值为 `update-formula`（tap repo handler 需监听此事件）
   - 注：tap repo 的实际 workflow trigger 无法从本地验证；记录"需用户确认 homebrew-chronicle 仓库中存在监听 repository_dispatch / update-formula 的 workflow"

4. **client-payload 键名**
   - 检查项：payload 包含 `version`、`darwin_arm64_sha256`、`darwin_x64_sha256`、`linux_x64_sha256`
   - 通过条件：四个键名均存在且引用正确的 `steps.hashes.outputs.*` 变量

5. **依赖关系链**
   - 检查项：update-homebrew job 的 `needs: release` 声明
   - 通过条件：确保在 GitHub Release 创建成功后才触发 Homebrew 更新

**报告格式** — 写入 21-HOMEBREW-REVIEW.md：

```markdown
---
phase: 21-distribution-live-validation
type: homebrew-dispatch-review
reviewed: 2026-04-30
status: [PASS / PASS_WITH_MANUAL_ITEMS]
---

# Homebrew Dispatch 配置审查报告

## 审查范围

文件：`.github/workflows/release.yml` — `update-homebrew` job (lines 90–119)
决策依据：CONTEXT.md DIST-04

## 检查结果

| # | 检查项 | 配置值 | 状态 | 备注 |
|---|--------|--------|------|------|
| 1 | HOMEBREW_TAP_TOKEN secret 引用 | `${{ secrets.HOMEBREW_TAP_TOKEN }}` | PASS | 格式正确；secret 是否存在需用户在 GitHub Settings 确认 |
| 2 | 目标仓库路径 | `zxuexingzhijie/homebrew-chronicle` | PASS | 与 DIST-04 决策一致 |
| 3 | event-type 键名 | `update-formula` | PASS | tap repo workflow 需监听此事件（用户需确认） |
| 4 | client-payload 键名 | version / darwin_arm64_sha256 / darwin_x64_sha256 / linux_x64_sha256 | PASS | 四键完整，变量引用正确 |
| 5 | 依赖关系链 | `needs: release` | PASS | Homebrew 更新在 GitHub Release 成功后触发 |

## 需用户手动确认的项目

- [ ] GitHub repo Settings > Secrets and variables > Actions 中已添加 `HOMEBREW_TAP_TOKEN`（Personal Access Token，需有 `repo` 权限，指向 `zxuexingzhijie/homebrew-chronicle`）
- [ ] `zxuexingzhijie/homebrew-chronicle` 仓库中存在监听 `repository_dispatch` 且 `event-type` 为 `update-formula` 的 GitHub Actions workflow，能处理 `client_payload.version`、`client_payload.darwin_arm64_sha256`、`client_payload.darwin_x64_sha256`、`client_payload.linux_x64_sha256`

## 结论

release.yml 的 Homebrew dispatch 配置在可静态验证的范围内全部通过。**无需修改 release.yml。** 发布前用户需完成上述两项手动确认。
```

将上述完整内容（替换实际检查结果）写入文件。
  </action>
  <verify>
    <automated>test -f .planning/phases/21-distribution-live-validation/21-HOMEBREW-REVIEW.md && grep -c "PASS" .planning/phases/21-distribution-live-validation/21-HOMEBREW-REVIEW.md | xargs -I{} test {} -ge 5</automated>
  </verify>
  <acceptance_criteria>
    - `test -f .planning/phases/21-distribution-live-validation/21-HOMEBREW-REVIEW.md` → 文件存在
    - `grep "HOMEBREW_TAP_TOKEN" .planning/phases/21-distribution-live-validation/21-HOMEBREW-REVIEW.md` → 有输出
    - `grep "zxuexingzhijie/homebrew-chronicle" .planning/phases/21-distribution-live-validation/21-HOMEBREW-REVIEW.md` → 有输出
    - `grep "update-formula" .planning/phases/21-distribution-live-validation/21-HOMEBREW-REVIEW.md` → 有输出
    - 报告中 5 个检查项状态均记录（PASS 或带备注）
  </acceptance_criteria>
  <done>21-HOMEBREW-REVIEW.md 存在，包含 5 项检查结果，结论明确说明无需修改 release.yml</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| release.yml → zxuexingzhijie/homebrew-chronicle | cross-repo dispatch 使用 PAT；token 存储在 GitHub Secrets |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-21-04 | Elevation of Privilege | HOMEBREW_TAP_TOKEN PAT 权限范围 | mitigate | PAT 应仅授予 zxuexingzhijie/homebrew-chronicle 的 repo 权限，不授予 chronicle-cli 主仓库写权限；在审查报告的手动确认项中记录此要求 |
| T-21-05 | Tampering | client-payload SHA256 哈希 | accept | 哈希由 sha256sum 在 CI runner 上计算，攻击者需先入侵 CI runner 才能篡改；GitHub Actions runner 安全由 GitHub 保障 |
| T-21-06 | Spoofing | repository-dispatch event-type | accept | event-type 为 update-formula，tap repo handler 仅处理此事件；无法伪造来自其他仓库的 dispatch |
</threat_model>

<verification>
```bash
# 确认审查报告存在且内容完整
test -f .planning/phases/21-distribution-live-validation/21-HOMEBREW-REVIEW.md && echo "EXISTS"
grep "HOMEBREW_TAP_TOKEN" .planning/phases/21-distribution-live-validation/21-HOMEBREW-REVIEW.md
grep "update-formula" .planning/phases/21-distribution-live-validation/21-HOMEBREW-REVIEW.md
grep "结论" .planning/phases/21-distribution-live-validation/21-HOMEBREW-REVIEW.md
```
</verification>

<success_criteria>
- 21-HOMEBREW-REVIEW.md 存在，包含完整 5 项检查表
- release.yml 未被修改（只读审查）
- 报告明确记录需用户手动确认的两项内容
- 结论：无需修改 release.yml (per DIST-04)
</success_criteria>

<output>
After completion, create `.planning/phases/21-distribution-live-validation/21-P02-SUMMARY.md`
</output>
