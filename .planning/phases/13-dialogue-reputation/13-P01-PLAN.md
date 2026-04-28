---
phase: 13-dialogue-reputation
plan: P01
type: fix
wave: 1
depends_on: []
files_modified:
  - src/engine/reputation-system.ts
  - src/ui/panels/dialogue-panel.tsx
  - src/codex/schemas/entry-types.ts
  - src/engine/dialogue-manager.ts
autonomous: true
requirements:
  - DIAL-01
  - DIAL-02
  - DIAL-07
  - REP-01
  - REP-02
  - REP-03
must_haves:
  truths:
    - "sentimentToDelta('positive') returns 10, not 0.2"
    - "sentimentToDelta('hostile') returns -20, not -0.4"
    - "dialogue-panel uses getAttitudeLabel (integer scale) — not the deleted relationshipLabel"
    - "startDialogue initializes relationshipValue to 0, not initial_disposition + sentimentToDelta"
    - "endDialogue writes pure sentiment delta to relation-store (no initial_disposition contamination)"
    - "endDialogue calls applyFactionReputationDelta when NPC has faction field"
    - "NpcSchema accepts optional faction string"
    - "isQuestNpc matches Chinese goal keywords"
  artifacts:
    - path: src/engine/reputation-system.ts
      provides: "Integer SENTIMENT_DELTAS, applyFactionReputationDelta function"
      exports: ["sentimentToDelta", "getAttitudeLabel", "applyReputationDelta", "applyFactionReputationDelta"]
    - path: src/codex/schemas/entry-types.ts
      provides: "NpcSchema with faction: z.string().optional()"
      contains: "faction"
    - path: src/engine/dialogue-manager.ts
      provides: "startDialogue sets relationshipValue=0; endDialogue faction write; Chinese quest keywords"
    - path: src/ui/panels/dialogue-panel.tsx
      provides: "Uses getAttitudeLabel from reputation-system; no local relationshipLabel"
  key_links:
    - from: src/engine/dialogue-manager.ts
      to: src/engine/reputation-system.ts
      via: "applyFactionReputationDelta called in endDialogue when npc.faction present"
      pattern: "applyFactionReputationDelta"
    - from: src/ui/panels/dialogue-panel.tsx
      to: src/engine/reputation-system.ts
      via: "import getAttitudeLabel"
      pattern: "getAttitudeLabel"
---

<objective>
Unify the reputation scale to -100..+100 integers throughout the dialogue system. Fix sentimentToDelta to return integer deltas, delete the stale float-scale relationshipLabel from dialogue-panel, fix startDialogue to initialize relationshipValue at 0, wire faction reputation writes in endDialogue, add NpcSchema faction field, and add Chinese quest keywords.

Purpose: Every dialogue scale bug (DIAL-01, REP-02) and the faction write path (REP-03) shares the same root: SENTIMENT_DELTAS used float fractions while NpcDispositionSchema enforces -100..+100. This plan fixes the foundation all other plans depend on.
Output: Integer-scale sentimentToDelta, cleaned dialogue-panel, corrected startDialogue, faction delta write in endDialogue, NpcSchema faction field.
</objective>

<execution_context>
@/Users/makoto/Downloads/work/cli/.planning/phases/13-dialogue-reputation/13-CONTEXT.md
@/Users/makoto/Downloads/work/cli/.planning/phases/13-dialogue-reputation/13-RESEARCH.md
</execution_context>

<context>
@/Users/makoto/Downloads/work/cli/.planning/ROADMAP.md

<interfaces>
<!-- Extracted from source files. Executor uses these directly — no re-reading needed. -->

From src/engine/reputation-system.ts (lines 3-12 — current buggy state):
```typescript
const SENTIMENT_DELTAS: Record<string, number> = {
  positive: 0.2,   // CHANGE TO: 10
  neutral: 0,
  negative: -0.2,  // CHANGE TO: -10
  hostile: -0.4,   // CHANGE TO: -20
};
export function sentimentToDelta(sentiment: string): number {
  return SENTIMENT_DELTAS[sentiment] ?? 0;
}
// getAttitudeLabel (lines 14-20) uses -100..+100 scale — correct, leave as-is
```

From src/ui/panels/dialogue-panel.tsx (lines 31-37 — to DELETE):
```typescript
function relationshipLabel(value: number): string {
  if (value < -0.5) return '敌对';
  if (value < -0.1) return '冷淡';
  if (value <= 0.1) return '中立';
  if (value <= 0.5) return '友好';
  return '信任';
}
// line 79: const relLabel = relationshipLabel(relationshipValue);
// CHANGE TO: const relLabel = getAttitudeLabel(relationshipValue);
```

From src/codex/schemas/entry-types.ts (NpcSchema — faction field ABSENT):
```typescript
export const NpcSchema = z.object({
  ...baseFields,
  type: z.literal("npc"),
  location_id: z.string(),
  personality_tags: z.array(z.string()),
  goals: z.array(z.string()),
  backstory: z.string(),
  initial_disposition: z.number().min(-1).max(1),
  // ADD: faction: z.string().optional(),
});
```

From src/engine/dialogue-manager.ts (line 227 — startDialogue bug):
```typescript
// CURRENT (buggy):
draft.relationshipValue = npc.initial_disposition + sentimentToDelta(npcDialogue.sentiment);
// FIX (D-11/D-12): start from 0, initial_disposition only used for attitude label display
draft.relationshipValue = 0;
```

From src/engine/dialogue-manager.ts (QUEST_GOAL_KEYWORDS — line 21):
```typescript
const QUEST_GOAL_KEYWORDS = ['investigate', 'find', 'recruit', 'discover', 'locate', 'uncover'];
// ADD Chinese equivalents (D-02):
// '调查', '寻找', '找到', '招募', '发现', '追踪', '揭露'
```

From src/engine/dialogue-manager.ts (endDialogue lines ~333-345):
```typescript
const delta = stores.dialogue.getState().relationshipValue;
// ...
persistDraft.npcDispositions[npcId] = applyReputationDelta(current, { value: delta });
// AFTER FIX: if npc.faction, also call applyFactionReputationDelta(stores.relations, npc.faction, Math.floor(delta / 2))
```

