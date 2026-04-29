# Plan: NPC knowledge_profile in npcs.yaml + dialogue-manager trust injection

**Phase**: 16 — Story Mainline & Narrative System
**Plan**: 16-P04
**Requirements**: D-17, D-18, D-19, D-20, D-06
**Depends on**: 16-P02 (NpcKnowledgeProfile type, updated buildNpcSystemPrompt signature)

## Goal

When this plan is complete, `npcs.yaml` has a `knowledge_profile` field on all story-relevant NPCs (王德, 老陈, 林婆婆, 月华, 瞎子孙, 阿鬼, 陈铁柱); `NpcSchema` in `entry-types.ts` accepts this optional field; `createDialogueManager` reads `npcDispositions.personalTrust` from the relation store, maps it to a 0-10 trust scale, and passes it as `trustLevel` to `buildNpcSystemPrompt`; and dialogue interactions with 月华 or 陈铁柱 during Stage 5 set the corresponding route-lock flag in `QuestProgress.flags`.

## Success Criteria

1. `bun run tsc --noEmit` passes with no new errors
2. `bun test src/engine/dialogue-manager.test.ts` — all tests pass including new trust-injection tests
3. YAML parse passes for `npcs.yaml` with `knowledge_profile` field
4. A `startDialogue` call for `npc_elder` with `npcDispositions.personalTrust = 90` (maps to > 8 on 0-10 scale) passes `trustLevel = 9` (or ≥ 9) to `buildNpcSystemPrompt`
5. A `startDialogue` call for `npc_elder` with no prior disposition passes `trustLevel = 0` (or < 5)
6. After `endDialogue` with `npc_captain` when `quest_main_01` is at `stage_allies_decision`, `QuestProgress.flags.justice_score_locked` is set to `true`

## Tasks

### Task 1: Add knowledge_profile to NpcSchema in entry-types.ts

**File**: `src/codex/schemas/entry-types.ts`
**Action**: Edit

Add `NpcKnowledgeProfileSchema` and optional `knowledge_profile` field to `NpcSchema`. The schema must be permissive enough to parse the YAML format (string arrays for `always_knows`/`hidden_knowledge`, and `trust_gates` as an array of `{ min_trust, reveals }`):

```typescript
export const NpcTrustGateSchema = z.object({
  min_trust: z.number().int().min(0).max(10),
  reveals: z.string(),
});

export const NpcKnowledgeProfileSchema = z.object({
  always_knows: z.array(z.string()).optional(),
  hidden_knowledge: z.array(z.string()).optional(),
  trust_gates: z.array(NpcTrustGateSchema).optional(),
});

// In NpcSchema, add:
export const NpcSchema = z.object({
  ...baseFields,
  type: z.literal("npc"),
  location_id: z.string(),
  personality_tags: z.array(z.string()),
  goals: z.array(z.string()),
  backstory: z.string(),
  initial_disposition: z.number().min(-1).max(1),
  faction: z.string().optional(),
  knowledge_profile: NpcKnowledgeProfileSchema.optional(),
});
```

Export `NpcTrustGate`, `NpcKnowledgeProfile` types alongside existing Npc type export.

### Task 2: Add knowledge_profile to story-relevant NPCs in npcs.yaml

**File**: `world-data/codex/npcs.yaml`
**Action**: Edit — add `knowledge_profile` field to 7 NPCs

Add `knowledge_profile` to each of the following. Keep all existing fields untouched.

**npc_elder (王德)**:
```yaml
knowledge_profile:
  always_knows:
    - 黑松镇日常事务和历史
    - 五年前狼灾的官方说法
  hidden_knowledge:
    - 五年前他与外来势力达成了秘密协议，用贡品换取狼灾平息
    - 现在同一势力卷土重来，索要更多利益
  trust_gates:
    - min_trust: 5
      reveals: 五年前的狼灾处理方式有些不寻常，他做了一些困难的决定
    - min_trust: 7
      reveals: 他知道失踪事件与五年前的某些旧事有关联
```

