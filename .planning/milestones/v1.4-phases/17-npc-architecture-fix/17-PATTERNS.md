# Phase 17: NPC Architecture Fix — Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 4 new/modified files
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/ai/roles/npc-actor.ts` | AI role | request-response | `src/ai/prompts/narrative-system.ts` (context injection pattern) | exact |
| `src/ai/prompts/npc-system.ts` | prompt builder | request-response | `src/ai/prompts/narrative-system.ts` (optional context param) | exact |
| `src/engine/rules-engine.ts` | rules adjudicator | transform | `src/engine/adjudication.ts` (result-returning pure functions) | exact |
| `src/engine/dialogue-manager.ts` | orchestrator | event-driven | `src/engine/adjudication.ts` + `src/engine/reputation-system.ts` | role-match |

---

## Pattern Assignments

### `src/ai/prompts/npc-system.ts` — add `NpcPromptContext` optional param

**Bug:** `buildNpcSystemPrompt` already accepts `trustLevel` but has no `narrativeContext` param. Context from the active story act and atmosphere tags is never injected.

**Analog:** `src/ai/prompts/narrative-system.ts` lines 36–71 — exact pattern to replicate.

**Type declaration pattern** (`narrative-system.ts` lines 36–40):
```typescript
export type NarrativePromptContext = {
  readonly storyAct: 'act1' | 'act2' | 'act3';
  readonly atmosphereTags: readonly string[];
  readonly recentNarration?: readonly string[];
};
```
Define an analogous `NpcPromptContext` type (name TBD, but same shape concept — carry act + tags).

**Optional-context injection pattern** (`narrative-system.ts` lines 48–71):
```typescript
export function buildNarrativeSystemPrompt(
  sceneType: SceneType,
  narrativeContext?: NarrativePromptContext,
): string {
  // ...build base string...
  if (!narrativeContext) return base;

  const actLabel = { act1: '第一幕', act2: '第二幕', act3: '第三幕' }[narrativeContext.storyAct];
  const atmosphereStr = narrativeContext.atmosphereTags.join('、');
  const toneGuidance = ACT_TONE_GUIDANCE[narrativeContext.storyAct] ?? '';

  const narrativeParagraph = `\n当前叙事氛围：${atmosphereStr}（用这些词语的语气和意象）\n故事进程：${actLabel}\n${toneGuidance}`;
  return base + narrativeParagraph + recentSection;
}
```

**What to copy:** The exact guard (`if (!narrativeContext) return base`) and the string-append pattern. Add `narrativeContext?: NarrativePromptContext` as a third param to `buildNpcSystemPrompt` after the existing `trustLevel` param.

**What must change:** NPC context paragraph should be NPC-flavored, e.g. "当前氛围影响此角色的情绪基调：${atmosphereStr}" rather than the narrator's version. The `recentNarration` field is narrator-specific and should be omitted.

**Current signature** (`npc-system.ts` line 21):
```typescript
export function buildNpcSystemPrompt(npc: NpcProfile, trustLevel: number = 0): string {
```

**Target signature:**
```typescript
export function buildNpcSystemPrompt(
  npc: NpcProfile,
  trustLevel: number = 0,
  narrativeContext?: NarrativePromptContext,
): string {
```

---

### `src/ai/roles/npc-actor.ts` — fix `void narrativeContext` in `generateNpcDialogue`; add params to `streamNpcDialogue`

**Bug 1 — `generateNpcDialogue`** (line 26):
```typescript
// CURRENT — discards narrativeContext
const system = buildNpcSystemPrompt(npcProfile, trustLevel);
void narrativeContext;
```
Remove `void narrativeContext` and pass it as the third argument:
```typescript
const system = buildNpcSystemPrompt(npcProfile, trustLevel, narrativeContext);
```

**Bug 2 — `streamNpcDialogue`** (lines 54–86): signature is missing `narrativeContext` and `trustLevel` entirely.

**Current `streamNpcDialogue` signature** (lines 54–60):
```typescript
export async function* streamNpcDialogue(
  npcProfile: NpcProfile,
  scene: string,
  playerAction: string,
  memories: readonly string[],
  options?: NpcActorOptions,
): AsyncGenerator<string> {
  const config = getRoleConfig('npc-actor');
  const system = buildNpcSystemPrompt(npcProfile);
```

**Analog for the fix:** Mirror `generateNpcDialogue` (lines 15–23) which already has the correct 7-param shape:
```typescript
export async function generateNpcDialogue(
  npcProfile: NpcProfile,
  scene: string,
  playerAction: string,
  memories: readonly string[],
  options?: NpcActorOptions,
  narrativeContext?: NarrativePromptContext,
  trustLevel: number = 0,
): Promise<NpcDialogue> {
```

**What to copy:** Add `narrativeContext?: NarrativePromptContext` and `trustLevel: number = 0` to `streamNpcDialogue` in the same positions. Change `buildNpcSystemPrompt(npcProfile)` to `buildNpcSystemPrompt(npcProfile, trustLevel, narrativeContext)`.

---

### `src/engine/rules-engine.ts` — add `adjudicateTalkResult`

**Goal:** Move the `sentimentToDelta` call out of `dialogue-manager.ts` and into the rules engine as a pure adjudication function that returns a structured result.

**Analog — pure result-returning function pattern** (`src/engine/adjudication.ts` lines 23–39):
```typescript
export function resolveNormalCheck(params: CheckParams): CheckResult {
  const { roll, attributeName, attributeModifier, skillModifier, environmentModifier, dc } = params;
  const total = roll + attributeModifier + skillModifier + environmentModifier;
  const grade = gradeFromRoll(roll, total, dc);
  const display = buildDisplay(roll, attributeName, attributeModifier, total, dc, grade);

  return {
    roll,
    attributeName,
    attributeModifier,
    skillModifier,
    environmentModifier,
    total,
    dc,
    grade,
    display,
  };
}
```
Key traits to copy: typed params struct, typed return struct, no side effects, no imports from AI layer.

**Source of the delta logic** (`src/engine/reputation-system.ts` lines 4–13):
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
`adjudicateTalkResult` should call `sentimentToDelta` (do not duplicate the map) and wrap it in a typed result.

**What to add to `rules-engine.ts`:**
```typescript
import { sentimentToDelta } from './reputation-system';
import type { NpcSentiment } from '../ai/schemas/npc-dialogue';

export type TalkResult = {
  readonly relationshipDelta: number;
};

export function adjudicateTalkResult(sentiment: NpcSentiment): TalkResult {
  return {
    relationshipDelta: sentimentToDelta(sentiment),
  };
}
```
`NpcSentiment` is the union type inferred from `NpcDialogueSchema.shape.sentiment` — confirm via `src/ai/schemas/npc-dialogue.ts` line 7:
```typescript
sentiment: z.enum(['positive', 'neutral', 'negative', 'hostile'])
```
Export `NpcSentiment = z.infer<typeof NpcDialogueSchema>['sentiment']` from that schema file if not already exported.

---

### `src/engine/dialogue-manager.ts` — replace two `sentimentToDelta` calls with `adjudicateTalkResult`

**Analog:** `adjudication.ts` callers in `rules-engine.ts` (lines 19–27) show the consume pattern — call the rules function, destructure the result.

**Current pattern at lines 487 and 595:**
```typescript
const newRelationship = state.relationshipValue + sentimentToDelta(npcDialogue.sentiment);
```

**Target pattern (both sites):**
```typescript
import { adjudicateTalkResult } from './rules-engine';
// ...
const talkResult = adjudicateTalkResult(npcDialogue.sentiment);
const newRelationship = state.relationshipValue + talkResult.relationshipDelta;
```

Remove the `sentimentToDelta` import from `dialogue-manager.ts` import line 9:
```typescript
// REMOVE sentimentToDelta from this import:
import { applyReputationDelta, applyFactionReputationDelta, sentimentToDelta } from './reputation-system';
```

---

## Shared Patterns

### Optional-context guard
**Source:** `src/ai/prompts/narrative-system.ts` lines 58–70
**Apply to:** `buildNpcSystemPrompt` in `npc-system.ts`
```typescript
if (!narrativeContext) return base;
// ... build context paragraph ...
return base + contextParagraph;
```

### Pure adjudication result struct
**Source:** `src/engine/adjudication.ts` — every exported function
**Apply to:** `adjudicateTalkResult` in `rules-engine.ts`
Rule: no side effects, typed params, typed return, no LLM imports.

---

## No Analog Found

None. All four change sites have close analogs in the existing codebase.

---

## Metadata

**Analog search scope:** `src/ai/prompts/`, `src/ai/roles/`, `src/engine/`
**Files scanned:** 6
**Pattern extraction date:** 2026-04-30
