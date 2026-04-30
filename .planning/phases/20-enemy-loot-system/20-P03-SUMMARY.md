---
phase: 20-enemy-loot-system
plan: "03"
subsystem: persistence
tags: [save-system, migration, serialization, v6]
dependency_graph:
  requires: [20-P01, 20-P02]
  provides: [SaveDataV6Schema, migrateV5ToV6, droppedItems-persistence]
  affects: [save-file-manager, compare-panel, panel-router, game-screen, branch-diff]
tech_stack:
  added: []
  patterns: [version-migration-chain, zod-schema-extend]
key_files:
  created: []
  modified:
    - src/persistence/save-migrator.ts
    - src/persistence/save-migrator.test.ts
    - src/state/serializer.ts
    - src/state/serializer.test.ts
    - src/persistence/save-file-manager.ts
    - src/persistence/save-file-manager.test.ts
    - src/e2e/phase1-verification.test.ts
    - src/ui/panels/compare-panel.tsx
    - src/ui/panels/panel-router.tsx
    - src/ui/screens/game-screen.tsx
    - src/engine/branch-diff.ts
decisions:
  - "SaveDataV6Schema extends SaveDataV5Schema — scene.droppedItems 通过 SceneStateSchema 自动携带，无需额外字段声明"
  - "branch-diff.ts SaveDataCompare 联合类型扩展至 V4|V5|V6，保持向后兼容"
  - "readSaveData() 同步升级至 V6 — 直接解析，不走迁移链"
metrics:
  duration: "~20min"
  completed: "2026-04-30"
  tasks_completed: 2
  files_changed: 11
---

# Phase 20 Plan 03: SaveDataV6 + migrateV5ToV6 + droppedItems persistence Summary

SaveDataV6 存档格式升级：`migrateV5ToV6` 迁移函数 + `SaveDataV6Schema` + snapshot/restore 全链路升级，确保 `droppedItems` 随场景状态完整持久化。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | migrateV5ToV6 (TDD RED→GREEN) | 6cbdd04 | save-migrator.ts, save-migrator.test.ts |
| 2 | SaveDataV6Schema + snapshot/restore upgrade | d22c848 | serializer.ts + 9 files |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 测试文件硬编码 version:5 导致 6 个测试失败**
- **Found during:** Task 2 验证
- **Issue:** serializer.test.ts、phase1-verification.test.ts、save-file-manager.test.ts 中的断言和 mock 数据硬编码 `version: 5`，snapshot 升级到 V6 后全部失败
- **Fix:** 更新测试断言为 `version: 6`，SaveDataV5Schema.safeParse → SaveDataV6Schema.safeParse，mock 数据 version 字段及 scene 补充 droppedItems
- **Files modified:** serializer.test.ts, phase1-verification.test.ts, save-file-manager.test.ts
- **Commit:** d22c848

**2. [Rule 1 - Bug] readSaveData() 返回类型及 SaveDataV5 类型引用级联**
- **Found during:** Task 2 tsc 检查
- **Issue:** save-file-manager.ts `readSaveData` 返回 `Promise<SaveDataV5>`；compare-panel、panel-router、game-screen、branch-diff 中的 `SaveDataV5` 类型引用与新 `readSaveData` 签名不匹配，产生 TS2719
- **Fix:** save-file-manager.ts 升级至 `SaveDataV6Schema.parse`；UI 文件类型引用更新为 `SaveDataV6`；branch-diff.ts 联合类型扩展至 `SaveDataV4 | SaveDataV5 | SaveDataV6`
- **Files modified:** save-file-manager.ts, compare-panel.tsx, panel-router.tsx, game-screen.tsx, branch-diff.ts
- **Commit:** d22c848

## Verification Results

- `bun test src/persistence/save-migrator.test.ts` → 32 pass (含 4 个新增 migrateV5ToV6 测试)
- `grep "SaveDataV6Schema" src/state/serializer.ts` → 3 处
- `grep "version: 6" src/state/serializer.ts` → 1 处
- `grep "migrateV5ToV6" src/state/serializer.ts` → 2 处
- `bun tsc --noEmit` → 无新增类型错误（预存 5 个错误不变）
- `bun test` → 1115 pass, 0 fail

## Known Stubs

None.

## Threat Flags

None — droppedItems 通过 `z.array(z.string())` Zod 验证，符合 T-20-06 缓解方案。

## Self-Check: PASSED

- src/persistence/save-migrator.ts — FOUND
- src/state/serializer.ts — FOUND
- Commit 6cbdd04 — FOUND
- Commit d22c848 — FOUND
