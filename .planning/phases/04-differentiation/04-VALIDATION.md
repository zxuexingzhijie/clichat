---
phase: 4
slug: differentiation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun test (built-in, Jest-compatible API) |
| **Config file** | bunfig.toml (existing) |
| **Quick run command** | `bun test --bail` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test --bail`
- **After every plan wave:** Run `bun test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (populated by planner) | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.
- bun test already configured and running 418 tests across 34 files.
- No new test framework or config changes needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ASCII map visual layout | CLI-02 | Visual rendering correctness requires terminal inspection | Run game, `/map`, verify node layout + paths + legend render correctly |
| Branch tree visual layout | SAVE-02 | Visual rendering of tree structure | Create 2+ branches, `/branch tree`, verify tree lines + nodes + highlighting |
| Keyboard shortcuts in non-input mode | CLI-04 | Input mode detection requires manual terminal interaction | Press `m`/`j`/`c`/`b`/`?` in non-input mode, verify panel opens; verify they don't fire during typing |
| CJK text alignment in panels | CLI-02, CLI-03 | CJK width rendering varies by terminal | Verify Chinese text in map labels, codex entries, branch names aligns correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
