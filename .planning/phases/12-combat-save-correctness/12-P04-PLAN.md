---
phase: 12-combat-save-correctness
plan: P04
type: execute
wave: 2
depends_on:
  - 12-P01
files_modified:
  - src/codex/schemas/entry-types.ts
  - src/engine/combat-loop.ts
autonomous: true
requirements:
  - COMBAT-04
  - COMBAT-05
must_haves:
  truths:
    - "Enemy abilities from enemies.yaml are applied: pack_tactics gives attack bonus, howl reduces player mitigation, backstab forces crit on first attack, poison_blade starts DoT, vanish removes the enemy from combat"
    - "Unknown ability strings (e.g. 'bite', 'slash') are silently skipped"
    - "Casting a healing spell (tags includes 'healing') restores HP by the spell's base_value"
    - "Casting an attack spell (tags includes 'attack') deals damage using the spell's base_value as weaponBase"
    - "Casting with insufficient MP returns '魔力不足！无法施法。' in Chinese and does not consume a turn"
    - "SpellSchema accepts effect_type and base_value fields; existing spells.yaml files without them still parse"
    - "The spell name appears in the narration context (spellName passed to doGenerateNarration)"
  artifacts:
    - path: src/codex/schemas/entry-types.ts
      provides: "SpellSchema with effect_type: z.enum(['damage','heal','buff']).optional() and base_value: z.number().optional()"
    - path: src/engine/combat-loop.ts
      provides: "processEnemyTurn reads abilities[] per enemy and applies all 5 ability effects; processPlayerAction 'cast' path reads spell from codexEntries by action.target, uses mp_cost and effect_type/base_value"
  key_links:
    - from: src/engine/combat-loop.ts processEnemyTurn
      to: enemies.yaml abilities[]
      via: "codexEntries.get(enemy.id) → enemyData.abilities → switch dispatch"
      pattern: "abilities.*switch|switch.*abilities"
    - from: src/engine/combat-loop.ts processPlayerAction cast
      to: spells.yaml
      via: "codexEntries.get(spellId) → spellEntry.mp_cost / effect_type / base_value"
      pattern: "spellEntry.*mp_cost|mp_cost.*spellEntry"
---

<objective>
Implement full enemy abilities (COMBAT-04) and a data-driven spell system (COMBAT-05). Enemy abilities are read from `abilities[]` in the codex entry and dispatched through a switch statement. Spells are looked up in codexEntries by name/id, with mp_cost, effect_type, and base_value controlling actual game effects.

Purpose: Enemies do nothing but basic attacks. Casting a spell always costs the same fixed MP and does the same fixed damage regardless of which spell was cast.
Output: combat-loop.ts processEnemyTurn with ability dispatch; processPlayerAction cast path that looks up the spell by id; SpellSchema with effect_type/base_value fields (optional for backward compatibility).
</objective>

<execution_context>
@/Users/makoto/Downloads/work/cli/.planning/phases/12-combat-save-correctness/12-CONTEXT.md
</execution_context>

<context>
@/Users/makoto/Downloads/work/cli/.planning/ROADMAP.md
@/Users/makoto/Downloads/work/cli/.planning/phases/12-combat-save-correctness/12-PATTERNS.md

<interfaces>
<!-- Extracted from source files. -->

From world-data/codex/enemies.yaml (full ability list used in the codebase):
```
enemy_wolf:         abilities: [bite, pack_tactics]
enemy_wolf_alpha:   abilities: [bite, howl, pack_leader]
enemy_bandit:       abilities: [slash, dirty_trick]
enemy_bandit_archer: abilities: [ranged_shot, retreat]
enemy_shadow_assassin: abilities: [backstab, vanish, poison_blade]
```
The 5 abilities to implement per D-05: pack_tactics, howl, backstab, poison_blade, vanish.
All others (bite, slash, dirty_trick, ranged_shot, retreat, pack_leader) → silently skip.

From world-data/codex/spells.yaml:
```yaml
- id: spell_fire_arrow
  tags: [fire, attack, elemental]
  mp_cost: 3
  effect: 对单体目标造成3-5点火焰伤害

- id: spell_healing_light
  tags: [holy, healing, support]
  mp_cost: 2
  effect: 恢复目标2-4点生命值
```
No effect_type or base_value fields currently — must add to SpellSchema as optional and
then the implementation must derive values:
- effect_type: tags.includes('healing') → 'heal'; tags.includes('attack') → 'damage'; else 'buff'
- base_value: parse numeric from effect string midpoint (fire arrow: (3+5)/2=4; healing light: (2+4)/2=3)
  OR add explicit effect_type and base_value to the YAML entries (preferred — deterministic).
  Decision: ADD explicit fields to spells.yaml entries for determinism per D-07/D-08.

