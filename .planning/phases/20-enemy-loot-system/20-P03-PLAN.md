---
phase: 20-enemy-loot-system
plan: 03
type: execute
wave: 3
depends_on:
  - "20-P01"
files_modified:
  - src/state/serializer.ts
  - src/persistence/save-migrator.ts
  - src/persistence/save-migrator.test.ts
autonomous: true
requirements:
  - GAME-01

must_haves:
  truths:
    - "存档格式为 V6，droppedItems 随 scene 字段一并序列化/反序列化"
    - "V5 存档加载时 migrateV5ToV6 补全 scene.droppedItems 默认值 []"
    - "V6 存档保存后重新加载，droppedItems 内容与存档前一致"
  artifacts:
    - path: "src/state/serializer.ts"
      provides: "SaveDataV6Schema + snapshot version:6 + restore V6 first"
      exports: ["SaveDataV6Schema", "SaveDataV6"]
    - path: "src/persistence/save-migrator.ts"
      provides: "migrateV5ToV6 函数"
      exports: ["migrateV5ToV6"]
  key_links:
    - from: "serializer.ts snapshot()"
      to: "SaveDataV6"
      via: "data: SaveDataV6 = { version: 6, scene, ... }"
      pattern: "version: 6"
    - from: "serializer.ts restore()"
      to: "migrateV5ToV6"
      via: "迁移链 migrateV5ToV6(migrateV4ToV5(...))"
      pattern: "migrateV5ToV6"
---

<objective>
将存档格式升级至 V6，确保 droppedItems 随场景状态持久化，V5 旧存档自动迁移。

Purpose: 完成 LOOT-02「存档序列化需包含当前场景的 droppedItems」的要求，使战利品在存档/读档后持久化。
Output: serializer.ts 升级至 V6，save-migrator.ts 新增 migrateV5ToV6。
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/20-enemy-loot-system/20-P01-SUMMARY.md
@.planning/phases/20-enemy-loot-system/20-P02-SUMMARY.md

<interfaces>
<!-- 来自 serializer.ts 当前状态（P03 执行前读取确认）-->

当前存档版本：SaveDataV5（version: 5）
迁移链：migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(raw))))
restore() fallback 顺序：V5 → V4 → V3

目标状态：
- SaveDataV6Schema = SaveDataV5Schema.extend({ version: z.literal(6) })
  （scene 字段已经包含 droppedItems，因为 SceneStateSchema 在 P01 已更新）
- snapshot() data: SaveDataV6 = { version: 6, ... }
- restore() 迁移链：migrateV5ToV6(migrateV4ToV5(...))
- restore() fallback 顺序：V6 → V5 → V4 → V3

