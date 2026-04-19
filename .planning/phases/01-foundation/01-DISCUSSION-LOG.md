# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 01-foundation
**Areas discussed:** CLI panel layout, Rules Engine model, NL intent recognition, World Codex schema, State management, Command parsing

---

## CLI Panel Layout

### Panel arrangement

| Option | Description | Selected |
|--------|-------------|----------|
| 纵积み (Recommended) | scene 60-70%, status/actions/input below | |
| 左右分割 | Left scene+input, right status+actions | |
| アダプティブ | Switch vertical↔horizontal by terminal width | ✓ |

**User's choice:** Adaptive layout
**Notes:** None

### Breakpoint

| Option | Description | Selected |
|--------|-------------|----------|
| 100カラム (Recommended) | Vertical stack below 100, side-by-side above | ✓ |
| 80カラム | Earlier switch point, considers CJK width | |

**User's choice:** 100 columns

### Phase 1 panel content

| Option | Description | Selected |
|--------|-------------|----------|
| プレースホルダー表示 (Rec.) | Placeholder data in all panels | ✓ |
| レイアウトのみ先行 | Simple 1-panel output until Phase 2 | |

**User's choice:** Placeholder display
**Notes:** User requested all subsequent questions in Chinese

### Title screen

| Option | Description | Selected |
|--------|-------------|----------|
| 有启动画面 (推荐) | Figlet ASCII + gradient, press key to enter | ✓ |
| 直接进入 | No transition screen | |

**User's choice:** Title screen with figlet

### Border style

**User's choice:** User provided detailed mockup — single outer border wrapping entire screen, horizontal dividers between sections, Actions panel as vertical numbered selection list with ❯ cursor. Referenced Claude Code / Superpower option style.

### Color scheme

| Option | Description | Selected |
|--------|-------------|----------|
| 深色主题 (推荐) | Dark terminal only | |
| 双主题 | Light and dark toggleable | |
| 自动检测 | Auto-detect terminal background | ✓ |

**User's choice:** Auto-detect terminal background

### Recommended actions source

| Option | Description | Selected |
|--------|-------------|----------|
| AI 动态生成 (推荐) | AI generates 3-5 context-aware actions per scene | ✓ |
| 固定命令列表 | Predefined static actions | |
| 混合模式 | Fixed core + AI supplement | |

**User's choice:** AI dynamic generation

---

## Rules Engine Model

### Dice system

| Option | Description | Selected |
|--------|-------------|----------|
| D20 检定 (推荐) | D20 + attribute vs DC, classic TRPG | |
| 百分比检定 | Base probability + modifiers | |
| 对抗投骰 | Both sides roll + attributes, compare | |

**User's choice:** Hybrid system (free-text)
**Notes:** Default D20 core. Normal actions: D20 + attribute + skill + env vs DC. Opposed: both D20 + attribute + skill compare. Probability: percentage check. Plot-critical: graded success. AI narrates only, never adjudicates.

### Base attributes

| Option | Description | Selected |
|--------|-------------|----------|
| 六属性 (推荐) | STR/DEX/CON/INT/WIS/CHA classic D&D | |
| 五属性 | STR/DEX/WIS/WIL/CHA simplified | |

**User's choice:** Three-attribute system (free-text): 体魄/技巧/心智
**Notes:** Lightweight by design. Character differentiation through background, profession, equipment, status, and experience tags. "AI-driven CLI novel — narrative, choices, checks, world state first, not stat sheets."

### Check display

| Option | Description | Selected |
|--------|-------------|----------|
| 完整展示 (推荐) | Full process: [D20: 14] + 体魄 3 = 17 vs DC 15 → 成功 | |
| 简洁结果 | Result only, process in AI narration | |

**User's choice:** Full display by default (free-text)
**Notes:** Reserving "immersion mode" toggle to collapse check details. Design goal: rule transparency and player trust.

### Graded success levels

**User's choice:** You decide (Claude's Discretion)

### Combat damage

| Option | Description | Selected |
|--------|-------------|----------|
| 固定公式 (推荐) | D20 + 体魄 + weapon - armor | |
| 随机伤害骰 | Random damage dice + modifiers | |

**User's choice:** Graded result damage (free-text): weapon base + attribute modifier + success grade bonus - armor reduction

---

## NL Intent Recognition

### Intent categories

| Option | Description | Selected |
|--------|-------------|----------|
| 核心意图集 (推荐) | move, look, talk, attack, use_item, cast, guard, flee, inspect, trade | ✓ |
| 最小集 | move, look, talk, attack only | |

**User's choice:** Core intent set (10 categories)

### Unrecognized intent handling

| Option | Description | Selected |
|--------|-------------|----------|
| 提示 + 推荐动作 (推荐) | Notify + show recommended actions | ✓ |
| 先尝试再提示 | AI attempts understanding first | |

