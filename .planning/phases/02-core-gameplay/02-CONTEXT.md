# Phase 2: Core Gameplay - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

A player can create a character, explore scenes, talk to NPCs with AI-generated personality-driven dialogue, and fight enemies — the core gameplay loop (create → explore → interact → fight) is playable end-to-end. This phase delivers the first playable game experience on top of Phase 1's engine skeleton.

</domain>

<decisions>
## Implementation Decisions

### 角色创建流程
- **D-01:** 混合模式——首次游玩默认向导式剧情流程，后续允许快速模式（预设模板/随机/导入）
- **D-02:** 向导式流程按 "选择种族 → 选择职业 → 选择背景钩子 → 确认" 顺序，通过旁白文本包装为开场剧情（"你从哪里来？""你靠什么活下去？""你为什么来到黑松镇？""你身上有什么秘密？"）
- **D-03:** 属性分配采用叙事决定——向导中的剧情选择暗含体魄/技巧/心智偏向，玩家不直接看到数字分配过程
- **D-04:** 不采用复杂加点系统，以三属性为基础，通过种族、职业、背景与经历标签塑造角色差异
- **D-05:** 背景钩子写入初始世界状态，影响起始任务、NPC关系与隐藏剧情
- **D-06:** 快速模式提供：预设模板（北境游侠/旧贵族术士/流浪盗贼等）、随机生成、自定义

### AI叙述风格
- **D-07:** 动态混合风格，按场景类型切换叙述调性：
  - 探索：电影感白话 + 少量氛围描写
  - 战斗：短句、强动作、少抒情
  - 对话：轻小说式自然口语
  - 历史/传说：轻度古风
  - 恐怖/神秘：压低信息量，增强悬疑
  - 检定结果：清楚解释原因，再接叙事
- **D-08:** 混合视角策略：
  - 实时行动/战斗/探索：第二人称（"你"）
  - NPC对话：直接对白
  - 历史传说/章节回顾：第三人称/史诗叙述
  - 系统日志：客观陈述
- **D-09:** 同一回合内不频繁切换视角，除非文本类型发生明确变化
- **D-10:** 每回合叙述 80-180 字中文，AI不发明世界事实，不覆盖游戏状态

### NPC对话系统
- **D-11:** 混合呈现——普通短对话内联嵌入 Scene 面板，保持探索节奏
- **D-12:** 关键对话（任务推进、关系变化、对话检定、隐藏信息、多轮选择）自动进入独立 Dialogue Mode
- **D-13:** Dialogue Mode 在 Scene 面板中切换专门布局：NPC名称、台词、关系状态、可选回应与检定选项
- **D-14:** NPC情绪采用"叙事默认、检定解锁"策略：
  - 默认通过台词/停顿/动作/行为描写体现情绪
  - 心智检定成功后显示情绪提示（普通成功=大致情绪，高等级成功=隐藏动机/矛盾心理）
  - 相关背景标签、长期关系、剧情线索也可解锁情绪可见性
- **D-15:** NPC对话由 AI NPC Actor 生成，输入：NPC身份、目标、已知记忆、当前场景、玩家动作；输出：对白、情绪标签（内部）、记忆标记、关系变化建议

### 战斗系统交互
- **D-16:** 战斗采用 Combat Mode 面板切换：保留四面板布局，内容全面战斗化
  - Scene 面板 → 战况叙述与环境信息
  - Status Bar → 扩展为玩家状态 + 敌人HP + 回合顺序
  - Suggested Actions → 战斗专用菜单（攻击/施法/防御/物品/逃跑/环境互动）
  - Input → 仍可输入自定义战斗行为，经意图识别转为结构化动作
- **D-17:** 检定先显示、叙述后呈现——先展示完整检定数据（[D20:14]+体魄 3=17 vs DC 15 → 成功），再由AI生成叙事描写
- **D-18:** 战斗动作通过 Rules Engine 判定（延续 Phase 1 的 D20 + 属性 + 修正 vs DC 模式），AI仅负责战斗叙述

