# Blackpine Narrative Layering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `deep-research-report (2).md` 的黑松镇升级剧本拆成可运行、可渐进揭示、不会提前剧透的世界数据。

**Architecture:** 不改运行时代码，保留运行时依赖的关键 quest stage ID，通过 authoring v2 世界数据升级剧情职责。主线阶段控制信息揭示，地点承载玩家可见线索，NPC 承载有限认知和立场，`world_effects` 与 `narrative-transitions.yaml` 承载剧情推进后的世界记忆和氛围变化。

**Tech Stack:** YAML world-data、Codex Zod schemas、Bun test、TypeScript validation tests。

---

## File Structure

- Modify: `world-data/codex/quests.yaml`
  - 重写 `quest_main_01` 的阶段描述、目标、分支与 `world_effects`。
  - 保留关键 stage ID：`stage_rumor`、`stage_disappearances`、`stage_truth_in_forest`、`stage_mayor_secret`、`stage_allies_decision`、三条 `stage_consequence_*`，避免破坏 `dialogue-manager.ts` 的路线锁定和现有 narrative-state 测试。
- Modify: `world-data/codex/locations.yaml`
  - 将升级剧本拆到酒馆、集市、北门、神殿、废弃营地、黑暗洞穴、主街等地点。
  - 添加或调整 `player_facing`、`interactables`、`objects`、`ai_grounding`、`description_overrides`、`ecology`。
- Modify: `world-data/codex/npcs.yaml`
  - 更新现有老陈、陈铁柱、月华、王德、阿鬼、普通守卫、阿福、林婆婆等条目，不新增重复 ID。
  - 只通过 `knowledge_profile`、`ai_grounding`、`voice`、`social_memory` 表达“知道什么/不该说什么”。
- Modify: `world-data/codex/history_events.yaml`
  - 将狼灾官方记录、狼灾隐情、逐名印、灰契会债契拆为不同可信层级的历史条目。
- Modify: `world-data/codex/factions.yaml`
  - 如果已有合适灰契会条目则更新；否则新增 `faction_grey_covenant`，并补齐 faction schema 必填字段。
- Modify: `world-data/narrative-transitions.yaml`
  - 保留关键 stage ID，更新 act、atmosphere、knowledge_level、world_flags。
- Test: `src/codex/loader.test.ts`
  - 验证所有 YAML 仍可被 `loadAllCodex` 读取并通过 schema。
- Test: `src/codex/world-data-audit.test.ts`
  - 验证世界旗标与 `world_effects` 对齐，且玩家可见文本不包含 AI-only 标记。
- Test: `src/engine/narrative-state-watcher.test.ts`
  - 如更新 transition 期望，保持旧 stage ID 对应的新氛围和 flags 可被监听器正确应用。

---

### Task 1: Add Narrative Data Guard Tests

**Files:**
- Modify: `src/codex/world-data-audit.test.ts`
- Test: `src/codex/world-data-audit.test.ts`

- [ ] **Step 1: Write failing audit for upgraded main quest responsibilities**

Add a test that verifies `quest_main_01` preserves the runtime-safe stage IDs and includes upgraded narrative responsibilities:

```ts
const requiredMainStages = new Set([
  "stage_rumor",
  "stage_disappearances",
  "stage_truth_in_forest",
  "stage_mayor_secret",
  "stage_allies_decision",
  "stage_consequence_justice",
  "stage_consequence_harmony",
  "stage_consequence_shadow",
]);
```

Assert:
- each required stage exists;
- `stage_allies_decision` still exists because `dialogue-manager.ts` uses it to lock route flags;
- `stage_allies_decision.conditional_next_stages` still references `justice_score_locked`、`shadow_score_locked`、`pragmatism_score_locked`;
- every stage referenced in `narrative-transitions.yaml` exists in the quest.

- [ ] **Step 2: Add audit for upgraded content anchors**

Assert the main quest contains content anchors for `名字`、`名单`、`逐名印`、`灰契会`、`静灯祭` somewhere in `description`、`stages[].description`、or structured world effects. This should fail before the data rewrite.

- [ ] **Step 3: Add audit for reveal safety**

Add a test that scans runtime-visible quest/location/NPC strings and fails if public-facing text contains direct backstage markers such as `逐名印原理是`、`灰契会真正目的`、`王德五年前签下债契`、`系统真相`.

- [ ] **Step 4: Run test to verify it fails for missing content anchors**

Run: `bun test src/codex/world-data-audit.test.ts`

Expected: FAIL because current world data does not yet contain the upgraded anchors. Stage ID preservation checks should PASS.

---

### Task 2: Rewrite Main Quest Spine Without Renaming Runtime IDs

**Files:**
- Modify: `world-data/codex/quests.yaml`
- Test: `src/codex/world-data-audit.test.ts`

- [ ] **Step 1: Reassign existing stages to upgraded dramatic jobs**

Use the existing stage IDs with these responsibilities:

