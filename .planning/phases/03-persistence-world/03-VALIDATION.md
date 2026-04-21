---
phase: 3
slug: persistence-world
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun test (built-in, Jest-compatible) |
| **Config file** | none — bun discovers `*.test.ts` automatically |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~400ms |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~400 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | SAVE-01 | — | N/A | unit | `bun test src/state/serializer.test.ts` | ✅ (update) | ⬜ pending |
| 3-01-02 | 01 | 0 | SAVE-01 | — | N/A | unit | `bun test src/persistence/save-migrator.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 0 | SAVE-01 | — | N/A | unit | `bun test src/persistence/save-file-manager.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-04 | 01 | 0 | WORLD-02 | — | N/A | unit | `bun test src/state/npc-memory-store.test.ts` | ✅ (update) | ⬜ pending |
| 3-01-05 | 01 | 0 | WORLD-02 | — | N/A | unit | `bun test src/persistence/memory-persistence.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-06 | 01 | 0 | WORLD-03 | — | N/A | unit | `bun test src/state/quest-store.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-07 | 01 | 0 | WORLD-04 | — | N/A | unit | `bun test src/state/relation-store.test.ts` | ❌ W0 | ⬜ pending |
| 3-xx-01 | TBD | 1+ | SAVE-01 | — | N/A | unit | `bun test src/persistence/save-file-manager.test.ts` | ❌ W0 | ⬜ pending |
| 3-xx-02 | TBD | 1+ | WORLD-02 | — | N/A | unit | `bun test src/persistence/memory-persistence.test.ts` | ❌ W0 | ⬜ pending |
| 3-xx-03 | TBD | 1+ | WORLD-03 | — | N/A | unit | `bun test src/engine/quest-system.test.ts` | ❌ W0 | ⬜ pending |
| 3-xx-04 | TBD | 1+ | WORLD-03 | — | N/A | unit | `bun test src/ui/panels/journal-panel.test.tsx` | ❌ W0 | ⬜ pending |
| 3-xx-05 | TBD | 1+ | WORLD-04 | — | N/A | unit | `bun test src/engine/reputation-system.test.ts` | ❌ W0 | ⬜ pending |
| 3-xx-06 | TBD | 1+ | CONT-01 | — | N/A | integration | `bun test src/codex/loader.test.ts` | ✅ (extend) | ⬜ pending |
| 3-xx-07 | TBD | 1+ | CONT-03 | — | N/A | integration | `bun test src/codex/loader.test.ts` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/persistence/save-file-manager.test.ts` — stubs for SAVE-01 file operations (mock Bun.write)
- [ ] `src/persistence/save-migrator.test.ts` — stubs for SAVE-01 v1→v2 migration
- [ ] `src/persistence/memory-persistence.test.ts` — stubs for WORLD-02 disk persistence
- [ ] `src/state/quest-store.test.ts` — stubs for WORLD-03 quest accept/progress/complete
- [ ] `src/engine/quest-system.test.ts` — stubs for WORLD-03 reputation gate
- [ ] `src/state/relation-store.test.ts` — stubs for WORLD-04 reputation tracking
- [ ] `src/engine/reputation-system.test.ts` — stubs for WORLD-04 attitude thresholds
- [ ] `src/ui/panels/journal-panel.test.tsx` — stubs for WORLD-03 Journal display
- [ ] Update `src/state/serializer.test.ts` — extend for v2 schema and new stores
- [ ] Update `src/state/new-stores.test.ts` — update NpcMemoryStore for three-layer schema
- [ ] Update `src/engine/dialogue-manager.test.ts` — add reputation gate tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Save file appears in correct OS-specific directory | SAVE-01 | Platform path detection varies | Run game, `:save test`, verify file at `~/Library/Application Support/Chronicle/saves/test_*.json` (macOS) |
| NPC references past interaction in dialogue | WORLD-02 | AI-generated output, non-deterministic | Talk to NPC, end dialogue, talk again — verify memory reference in response |
| Full region is playable (8-10 locations navigable) | CONT-01 | Content quality/completeness | Walk all locations, verify no broken exits or missing descriptions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 400ms
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
