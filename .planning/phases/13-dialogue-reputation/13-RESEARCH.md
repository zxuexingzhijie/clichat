# Phase 13: Dialogue & Reputation — Research

**Researched:** 2026-04-28
**Domain:** Dialogue system bug fixes, reputation scale, inline input, streaming sentiment
**Confidence:** HIGH — all findings from direct source file inspection, no assumptions needed

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Unify scale to -100..+100 integer (consistent with NpcDispositionSchema)
- D-02: sentimentToDelta returns integers: positive → +10, neutral → 0, negative → -10, hostile → -20
- D-03: Delete duplicate relationshipLabel from dialogue-panel.tsx, import getAttitudeLabel instead
- D-04: Add TextInput from @inkjs/ui to dialogue-panel.tsx
- D-05: TextInput and numbered options shown simultaneously; when TextInput active, block arrow/number key selection; Escape exits text input mode
- D-06: TextInput value submitted through talk-handler's existing NL path
- D-07: Add to NPC_ROLE_QUESTIONS: innkeeper, hunter, clergy/religious
- D-08: Fix tag matching: check all npc.tags, take first match (not just break after first tag)
- D-09: Remove hardcoded sentiment: 'neutral' from extractNpcMetadata
- D-10: After streaming completes, if sentiment cannot be reliably extracted, fall back to generateNpcDialogue (structured call), use its sentiment field
- D-11: dialogue-store.relationshipValue initial value changes to 0
- D-12: startDialogue does NOT write initial_disposition to relationshipValue; only uses it for attitude label display
- D-13: processPlayerResponse accumulates sentimentToDelta into relationshipValue (from 0)
- D-14: endDialogue writes dialogue-store.relationshipValue (pure delta) to relation-store via applyReputationDelta
- D-15: Add restoreState(data: RelationState): void to relation-store — directly calls setState, skips onChange broadcast
- D-16: serializer.restore() calls stores.relations.restoreState(data.relations) not setState
- D-17: Normal setState continues triggering onChange (unchanged)
- D-18: Add applyFactionReputationDelta(stores, factionId, delta) to reputation-system.ts
- D-19: endDialogue checks if NPC has faction field in codex entry; if so, calls applyFactionReputationDelta(delta = floor(npc_delta / 2))

### Claude's Discretion
- Exact Chinese text for innkeeper/hunter/clergy questions (world-appropriate)
- TextInput placeholder text
- clergy vs religious key name choice (merge or keep two keys)
- generateNpcDialogue fallback trigger threshold

### Deferred Ideas (OUT OF SCOPE)
- Dialogue history playback
- NPC emotion visualization
- Faction reputation UI panel
- Keyword-matching sentiment extraction as alternative to generateNpcDialogue fallback
</user_constraints>

---

## Summary

All 11 bugs are confined to 6 source files. The fixes are surgical — no new subsystems, no schema migrations, no API changes except adding `restoreState` to relation-store and `applyFactionReputationDelta` to reputation-system. The most structural change is REP-03, which requires adding a `faction` field to `NpcSchema` (currently absent) so `endDialogue` can read it from the codex entry.

The fixes group into 4 independent change sets that can be sequenced without conflict: (1) scale unification, (2) endDialogue delta semantics + faction write, (3) REP-01 restoreState, (4) UI/streaming fixes.

---

## Bug Analysis

### DIAL-01 / REP-04: Scale Unification

**Current state — reputation-system.ts lines 3-12:**
```typescript
const SENTIMENT_DELTAS: Record<string, number> = {
  positive: 0.2,
  neutral: 0,
  negative: -0.2,
  hostile: -0.4,
};

export function sentimentToDelta(sentiment: string): number {
  return SENTIMENT_DELTAS[sentiment] ?? 0;
}
```

**Current state — NpcDispositionSchema (relation-store.ts lines 6-13):**
```typescript
export const NpcDispositionSchema = z.object({
  value: z.number().min(-100).max(100),
  // ...all other fields also min(-100).max(100)
});
```

**Scale mismatch:** sentimentToDelta returns ±0.2/0.4 (float fraction of 1.0), but the store enforces -100..+100 integers. A "positive" sentiment adds 0.2 to an integer store, producing fractional values that are semantically meaningless (±0.2 out of ±100 is 0.2% change per turn).

**Change required:** Replace SENTIMENT_DELTAS values: `positive: 10`, `neutral: 0`, `negative: -10`, `hostile: -20`.