From src/engine/combat-loop.ts processEnemyTurn (lines 250-323 — current structure):
```typescript
async function processEnemyTurn(): Promise<void> {
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const enemyEntry = codexEntries.get(enemy.id);
    const enemyData = enemyEntry?.type === 'enemy' ? (enemyEntry as Enemy) : null;
    const enemyAttackMod = enemyData?.attack ?? 0;
    const enemyDamageBase = enemyData?.damage_base ?? 3;
    // ADD: const abilities = enemyData?.abilities ?? [];
    // ADD: ability dispatch before attack roll
```

From src/engine/combat-loop.ts processPlayerAction cast path (lines 156-166 — current):
```typescript
if (actionType === 'cast') {
  if (player.mp < GAME_CONSTANTS.CAST_MP_COST) {
    stores.combat.setState(draft => { draft.phase = 'player_turn'; });
    return { status: 'error', message: '魔力不足！无法施法。' };
  }
  stores.player.setState(draft => {
    draft.mp = draft.mp - GAME_CONSTANTS.CAST_MP_COST;
  });
}
// Then: existing damage calculation uses GAME_CONSTANTS.CAST_WEAPON_BASE
```
The spell name (action.target) needs to be passed to doGenerateNarration for narration context per D-09.

From src/engine/combat-loop.ts (imports and state):
```typescript
import { GAME_CONSTANTS } from './game-constants';
// GAME_CONSTANTS.CAST_MP_COST, GAME_CONSTANTS.CAST_WEAPON_BASE used currently
import type { CodexEntry, Enemy } from '../codex/schemas/entry-types';
// ADD: import type { Spell } from '../codex/schemas/entry-types';
```

From src/engine/damage.ts (calculateDamage signature):
```typescript
export function calculateDamage(opts: {
  weaponBase: number;
  attributeModifier: number;
  grade: CheckGrade;
  armorReduction: number;
}): DamageResult
```

