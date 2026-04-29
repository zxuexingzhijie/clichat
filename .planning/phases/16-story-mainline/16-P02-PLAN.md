# Plan: AI Prompt Injection — Narrative Act Context + NPC Trust Disclosure

**Phase**: 16 — Story Mainline & Narrative System
**Plan**: 16-P02
**Requirements**: D-14, D-15, D-16, D-17, D-18, D-19, D-20
**Depends on**: 16-P01 (NarrativeState type)

## Goal

When this plan is complete, `buildNarrativeSystemPrompt` accepts narrative context (act + atmosphereTags + recentNarration) and injects per-act tone guidance into the system prompt; `buildNpcSystemPrompt` accepts a `trustLevel: number` parameter and generates a trust-gated disclosure paragraph based on the NPC's `knowledge_profile` from YAML. Both prompt builders remain fully backward-compatible — callers that omit the new parameters receive equivalent output to before. The `narrativeStore` state is wired into the actual call sites in `scene-manager.ts` and `dialogue-manager.ts` so the injected context is live, not dead code.

## Success Criteria

1. `bun run tsc --noEmit` passes with no new errors
2. `bun test src/ai/prompts/narrative-system.test.ts` — all tests pass
3. `bun test src/ai/prompts/npc-system.test.ts` — all tests pass
4. A call to `buildNarrativeSystemPrompt('exploration', { storyAct: 'act2', atmosphereTags: ['dread', 'urgency'] })` returns a string containing "第二幕" and both atmosphere tags
5. A call to `buildNpcSystemPrompt(npc, { trustLevel: 9, knowledgeProfile: { trust_gates: [{ min_trust: 8, reveals: '秘密内容' }] } })` returns a prompt containing "秘密内容"
6. A call to `buildNpcSystemPrompt(npc, { trustLevel: 3, knowledgeProfile: { trust_gates: [{ min_trust: 8, reveals: '秘密内容' }] } })` does NOT contain "秘密内容"
7. `generateNarration` calls in `scene-manager.ts` receive `narrativeContext` from `narrativeStore.getState()` when a `narrativeStore` is present
8. `generateNpcDialogue` calls in `dialogue-manager.ts` receive `narrativeContext` from `narrativeStore.getState()` when a `narrativeStore` is present

## Tasks

### Task 1: Extend buildNarrativeSystemPrompt with act-aware tone injection

**File**: `src/ai/prompts/narrative-system.ts`
**Action**: Edit

Add an optional second parameter `narrativeContext` to `buildNarrativeSystemPrompt`. When provided, inject a new paragraph after `CORE_CONSTRAINTS` with:
- current act number (第一幕/第二幕/第三幕)
- atmosphere tags joined by `、`
- per-act prose guidance (see below)
- if `recentNarration` provided, add: `最近叙述（保持语气和意象的连贯性，避免重复同一词语）：\n{recentNarration}`

```typescript
export type NarrativePromptContext = {
  readonly storyAct: 'act1' | 'act2' | 'act3';
  readonly atmosphereTags: readonly string[];
  readonly recentNarration?: readonly string[];
};

const ACT_TONE_GUIDANCE: Record<string, string> = {
  act1: '第一幕提示：场景是日常的，但有轻微不安。避免惊悚语气，保持克制。',
  act2: '第二幕提示：读者已知出了什么问题，但细节还不清楚。用悬疑和信息空缺制造张力。',
  act3: '第三幕提示：玩家掌握了真相。场景描述可带沉重感——同样的地方，已有不同的含义。',
};

export function buildNarrativeSystemPrompt(
  sceneType: SceneType,
  narrativeContext?: NarrativePromptContext,
): string {
  const config = SCENE_STYLES[sceneType];
  const base = `你是一个中文奇幻RPG游戏的叙述者。\n${CORE_CONSTRAINTS}\n- 视角：${config.perspective}\n- 风格：${config.style}`;

  if (!narrativeContext) return base;

  const actLabel = { act1: '第一幕', act2: '第二幕', act3: '第三幕' }[narrativeContext.storyAct];
  const atmosphereStr = narrativeContext.atmosphereTags.join('、');
  const toneGuidance = ACT_TONE_GUIDANCE[narrativeContext.storyAct] ?? '';

  const narrativeParagraph = `\n当前叙事氛围：${atmosphereStr}（用这些词语的语气和意象）\n故事进程：${actLabel}\n${toneGuidance}`;

  const recentSection = narrativeContext.recentNarration?.length
    ? `\n最近叙述（保持语气和意象的连贯性，避免重复同一词语）：\n${narrativeContext.recentNarration.slice(-3).join('\n')}`
    : '';

  return base + narrativeParagraph + recentSection;
}
```