**User's choice:** Prompt + recommended actions

### Intent output format

**User's choice:** Zod structured intent output (free-text)
**Notes:** Provider-native structured outputs preferred (OpenAI Structured Outputs, Anthropic tool calling). Validation chain: Intent Classifier → Zod schema → domain rules → confidence gating → Rules Engine. Rules Engine never consumes raw model output. Schema failure: max 1 repair retry. Invalid target/action/low confidence: clarification flow or candidate actions.

---

## World Codex Schema

### Entry types

| Option | Description | Selected |
|--------|-------------|----------|
| 八大类型 (推荐) | race, profession, location, faction, npc, spell, item, history_event | ✓ |
| 最小集 | location, npc, item only | |

**User's choice:** Eight types with complete schema

### Schema depth

| Option | Description | Selected |
|--------|-------------|----------|
| 完整 schema (推荐) | All fields defined per type with Zod validation | ✓ |
| 公共字段 + 扩展 | Common fields only, type-specific later | |

**User's choice:** Complete schema

### Entity relationships

**User's choice:** Typed relationship graph (free-text)
**Notes:** All entities have stable IDs. Entities store basic attributes + description only. Cross-entity associations expressed as independent relationship edges with: source_id, target_id, relation_type, visibility, strength, status, evidence, note. Supports hidden relationships, plot unlock, NPC memory, knowledge-graph reasoning.

### Authority/canon tier

**User's choice:** Epistemic Metadata System (free-text)
**Notes:** Multi-dimensional credibility system — not just authority level. Includes: authority (6-level), truth_status (8 values), scope (8 values + scope_ref), visibility (5 levels), confidence (0-1 float), source_type (9 types + source_bias), known_by (entity ID list), contradicts (conflicting entry IDs), volatility. Detailed examples provided: 黑松镇狼灾 (public partial truth) + 狼灾真实原因 (hidden canonical truth). AI must select narration tone based on current character's known information and entry credibility.

### Example data volume

| Option | Description | Selected |
|--------|-------------|----------|
| 最小示例数据 (推荐) | 1-2 per type + example edges | ✓ |
| 只定义不填充 | Schema only, no content | |

**User's choice:** Minimum example data

---

## State Management

### Top-level structure

| Option | Description | Selected |
|--------|-------------|----------|
| 单根状态树 (推荐) | Single tree: { player, scene, npcs, quests, world, turn } | |
| 多 store 分离 | Separate stores: PlayerStore, SceneStore, CombatStore | ✓ |

**User's choice:** Multi-store separation

### Snapshot strategy

| Option | Description | Selected |
|--------|-------------|----------|
| 序列化协调器 (推荐) | Coordinator collects all stores into one JSON | |
| 各 store 独立序列化 | Each store serializes independently | ✓ |

**User's choice:** Independent store serialization

### Immer usage

| Option | Description | Selected |
|--------|-------------|----------|
| 全局使用 immer (推荐) | All store updates via immer produce() | ✓ |
| 选择性使用 | Immer for deep nesting only, spread for simple | |

**User's choice:** Global immer usage

### Event notification

**User's choice:** Typed domain event bus (free-text)
**Notes:** All store state changes publish typed domain events. UI, save manager, AI narrator, quest system, logging system subscribe to relevant events. mitt as underlying bus, wrapped with typed domain event layer.

---

## Command Parsing

### Command prefix

| Option | Description | Selected |
|--------|-------------|----------|
| : 前缀 (推荐) | :look, :go, :talk | |
| / 前缀 | /look, /go, /talk | ✓ |

**User's choice:** `/` prefix (overrides CLAUDE.md default of `:`)

### Aliases

| Option | Description | Selected |
|--------|-------------|----------|
| 有别名 (推荐) | /l = /look, /g = /go, etc. | |
| 无别名 | Full command names only | ✓ |

**User's choice:** No aliases

### Input mode

| Option | Description | Selected |
|--------|-------------|----------|
| 默认 NL (推荐) | Default NL, / switches to command | ✓ |
| 默认命令 | Default command, no prefix for NL | |
| 自动检测 | Auto-detect by / prefix | |

**User's choice:** Default NL mode

### Help system

| Option | Description | Selected |
|--------|-------------|----------|
| Help + Tab 补全 (推荐) | /help + Tab completion for commands and params | ✓ |
| 仅 Help | /help only, no Tab completion | |

**User's choice:** Help + Tab completion

---

## Claude's Discretion

- Graded success level count and thresholds
- Figlet font choice and gradient colors
- Status bar field ordering and overflow
- Tab completion implementation details
- Store naming conventions and granularity

## Deferred Ideas

- Command aliases — revisit if user feedback demands
- Immersion mode toggle — Phase 2 when AI narration is live
- Store migration/versioning — Phase 3 with save/load