**Impact on requiresFullMode:** `dialogue-manager.ts:32-33` checks `npc.initial_disposition < -0.2` and `> 0.5`. `initial_disposition` is defined in `NpcSchema` as `z.number().min(-1).max(1)` — this is a separate codex field on the NPC YAML, not a -100..+100 value. These thresholds are correct for the codex schema and do NOT need changing. The scale unification only affects `sentimentToDelta` and `relationshipValue` accumulation.

**Risk:** None. `applyReputationDelta` already clamps to [-100, 100]. Existing tests in reputation-system.test.ts use integer deltas (e.g., `{ value: 10 }`) so they pass without change. The one test that checks endDialogue writes a non-zero value (`expect(disposition?.value).not.toBe(0)`) will still pass.

---

### DIAL-02: Inline Dialogue Text Input (DIAL-04 in requirements numbering)

**Current state — dialogue-panel.tsx:**
- No TextInput component exists anywhere in the file
- `useInput` hook (line 77) intercepts all keyboard events: Escape, arrows, Enter, number keys
- Props include `onEscape`, `onSelect`, `onExecute` — no free-text submission prop exists
- Hint text at bottom (line 142): `↑↓ 选择    Enter 确认    Esc 结束对话`

**What's missing:**
1. A `onFreeTextSubmit: (text: string) => void` prop (or equivalent)
2. Import of `TextInput` from `@inkjs/ui`
3. Local state for text input active/inactive and current text value
4. When TextInput active: suppress arrow/number key handling in `useInput`
5. When Escape pressed in text mode: exit text mode (not endDialogue)

**NL submission path (D-06):** The submission needs to reach `talk-handler`'s NL path. The cleanest path is to add `processPlayerFreeText(text: string)` to `DialogueManager` that routes to the NL processing branch of `processPlayerResponse`. Wire `onFreeTextSubmit` in game-screen to call `dialogueManager.processPlayerFreeText(text)`. This avoids touching game-screen-controller and keeps the NL path consistent with how dialogue responses are already handled.

**Risk — double-input conflict:** `useInput` in dialogue-panel and `TextInput` from @inkjs/ui both capture input when active. The `isActive` prop on `useInput` (line 77) must be set to `false` when TextInput is focused, otherwise both handlers fire simultaneously.

---

### DIAL-03: Streaming Sentiment Always Neutral

**Current state — metadata-extractor.ts line 33:**
```typescript
return Object.freeze({
  emotionTag,
  shouldRemember: rawText.length > REMEMBER_THRESHOLD,
  sentiment: 'neutral',   // ← hardcoded, never extracted from text
});
```

**Current state — use-npc-dialogue.ts lines 62-82:**
The fallback to `generateNpcDialogue` is triggered when `isAllDefaults` is true AND `isSubstantive` (length > 50). `isAllDefaults` requires `extracted.sentiment === 'neutral'` — but since sentiment is always 'neutral', this condition is always partially true. The fallback fires when emotionTag is also neutral AND shouldRemember is false, meaning substantive texts that happen to trigger emotion patterns never fall back.

**Change required:**
1. In `extractNpcMetadata`: remove `sentiment: 'neutral'` hardcode, add sentiment pattern matching (Chinese keywords for positive/negative/hostile) or leave it as `undefined`/not-set and let the fallback logic handle it.
2. The locked decision (D-09/D-10) says: remove hardcode, rely on fallback path. The simplest implementation: set `sentiment: 'neutral'` only when the text is short (below threshold) or contains no cues, otherwise omit it and trigger the structured fallback.

**Actual recommendation per D-10:** Remove the hardcode. The fallback logic in `use-npc-dialogue.ts` already exists and works — the `isAllDefaults` check will now correctly trigger when no sentiment can be extracted, causing a structured `generateNpcDialogue` call that returns real sentiment.

**Risk — render side-effect (DIAL-06):** The metadata extraction block (lines 55-90 in use-npc-dialogue.ts) runs as a render-time side-effect (no useEffect). The `prevIsStreaming.current` ref trick prevents re-running, but `setMetadata` and the async `generateNpcDialogue().then(setMetadata)` calls happen in render body. This violates React rules and can cause double-invocation in Strict Mode. **DIAL-06 fix (move to useEffect) and DIAL-03 fix must be coordinated** — the sentinel pattern (`prevIsStreaming.current`) will need to move into the useEffect cleanup/dep array.