Write tests in `src/ai/prompts/narrative-system.test.ts`:
- called without `narrativeContext` returns same result as original function (backward compat)
- called with `storyAct: 'act2'` includes "第二幕" and the act2 tone guidance string
- called with atmosphereTags includes them joined with `、`
- called with recentNarration includes the "避免重复" instruction and the lines
- called with empty recentNarration omits the recent section

### Task 2: Define NpcKnowledgeProfile type and extend NpcProfile

**File**: `src/ai/prompts/npc-system.ts`
**Action**: Edit

Add `NpcKnowledgeProfile` type and optional `knowledgeProfile` + `trustLevel` fields to `buildNpcSystemPrompt`. The function assembles a disclosure paragraph from the profile at the given trust level.

Trust thresholds per D-18:
- `trustLevel < 5`: only `always_knows` content, surface topics only
- `5 <= trustLevel <= 8`: `always_knows` + items in `trust_gates` where `min_trust <= trustLevel`
- `trustLevel > 8`: all of the above + `hidden_knowledge` items (partial truth, stated with hesitation)

Note on backward compatibility: the existing call sites in `dialogue-manager.ts` call `buildNpcSystemPrompt(npcProfile)` with no second argument. The new signature `buildNpcSystemPrompt(npc: NpcProfile, trustLevel: number = 0)` is backward-compatible — omitting the argument defaults to `trustLevel = 0`, which falls into the `< 5` branch (surface topics only, same behavior as before). `NpcProfile` here is the prompt-layer type defined in this file; `NpcSchema` in `entry-types.ts` is the codex-layer Zod schema. P04 adds `knowledge_profile` to `NpcSchema` and threads it into the `npcProfile` object passed to this function.

```typescript
export type NpcTrustGate = {
  readonly min_trust: number;
  readonly reveals: string;
};

export type NpcKnowledgeProfile = {
  readonly always_knows?: readonly string[];
  readonly hidden_knowledge?: readonly string[];
  readonly trust_gates?: readonly NpcTrustGate[];
};

export type NpcProfile = {
  readonly id: string;
  readonly name: string;
  readonly personality_tags: readonly string[];
  readonly goals: readonly string[];
  readonly backstory: string;
  readonly knowledgeProfile?: NpcKnowledgeProfile;
};

export function buildNpcSystemPrompt(npc: NpcProfile, trustLevel: number = 0): string {
  const base = `你扮演NPC "${npc.name}"。
性格特征：${npc.personality_tags.join('、')}
目标：${npc.goals.join('、')}
背景：${npc.backstory}

规则：
- 用符合角色性格的语气说话
- 只谈论你应该知道的事情
- 输出对白，不超过300字
- 不发明世界事实
- 不声明机械效果`;

  if (!npc.knowledgeProfile) return base;

  const profile = npc.knowledgeProfile;
  const disclosureLines: string[] = [];

  if (profile.always_knows?.length) {
    disclosureLines.push(`你可以自由谈论：${profile.always_knows.join('、')}`);
  }

  const unlockedGates = (profile.trust_gates ?? []).filter(g => trustLevel >= g.min_trust);
  if (unlockedGates.length) {
    disclosureLines.push(`基于当前信任度（${trustLevel}/10），你可以提及（但保持间接和不确认）：`);
    for (const gate of unlockedGates) {
      disclosureLines.push(`- ${gate.reveals}`);
    }
  }

  if (trustLevel > 8 && profile.hidden_knowledge?.length) {
    disclosureLines.push(`你内心知道但极度不愿承认（只在被逼到绝境时才透露，保持犹豫和回避）：`);
    for (const item of profile.hidden_knowledge) {
      disclosureLines.push(`- ${item}`);
    }
  }

  if (trustLevel < 5) {
    disclosureLines.push('当前信任度不足：只谈表面日常话题，回避任何追问。');
  }

  return base + '\n\n' + disclosureLines.join('\n');
}
```

Write tests in `src/ai/prompts/npc-system.test.ts`:
- called without `knowledgeProfile` returns same string as original (backward compat)
- `trustLevel = 3` with a gate at `min_trust: 5` does NOT include gate content
- `trustLevel = 6` with a gate at `min_trust: 5` DOES include gate content
- `trustLevel = 9` includes `hidden_knowledge` content
- `trustLevel = 9` includes "极度不愿承认" qualifier
- `trustLevel = 3` includes "回避" restriction text
- `always_knows` items always appear regardless of trust level