From src/persistence/save-migrator.ts (migrateV4ToV5 模板):
```typescript
export function migrateV4ToV5(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const data = raw as Record<string, unknown>;
  if (data['version'] !== 4) return raw;
  return {
    ...data,
    version: 5,
    narrativeState: getDefaultNarrativeState(),
  };
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: save-migrator.ts — 新增 migrateV5ToV6</name>
  <files>src/persistence/save-migrator.ts, src/persistence/save-migrator.test.ts</files>
  <read_first>
    - src/persistence/save-migrator.ts (全文，确认现有函数结构和 import)
    - src/persistence/save-migrator.test.ts (确认现有测试结构以便追加)
  </read_first>
  <behavior>
    - 测试 1：输入 version=5 的对象（scene 中无 droppedItems）→ 输出 version=6，scene.droppedItems = []
    - 测试 2：输入 version=5 的对象（scene 中已有 droppedItems: ['item_wolf_pelt']）→ 输出保留该值
    - 测试 3：输入 version=4 的对象 → 原样返回（非本函数处理范围）
    - 测试 4：输入 null → 原样返回
  </behavior>
  <action>
**TDD 流程：先写测试（RED），再写实现（GREEN）。**

**RED — 在 save-migrator.test.ts 追加：**

```typescript
describe('migrateV5ToV6', () => {
  it('upgrades version 5 to 6 and adds droppedItems default []', () => {
    const v5 = { version: 5, scene: { sceneId: 'town', objects: [] } };
    const result = migrateV5ToV6(v5) as Record<string, unknown>;
    expect(result['version']).toBe(6);
    const scene = result['scene'] as Record<string, unknown>;
    expect(scene['droppedItems']).toEqual([]);
  });

  it('preserves existing droppedItems when already present', () => {
    const v5 = { version: 5, scene: { sceneId: 'town', droppedItems: ['item_wolf_pelt'] } };
    const result = migrateV5ToV6(v5) as Record<string, unknown>;
    const scene = result['scene'] as Record<string, unknown>;
    expect(scene['droppedItems']).toEqual(['item_wolf_pelt']);
  });

  it('returns non-version-5 objects unchanged', () => {
    const v4 = { version: 4 };
    expect(migrateV5ToV6(v4)).toEqual(v4);
  });

  it('returns null unchanged', () => {
    expect(migrateV5ToV6(null)).toBeNull();
  });
});
```

**GREEN — 在 save-migrator.ts 末尾追加（getDefaultSceneState 的 import 不需要，直接使用 `[]` 默认值）：**

```typescript
export function migrateV5ToV6(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const data = raw as Record<string, unknown>;
  if (data['version'] !== 5) return raw;
  const scene = (data['scene'] as Record<string, unknown> | undefined) ?? {};
  return {
    ...data,
    version: 6,
    scene: {
      ...scene,
      droppedItems: scene['droppedItems'] ?? [],
    },
  };
}
```
  </action>
  <verify>
    <automated>bun test src/persistence/save-migrator.test.ts 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep "migrateV5ToV6" src/persistence/save-migrator.ts` 有输出
    - `grep "version.*6" src/persistence/save-migrator.ts` 有输出
    - 4 个新增 migrateV5ToV6 测试全部通过（GREEN）
    - `bun test src/persistence/save-migrator.test.ts` 无回归失败
  </acceptance_criteria>
  <done>migrateV5ToV6 函数实现完整，4 个测试通过。</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: serializer.ts — SaveDataV6Schema + snapshot/restore 升级</name>
  <files>src/state/serializer.ts</files>
  <read_first>
    - src/state/serializer.ts (全文，确认当前 V5 schema、snapshot() 实现、restore() 迁移链和 fallback 逻辑)
  </read_first>
  <action>
**三处修改，按顺序执行：**

**1. import 区 — 引入 migrateV5ToV6：**

将：
```typescript
import { migrateV1ToV2, migrateV2ToV3, migrateV3ToV4, migrateV4ToV5 } from '../persistence/save-migrator';
```
改为：
```typescript
import { migrateV1ToV2, migrateV2ToV3, migrateV3ToV4, migrateV4ToV5, migrateV5ToV6 } from '../persistence/save-migrator';
```

**2. schema 定义区 — 在 SaveDataV5Schema 之后追加 V6：**

在 `export type SaveDataV5 = z.infer<typeof SaveDataV5Schema>;` 之后追加：
```typescript
export const SaveDataV6Schema = SaveDataV5Schema.extend({
  version: z.literal(6),
});
export type SaveDataV6 = z.infer<typeof SaveDataV6Schema>;
```

注意：SaveDataV5Schema 包含 `scene: SceneStateSchema`，而 SceneStateSchema（P01 已更新）现在含 `droppedItems`。因此 V6 只需 version 字段更新，scene 自动携带 droppedItems。

**3. snapshot() — 版本号改为 6：**

将：
```typescript
const data: SaveDataV5 = {
  version: 5,
```
改为：
```typescript
const data: SaveDataV6 = {
  version: 6,
```
（其余字段不变，scene 已包含 droppedItems。）

**4. restore() — 迁移链和 fallback 升级：**

将：
```typescript
const migrated = migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(raw))));

const v5Result = SaveDataV5Schema.safeParse(migrated);
const v4Result = v5Result.success ? null : SaveDataV4Schema.safeParse(migrated);
const v3Fallback = (v5Result.success || v4Result?.success) ? null : SaveDataV3Schema.safeParse(migrated);
const result = v5Result.success ? v5Result : (v4Result?.success ? v4Result : v3Fallback);
```
改为：
```typescript
const migrated = migrateV5ToV6(migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(raw)))));

const v6Result = SaveDataV6Schema.safeParse(migrated);
const v5Result = v6Result.success ? null : SaveDataV5Schema.safeParse(migrated);
const v4Result = (v6Result.success || v5Result?.success) ? null : SaveDataV4Schema.safeParse(migrated);
const v3Fallback = (v6Result.success || v5Result?.success || v4Result?.success) ? null : SaveDataV3Schema.safeParse(migrated);
const result = v6Result.success ? v6Result : (v5Result?.success ? v5Result : (v4Result?.success ? v4Result : v3Fallback));
```