---

### DIAL-05 / DIAL-07: endDialogue Writes Contaminated Value

**Current state — dialogue-manager.ts line 227 (startDialogue):**
```typescript
draft.relationshipValue = npc.initial_disposition + sentimentToDelta(npcDialogue.sentiment);
```
With old scale: this sets `relationshipValue` to e.g. `0.3 + 0.0 = 0.3` (float, mixes codex fraction with delta).

**Current state — dialogue-manager.ts line 303 (processPlayerResponse):**
```typescript
const newRelationship = state.relationshipValue + sentimentToDelta(npcDialogue.sentiment);
```
Each turn adds delta to whatever startDialogue initialized.

**Current state — dialogue-manager.ts lines 333-345 (endDialogue):**
```typescript
const delta = stores.dialogue.getState().relationshipValue;
// ...
persistDraft.npcDispositions[npcId] = applyReputationDelta(current, { value: delta });
```
`delta` includes `initial_disposition` (0.3 in example above), so it writes the initial codex value as a reputation change on every conversation end — even if the conversation was entirely neutral.

**Change required (D-11 through D-14):**
- `getDefaultDialogueState()`: `relationshipValue: 0` — already correct, default IS 0
- `startDialogue` line 227: change to `draft.relationshipValue = 0` (drop `npc.initial_disposition + sentimentToDelta(...)`)
- `startDialogue` still needs to display attitude label from `initial_disposition` — this is UI-only, can use `getAttitudeLabel(npc.initial_disposition * 100)` converted to integer scale or read from relation-store if available
- `processPlayerResponse` line 303: keep as-is (accumulates from 0, correct)
- `endDialogue`: keep as-is (reads `relationshipValue` which is now pure delta)

**Note on getDefaultDialogueState:** Current `getDefaultDialogueState()` already returns `relationshipValue: 0`. The bug is only in `startDialogue` overwriting it with `initial_disposition + sentimentToDelta(...)`. So D-11 is a no-op on the default — the fix is purely in `startDialogue`.

**Risk — dialogue-manager.test.ts line 290-314:** The test `endDialogue flushes non-zero relationshipValue delta to RelationStore` uses `npc_guard` with `initial_disposition: 0.0` and mock sentiment `'positive'`. With current code: `relationshipValue = 0.0 + 0.2 = 0.2` → writes 0.2 to store. After fix: `relationshipValue = 0 + 10 = 10` → writes 10. The test asserts `expect(disposition?.value).not.toBe(0)`, which still passes. Test does not assert exact value, so no test update needed for behavior change.

---

### NPC Role Questions — DIAL-05 (NPC role coverage) + Tag Matching

**Current state — dialogue-manager.ts lines 37-44:**
```typescript
const NPC_ROLE_QUESTIONS: Record<string, readonly string[]> = {
  guard:              ['"最近镇上有没有什么异常？"', '"你在这里执勤多久了？"'],
  merchant:           ['"你这里有什么货物？"', '"最近生意怎么样？"'],
  information_broker: ['"你知道什么值钱的消息吗？"', '"最近镇上有什么风声？"'],
  craftsman:          ['"你能帮我修缮装备吗？"', '"你缺什么材料？"'],
  healer:             ['"你有治疗药水吗？"', '"附近有什么危险？"'],
  religious:          ['"神殿最近有什么活动？"', '"你们信奉哪位神明？"'],
};
```
Missing: `innkeeper`, `hunter`, `clergy` (note: `religious` already exists — `clergy` can map to same entry or share it), `beggar`, `underworld`.

**Current state — tag matching loop (dialogue-manager.ts lines 68-80):**
```typescript
for (const tag of npc.tags ?? []) {
  const questions = NPC_ROLE_QUESTIONS[tag];
  if (questions) {
    for (const q of questions) {
      // add questions...
    }
    break;   // ← stops after first tag, even if no match was found yet
  }
}
```
The `break` fires after the FIRST tag that has a matching entry, which is correct. BUT if the first tag has NO entry in NPC_ROLE_QUESTIONS, it does NOT break — it continues to the next tag. Re-reading: the break is INSIDE the `if (questions)` block, so it only breaks when a match is found. This is already correct behavior.

