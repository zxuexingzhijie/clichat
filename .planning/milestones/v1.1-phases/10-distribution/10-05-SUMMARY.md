---
phase: 10-distribution
plan: 05
subsystem: cleanup
tags: [data-migration, test-paths, readme, license, distribution-readiness]

requires:
  - phase: 10-distribution
    plan: 02
    provides: world-data/codex/ directory, CLI entry point, package.json
  - phase: 10-distribution
    plan: 03
    provides: CI/release workflows
provides:
  - Single source of truth for world data in world-data/codex/
  - README.md with npm/npx/homebrew install instructions
  - MIT LICENSE file
  - All test paths migrated to world-data/codex/
affects: []

tech-stack:
  added: []
  patterns: [import-meta-dir-relative-paths]

key-files:
  created:
    - README.md
    - LICENSE
  modified:
    - src/codex/loader.test.ts
    - src/engine/character-creation.test.ts
    - src/engine/guard-dialogue-loader.test.ts
    - src/e2e/phase1-verification.test.ts

key-decisions:
  - "All test files use resolve(import.meta.dir, '../../world-data/codex') pattern for portable path resolution"
  - "src/data/codex/ deleted entirely -- world-data/codex/ is the single source of truth"
  - "OWNER placeholder in README.md homebrew section is intentional (user replaces before publish)"

requirements-completed: [DIST-01, DIST-02, DIST-03, DIST-04, DIST-05]

duration: 2min
completed: 2026-04-25
---

# Phase 10 Plan 05: Final Cleanup + README/LICENSE Summary

**Remove old src/data/codex/ directory, migrate all test paths to world-data/codex/, add README.md and MIT LICENSE for npm package distribution**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-25T16:16:53Z
- **Completed:** 2026-04-25T16:18:30Z
- **Tasks:** 1
- **Files modified:** 19 (4 test files updated, 13 old data files deleted, 1 root config deleted, 2 new files created)

## Accomplishments

- Migrated 4 test files from `src/data/codex/` to `world-data/codex/` paths using `resolve(import.meta.dir)` pattern
- Deleted all 12 YAML files in `src/data/codex/` (duplicates of `world-data/codex/`)
- Deleted root `ai-config.yaml` (authoritative copy is `world-data/ai-config.yaml`)
- Created `README.md` with npm, npx, and Homebrew install instructions
- Created MIT `LICENSE` file
- Zero references to `src/data/codex` remain in source code
- 744 tests pass, 0 failures
- Build produces dist/cli.js (1.76 MB, 522 modules)

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove old data dir + update test paths + add README/LICENSE | 8b0a9a5 | loader.test.ts, character-creation.test.ts, guard-dialogue-loader.test.ts, phase1-verification.test.ts, README.md, LICENSE, 13 deleted files |

## Files Created/Modified

**Created:**
- `README.md` - npm/npx/homebrew install instructions, options, requirements, MIT license reference
- `LICENSE` - MIT License, Copyright (c) 2026 Chronicle Contributors

**Modified (path updates):**
- `src/codex/loader.test.ts` - `../data/codex` -> `../../world-data/codex`
- `src/engine/character-creation.test.ts` - `'src/data/codex'` -> `resolve(import.meta.dir, '../../world-data/codex')`, added `import { resolve } from 'node:path'`
- `src/engine/guard-dialogue-loader.test.ts` - 3 path references updated from `../data/codex/` to `../../world-data/codex/`
- `src/e2e/phase1-verification.test.ts` - `'src/data/codex/locations.yaml'` -> `resolve(import.meta.dir, '../../world-data/codex/locations.yaml')`, added `import { resolve } from 'node:path'`

**Deleted (intentional):**
- `ai-config.yaml` (root) - replaced by `world-data/ai-config.yaml`
- `src/data/codex/*.yaml` (12 files) - replaced by `world-data/codex/*.yaml`

## Decisions Made

- All test files now use `resolve(import.meta.dir, '../../world-data/codex')` instead of relative string paths, making tests portable regardless of working directory
- The `OWNER` placeholder in README.md homebrew section is intentional scaffolding -- matches same placeholder in package.json, homebrew/Formula/chronicle.rb, and release.yml

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| OWNER placeholder | README.md | 23 | User replaces with GitHub username/org before publish (matches 10-02, 10-03, 10-04 stubs) |

This stub is intentional scaffolding. The README is functional for all non-Homebrew install paths.

## Verification Results

| Check | Result |
|-------|--------|
| `bun test` full suite | 744 pass, 0 fail |
| `bun run build` | dist/cli.js 1.76 MB (522 modules) |
| `ls README.md LICENSE` | Both exist |
| `test ! -d src/data/codex` | PASS (deleted) |
| `test ! -f ai-config.yaml` | PASS (deleted) |
| No `src/data/codex` refs in source | 0 matches |

## Self-Check: PASSED

- README.md: FOUND
- LICENSE: FOUND
- src/codex/loader.test.ts: FOUND (contains world-data/codex)
- src/engine/character-creation.test.ts: FOUND (contains world-data/codex)
- src/engine/guard-dialogue-loader.test.ts: FOUND (contains world-data/codex)
- src/e2e/phase1-verification.test.ts: FOUND (contains world-data/codex)
- Commit 8b0a9a5: FOUND

---
*Phase: 10-distribution*
*Completed: 2026-04-25*
