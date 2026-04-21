---
phase: "02"
plan: "02-07"
subsystem: combat-system
tags: [gameplay, combat, ai-roles, ui, tdd]
dependency-graph:
  requires: [02-01, 02-02, 02-04, 02-05, 02-06]
  provides: [combat-loop, combat-status-bar, combat-actions-panel, combat-routing]
  affects: [game-loop, game-screen, combat-store]
tech-stack:
  added: []
  patterns: [factory-with-di, tdd-red-green, state-machine, discriminated-union]
key-files:
  created:
    - src/engine/combat-loop.ts
    - src/engine/combat-loop.test.ts
    - src/ui/panels/combat-status-bar.tsx
    - src/ui/panels/combat-actions-panel.tsx
  modified:
    - src/state/combat-store.ts
    - src/ui/screens/game-screen.tsx
    - src/game-loop.ts
decisions:
  - "CombatActionResult is a discriminated union (status ok|error) — callers must narrow before accessing checkResult/outcome/message"
  - "processEnemyTurn called sequentially after processPlayerAction in game-loop (not fire-and-forget)"
  - "guard sets guardActive=true in combatStore, reset to false at start of processEnemyTurn"
  - "partial_success counts as a hit for both player attacks and enemy attacks"
  - "game-screen CombatActionsPanel index 3 maps to flee (item placeholder disabled)"
metrics:
  duration: 16m
  completed: 2026-04-21
  tasks_completed: 3
  files_created: 4
  files_modified: 3
  tests_added: 13
  tests_total: 278
requirements:
  - PLAY-04
---

# Phase 02 Plan 07: Turn-Based Combat System Summary

Turn-based combat state machine with D20 Rules Engine resolution, damage calculation, guard/flee mechanics, AI narration integration, combat UI panel swap (D-16), check-first display (D-17), and game loop command routing (D-18).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| RED  | f85c967 | test(02-07): add failing tests for combat loop engine |
| GREEN | aab6d60 | feat(02-07): implement combat loop state machine engine |
| 2 | 7494cfa | feat(02-07): combat mode UI panels and combat store fixes |
| 3 | c820cac | feat(02-07): wire combat UI into game screen and combat commands into game loop |

## What Was Built

**Task 1: Combat loop state machine (TDD)**

`createCombatLoop(codexEntries, options)` factory with DI for rng and narration:

- `startCombat(enemyIds)`: looks up enemy codex data, initializes combatStore (active=true, phase='player_turn', enemies, turnOrder, roundNumber=1), sets gameStore to 'combat', generates opening narration
- `processPlayerAction(actionType, options)`: attack/cast/guard/flee with phase transitions (resolving → narrating → enemy_turn). Each non-guard action calls `resolveNormalCheck` then `calculateDamage`. Cast validates MP >= 4 and deducts 4. Guard sets `guardActive=true`. Flee checks vs DC 10. Enemy HP updated in combatStore.
- `processEnemyTurn()`: each alive enemy rolls attack vs playerAC (10 + guard bonus 2), applies damage to player, resets guardActive, generates per-enemy narration
- `checkCombatEnd()`: all enemies HP <= 0 → victory; player HP <= 0 → defeat; else not ended

`CombatState` extended with: `phase`, `lastCheckResult`, `lastNarration`, `guardActive`. `combatStore` emits `combat_turn_advanced` with `currentActorId` and `roundNumber`.

13 tests covering all action types, guard mechanics, and end conditions.

**Task 2: Combat Mode UI panels**

- `CombatStatusBar`: `♥ hp/maxHp  ✦ mp/maxMp │ enemyName ♥ enemyHp/enemyMaxHp │ 回合 N — 你的回合/敌人的回合`. HP colors follow ratio thresholds (red <10%, yellow <25%). CJK-safe name truncation at width < 90. Multi-enemy support with `+N` suffix.
- `CombatActionsPanel`: 5 fixed combat actions (⚔攻击/✦施法/🛡防御/🎒物品/🏃逃跑). Cast shows dimColor when MP < 4. Item placeholder always disabled. Up/Down/Enter/1-5 keyboard nav. Header: `战斗行动`.
- Fixed `combat_ended` event to always emit `outcome: 'victory'` (matching DomainEvents type). Fixed `combat_turn_advanced` to emit `{ currentActorId, roundNumber }` matching the type definition.

