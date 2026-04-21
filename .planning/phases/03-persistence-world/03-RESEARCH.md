# Phase 3: Persistence & World - Research

**Researched:** 2026-04-21
**Domain:** Save system, NPC episodic memory persistence, quest system, reputation/relationship system, world content expansion
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**存档系统**
- D-01: 平台标准用户数据目录 — Windows: `%APPDATA%/Chronicle/saves`, macOS: `~/Library/Application Support/Chronicle/saves`, Linux: `$XDG_DATA_HOME/chronicle/saves` (回退 `~/.local/share/chronicle/saves`); 支持 `--save-dir`; `--portable` 写入 `./saves/`
- D-02: 无限命名存档 + 1个快速存档槽 (`quicksave.json`)
- D-03: 命名存档文件名格式 `名称_时间戳.json` (e.g. `before-the-gate_2026-04-21T14-00.json`)
- D-04: 带元数据头的JSON — 元数据头含存档名、时间戳、角色信息(名/种族/职业/等级)、游戏时长、当前地点
- D-05: "核心状态内嵌 + 长期记忆外置引用"混合结构 — 内嵌: player/scene/world/quest/inventory/combat/dialogue/relations全部stores + 本session相关NPC记忆快照 + 完整Quest Event Log; 外置引用(externalRefs): 跨session/跨存档共享的长期NPC记忆
- D-06: 存档schema升至v2，保留v1迁移路径

**NPC记忆持久化**
- D-07: 实时写盘 — 每次产生新NPC记忆条目时立即持久化
- D-08: 按地区目录组织，每NPC一个独立记忆文件 + 全局`index.json`
- D-09: 三层记忆结构 — recentMemories (最近10-15条), salientMemories (最多50条高显著事件), archiveSummary (规则拼接文本摘要)
- D-10: 记忆保留优先级综合计算: importance + emotionalWeight + questRelevance + relationshipImpact + reinforcement + ageDecay

**任务系统**
- D-11: 三层结构 — Quest Template (YAML/Codex), QuestStore (动态进度), Quest Event Log (事件历史)
- D-12: NPC对话触发 + `:quest accept <id>` 手动命令两种方式
- D-13: Journal显示 — Template + QuestStore + EventLog三层组合; 按状态分组; 每条显示任务名/当前阶段/已发现线索/当前目标
- D-14: 1条主线任务骨架(5-8阶段) + 5-8个可复用支线任务模板(带参数)

**声望与关系系统**
- D-15: per-NPC disposition + per-faction reputation, 各自-100~+100浮点值; 6个维度字段
- D-16: Phase 3实现范围 — 阈值颜签驱动NPC对话态度, 部分对话选项开关, 任务接取条件检查; 阵营关系图数据结构存在但不触发连锁效果
- D-17: 连锁声望传播等延后至Phase 4-5
- D-18: 个人disposition与阵营reputation独立追踪

**世界内容规模**
- D-19: 黑松镇 + 周边4个以上外围地点, 总计8-10个场景 (3-4个阵营)
- D-20: 黑松镇基础YAML已存在为最小存根, Phase 3大幅扩充

### Claude's Discretion
- 存档目录平台检测的具体实现 (`process.platform` 分支或第三方库)
- 记忆优先级得分的具体权重系数
- Quest Template YAML的精确字段命名约定
- 声望阈值的具体数值划分
- 世界内容的具体叙事内容 (NPC台词、任务摘要、地点描述)
- `:journal`命令的精确终端渲染样式

### Deferred Ideas (OUT OF SCOPE)
- 声望连锁传播 (Phase 4)
- 区域通行封锁 (Phase 4)
- 商品价格浮动 (Phase 4-5)
- 传闻扩散系统 (Phase 4-5)
- 执法追缉 (Phase 4-5)
- LLM记忆压缩 (Phase 5)
- 分支记忆隔离 (Phase 4)
- `:branch`/`:compare`存档系统 (Phase 4) — SAVE-02/SAVE-03
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SAVE-01 | Player can quick save, named save (`:save "before the gate"`), and load any save — full game state serialized/restored | D-01 through D-06; SaveDataSchema v2 design; platform path detection via `env-paths`; existing serializer.ts v1 as migration baseline |
| WORLD-02 | Per-NPC episodic memory stored as structured JSON, tagged with participants, locations, quest IDs, and emotional valence, retrieved by structured query | D-07 through D-10; existing NpcMemoryEntrySchema extension; disk persistence pattern via Bun.file()/Bun.write(); memory index file |
| WORLD-03 | Player can accept, track progress on, and complete quests — with a `:journal` command showing active/completed/failed quests | D-11 through D-14; QuestStore + QuestTemplate YAML; new codex schema; Journal UI panel pattern |
| WORLD-04 | Relationship system tracks player reputation with individual NPCs and factions, influencing NPC dialogue and quest availability | D-15 through D-18; RelationStore new store; integration with dialogue-manager.ts and quest gate checks |
| CONT-01 | First region world pack: one region with 8-12 locations, 3-4 factions, regional lore, danger levels | D-19, D-20; existing YAML stubs in src/data/codex/; LocationSchema already supports required fields |
| CONT-03 | Quest content: one main quest skeleton (5-8 stages) and 5-8 reusable side quest templates with region/NPC/constraint parameters | D-14; QuestTemplate YAML schema design; parameterization pattern for reusable templates |
</phase_requirements>

