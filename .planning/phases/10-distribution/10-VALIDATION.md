---
phase: 10
slug: distribution
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 10-01-01 | 01 | 1 | DIST-01 | — | N/A | unit | `bun test` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | DIST-02 | — | N/A | unit | `bun test` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 1 | DIST-03 | — | N/A | integration | `bun test` | ❌ W0 | ⬜ pending |
| 10-03-01 | 03 | 2 | DIST-04 | — | N/A | integration | `bun test` | ❌ W0 | ⬜ pending |
| 10-04-01 | 04 | 2 | DIST-05 | — | N/A | e2e | manual | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Build pipeline tests — verify `bun build` produces valid bundle
- [ ] Path resolution tests — verify `resolveDataDir()` fallback chain
- [ ] Package.json validation tests — verify required fields present

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
