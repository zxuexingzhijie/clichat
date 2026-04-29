# Plan: QuestStageSchema conditional_next_stages + quests.yaml 6-Stage Expansion

**Phase**: 16 — Story Mainline & Narrative System
**Plan**: 16-P03
**Requirements**: D-02, D-03, D-05, D-06, D-07, D-08, D-09, D-10, D-25, D-27
**Depends on**: none (YAML + schema only, no runtime store dependencies)

## Goal

When this plan is complete, `QuestStageSchema` has a `conditional_next_stages` field, `quest-system.ts` evaluates it against `QuestProgress.flags` before falling back to `nextStageId`, and `quest_main_01` in `quests.yaml` is expanded from 3 stages to 6 stages (two per act) with 3 branching Stage 6 variants driven by route-score flags accumulated in `QuestProgress.flags`. Side quests gain mainline-binding `description` updates linking them to the expanded arc.

## Success Criteria

1. `bun run tsc --noEmit` passes with no new errors
2. `bun test src/engine/quest-system.test.ts` — all tests pass including new conditional branching tests
3. `bun test src/codex/schemas/entry-types.test.ts` (if exists) or schema parse smoke test passes
4. `world-data/codex/quests.yaml` parses successfully through `QuestTemplateSchema` (can verify via `bun run -e "import('./src/codex/loader.ts').then(m => m.loadCodex('./world-data'))"`
5. After advancing to `stage_allies_decision` with `flags.justice_score = 3`, `advanceStage` routes to `stage_consequence_justice`
6. After advancing to `stage_allies_decision` with no flags set, `advanceStage` falls through to default `nextStageId`

## Tasks

### Task 1: Add conditional_next_stages to QuestStageSchema

**File**: `src/codex/schemas/entry-types.ts`
**Action**: Edit

Add `ConditionalNextStageSchema` and `conditional_next_stages` field to `QuestStageSchema`:

```typescript
export const ConditionalNextStageSchema = z.object({
  condition_flag: z.string(),
  condition_value: z.unknown().optional(),
  nextStageId: z.string(),
});
export type ConditionalNextStage = z.infer<typeof ConditionalNextStageSchema>;

// In QuestStageSchema, add:
export const QuestStageSchema = z.object({
  id: z.string().min(1),
  description: z.string(),
  objectives: z.array(QuestObjectiveSchema),
  nextStageId: z.string().nullable(),
  conditional_next_stages: z.array(ConditionalNextStageSchema).optional(),
  completionCondition: z.string().optional(),
  trigger: QuestTriggerSchema.optional(),
});
```

**Semantics**: `conditional_next_stages` is evaluated in order. The first entry where `QuestProgress.flags[condition_flag]` is truthy (or equals `condition_value` if specified) wins. If none match, `nextStageId` is used.

### Task 2: Update quest-system.ts checkAndAdvance to evaluate conditional_next_stages

**File**: `src/engine/quest-system.ts`
**Action**: Edit

In `checkAndAdvance`, replace the bare `stage.nextStageId` lookup with a resolver function:

```typescript
function resolveNextStage(stage: QuestStage, flags: Record<string, unknown>): string | null {
  if (stage.conditional_next_stages?.length) {
    for (const cond of stage.conditional_next_stages) {
      const flagValue = flags[cond.condition_flag];
      if (cond.condition_value !== undefined) {
        if (flagValue === cond.condition_value) return cond.nextStageId;
      } else {
        if (flagValue) return cond.nextStageId;
      }
    }
  }
  return stage.nextStageId;
}
```

Replace the two uses of `stage.nextStageId` in `checkAndAdvance` with `resolveNextStage(stage, progress.flags)`.

Write tests:
- `conditional_next_stages` with matching flag routes to that stage
- `conditional_next_stages` with no matching flag falls back to `nextStageId`
- `conditional_next_stages` with `condition_value` matches only exact value
- existing linear stage advancement still works (no regression)

### Task 3: Expand quest_main_01 to 6 stages in quests.yaml

**File**: `world-data/codex/quests.yaml`
**Action**: Edit — replace `quest_main_01` stages block entirely

Replace the existing 3-stage `quest_main_01.stages` with the full 6-stage arc. Keep all other top-level fields unchanged. Route scores are accumulated via `advanceStage` calls from dialogue handlers (that work is in P04); YAML only declares structure.

**Stage design** (implement all 6 in YAML):

**Stage 1: stage_rumor** (Act 1 — existing, keep trigger)
- Description: 调查关于北林失踪事件的谣言
- Trigger: `dialogue_ended / npc_bartender`
- Objectives: talk to any NPC
- `nextStageId: stage_disappearances`

**Stage 2: stage_disappearances** (Act 1 — new, replaces old stage_investigate)
- Description: 深入调查——失踪者的共同点，矿路封锁的真相
- Trigger: `{ event: location_entered, targetId: loc_abandoned_camp }` (single trigger; the npc_beggar dialogue condition is handled as a quest objective note, not a trigger field, since `QuestTriggerSchema` supports a single event/targetId pair)
- Objectives: visit abandoned camp OR talk to 瞎子孙 (document the OR condition in the objective description text)
- `nextStageId: stage_truth_in_forest`

**Stage 3: stage_truth_in_forest** (Act 2 — new)
- Description: 洞穴中的古代符文——与五年前的狼灾相同；月华认出了它们
- Trigger: `location_entered / loc_dark_cave`
- Objectives: enter dark cave, then talk to npc_priestess
- `nextStageId: stage_mayor_secret`

**Stage 4: stage_mayor_secret** (Act 2 — new, formerly stage_expose was placeholder)
- Description: 镇长的秘密——五年前的交易，外来势力的回归
- Trigger: `dialogue_ended / npc_elder`
- Objectives: confront 王德 with evidence (dialogue trigger), OR reach through 阿鬼 (via flag; handled in dialogue)
- `nextStageId: stage_allies_decision`

**Stage 5: stage_allies_decision** (Act 3 — new)
- Description: 三条路线：义之道（陈铁柱）/ 和之道（王德）/ 暗之道（阿鬼）
- Trigger: `{ event: dialogue_ended, targetId: npc_captain }`
- Objectives: talk to 月华, then make alliance (any of three NPCs)
- `conditional_next_stages`:
  - `{ condition_flag: justice_score_locked, nextStageId: stage_consequence_justice }`
  - `{ condition_flag: shadow_score_locked, nextStageId: stage_consequence_shadow }`
  - `{ condition_flag: pragmatism_score_locked, nextStageId: stage_consequence_harmony }`
- `nextStageId: stage_consequence_harmony` (default if no route locked)

**Stage 6a: stage_consequence_justice** (Act 3 ending —义之道)
- Description: 义之道结局——真相公开，陈铁柱独自哭泣，镇子将面临震荡
- Trigger: `dialogue_ended / npc_captain`
- Objectives: complete confrontation dialogue with 陈铁柱
- `nextStageId: null`

**Stage 6b: stage_consequence_harmony** (Act 3 ending — 和之道)
- Description: 和之道结局——秘密被压制，月华沉默，瞎子孙消失
- Trigger: `dialogue_ended / npc_elder`
- Objectives: complete suppression agreement with 王德
- `nextStageId: null`

**Stage 6c: stage_consequence_shadow** (Act 3 ending — 暗之道)
- Description: 暗之道结局——阿鬼请玩家喝酒，地下势力永久扎根黑松镇
- Trigger: `dialogue_ended / npc_shadow_contact`
- Objectives: complete deal with 阿鬼
- `nextStageId: null`

**Side quest mainline bindings** — update descriptions only (no structural change):
- `quest_side_wolf_bounty.description`: append `（Stage 3后：猎狼只是治标，狼群异常来自洞穴祭祀地）`
- `quest_side_missing_ore.description`: append `（Stage 2后：矿路被故意封锁，阻止外人发现洞穴）`
- `quest_side_overdue_debt.description`: append `（Stage 4后：瞎子孙的"债"是封口费，他是关键证人）`

The final YAML for `quest_main_01.stages` must list: `stage_rumor`, `stage_disappearances`, `stage_truth_in_forest`, `stage_mayor_secret`, `stage_allies_decision`, `stage_consequence_justice`, `stage_consequence_harmony`, `stage_consequence_shadow`.

## Tests

- [ ] `src/engine/quest-system.test.ts` — `resolveNextStage` with matching conditional, no-match fallback, condition_value exact match
- [ ] YAML parse smoke test — run `bun -e "import('./src/codex/loader.ts').then(m => m.loadCodex('./world-data').then(() => console.log('OK')))"` without error
- [ ] Existing quest-system advancement tests pass without regression

## Commit Message

`feat(16-P03): conditional_next_stages schema + quest_main_01 expanded to 6-stage arc with 3 endings`