CombatState — check if it has a poisoned/debuff field:
```typescript
// Check combat-store.ts for existing state fields before adding new ones
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend SpellSchema with effect_type and base_value; update spells.yaml</name>
  <files>src/codex/schemas/entry-types.ts, world-data/codex/spells.yaml</files>
  <read_first>
    - src/codex/schemas/entry-types.ts — lines 66-73 (SpellSchema) and lines 156-184 (CodexEntrySchema discriminated union, Spell type export)
    - world-data/codex/spells.yaml — read fully (current two spells)
  </read_first>
  <behavior>
    - Test 1: SpellSchema.parse({ ...validSpell, effect_type: 'damage', base_value: 4 }) succeeds
    - Test 2: SpellSchema.parse({ ...validSpell }) (no effect_type/base_value) succeeds — fields are optional
    - Test 3: Spell type has effect_type?: 'damage' | 'heal' | 'buff' and base_value?: number
  </behavior>
  <action>
1. In `src/codex/schemas/entry-types.ts`, update `SpellSchema`:
   ```typescript
   export const SpellSchema = z.object({
     ...baseFields,
     type: z.literal("spell"),
     element: z.string(),
     mp_cost: z.number(),
     effect: z.string(),
     requirements: z.array(z.string()),
     effect_type: z.enum(['damage', 'heal', 'buff']).optional(),
     base_value: z.number().optional(),
   });
   ```

2. In `world-data/codex/spells.yaml`, add explicit fields to both spells:
   - `spell_fire_arrow`: add `effect_type: damage` and `base_value: 4` (midpoint of 3-5)
   - `spell_healing_light`: add `effect_type: heal` and `base_value: 3` (midpoint of 2-4)

   Full updated spell_fire_arrow entry (add two fields after `effect`):
   ```yaml
   effect: 对单体目标造成3-5点火焰伤害
   effect_type: damage
   base_value: 4
   ```

   Full updated spell_healing_light entry (add two fields after `effect`):
   ```yaml
   effect: 恢复目标2-4点生命值
   effect_type: heal
   base_value: 3
   ```
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/codex/schemas/ --bail 2>&1 | tail -20</automated>
  </verify>
  <done>
    - SpellSchema has effect_type and base_value as optional fields
    - Spell type includes effect_type?: 'damage' | 'heal' | 'buff' and base_value?: number
    - spells.yaml entries have effect_type and base_value populated
    - bun tsc --noEmit passes
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement enemy abilities in processEnemyTurn (COMBAT-04)</name>
  <files>src/engine/combat-loop.ts, src/state/combat-store.ts</files>
  <read_first>
    - src/engine/combat-loop.ts — read lines 250-325 (processEnemyTurn full body) before editing
    - src/state/combat-store.ts — read fully to check for existing debuff/status fields (to know if poisoned/howl tracking exists or needs adding)
  </read_first>
  <behavior>
    - Test 1: enemy with abilities: ['pack_tactics'], two enemies alive → enemyAttackMod increased by 2 for that attack
    - Test 2: enemy with abilities: ['howl'] → stores.combat state has a flag that reduces player damage reduction next turn (e.g. howlActive: true)
    - Test 3: enemy with abilities: ['backstab'] on first attack (roundNumber === 1 for this enemy) → checkResult.grade forced to 'critical_success'
    - Test 4: enemy with abilities: ['poison_blade'], hit succeeds → player state gets poison DoT applied (poisonStacks > 0 or similar)
    - Test 5: enemy with abilities: ['vanish'] → enemy hp set to 0 (removed from combat), combat continues
    - Test 6: enemy with abilities: ['bite'] (unknown) → silently skipped, normal attack proceeds
    - Test 7: enemy with abilities: ['pack_tactics'], only one enemy alive → no attack bonus
  </behavior>
  <action>
Before editing combat-loop.ts, read combat-store.ts to check what state fields exist. If `howlActive`, `poisonStacks`, or similar fields are absent, add them:

**CombatState additions needed (if absent in combat-store.ts):**
```typescript
howlActive: boolean;      // wolf alpha howl — reduces player AC next enemy turn
playerPoisonStacks: number; // poison_blade DoT stacks
```

**In processEnemyTurn, for each alive enemy, before the attack roll:**
```typescript
const abilities: string[] = enemyData?.abilities ?? [];
const aliveEnemyCount = state.enemies.filter(e => e.hp > 0).length;

// Apply ability pre-effects:
let abilityAttackBonus = 0;
let forceFirstCrit = false;