From src/engine/reputation-system.ts (applyReputationDelta signature):
```typescript
export function applyReputationDelta(
  current: NpcDisposition,
  delta: { value: number },
): NpcDisposition
// ADD applyFactionReputationDelta with same pattern but writing to the store
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fix sentimentToDelta integers + add applyFactionReputationDelta</name>
  <files>src/engine/reputation-system.ts, src/engine/reputation-system.test.ts</files>
  <behavior>
    - Test 1: sentimentToDelta('positive') === 10
    - Test 2: sentimentToDelta('neutral') === 0
    - Test 3: sentimentToDelta('negative') === -10
    - Test 4: sentimentToDelta('hostile') === -20
    - Test 5: sentimentToDelta('unknown') === 0
    - Test 6: applyFactionReputationDelta writes delta to relation-store for factionId 'faction_guard'
  </behavior>
  <action>
1. In `src/engine/reputation-system.ts`, change SENTIMENT_DELTAS values:
   - `positive: 0.2` → `positive: 10`
   - `negative: -0.2` → `negative: -10`
   - `hostile: -0.4` → `hostile: -20`
   - `neutral: 0` stays unchanged

2. Add `applyFactionReputationDelta` function below `applyReputationDelta` (per D-18):
   ```typescript
   export function applyFactionReputationDelta(
     relationStore: Store<RelationState>,
     factionId: string,
     delta: number,
   ): void {
     relationStore.setState(draft => {
       const current = draft.factionReputations?.[factionId] ?? { value: 0 };
       const clamped = Math.max(-100, Math.min(100, current.value + delta));
       if (!draft.factionReputations) draft.factionReputations = {};
       draft.factionReputations[factionId] = { ...current, value: clamped };
     });
   }
   ```
   Before adding: read the `Store<RelationState>` import and `RelationState` shape from `src/state/relation-store.ts` to confirm the `factionReputations` field name and type. Use the actual field name found in the source.

3. In `src/engine/reputation-system.test.ts`: add tests for all 6 behaviors listed above. For Test 6, create a minimal mock relationStore with a `setState` spy.
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/engine/reputation-system.test.ts --bail 2>&1 | tail -20</automated>
  </verify>
  <done>
    - SENTIMENT_DELTAS values are 10, 0, -10, -20
    - applyFactionReputationDelta exported from reputation-system.ts
    - All sentimentToDelta tests pass with exact integer values
    - bun tsc --noEmit passes
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fix NpcSchema faction field + delete relationshipLabel + fix startDialogue + add Chinese keywords + wire faction delta</name>
  <files>src/codex/schemas/entry-types.ts, src/ui/panels/dialogue-panel.tsx, src/engine/dialogue-manager.ts, src/engine/dialogue-manager.test.ts</files>
  <behavior>
    - Test 1: NpcSchema.parse({ ...validNpc, faction: 'faction_guard' }) succeeds
    - Test 2: NpcSchema.parse({ ...validNpc }) succeeds (faction is optional)
    - Test 3: After startDialogue, dialogue-store.relationshipValue === 0
    - Test 4: After endDialogue with positive sentiment (delta=10), relation-store npc value updated by 10 (not contaminated by initial_disposition)
    - Test 5: After endDialogue for NPC with faction, applyFactionReputationDelta called with Math.floor(10/2) = 5
    - Test 6: isQuestNpc returns true for NPC with goal containing '调查'
  </behavior>
  <action>
1. In `src/codex/schemas/entry-types.ts`:
   - Find NpcSchema definition (lines ~57-65)
   - Add `faction: z.string().optional()` as the last field before the closing `})`

2. In `src/ui/panels/dialogue-panel.tsx`:
   - Delete the `relationshipLabel` function (lines 31-37)
   - Add import of `getAttitudeLabel` from `../../engine/reputation-system`
   - Find `const relLabel = relationshipLabel(relationshipValue)` (line ~79) and change to `const relLabel = getAttitudeLabel(relationshipValue)`

3. In `src/engine/dialogue-manager.ts`:
   - Line 227 in startDialogue: change `draft.relationshipValue = npc.initial_disposition + sentimentToDelta(npcDialogue.sentiment)` to `draft.relationshipValue = 0`
   - The line that displays the attitude label from initial_disposition (used for UI label only) should remain — only remove the store write of initial_disposition. If the attitude label display is part of the same line, keep only the getAttitudeLabel call and drop the store write.
   - Line 21 QUEST_GOAL_KEYWORDS: append Chinese keywords: `'调查', '寻找', '找到', '招募', '发现', '追踪', '揭露'`

4. In `src/engine/dialogue-manager.ts` endDialogue (lines ~333-345):
   - After `persistDraft.npcDispositions[npcId] = applyReputationDelta(current, { value: delta })`, add:
     ```typescript
     if (npc.faction) {
       applyFactionReputationDelta(stores.relations, npc.faction, Math.floor(delta / 2));
     }
     ```
   - Add import for `applyFactionReputationDelta` from `../engine/reputation-system` (or adjust path as needed)
   - `npc` here is the codex NPC entry — read the endDialogue signature to confirm how it's accessed

5. In `src/engine/dialogue-manager.test.ts`: add/update tests for behaviors 3-6 listed above. For behavior 4, assert `disposition?.value === 10` (exact integer) to strengthen the existing non-zero assertion. For behavior 5, spy on `applyFactionReputationDelta` or inspect the relations store state.
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/engine/dialogue-manager.test.ts --bail 2>&1 | tail -30</automated>
  </verify>
  <done>
    - NpcSchema has faction: z.string().optional()
    - dialogue-panel.tsx has no relationshipLabel function; uses getAttitudeLabel
    - startDialogue sets draft.relationshipValue = 0 (not initial_disposition + delta)
    - QUEST_GOAL_KEYWORDS includes Chinese keywords
    - endDialogue calls applyFactionReputationDelta when npc.faction is set
    - All dialogue-manager tests pass
    - bun tsc --noEmit passes
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| NPC YAML → NpcSchema | faction field is user/content-controlled; optional field silently ignored if absent |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13P01-01 | Tampering | applyFactionReputationDelta | mitigate | Clamp delta to [-100, 100] in applyFactionReputationDelta (same as applyReputationDelta) |
| T-13P01-02 | Information Disclosure | NpcSchema faction field | accept | faction is non-secret game metadata; no PII |
</threat_model>

<verification>
1. Run: `cd /Users/makoto/Downloads/work/cli && bun test src/engine/reputation-system.test.ts src/engine/dialogue-manager.test.ts --bail 2>&1 | tail -30`
2. Run: `cd /Users/makoto/Downloads/work/cli && bun tsc --noEmit 2>&1 | head -20`
3. Confirm sentimentToDelta('positive') === 10 in test output
4. Confirm dialogue-panel.tsx has no `relationshipLabel` function (grep check)
5. Confirm dialogue-manager.test.ts endDialogue test asserts value === 10
</verification>

<success_criteria>
- [ ] sentimentToDelta('positive') === 10, sentimentToDelta('hostile') === -20 (DIAL-01, REP-01)
- [ ] dialogue-panel uses getAttitudeLabel, no local relationshipLabel (REP-02)
- [ ] startDialogue sets relationshipValue = 0; endDialogue writes pure delta to relation-store (DIAL-07)
- [ ] NpcSchema has faction: z.string().optional() (prerequisite for REP-03)
- [ ] endDialogue calls applyFactionReputationDelta when npc.faction is set (REP-03)
- [ ] QUEST_GOAL_KEYWORDS includes Chinese terms '调查', '寻找', '找到' etc. (DIAL-02)
- [ ] bun test: all existing tests pass, no regressions
- [ ] bun tsc --noEmit: zero errors
</success_criteria>

<output>
After completion, create `/Users/makoto/Downloads/work/cli/.planning/phases/13-dialogue-reputation/13-P01-SUMMARY.md`
</output>
