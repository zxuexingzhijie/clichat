---
phase: 10
slug: distribution
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-25
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun test (built-in) |
| **Config file** | bunfig.toml |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | DIST-01 | T-10-01 | Path traversal guard | unit | `bun test src/paths.test.ts` | Created by Plan 01 Task 1 | pending |
| 10-01-02 | 01 | 1 | DIST-02 | -- | N/A | smoke | `ls world-data/codex/races.yaml && bun test` | Existing suite | pending |
| 10-02-01 | 02 | 2 | DIST-01 | T-10-04 | CLI arg guard | integration | `bun src/cli.ts --version` | Created by Plan 02 Task 1 | pending |
| 10-02-02 | 02 | 2 | DIST-02 | -- | N/A | integration | `bun run build && ls dist/cli.js && bun test` | Created by Plan 02 Task 2 | pending |
| 10-03-01 | 03 | 3 | DIST-05 | T-10-08 | Quality gate before publish | unit | `grep -q "bun test" .github/workflows/ci.yml` | Created by Plan 03 Task 1 | pending |
| 10-03-02 | 03 | 3 | DIST-05 | T-10-07 | Secret-only auth | unit | `grep -c "quality-gate\|publish-npm\|build-binaries" .github/workflows/release.yml` | Created by Plan 03 Task 2 | pending |
| 10-04-01 | 04 | 3 | DIST-03 | T-10-11 | SHA256 integrity | unit | `grep "class Chronicle < Formula" homebrew/Formula/chronicle.rb` | Created by Plan 04 Task 1 | pending |
| 10-05-01 | 05 | 4 | DIST-01,02,03,04,05 | T-10-14 | Package allowlist | e2e | `bun test && bun run build && ls README.md LICENSE` | Created by Plan 05 Task 1 | pending |
| 10-05-02 | 05 | 4 | ALL | -- | N/A | manual | Human review checkpoint | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

All Wave 0 gaps are covered by plan tasks:

- [x] Build pipeline tests -- covered by Plan 02 Task 2 (`bun run build && ls dist/cli.js`)
- [x] Path resolution tests -- covered by Plan 01 Task 1 (`bun test src/paths.test.ts`, TDD plan creates test file)
- [x] Package.json validation -- covered by Plan 02 Task 2 acceptance criteria (checks name, version, bin, files fields)
- [x] Build output test -- covered by Plan 02 Task 2 verify (`bun run build && ls dist/cli.js`)

*Existing test infrastructure (637 tests) covers all phase requirements for regression.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `npx chronicle-cli` launches game | DIST-01 | Requires npm publish + real install | Publish to npm, run `npx chronicle-cli` in clean env |
| `brew install chronicle` works | DIST-03 | Requires Homebrew tap + formula | Install from tap in clean macOS env |
| `v*` tag triggers release | DIST-05 | Requires GitHub Actions runner | Push tag, verify workflow completes |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated
