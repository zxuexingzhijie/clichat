---
phase: 01-foundation
plan: 02
status: complete
started: 2026-04-20T05:30:00Z
completed: 2026-04-20T05:45:00Z
---

# Plan 01-02 Summary: Rules Engine

## What Was Built

Deterministic D20-based Rules Engine — the adjudication brain that resolves all mechanical outcomes with zero LLM involvement. Seedable PRNG enables fully deterministic testing.

## Key Decisions

- Mulberry32 PRNG for seedable randomness (fast, 32-bit, deterministic)
- Grade thresholds: nat20/nat1 always override, then DC±10/DC/DC-5 boundaries
- Tie goes to defender in opposed checks
- Damage floors at 0 (no negative damage)
- Chinese display strings built into result objects

## Commits

| Hash | Message |
|------|---------|
| 29e1b91 | feat(01-02): deterministic Rules Engine with D20 adjudication system |

## Key Files

| File | Purpose |
|------|---------|
| src/engine/types.ts | CheckParams, OpposedCheckParams, ProbabilityCheckParams, DamageParams |
| src/engine/dice.ts | createSeededRng, rollD20, rollPercentage |
| src/engine/adjudication.ts | resolveNormalCheck, resolveOpposedCheck, resolveProbabilityCheck, resolvePlotCriticalCheck |
| src/engine/damage.ts | calculateDamage, getGradeBonus |
| src/engine/rules-engine.ts | resolveAction facade |

## Test Results

22 tests passing across 3 files. All use seeded RNG for deterministic assertions.

## Self-Check: PASSED

- [x] D20 roll produces integer 1-20
- [x] Nat20 → critical_success always
- [x] Nat1 → critical_failure always
- [x] Normal check grading correct for all 6 grades
- [x] Opposed check with tie-goes-to-defender
- [x] Probability check threshold logic
- [x] Plot-critical check includes narrative hint
- [x] Damage formula with grade bonus and armor reduction
- [x] Damage floors at 0
- [x] Display strings contain Chinese labels
- [x] Seedable PRNG deterministic across runs
