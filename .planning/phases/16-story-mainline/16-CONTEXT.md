# Phase 16: Story Mainline & Narrative System - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

扩展主线剧情至6阶段完整故事弧线，同时构建支撑叙事动态变化的基础设施：narrativeState 存储、AI 提示词注入、NPC 信任度分级信息公开、场所描述世界状态覆盖。

**本阶段交付：**
- quest_main_01 从 3 阶段扩展为 6 阶段，3 条结局路线
- 支线任务与主线叙事逻辑绑定
- narrativeState 独立 store（storyAct / atmosphereTags / worldFlags）
- buildNarrativeSystemPrompt 和 buildNpcSystemPrompt 注入叙事状态
- NPC 信任度阈值控制信息披露
- locations.yaml 增加 description_overrides 字段

**不包含：** 多人、新 UI 组件、新地图区域、AI 动态生成场所描述（用确定性文本替换）

</domain>

<decisions>
## Implementation Decisions

### 主线故事结构
- **D-01:** 主题：「隐瞒的代价」—— 镇长王德 5 年前与外来势力秘密交易，掩盖了第一次狼灾真相；现在同一势力卷土重来，玩家是唯一能看清全局的外来者
- **D-02:** 叙事结构：三幕六阶段
  - Act 1（平静之下）：Stage 1「初入黑松」/ Stage 2「谣言与消失」
  - Act 2（隐患浮现）：Stage 3「林中真相」/ Stage 4「镇长的秘密」
  - Act 3（抉择之时）：Stage 5「盟友与决断」/ Stage 6「因果」
- **D-03:** 所有 6 个阶段只使用现有 NPC 和地点，不新增角色或地图区域
- **D-04:** 三幕对应 atmosphereTags：
  - Act 1: `[mundane, curious, unsettled]`
  - Act 2: `[dread, fractured_trust, urgency]`
  - Act 3: `[confrontation, grief, weight_of_truth]`

### 结局路线系统
- **D-05:** Stage 5 提供 3 条结局路线：义之道（陈铁柱/揭露）/ 和之道（王德/秘密压制）/ 暗之道（阿鬼/引入地下势力）
- **D-06:** 路线选择机制：双层实现
  1. 前期行为积累路线分数 + flags（访问特定地点、帮特定 NPC、接触特定人物）
  2. Stage 5 三条路线全部开放；玩家与哪个 NPC 完成「路线确认对话」则走哪条路
  3. 路线分数影响 NPC 台词内容（倾向越高台词越自然顺畅），但不强制锁定
- **D-07:** 三条结局都不是胜利结局，所有路线以「遗憾」（遗憾/因果）收尾，符合仙剑风格

### 支线主线绑定
- **D-08:** quest_side_wolf_bounty — 猎狼只是治标；Stage 3 后揭示狼群异常来自祭祀地，悬赏成为「真相的掩护」
- **D-09:** quest_side_missing_ore — 矿路被故意封锁以阻止外人发现洞穴；Stage 2 后矿路封锁指向主线
- **D-10:** quest_side_overdue_debt — 瞎子孙的「债」是封口费；Stage 4 后瞎子孙成为关键证人

### narrativeState 存储
- **D-11:** 独立 Zod schema + store，路径：`src/state/narrative-state.ts`
- **D-12:** 随 save/load 持久化（加入 SaveDataV4 schema）
- **D-13:** 字段：`currentAct: 'act1'|'act2'|'act3'`、`atmosphereTags: string[]`、`worldFlags: Record<string, boolean>`、`playerKnowledgeLevel: 0-5`

### AI 提示词注入
- **D-14:** 每次调用 NarrativeDirector / NpcActor 时传入 `storyAct + atmosphereTags`，注入到 system prompt
- **D-15:** buildNarrativeSystemPrompt 新增段落：当前叙事幕次 + 氛围关键词 + 各幕文风指引（第一幕平静有轻微不安，第二幕悬疑张力，第三幕沉重感）
- **D-16:** 连贯性约束：传入 `recentNarration` 时加「避免重复使用同一词语」指令

### NPC 信任度分级信息公开
- **D-17:** 信任度来源：复用 relation-store 的 npcDispositions 分数
- **D-18:** 三段阈值：
  - `<5`：只聊表面日常话题，回避追问
  - `5-8`：可提及谣言和间接线索，不确认
  - `>8`：可透露部分真相，保持犹豫
- **D-19:** npcs.yaml 每个 NPC 新增 `knowledge_profile` 字段：`always_knows`（始终公开）、`hidden_knowledge`（始终隐藏）、`trust_gates`（按阈值解锁的内容）
- **D-20:** buildNpcSystemPrompt 接收 `trustLevel: number`，按阈值生成当前可披露内容段落

