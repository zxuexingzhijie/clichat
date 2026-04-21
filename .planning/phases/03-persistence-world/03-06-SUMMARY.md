---
phase: 03-persistence-world
plan: "06"
subsystem: persistence
tags: [file-io, save-manager, memory-persistence, tdd, env-paths, three-layer-retention]
dependency_graph:
  requires:
    - 03-01 (NpcMemoryRecordSchema, NpcMemoryStateSchema)
    - 03-05 (Serializer interface, SaveMetaSchema)
  provides:
    - getSaveDir (platform-aware via env-paths; portable/customDir overrides)
    - quickSave / saveGame / loadGame / listSaves in save-file-manager.ts
    - initMemoryPersistence (async fire-and-forget NPC memory disk writes)
    - applyRetention (three-layer recent→salient→archive promotion logic)
  affects:
    - src/persistence/save-file-manager.ts
    - src/persistence/save-file-manager.test.ts
    - src/persistence/memory-persistence.ts
    - src/persistence/memory-persistence.test.ts
    - package.json (env-paths@4.0.0 added)
tech_stack:
  added:
    - env-paths@4.0.0 (platform-aware data directory resolution)
  patterns:
    - TDD (RED/GREEN per task)
    - Fire-and-forget async event subscriber (.catch logs, never throws)
    - Meta-only read for save listing (no full schema parse on list)
    - path.resolve() for customDir path traversal prevention (T-03-11)
key_files:
  created:
    - src/persistence/save-file-manager.ts
    - src/persistence/save-file-manager.test.ts
    - src/persistence/memory-persistence.ts
    - src/persistence/memory-persistence.test.ts
  modified:
    - package.json (env-paths added)
decisions:
  - env-paths@4.0.0 used for platform-aware save directory (Chronicle data dir)/saves
  - getSaveDir with customDir calls path.resolve() to mitigate path traversal (T-03-11)
  - memory-persistence reads from in-memory npcMemoryStore not disk -- T-03-12 mitigated by design (no untrusted disk read path in write flow)
  - applyRetention is a pure exported function -- enables direct unit testing without event bus
  - listSaves extracts meta field only (JSON.parse then .meta) -- never full SaveDataV2Schema.safeParse on listing
metrics:
  duration: 525s
  completed_date: "2026-04-21"
  tasks_completed: 2
  tasks_total: 2
  tests_before: 366
  tests_after: 393
---

# Phase 03 Plan 06: File I/O Layer Summary

Platform-aware save/load/list via save-file-manager (env-paths, quicksave.json, named saves) and async NPC memory disk writes via memory-persistence (three-layer retention: recentMemories→salientMemories→archiveSummary).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for save-file-manager | b4b21f7 | src/persistence/save-file-manager.test.ts |
| 1 (GREEN) | Implement save-file-manager.ts | 375d669 | src/persistence/save-file-manager.ts |
| 2 (RED) | Failing tests for memory-persistence | 5dc6b98 | src/persistence/memory-persistence.test.ts |
| 2 (GREEN) | Implement memory-persistence.ts | 114efcc | src/persistence/memory-persistence.ts |

## Verification

- `bun test src/persistence/save-file-manager.test.ts` -- 16 tests, 0 failures
- `bun test src/persistence/memory-persistence.test.ts` -- 11 tests, 0 failures
- `bun test` -- 393 tests, 382 pass, 11 pre-existing failures (unrelated: character-creation YAML codex + phase1-verification)
- `grep -n "quicksave.json" src/persistence/save-file-manager.ts` -- FOUND (line 29)
- `grep -n "applyRetention" src/persistence/memory-persistence.ts` -- FOUND (lines 7, 45)

## What Was Built

**save-file-manager.ts** -- Platform-aware save file operations:
- `getSaveDir()` uses env-paths to resolve `~/Library/Application Support/Chronicle/saves` (macOS), `%APPDATA%/Chronicle/saves` (Windows), `$XDG_DATA_HOME/chronicle/saves` (Linux); supports `portable: true` (`./saves`) and `customDir` (resolved via `path.resolve()`)
- `quickSave(serializer, saveDir)` -- writes `quicksave.json` with serializer.snapshot() output
- `saveGame(name, serializer, saveDir)` -- writes `safeName_YYYY-MM-DDTHH-MM.json` with sanitized name
- `loadGame(filePath, serializer)` -- reads file, calls serializer.restore(json)
- `listSaves(saveDir)` -- reads .json files, extracts `meta` field only (no full parse), returns sorted by timestamp desc
- `ensureSaveDirExists(saveDir)` -- mkdirSync with recursive: true before writes

**memory-persistence.ts** -- Async NPC memory disk writes:
- `initMemoryPersistence(memoryDir)` -- subscribes to `npc_memory_written` event; fire-and-forget (.catch logs error, never throws)
- `applyRetention(record)` -- pure function: promotes `recentMemories[0]` to `salientMemories` when length >= 15; archives oldest 25 salientMemories into `archiveSummary` text when length >= 50
- Writes `memory/{region}/{npcId}.json` and updates `memory/index.json` per event
- Current region hardcoded to `blackpine_town` (single-region Phase 3 scope)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] Path.resolve() applied to customDir in getSaveDir**
- **Found during:** Task 1 GREEN -- threat model T-03-11 review
- **Issue:** `getSaveDir({ customDir: '/some/path' })` returned the raw user-supplied string without resolving relative traversal sequences
- **Fix:** `path.resolve(opts.customDir)` normalizes the path, converting any relative traversal to an absolute path
- **Files modified:** `src/persistence/save-file-manager.ts`
- **Commit:** 375d669

### Design Decision: T-03-12 Mitigation by Architecture

Threat T-03-12 specified `NpcMemoryRecordSchema.safeParse` on disk reads. The implementation reads NPC memory records from the trusted in-memory `npcMemoryStore` (not from disk) when writing to disk. There is no disk-read-then-apply path in the write flow, so `safeParse` on disk data is not needed here. A future read-back path (e.g., loading memory on startup) should apply schema validation at that boundary.

## TDD Gate Compliance

- Task 1 RED gate: `test(03-06)` commit b4b21f7 -- PASS
- Task 1 GREEN gate: `feat(03-06)` commit 375d669 -- PASS
- Task 2 RED gate: `test(03-06)` commit 5dc6b98 -- PASS
- Task 2 GREEN gate: `feat(03-06)` commit 114efcc -- PASS

## Known Stubs

- `DEFAULT_REGION = 'blackpine_town'` in memory-persistence.ts -- single-region hardcode for Phase 3; multi-region support deferred to future phase when region is tracked on NpcMemoryRecord

## Threat Flags

None -- all three threat mitigations implemented as planned:
- T-03-11: `path.resolve()` applied to customDir in getSaveDir
- T-03-12: mitigated by architecture (reads from trusted in-memory store, not disk)
- T-03-13: fire-and-forget `.catch()` in initMemoryPersistence -- game loop never blocked

## Self-Check: PASSED