**D-08 re-examination:** The CONTEXT.md says "tag matching only checks npc.tags[0]" — but the code shows a loop over all tags with break-on-first-match. This is correct. The issue is the test fixture `npc_captain` has `tags: ['military', '黑松镇']` — `military` has no entry in NPC_ROLE_QUESTIONS, so it falls through and produces only the generic fallback question. Adding `military` to NPC_ROLE_QUESTIONS is effectively what D-07/D-08 requires. The loop logic itself is fine — no change needed to loop structure, only add missing role keys.

**Change required:** Add to NPC_ROLE_QUESTIONS: `innkeeper`, `hunter`, `military`, `clergy`, `beggar`, `underworld`. Either `clergy` (new key) or rely on existing `religious`. The CONTEXT says add innkeeper/hunter/clergy — `military`, `beggar`, and `underworld` are also missing per REQUIREMENTS.md DIAL-05.

---

### DIAL-06: Streaming Completion as Render Side-Effect

**Current state — use-npc-dialogue.ts lines 55-90:**
```typescript
const prevIsStreaming = useRef(streaming.isStreaming);
if (prevIsStreaming.current && !streaming.isStreaming && !streaming.error) {
  prevIsStreaming.current = false;
  // ... setMetadata() call or async generateNpcDialogue().then(setMetadata)
}
prevIsStreaming.current = streaming.isStreaming;
```
This block runs unconditionally in the render body on every render — not inside `useEffect`. The `setMetadata` call (a state update) from within a render body is a React anti-pattern that can cause cascading re-renders and double-invocations in React 18+ concurrent mode.

**Change required:** Move the entire streaming completion detection block into a `useEffect` with `[streaming.isStreaming, streaming.error]` as dependencies. The `prevIsStreaming` ref can be replaced by checking `streaming.isStreaming === false` and a "completion fired" guard ref.

**Risk:** The async `generateNpcDialogue().then(setMetadata)` already inside the block is fine in useEffect. The `eventBus.emit` call also acceptable there.

---

### DIAL-07: handleNpcDialogueComplete Double-Fire

**Current state — game-screen.tsx lines 182-186:**
```typescript
useEffect(() => {
  if (!isNpcStreaming && npcMetadata && npcStreamingText.length > 0) {
    controller.handleNpcDialogueComplete(dialogueState.npcName, npcMetadata.dialogue, inputMode);
  }
}, [isNpcStreaming, npcMetadata, npcStreamingText, controller, dialogueState.npcName, inputMode]);
```

**Double-fire cause:** `npcStreamingText` is in the dependency array. After streaming ends, `npcMetadata` is set (one render) and then any subsequent render that changes `inputMode` or `dialogueState.npcName` will re-trigger the effect while the condition `!isNpcStreaming && npcMetadata && npcStreamingText.length > 0` is still true.

**Change required:** Add a `hasFiredRef = useRef(false)` guard: set to true when fired, reset to false when `isNpcStreaming` becomes true again (new streaming session). Alternatively, call `resetNpcDialogue()` synchronously inside `handleNpcDialogueComplete` before the effect re-evaluates — `resetNpcDialogue` sets `npcMetadata` back to null, breaking the condition on next render. Looking at `handleNpcDialogueComplete` (game-screen-controller.ts:179): it ALREADY calls `resetNpcDialogue?.()`. The issue is timing: `resetNpcDialogue` triggers a state update → re-render, but `npcMetadata` from the previous render is still in scope for the current effect run.

**Correct fix:** Use a fired-guard ref in `game-screen.tsx`. Reset the guard when a new streaming session starts (when `isNpcStreaming` becomes true). This is the most reliable approach without changing component architecture.

---

### REP-01: Spurious reputation_changed on Game Load

**Current state — serializer.ts line 169:**
```typescript
stores.relations.setState(draft => { Object.assign(draft, data.relations); });
```

**Current state — relation-store.ts onChange (lines 32-70):**
Every `setState` call triggers `onChange` which compares old/new dispositions and emits `reputation_changed` for every NPC and faction whose value differs from the empty default state.

On game load: relations start at `{}`, restore sets them to saved values → every NPC in the save triggers a `reputation_changed` event with delta = (saved value - 0). These are spurious events that could trigger UI effects, quest triggers, or achievement checks that should only fire on actual gameplay changes.

**Change required:**
1. Add `restoreState` method to the `Store<RelationState>` returned by `createRelationStore`. This requires either:
   - Returning a type that extends `Store<RelationState>` with the extra method, OR
   - Implementing it in the factory by calling `createStore`'s internal `setState` directly in a way that bypasses onChange

