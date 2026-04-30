---
phase: "17"
plan: P01
type: fix
wave: 1
depends_on: []
files_modified:
  - src/ai/prompts/npc-system.ts
  - src/ai/prompts/npc-system.test.ts
  - src/ai/roles/npc-actor.ts
  - src/ai/roles/npc-actor.test.ts
autonomous: true
requirements: [ARCH-01]
must_haves:
  truths:
    - "buildNpcSystemPrompt with narrativeContext appends act/atmosphere paragraph to system prompt"
    - "buildNpcSystemPrompt without narrativeContext returns identical output to current behavior"
    - "generateNpcDialogue passes narrativeContext to buildNpcSystemPrompt instead of voiding it"
    - "streamNpcDialogue accepts and forwards trustLevel and narrativeContext"
  artifacts:
    - path: "src/ai/prompts/npc-system.ts"
      provides: "buildNpcSystemPrompt with optional 3rd param NarrativePromptContext"
      exports: ["buildNpcSystemPrompt", "NpcProfile", "NpcKnowledgeProfile"]
    - path: "src/ai/roles/npc-actor.ts"
      provides: "generateNpcDialogue and streamNpcDialogue with narrativeContext wired"
      contains: "buildNpcSystemPrompt(npcProfile, trustLevel, narrativeContext)"
    - path: "src/ai/prompts/npc-system.test.ts"
      provides: "tests for narrativeContext injection"
    - path: "src/ai/roles/npc-actor.test.ts"
      provides: "test confirming narrativeContext is forwarded"
  key_links:
    - from: "src/ai/roles/npc-actor.ts"
      to: "src/ai/prompts/npc-system.ts"
      via: "buildNpcSystemPrompt(npcProfile, trustLevel, narrativeContext)"
      pattern: "buildNpcSystemPrompt\\(npcProfile, trustLevel, narrativeContext\\)"
    - from: "src/ai/prompts/npc-system.ts"
      to: "src/ai/prompts/narrative-system.ts"
      via: "import type { NarrativePromptContext }"
      pattern: "NarrativePromptContext"
---

<objective>
Fix ARCH-01: narrativeContext is currently imported in npc-actor.ts but discarded with `void narrativeContext` at line 26, and buildNpcSystemPrompt has no parameter for it. This means the v1.3 act/atmosphere system has zero effect on NPC dialogue tone.

Purpose: NPC dialogue must reflect the current story act and atmosphere. An act3 NPC should speak with gravitas, not the same neutral tone as act1.
Output: buildNpcSystemPrompt gains an optional 3rd param that appends an act/atmosphere paragraph. npc-actor.ts forwards the param instead of voiding it. All existing callers without the 3rd arg are unaffected.
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

<interfaces>
<!-- Key types and contracts the executor needs. -->

From src/ai/prompts/narrative-system.ts (lines 36-40):
```typescript
export type NarrativePromptContext = {
  readonly storyAct: 'act1' | 'act2' | 'act3';
  readonly atmosphereTags: readonly string[];
  readonly recentNarration?: readonly string[];
};
```

Current buildNpcSystemPrompt signature (npc-system.ts line 21):
```typescript
export function buildNpcSystemPrompt(npc: NpcProfile, trustLevel: number = 0): string
```

Target signature:
```typescript
export function buildNpcSystemPrompt(
  npc: NpcProfile,
  trustLevel: number = 0,
  narrativeContext?: NarrativePromptContext,
): string
```

Optional-context guard pattern from narrative-system.ts (lines 58-70):
```typescript
if (!narrativeContext) return base;
const actLabel = { act1: '第一幕', act2: '第二幕', act3: '第三幕' }[narrativeContext.storyAct];
const atmosphereStr = narrativeContext.atmosphereTags.join('、');
// ... build paragraph and return base + paragraph
```

Current generateNpcDialogue bug (npc-actor.ts lines 25-26):
```typescript
const system = buildNpcSystemPrompt(npcProfile, trustLevel);
void narrativeContext;
```