for (const ability of abilities) {
  switch (ability) {
    case 'pack_tactics': {
      if (aliveEnemyCount >= 2) {
        abilityAttackBonus += 2;
      }
      break;
    }
    case 'howl': {
      stores.combat.setState(draft => { draft.howlActive = true; });
      break;
    }
    case 'backstab': {
      const combatState = stores.combat.getState();
      if (combatState.roundNumber === 1) {
        forceFirstCrit = true;
      }
      break;
    }
    case 'poison_blade': {
      // Applied after a hit — handled in hit block below
      break;
    }
    case 'vanish': {
      stores.combat.setState(draft => {
        const idx = draft.enemies.findIndex(e => e.id === enemy.id);
        if (idx >= 0) draft.enemies[idx]!.hp = 0;
      });
      continue; // skip attack
    }
    default:
      break;
  }
}
```

**Attack roll adjustments:**
- Apply `abilityAttackBonus` to `enemyAttackMod` in the `resolveNormalCheck` call
- If `forceFirstCrit`: skip roll, set checkResult.grade = 'critical_success' (or create a mock CheckResult)
- Apply `howlActive` to playerAC: if `state.howlActive`, reduce effective playerAC by 2 (then clear it)

**After hit resolves:**
- If `abilities.includes('poison_blade')` and `isHit`:
  ```typescript
  stores.player.setState(draft => { draft.poisonStacks = (draft.poisonStacks ?? 0) + 1; });
  ```
  Then at start of each enemy turn (before the loop), if player has poisonStacks, apply DoT:
  ```typescript
  const poisonStacks = stores.player.getState().poisonStacks ?? 0;
  if (poisonStacks > 0) {
    stores.player.setState(draft => {
      draft.hp = Math.max(0, draft.hp - poisonStacks);
    });
  }
  ```

**Player state additions:** Check player-store.ts. If `poisonStacks` does not exist, add it as `poisonStacks: number` (default 0) to PlayerStateSchema and PlayerState.

**Implementation note:** Read combat-store.ts and player-store.ts fully before adding fields to confirm what already exists. Only add fields that are genuinely absent.
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/engine/combat-loop.test.ts --bail 2>&1 | tail -30</automated>
  </verify>
  <done>
    - processEnemyTurn reads abilities[] per enemy
    - pack_tactics: +2 attackMod when 2+ enemies alive
    - howl: sets howlActive flag on combat state; reduces playerAC when active
    - backstab: round 1 attack forces critical_success grade
    - poison_blade: on hit, increments player.poisonStacks; DoT applied at start of enemy turn
    - vanish: enemy hp set to 0, skips that enemy's attack
    - Unknown abilities: silently skipped (default: break)
    - Tests pass; bun tsc --noEmit passes
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Data-driven spell casting in processPlayerAction (COMBAT-05)</name>
  <files>src/engine/combat-loop.ts</files>
  <read_first>
    - src/engine/combat-loop.ts — read lines 116-248 (processPlayerAction) — focus on the 'cast' block (lines ~156-166) and the attack/damage block (lines ~210-228)
    - src/engine/action-handlers/types.ts — confirm CombatActionOptions shape (has action.target passed through?)
  </read_first>
  <behavior>
    - Test 1: processPlayerAction('cast', { spellId: 'spell_fire_arrow' }) — mp >= 3 → deducts 3 MP, deals damage using base_value: 4
    - Test 2: processPlayerAction('cast', { spellId: 'spell_healing_light' }) — mp >= 2 → deducts 2 MP, restores HP by 3
    - Test 3: processPlayerAction('cast', { spellId: 'spell_fire_arrow' }) — mp < 3 → returns error '魔力不足！无法施法。', no MP deducted, no turn consumed
    - Test 4: processPlayerAction('cast', { spellId: 'spell_fire_arrow' }) — spell not found in codex → returns error '未知法术。', no turn consumed
    - Test 5: Narration context receives spellName ('火焰箭') in the playerAction string
    - Test 6: processPlayerAction('cast', { spellId: 'spell_fire_arrow' }) with effect_type absent in codex → fallback to CAST_WEAPON_BASE / original behavior
  </behavior>
  <action>
The current `CombatActionOptions` only has `targetIndex`. We need to pass the spell ID. Per the architecture, action.target from the handler is the spell name/id. The combat-handler calls processPlayerAction but does not currently pass options. We need a way to pass the spell id.

**Two options:**
1. Add `spellId?: string` to `CombatActionOptions` in combat-loop.ts
2. Use a module-level variable (wrong — impure)

Use option 1. Update `CombatActionOptions`:
```typescript
export type CombatActionOptions = {
  readonly targetIndex?: number;
  readonly spellId?: string;
};
```

Update `combat-handler.ts` to pass spellId when actionType === 'cast':
```typescript
const castOptions: CombatActionOptions | undefined =
  action.type === 'cast' && action.target
    ? { spellId: action.target }
    : undefined;

const combatResult = await ctx.combatLoop.processPlayerAction(
  action.type as 'attack' | 'cast' | 'guard' | 'flee',
  castOptions,
);
```

Import `CombatActionOptions` in combat-handler.ts:
```typescript
import type { CombatActionOptions } from '../combat-loop';
```

**In processPlayerAction, replace the cast block (lines ~156-166):**
```typescript
if (actionType === 'cast') {
  const spellId = options?.spellId;
  const spellEntry = spellId ? codexEntries.get(spellId) : null;
  const spell = spellEntry?.type === 'spell' ? (spellEntry as Spell) : null;

  if (!spell && spellId) {
    stores.combat.setState(draft => { draft.phase = 'player_turn'; });
    return { status: 'error', message: '未知法术。' };
  }

  const spellMpCost = spell?.mp_cost ?? GAME_CONSTANTS.CAST_MP_COST;
  if (player.mp < spellMpCost) {
    stores.combat.setState(draft => { draft.phase = 'player_turn'; });
    return { status: 'error', message: '魔力不足！无法施法。' };
  }
  stores.player.setState(draft => {
    draft.mp = draft.mp - spellMpCost;
  });

  // Apply spell effect for heal type immediately — return early
  if (spell?.effect_type === 'heal') {
    const healAmount = spell.base_value ?? 3;
    const newHp = Math.min(player.maxHp, player.hp + healAmount);
    stores.player.setState(draft => { draft.hp = newHp; });
    const spellName = spell.name;
    const narration = await doGenerateNarration(`施放${spellName}，恢复了生命值`, undefined);
    stores.combat.setState(draft => {
      draft.lastNarration = narration;
      draft.phase = 'enemy_turn';
    });
    return { status: 'ok', narration };
  }

  // For 'damage' and 'buff' types, fall through to the normal attack resolution
  // but use spell.base_value as weaponBase (overrides CAST_WEAPON_BASE)
  // Store spellName for narration context use below
}
```

For the damage calculation block (lines ~210-228), update the weaponBase for cast:
```typescript
const weaponBase = actionType === 'attack'
  ? getWeaponBase(player.equipment, codexEntries)
  : (() => {
      const spellId = options?.spellId;
      const spellEntry = spellId ? codexEntries.get(spellId) : null;
      const spell = spellEntry?.type === 'spell' ? (spellEntry as Spell) : null;
      return spell?.base_value ?? GAME_CONSTANTS.CAST_WEAPON_BASE;
    })();