**Implementation detail (D-15):** The cleanest approach: in `createRelationStore`, after creating the store, add a `restoreState` method that calls the underlying Immer `produce` and sets state directly, bypassing `onChange`. This requires returning `{ ...store, restoreState }` with an extended type.

**Store interface concern:** `createStore` returns `Store<T>` type which does NOT have `restoreState`. The serializer currently types stores as `Store<RelationState>`. For D-15 to work, either:
  a) The `stores.relations` field in `createSerializer`'s parameter type needs to be `Store<RelationState> & { restoreState: (data: RelationState) => void }`, or
  b) A new `RelationStore` type is created and used wherever relation-store is passed

Option (a) is the minimal change. The planner should update only the serializer's store type signature.

**Risk:** No other callers of `stores.relations.setState` exist in the restore path — only serializer.ts line 169. All other setState calls (from dialogue-manager, reputation-system) should continue triggering onChange normally.

---

### REP-02: getAttitudeLabel and relationshipLabel Scale Mismatch

**Current state — reputation-system.ts lines 14-20:**
```typescript
export function getAttitudeLabel(value: number): string {
  if (value < -60) return '敌视';
  if (value < -20) return '冷漠';
  if (value < 20)  return '中立';
  if (value < 60)  return '友好';
  return '信任';
}
```
This is correctly calibrated for -100..+100 scale. All existing tests pass with integer values.

**Current state — dialogue-panel.tsx lines 31-37:**
```typescript
function relationshipLabel(value: number): string {
  if (value < -0.5) return '敌对';
  if (value < -0.1) return '冷淡';
  if (value <= 0.1) return '中立';
  if (value <= 0.5) return '友好';
  return '信任';
}
```
This uses -1.0..+1.0 scale (old float range). It returns `'敌对'` (not `'敌视'`) for the hostile label — a different Chinese string.

**Usage in dialogue-panel.tsx line 79:**
```typescript
const relLabel = relationshipLabel(relationshipValue);
```

**Change required (D-03):**
1. Delete `relationshipLabel` function (lines 31-37)
2. Import `getAttitudeLabel` from `../../engine/reputation-system`
3. Replace `const relLabel = relationshipLabel(relationshipValue)` with `const relLabel = getAttitudeLabel(relationshipValue)`

This is pure deletion + import replacement. No logic change needed if D-11/D-12/D-13 correctly ensures `relationshipValue` is now an integer in -100..+100 range.

---

### REP-03: Faction Reputation Writes

**Current state — NpcSchema (entry-types.ts lines 57-65):**
```typescript
export const NpcSchema = z.object({
  ...baseFields,
  type: z.literal("npc"),
  location_id: z.string(),
  personality_tags: z.array(z.string()),
  goals: z.array(z.string()),
  backstory: z.string(),
  initial_disposition: z.number().min(-1).max(1),
});
```
**No `faction` field exists.** D-19 requires reading `faction` from the NPC codex entry, but this field is not in the schema and would not be present in YAML files.

**Blocking issue:** D-19 cannot be implemented as written without schema change. Options:
  a) Add optional `faction?: z.string()` to `NpcSchema` — requires updating YAML files for NPCs that belong to factions, and adds `faction` to `Npc` type
  b) Look up faction membership via a separate codex query (FactionSchema has no `members` field either)
  c) Use NPC `tags` to infer faction (e.g., tag `faction:guard_corps`) — no current convention for this

**Recommendation:** Option (a) is the cleanest. Add `faction: z.string().optional()` to `NpcSchema`. No existing YAML needs to break (field is optional). Planner must include a task to add the field to NpcSchema AND to any existing NPC YAML entries that should have faction affiliation.

**applyFactionReputationDelta implementation (D-18):** Needs `stores` parameter containing `relation: Store<RelationState>`. Unlike `applyReputationDelta` (which operates on plain objects), this function needs to write to the store. Signature should be:
```typescript
export function applyFactionReputationDelta(
  relationStore: Store<RelationState>,
  factionId: string,
  delta: number,
): void
```
The `stores` param referenced in CONTEXT.md likely means just the relation store. Planner should clarify the exact signature.

---

## Fix Dependencies & Order

