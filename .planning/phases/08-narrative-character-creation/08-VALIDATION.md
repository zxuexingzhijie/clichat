---
phase: 8
slug: narrative-character-creation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun:test (built-in, Jest-compatible API) |
| **Config file** | bunfig.toml (`[test]` section, minimal config) |
| **Quick run command** | `bun test src/engine/weight-resolver.test.ts -x` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test src/engine/weight-resolver.test.ts src/engine/guard-dialogue-loader.test.ts -x`
- **After every plan wave:** Run `bun test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | NCC-02 | T-08-02 | Zod validates guard-dialogue.yaml schema | unit | `bun test src/engine/guard-dialogue-loader.test.ts -x` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | NCC-03 | — | N/A | unit | `bun test src/engine/weight-resolver.test.ts -x` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 1 | NCC-01 | — | N/A | unit | `bun test src/state/game-store.test.ts -x` | ✅ | ⬜ pending |
| 08-03-01 | 03 | 2 | NCC-01, NCC-02, NCC-04 | T-08-01 | Name input length/control char validation | integration | `bun test src/ui/screens/narrative-creation-screen.test.ts -x` | ❌ W0 | ⬜ pending |
| 08-03-02 | 03 | 2 | NCC-03 | — | N/A | unit | `bun test src/engine/character-creation.test.ts -x` | ✅ | ⬜ pending |
| 08-04-01 | 04 | 3 | NCC-04 | — | N/A | integration | `bun test src/ui/screens/narrative-creation-screen.test.ts::test_transition -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/engine/weight-resolver.test.ts` — stubs for NCC-03a (accumulation), NCC-03b (resolution), NCC-03c (tiebreaker determinism)
- [ ] `src/engine/guard-dialogue-loader.test.ts` — stubs for NCC-02 (YAML loading, Zod schema validation)
- [ ] `src/data/codex/guard-dialogue.yaml` — the data file itself (needed for loader tests)

*Existing infrastructure covers character-creation engine (11 tests pass) and game-store tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Guard narration streams with typewriter effect | NCC-02 | Visual streaming timing in terminal | Start new game, observe character-by-character text rendering in guard narration area |
| Skip-to-end on keypress during streaming | NCC-02 | Visual interaction timing | Press Enter/Space while guard text is streaming, verify full text appears immediately |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