---

## Summary

Phase 3 is a layered persistence and content phase. It introduces four new systems (save/load, NPC memory persistence, quest tracking, reputation/relations) on top of Phase 1-2's store/event/serializer infrastructure — all of which are already proven patterns in the codebase.

The most structurally important change is the **SaveData v2 schema upgrade**: the existing `serializer.ts` snapshots 4 stores (player, scene, combat, game); Phase 3 adds at minimum 3 new stores (quest, relations, and the expanded npc-memory), requires a metadata envelope (D-04), and needs a save-file manager that handles platform directories (D-01), named slots (D-02/D-03), and v1→v2 migration (D-06). The disk persistence architecture (D-07/D-08) for NPC memories is a separate concern from the save system: it writes continuously to `memory/` files, not only on save.

The quest system (D-11) is a three-layer separation: static YAML templates (new `quests.yaml` codex file using a new `QuestSchema`), dynamic `QuestStore` (progress, flags, status), and an immutable event log. The `CodexEntrySchema` discriminated union in `entry-types.ts` will need a `quest` type added. The reputation system (D-15/D-16) is a new `RelationStore` with per-NPC and per-faction maps; it integrates into the existing `dialogue-manager.ts` to gate response options and attitude labels.

**Primary recommendation:** Build in this dependency order — (1) QuestSchema + YAML content expansion, (2) QuestStore + RelationStore + new event types, (3) SaveData v2 schema + save-file-manager, (4) NPC memory disk persistence, (5) game-loop/command integration, (6) Journal UI panel.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Save/load file I/O | State layer (serializer + save-file-manager) | CLI command layer | Pure state snapshot; UI only triggers commands |
| Platform path resolution | Save-file-manager module | None | Encapsulates OS-specific logic away from stores |
| NPC memory disk write | State layer (npc-memory-store onChange) | Persistence module | Triggered on store mutation; out-of-band from game loop |
| Quest progress tracking | Rules Engine / QuestStore | Game loop | Deterministic; no LLM involvement |
| Quest completion adjudication | Rules Engine | None | Same principle as combat — deterministic only |
| Reputation delta calculation | Rules Engine | None | Deterministic formula, not AI |
| Reputation influencing dialogue | NPC Mind / dialogue-manager.ts | Rules Engine | dialogue-manager gates options; Rules Engine owns delta |
| Journal display | CLI UI (Ink component) | None | Read-only projection of QuestStore + EventLog + Template |
| World content YAML | World Codex (data layer) | None | Static authored content, no runtime ownership |
| Quest Template loading | Codex loader (existing loader.ts) | None | Same pattern as locations/npcs/factions |

---

## Standard Stack

### Core (all already installed — no new packages needed for logic)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bun.file() / Bun.write() | built-in | NPC memory disk I/O, save file read/write | [VERIFIED: installed] Native, ~10x faster than Node fs; already used in loader.ts |
| yaml | ^2.8.3 | Quest Template YAML serialize/deserialize | [VERIFIED: package.json] Already installed; used in codex loader |
| zod | ^4.3.6 | QuestSchema, RelationSchema, SaveDataV2Schema | [VERIFIED: package.json] Already installed; established pattern |
| immer | ^11.1.4 | QuestStore / RelationStore immutable updates | [VERIFIED: package.json] Already installed; established pattern |
| mitt | ^3.0.1 | New domain events (quest_started, reputation_changed, etc.) | [VERIFIED: package.json] Already installed; established pattern |
| nanoid | ^5.1.9 | Quest event IDs, save slot IDs | [VERIFIED: package.json] Already installed |

### Supporting (for platform path detection — Claude's Discretion D-01)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| env-paths | ^4.0.0 | Cross-platform data directory resolution | [VERIFIED: npm registry] Provides `data` path per platform; handles XDG on Linux, AppData on Windows, Application Support on macOS. Avoids manual `process.platform` branching. |

