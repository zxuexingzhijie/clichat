---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun test (built-in, Jest-compatible API) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test --coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test --coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | CORE-01 | — | N/A | unit | `bun test` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | CORE-02 | — | N/A | unit | `bun test` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | CORE-03 | — | N/A | unit | `bun test` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | CORE-04 | — | N/A | unit | `bun test` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 1 | CLI-01 | — | N/A | integration | `bun test` | ❌ W0 | ⬜ pending |
| 1-01-06 | 01 | 1 | WORLD-01 | — | N/A | unit | `bun test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/` directory — test infrastructure setup
- [ ] `bun install` — install all dependencies (bun, ink, react, commander, ai SDK, zod, etc.)
- [ ] Test stubs for CORE-01 through CORE-04, CLI-01, WORLD-01

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Four-panel layout renders correctly | CLI-01 | Visual terminal rendering cannot be fully automated | Run app, verify scene/status/actions/input panels visible and resize |
| CJK text doesn't break layout | CLI-01 | Requires visual inspection of Chinese characters | Type Chinese text, verify column alignment |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
