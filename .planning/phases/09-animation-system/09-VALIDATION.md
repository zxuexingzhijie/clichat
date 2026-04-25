---
phase: 9
slug: animation-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun:test (built-in) |
| **Config file** | none — Bun discovers test files automatically |
| **Quick run command** | `bun test --filter "animation\|timed-effect\|typewriter\|toast\|flash\|spinner\|chapter-summary"` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test --filter "animation\|timed-effect\|typewriter\|toast\|flash\|spinner\|chapter-summary"`
- **After every plan wave:** Run `bun test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | ANIM-01 | — | N/A | unit | `bun test src/ui/hooks/use-typewriter.test.ts` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | ANIM-03 | — | N/A | unit | `bun test src/ui/hooks/use-timed-effect.test.ts` | ❌ W0 | ⬜ pending |
| 09-01-03 | 01 | 1 | ANIM-04 | — | N/A | unit | `bun test src/ui/hooks/use-event-flash.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 2 | ANIM-02 | — | N/A | unit | `bun test src/ui/components/scene-spinner.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-02 | 02 | 2 | ANIM-05 | — | N/A | unit | `bun test src/ui/hooks/use-toast.test.ts` | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 3 | CARRY-02 | — | N/A | unit | `bun test src/ui/panels/chapter-summary-panel.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/ui/hooks/use-timed-effect.test.ts` — stubs for ANIM-03, ANIM-04
- [ ] `src/ui/hooks/use-typewriter.test.ts` — stubs for ANIM-01
- [ ] `src/ui/hooks/use-event-flash.test.ts` — stubs for ANIM-04
- [ ] `src/ui/hooks/use-toast.test.ts` — stubs for ANIM-05
- [ ] `src/ui/components/scene-spinner.test.ts` — stubs for ANIM-02
- [ ] `src/ui/panels/chapter-summary-panel.test.ts` — stubs for CARRY-02

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Title typewriter visual quality | ANIM-01 | Visual appearance of gradient+typewriter in terminal | Run game, observe title screen animation speed, gradient colors, skip behavior |
| Spinner-to-streaming transition | ANIM-02 | Timing coordination with real AI response | Start game, trigger narration, observe spinner dimout -> text transition |
| Scene fade-in/out visual | ANIM-03 | Visual appearance of dimColor toggling | Move between scenes, observe transition smoothness |
| HP flash visual in status bar | ANIM-04 | Visual flash appearance in terminal | Enter combat, take damage, observe HP flash color+timing |
| Toast banner visibility | ANIM-05 | Visual appearance and auto-dismiss timing | Complete quest, discover knowledge, observe toast appearance |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
