---
phase: 7
slug: streaming-output
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun test (built-in) |
| **Config file** | bunfig.toml |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | STREAM-01 | — | N/A | unit | `bun test` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | STREAM-01 | — | N/A | unit | `bun test` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | STREAM-02 | — | N/A | unit | `bun test` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 1 | STREAM-02 | — | N/A | unit | `bun test` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 2 | STREAM-03 | — | N/A | unit | `bun test` | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 2 | STREAM-03 | — | N/A | unit | `bun test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/streaming/sentence-buffer.test.ts` — stubs for STREAM-01 sentence boundary buffering
- [ ] `tests/streaming/stream-npc-dialogue.test.ts` — stubs for STREAM-02 NPC streaming
- [ ] `tests/streaming/skip-to-end.test.ts` — stubs for STREAM-03 skip behavior

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual typewriter effect in terminal | STREAM-01 | Requires visual inspection of terminal rendering | Launch game, trigger narration, observe character-by-character appearance |
| Skip animation with Enter/Space | STREAM-03 | Requires interactive keyboard input | During streaming, press Enter or Space, verify full text appears immediately |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
