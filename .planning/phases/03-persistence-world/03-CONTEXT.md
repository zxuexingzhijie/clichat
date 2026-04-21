# Phase 3: Persistence & World - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

游戏世界跨session持久化——玩家可存取档，NPC记住过往交互，任务可接取/追踪/完成，声望/关系影响游玩，黑松镇及周边8-10个地点构成可完整游玩的第一地区。

Requirements: SAVE-01, WORLD-02, WORLD-03, WORLD-04, CONT-01, CONT-03

</domain>

<decisions>
## Implementation Decisions

### 存档系统

- **D-01（存档目录）：** 平台标准用户数据目录——Windows: `%APPDATA%/Chronicle/saves`，macOS: `~/Library/Application Support/Chronicle/saves`，Linux: `$XDG_DATA_HOME/chronicle/saves`（回退 `~/.local/share/chronicle/saves`）；支持 `--save-dir` 指定自定义目录；`--portable` 模式写入 `./saves/`
- **D-02（存档槽位）：** 无限命名存档 + 1个快速存档槽（`quicksave.json`）
- **D-03（文件命名）：** 命名存档为 `名称_时间戳.json`（如 `before-the-gate_2026-04-21T14-00.json`）
- **D-04（文件格式）：** 带元数据头的JSON——元数据头包含存档名、时间戳、角色信息（名/种族/职业/等级）、游戏时长、当前地点，用于存档列表展示无需读取全文
- **D-05（存档内容结构）：** "核心状态内嵌 + 长期记忆外置引用"混合结构
  - **内嵌**：player / scene / world / quest / inventory / combat / dialogue / relations 全部stores + 本session相关NPC记忆快照 + 完整Quest Event Log
  - **外置引用（externalRefs）**：跨session/跨存档共享的长期NPC记忆（通过稳定npcId引用）、世界包、规则包、Codex内容
  - **已知限制**：长期NPC记忆跨存档共享，加载旧存档时NPC记忆反映当前状态而非存档时间线——Phase 4分支系统处理per-branch记忆隔离
- **D-06（schema版本）：** 存档schema升至v2，保留v1迁移路径（现有serializer.ts为v1，Phase 3新增stores后须同步更新SaveDataSchema）

### NPC记忆持久化

- **D-07（写盘时机）：** 实时写盘——每次产生新NPC记忆条目时立即持久化
- **D-08（磁盘结构）：** 按地区目录组织，每NPC一个独立记忆文件 + 全局`index.json`
  ```
  memory/
    index.json              # npcId → {filePath, region, currentLocation, updatedAt}
    blackpine_town/
      npc_guard.json
      npc_bartender.json
      ...
    north_forest/
      ...
  ```
  跨区NPC以稳定npcId + index定位，不依赖目录路径作为唯一真相
- **D-09（三层记忆结构）：**
  - `recentMemories`：最近10-15条交互，短期连续反应
  - `salientMemories`：最多50条高显著事件，长期关系/剧情连续性
  - `archiveSummary`：低优先级旧记忆压缩为长期印象摘要（Phase 3用规则拼接文本生成，Phase 5升级为LLM压缩）
- **D-10（记忆保留优先级）：** 综合计算 importance + emotionalWeight + questRelevance + relationshipImpact + reinforcement + ageDecay；关键事件/强情绪事件/任务事件/关系转折不轻易遗忘

### 任务系统

- **D-11（三层结构）：** "静态定义—动态进度—事件日志"分离
  - **Quest Template**（YAML/Codex）：静态内容——标题、摘要、阶段、目标（type: talk/visit_location/check等）、触发条件、奖励、关联实体（npc_id / location_id / item_id）
  - **QuestStore**（动态进度）：status / currentStageId / completedObjectives / discoveredClues / flags；序列化进存档
  - **Quest Event Log**（事件历史）：quest_started / objective_completed / clue_discovered / quest_completed等；完整内嵌存档文件
- **D-12（任务接取）：** NPC对话触发 + `:quest accept <id>` 手动命令两种方式
- **D-13（Journal显示）：** Template + QuestStore + EventLog三层组合生成；按状态分组（进行中/已完成/已失败）；每条显示：任务名、当前阶段、已发现线索列表（带✓标记）、当前目标列表（带□标记）
- **D-14（内容规模）：** CONT-03要求——1条主线任务骨架（5-8阶段）+ 5-8个可复用支线任务模板（带region/npc/constraint参数化）

### 声望与关系系统

- **D-15（数据结构）：** per-NPC disposition + per-faction reputation，各自独立的-100~+100浮点值；6个维度字段（公开名声/阵营立场/个人信任/恐惧值/恶名值/信誉值）在数据层全部存在
- **D-16（Phase 3实现范围）：**
  - 阈值颜签驱动NPC对话态度（如：≤-60=敌视，-20~20=中立，≥60=友好）
  - 部分对话选项开关（声望不足时选项变灰/隐藏）
  - 任务接取条件检查（声望gate）
  - 阵营关系图数据结构存在，但Phase 3不触发连锁效果
- **D-17（延后到Phase 4-5）：** 连锁声望传播、区域通行封锁、商品价格浮动、NPC援助触发、执法追缉、传闻扩散、世界事件触发、恐惧/恶名驱动的复杂行为
- **D-18（个人与阵营关系）：** 个人disposition与阵营reputation独立追踪；个人声望可影响阵营声望但不等于阵营声望

### 世界内容规模