```

For narration context, update the actionLabel for cast:
```typescript
const actionLabel = actionType === 'attack'
  ? '攻击'
  : actionType === 'cast'
    ? (() => {
        const spellId = options?.spellId;
        const spellEntry = spellId ? codexEntries.get(spellId) : null;
        const spell = spellEntry?.type === 'spell' ? (spellEntry as Spell) : null;
        return spell ? `施放${spell.name}` : '施法';
      })()
    : '逃跑';
```

Add `import type { Spell } from '../codex/schemas/entry-types';` at the top of combat-loop.ts.
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/engine/combat-loop.test.ts --bail 2>&1 | tail -30</automated>
  </verify>
  <done>
    - CombatActionOptions has spellId?: string
    - processPlayerAction cast path reads spellEntry from codexEntries by spellId
    - Healing spell: HP restored by spell.base_value; mp_cost from spell; phase set to enemy_turn
    - Damage spell: weaponBase from spell.base_value; mp_cost from spell
    - Insufficient MP: '魔力不足！无法施法。' returned, no turn consumed
    - Unknown spell id: '未知法术。' returned, no turn consumed
    - Spell name appears in narration actionLabel
    - combat-handler passes spellId option when action.type === 'cast'
    - bun tsc --noEmit passes
    - All tests pass
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| player input → spellId lookup | options.spellId used as codex Map key — no injection risk (Map.get is safe) |
| enemy abilities → state mutation | abilities affect combat/player state; all via immutable setState — no direct mutation |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-12P04-01 | Tampering | combat-loop.ts ability dispatch | accept | All ability effects are server-side (no client trust boundary); state mutations go through immutable setState |
| T-12P04-02 | Denial of Service | poison_blade DoT accumulation | accept | DoT applies 1 stack per hit; stack count bounded by combat duration; no infinite loop |
| T-12P04-03 | Spoofing | spell lookup by spellId | mitigate | codexEntries.get() returns undefined for unknown ids → handled with '未知法术。' error; no code injection possible via string key |
</threat_model>

<verification>
```
cd /Users/makoto/Downloads/work/cli
grep -n "abilities" src/engine/combat-loop.ts
# expected: lines in processEnemyTurn showing ability dispatch

grep -n "spellId\|spell\.mp_cost\|spell\.base_value" src/engine/combat-loop.ts
# expected: lines in processPlayerAction cast block

grep -n "effect_type\|base_value" src/codex/schemas/entry-types.ts
# expected: two lines in SpellSchema

grep -n "effect_type\|base_value" world-data/codex/spells.yaml
# expected: 4 lines (2 per spell)

bun test --bail 2>&1 | tail -10
bun tsc --noEmit 2>&1 | head -10
```
</verification>

<success_criteria>
- SpellSchema has effect_type?: enum and base_value?: number (optional for backward compat)
- spells.yaml has effect_type and base_value on both spells
- Enemy abilities: pack_tactics/howl/backstab/poison_blade/vanish all implemented; unknown abilities silently skipped
- Cast: uses spell.mp_cost (not constant); heal spell restores HP; damage spell uses spell.base_value
- Insufficient MP / unknown spell: Chinese error, no turn consumed
- Spell name in narration context
- All tests pass; no type errors
</success_criteria>

<output>
After completion, create `/Users/makoto/Downloads/work/cli/.planning/phases/12-combat-save-correctness/12-P04-SUMMARY.md`
</output>
