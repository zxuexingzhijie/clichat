---
phase: 09-animation-system
plan: 04
subsystem: ui-animation
tags: [flash, hp, combat, status-bar, check-result, events]
dependency_graph:
  requires: [09-01]
  provides: [hp-flash-feedback, check-result-flash, enemy-events, item-acquired-event]
  affects: [status-bar, combat-status-bar, check-result-line, event-types]
tech_stack:
  added: []
  patterns: [useEventFlash-subscription, useTimedEffect-mount-trigger, inverse-flash-nat20]
key_files:
  created: []
  modified:
    - src/events/event-types.ts
    - src/ui/panels/status-bar.tsx
    - src/ui/panels/combat-status-bar.tsx
    - src/ui/panels/check-result-line.tsx
decisions:
  - "Flash scope limited to HP value text only, not entire status bar row (D-11)"
  - "Nat20/Nat1 use inverse={isFlashing} since they are already bold+colored"
  - "Normal grades use bold={gradeBold || isFlashing} for temporal emphasis"
metrics:
  duration: 2min
  completed: "2026-04-25T14:01:54Z"
  tasks: 2
  files: 4
---

# Phase 9 Plan 4: HP Flash and Check Result Flash Summary

HP flash on damage/heal events in StatusBar and CombatStatusBar via useEventFlash(300ms), plus mount-triggered bold flash on CheckResultLine grade text. Added enemy_damaged, enemy_healed, item_acquired to DomainEvents.

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add new events and flash effects to StatusBar and CombatStatusBar | 6a0663f | event-types.ts, status-bar.tsx, combat-status-bar.tsx |
| 2 | Add bold flash to CheckResultLine on mount | bbfd072 | check-result-line.tsx |

## Implementation Details

### Task 1: StatusBar and CombatStatusBar HP Flash

- Added three new events to `DomainEvents`: `enemy_damaged`, `enemy_healed` (both with `amount`, `source`, `enemyIndex`), and `item_acquired` (with `itemId`, `itemName`, `quantity`)
- StatusBar: `useEventFlash('player_damaged', 300)` and `useEventFlash('player_healed', 300)` produce `flashColor` (red/green) and `flashBold` overrides applied only to the HP Text element
- CombatStatusBar: Four flash hooks (player damage/heal, enemy damage/heal) with separate `playerFlashColor`/`playerFlashBold` and `enemyFlashColor`/`enemyFlashBold` variables
- Flash scope is HP value text only -- MP, Gold, Location, Quest, enemy name, round number, turn indicator are all unaffected

### Task 2: CheckResultLine Mount Flash

- `useTimedEffect(300)` with `triggerFlash()` called in `useEffect([], [])` fires once on mount
- Normal results: grade label gets `bold={gradeBold || isFlashing}` -- adds bold for 300ms even on non-critical results
- Nat20: `<Text color="green" bold inverse={isFlashing}>` -- inverse flash for 300ms on critical success
- Nat1: `<Text color="red" bold inverse={isFlashing}>` -- inverse flash for 300ms on critical failure

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None.

## Verification

- All 3 modified UI files compile via `bun build --no-bundle`
- `item_acquired` event confirmed in event-types.ts
- 735 tests pass, 0 failures
