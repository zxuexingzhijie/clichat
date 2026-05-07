---
phase: 22
slug: ux-architecture-refactor
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-08
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test |
| **Config file** | `bunfig.toml`; package script in `package.json` |
| **Quick run command** | `bun test <focused test files>` |
| **Full suite command** | `bun test` |
| **Typecheck command** | `bun run typecheck` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the focused command listed for that task, plus `bun run typecheck` when TypeScript surfaces changed.
- **After every plan:** Run `bun run typecheck` and `bun test` per D-13.
- **Before `/gsd-verify-work`:** `bun run typecheck` and `bun test` must be green.
- **Max feedback latency:** one plan; no plan may complete without full-suite feedback.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | UXA-05 | T-22-01-01 / T-22-01-02 | ManualClock remains explicit test seam; runtime defaults to systemClock | unit | `bun test src/time/clock.test.ts` | ❌ W0 | ⬜ pending |
| 22-01-02 | 01 | 1 | UXA-05 | T-22-01-02 / T-22-01-03 | Timing utilities clear/reset timers and avoid dynamic code execution | unit | `bun test src/time/clock.test.ts src/ui/hooks/use-timed-effect.test.ts src/ui/hooks/use-toast.test.ts src/ai/utils/sentence-buffer.test.ts` | ❌ W0 | ⬜ pending |
| 22-02-01 | 02 | 2 | UXA-01, UXA-03 | T-22-02-01 / T-22-02-03 | Atmosphere events clean up subscriptions and timers | unit | `bun test src/ui/providers/atmosphere-provider.test.ts` | ❌ W0 | ⬜ pending |
| 22-02-02 | 02 | 2 | UXA-01, UXA-03 | T-22-02-02 / T-22-02-04 | Toast/display hooks expose safe UI state and fail fast outside provider | unit + integration | `bun test src/ui/providers/atmosphere-provider.test.ts src/ui/screens/game-screen.test.ts` | ❌ W0 | ⬜ pending |
| 22-03-01 | 03 | 2 | UXA-01, UXA-03 | T-22-03-01 / T-22-03-03 | NarrativeProvider owns stream state and skip/reset seams | unit | `bun test src/ui/providers/narrative-provider.test.ts` | ❌ W0 | ⬜ pending |
| 22-03-02 | 03 | 2 | UXA-01, UXA-03 | T-22-03-02 / T-22-03-04 | AI prose remains narrative-only; provider hooks fail fast outside context | unit + integration | `bun test src/ui/providers/narrative-provider.test.ts src/ui/screens/game-screen.test.ts src/ui/hooks/use-streaming-text.test.ts` | ❌ W0 | ⬜ pending |
| 22-04-01 | 04 | 3 | UXA-02, UXA-03 | T-22-04-01 / T-22-04-03 | Renderer uses bounded visible history and recovery copy | component/unit | `bun test src/ui/panels/scene-panel.test.ts` | ❌ W0 | ⬜ pending |
| 22-04-02 | 04 | 3 | UXA-02, UXA-03 | T-22-04-02 / T-22-04-04 | Dialogue free text remains callback-only; glyph fallback preserves terminal layout | component + integration | `bun test src/ui/panels/scene-panel.test.ts src/ui/screens/game-screen.test.ts` | ❌ W0 | ⬜ pending |
| 22-05-01 | 05 | 4 | UXA-01, UXA-04 | T-22-05-01 / T-22-05-04 | Exactly one state-level handler is active; global layer consumes first | unit | `bun test src/ui/providers/input-provider.test.ts src/ui/hooks/use-game-input.test.ts` | ❌ W0 | ⬜ pending |
| 22-05-02 | 05 | 4 | UXA-01, UXA-03, UXA-04 | T-22-05-02 / T-22-05-03 | InputProvider dispatches deterministic systems first; AI cannot decide outcomes | unit | `bun test src/ui/providers/input-provider.test.ts src/engine/game-screen-controller.test.ts` | ❌ W0 | ⬜ pending |
| 22-05-03 | 05 | 4 | UXA-01, UXA-03, UXA-04 | T-22-05-01 / T-22-05-05 | GameScreen is thin; branch switch remains confirmed before destructive action | integration + static | `bun test src/ui/providers/input-provider.test.ts src/ui/providers/atmosphere-provider.test.ts src/ui/providers/narrative-provider.test.ts src/ui/panels/scene-panel.test.ts src/ui/screens/game-screen.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/time/clock.ts`, `src/time/manual-clock.ts`, `src/time/clock.test.ts` — deterministic timer seam for UXA-05.
- [ ] `src/ui/providers/atmosphere-provider.tsx`, `src/ui/providers/atmosphere-provider.test.ts` — isolated AtmosphereProvider coverage for UXA-01/D-02.
- [ ] `src/ui/providers/narrative-provider.tsx`, `src/ui/providers/narrative-provider.test.ts` — isolated NarrativeProvider coverage for UXA-01/D-01/D-03.
- [ ] `src/ui/providers/input-provider.tsx`, `src/ui/providers/input-provider.test.ts` — isolated InputProvider/state-machine coverage for UXA-01/UXA-04/D-04/D-08..D-10.
- [ ] `src/ui/panels/scene-panel.test.ts` — NarrativeRenderer in-place rewrite coverage for UXA-02.
- [ ] Updated `src/ui/screens/game-screen.test.ts` — GameScreen under-100-line and no-domain-ownership checks for UXA-03.

---

## Manual-Only Verifications

All phase behaviors have automated verification. Optional human terminal smoke testing may be useful after execution, but it is not required for Nyquist coverage.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] Feedback latency bounded to one plan.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-05-08
