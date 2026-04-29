# Phase 16: Story & Mainline Narrative — Research

**Researched:** 2026-04-29
**Domain:** CRPG narrative architecture, systemic narrative, LLM prompt engineering for narrative coherence, Chinese RPG story patterns
**Confidence:** HIGH (narrative design patterns), MEDIUM (specific LLM techniques), HIGH (implementation data structures via codebase inspection)

---

## Executive Summary

The existing Chronicle main quest (quest_main_01) is 3-stage scaffolding, not a story. It has no central theme, no moral weight, no dramatic escalation, and no connection between side quests and the main arc. The NPC backstories already contain the seeds of a rich story — the mayor knows the truth about a conspiracy, the herbalist guards forest secrets, the priestess arrived mysteriously, the shadow guild is watching — none of this is wired to the quest system.

The recommended approach draws from the two most instructive CRPG models: **Pillars of Eternity** (personal mystery + metaphysical horror + ambiguous moral choice, no clean good/evil) and **Disco Elysium** (world-state drives all narration tone; NPCs hold partial epistemic positions; the "villain" is systemic, not a single enemy). For a Chinese-context small-town mystery RPG, the thematic frame of **冤与复仇 — injustice cycles and the cost of burying truth** resonates with both xianxia tropes and the existing NPC backstories. The main quest should expand to 6 stages with a Tragic Mayor arc: the mayor covered up the first wolf disaster to protect the town's trade economy, which created the conditions for a second, worse disaster now. The player must choose between justice (expose the cover-up, destabilize the town) and pragmatism (help manage the crisis quietly, let the mayor hold power). Neither is clean.

**Primary recommendation:** Implement a `narrativeContext` object injected into every prompt that encodes `storyAct` (1–3), `atmosphereTags` (array), and `playerKnowledgeLevel` (0–5 clues known). The NarrativeDirector and NpcActor prompts should read these tags and shift tone accordingly — Act 1 is mundane mystery, Act 2 is dread + hidden agenda, Act 3 is confrontation + consequence. This requires zero new AI infrastructure; it is a prompt engineering change on top of existing systems.

---

## CRPG Narrative Architecture Patterns

### Pattern 1: Personal Stakes Before World Stakes [ASSUMED — training knowledge, not verified against primary sources]

The most effective CRPG narrative structures begin with a problem that directly and personally affects the player character before escalating to world-level stakes. This is why Planescape: Torment ("What can change the nature of a man?") lands harder than most high-fantasy "save the world" plots — the cosmic stakes are anchored in the protagonist's personal identity crisis. Baldur's Gate 1 uses the same structure: the dead foster father is a personal wound; the iron crisis and Bhaal's legacy are the escalating reveal.

**Application to 黑松镇:** The player arrives as an outsider seeking work/shelter. The town's problem becomes theirs because they get drawn into a local conflict with immediate personal stakes (they need the town's cooperation to survive, or they are falsely implicated in something). The cosmic-level reveal (the cover-up, the conspiracy, the second disaster incoming) must feel like a personal betrayal, not an abstract faction war.

### Pattern 2: The Three-Act Epistemic Journey [ASSUMED]

Disco Elysium and Pillars of Eternity both use a structure where the player's epistemic position (what they know, what they've confirmed, what they suspect) drives the narrative more than raw action. The "villain" is almost always someone the player has a relationship with before the reveal.

| Act | Player Epistemic State | NPC Disposition | Atmosphere |
|-----|----------------------|-----------------|------------|
| Act 1 | Everything is rumors and hunches | NPCs are helpful but evasive on certain topics | Mundane with unsettling undercurrents |
| Act 2 | Player holds confirmed partial truth; some NPCs know more than they admitted | NPCs start splitting — some become allies, some become obstacles | Dread, fragile alliances |
| Act 3 | Player holds the full truth; must decide what to do with it | NPCs react based on relationship history + what player knows | Confrontation, moral weight, no clean resolution |

This maps directly to the existing `PlayerKnowledgeEntry` system (statuses: `heard → suspected → confirmed`). The architecture already supports it; the story must be designed to exercise it.

### Pattern 3: NPCs as Epistemic Agents with Partial Views [ASSUMED]

In Disco Elysium, every NPC knows a different slice of the truth. Sylvie knows about the strike. Joyce knows about the mercenary contract. The Hardie Boys know about the body. No single NPC has the full picture. This is not a puzzle mechanic — it is a worldview statement: nobody has the full picture in real human situations either.