| Fix | Depends On | Blocks |
|-----|-----------|--------|
| D-01/D-02: sentimentToDelta integers | nothing | D-11/D-12/D-13/D-14 (scale must be consistent when testing) |
| D-03: delete relationshipLabel, import getAttitudeLabel | D-01 (value is now integer, old scale broke it) | nothing |
| D-11/D-12/D-13/D-14: startDialogue/endDialogue delta semantics | D-01 (needs integer deltas) | D-19 (endDialogue writes faction delta) |
| D-15/D-16/D-17: restoreState | nothing (independent) | nothing |
| D-18/D-19: faction delta write | D-14 (endDialogue must be fixed first), NpcSchema faction field | nothing |
| D-04/D-05/D-06: TextInput in dialogue panel | nothing | nothing |
| D-07/D-08: NPC_ROLE_QUESTIONS + tag loop | nothing | nothing |
| D-09/D-10: metadata-extractor sentiment | DIAL-06 fix (should move completion logic to useEffect together) | nothing |
| DIAL-06: completion to useEffect | D-09 (changes what extractNpcMetadata returns, affects condition logic) | nothing |
| DIAL-07: handleNpcDialogueComplete guard | nothing (independent) | nothing |

**Sequencing rule:** D-01/D-02 must land before any code that reads sentimentToDelta output is tested. All other fix groups are independent of each other.

---

## Confirmed Implementation Plan

### Wave 1 — Scale Foundation (must be first)
Files: `src/engine/reputation-system.ts`, `src/ui/panels/dialogue-panel.tsx`

- Change `SENTIMENT_DELTAS` to integer values (D-01/D-02)
- Delete `relationshipLabel`, import `getAttitudeLabel` (D-03)
- Update reputation-system.test.ts: add `sentimentToDelta` tests for new integer values

### Wave 2 — endDialogue Delta Semantics + Faction Schema
Files: `src/engine/dialogue-manager.ts`, `src/codex/schemas/entry-types.ts`, `src/engine/reputation-system.ts`

- Fix `startDialogue` line 227: `draft.relationshipValue = 0` (D-11/D-12)
- `processPlayerResponse` accumulation is already correct post-wave-1 (D-13 is a no-op)
- `endDialogue` reads `relationshipValue` as pure delta — already correct (D-14 is a no-op)
- Add `faction: z.string().optional()` to `NpcSchema` (prerequisite for D-19)
- Add `applyFactionReputationDelta` to reputation-system.ts (D-18)
- Wire faction delta in `endDialogue` (D-19)
- Update dialogue-manager.test.ts: verify endDialogue writes correct delta (not contaminated by initial_disposition)

### Wave 3 — REP-01 Restore Bypass
Files: `src/state/relation-store.ts`, `src/state/serializer.ts`

- Add `restoreState` method to relation-store (D-15), extend Store type or create RelationStore type
- Update serializer.restore() to call `restoreState` for relations (D-16)
- Update relation-store.test.ts: verify `restoreState` does NOT emit `reputation_changed`
- Update serializer.test.ts: verify restore does not fire reputation events

### Wave 4 — NPC Role Questions
Files: `src/engine/dialogue-manager.ts`

- Add `innkeeper`, `hunter`, `military`, `clergy`, `beggar`, `underworld` keys to `NPC_ROLE_QUESTIONS` (D-07/D-08)
- Chinese question content: planner's discretion
- Update dialogue-manager.test.ts: test NPC with `military` tag gets military-specific questions

### Wave 5 — Streaming Sentiment + Use-Effect Fix
Files: `src/ai/utils/metadata-extractor.ts`, `src/ui/hooks/use-npc-dialogue.ts`

- Remove hardcoded `sentiment: 'neutral'` from `extractNpcMetadata` (D-09)
- Add simple sentiment patterns (positive/negative/hostile Chinese character detection) or leave as undefined to always trigger fallback
- Move streaming completion block to `useEffect` in `use-npc-dialogue.ts` (DIAL-06)
- Update metadata-extractor.test.ts: verify sentiment is no longer always neutral

### Wave 6 — UI: TextInput + Double-Fire Guard
Files: `src/ui/panels/dialogue-panel.tsx`, `src/ui/screens/game-screen.tsx`

- Add TextInput to dialogue panel (D-04/D-05)
- Add `onFreeTextSubmit` prop and wire up NL path via `processPlayerFreeText` (D-06)
- Add fired-guard ref to game-screen.tsx handleNpcDialogueComplete effect (DIAL-07)
- Update dialogue-panel test or game-screen test for TextInput behavior

---

## Edge Cases & Risks