```yaml
- id: stage_rumor
  description: 雨夜入镇与酒馆命案——空棺葬礼、北门提前落闸，濒死猎人留下“它们在找名字”的遗言。
- id: stage_disappearances
  description: 名单异常——通过住宿本、税册、祈名册和放行记录发现五年前死者记录互相矛盾。
- id: stage_truth_in_forest
  description: 废弃营地与黑暗洞穴——被拔掉姓名牌的床位、烧残值夜记录和债印石证明狼灾是筛选式猎杀。
- id: stage_mayor_secret
  description: 镇长的债契——王德五年前为保住黑松镇，与灰契会达成以黑银矿、通道和名字为代价的秘密协议。
- id: stage_allies_decision
  description: 静灯祭选择——王德、陈铁柱、月华、阿鬼和灰契会压力汇聚，玩家决定黑松镇以后靠什么活下去。
```

Keep final stages as `stage_consequence_justice`、`stage_consequence_harmony`、`stage_consequence_shadow`.

- [ ] **Step 2: Wire triggers and objectives**

Use existing supported objective types only: `talk`、`visit_location`、`find_item`、`check_flag`。Do not invent new objective types. Preserve route flag names in `conditional_next_stages`.

- [ ] **Step 3: Rewrite `world_effects.on_stage_enter`**

Create facts/rumors/beliefs for each stage. Every world flag in `narrative-transitions.yaml` must have a matching seed id or `flag:<flag>` tag.

- [ ] **Step 4: Run quest audit**

Run: `bun test src/codex/world-data-audit.test.ts`

Expected: PASS for stage preservation, content anchors, reveal safety, and flag consistency.

---

### Task 3: Layer History and Faction Truth

**Files:**
- Modify: `world-data/codex/history_events.yaml`
- Modify: `world-data/codex/factions.yaml`
- Test: `src/codex/loader.test.ts`

- [ ] **Step 1: Keep official wolf disaster public**

Retain the official record as public-facing: wolves attacked, guard and militia repelled them, town never fully recovered.

- [ ] **Step 2: Add hidden/contested truth layers**

Add separate history entries for:

```yaml
- event_wolf_disaster_named_hunt
- event_nameward_seal_origin
- event_grey_covenant_debt_contract
```

Each new history event must include all strict schema fields: common fields `id`、`name`、`tags`、`description`、`epistemic`、`player_facing`、`ai_grounding`、`ecology`; history fields `type: history_event`、`date`、`participants`、`impact`、`era`; valid `epistemic.visibility` (`hidden`、`secret`、or `forbidden`; never `restricted`); `player_facing.short_label`; and `ai_grounding.reveal_policy.default: gated_by_visibility_or_stage`.

- [ ] **Step 3: Add or update Grey Covenant faction**

Represent 灰契会 as a cold contractual force, not a generic villain. If adding `faction_grey_covenant`, include all strict schema fields: common fields `id`、`name`、`tags`、`description`、`epistemic`、`player_facing`、`ai_grounding`、`ecology`; faction fields `type: faction`、`territory`、`alignment`、`goals`、`rivals`、`information_network`、`reaction_policy`.

```yaml
id: faction_grey_covenant
name: 灰契会
type: faction
territory: 北林边境节点与黑银矿路暗线
alignment: contractual_predatory
goals: [control_border_nodes, secure_black_silver_supply, maintain_name_debt_contracts]
rivals: [faction_guard, faction_temple, faction_shadow_guild]
player_facing:
  short_label: 灰契会
information_network: {}
reaction_policy: {}
```

Keep `information_network` and `reaction_policy` blocks present, even if minimal.

- [ ] **Step 4: Run loader tests**

Run: `bun test src/codex/loader.test.ts`

Expected: PASS; all new entries validate under strict schemas and expose `player_facing.short_label`.

---

### Task 4: Rewrite Locations as Investigation Nodes

**Files:**
- Modify: `world-data/codex/locations.yaml`
- Test: `src/codex/loader.test.ts`
- Test: `src/codex/world-data-audit.test.ts`

- [ ] **Step 1: Map each location to one dramatic job**

Use this mapping:

```text
loc_north_gate: 秩序异常，提前落闸、夜巡记录、车辙和狼爪印
loc_tavern: 开场钩子，猎人死亡、老陈的民间档案、半真传言
loc_market: 社会压力，矿路封锁、货价、税册、维稳现实
loc_temple: 超自然规则，裂钟、祈名册、不要回应全名
loc_abandoned_camp: 物证冲击，被拔姓名牌、值夜名册、烧残记录
loc_dark_cave: 真相揭示，债印石、黑银矿脉、灰契会账目
loc_main_street: 静灯祭对峙，公开真相或压回秘密的舞台
```

- [ ] **Step 2: Update `player_facing` and `interactables`**

Add concrete interactables such as `guest_register`、`prayer_namebook`、`cracked_bell`、`burned_watchlist`、`debt_seal_stone`。Whenever an interactable id is added, also add it to the location `objects` array.

- [ ] **Step 3: Update `ai_grounding`**