### 场所描述世界状态覆盖
- **D-21:** locations.yaml 每个 location 新增 `description_overrides: Record<worldFlagKey, string>` 字段
- **D-22:** 触发时机：玩家 `:look` 时，scene-manager 实时检查 `narrativeState.worldFlags`，匹配最高优先级覆盖描述
- **D-23:** 优先级：worldFlags 覆盖 > 默认 description。无 LLM 调用，纯确定性文本选择
- **D-24:** 初期只为核心地点（酒馆、北门、广场）编写 Act 2 / Act 3 覆盖文本，其余 Claude 酌情处理

### 技术约束（不重新造轮子）
- **D-25:** 路线分数存在 QuestProgress.flags（现有字段）中，不新增数据结构
- **D-26:** quest_stage_advanced 事件触发 narrativeState 更新（事件驱动，不轮询）
- **D-27:** QuestStageSchema 需增加 `conditional_next_stages` 字段支持分支结局（Stage 5 → Stage 6 变体）

### Claude's Discretion
- narrative-transitions.yaml 的具体格式（确定性映射文件，内容明确后由规划智能体决定）
- emotional_anchor 注入的具体实现方式（先实现基础氛围注入，anchor 作为可选增强）
- 路线分数的具体权重和累积算法细节

</decisions>

<specifics>
## Specific Ideas

- 「王德不是纯粹的坏人——他是一个在压力下做了妥协选择的老人」——是整个故事的道德重量所在，不要把他写成反派
- 「义之道」结局：陈铁柱独自哭泣；「和之道」结局：月华沉默地看着玩家，瞎子孙消失；「暗之道」结局：阿鬼请玩家喝酒，台词让人不安
- Stage 3 洞穴发现的古代符文必须和 5 年前的灾难符文一样——月华能认出来，这是关键确认点
- 玩家「进洞穴前和老陈聊过三次以上」→ 义之道加分，「接触过阿鬼」→ 暗之道加分，「主动向陈铁柱汇报发现」→ 义之道大幅加分

</specifics>

<canonical_refs>
## Canonical References

**下游智能体在规划或实现前必须阅读以下文件。**

### 故事与世界观
- `.planning/phases/16-story-mainline/16-RESEARCH.md` — 完整故事框架调研：CRPG 叙事模式、6 阶段设计、提示词工程方案、数据结构建议
- `world-data/codex/quests.yaml` — 现有主线和支线结构（需扩展）
- `world-data/codex/npcs.yaml` — NPC 背景和知识配置（需增加 knowledge_profile）
- `world-data/codex/locations.yaml` — 地点数据（需增加 description_overrides）
- `world-data/codex/history_events.yaml` — 世界历史事件（叙事一致性参考）

### 现有基础设施
- `src/state/player-knowledge-store.ts` — heard/suspected/confirmed 状态（叙事系统复用）
- `src/state/relation-store.ts` — npcDispositions 分数（信任度来源）
- `src/state/quest-store.ts` — QuestProgress.flags（路线分数存储）
- `src/engine/quest-system.ts` — quest_stage_advanced 事件（触发 narrativeState 更新）
- `src/ai/prompts/narrative-system.ts` — 现有 buildNarrativeSystemPrompt（需扩展）
- `src/ai/prompts/npc-system.ts` — 现有 buildNpcSystemPrompt（需扩展）
- `src/codex/schemas/entry-types.ts` — QuestStageSchema（需增加 conditional_next_stages）

</canonical_refs>

<code_context>
## Existing Code Insights

### 可复用的现有资产
- `relation-store.ts` npcDispositions：直接作为信任度来源，映射到 0-10 区间
- `QuestProgress.flags: Record<string, unknown>`：存储路线分数（justice_score / pragmatism_score / shadow_score）
- `EventBus` + `quest_stage_advanced` 事件：驱动 narrativeState 自动更新
- `playerKnowledgeStore` KnowledgeStatus：`heard/suspected/confirmed` 可与 playerKnowledgeLevel 0-5 联动

### 已建立的模式
- Zod schema → store → save/load 的完整流程（参照 combat-store、dialogue-store）
- EventBus 订阅模式（scene-manager 已用 state_restored/dialogue_ended）
- `buildNpcSystemPrompt` 已接受 `personality_tags / goals / backstory`，扩展 trustLevel 接口改动小

### 集成点
- `scene-manager.ts` handleLook → 需检查 narrativeState.worldFlags → 选择 description_overrides
- `game-loop.ts` 或 `app.tsx` → 在 quest_stage_advanced 时更新 narrativeState
- `dialogue-manager.ts` buildNpcSystemPrompt 调用 → 需传入 trustLevel
- `SaveDataV4Schema` → 需增加 narrativeState 字段

</code_context>

<deferred>
## Deferred Ideas

- Act 2 / Act 3 的背景音效或视觉效果（超出 CLI 文字 RPG 范围）
- 玩家日志系统（记录已确认的知识条目）—— 可作为后续 Phase
- 多地区故事线（黑松镇之外）—— 下一里程碑范围
- 动态 NPC 位置变化（王德在 Act 3 躲避玩家）—— 可作为后续增强

</deferred>

---

*Phase: 16-story-mainline*
*Context gathered: 2026-04-29*
