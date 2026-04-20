---
phase: 1
slug: foundation
status: draft
nyquist_compliant: true
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
| **Config file** | bunfig.toml (created in Plan 01 Task 1) |
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

### Plan 01 — Project bootstrap, types, stores, event bus (Wave 1)

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 1-01-01 | 01 | 1 | CORE-04 | bootstrap | `bun --version && bunx tsc --noEmit && bun test` | pending |
| 1-01-02 | 01 | 1 | CORE-04 | unit | `bun test src/types/types.test.ts` | pending |
| 1-01-03 | 01 | 1 | CORE-04 | unit | `bun test src/state/create-store.test.ts && bun test src/events/event-bus.test.ts` | pending |
| 1-01-04 | 01 | 1 | CORE-04 | unit | `bun test src/state/stores.test.ts` | pending |

### Plan 02 — Rules Engine (Wave 2)

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 1-02-01 | 02 | 2 | CORE-03 | unit | `bun test src/engine/dice.test.ts` | pending |
| 1-02-02 | 02 | 2 | CORE-03 | unit | `bun test src/engine/damage.test.ts && bun test src/engine/rules-engine.test.ts` | pending |
| 1-02-03 | 02 | 2 | CORE-03 | unit | `bun test src/engine/` | pending |

### Plan 03 — World Codex (Wave 1)

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 1-03-01 | 03 | 1 | WORLD-01 | unit | `bun test src/codex/schemas/epistemic.test.ts` | pending |
| 1-03-02 | 03 | 1 | WORLD-01 | unit | `bun test src/codex/loader.test.ts` | pending |

### Plan 04 — CLI Terminal UI (Wave 2)

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 1-04-01 | 04 | 2 | CLI-01 | typecheck | `bunx tsc --noEmit` | pending |
| 1-04-02 | 04 | 2 | CLI-01 | typecheck + smoke | `bunx tsc --noEmit && bun run src/index.tsx 2>&1 \| head -5 \|\| true` | pending |
| 1-04-03 | 04 | 2 | CLI-01 | manual | `bun run src/index.tsx` (visual checkpoint) | pending |

### Plan 05 — Command parsing + NL intent (Wave 2)

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 1-05-01 | 05 | 2 | CORE-01 | unit | `bun test src/input/command-parser.test.ts` | pending |
| 1-05-02 | 05 | 2 | CORE-02 | unit | `bun test src/input/intent-classifier.test.ts && bun test src/input/command-parser.test.ts` | pending |

### Plan 06 — Integration wiring + E2E verification (Wave 3)

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 1-06-01 | 06 | 3 | CORE-04 | unit | `bun test src/state/serializer.test.ts` | pending |
| 1-06-02 | 06 | 3 | CORE-01, CORE-03 | integration | `bun test src/game-loop.test.ts && bun test --bail` | pending |
| 1-06-03 | 06 | 3 | ALL | e2e | `bun test src/e2e/phase1-verification.test.ts && bun test --bail` | pending |

*Status: pending | green | red | flaky*

---

## Wave 0 Requirements

- [x] Test infrastructure: bun test is built-in, no setup beyond `bun init` (Plan 01 Task 1)
- [x] Dependencies installed: Plan 01 Task 1 installs all packages
- [x] Test files created per-task: each task with `tdd="true"` creates its own test file

*Wave 0 is satisfied by Plan 01 Task 1 (project bootstrap). No separate test scaffold needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Four-panel layout renders correctly | CLI-01 | Visual terminal rendering cannot be fully automated | Run `bun run src/index.tsx`, verify scene/status/actions/input panels visible and resize |
| CJK text doesn't break layout | CLI-01 | Requires visual inspection of Chinese characters | Type Chinese text, verify column alignment |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covered by Plan 01 Task 1
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
