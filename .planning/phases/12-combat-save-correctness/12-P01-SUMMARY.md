# 12-P01 Execution Summary

**Status:** Complete
**Requirements:** SAVE-01, SAVE-02, SAVE-03
**Duration:** ~8 minutes
**Completed:** 2026-04-28

## Files modified

- `src/state/serializer.ts` — parametrize snapshot(), add getPlaytime callback
- `src/state/serializer.test.ts` — add 4 new tests for SAVE-01
- `src/persistence/save-file-manager.ts` — pass saveName through snapshot() calls
- `src/engine/action-handlers/types.ts` — fix loadGame type (saveDir param), add getBranchMeta
- `src/engine/action-handlers/types.test.ts` — new type contract tests
- `src/engine/action-handlers/load-handler.ts` — pass ctx.saveDir as 3rd arg (SAVE-03)
- `src/engine/action-handlers/load-handler.test.ts` — new tests (created)
- `src/engine/action-handlers/branch-handler.ts` — fix switch to load headSaveId save (SAVE-02)
- `src/engine/action-handlers/branch-handler.test.ts` — new tests (created)
- `src/game-loop.ts` — update GameLoopOptions types to match
- `src/game-loop.test.ts` — update loadGame assertion to include saveDir
- `src/app.tsx` — add getPlaytime callback, add getBranchMeta to branchManager, import branchStore

## Tests

**847 pass, 1 fail** (pre-existing `use-game-input` failure unrelated to this plan — see deferred-items.md)

## Key changes

- `Serializer.snapshot(saveName?: string)` — saves now store user-provided names; defaults to 'Quick Save'
- `createSerializer(..., getPlaytime: () => number)` — 4th param (default `() => 0`); snapshot records real elapsed seconds
- `quickSave` calls `snapshot('Quick Save')`; `saveGame(name, ...)` calls `snapshot(name)`
- `app.tsx` captures `sessionStart = Date.now()` in `useMemo`, passes `() => Math.floor((Date.now() - sessionStart) / 1000)`
- `ActionContext.saveFileManager.loadGame` now typed with `saveDir?: string` 3rd param
- `ActionContext.branchManager.getBranchMeta(branchId)` added; wired via `branchStore.getState().branches[branchId]`
- `load-handler.ts:7` — one-line fix: `loadGame(filePath, ctx.serializer, ctx.saveDir)` activates path traversal guard
- `branch-handler.ts switch` — after `switchBranch()`, reads `branchMeta.headSaveId`; null → `'该分支没有存档可恢复'`; valid → constructs path, calls `loadGame`, returns `'已切换至分支「X」并恢复存档。'`

## Commits

1. `9b34d1b` — test(12-P01): add failing tests + GREEN implementation for snapshot saveName/getPlaytime (SAVE-01)
2. `53c90f5` — feat(12-P01): fix ActionContext types — loadGame saveDir param, branchManager getBranchMeta
3. `705db01` — fix(save): parametrize snapshot, fix branch restore, add saveDir guard (SAVE-01..03)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] game-loop.test.ts assertion out of date**
- **Found during:** Task 3 full suite run
- **Issue:** Existing test asserted `loadGame` called with 2 args; after SAVE-03 fix it's called with 3
- **Fix:** Updated assertion to `toHaveBeenCalledWith('/saves/quicksave.json', mockSerializer, '/saves')`
- **Files modified:** `src/game-loop.test.ts`
- **Commit:** `705db01`

**2. [Rule 2 - Type Safety] Test files needed source field and explicit return types**
- **Found during:** Task 3 tsc check
- **Issue:** `GameAction` requires `source` field; mock `snapshot` needed explicit return type annotation; `mock.calls` typing
- **Fix:** Added `source: 'command'` to test action factories; typed snapshot mocks explicitly; used `as unknown[][]` cast for mock.calls
- **Files modified:** `src/engine/action-handlers/branch-handler.test.ts`, `src/engine/action-handlers/load-handler.test.ts`
- **Commit:** `705db01`

## Known Stubs

None — all changes wire real data.

## Threat Flags

None — T-12P01-01 mitigation is now active (saveDir passed to loadGame in both load-handler and branch-handler).

## Self-Check

**PASSED**
- All 7 modified source files exist on disk
- All 3 task commits found in git log: 9b34d1b, 53c90f5, 705db01
- bun tsc --noEmit: 0 errors
- bun test: 847 pass, 1 pre-existing fail (use-game-input, unrelated)
