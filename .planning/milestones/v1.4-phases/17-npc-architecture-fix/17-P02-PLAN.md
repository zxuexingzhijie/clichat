---
phase: "17"
plan: P02
type: fix
wave: 2
depends_on: [P01]
files_modified:
  - src/engine/rules-engine.ts
  - src/engine/rules-engine.test.ts
  - src/engine/dialogue-manager.ts
  - src/engine/dialogue-manager.test.ts
autonomous: true
requirements: [ARCH-02]
must_haves:
  truths:
    - "adjudicateTalkResult exists in rules-engine.ts and returns { relationshipDelta: number }"
    - "adjudicateTalkResult('positive') returns +10, 'neutral' returns 0, 'negative' returns -10, 'hostile' returns -20"
    - "dialogue-manager.ts no longer imports sentimentToDelta from reputation-system"
    - "both processPlayerResponse and processPlayerFreeText compute newRelationship via adjudicateTalkResult"
    - "NpcSentiment type is exported from npc-dialogue.ts"
  artifacts:
    - path: "src/engine/rules-engine.ts"
      provides: "adjudicateTalkResult pure function + TalkResult type"
      exports: ["adjudicateTalkResult", "TalkResult"]
    - path: "src/engine/rules-engine.test.ts"
      provides: "unit tests for adjudicateTalkResult covering all 4 sentiment values"
    - path: "src/engine/dialogue-manager.ts"
      provides: "both sentiment->delta sites replaced with adjudicateTalkResult"
      contains: "adjudicateTalkResult(npcDialogue.sentiment).relationshipDelta"
    - path: "src/ai/schemas/npc-dialogue.ts"
      provides: "exported NpcSentiment type"
  key_links:
    - from: "src/engine/dialogue-manager.ts"
      to: "src/engine/rules-engine.ts"
      via: "import { adjudicateTalkResult } from './rules-engine'"
      pattern: "adjudicateTalkResult"
    - from: "src/engine/rules-engine.ts"
      to: "src/engine/reputation-system.ts"
      via: "import { sentimentToDelta } from './reputation-system'"
      pattern: "sentimentToDelta"
---

<objective>
Fix ARCH-02: dialogue-manager.ts currently calls `sentimentToDelta(npcDialogue.sentiment)` directly at lines 487 and 595, meaning LLM output directly mutates game state without passing through the Rules Engine. This violates the core CLAUDE.md principle: "AI does NOT decide whether relationships change — the Rules Engine owns those decisions."

Purpose: Establish a clear boundary between LLM output (sentiment) and game state change (relationship delta). The Rules Engine adjudicates the delta; dialogue-manager consumes the adjudication result.
Output: adjudicateTalkResult in rules-engine.ts wraps sentimentToDelta. Both dialogue-manager.ts sites updated to call it. NpcSentiment exported for type safety.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/17-npc-architecture-fix/17-CONTEXT.md
@.planning/phases/17-npc-architecture-fix/17-PATTERNS.md
@.planning/phases/17-npc-architecture-fix/17-P01-SUMMARY.md

<interfaces>
<!-- Key types and contracts the executor needs. -->

From src/ai/schemas/npc-dialogue.ts:
```typescript
export const NpcDialogueSchema = z.object({
  dialogue: z.string().min(10).max(300),
  emotionTag: z.enum(['neutral', 'happy', 'angry', 'sad', 'fearful', 'amused', 'suspicious']),
  shouldRemember: z.boolean(),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'hostile']),
});
export type NpcDialogue = z.infer<typeof NpcDialogueSchema>;
// NpcSentiment not yet exported — add it
```

From src/engine/reputation-system.ts (lines 4-13):
```typescript
const SENTIMENT_DELTAS: Record<string, number> = {
  positive: 10,
  neutral: 0,
  negative: -10,
  hostile: -20,
};
export function sentimentToDelta(sentiment: string): number {
  return SENTIMENT_DELTAS[sentiment] ?? 0;
}
```

Current rules-engine.ts — only exports resolveAction. Add adjudicateTalkResult here:
```typescript
import { sentimentToDelta } from './reputation-system';
import type { NpcSentiment } from '../ai/schemas/npc-dialogue';

export type TalkResult = {
  readonly relationshipDelta: number;
};

export function adjudicateTalkResult(sentiment: NpcSentiment): TalkResult {
  return { relationshipDelta: sentimentToDelta(sentiment) };
}
```

Current dialogue-manager.ts import line 9:
```typescript
import { applyReputationDelta, applyFactionReputationDelta, sentimentToDelta } from './reputation-system';
```

Two sites to change (lines 487 and 595):
```typescript
// BEFORE (both sites):
const newRelationship = state.relationshipValue + sentimentToDelta(npcDialogue.sentiment);

// AFTER (both sites):
const talkResult = adjudicateTalkResult(npcDialogue.sentiment);
const newRelationship = state.relationshipValue + talkResult.relationshipDelta;
```

Analogy from adjudication.ts — pure function pattern (no side effects, typed params, typed return):
```typescript
export function resolveNormalCheck(params: CheckParams): CheckResult {
  // ... pure logic ...
  return { roll, grade, display, ... };
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add adjudicateTalkResult to rules-engine.ts and export NpcSentiment</name>
  <files>src/engine/rules-engine.ts, src/engine/rules-engine.test.ts, src/ai/schemas/npc-dialogue.ts</files>
  <behavior>
    - Test 1: adjudicateTalkResult('positive') returns { relationshipDelta: 10 }
    - Test 2: adjudicateTalkResult('neutral') returns { relationshipDelta: 0 }
    - Test 3: adjudicateTalkResult('negative') returns { relationshipDelta: -10 }
    - Test 4: adjudicateTalkResult('hostile') returns { relationshipDelta: -20 }
    - Test 5: adjudicateTalkResult return value has only the relationshipDelta field (no extra fields)
  </behavior>
  <action>
In src/ai/schemas/npc-dialogue.ts:

Add one export after the existing `NpcDialogue` type export:
```typescript
export type NpcSentiment = NpcDialogue['sentiment'];
```
This avoids duplicating the enum — infers the type from the existing schema.

In src/engine/rules-engine.ts:

1. Add these two imports at the top (after the existing imports):
   ```typescript
   import { sentimentToDelta } from './reputation-system';
   import type { NpcSentiment } from '../ai/schemas/npc-dialogue';
   ```

2. Add the TalkResult type and adjudicateTalkResult function at the end of the file:
   ```typescript
   export type TalkResult = {
     readonly relationshipDelta: number;
   };

   export function adjudicateTalkResult(sentiment: NpcSentiment): TalkResult {
     return { relationshipDelta: sentimentToDelta(sentiment) };
   }
   ```

In src/engine/rules-engine.test.ts:

Add a new describe block `'adjudicateTalkResult'` with the 5 tests from the behavior block:
```typescript
import { adjudicateTalkResult } from './rules-engine';
// ... tests
```
Add the import alongside the existing imports. Do NOT modify existing tests.
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/engine/rules-engine.test.ts --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <done>All existing rules-engine.test.ts tests pass. 5 new adjudicateTalkResult tests pass. NpcSentiment is exported from npc-dialogue.ts. TalkResult and adjudicateTalkResult are exported from rules-engine.ts.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Replace both sentimentToDelta calls in dialogue-manager.ts with adjudicateTalkResult</name>
  <files>src/engine/dialogue-manager.ts, src/engine/dialogue-manager.test.ts</files>
  <behavior>
    - Test 1: processPlayerResponse with sentiment 'positive' — relationshipValue in dialogue store increases by 10
    - Test 2: processPlayerResponse with sentiment 'hostile' — relationshipValue in dialogue store decreases by 20
    - Test 3: processPlayerFreeText with sentiment 'negative' — relationshipValue in dialogue store decreases by 10
    - Test 4: processPlayerFreeText with sentiment 'neutral' — relationshipValue in dialogue store unchanged (delta = 0)
    - Test 5: dialogue-manager does NOT directly call sentimentToDelta (import removed — TypeScript will enforce this at compile time; the test verifies behavioral correctness)
  </behavior>
  <action>
In src/engine/dialogue-manager.ts:

1. On line 9, remove `sentimentToDelta` from the reputation-system import:
   ```typescript
   // BEFORE:
   import { applyReputationDelta, applyFactionReputationDelta, sentimentToDelta } from './reputation-system';
   // AFTER:
   import { applyReputationDelta, applyFactionReputationDelta } from './reputation-system';
   ```

2. Add `adjudicateTalkResult` to the rules-engine imports. The file already imports from `'./adjudication'`. Add a new import line:
   ```typescript
   import { adjudicateTalkResult } from './rules-engine';
   ```

3. Line 487 — inside `processPlayerResponse`, replace:
   ```typescript
   const newRelationship = state.relationshipValue + sentimentToDelta(npcDialogue.sentiment);
   ```
   with:
   ```typescript
   const talkResult = adjudicateTalkResult(npcDialogue.sentiment);
   const newRelationship = state.relationshipValue + talkResult.relationshipDelta;
   ```

4. Line 595 — inside `processPlayerFreeText`, apply the same replacement as step 3.

In src/engine/dialogue-manager.test.ts:

Add a new describe block `'adjudicateTalkResult integration'` with the 4 behavioral tests (tests 1-4 from behavior block). Use the existing `mockGenerateNpcDialogue` mock — configure its return value per-test with `mockGenerateNpcDialogue.mockResolvedValueOnce(...)` using different sentiment values. Call `processPlayerResponse` or `processPlayerFreeText` and check `dialogueStore.getState().relationshipValue` after the call.

Test 5 (import enforcement) is verified implicitly by TypeScript compilation — if sentimentToDelta is still imported but unused, tsc will warn; if it is still called, the test suite catches the behavioral divergence.

Do NOT modify any existing dialogue-manager.test.ts tests.
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/engine/dialogue-manager.test.ts --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <done>All existing dialogue-manager.test.ts tests pass. 4 new adjudicateTalkResult integration tests pass. sentimentToDelta is no longer imported in dialogue-manager.ts. Both line 487 and line 595 use adjudicateTalkResult. TypeScript compile check passes with no new errors in changed files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| LLM output (sentiment) → Rules Engine | NPC sentiment string from LLM output crosses into game state adjudication |
| Rules Engine → dialogue-manager state | adjudicateTalkResult result applied to relationshipValue |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-17P02-01 | Tampering | LLM sentiment bypassing Rules Engine | mitigate | adjudicateTalkResult now sits between LLM output and state change; future conditional logic (reputation caps, quest flags) can be added here without touching callers |
| T-17P02-02 | Elevation of Privilege | LLM output directly mutating game state | mitigate | This is exactly the bug being fixed — adjudicateTalkResult enforces the "Rules Engine owns state changes" boundary from CLAUDE.md |
| T-17P02-03 | Tampering | Unknown sentiment value (LLM hallucinates outside enum) | accept | NpcDialogueSchema enforces z.enum validation before sentiment reaches adjudicateTalkResult; unknown values would fail schema validation and return fallback dialogue |
</threat_model>

<verification>
```bash
cd /Users/makoto/Downloads/work/cli
bun test src/engine/rules-engine.test.ts src/engine/dialogue-manager.test.ts --reporter=verbose
```

Confirm sentimentToDelta is gone from dialogue-manager imports:
```bash
cd /Users/makoto/Downloads/work/cli
grep "sentimentToDelta" src/engine/dialogue-manager.ts && echo "FAIL: still imported" || echo "PASS: removed"
```

Confirm adjudicateTalkResult is present at both sites:
```bash
cd /Users/makoto/Downloads/work/cli
grep -c "adjudicateTalkResult" src/engine/dialogue-manager.ts
```
Expected: 3 (1 import + 2 call sites)

Full suite regression check:
```bash
cd /Users/makoto/Downloads/work/cli
bun test --reporter=verbose 2>&1 | tail -5
```
</verification>

<success_criteria>
- `bun test src/engine/rules-engine.test.ts` — all tests pass including 5 new adjudicateTalkResult tests
- `bun test src/engine/dialogue-manager.test.ts` — all tests pass including 4 new integration tests
- `grep "sentimentToDelta" src/engine/dialogue-manager.ts` returns no matches
- `grep -c "adjudicateTalkResult" src/engine/dialogue-manager.ts` returns 3
- `NpcSentiment` exported from `src/ai/schemas/npc-dialogue.ts`
- `TalkResult` and `adjudicateTalkResult` exported from `src/engine/rules-engine.ts`
- Full `bun test` suite passes (same count as pre-change, no regressions)
- No new TypeScript errors in changed files
</success_criteria>

<output>
After completion, create `.planning/phases/17-npc-architecture-fix/17-P02-SUMMARY.md`
</output>