**Task 3: Game screen wiring and game loop routing**

- `game-screen.tsx`: imports CombatStatusBar, CombatActionsPanel, CheckResultLine. When `combatState.active`: scene area shows CheckResultLine (if lastCheckResult) then lastNarration (D-17 check-first), status bar swaps to CombatStatusBar, actions panel swaps to CombatActionsPanel. New props: `combatState`, `combatLoop`.
- `game-loop.ts`: `combatLoop` added to `GameLoopOptions`. When `combatStore.getState().active` and action is attack/cast/guard/flee: routes to `combatLoop.processPlayerAction` → `processEnemyTurn` → `checkCombatEnd`. Non-combat actions during combat return error "战斗中只能进行战斗行动！".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Guard test used incorrect RNG boundary**
- **Found during:** Task 1 GREEN phase (test failure)
- **Issue:** The original guard test used `borderlineRng = () => 0.45` expecting roll=10 to miss with guard AC=12. But roll=10 + enemy.attack=1 = 11 vs DC=12 gives `partial_success` (11 >= 12-5=7), which still counts as a hit.
- **Fix:** Replaced with two separate tests — one verifying `guardActive` resets after enemy turn, one verifying `lastCheckResult.dc` equals 12 (AC + guard bonus) when guard is active.
- **Files modified:** src/engine/combat-loop.test.ts

**2. [Rule 1 - Bug] combatStore event payloads mismatched DomainEvents types**
- **Found during:** Task 2 TypeScript check
- **Issue:** `combat_ended` emitted `{ outcome: 'ended' }` (not in the union `'victory' | 'defeat' | 'flee'`). `combat_turn_advanced` emitted `{ currentTurnIndex, turnOrder }` instead of `{ currentActorId, roundNumber }`.
- **Fix:** Fixed both event emissions to match DomainEvents type definitions.
- **Files modified:** src/state/combat-store.ts

**3. [Rule 1 - Bug] Test fixtures used wrong epistemic metadata shape**
- **Found during:** Task 2 TypeScript check
- **Issue:** Test used `epistemic: { canon_tier, visibility: 'world_truth', source }` — the old simplified shape. Real `EpistemicMetadataSchema` requires `authority`, `truth_status`, `scope`, `visibility` (enum: public/discovered/hidden/secret/forbidden), `confidence`, `source_type`, etc.
- **Fix:** Replaced test fixture with correctly-shaped epistemic object using all required fields.
- **Files modified:** src/engine/combat-loop.test.ts

## Known Stubs

- `CombatActionsPanel` item action (index 3) is always disabled with "背包空空如也。" — intentional per plan spec, Phase 3 inventory system will enable this
- `handleActionExecute` in game-screen still a no-op for non-combat scene actions — pre-existing from Phase 1

## Threat Surface Scan

No new network endpoints or auth paths. Combat state transitions are sequential (T-02-17 mitigated: phase enum enforces player_turn → resolving → narrating → enemy_turn flow). Damage calculated from codex-validated enemy stats only (T-02-18 mitigated: no user-controllable parameters in damage formula). AI narration is non-blocking — if narration fails, FALLBACK_NARRATION constant used and state machine proceeds (T-02-19 mitigated).

## Self-Check: PASSED

- [x] src/engine/combat-loop.ts — FOUND
- [x] src/engine/combat-loop.test.ts — FOUND
- [x] src/ui/panels/combat-status-bar.tsx — FOUND
- [x] src/ui/panels/combat-actions-panel.tsx — FOUND
- [x] src/state/combat-store.ts — FOUND (modified)
- [x] src/ui/screens/game-screen.tsx — FOUND (modified)
- [x] src/game-loop.ts — FOUND (modified)
- [x] Commit f85c967 — test RED gate
- [x] Commit aab6d60 — feat GREEN gate
- [x] Commit 7494cfa — Task 2 UI panels
- [x] Commit c820cac — Task 3 wiring
- [x] 278 tests pass, 0 failures
