---
status: complete
phase: 10-distribution
source: 10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md, 10-04-SUMMARY.md, 10-05-SUMMARY.md
started: "2026-04-26T07:30:00Z"
updated: "2026-04-26T07:45:00Z"
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running game process. Run `bun run build` then `bun dist/cli.js` (or `bun src/cli.ts`). The game boots without errors and shows the title screen / narrative creation scene.
result: pass

### 2. CLI --version Flag
expected: Running `bun src/cli.ts --version` prints `1.1.0` and exits.
result: pass

### 3. CLI --world-dir Option
expected: Running `bun src/cli.ts --world-dir ./world-data` boots the game using that data directory. Running with a nonexistent path or a path containing `..` traversal (e.g., `--world-dir ../etc`) prints an error and does not boot.
result: pass

### 4. World Data Directory Integrity
expected: `world-data/` contains 12 codex YAML files, `ai-config.yaml`, and `world-manifest.json`. No codex files remain in `src/data/codex/`.
result: pass

### 5. npm Package Config
expected: `package.json` shows name `chronicle-cli`, version `1.1.0`, a `bin` entry pointing to the CLI entry point, a `files` array including `dist/` and `world-data/`, and a `build` script. No `"private": true` field.
result: pass

### 6. Build Output
expected: `bun run build` produces `dist/cli.js` without errors. The file size is reasonable (~1.5-2 MB).
result: pass

### 7. Test Suite Passes
expected: `bun test` runs the full suite with 0 failures. All test files reference `world-data/codex/` paths (no `src/data/codex/` references remain).
result: pass

### 8. CI Workflow File
expected: `.github/workflows/ci.yml` exists and defines a workflow triggered on PR/push to main, with jobs for typecheck, test, and build using Bun.
result: pass

### 9. Release Workflow File
expected: `.github/workflows/release.yml` exists, triggered on `v*` tag push, with jobs: quality-gate, publish-npm, build-binaries (3-platform matrix), release (GitHub Release), and update-homebrew (repository dispatch).
result: pass

### 10. Homebrew Formula
expected: `homebrew/Formula/chronicle.rb` exists with a `class Chronicle < Formula`, `on_macos`/`on_linux` blocks with platform detection, `bin.install`, and a test block. SHA256 placeholders are present (expected — replaced by CI on first release).
result: pass

### 11. Homebrew Auto-update Workflow
expected: `homebrew/.github/workflows/update-formula.yml` exists, triggered by `repository_dispatch` event type `update-formula`. Uses `env:` blocks (not inline `${{ }}`) for shell variables.
result: pass

### 12. README and LICENSE
expected: `README.md` exists with npm/npx/Homebrew install instructions. `LICENSE` exists with MIT license text.
result: pass

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