### Claude's Discretion
- AI Narrative Director 的具体 prompt template 设计
- Retrieval Planner 的检索策略细节
- NPC记忆的初始种子数据结构
- 战斗平衡数值（武器伤害、护甲值、DC等）
- 角色预设模板的具体内容
- Dialogue Mode 的具体UI组件实现方式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project design
- `CLAUDE.md` — Full architecture spec: layer model, dual-input system, RAG strategy, multi-model strategy, AI roles and model tiers
- `CLAUDE.md` §AI System — Narrative Director, NPC Actor, Retrieval Planner role definitions and constraints

### Phase 1 foundation
- `.planning/phases/01-foundation/01-CONTEXT.md` — Prior decisions on CLI layout, Rules Engine, NL intent, World Codex, state management
- `src/engine/rules-engine.ts` — Current Rules Engine implementation (resolveAction, ActionContext)
- `src/state/player-store.ts` — Player state schema (attributes, equipment, tags)
- `src/state/combat-store.ts` — Existing combat state store
- `src/game-loop.ts` — Current game loop (processInput, adjudicate)
- `src/types/common.ts` — Core types (AttributeName, SuccessGrade, CheckResult)

### World data
- `src/data/codex/races.yaml` — Race definitions
- `src/data/codex/professions.yaml` — Profession definitions
- `src/data/codex/npcs.yaml` — NPC data format
- `src/codex/schemas/entry-types.ts` — Codex entry type schemas

### Requirements
- `.planning/REQUIREMENTS.md` §Gameplay — PLAY-01 through PLAY-04
- `.planning/REQUIREMENTS.md` §AI System — AI-01, AI-02, AI-03
- `.planning/REQUIREMENTS.md` §Content — CONT-02, CONT-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/engine/rules-engine.ts` + `adjudication.ts`: D20检定系统已就绪，Phase 2直接复用
- `src/state/create-store.ts`: createStore模式，用于新增 CharacterCreationStore、DialogueStore
- `src/state/combat-store.ts`: 战斗状态管理骨架已存在
- `src/input/intent-classifier.ts`: NL意图识别已实现，Phase 2扩展战斗/对话意图
- `src/input/command-registry.ts`: 命令注册机制，添加 `/talk`、`/attack` 等实现
- `src/events/event-bus.ts` + `event-types.ts`: 类型化事件总线，用于战斗/对话事件
- `src/codex/loader.ts` + `query.ts`: Codex加载和查询，用于NPC/种族/职业数据检索

### Established Patterns
- Store模式: `createStore<T>(initialState, onChange)` + immer produce
- 事件驱动: mitt event bus with typed domain events
- 输入路由: command parser + intent classifier → game action
- Schema验证: Zod schemas for all state types
- 测试模式: bun test with rng injection for determinism

### Integration Points
- `src/game-loop.ts`: 核心扩展点——添加角色创建入口、NPC对话路由、战斗模式切换
- `src/ui/`: 需新增 Dialogue Mode 组件、Combat Mode 组件、角色创建向导组件
- `src/state/`: 新增 dialogue-store、character-creation-store
- `src/codex/`: 查询NPC/种族/职业数据用于角色创建和对话

</code_context>

<specifics>
## Specific Ideas

- 角色创建是"第一段剧情"——不是冷冰冰的表格，而是叙事体验
- 向导式问题示例："你从哪里来？""你靠什么活下去？""你为什么来到黑松镇？""你身上有什么秘密？"
- 快速模式选项示例：1.北境游侠 2.旧贵族术士 3.流浪盗贼 4.随机生成 5.自定义
- 设计哲学延续 Phase 1："骰子管命运，Codex管真相，NPC管偏见"
- AI叙述不同场景的语言节奏示例：战斗要快，探索要有氛围，对话要自然，检定要清楚
- NPC情绪系统参考 Disco Elysium 的"内心对话"概念——检定成功能读懂对方

</specifics>

<deferred>
## Deferred Ideas

- NPC长期记忆持久化（跨session）— Phase 3
- 关系系统影响NPC行为和对话可用性 — Phase 3
- 任务接取/追踪系统 — Phase 3
- 沉浸模式（折叠检定详情）— Phase 2已具备切换基础，但UI toggle延后
- 自动战斗选项 — 未来优化

</deferred>

---

*Phase: 02-core-gameplay*
*Context gathered: 2026-04-20*