The existing Chronicle NPCs already have partial, non-overlapping knowledge:
- 王德 (mayor): knows the first wolf disaster was artificially triggered, knows who did it
- 老陈 (bartender): knows 阿鬼 (shadow contact), suspects something is wrong
- 林婆婆 (herbalist): knows the forest, guards secrets, was possibly in a secret organization
- 月华 (priestess): arrived 3 years ago mysteriously, understands ancient runes
- 瞎子孙 (blind beggar): claims blindness but knows everything — classic "oracle in disguise" figure

None of this epistemic network is wired to the quest system. The research recommendation is to use it.

### Pattern 4: Moral Choice Without Clear Good/Evil [ASSUMED]

Pillars of Eternity's best choices are not "good vs. evil" but "whose harm do you accept?" The Defiance Bay animancer crisis has no clean answer. Disco Elysium's political factions each represent a worldview that is partially coherent and partially self-serving.

For 黑松镇, the moral architecture should follow: the mayor covered up a conspiracy to protect the town's economic survival. He was not purely evil — he made a pragmatic choice under pressure. Now the same conditions are reproducing a second crisis. The player's choice: expose him (justice, but town economic instability, possible loss of the guard captain's loyalty), work with him to fix it secretly (stability, but the injustice is buried again, and the player becomes complicit), or find a third path by working with the shadow guild (the guild has leverage over the conspirators, but at a cost).

### Pattern 5: Five-Act Chinese Dramatic Structure (五幕式) [ASSUMED]

Classical Chinese narrative structure — especially prevalent in wuxia and xianxia — uses a different rhythm than Western three-act structure:

1. **引** (Prelude) — establish the world and protagonist's place in it
2. **起** (Inciting) — the wound that cannot be ignored
3. **承** (Complication) — the truth is deeper and more terrible than expected
4. **转** (Turn) — a revelation that reframes everything known so far
5. **合** (Resolution) — convergence, but not necessarily catharsis — often 遗憾 (regret) or 因果 (karmic consequence)

仙剑奇侠传 and 古剑奇谭 specifically avoid "hero wins, villain defeated" endings. The most memorable moments are 含冤 (unjust suffering), 牺牲 (sacrifice for others), and 执念 (obsessive attachment leading to tragedy). These resonate more strongly with Chinese players than Western triumphalist endings.

**Application:** The main quest resolution should not be "player defeats the bad guy and saves the town." It should be "player uncovers a tragedy rooted in human weakness and must decide what the truth is worth." The ideal ending leaves something unresolved — a character's guilt, a relationship damaged, a wound that doesn't fully heal.

### Pattern 6: Systemic Narrative — World State Drives All Narration [ASSUMED]

In Disco Elysium, the room descriptions change as you gather information. A body in a yard is described differently before and after you know who it is and who killed them. This is not scripted text swapping — it is a **narration layer that reads world state flags and adjusts prose accordingly**.

The key implementation principle: narration should feel different in Act 3 not because new events happen, but because the narrator (and the NPCs) now exist in a world where certain things are known. The tavern description in Act 1 is "warm, comfortable, the smell of pine." In Act 3, after learning the mayor covered up deaths, it becomes "the same warm fire, the same smell of pine — but now you know what this comfort cost."

---

## Recommended Story Framework for 黑松镇

### Central Theme
**隐瞒的代价 — The Price of What Is Buried**

A town's survival was bought with a lie. The lie is now compounding into a second disaster. Every major NPC is implicated in the cost of keeping that lie alive. The player is the only outsider who can see the full picture — and must decide whether truth or stability serves the people of 黑松镇 better.

### Dramatic Arc (Three Acts, Six Stages)

#### Act 1: 平静之下 (Beneath the Calm)
*Atmosphere tags: `mundane`, `curious`, `unsettled`*

**Stage 1: 初入黑松 (Arrival)**
- Trigger: `game_started` or character creation completion
- Revelation: Town is tense. People go missing. Guard captain is overworked. Mayor is publicly calm but privately agitated.
- NPC positions: All NPCs are in "surface mode" — helpful but not revealing secrets
- Side quest connection: quest_side_wolf_bounty activates here (阿虎 mentions something is driving wolves south — not natural behavior)
- Moral weight: None yet — player is just observing
- Key codex entries player can discover: `event_wolf_disaster` (public knowledge), `event_wolf_disaster_rumor` (from 老陈 after trust built)

**Stage 2: 谣言与消失 (Rumors and Disappearances)**
- Trigger: Player talks to 3+ NPCs OR enters 北林 once
- Revelation: The disappearances are not random. The victims are all connected — they were either asking questions about the first wolf disaster, or they had access to the mining route. The abandoned camp has signs of deliberate activity, not animal attack.
- NPC positions: 瞎子孙 drops hints that "the mayor knows more than he says." 林婆婆 becomes slightly evasive when asked about the forest.
- Side quest connection: quest_side_missing_ore — the mine route being blocked is not an accident; it was blocked deliberately by someone who doesn't want outsiders near the cave
- Moral weight: Player begins to feel something is wrong with the official story
- New locations unlocked: `loc_abandoned_camp` reveals deliberate campsite, not random bandit activity

#### Act 2: 隐患浮现 (The Hidden Danger Surfaces)
*Atmosphere tags: `dread`, `fractured_trust`, `urgency`*

**Stage 3: 林中真相 (Truth in the Forest)**
- Trigger: Enter `loc_dark_cave` AND have at least 2 confirmed knowledge entries about the disappearances
- Revelation: The cave contains ancient rune markings (月华 can identify them) — these are the same runes from 5 years ago. Someone has been using the cave as a site to conduct rituals that agitate the wolves. The current disappearances are not random — victims were lured here. The rune work requires knowledge of ancient arts AND logistical support inside the town.
- NPC positions: 月华 becomes a critical ally — she knows what the runes mean and is disturbed. She reveals she came to 黑松镇 specifically because she heard about the rune activity 3 years ago. 林婆婆, when confronted with evidence, admits she knew about the runes but was afraid to speak.
- Side quest connection: quest_side_overdue_debt — 瞎子孙 (the "debtor") is actually a former ritual participant who owes 阿福 money because 阿福 was paid to keep quiet about something he witnessed. The debt is not about money — it is about silence.
- Moral weight: The conspiracy has people the player has interacted with and trusted. First real betrayal.

**Stage 4: 镇长的秘密 (The Mayor's Secret)**
- Trigger: Confront 王德 with evidence from Stage 3 OR reach 阿鬼 via 老陈's introduction
- Revelation: 5 years ago, an outside faction (the shadow guild's parent organization) wanted to take over 黑松镇's mining routes. They sent a ritual practitioner to agitate the wolves as a show of force — "pay us tribute or the wolves come back worse." 王德 paid. He covered up the artificial nature of the disaster to avoid panic and to protect his deal. Now that same faction is back, wanting more, and using the same leverage. The new disappearances are their agents establishing control.
- NPC positions: 王德 is not a monster — he is a frightened old man who made a deal to protect his town and now cannot get out of it. 陈铁柱 (guard captain) does NOT know the truth. He has been investigating the disappearances genuinely and is close to the right answer — but he is loyal to 王德 and will be devastated.
- Side quest connection: quest_side_wolf_bounty — killing the wolves is a bandage, not a cure. Alerted that wolves will keep coming as long as the ritual site is active.
- Moral weight: The player now holds information that will destroy someone's reputation and destabilize the town's governance, but withholding it means the crisis continues.

#### Act 3: 抉择之时 (The Hour of Choice)
*Atmosphere tags: `confrontation`, `grief`, `weight_of_truth`*

**Stage 5: 盟友与决断 (Allies and Decision)**
- Trigger: Player has spoken to 月华, 陈铁柱, and either 老陈 or 阿鬼 about what they know
- Revelation: Three viable paths crystallize:
  1. **义之道 (Path of Justice)**: Expose everything to 陈铁柱. He will arrest 王德, destabilize the guard, and the town will face a power vacuum — but the shadow guild's leverage is removed. Cost: 陈铁柱 is broken by the betrayal of someone he respected. Town is vulnerable short-term.
  2. **和之道 (Path of Pragmatism)**: Work secretly with 王德 to neutralize the ritual site and drive out the shadow guild operatives without exposing the cover-up. Cost: The injustice is buried again. The victims of the disappearances get no official acknowledgment. 瞎子孙 dies knowing no one spoke for him.
  3. **暗之道 (Path of Shadow)**: Let 阿鬼 broker a deal — the shadow guild will clean up their own rogue operatives in exchange for a permanent foothold in the town (not as destroyers, but as a stable underground presence). Cost: The town becomes permanently entangled with the underworld.
- NPC positions: Each NPC reacts differently to what the player knows and who they've trusted
- Moral weight: The highest. All three paths have real costs.

**Stage 6: 因果 (Karmic Consequence)**
- Trigger: Player completes the action in Stage 5 (confrontation, covert operation, or deal)
- Revelation: The immediate crisis is resolved, but the world has changed. Each ending plays out its consequences:
  - Justice path: 陈铁柱 is seen weeping quietly after 王德's arrest. 红姐 (innkeeper) thanks the player, then admits she always suspected but was afraid. The town survives but is quieter, sadder.
  - Pragmatism path: 王德 publicly thanks the player for "dealing with bandits." 月华 looks at the player and says nothing. 瞎子孙 is not seen again.
  - Shadow path: 阿鬼 buys the player a drink. He says: "You did what this town needed. Whether it knows it or not."
- No path ends with triumph. All paths end with 遗憾.

### Side Quest Weave Summary

| Side Quest | Main Quest Connection | When It Connects |
|------------|----------------------|-----------------|
| quest_side_wolf_bounty | Wolves are symptoms of ritual activity; bounty is a distraction from root cause | Stage 3 reveal makes this explicit |
| quest_side_missing_ore | Mine route was deliberately blocked to keep outsiders from finding the cave | Stage 2: blockage is revealed as deliberate |
| quest_side_overdue_debt | Debt is hush money; 瞎子孙 witnessed the original deal | Stage 4: 瞎子孙 becomes key witness |
| (Optional) Shadow recruitment | 阿鬼 recruits only players who are morally flexible; Stage 3+ unlocks contact | Ongoing from Stage 2 if player visits tavern at night |

---

## Prompt Engineering for Narrative Coherence

### Core Technique: Inject `narrativeContext` into Every Prompt

The current prompt system passes `sceneType` to the NarrativeDirector. This is insufficient. The narrator cannot generate coherent atmospheric escalation without knowing where the player is in the story.

Add a `narrativeContext` object to every prompt call:

```typescript
// Extend NarrativeContext in narrative-director.ts
type NarrativeContext = {
  readonly sceneType: SceneType;
  readonly codexEntries: ReadonlyArray<...>;
  readonly checkResult?: { readonly display: string };
  readonly playerAction: string;
  readonly recentNarration: readonly string[];
  readonly sceneContext: string;
  // NEW fields:
  readonly storyAct: 1 | 2 | 3;
  readonly atmosphereTags: readonly string[];
  readonly playerKnowledgeLevel: 0 | 1 | 2 | 3 | 4 | 5; // 0=nothing, 5=full truth
  readonly activeQuestStage?: string; // e.g. "stage_investigate"
};
```

### System Prompt Template: Act-Aware Narration

Replace the current `buildNarrativeSystemPrompt` with an act-aware version:

```
你是《黑松镇》中文奇幻RPG的叙述者。

叙述规则：
- 输出80-180个中文字符
- 只描述已发生的事件结果，不发明世界事实
- 不声明任何机械效果（获得物品、HP变化等）
- 视角：{perspective}
- 风格：{style}

当前叙事氛围：{atmosphereTags}（用这些词语的语气和意象）
故事进程：第{storyAct}幕 / 玩家知情程度：{playerKnowledgeLevel}/5

第一幕提示：场景是日常的，但有轻微不安。避免惊悚语气。
第二幕提示：读者知道出了什么问题，但细节还不清楚。用悬疑和信息空缺制造张力。
第三幕提示：玩家掌握了真相。场景描述可以带着沉重感——同样的地方，已有不同的含义。
```

### Technique: Atmosphere Tags System

Define a controlled vocabulary of atmosphere tags that the quest system injects:

```yaml
# In quests.yaml, add per-stage atmosphereTags
stages:
  - id: stage_rumor
    atmosphereTags: [mundane, curious, unsettled]
  - id: stage_investigate
    atmosphereTags: [dread, mystery, urgency]
  - id: stage_expose
    atmosphereTags: [confrontation, grief, weight_of_truth]
```

The narrative system prompt reads these tags and uses them as stylistic constraints. The LLM does not invent the atmosphere — it is told what register to operate in.

### Technique: NPC Epistemic Position Injection

The current `buildNpcSystemPrompt` gives NPCs their backstory but does NOT tell them what they currently know vs. what they are hiding. Add:

```
你扮演NPC "{name}"。
性格特征：{personality_tags}
目标：{goals}
背景：{backstory}

你当前知道但不愿公开的事情：{hidden_knowledge}
你当前愿意告诉玩家的事情（基于信任度{trust_level}/10）：
- trust < 3: 只谈表面日常话题，回避追问
- trust 3-6: 可以提到谣言和间接线索，但不确认
- trust > 6: 可以透露你知道的部分真相，但保持犹豫
```

This requires the `NpcProfile` type to include `hiddenKnowledge` and the prompt to receive a `trustLevel` from the reputation system (which already exists).

### Technique: Recent Narration Continuity Guard

The current system passes `recentNarration` (last 3 lines) to the prompt. Add a **continuity instruction**:

```
最近叙述（保持语气和意象的连贯性，避免重复同一词语）：
{recentNarration}
```

The instruction "avoid repeating the same word" is a simple but effective anti-repetition constraint that LLMs respond well to.

### Technique: Emotional Beat Anchors

For key story moments (Stage 4 reveal, Stage 6 ending), define **emotional beat anchors** in the quest YAML that are injected as mandatory prose constraints:

```yaml
stages:
  - id: stage_expose
    emotional_anchor: "这一刻，什么东西在心里安静地碎了。"  # inject as "结尾提示"
    atmosphereTags: [confrontation, grief]
```

The prompt template adds: `（叙述结尾请体现这种感受：{emotional_anchor}）`

This anchors key moments without scripting them — the LLM still generates the path to the anchor, but the emotional landing is controlled.

---

## World-State Driven Narration Data Structures

### Narrative State Object

Add a `narrativeState` to the game persistence layer (alongside existing game state):

```typescript
// New: src/state/narrative-state.ts
export const NarrativePhaseSchema = z.enum(['act1', 'act2', 'act3']);

export const NarrativeStateSchema = z.object({
  currentAct: NarrativePhaseSchema.default('act1'),
  atmosphereTags: z.array(z.string()).default(['mundane', 'curious']),
  playerKnowledgeLevel: z.number().int().min(0).max(5).default(0),
  activeEmotionalAnchor: z.string().nullable().default(null),
  worldFlags: z.record(z.string(), z.boolean()).default({}),
});
export type NarrativeState = z.infer<typeof NarrativeStateSchema>;
```

**worldFlags** is the key field. It is a boolean map of significant world state changes:

```typescript
// Example worldFlags after Act 2 completion:
{
  "mayor_secret_known": true,
  "cave_runes_identified": true,
  "ritual_site_active": true,
  "shadow_guild_contacted": false,
  "guard_captain_investigating": true,
}
```

These flags are injected into narration prompts to give the narrator situational awareness without stuffing full quest logs into the context window.

### Location Description Override System

Locations should support `description_overrides` keyed by world flag:

```yaml
# In locations.yaml
- id: loc_tavern
  name: 黑松镇·酒馆
  description: 松木桶酒馆。温暖的炉火，嘈杂的人声。
  description_overrides:
    mayor_secret_known: "松木桶酒馆。炉火还是一样地烧着，但你知道这份暖意是用什么换来的。"
    ritual_site_active: "松木桶酒馆。人声比平时少了——又有人昨晚没回来。"
    act3_confrontation: "松木桶酒馆。老陈擦着杯子，不看你。每个人都在等。"
```

The `loc:look` handler checks `worldFlags` against these overrides and picks the most specific matching description. This requires no new AI call — it is deterministic text selection.

### Quest Stage → Narrative State Transition Map

Define in a new `narrative-transitions.yaml` how quest stage advances trigger narrative state changes:

```yaml
transitions:
  - on_stage: stage_investigate
    set_act: act1
    set_atmosphere: [mundane, curious, unsettled]
    set_knowledge_level: 1

  - on_stage: stage_truth_in_forest
    set_act: act2
    set_atmosphere: [dread, mystery, urgency]
    set_knowledge_level: 2
    set_world_flags:
      ritual_site_active: true

  - on_stage: stage_mayor_secret
    set_act: act2
    set_atmosphere: [dread, fractured_trust]
    set_knowledge_level: 3
    set_world_flags:
      mayor_secret_known: true

  - on_stage: stage_allies_decision
    set_act: act3
    set_atmosphere: [confrontation, grief, weight_of_truth]
    set_knowledge_level: 4

  - on_stage: stage_consequence
    set_act: act3
    set_atmosphere: [consequence, regret]
    set_knowledge_level: 5
```

The quest system already emits `quest_stage_advanced` events. A new `NarrativeDirectorOrchestrator` subscribes to these events and updates `narrativeState` accordingly. No polling, no scanning — it is event-driven.

### NPC Knowledge Profile Extensions

Each NPC YAML entry should gain a `knowledge_profile` section:

```yaml
# In npcs.yaml
- id: npc_elder
  name: 镇长·王德
  ...
  knowledge_profile:
    always_knows:
      - "黑松镇的日常事务"
      - "五年前的表面历史"
    hidden_until:
      - flag: mayor_secret_known
        reveals: "五年前的狼灾真相：他曾与外来势力达成秘密协议"
      - flag: shadow_guild_contacted
        reveals: "他知道玩家已与暗影行会联系"
    trust_thresholds:
      - level: 3
        unlocks: "关于北林'有点不寻常'的含糊暗示"
      - level: 7
        unlocks: "五年前他'做了一个艰难的决定'"
      - level: 9
        unlocks: "完整的真相——只有在被逼到绝境时"
```

The `buildNpcSystemPrompt` then assembles what the NPC currently knows/can reveal based on `worldFlags` and `trustLevel`.

---

## Implementation Recommendations

### What to Build

| Component | Priority | Description |
|-----------|----------|-------------|
| `narrativeState` store | HIGH | New Zod schema + store in `src/state/narrative-state.ts`. Tracks act, atmosphere, worldFlags. |
| Expanded `quest_main_01` | HIGH | 6-stage quest YAML with atmosphereTags, emotional_anchors, narrative transition triggers |
| `narrative-transitions.yaml` | HIGH | Maps quest stage events to narrative state changes |
| `buildNarrativeSystemPrompt` update | HIGH | Inject storyAct + atmosphereTags into system prompt |
| `buildNpcSystemPrompt` update | HIGH | Add hiddenKnowledge + trustLevel-gated disclosure |
| `description_overrides` in locations.yaml | MEDIUM | Per-flag location description overrides |
| `knowledge_profile` in npcs.yaml | MEDIUM | Per-NPC hidden knowledge + trust threshold gates |
| NarrativeState event subscriber | MEDIUM | Listens to `quest_stage_advanced`, updates narrativeState |

### What NOT to Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| NPC memory of player choices | Custom conversation history | Existing `npc-memory-store.ts` + `addMemory()` |
| "What does the player know?" | Custom knowledge tracking | Existing `player-knowledge-store.ts` + `KnowledgeStatus` |
| Act transition logic | Custom act engine | Event-driven: `quest_stage_advanced` → update `narrativeState` |
| Quest branching | Custom branch engine | Existing `QuestProgress.flags` record — store choice flags there |
| NPC trust levels | Custom relationship system | Existing `reputation-system.ts` + `relation_delta` in quest rewards |
| Narrative continuity | Custom summarizer | Existing `memory-summarizer.ts` role |

### Why Not Full Dynamic Narration for Location Overrides

The location `description_overrides` approach (deterministic flag-matched text) is recommended over "generate a fresh narration every `:look`" because:
1. Consistency: the same location in Act 3 always has the same haunting tone, not a lottery of LLM outputs
2. Cost: no LLM call on `:look` — just a string lookup
3. Authorial control: the emotional landing of key moments should be authored, not generated

Use LLM narration for **actions** (combat, dialogue consequences, exploration events). Use authored text for **passive scene atmosphere**.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pillars of Eternity uses personal mystery → metaphysical horror → moral choice arc | CRPG Patterns | Low — general shape is well-documented; specific mechanic details may differ |
| A2 | Disco Elysium uses world-state flags to change narration tone across same location | CRPG Patterns | Low — core mechanic is publicly described; implementation details assumed |
| A3 | Chinese RPG (仙剑/古剑) favor 遗憾 endings over triumphalist endings | CRPG Patterns / Story Framework | Medium — genre preference, not universal. Player reception may vary. |
| A4 | Five-幕式 structure maps to Chinese dramatic tradition | Story Framework | Low — common in game design discourse for Chinese CRPGs |
| A5 | LLM atmosphere tags injection reliably shifts prose tone | Prompt Engineering | Medium — needs testing; specific Chinese-language models may vary |
| A6 | "Avoid repeating the same word" constraint helps anti-repetition in Chinese LLM output | Prompt Engineering | Medium — effective in English LLMs; Chinese models may handle differently |

---

## Open Questions

1. **Quest branching persistence**
   - What we know: `QuestProgress.flags` is a `z.record(z.string(), z.unknown())` — it can store branch choices
   - What's unclear: There is no mechanism to take a player's branch choice in Stage 5 and route them to a different Stage 6 variant. The current quest engine advances linearly by `nextStageId`.
   - Recommendation: Add `conditional_next_stages` to `QuestStageSchema` — an array of `{condition: flag_key, nextStageId}` evaluated in order before falling back to `nextStageId`. This is a small schema change with large narrative impact.

2. **Trust level source for NPC prompts**
   - What we know: `reputation-system.ts` tracks faction and NPC reputation deltas
   - What's unclear: The `buildNpcSystemPrompt` does not currently receive a trust/reputation value. It needs to be threaded from the reputation store through the action handler to the prompt builder.
   - Recommendation: Add `trustLevel: number` to `NpcProfile` type, computed from reputation store at dialogue time.

3. **Stage 5 player choice mechanics**
   - What we know: The three paths (Justice, Pragmatism, Shadow) require the player to take different actions
   - What's unclear: How does the system know which path the player chose? Options: (a) specific dialogue choices trigger flags, (b) visiting specific locations/NPCs triggers flags, (c) explicit `:choose justice|pragmatism|shadow` command
   - Recommendation: Use (b) — path is determined by which NPC the player talks to last before Stage 6: talking to 陈铁柱 first → justice path; talking to 王德 first → pragmatism path; talking to 阿鬼 → shadow path. No special UI needed.

4. **Emotional anchor injection**
   - What we know: The narrative prompt currently passes `sceneContext` and `playerAction`
   - What's unclear: Whether injecting emotional anchors ("结尾请体现这种感受：X") reliably produces them vs. having the LLM ignore or distort them
   - Recommendation: Test with the existing narrative role before committing to it. Alternative: use emotional anchors as post-generation validation — if the generated text does not contain certain sentiment markers, retry once.

---

## Sources

### Primary (HIGH confidence — codebase inspection)
- `/Users/makoto/Downloads/work/cli/src/ai/prompts/narrative-system.ts` — current prompt structure
- `/Users/makoto/Downloads/work/cli/src/ai/prompts/npc-system.ts` — NPC prompt structure
- `/Users/makoto/Downloads/work/cli/world-data/codex/quests.yaml` — existing quest data
- `/Users/makoto/Downloads/work/cli/world-data/codex/npcs.yaml` — NPC roster with backstories
- `/Users/makoto/Downloads/work/cli/world-data/codex/locations.yaml` — location data
- `/Users/makoto/Downloads/work/cli/world-data/codex/history_events.yaml` — world history
- `/Users/makoto/Downloads/work/cli/world-data/codex/factions.yaml` — faction data
- `/Users/makoto/Downloads/work/cli/src/state/player-knowledge-store.ts` — knowledge tracking infrastructure
- `/Users/makoto/Downloads/work/cli/src/state/quest-store.ts` — quest state and events

### Secondary (ASSUMED — training knowledge, tagged throughout)
- CRPG narrative design: Pillars of Eternity, Disco Elysium, Planescape: Torment, Baldur's Gate patterns — general knowledge, not verified against primary design documents
- Chinese RPG (仙剑奇侠传, 古剑奇谭) narrative conventions — general knowledge of series structure and common fan/critic discourse; not verified against primary design documents or academic sources
- LLM prompt engineering for narrative coherence — general knowledge of techniques; effectiveness in Chinese-language models not empirically verified in this session

### Not Verified
- No web searches or official design documents fetched (network restricted). All CRPG pattern claims are [ASSUMED] from training knowledge. The recommended story structure and implementation approach are grounded in the codebase (HIGH confidence) but the narrative theory citations are [ASSUMED].

---

## Metadata

**Confidence breakdown:**
- Recommended story framework: HIGH — derived from existing NPC backstories; every plot point uses something already in the codex
- CRPG narrative patterns: MEDIUM — correct in shape, details are [ASSUMED] without primary source verification
- Prompt engineering techniques: MEDIUM — plausible, but Chinese LLM behavior needs testing
- Data structure recommendations: HIGH — designed around existing schemas that were read directly

**Research date:** 2026-04-29
**Valid until:** 2026-07-01 (story and world design is stable; LLM technique guidance may evolve)