- **D-19（第一地区范围）：** 黑松镇（已有基础YAML）+ 周边4个以上外围地点，总计8-10个场景（CONT-01要求8-12个地点，3-4个阵营）
- **D-20（现有内容状态）：** 黑松镇基础locations/npcs/factions/relationships YAML已存在但为最小存根，Phase 3大幅扩充深度和NPC数量

### Claude's Discretion
- 存档目录平台检测的具体实现（`process.platform` 分支或第三方库）
- 记忆优先级得分的具体权重系数
- Quest Template YAML的精确字段命名约定
- 声望阈值的具体数值划分（如-60/-20/20/60还是其他）
- 世界内容的具体叙事内容（NPC台词、任务摘要、地点描述）
- `:journal`命令的精确终端渲染样式

</decisions>

<specifics>
## Specific Ideas

- 声望系统是"世界社会反应机制"而非单一好感度——设计哲学：复杂社会评价不压缩为单一数字
- 任务设计参考："任务模板是剧本，QuestStore是玩家进度，Event Log是案发记录"
- NPC记忆三层类比：recentMemories=短期记忆，salientMemories=长期记忆，archiveSummary=印象/刻板印象
- Journal显示要有"互动小说味"——线索发现展示比单纯阶段列表更有沉浸感
- 存档系统延续Phase 1的设计哲学：state是可序列化的不可变快照树

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 架构与系统设计
- `CLAUDE.md` — 完整架构规范：层模型、双输入系统、RAG策略、多模型策略、AI角色职责与约束
- `CLAUDE.md` §Long-term Memory — 四层记忆架构（World Facts/Session State/Episodic Memory/Semantic Summary）
- `CLAUDE.md` §RAG Strategy — 文件式检索策略，无向量DB

### Phase 1-2基础
- `.planning/phases/01-foundation/01-CONTEXT.md` — store模式、事件总线、序列化、命令/NL双输入决策
- `.planning/phases/02-core-gameplay/02-CONTEXT.md` — D-15（NPC对话AI设计）、D-11（对话模式）、角色创建与战斗系统决策
- `src/state/serializer.ts` — 现有SaveData v1 schema（4 stores），Phase 3需升级至v2
- `src/state/npc-memory-store.ts` — NpcMemoryEntry现有schema，Phase 3扩展为三层结构
- `src/state/game-store.ts` — GamePhase enum，Phase 3可能需要新增phases

### 现有世界数据
- `src/data/codex/locations.yaml` — 黑松镇现有地点存根
- `src/data/codex/npcs.yaml` — 现有NPC存根（npc_guard, npc_bartender, npc_blacksmith等）
- `src/data/codex/factions.yaml` — 现有阵营（faction_guard, faction_shadow_guild等）
- `src/data/codex/relationships.yaml` — 现有关系定义
- `src/codex/schemas/relationship.ts` — RelationshipEdge schema（source_id/target_id/strength/status/visibility）

### Requirements
- `.planning/REQUIREMENTS.md` §World Data — WORLD-02, WORLD-03, WORLD-04
- `.planning/REQUIREMENTS.md` §Save & Branch — SAVE-01
- `.planning/REQUIREMENTS.md` §Content — CONT-01, CONT-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/state/create-store.ts`：createStore模式直接复用于QuestStore、RelationStore等新增stores
- `src/state/serializer.ts`：升级至v2，新增stores进SaveDataSchema，保留v1迁移
- `src/state/npc-memory-store.ts`：NpcMemoryEntry schema扩展为三层结构，写盘逻辑新增
- `src/codex/loader.ts` + `src/codex/query.ts`：Quest Template YAML加载直接复用codex加载器
- `src/events/event-bus.ts`：已有`npc_memory_written`事件，Phase 3扩展quest相关事件
- `src/engine/dialogue-manager.ts`：NPC对话管理器——Phase 3在此处接入声望判断和任务接取触发
- `src/input/command-registry.ts`：注册`:save`/`:load`/`:journal`/`:quest`等新命令

### Established Patterns
- Store模式：`createStore<T>(initialState, onChange)` + immer produce（所有新stores遵循此模式）
- Schema验证：所有新数据结构使用Zod schema
- 事件驱动：mitt event bus + typed domain events（任务推进、声望变化等通过事件广播）
- 测试模式：bun test + TDD（RED-GREEN-REFACTOR）

### Integration Points
- `src/game-loop.ts`：接入存档命令处理（`:save`/`:load`）、任务推进触发、声望变化计算
- `src/engine/dialogue-manager.ts`：NPC对话结束时写入记忆、触发声望变化
- `src/ui/screens/game-screen.tsx`：新增Journal面板组件（`:journal`命令触发）
- `src/data/codex/`：扩充世界内容YAML（locations/npcs/factions/quests子目录）

</code_context>

<deferred>
## Deferred Ideas

- **声望连锁传播（Phase 4）：** 阵营关系图驱动的连锁声望变化（提升卫队→降低盗贼公会）
- **区域通行封锁（Phase 4）：** 声望过低时无法进入特定区域
- **商品价格浮动（Phase 4-5）：** 声望影响商人报价
- **传闻扩散系统（Phase 4-5）：** 玩家行为在NPC间口耳相传
- **执法追缉（Phase 4-5）：** 恶名值触发守卫追捕行为
- **LLM记忆压缩（Phase 5）：** archiveSummary升级为AI-04 Background Summarizer驱动
- **分支记忆隔离（Phase 4）：** per-branch NPC长期记忆，解决跨存档记忆时间线一致性问题
- **`:branch`/`:compare`存档系统（Phase 4）：** SAVE-02/SAVE-03

</deferred>

---

*Phase: 03-persistence-world*
*Context gathered: 2026-04-21*
