---
phase: 2
slug: core-gameplay
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-21
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun test (built-in) |
| **Config file** | bunfig.toml |
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
| 01-T1 | 02-01 | 1 | AI-01,AI-02,AI-03 | T-02-01 | API keys from env only | unit | `bun test src/ai/ --bail` | Wave 0 | ⬜ pending |
| 01-T2 | 02-01 | 1 | AI-01,AI-02,AI-03 | T-02-02 | maxTokens enforced | unit | `bun test src/state/ --bail` | Wave 0 | ⬜ pending |
| 02-T1 | 02-02 | 1 | CONT-02,CONT-04 | T-02-03 | Zod schema validation | unit | `bun test src/codex/ --bail` | Exists | ⬜ pending |
| 02-T2 | 02-02 | 1 | CONT-02,CONT-04 | T-02-04 | N/A (static content) | unit | `bun test src/codex/ --bail` | Exists | ⬜ pending |
| 03-T1 | 02-03 | 2 | PLAY-01 | T-02-05 | Attrs from codex only | unit | `bun test src/engine/character-creation.test.ts -v` | Wave 0 | ⬜ pending |
| 03-T2 | 02-03 | 2 | PLAY-01 | T-02-06 | Zod PlayerState validation | compile | `bun build src/app.tsx --no-bundle --target=bun` | N/A | ⬜ pending |
| 03-T3 | 02-03 | 2 | PLAY-01 | — | Visual verification | checkpoint | Human verify | N/A | ⬜ pending |
| 04-T1 | 02-04 | 2 | AI-01,AI-02,AI-03 | T-02-07 | Input in user prompt only | compile | `bun build src/ai/prompts/*.ts --no-bundle --target=bun` | N/A | ⬜ pending |
| 04-T2 | 02-04 | 2 | AI-01,AI-02,AI-03 | T-02-08,T-02-09,T-02-10,T-02-11 | Retry+fallback, safety filter | unit (mock) | `bun test src/ai/ --bail` | Wave 0 | ⬜ pending |
| 05-T1 | 02-05 | 3 | PLAY-02,AI-01 | T-02-12 | Exit validation | unit | `bun test src/engine/scene-manager.test.ts -v` | Wave 0 | ⬜ pending |
| 05-T2 | 02-05 | 3 | PLAY-02,AI-01 | T-02-13 | AI hallucination guard | unit+compile | `bun test src/ --bail` | Mixed | ⬜ pending |
| 06-T1 | 02-06 | 4 | PLAY-03,AI-02 | T-02-14 | Indexed responses only | unit | `bun test src/engine/dialogue-manager.test.ts -v` | Wave 0 | ⬜ pending |
| 06-T2 | 02-06 | 4 | PLAY-03,AI-02 | T-02-15,T-02-16 | NPC knowledge boundaries | compile | `bun build src/ui/panels/dialogue-panel.tsx src/ui/screens/game-screen.tsx --no-bundle --target=bun` | N/A | ⬜ pending |
| 07-T1 | 02-07 | 5 | PLAY-04 | T-02-17,T-02-18 | Sequential state machine | unit | `bun test src/engine/combat-loop.test.ts -v` | Wave 0 | ⬜ pending |
| 07-T2 | 02-07 | 5 | PLAY-04 | T-02-19 | Fallback narration | compile | `bun build src/ui/panels/combat-status-bar.tsx src/ui/panels/combat-actions-panel.tsx --no-bundle --target=bun` | N/A | ⬜ pending |
| 07-T3 | 02-07 | 5 | PLAY-04 | T-02-17 | Combat routing guard | compile | `bun build src/ui/screens/game-screen.tsx src/game-loop.ts --no-bundle --target=bun` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for character creation (PLAY-01)
- [ ] Test stubs for scene exploration (PLAY-02)
- [ ] Test stubs for NPC dialogue (PLAY-03)
- [ ] Test stubs for combat system (PLAY-04)
- [ ] Test stubs for AI narration (AI-01, AI-02, AI-03)

*Existing test infrastructure from Phase 1 covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AI-generated Chinese prose quality | AI-01 | Subjective quality assessment | Review 10 narration samples for 80-180 char length, coherence, no world-fact invention |
| NPC personality consistency | AI-02 | Requires multi-turn dialogue evaluation | Talk to same NPC 5+ times, check personality traits maintained |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
