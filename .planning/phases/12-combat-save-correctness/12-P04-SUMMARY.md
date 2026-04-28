# 12-P04 Execution Summary

**Status:** Complete
**Requirements:** COMBAT-04, COMBAT-05
**Duration:** ~25 minutes
**Completed:** 2026-04-28

## One-liner

Enemy ability dispatch (pack_tactics/howl/backstab/poison_blade/vanish) and data-driven spells reading mp_cost/effect_type/base_value from codex.

## Files Modified

- `src/codex/schemas/entry-types.ts` — SpellSchema: added effect_type and base_value optional fields
- `world-data/codex/spells.yaml` — both spells: added explicit effect_type and base_value
- `src/state/combat-store.ts` — CombatState: added howlActive boolean field
- `src/state/player-store.ts` — PlayerState: added poisonStacks number field (default 0)
- `src/engine/combat-loop.ts` — processEnemyTurn: ability dispatch; processPlayerAction: data-driven cast; import Spell type; CombatActionOptions: spellId
- `src/engine/action-handlers/combat-handler.ts` — passes spellId from action.target on cast actions
- `src/engine/character-creation.ts` — buildCharacter: poisonStacks: 0 in returned state
- `src/engine/branch-diff.test.ts` — inline player fixtures: added poisonStacks: 0
- `src/codex/schemas/entry-types.test.ts` — added SpellSchema effect_type/base_value tests
- `src/engine/combat-loop.test.ts` — added enemy abilities tests and data-driven spell tests

## Tests

**890 total, 889 pass, 1 fail (pre-existing)**

The 1 failure (`use-game-input.test.ts: returns inventory for i when not typing`) is pre-existing and unrelated to this plan — confirmed by running the test against the prior commit.

## Commits

- `b602c57` — feat(12-P04): extend SpellSchema with effect_type and base_value; update spells.yaml
- `adfe2b7` — feat(12-P04): implement enemy abilities in processEnemyTurn (COMBAT-04)
- `dd9f9fc` — feat(12-P04): data-driven spell casting in processPlayerAction (COMBAT-05)

## Key Changes

- **COMBAT-04 — Enemy abilities:**
  - `pack_tactics`: +2 attackMod when 2+ enemies alive (snapshot at turn start)
  - `howl`: sets `howlActive=true` on combat state; reduces playerAC by 2 on next enemy turn
  - `backstab`: round 1 forces `critical_success` grade (synthetic CheckResult with display field)
  - `poison_blade`: on hit, increments `player.poisonStacks`; DoT (poisonStacks HP) applied at start of each subsequent enemy turn
  - `vanish`: enemy hp set to 0, skips attack via `continue`
  - Unknown abilities: silently skipped via `default: break`

- **COMBAT-05 — Data-driven spells:**
  - `CombatActionOptions.spellId?: string` added
  - `combat-handler` passes `action.target` as `spellId` when casting
  - Cast block: looks up spell from `codexEntries.get(spellId)`
  - Heal path (`effect_type === 'heal'`): restores `spell.base_value` HP, deducts `spell.mp_cost`, returns early before damage roll
  - Damage path: uses `spell.base_value` as `weaponBase` (fallback: `CAST_WEAPON_BASE`)
  - MP check uses `spell.mp_cost` (fallback: `CAST_MP_COST` constant)
  - Unknown spellId: `'未知法术。'` error, no turn consumed
  - Insufficient MP: `'魔力不足！无法施法。'` error, no turn consumed
  - Spell name in narration: `施放${spell.name}` when spellId resolves

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test assertion for pack_tactics used wrong setup**
- **Found during:** Task 2 RED→GREEN
- **Issue:** Test used wolf1 (pack_tactics) + wolf2 (no abilities); wolf2 processed last so `lastCheckResult.attributeModifier` showed wolf2's modifier (1), not wolf1's (3)
- **Fix:** Changed wolf2 to also have pack_tactics so both enemies show attributeModifier=3 in lastCheckResult
- **Files modified:** `src/engine/combat-loop.test.ts`

**2. [Rule 1 - Bug] Test assertion for howl used wrong expected value**
- **Found during:** Task 2 GREEN
- **Issue:** Test expected `howlActive === false` after enemy turn, but howl sets the flag for the *next* turn's use — it should be `true` immediately after the enemy turn that used it
- **Fix:** Changed expectation to `toBe(true)`
- **Files modified:** `src/engine/combat-loop.test.ts`

**3. [Rule 2 - Missing field] poisonStacks required in PlayerState broke existing code**
- **Found during:** Task 2 tsc check
- **Issue:** `z.number().default(0)` makes field required in inferred TypeScript type; two files constructed PlayerState objects without it
- **Fix:** Added `poisonStacks: 0` to `character-creation.ts` return object and two player fixtures in `branch-diff.test.ts`
- **Files modified:** `src/engine/character-creation.ts`, `src/engine/branch-diff.test.ts`

## Deferred Issues

- `use-game-input.test.ts`: `getPanelActionForKey('i', false)` returns `null` instead of `'inventory'` — pre-existing failure, out of scope for P04.

## Self-Check

**PASSED** — All files and commits verified present.