**npc_bartender (老陈)**:
```yaml
knowledge_profile:
  always_knows:
    - 镇上的日常消息和八卦
    - 酒馆里谁来谁往
  hidden_knowledge:
    - 他知道阿鬼的真实身份是暗影行会联络人
    - 他曾目睹五年前的一些异常交易往来
  trust_gates:
    - min_trust: 5
      reveals: 镇上某些人知道的比说出来的要多得多
    - min_trust: 7
      reveals: 阿鬼不只是个酒鬼，他背后有人，最近接到了新任务
```

**npc_priestess (月华)**:
```yaml
knowledge_profile:
  always_knows:
    - 古代符文的含义和历史
    - 神殿的日常事务
  hidden_knowledge:
    - 她三年前来黑松镇，是因为感知到了古代符文活动的回响
    - 她见过与洞穴中完全相同的符文——五年前，在另一个地方
  trust_gates:
    - min_trust: 5
      reveals: 她来黑松镇不是偶然的，是被某种力量引导而来
    - min_trust: 7
      reveals: 洞穴里的符文她认识——这不是第一次有人用它们了
```

**npc_beggar (瞎子孙)**:
```yaml
knowledge_profile:
  always_knows:
    - 镇上所有人的行踪和消息
    - 五年前失踪者的名字
  hidden_knowledge:
    - 阿福所谓的"债"是他当年在场见证了某笔交易后收到的封口费
    - 他知道那笔交易的另一方是谁
  trust_gates:
    - min_trust: 5
      reveals: 失踪的那些人，都问过同一件事
    - min_trust: 7
      reveals: 阿福的那笔账，和五年前有件事脱不了干系
```

**npc_captain (陈铁柱)**:
```yaml
knowledge_profile:
  always_knows:
    - 失踪案调查的现有进展
    - 守卫队的部署和巡逻情况
  hidden_knowledge:
    - 他一直怀疑有内鬼在阻挠他的调查，但还没查到是谁
  trust_gates:
    - min_trust: 5
      reveals: 他调查失踪案时，某些线索莫名其妙地消失了
    - min_trust: 7
      reveals: 他怀疑镇长知道的比说的多，但不愿意在没有证据时提出指控
```

**npc_shadow_contact (阿鬼)**:
```yaml
knowledge_profile:
  always_knows:
    - 地下势力在黑松镇的活动
    - 各方势力的把柄和筹码
  hidden_knowledge:
    - 他接到的命令是等待合适的人选，接管黑松镇的地下网络
    - 外来势力的身份和他们真正的目的
  trust_gates:
    - min_trust: 6
      reveals: 他最近有笔生意，需要一个不怕麻烦的合伙人
    - min_trust: 8
      reveals: 镇上正在发生的事和五年前一模一样，但这次有人想要的更多
```

**npc_herbalist (林婆婆)**:
```yaml
knowledge_profile:
  always_knows:
    - 北林草药分布和林中路径
    - 镇上的医疗需求
  hidden_knowledge:
    - 她年轻时曾是一个秘密组织的成员，那个组织专门守护古代遗址不被滥用
    - 她知道洞穴是禁地，但她没有阻止任何人，因为她已经老了
  trust_gates:
    - min_trust: 5
      reveals: 北林深处有些地方，她从不在天黑后靠近
    - min_trust: 7
      reveals: 洞穴里的东西，有些人曾经守护过它，后来不守了
```

### Task 3: Inject trust level into dialogue-manager + route-lock flag wiring

**File**: `src/engine/dialogue-manager.ts`
**Action**: Edit

**Trust level injection** in `startDialogue` and `processPlayerResponse`/`processPlayerFreeText`:

1. Before building `npcProfile`, read `personalTrust` from `stores.relation.getState().npcDispositions[npcId]?.personalTrust ?? 0`
2. Map the -100/+100 scale to 0-10: `const trustLevel = Math.round(Math.max(0, Math.min(10, (personalTrust + 100) / 20)))`
3. Include `knowledgeProfile` from the Npc codex entry if present (cast `npc.knowledge_profile` — it's now on the Npc type)
4. Pass both to `buildNpcSystemPrompt(npcProfile, trustLevel)` — update the `npcProfile` object and all three call sites

**Route-lock flag wiring** in `endDialogue`:

After the existing reputation delta apply block, check if we should lock a route score based on which NPC dialogue just ended and the current quest stage.

Make `quest` optional in the `stores` parameter to avoid breaking the existing `app.tsx` call site and the existing test fixtures, which do not pass a quest store:

```typescript
export function createDialogueManager(
  stores: {
    dialogue: Store<DialogueState>;
    npcMemory: Store<NpcMemoryState>;
    scene: Store<SceneState>;
    game: Store<GameState>;
    player: Store<PlayerState>;
    relation: Store<RelationState>;
    quest?: Store<QuestState>;  // optional — only needed for route-lock wiring
  },
  codexEntries: Map<string, CodexEntry>,
  options?: DialogueManagerOptions,
): DialogueManager {
```

The `tryLockRouteFlag` helper guards against the absent store:

```typescript
function tryLockRouteFlag(npcId: string, questStore: Store<QuestState> | undefined): void {
  if (!questStore) return;
  const progress = questStore.getState().quests['quest_main_01'];
  if (!progress || progress.currentStageId !== 'stage_allies_decision') return;

  if (npcId === 'npc_captain') {
    questStore.setState(draft => {
      const p = draft.quests['quest_main_01'];
      if (p) p.flags = { ...p.flags, justice_score_locked: true };
    });
  } else if (npcId === 'npc_shadow_contact') {
    questStore.setState(draft => {
      const p = draft.quests['quest_main_01'];
      if (p) p.flags = { ...p.flags, shadow_score_locked: true };
    });
  } else if (npcId === 'npc_elder') {
    questStore.setState(draft => {
      const p = draft.quests['quest_main_01'];
      if (p) p.flags = { ...p.flags, pragmatism_score_locked: true };
    });
  }
}
```

Call `tryLockRouteFlag(npcId, stores.quest)` at the start of `endDialogue` (before existing logic).

Write tests in `src/engine/dialogue-manager.test.ts`:
- `startDialogue` for `npc_elder` with `personalTrust = 90` calls `buildNpcSystemPrompt` with `trustLevel >= 9`
- `startDialogue` for `npc_elder` with no disposition entry calls `buildNpcSystemPrompt` with `trustLevel < 5`
- `endDialogue` with `npc_captain` while `quest_main_01` is at `stage_allies_decision` and `stores.quest` provided sets `justice_score_locked: true`
- `endDialogue` with `npc_bartender` during `stage_allies_decision` does NOT set any route flag
- `endDialogue` without `stores.quest` present does not throw (existing tests pass without regression)

### Task 4: Wire quest store into app.tsx createDialogueManager call

**File**: `src/app.tsx`
**Action**: Edit

Pass `quest: questStore` to the `stores` argument of `createDialogueManager`. The quest store was added to `app.tsx` in Phase 14 (available as `questStore` or via the game loop stores object). Update the `createDialogueManager` call site:

```typescript
const dialogueManager = createDialogueManager(
  {
    dialogue: stores.dialogue,
    npcMemory: stores.npcMemory,
    scene: stores.scene,
    game: stores.game,
    player: stores.player,
    relation: stores.relation,
    quest: stores.quest,  // added — enables route-lock flag wiring per D-06
  },
  codexEntries,
  options,
);
```

If the stores object in `app.tsx` uses a different field name for the quest store (e.g., `questStore` as a standalone variable rather than `stores.quest`), use whatever field name is present — the field is guaranteed to exist from Phase 14. Do not create a new quest store; reuse the existing one.

Write a smoke test or verify via `bun run tsc --noEmit` that the updated call site compiles cleanly with the now-required-but-was-optional `quest` field present.

## Tests

- [ ] `src/codex/schemas/entry-types.test.ts` or YAML smoke — `knowledge_profile` field parses correctly
- [ ] `src/engine/dialogue-manager.test.ts` — trust level mapping, route flag wiring, optional quest guard
- [ ] `bun run tsc --noEmit` clean

## Commit Message

`feat(16-P04): NPC knowledge_profile YAML + dialogue trust injection + route-lock flag wiring`