Current streamNpcDialogue bug (npc-actor.ts lines 61-62):
```typescript
const system = buildNpcSystemPrompt(npcProfile);
// trustLevel and narrativeContext params are completely absent from signature
```

streamNpcDialogue current signature (lines 54-60):
```typescript
export async function* streamNpcDialogue(
  npcProfile: NpcProfile,
  scene: string,
  playerAction: string,
  memories: readonly string[],
  options?: NpcActorOptions,
): AsyncGenerator<string>
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend buildNpcSystemPrompt with optional narrativeContext param</name>
  <files>src/ai/prompts/npc-system.ts, src/ai/prompts/npc-system.test.ts</files>
  <behavior>
    - Test 1: buildNpcSystemPrompt(npc, 0, undefined) — output identical to buildNpcSystemPrompt(npc, 0) (backward compat)
    - Test 2: buildNpcSystemPrompt(npc, 0, { storyAct: 'act1', atmosphereTags: ['平静', '日常'] }) — output contains "当前故事阶段：act1"
    - Test 3: buildNpcSystemPrompt(npc, 0, { storyAct: 'act3', atmosphereTags: ['沉重', '真相'] }) — output contains "沉重、真相" and "请用符合当前氛围的语气说话"
    - Test 4: buildNpcSystemPrompt(npc, 0, { storyAct: 'act2', atmosphereTags: ['悬疑'] }) — act paragraph is appended AFTER existing trust-gate content, not replacing it
    - Test 5: buildNpcSystemPrompt(npcWithKnowledgeProfile, 6, { storyAct: 'act1', atmosphereTags: ['紧张'] }) — contains both trust-gate content AND act paragraph
  </behavior>
  <action>
In src/ai/prompts/npc-system.ts:

1. Add import at top of file:
   `import type { NarrativePromptContext } from './narrative-system';`

2. Change the function signature from:
   `export function buildNpcSystemPrompt(npc: NpcProfile, trustLevel: number = 0): string`
   to:
   `export function buildNpcSystemPrompt(npc: NpcProfile, trustLevel: number = 0, narrativeContext?: NarrativePromptContext): string`

3. The function currently returns either `base` (no knowledgeProfile) or `base + '\n\n' + disclosureLines.join('\n')` (with knowledgeProfile). After both return paths are resolved into a local variable, append the narrative paragraph when narrativeContext is present. Restructure the two early-return paths to assign to a local `result` string, then apply the guard at the end:

   ```typescript
   const result = !npc.knowledgeProfile
     ? base
     : base + '\n\n' + disclosureLines.join('\n');

   if (!narrativeContext) return result;

   const atmosphereStr = narrativeContext.atmosphereTags.join('、');
   const narrativeParagraph = `\n\n当前故事阶段：${narrativeContext.storyAct}\n氛围：${atmosphereStr}\n请用符合当前氛围的语气说话。`;
   return result + narrativeParagraph;
   ```

   Note: `storyAct` value is used as-is (act1/act2/act3) per CONTEXT.md decision. Do NOT translate to 第一幕 etc — CONTEXT.md specifies the raw act identifier in the prompt text.

In src/ai/prompts/npc-system.test.ts:

Add a new describe block `'buildNpcSystemPrompt — narrativeContext injection'` with the 5 tests described in the behavior block above. Do NOT modify existing tests — all existing tests must continue to pass unchanged.
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/ai/prompts/npc-system.test.ts --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <done>All existing npc-system.test.ts tests pass. 5 new narrativeContext tests pass. buildNpcSystemPrompt called without 3rd arg produces identical output to before the change.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fix npc-actor.ts — wire narrativeContext and add trustLevel to streamNpcDialogue</name>
  <files>src/ai/roles/npc-actor.ts, src/ai/roles/npc-actor.test.ts</files>
  <behavior>
    - Test 1: generateNpcDialogue called with narrativeContext — the `system` arg passed to callGenerateObject contains act/atmosphere text (spy on callGenerateObject and inspect the `system` field)
    - Test 2: generateNpcDialogue called without narrativeContext — callGenerateObject system arg does NOT contain "当前故事阶段" (backward compat)
    - Test 3: streamNpcDialogue called with trustLevel=7 and narrativeContext — callStreamText receives system prompt containing trust-gated content and act paragraph (verify trustLevel flows through by using an NPC with a trust gate at min_trust 5)
  </behavior>
  <action>
In src/ai/roles/npc-actor.ts:

1. In `generateNpcDialogue` (line 25-26): replace:
   ```typescript
   const system = buildNpcSystemPrompt(npcProfile, trustLevel);
   void narrativeContext;
   ```
   with:
   ```typescript
   const system = buildNpcSystemPrompt(npcProfile, trustLevel, narrativeContext);
   ```

2. In `streamNpcDialogue`: add `narrativeContext?: NarrativePromptContext` and `trustLevel: number = 0` to the function signature, in the same positions as `generateNpcDialogue` (after `options?`, before closing paren). Replace:
   ```typescript
   const system = buildNpcSystemPrompt(npcProfile);
   ```
   with:
   ```typescript
   const system = buildNpcSystemPrompt(npcProfile, trustLevel, narrativeContext);
   ```

In src/ai/roles/npc-actor.test.ts:

Add a new describe block `'narrativeContext forwarding'` with the 3 tests from the behavior block. The existing mock setup (mockGenerateObject, mock.module stubs) is already in place — reuse it. To inspect the system arg: `mockGenerateObject.mock.calls[0][0].system` (the first positional arg to generateObject is the options object; check via `expect(callArgs.system).toContain('当前故事阶段')`). For streamNpcDialogue, mock callStreamText similarly and inspect the passed system.

Do NOT modify the 3 existing tests in the file.
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/ai/roles/npc-actor.test.ts --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <done>All 3 existing npc-actor.test.ts tests pass. 3 new narrativeContext forwarding tests pass. The `void narrativeContext` line is deleted. streamNpcDialogue signature includes trustLevel and narrativeContext params.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| narrativeContext → system prompt | NarrativePromptContext fields (storyAct, atmosphereTags) flow into LLM system prompt text |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-17P01-01 | Tampering | atmosphereTags string injection | mitigate | atmosphereTags is a readonly string[] from narrativeStore (internal state, not user input); join with '、' does not cross trust boundary |
| T-17P01-02 | Information Disclosure | trust-gated NPC knowledge in system prompt | accept | System prompts are server-side only; not exposed to player UI output per CLAUDE.md security boundary |
</threat_model>

<verification>
```bash
cd /Users/makoto/Downloads/work/cli
bun test src/ai/prompts/npc-system.test.ts src/ai/roles/npc-actor.test.ts --reporter=verbose
```

All tests pass. Confirm no TypeScript errors in changed files:
```bash
cd /Users/makoto/Downloads/work/cli
bunx tsc --noEmit 2>&1 | grep -E "npc-system|npc-actor" || echo "no new errors"
```
</verification>

<success_criteria>
- `bun test src/ai/prompts/npc-system.test.ts` — all tests pass including 5 new narrativeContext tests
- `bun test src/ai/roles/npc-actor.test.ts` — all tests pass including 3 new forwarding tests
- `void narrativeContext` line is gone from npc-actor.ts
- `streamNpcDialogue` signature includes `narrativeContext?: NarrativePromptContext` and `trustLevel: number = 0`
- `buildNpcSystemPrompt(npc, 0)` called without 3rd arg produces identical output to pre-change
- No new TypeScript errors in the 2 modified source files
</success_criteria>

<output>
After completion, create `.planning/phases/17-npc-architecture-fix/17-P01-SUMMARY.md`
</output>