### Task 3: Wire narrativeStore into scene-manager.ts and dialogue-manager.ts call sites

**Files**: `src/engine/scene-manager.ts`, `src/engine/dialogue-manager.ts`
**Action**: Edit both

This task ensures the prompt extensions built in Tasks 1 and 2 are actually used at runtime per D-14. Without this wiring, `narrativeContext` is never passed to the generation functions and the act/atmosphere injection is dead code.

**In `src/engine/scene-manager.ts`**:

Also add `narrativeStore?: NarrativeStore` to the `SceneManagerOptions` type here (P05 will extend it further with override selection; defining the field in P02 avoids a tsc failure when P02 references `options?.narrativeStore` before P05 runs):

```typescript
import type { NarrativeStore } from '../state/narrative-state';

export type SceneManagerOptions = {
  readonly generateNarrationFn?: GenerateNarrationFn;
  readonly generateRetrievalPlanFn?: GenerateRetrievalPlanFn;
  readonly narrativeStore?: NarrativeStore;
};
```

Wherever `generateNarrationFn` is called, extract the current narrative state and pass it as `narrativeContext`:

```typescript
function getNarrativeContext(narrativeStore?: NarrativeStore): NarrativePromptContext | undefined {
  if (!narrativeStore) return undefined;
  const { currentAct, atmosphereTags } = narrativeStore.getState();
  return { storyAct: currentAct, atmosphereTags };
}
```

Update each `generateNarrationFn({...})` call in `loadScene` and `handleLook` (no-target branch) to include `narrativeContext: getNarrativeContext(options?.narrativeStore)`. The function signature for `GenerateNarrationFn` and `NarrativeContext` must accept the optional `narrativeContext` field — add it if not already present.

Import `NarrativeStore` from `../state/narrative-state` and `NarrativePromptContext` from `../ai/prompts/narrative-system`.

**In `src/engine/dialogue-manager.ts`**:

Add an optional `narrativeStore` field to `DialogueManagerOptions`:

```typescript
export type DialogueManagerOptions = {
  readonly generateNpcDialogueFn?: typeof generateNpcDialogue;
  readonly adjudicateFn?: (action: { type: string; target?: string }) => CheckResult;
  readonly narrativeStore?: NarrativeStore;
};
```

Import `NarrativeStore` from `../state/narrative-state`.

At each of the three `doGenerateDialogue(npcProfile, ...)` call sites (`startDialogue`, `processPlayerResponse`, `processPlayerFreeText`), pass the current narrative context as an additional argument. If `narrativeStore` is absent, pass `undefined` — the generation function must accept it as optional:

```typescript
const narrativeCtx = options?.narrativeStore
  ? (() => {
      const { currentAct, atmosphereTags } = options.narrativeStore.getState();
      return { storyAct: currentAct, atmosphereTags };
    })()
  : undefined;

const npcDialogue = await doGenerateDialogue(
  npcProfile,
  scene,
  playerAction,
  memoryStrings,
  { archiveSummary, relevantCodex, conversationHistory },
  narrativeCtx,  // new optional 6th argument
);
```

Note: `generateNpcDialogue` in `src/ai/roles/npc-actor.ts` must be updated to accept and forward the optional `narrativeContext` argument to `buildNpcSystemPrompt` — this is part of the same edit. If `generateNpcDialogue`'s signature already accepts extra context fields via an options object, thread it through that mechanism instead.

Write tests:
- `scene-manager` with a `narrativeStore` having `currentAct: 'act2'` passes `narrativeContext.storyAct === 'act2'` to `generateNarrationFn`
- `scene-manager` without `narrativeStore` passes `narrativeContext: undefined` to `generateNarrationFn`
- `dialogue-manager` with a `narrativeStore` passes `narrativeContext` to `doGenerateDialogue`
- `dialogue-manager` without `narrativeStore` passes no `narrativeContext` (existing tests pass without modification)

## Tests

- [ ] `src/ai/prompts/narrative-system.test.ts` — backward compat, act labels, atmosphere, recentNarration
- [ ] `src/ai/prompts/npc-system.test.ts` — trust threshold gates, hidden knowledge, always_knows, backward compat
- [ ] `src/engine/scene-manager.test.ts` — narrativeStore wiring passes context to generateNarrationFn
- [ ] `src/engine/dialogue-manager.test.ts` — narrativeStore wiring passes context to doGenerateDialogue

## Commit Message

`feat(16-P02): act-aware narrative prompt + NPC trust-gated disclosure + narrativeStore wiring in call sites`
