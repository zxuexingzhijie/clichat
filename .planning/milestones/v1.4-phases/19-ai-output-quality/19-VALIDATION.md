---
phase: 19
slug: ai-output-quality
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun:test (built-in) |
| **Config file** | package.json `"test": "bun test"` |
| **Quick run command** | `bun test src/ai/roles/narrative-director.test.ts src/input/intent-classifier.test.ts src/ai/summarizer/summarizer-worker.test.ts` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command above
- **After every plan wave:** Run `bun test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-T1 | 01 | 1 | AI-05 | NarrationOutputSchema rejects text >300 chars (Zod) | unit | `bun test src/ai/roles/narrative-director.test.ts` | ✅ (needs update) | ⬜ pending |
| 19-01-T2 | 01 | 1 | AI-05 | generateNarration returns fallback on schema failure | unit | `bun test src/ai/roles/narrative-director.test.ts` | ✅ (needs update) | ⬜ pending |
| 19-02-T1 | 02 | 1 | AI-06 | classifyIntent routes through callGenerateObject | unit | `bun test src/input/intent-classifier.test.ts` | ✅ (needs update) | ⬜ pending |
| 19-02-T2 | 02 | 1 | AI-06 | recordUsage called with role='retrieval-planner' | unit | `bun test src/input/intent-classifier.test.ts` | ❌ W0 new | ⬜ pending |
| 19-03-T1 | 03 | 2 | AI-07 | runSummarizerLoop exits cleanly when signal.aborted=true | unit | `bun test src/ai/summarizer/summarizer-worker.test.ts` | ❌ W0 new | ⬜ pending |
| 19-03-T2 | 03 | 2 | AI-07 | no unhandled promise rejection on abort mid-sleep | unit | `bun test src/ai/summarizer/summarizer-worker.test.ts` | ❌ W0 new | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/input/intent-classifier.test.ts` — add test: `recordUsage` called with `'retrieval-planner'` (AI-06 cost tracking)
- [ ] `src/ai/summarizer/summarizer-worker.test.ts` — add test: `runSummarizerLoop(signal)` exits without rejection when `signal.aborted = true` before first iteration
- [ ] `src/ai/summarizer/summarizer-worker.test.ts` — add test: loop exits mid-wait when signal aborts after `setTimeout` starts

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `:cost` shows retrieval-planner bucket after NL input | AI-06 | Requires live API session | Run game, enter NL input, run `:cost`, confirm retrieval-planner row present |
| Ctrl-C exits cleanly with log line during summarizer loop | AI-07 | Requires live process signal | Start game, trigger summarizer (10+ NPC interactions), send Ctrl-C, confirm `[summarizer] received abort signal` in output |