### REP-03: NpcSchema faction field is absent
**Risk:** D-19 will silently skip all faction writes until faction YAML entries are populated. This is acceptable — optional field means no crash, just no faction writes for NPCs without it.

### DIAL-06 + DIAL-03 interaction
**Risk:** Moving completion logic to `useEffect` changes when `setMetadata` fires relative to re-renders. The `handleNpcDialogueComplete` effect in game-screen.tsx (DIAL-07 scope) depends on `npcMetadata` being set. If useEffect ordering changes, the game-screen effect might fire before metadata is ready. Must verify dependency arrays are consistent across both hooks.

### restoreState type signature
**Risk:** The `Store<T>` interface in create-store.ts only exposes `getState`, `setState`, `subscribe`. Adding `restoreState` only to relation-store means the serializer's `stores.relations` parameter type must be widened. All other call sites that use `Store<RelationState>` (dialogue-manager, reputation-system) are unaffected since they don't need `restoreState`.

### requiresFullMode thresholds unchanged
**Not a risk:** `npc.initial_disposition` is a codex field (float -1..+1) used only for `requiresFullMode` mode detection and attitude label display. It is NOT the same as the store's `value` field. These thresholds are correctly calibrated for the codex scale and must NOT be changed.

### Existing test: endDialogue flushes delta
The test at `dialogue-manager.test.ts:290` asserts `disposition?.value !== 0` after a positive sentiment dialogue. With old scale: writes 0.2. With new scale: writes 10. Test still passes (value is non-zero). **No test update needed here**, but the test should ideally be strengthened to assert `disposition?.value === 10` — planner can add this.

### isQuestNpc English keyword bug (DIAL-02)
**Current state — dialogue-manager.ts line 21:**
```typescript
const QUEST_GOAL_KEYWORDS = ['investigate', 'find', 'recruit', 'discover', 'locate', 'uncover'];
```
Goals in YAML are likely Chinese (e.g., `protect_town`, `investigate_disappearances` from test fixtures use English). The test fixture NPC `npc_captain` has goals `['protect_town', 'investigate_disappearances']` in English, so the current keyword match works for test fixtures. But actual YAML codex entries use Chinese goals (per project's Chinese-first design principle). The fix per CONTEXT.md is to add Chinese keywords. **This fix is not explicitly listed in the decisions but is DIAL-02 in the requirements.** Planner must include this — add Chinese equivalents: `调查`, `寻找`, `招募`, `发现`, `定位`, `揭露`.

---

## Open Questions (RESOLVED)

1. **D-06 NL submission path for TextInput:** RESOLVED: Add `processPlayerFreeText(text: string)` to `DialogueManager` that routes to the NL processing branch of `processPlayerResponse`. Wire `onFreeTextSubmit` in game-screen to call `dialogueManager.processPlayerFreeText(text)`. This avoids touching game-screen-controller and keeps the NL path consistent with how dialogue responses are already handled. Covered in P03 Task 2.

2. **DIAL-02 Chinese keywords:** RESOLVED: Add Chinese keywords to `QUEST_GOAL_KEYWORDS`: `调查`, `寻找`, `找到`, `招募`, `发现`, `追踪`, `揭露`. Covered in P01 Task 2.

3. **Faction YAML entries:** RESOLVED: Add `faction: z.string().optional()` to `NpcSchema` (P01 Task 2). NPC YAML audit is INFO-level — faction field is optional so no YAML must be updated for code to work. NPCs without a faction field will simply skip the faction delta write in endDialogue.

---

## Sources

All findings are from direct inspection of source files in `/Users/makoto/Downloads/work/cli/src/`:
- `engine/reputation-system.ts` — lines 3-35
- `engine/dialogue-manager.ts` — full file
- `ui/panels/dialogue-panel.tsx` — full file
- `ai/utils/metadata-extractor.ts` — full file
- `ui/hooks/use-npc-dialogue.ts` — full file
- `state/relation-store.ts` — full file
- `state/dialogue-store.ts` — full file
- `state/serializer.ts` — full file
- `state/create-store.ts` — full file
- `codex/schemas/entry-types.ts` — full file (NpcSchema faction field absence confirmed)
- `engine/action-handlers/talk-handler.ts` — full file
- `engine/game-screen-controller.ts` — lines 160-241
- `ui/screens/game-screen.tsx` — lines 1-220
- Test files: reputation-system.test.ts, dialogue-manager.test.ts, relation-store.test.ts, serializer.test.ts

---

## RESEARCH COMPLETE
