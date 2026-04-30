---
phase: 21-distribution-live-validation
type: homebrew-dispatch-review
reviewed: 2026-04-30
status: PASS_WITH_MANUAL_ITEMS
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
| 4 | client-payload 键名 | version / darwin_arm64_sha256 / darwin_x64_sha256 / linux_x64_sha256 | PASS | 四键完整，变量引用 steps.hashes.outputs.* 正确 |
| 5 | 依赖关系链 | `needs: release` | PASS | Homebrew 更新在 GitHub Release 成功后触发 |

## 需用户手动确认的项目

- [ ] GitHub repo Settings > Secrets and variables > Actions 中已添加 `HOMEBREW_TAP_TOKEN`（Personal Access Token，需有 `repo` 权限，且仅授予 `zxuexingzhijie/homebrew-chronicle` 写权限，**不授予** chronicle-cli 主仓库写权限）
- [ ] `zxuexingzhijie/homebrew-chronicle` 仓库中存在监听 `repository_dispatch` 且 `event-type` 为 `update-formula` 的 GitHub Actions workflow，能处理 `client_payload.version`、`client_payload.darwin_arm64_sha256`、`client_payload.darwin_x64_sha256`、`client_payload.linux_x64_sha256`

## 结论

release.yml 的 Homebrew dispatch 配置在可静态验证的范围内全部通过。**无需修改 release.yml。** 发布前用户需完成上述两项手动确认。