**env-paths recommendation (Claude's Discretion D-01):**
`env-paths` is the standard solution for this exact problem. It is ESM-only (matches Bun/TypeScript ESM project) and has zero dependencies.

```bash
bun add env-paths
```

Alternatively, a 15-line `process.platform` switch is viable if avoiding a new dependency is preferred. Both approaches are correct.

**Version verification:** [VERIFIED: npm registry 2026-04-21]
- env-paths: 4.0.0 (latest)
- yaml: 2.8.3 (already installed)
- zod: 4.3.6 (already installed)

---

## Architecture Patterns

### System Architecture Diagram

```
Player Input (:save/:load/:journal/:quest)
        │
        ▼
CommandRegistry ──► GameLoop.processInput()
        │
        ├──[:save name]──► SaveFileManager.saveGame(name)
        │                       │
        │                SnapshotAllStores()  ◄─ player/scene/game/combat/
        │                       │               quest/relations/npcMemory stores
        │                WriteToFile(path)
        │                (metadata envelope + store snapshots + npc memory snapshot + quest event log)
        │
        ├──[:load name]──► SaveFileManager.loadGame(name)
        │                       │
        │                ReadFile → ValidateV2Schema
        │                       │
        │                MigrateV1→V2 (if version:1)
        │                       │
        │                RestoreAllStores()
        │
        ├──[:journal]────► JournalPanel (Ink component)
        │                       │
        │                 Reads QuestStore + QuestTemplates + EventLog
        │                       │
        │                 Renders active/completed/failed quests
        │
        └──[:quest accept id]──► QuestSystem.acceptQuest(id)
                                       │
                                 ReputationGateCheck()  ◄── RelationStore
                                       │
                                 QuestStore.setState(draft => draft.quests[id].status = 'active')
                                       │
                                 EventLog.append(quest_started)
                                       │
                                 eventBus.emit('quest_started', ...)

NPC Memory Disk Persistence (out-of-band from save system):
  npcMemoryStore.onChange()
        │
        ▼
  MemoryPersistenceManager.onMemoryWritten(npcId, entry)
        │
        ├── ReadOrCreate: memory/index.json
        ├── ReadOrCreate: memory/{region}/{npcId}.json
        ├── Apply three-layer retention logic (recentMemories / salientMemories / archiveSummary)
        └── Bun.write() both files
```

### Recommended Project Structure

```
src/
├── state/
│   ├── quest-store.ts          # QuestStore + QuestEventLog (new)
│   ├── relation-store.ts       # RelationStore per-NPC + per-faction (new)
│   ├── npc-memory-store.ts     # EXTENDED: three-layer schema
│   └── serializer.ts           # UPGRADED: v2 schema, v1 migration
├── persistence/
│   ├── save-file-manager.ts    # Platform paths, named saves, quicksave (new)
│   ├── memory-persistence.ts   # NPC memory disk write/read (new)
│   └── save-migrator.ts        # v1→v2 migration logic (new)
├── engine/
│   ├── quest-system.ts         # Quest accept/progress/complete logic (new)
│   ├── reputation-system.ts    # Reputation delta calculation (new)
│   └── dialogue-manager.ts     # EXTENDED: reputation gates + quest triggers
├── codex/
│   └── schemas/
│       └── entry-types.ts      # EXTENDED: QuestTemplateSchema added to union
├── data/codex/
│   ├── quests.yaml             # Quest templates (new)
│   ├── locations.yaml          # EXPANDED: 8-10 locations
│   ├── npcs.yaml               # EXPANDED: additional NPCs
│   └── factions.yaml           # EXPANDED: 3-4 factions
├── ui/
│   ├── panels/
│   │   └── journal-panel.tsx   # Journal display component (new)
│   └── screens/
│       └── game-screen.tsx     # EXTENDED: journal panel integration
└── input/
    └── command-registry.ts     # EXTENDED: :load, :journal, :quest commands
```

### Pattern 1: SaveData V2 Schema with Metadata Envelope

**What:** SaveDataSchema upgraded from `version: z.literal(1)` to `version: z.literal(2)`. Adds metadata header for save-list display without full parse. Embeds new stores.

**When to use:** On every save; restore validates via safeParse.

```typescript
// Source: [ASSUMED — extends existing src/state/serializer.ts pattern]
export const SaveMetaSchema = z.object({
  saveName: z.string(),
  timestamp: z.string(),
  character: z.object({
    name: z.string(),
    race: z.string(),
    profession: z.string(),
  }),
  playtime: z.number(), // seconds
  locationName: z.string(),
});

export const SaveDataV2Schema = z.object({
  version: z.literal(2),
  meta: SaveMetaSchema,
  player: PlayerStateSchema,
  scene: SceneStateSchema,
  combat: CombatStateSchema,
  game: GameStateSchema,
  quest: QuestStateSchema,        // new
  relations: RelationStateSchema, // new
  npcMemorySnapshot: NpcMemoryStateSchema, // session memories inline
  questEventLog: z.array(QuestEventSchema), // full event log
  externalRefs: z.object({
    worldPack: z.string(),
    rulesPack: z.string(),
  }).optional(),
});
```

### Pattern 2: V1 Migration

**What:** When loading a v1 save, upgrade to v2 by injecting default values for new fields.

**When to use:** `restore()` detects `version: 1` before schema parse.

```typescript
// Source: [ASSUMED — standard migration pattern]
function migrateV1ToV2(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const data = raw as Record<string, unknown>;
  if (data['version'] !== 1) return raw;
  return {
    ...data,
    version: 2,
    meta: buildMetaFromV1(data),
    quest: getDefaultQuestState(),
    relations: getDefaultRelationState(),
    npcMemorySnapshot: data['npcMemory'] ?? getDefaultNpcMemoryState(),
    questEventLog: [],
    externalRefs: undefined,
  };
}
```

### Pattern 3: Platform Path Resolution (env-paths)

**What:** Resolves save directory per platform using `env-paths`.

```typescript
// Source: [VERIFIED: npm view env-paths / env-paths@4.0.0 README]
import envPaths from 'env-paths';

export function getSaveDir(options?: { portable?: boolean; customDir?: string }): string {
  if (options?.customDir) return options.customDir;
  if (options?.portable) return './saves';
  const paths = envPaths('Chronicle');
  return `${paths.data}/saves`;
  // macOS: ~/Library/Application Support/Chronicle/saves
  // Windows: %APPDATA%/Chronicle/saves
  // Linux: $XDG_DATA_HOME/chronicle/saves or ~/.local/share/chronicle/saves
}
```

### Pattern 4: QuestStore with EventLog

**What:** Two parallel state shapes — QuestState (mutable progress) and QuestEventLog (append-only).

```typescript
// Source: [ASSUMED — extends existing createStore pattern]
export const QuestProgressSchema = z.object({
  status: z.enum(['unknown', 'active', 'completed', 'failed']),
  currentStageId: z.string().nullable(),
  completedObjectives: z.array(z.string()),
  discoveredClues: z.array(z.string()),
  flags: z.record(z.string(), z.unknown()),
  acceptedAt: z.number().nullable(), // turnNumber
  completedAt: z.number().nullable(),
});

export const QuestStateSchema = z.object({
  quests: z.record(z.string(), QuestProgressSchema), // keyed by questId
});

export const QuestEventSchema = z.object({
  id: z.string(),
  questId: z.string(),
  type: z.enum([
    'quest_started', 'objective_completed', 'clue_discovered',
    'stage_advanced', 'quest_completed', 'quest_failed',
  ]),
  turnNumber: z.number(),
  timestamp: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
```

### Pattern 5: RelationStore Structure

**What:** Separate per-NPC disposition and per-faction reputation maps, both -100 to +100.

```typescript
// Source: [ASSUMED — based on D-15 decisions]
export const NpcDispositionSchema = z.object({
  value: z.number().min(-100).max(100),
  publicReputation: z.number().min(-100).max(100),
  personalTrust: z.number().min(-100).max(100),
  fear: z.number().min(-100).max(100),
  infamy: z.number().min(-100).max(100),
  credibility: z.number().min(-100).max(100),
});

export const RelationStateSchema = z.object({
  npcDispositions: z.record(z.string(), NpcDispositionSchema), // keyed by npcId
  factionReputations: z.record(z.string(), z.number().min(-100).max(100)), // keyed by factionId
});
```

### Pattern 6: Three-Layer NPC Memory

**What:** Extension of existing `NpcMemoryEntrySchema` into a `NpcMemoryRecord` with three tiers per NPC.

```typescript
// Source: [ASSUMED — extends src/state/npc-memory-store.ts]
export const NpcMemoryRecordSchema = z.object({
  npcId: z.string(),
  recentMemories: z.array(NpcMemoryEntrySchema).max(15),
  salientMemories: z.array(NpcMemoryEntrySchema).max(50),
  archiveSummary: z.string(), // rule-assembled text in Phase 3
  lastUpdated: z.string(),
});

export const NpcMemoryStateSchema = z.object({
  memories: z.record(z.string(), NpcMemoryRecordSchema), // npcId → record
});
```

Note: This replaces the existing `z.record(z.string(), z.array(NpcMemoryEntrySchema))` shape. The store onChange handler already emits `npc_memory_written`; the new `memory-persistence.ts` module subscribes to that event to write disk files.

### Pattern 7: Memory Disk Persistence

**What:** `memory-persistence.ts` subscribes to `npc_memory_written` event and writes atomically.

```typescript
// Source: [ASSUMED — uses established Bun.file()/Bun.write() pattern from loader.ts]
// memory/
//   index.json  → { [npcId]: { filePath, region, currentLocation, updatedAt } }
//   blackpine_town/
//     npc_guard.json      → NpcMemoryRecord
//     npc_bartender.json  → NpcMemoryRecord
```

Bun.write() is atomic on most systems (writes to temp then renames). For Phase 3 this is sufficient; Phase 4 can add WAL-style durability if needed.

### Pattern 8: Quest Template YAML Schema

**What:** Quest entries added to the codex discriminated union as type `quest`.

```typescript
// Source: [ASSUMED — extends entry-types.ts CodexEntrySchema]
export const QuestObjectiveSchema = z.object({
  id: z.string(),
  type: z.enum(['talk', 'visit_location', 'defeat_enemy', 'find_item', 'check_flag']),
  targetId: z.string().optional(),
  description: z.string(),
});

export const QuestStageSchema = z.object({
  id: z.string(),
  description: z.string(),
  objectives: z.array(QuestObjectiveSchema),
  nextStageId: z.string().nullable(),
  completionCondition: z.string().optional(),
});

export const QuestTemplateSchema = z.object({
  ...baseFields,
  type: z.literal('quest'),
  quest_type: z.enum(['main', 'side', 'faction']),
  region: z.string().optional(),            // parameterizable
  required_npc_id: z.string().optional(),   // parameterizable
  min_reputation: z.number().optional(),    // gate check
  stages: z.array(QuestStageSchema),
  rewards: z.object({
    gold: z.number().optional(),
    items: z.array(z.string()).optional(),
    reputation_delta: z.record(z.string(), z.number()).optional(),
    relation_delta: z.record(z.string(), z.number()).optional(),
  }),
});
```

The `CodexEntrySchema` discriminated union in `entry-types.ts` adds `QuestTemplateSchema` as a new variant.

### Reputation Gate Pattern (dialogue-manager.ts integration)

The existing `requiresFullMode(npc)` function in `dialogue-manager.ts` already applies NPC-based logic. Phase 3 extends this with reputation checks:

```typescript
// Source: [ASSUMED — extends existing dialogue-manager.ts pattern]
// In dialogue-manager.ts, when building available responses:
function filterResponsesByReputation(responses, npcId, relationStore) {
  const disposition = relationStore.npcDispositions[npcId]?.value ?? 0;
  return responses.map(r => ({
    ...r,
    locked: r.minReputation !== undefined && disposition < r.minReputation,
  }));
}
```

Attitude label from disposition value:
- `value <= -60` → 敌视 (hostile)
- `-60 < value <= -20` → 冷漠 (cold)
- `-20 < value <= 20` → 中立 (neutral)
- `20 < value <= 60` → 友好 (friendly)
- `value > 60` → 信任 (trusted)

### Anti-Patterns to Avoid

- **Storing quest template data in QuestStore:** Templates are static YAML codex entries loaded at startup. QuestStore holds only progress/status. Never duplicate template fields into QuestStore — compute display from Template + Progress at render time.
- **Writing NPC memory inside game-loop.ts:** Memory writes belong in `memory-persistence.ts` as a store subscriber, not in the game loop. The game loop calls dialogue-manager, which updates npcMemoryStore; persistence is a side effect of the store's onChange.
- **Parsing entire save file for save-list display:** The metadata envelope in D-04 exists specifically to allow listing saves by reading only the `meta` key. Read-and-parse `SaveDataV2.meta` only for the list; full parse only on load.
- **Treating RelationStore as dialogue-store:** `dialogueStore.relationshipValue` is a transient per-dialogue accumulator (exists from Phase 2). `RelationStore` is the persistent cross-session map. These are different concerns. At dialogue end, apply the accumulated delta to RelationStore.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-platform data directory | `process.platform` multi-branch switch | `env-paths` | Handles XDG spec, Windows AppData, macOS Application Support, portable mode; tested across edge cases |
| YAML serialization for dynamic quest files | Manual string building | `yaml` package (already installed) | Full YAML 1.2 spec, handles nested objects correctly |
| Atomic file write | Temp-file-then-rename | `Bun.write()` | Bun.write performs atomic replacement; already used in project |
| UUID/ID generation for quest events, save slots | `Date.now()` or Math.random | `nanoid` (already installed) | Collision-free, URL-safe, already in project |
| Schema validation for save data on load | Manual type assertions | Zod `safeParse` with migration | Already established pattern in serializer.ts; catches corrupt saves gracefully |

---

## Runtime State Inventory

> Phase 3 is not a rename/refactor phase. However, it introduces new persistent state that future phases must account for.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | NpcMemoryStore currently lives in-memory only (no disk); no `memory/` directory exists | Phase 3 creates `memory/` directory structure on first write |
| Live service config | None — no external services in play | None |
| OS-registered state | None | None |
| Secrets/env vars | None — no new secrets introduced by this phase | None |
| Build artifacts | None | None |

**Existing v1 save files:** If a player has `quicksave.json` from Phase 1/2 testing, the v1→v2 migration in `save-migrator.ts` handles it. The migration injects default `quest`, `relations`, and `questEventLog` fields.

---

## Common Pitfalls

### Pitfall 1: dialogueStore.relationshipValue vs. RelationStore confusion

**What goes wrong:** Applying NPC attitude gates against `dialogueStore.relationshipValue` (the transient per-conversation accumulator) instead of the persistent `RelationStore.npcDispositions[npcId].value`.
**Why it happens:** `dialogueStore.relationshipValue` already exists from Phase 2 and looks like "the relationship value." It is actually a session delta accumulator.
**How to avoid:** RelationStore owns the canonical relationship value. At `endDialogue()`, apply `dialogueStore.relationshipValue` as a delta to `RelationStore`. Attitude gates read from RelationStore only.
**Warning signs:** NPC attitude resets to neutral every new conversation despite previous interactions.

### Pitfall 2: Blocking the game loop with NPC memory disk writes

**What goes wrong:** Writing NPC memory files synchronously inside `game-loop.ts` or `dialogue-manager.ts`, causing visible latency after every dialogue exchange.
**Why it happens:** D-07 says "实时写盘" — easy to interpret as "write inline."
**How to avoid:** Write asynchronously via `memory-persistence.ts` which subscribes to the `npc_memory_written` event. The store mutation is synchronous (fast); the disk write is async fire-and-forget. Log errors but do not await in the game loop.
**Warning signs:** Noticeable delay after NPC dialogue exchanges.

### Pitfall 3: NpcMemoryState schema break in serializer

**What goes wrong:** Phase 3 changes `NpcMemoryStateSchema` from `z.record(string, array)` to `z.record(string, NpcMemoryRecordSchema)`. If `SaveDataV2Schema` inlines the new `NpcMemoryStateSchema` but existing tests use the old flat array format, tests fail.
**Why it happens:** The existing `new-stores.test.ts` tests the old flat-array shape.
**How to avoid:** Update `npc-memory-store.ts` schema first. Update all tests that use `NpcMemoryStateSchema`. The `saveDataV2.npcMemorySnapshot` field uses the NEW schema.
**Warning signs:** `NpcMemoryStateSchema.safeParse` failures in serializer tests.

### Pitfall 4: loadAllCodex() filtering out quests.yaml

**What goes wrong:** `loader.ts:loadAllCodex()` currently reads all `.yaml` files except `relationships.yaml`. Adding `quests.yaml` to the codex directory works automatically IF `QuestTemplateSchema` is added to `CodexEntrySchema` discriminated union. If it isn't, every quest entry throws a validation error at startup.
**Why it happens:** The discriminated union requires an exhaustive match on `type`.
**How to avoid:** Add `QuestTemplateSchema` to `CodexEntrySchema` in `entry-types.ts` before adding `quests.yaml`.
**Warning signs:** `Codex file quests.yaml, entry "quest_main_01" validation failed: Invalid discriminator value`.

### Pitfall 5: Save file directory not created before write

**What goes wrong:** `Bun.write(path, content)` on a path where the parent directory doesn't exist throws an error. Platform save directories don't exist until Chronicle first runs.
**Why it happens:** Bun.write does not auto-create parent directories.
**How to avoid:** `save-file-manager.ts` must call `Bun.mkdirSync(saveDir, { recursive: true })` (or equivalent) before first write.
**Warning signs:** `ENOENT: No such file or directory` on first save attempt.

### Pitfall 6: QuestStore not included in SaveData v2 snapshot

**What goes wrong:** Adding QuestStore as a singleton module-level store but forgetting to include it in the `createSerializer` factory function parameters.
**Why it happens:** `createSerializer` receives stores as explicit parameters — it's easy to add a store but not pass it to the serializer.
**How to avoid:** Update `createSerializer` signature to include all new stores: quest, relations, npcMemory. Add corresponding fields to `SaveDataV2Schema`.
**Warning signs:** Quest progress lost on load; `:journal` shows empty after reload.

---

## Code Examples

### Save File Manager — Platform Path

```typescript
// Source: env-paths@4.0.0 README [VERIFIED: npm registry]
import envPaths from 'env-paths';
import { mkdirSync } from 'node:fs';

export function getSaveDir(opts?: { portable?: boolean; customDir?: string }): string {
  if (opts?.customDir) return opts.customDir;
  if (opts?.portable) return './saves';
  const paths = envPaths('Chronicle', { suffix: '' });
  return `${paths.data}/saves`;
}

export async function ensureSaveDirExists(saveDir: string): Promise<void> {
  mkdirSync(saveDir, { recursive: true });
}
```

### Existing Serializer Restore Pattern (v1 — reference)

```typescript
// Source: src/state/serializer.ts [VERIFIED: codebase]
restore(json: string): void {
  const result = SaveDataSchema.safeParse(JSON.parse(json));
  if (!result.success) throw new Error(`Invalid save data: ${...}`);
  stores.player.setState(draft => { Object.assign(draft, result.data.player); });
  // ... other stores
}
```

The v2 serializer extends this with migration check before `safeParse`:
```typescript
// Source: [ASSUMED — migration pattern]
let raw = JSON.parse(json);
if ((raw as {version?: unknown}).version === 1) {
  raw = migrateV1ToV2(raw);
}
const result = SaveDataV2Schema.safeParse(raw);
```

### Event Types Extension (new events for Phase 3)

```typescript
// Source: [ASSUMED — extends src/events/event-types.ts pattern]
// New events to add to DomainEvents:
quest_started: { questId: string; questTitle: string; turnNumber: number };
quest_stage_advanced: { questId: string; newStageId: string; turnNumber: number };
quest_completed: { questId: string; reward: unknown };
quest_failed: { questId: string; reason: string };
reputation_changed: { targetId: string; targetType: 'npc' | 'faction'; delta: number; newValue: number };
save_game_requested: { saveName: string | null }; // null = quicksave
save_game_completed: { filePath: string };
load_game_requested: { saveName: string };
```

### Existing Bun File I/O Pattern (from codex loader)

```typescript
// Source: src/codex/loader.ts [VERIFIED: codebase]
const file = Bun.file(filePath);
const text = await file.text();
const rawEntries = parseYaml(text);
```

Write pattern (Bun built-in):
```typescript
// Source: Bun docs [ASSUMED — consistent with Bun.file usage in project]
await Bun.write(filePath, JSON.stringify(data, null, 2));
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw `NpcMemoryEntry[]` flat array per NPC | Three-layer `NpcMemoryRecord` (recent/salient/archive) | Phase 3 | Enables smart retention without LLM; human-readable archive summary |
| SaveData v1: 4 stores, no metadata | SaveData v2: 8+ stores + metadata envelope + event log | Phase 3 | Enables save-list display, quest persistence, relationship persistence |
| Transient in-memory dialogue relationship tracking | Persistent RelationStore + transient dialogue accumulator | Phase 3 | NPCs remember relationship across sessions |
| Static minimal YAML stubs (2 locations, 12 NPCs) | Full first region (8-10 locations, expanded NPCs, 3-4 factions, quest templates) | Phase 3 | CONT-01 and CONT-03 requirements met |

**Deprecated/outdated after Phase 3:**
- `NpcMemoryStateSchema` flat array shape: replaced by three-layer `NpcMemoryRecordSchema`
- `SaveDataSchema` v1 literal: replaced by v2 (v1 migration handled by migrator)
- `GameScreen` `quest={null}` stub in StatusBar: wire actual active quest name from QuestStore

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Bun.write() performs atomic replacement on macOS/Linux via temp-then-rename | Architecture Patterns § Memory Disk Persistence | Save file corruption on crash during write — low risk for game saves |
| A2 | `env-paths@4.0.0` is ESM-compatible with Bun | Standard Stack | Build error; fallback: manual `process.platform` switch (15 lines) |
| A3 | QuestTemplateSchema added to CodexEntrySchema discriminated union works without breaking existing loader tests | Common Pitfalls #4 | Loader tests fail; fix: update loader.test.ts to add quest type fixture |
| A4 | dialogueStore.relationshipValue should be flushed to RelationStore at endDialogue() | Architecture Patterns § Reputation Gate | If not flushed: persistent reputation not accumulated from dialogue deltas |
| A5 | `archiveSummary` in Phase 3 is rule-assembled text (string concatenation of salientMemories) | Pattern 6 / NPC Memory | If LLM expected: Phase 3 won't have AI-quality summaries (Phase 5 upgrades) |
| A6 | `mkdirSync` from `node:fs` is available in Bun | Code Examples | Alternative: Bun.mkdirSync if node:fs not available (both work in Bun 1.3.12) |

---

## Open Questions

1. **Inventory store absent from v1 SaveData**
   - What we know: PlayerState includes `equipment` (weapon/armor/accessory slots) but there is no separate InventoryStore. D-05 mentions `inventory` store in the embedded list.
   - What's unclear: Does "inventory" mean a new store needs creating in Phase 3, or does it refer to `playerStore.equipment`?
   - Recommendation: D-05 likely refers to `playerStore` (which covers inventory/equipment). If a separate InventoryStore was planned, it should be clarified before planning. Current assumption: no new InventoryStore; `playerStore` covers it.

2. **Quest event log location in save file**
   - What we know: D-05 says Quest Event Log is "完整内嵌存档文件." This conflicts with the mutable store pattern — the event log is append-only and grows indefinitely.
   - What's unclear: Should the event log be part of QuestStore.setState() or a separate append-only data structure outside the store?
   - Recommendation: Keep a `questEventLog: QuestEvent[]` as a standalone array (not inside QuestStore) that is serialized into SaveDataV2 separately. QuestStore holds only current progress; the log is the audit trail.

3. **`:load` command UX — how to pick a save slot**
   - What we know: D-02 has unlimited named saves + 1 quicksave. The command registry has `:save [name]` already.
   - What's unclear: `:load` with no argument should show a list — is this a TUI picker (Ink Select component) or a text list?
   - Recommendation: Use `@inkjs/ui` Select component for `:load` (already installed). List saves from the saves directory, sorted by timestamp.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun runtime | All I/O (Bun.file, Bun.write) | Yes | 1.3.12 | — |
| Node.js (fs module) | mkdirSync for save dir creation | Yes | 24.14.0 | Bun.mkdirSync |
| `env-paths` (npm) | Save directory platform path | Not installed | 4.0.0 (latest) | Manual process.platform switch |
| `yaml` package | Quest template YAML load/write | Yes | 2.8.3 | — |
| TypeScript | All new modules | Yes (Bun native) | 5.x | — |

**Missing dependencies with no fallback:**
- None that block execution.

**Missing dependencies with fallback:**
- `env-paths`: Not currently installed. Install with `bun add env-paths`, or implement manual platform switch (Claude's Discretion per D-01).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | bun test (built-in, Jest-compatible) |
| Config file | none — bun discovers `*.test.ts` automatically |
| Quick run command | `bun test src/state/quest-store.test.ts -t "QuestStore"` |
| Full suite command | `bun test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAVE-01 | SaveDataV2 snapshot includes all stores + metadata | unit | `bun test src/state/serializer.test.ts` | Exists (needs update) |
| SAVE-01 | v1→v2 migration produces valid v2 | unit | `bun test src/persistence/save-migrator.test.ts` | Wave 0 gap |
| SAVE-01 | Named save creates file with correct name format | unit | `bun test src/persistence/save-file-manager.test.ts` | Wave 0 gap |
| SAVE-01 | Quicksave writes quicksave.json | unit | `bun test src/persistence/save-file-manager.test.ts` | Wave 0 gap |
| WORLD-02 | NpcMemoryRecord three-layer schema validates | unit | `bun test src/state/npc-memory-store.test.ts` | Exists (needs update) |
| WORLD-02 | Memory persistence writes index.json + npcId.json on memory written event | unit | `bun test src/persistence/memory-persistence.test.ts` | Wave 0 gap |
| WORLD-02 | Memory retrieval returns recentMemories + salientMemories combined | unit | `bun test src/persistence/memory-persistence.test.ts` | Wave 0 gap |
| WORLD-03 | QuestStore accepts quest and emits quest_started | unit | `bun test src/state/quest-store.test.ts` | Wave 0 gap |
| WORLD-03 | QuestStore objective completion updates completedObjectives | unit | `bun test src/state/quest-store.test.ts` | Wave 0 gap |
| WORLD-03 | QuestSystem.acceptQuest() gates on reputation threshold | unit | `bun test src/engine/quest-system.test.ts` | Wave 0 gap |
| WORLD-03 | Journal renders active/completed/failed quests from store | unit | `bun test src/ui/panels/journal-panel.test.tsx` | Wave 0 gap |
| WORLD-04 | RelationStore reputation delta applies correctly | unit | `bun test src/state/relation-store.test.ts` | Wave 0 gap |
| WORLD-04 | Dialogue attitude label correct per threshold | unit | `bun test src/engine/reputation-system.test.ts` | Wave 0 gap |
| WORLD-04 | Dialogue response locked when reputation below min | unit | `bun test src/engine/dialogue-manager.test.ts` | Exists (needs extension) |
| CONT-01 | All 8-10 locations valid codex entries (loader validates) | integration | `bun test src/codex/loader.test.ts` | Exists (will auto-cover) |
| CONT-03 | Quest templates load and validate against QuestTemplateSchema | integration | `bun test src/codex/loader.test.ts` | Exists (needs extension) |

### Sampling Rate
- **Per task commit:** `bun test` (full suite, 278→~350 tests, runs in ~400ms)
- **Per wave merge:** `bun test` (same — fast enough to run every commit)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/persistence/save-file-manager.test.ts` — covers SAVE-01 file operations (mock Bun.write)
- [ ] `src/persistence/save-migrator.test.ts` — covers SAVE-01 v1→v2 migration
- [ ] `src/persistence/memory-persistence.test.ts` — covers WORLD-02 disk persistence
- [ ] `src/state/quest-store.test.ts` — covers WORLD-03 quest accept/progress/complete
- [ ] `src/engine/quest-system.test.ts` — covers WORLD-03 reputation gate
- [ ] `src/state/relation-store.test.ts` — covers WORLD-04 reputation tracking
- [ ] `src/engine/reputation-system.test.ts` — covers WORLD-04 attitude thresholds
- [ ] `src/ui/panels/journal-panel.test.tsx` — covers WORLD-03 Journal display
- [ ] Update `src/state/serializer.test.ts` — extend for v2 schema and new stores
- [ ] Update `src/state/new-stores.test.ts` — update NpcMemoryStore for three-layer schema
- [ ] Update `src/engine/dialogue-manager.test.ts` — add reputation gate tests

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | yes | Zod safeParse on save file load; Zod on YAML codex entries |
| V6 Cryptography | no | n/a |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/tampered save file | Tampering | `SaveDataV2Schema.safeParse` with detailed error reporting — existing pattern in serializer.ts |
| Crafted YAML codex injection | Tampering | `CodexEntrySchema.safeParse` on every entry at load time — existing pattern in loader.ts |
| Path traversal in `--save-dir` argument | Tampering | Resolve to absolute path and validate it doesn't escape expected root before writing |

---

## Sources

### Primary (HIGH confidence)
- `src/state/serializer.ts` — v1 SaveData schema, restore pattern with Object.assign
- `src/state/npc-memory-store.ts` — existing NpcMemoryEntry schema to extend
- `src/state/create-store.ts` — Store pattern used by all new stores
- `src/events/event-types.ts` — DomainEvents type to extend with new events
- `src/engine/dialogue-manager.ts` — integration point for reputation gates and quest triggers
- `src/input/command-registry.ts` — command registration pattern for new commands
- `src/codex/loader.ts` — codex loading pattern reused for quest templates
- `src/codex/schemas/entry-types.ts` — CodexEntrySchema to extend with QuestTemplateSchema
- `src/data/codex/locations.yaml` / `npcs.yaml` / `factions.yaml` — existing stubs to expand
- `package.json` — installed dependencies (no new deps needed except env-paths)
- `bun test` output — 278 tests passing, green baseline [VERIFIED: 2026-04-21]

### Secondary (MEDIUM confidence)
- npm view env-paths version → 4.0.0 [VERIFIED: npm registry 2026-04-21]
- env-paths description: "Get paths for storing things like data, config, cache, etc" — cross-platform standard

### Tertiary (LOW confidence — marked [ASSUMED] in Assumptions Log)
- Schema field naming conventions for Quest/Relation stores (based on established Zod patterns in project)
- `archiveSummary` rule-assembly logic (based on D-09 description)
- Reputation threshold values for dialogue attitude labels (Claude's Discretion per D-16)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against package.json and npm registry
- Architecture: HIGH — based on direct codebase inspection of all integration points
- Pitfalls: HIGH — derived from actual code paths and schema shapes found in codebase
- Content (YAML expansion): HIGH — existing structure is clear, expansion follows same pattern

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable stack, 30 days)
