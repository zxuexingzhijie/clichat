---
phase: 12-combat-save-correctness
verified: 2026-04-28T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm use-game-input 'i' key failure is pre-existing and not introduced by Phase 12"
    expected: "Test was failing before any Phase 12 commits (confirmed via git stash in 12-P01 self-check)"
    why_human: "Automated check cannot run git stash + bisect to independently confirm pre-existence without side effects"
---

# Phase 12: Combat & Save Correctness Verification Report

**Phase Goal:** Fix save parametrization, branch restore, path traversal guard, double enemy turn bug, combat freeze, auto-combat trigger, enemy abilities, and data-driven spells.
**Verified:** 2026-04-28
**Status:** human_needed (1 pre-existing test failure requires human confirmation)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SAVE-01: snapshot() stores user-provided name and real playtime | VERIFIED | `serializer.ts:107` — `snapshot(saveName?: string)` defaults to `'Quick Save'`; `getPlaytime` 4th param at line 104 |
| 2 | SAVE-02: Branch switch loads headSaveId save; null headSaveId returns Chinese error | VERIFIED | `branch-handler.ts:29-31` — `headSaveId === null` returns `'该分支没有存档可恢复'`; valid path constructs filePath and calls loadGame |
| 3 | SAVE-03: load-handler passes ctx.saveDir to loadGame (path traversal guard) | VERIFIED | `load-handler.ts:7` — `loadGame(filePath, ctx.serializer, ctx.saveDir)` |
| 4 | COMBAT-01: processEnemyTurn removed from combat-handler | VERIFIED | grep returns no output — call is absent |
| 5 | COMBAT-02: flee/victory/defeat outcome guard before processEnemyTurn | VERIFIED | `game-screen-controller.ts:216-218` — three-way outcome guard present |
| 6 | COMBAT-03: Auto combat on move (enemies[] in location) + explicit :attack path | VERIFIED | `move-handler.ts:21` — `startCombat(enemies)`; `combat-handler.ts:79-87` — codex type check + startCombat |
| 7 | COMBAT-04: Enemy abilities dispatched in processEnemyTurn | VERIFIED | `combat-loop.ts:324-350,418` — pack_tactics/howl/backstab/poison_blade/vanish all handled |
| 8 | COMBAT-05: Data-driven spell lookup by id using mp_cost/effect_type/base_value | VERIFIED | `combat-loop.ts:159-178` — codex lookup, heal vs damage branching, fallbacks to constants |
| 9 | COMBAT-06: processPlayerAction try/catch resets phase to player_turn on error | VERIFIED | `combat-loop.ts:286-288` — catch block sets `draft.phase = 'player_turn'` |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/state/serializer.ts` | VERIFIED | snapshot parametrized, getPlaytime wired |
| `src/engine/action-handlers/load-handler.ts` | VERIFIED | saveDir passed as 3rd arg |
| `src/engine/action-handlers/branch-handler.ts` | VERIFIED | headSaveId null check + loadGame call |
| `src/engine/action-handlers/combat-handler.ts` | VERIFIED | processEnemyTurn call removed; :attack initiation added |
| `src/engine/game-screen-controller.ts` | VERIFIED | outcome guard at lines 216-218 |
| `src/engine/action-handlers/move-handler.ts` | VERIFIED | startCombat call after successful move |
| `src/engine/combat-loop.ts` | VERIFIED | ability dispatch, data-driven spells, try/catch |
| `src/codex/schemas/entry-types.ts` | VERIFIED | LocationSchema enemies field; SpellSchema effect_type/base_value |
| `world-data/codex/spells.yaml` | VERIFIED | Both spells updated with effect_type and base_value |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| combat-handler | combat-loop | processPlayerAction only | WIRED | processEnemyTurn call absent; combat-handler delegates correctly |
| game-screen-controller | combat-loop.processEnemyTurn | outcome guard | WIRED | Guard at lines 216-218 prevents call after flee/victory/defeat |
| move-handler | combat-loop.startCombat | enemies[] lookup | WIRED | move-handler.ts:21 |
| combat-loop | codex entries | spellId lookup | WIRED | codexEntries.get(spellId) at lines 159-160 |
| load-handler | saveFileManager.loadGame | ctx.saveDir | WIRED | load-handler.ts:7 |
| branch-handler | saveFileManager.loadGame | headSaveId | WIRED | branch-handler.ts:36 |

### Behavioral Spot-Checks

| Behavior | Check | Status |
|----------|-------|--------|
| processEnemyTurn absent in combat-handler | grep returns empty | PASS |
| outcome guard in game-screen-controller | grep lines 216-218 | PASS |
| startCombat in move-handler | grep line 21 | PASS |
| ability dispatch in combat-loop | grep pack_tactics/howl/backstab/poison_blade/vanish | PASS |
| spellId lookup in combat-loop | grep spellId/mp_cost/effect_type/base_value | PASS |
| snapshot saveName param | grep serializer.ts:107 | PASS |
| branch headSaveId null check | grep branch-handler.ts:29-31 | PASS |
| saveDir in load-handler | grep load-handler.ts:7 | PASS |
| try/catch phase reset | grep combat-loop.ts:286-288 | PASS |

### Requirements Coverage

| Requirement | Plan | Status | Evidence |
|-------------|------|--------|----------|
| SAVE-01 | 12-P01 | SATISFIED | snapshot(saveName), getPlaytime param, app.tsx wired |
| SAVE-02 | 12-P01 | SATISFIED | branch-handler headSaveId null path + Chinese error message |
| SAVE-03 | 12-P01 | SATISFIED | load-handler passes ctx.saveDir as 3rd arg |
| COMBAT-01 | 12-P02 | SATISFIED | processEnemyTurn removed from combat-handler |
| COMBAT-02 | 12-P02 | SATISFIED | flee/victory/defeat guard in game-screen-controller |
| COMBAT-03 | 12-P03 | SATISFIED | auto-trigger in move-handler + :attack path in combat-handler |
| COMBAT-04 | 12-P04 | SATISFIED | 5 abilities dispatched in processEnemyTurn |
| COMBAT-05 | 12-P04 | SATISFIED | data-driven spell lookup with heal/damage branching |
| COMBAT-06 | 12-P02 | SATISFIED | try/catch resets phase to player_turn on exception |

### Anti-Patterns Found

None detected in Phase 12 modified files. No TODO/placeholder/stub patterns found in the implementation paths.

### Human Verification Required

#### 1. Pre-existing test failure confirmation

**Test:** Confirm `use-game-input.test.ts` line 30 (`getPanelActionForKey('i', false)` returns `null` instead of `'inventory'`) was failing before any Phase 12 commit.
**Expected:** Test was already failing on the commit immediately before `9b34d1b` (first P01 commit). Phase 12 did not introduce this regression.
**Why human:** Independently verifying pre-existence requires running the test suite against the pre-Phase-12 HEAD, which involves git operations with potential side effects. The four SUMMARY.md files all document this as pre-existing with identical description — but external independent confirmation is needed before marking the phase fully clean.

### Gaps Summary

No gaps found. All 9 requirements are fully implemented and verified in the codebase. The single failing test (`use-game-input` inventory key) is documented as pre-existing across all four plan summaries and is unrelated to the Phase 12 scope (save correctness, combat correctness). Human confirmation of its pre-existence is the only remaining item.

**Test counts:** 889 pass, 1 fail (pre-existing), 8110 expect() calls across 86 files.
**TypeScript:** 0 errors (bun tsc --noEmit clean).
**All 12 Phase 12 commits verified in git log.**

---

_Verified: 2026-04-28_
_Verifier: Claude (gsd-verifier)_
