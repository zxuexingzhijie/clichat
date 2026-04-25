---
phase: 10-distribution
plan: 04
subsystem: homebrew-distribution
tags: [homebrew, formula, tap, ci, distribution]
dependency_graph:
  requires: [10-02]
  provides: [homebrew-formula, tap-scaffold, formula-auto-update]
  affects: [release-pipeline]
tech_stack:
  added: []
  patterns: [homebrew-formula, repository-dispatch, platform-detection]
key_files:
  created:
    - homebrew/Formula/chronicle.rb
    - homebrew/README.md
    - homebrew/.github/workflows/update-formula.yml
  modified: []
decisions:
  - "Workflow uses env: blocks instead of inline ${{ }} in run: steps to mitigate sed injection (T-10-13)"
  - "Added git diff --cached --quiet guard to prevent empty commit failures in update workflow"
  - "Ruby magic comments (typed: false, frozen_string_literal: true) added per Homebrew convention"
metrics:
  duration: 1min
  completed: "2026-04-25T16:14:25Z"
---

# Phase 10 Plan 04: Homebrew Formula & Tap Scaffold Summary

Homebrew tap scaffold with 3-platform Formula (darwin-arm64/x64, linux-x64), tap README, and auto-update workflow receiving repository_dispatch from main repo releases.

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Homebrew formula + tap repository scaffold | 5c02ef2 | homebrew/Formula/chronicle.rb, homebrew/README.md, homebrew/.github/workflows/update-formula.yml |

## Implementation Details

### Formula (chronicle.rb)
- `class Chronicle < Formula` with desc, homepage, version 1.1.0, license MIT
- `on_macos do` block with `Hardware::CPU.arm?` branching for arm64 vs x64
- `on_linux do` block for linux-x64
- URLs reference GitHub Release assets at `releases/download/v#{version}/chronicle-{platform}.tar.gz`
- PLACEHOLDER SHA256 hashes replaced by CI pipeline on each release
- `bin.install "chronicle"` for zero-dep binary installation
- `test` block asserts `chronicle --version` output matches formula version
- Ruby syntax validated via `ruby -c`

### Auto-update Workflow (update-formula.yml)
- Triggered by `repository_dispatch` event type `update-formula`
- Receives version + 3 SHA256 hashes via `client_payload`
- Uses `env:` blocks (not inline `${{ }}`) for shell variable safety per T-10-13
- Three sed passes: version update, placeholder replacement, existing hash replacement
- Existing hash regex constrained to `[a-f0-9]{64}` to prevent over-matching
- Auto-commits and pushes; guards against empty commits

### README
- Install: `brew tap OWNER/chronicle && brew install chronicle`
- Usage, update (`brew upgrade`), uninstall instructions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] Hardened workflow against sed injection (T-10-13)**
- **Found during:** Task 1 implementation
- **Issue:** Plan template used inline `${{ github.event.client_payload.* }}` directly in `run:` blocks, which could be vulnerable to injection if payload values contained shell metacharacters
- **Fix:** Moved all payload values to `env:` block, referenced via `${ENV_VAR}` in shell
- **Files modified:** homebrew/.github/workflows/update-formula.yml

**2. [Rule 2 - Robustness] Added empty commit guard**
- **Found during:** Task 1 implementation
- **Issue:** Workflow would fail if dispatched with same version/hashes (no actual changes)
- **Fix:** Added `git diff --cached --quiet && echo "No changes" && exit 0` before commit
- **Files modified:** homebrew/.github/workflows/update-formula.yml

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| OWNER placeholder | homebrew/Formula/chronicle.rb | 6, 13, 16, 22 | User replaces with their GitHub username/org when setting up homebrew-chronicle repo |
| PLACEHOLDER_DARWIN_ARM64 | homebrew/Formula/chronicle.rb | 14 | Replaced by CI release pipeline on first release |
| PLACEHOLDER_DARWIN_X64 | homebrew/Formula/chronicle.rb | 17 | Replaced by CI release pipeline on first release |
| PLACEHOLDER_LINUX_X64 | homebrew/Formula/chronicle.rb | 23 | Replaced by CI release pipeline on first release |
| OWNER placeholder | homebrew/README.md | 9, 27 | User replaces with their GitHub username/org |

All stubs are intentional scaffolding placeholders. Formula is not meant to be functional until: (1) user creates homebrew-chronicle repo, (2) first release triggers auto-update workflow. This is by design per D-07.

## Verification Results

All 12 acceptance criteria passed:
- Formula contains class, on_macos, on_linux, Hardware::CPU.arm?, bin.install, assert_match, releases/download, license MIT
- README contains brew tap, brew install chronicle
- Workflow contains repository_dispatch, update-formula event type
- Ruby syntax check: OK

## Self-Check: PASSED

- homebrew/Formula/chronicle.rb: FOUND
- homebrew/README.md: FOUND
- homebrew/.github/workflows/update-formula.yml: FOUND
- Commit 5c02ef2: FOUND