同时更新错误诊断行（第一个 safeParse 错误来源）：
```typescript
const firstIssue = v6Result.error?.issues?.[0];
const detail = firstIssue
  ? `${firstIssue.path.join('.')} — ${firstIssue.message}`
  : v6Result.error?.message ?? 'unknown error';
```

最后，在 restore() 末尾的 narrativeState 恢复块之后，追加 narrativeState 在 V6 也恢复（V6 extends V5，所以 `data as SaveDataV6` 也有 narrativeState）：

当前末尾：
```typescript
if (v5Result.success) {
  stores.narrativeStore.restoreState((data as SaveDataV5).narrativeState);
}
```
改为：
```typescript
if (v6Result.success || v5Result?.success) {
  stores.narrativeStore.restoreState((data as SaveDataV5).narrativeState);
}
```
  </action>
  <verify>
    <automated>bun tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <acceptance_criteria>
    - `grep "SaveDataV6Schema" src/state/serializer.ts` 至少 3 处（定义、snapshot、restore）
    - `grep "version: 6" src/state/serializer.ts` 有输出（snapshot 产生 V6）
    - `grep "migrateV5ToV6" src/state/serializer.ts` 有输出（restore 迁移链）
    - `grep "v6Result" src/state/serializer.ts` 有输出（restore fallback 含 V6）
    - `bun tsc --noEmit 2>&1 | grep -v "summarizer-worker\|quest-handler.test\|game-loop.test"` 无额外错误
    - `bun test src/state/serializer` 通过（若测试文件存在）
    - `bun test` 全量通过，无回归
  </acceptance_criteria>
  <done>serializer.ts 产生 version:6 存档；restore() 可解析 V6/V5/V4/V3 存档并迁移；droppedItems 随 scene 字段自动持久化。</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| 磁盘存档 JSON → restore() | 存档文件可能来自旧版本（V3-V5），需迁移；也可能被篡改（恶意 JSON） |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20-06 | Tampering | droppedItems in save file | mitigate | restore() 通过 Zod SaveDataV6Schema.safeParse 验证；droppedItems 是 z.array(z.string())，非字符串数组会被 Zod 拒绝 |
| T-20-07 | Tampering | 注入非法 item ID 通过 droppedItems | accept | droppedItems 中的字符串只用于 codex lookup（返回 undefined 则降级显示 ID）；不影响战斗或系统安全 |
| T-20-08 | Denial of Service | 超大 droppedItems 数组 | accept | 场景切换重置 droppedItems；单次战斗掉落物数量由 loot_table 长度决定，开发者控制 |
</threat_model>

<verification>
1. `bun test src/persistence/save-migrator.test.ts` → migrateV5ToV6 4 个测试通过
2. `grep "version: 6" src/state/serializer.ts` → 有输出
3. `grep "migrateV5ToV6" src/state/serializer.ts` → 有输出
4. `bun tsc --noEmit` → 无新增类型错误
5. `bun test` → 全量通过（1062+ tests）
6. 手动验证：snapshot() 产生的 JSON 中 scene 字段含 droppedItems
</verification>

<success_criteria>
- migrateV5ToV6 函数正确将 V5 存档升级到 V6，补全 scene.droppedItems 默认值
- snapshot() 产生 version:6 存档，含 droppedItems 字段
- restore() 可解析 V6、V5、V4、V3 全部格式
- 全量测试通过，TypeScript 无新增错误
- Phase 20 成功标准全部满足：loot_table in YAML、:look 显示掉落、:take 可拾取、save/load 持久化
</success_criteria>

<output>
完成后创建 `.planning/phases/20-enemy-loot-system/20-P03-SUMMARY.md`
</output>