For each location, state what the AI may imply and what it must not reveal yet. Keep direct truth out of `player_facing`; place it in `ai_grounding` or `ecology`.

- [ ] **Step 4: Run loader and audit tests**

Run: `bun test src/codex/loader.test.ts src/codex/world-data-audit.test.ts`

Expected: PASS; no object/interactable mismatch or AI-only leakage.

---

### Task 5: Rewrite Existing NPC Knowledge and Voices

**Files:**
- Modify: `world-data/codex/npcs.yaml`
- Test: `src/codex/loader.test.ts`

- [ ] **Step 1: Reframe existing core NPCs**

Update existing entries; do not duplicate these IDs:

```text
npc_bartender: 民间记忆，知道名单改动和阿鬼身份，但永远留半句
npc_captain: 秩序内的反抗者，先怀疑阻挠，后选择公开真相
npc_priestess: 知道逐名印代价，先给保命规则，后解释术式
npc_elder: 必要之恶，相信自己有权决定可承受的牺牲
npc_shadow_contact: 真相交易者，相信秘密落到谁手里谁才是真镇长
npc_guard: 普通秩序感知者，只能说巡逻异常和提前落闸
npc_merchant_afu: 市场压力和账本线索，不知道完整幕后
npc_herbalist: 旧守印传承边缘线索，知道禁地但不掌握全局
```

- [ ] **Step 2: Gate reveals by trust and stage**

Avoid giving any NPC full truth at low trust. Use `knowledge_profile.hidden_knowledge` for what they know and `trust_gates` for what they will say.

- [ ] **Step 3: Add Grey Envoy only if needed**

If the final confrontation needs an embodied 灰契会 voice, add `npc_grey_envoy` with all strict schema fields: common fields `id`、`name`、`tags`、`description`、`epistemic`、`player_facing`、`ai_grounding`、`ecology`; NPC fields `type: npc`、`location_id`、`personality_tags`、`goals`、`backstory`、`initial_disposition`、`knowledge_profile`、`voice`、`social_memory`.

- [ ] **Step 4: Preserve voice and secrecy**

Each NPC should speak from motive, not exposition. Keep `must_not_invent` guardrails for forbidden direct reveals.

- [ ] **Step 5: Run NPC loader test**

Run: `bun test src/codex/loader.test.ts`

Expected: PASS; all NPC entries validate.

---

### Task 6: Align Narrative Transitions While Preserving IDs

**Files:**
- Modify: `world-data/narrative-transitions.yaml`
- Test: `src/codex/world-data-audit.test.ts`
- Test: `src/engine/narrative-state-watcher.test.ts`

- [ ] **Step 1: Update existing stage transitions**

Map existing stages to upgraded acts:

```yaml
stage_rumor: act1, [rain, mundane, unnamed_dread]
stage_disappearances: act1, [records, suspicion, peeling_order]
stage_truth_in_forest: act2, [dread, evidence, hunted_by_name]
stage_mayor_secret: act2, [revelation, debt, fractured_trust]
stage_allies_decision: act3, [confrontation, public_truth, weight_of_choice]
```

Keep ending stages as consequence states.

- [ ] **Step 2: Add world flags only when backed by effects**

Use flags like `name_hunt_known`、`records_contradict_official_story`、`debt_seal_revealed`、`lantern_festival_confrontation` only if matching world effects exist.

- [ ] **Step 3: Update narrative-state watcher expectations if needed**

If atmosphere tags or flags changed for `stage_disappearances` or `stage_truth_in_forest`, update `src/engine/narrative-state-watcher.test.ts` to the new expected values while preserving the same stage IDs.

- [ ] **Step 4: Run transition tests**

Run: `bun test src/codex/world-data-audit.test.ts src/engine/narrative-state-watcher.test.ts`

Expected: PASS; every transition stage exists, every true flag has a matching world effect seed, and watcher tests reflect the upgraded atmosphere.

---

### Task 7: Final Validation

**Files:**
- Verify: `world-data/**`, `src/codex/**`, `src/engine/narrative-state-watcher.test.ts`

- [ ] **Step 1: Run focused tests**

Run: `bun test src/codex/loader.test.ts src/codex/world-data-audit.test.ts src/engine/narrative-state-watcher.test.ts`

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`

Expected: PASS.

- [ ] **Step 3: Run full test suite if focused checks pass**

Run: `bun test`

Expected: PASS, or report unrelated pre-existing failures without fixing them.

- [ ] **Step 4: Review changed files**

Run: `git diff -- world-data/codex/quests.yaml world-data/codex/locations.yaml world-data/codex/npcs.yaml world-data/codex/history_events.yaml world-data/codex/factions.yaml world-data/narrative-transitions.yaml src/codex/world-data-audit.test.ts src/engine/narrative-state-watcher.test.ts`

Expected: Diff shows runtime-ID-preserving narrative layering plus targeted audit/test updates.

- [ ] **Step 5: Stop before commit**

Do not commit unless the user explicitly asks for a commit. Report validation results and changed files.
