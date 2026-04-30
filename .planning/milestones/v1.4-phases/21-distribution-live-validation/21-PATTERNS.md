---
phase: 21
name: Distribution & Live Validation
mapped: 2026-04-30
files_analyzed: 3
analogs_found: 3/3
---

# Phase 21: Distribution & Live Validation - Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 3
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `package.json` | config | transform (field update) | `package.json` itself (current state) | self |
| `.github/workflows/release.yml` | config | event-driven (dispatch) | `.github/workflows/release.yml` itself (current state) | self |
| `.planning/phases/21-distribution-live-validation/21-UAT-CHECKLIST.md` | documentation | n/a | `.planning/phases/05-polish/05-HUMAN-UAT.md` | exact |

## Pattern Assignments

### `package.json` (config, field update)

**Analog:** `package.json` (current file — line-level field additions/corrections)

**Current state** (lines 1–64, full file):
```json
{
  "name": "chronicle-cli",
  "version": "1.1.0",
  "description": "AI-driven CLI interactive novel game",
  "type": "module",
  "bin": {
    "chronicle": "dist/cli.js"
  },
  "files": [
    "dist/cli.js",
    "world-data/",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "bun build src/cli.ts --outfile dist/cli.js --target bun --minify --external react-devtools-core",
    "prepublishOnly": "bun run build",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "engines": {
    "bun": ">=1.3.12"
  },
  "keywords": ["cli", "game", "interactive-fiction", "ai", "rpg", "terminal", "text-adventure"],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/zxuexingzhijie/clichat.git"
  },
  ...
}
```

**Required changes (3 operations):**

1. **version bump** — line 3: `"1.1.0"` → `"1.4.0"` (DIST-01)

2. **author field** — add after `"license"` line (DIST-02):
```json
"author": "Makoto",
```

3. **`npm pkg fix` effect** — `repository.url` currently `"https://github.com/zxuexingzhijie/clichat.git"` needs fixing to npm canonical format (DIST-03):
```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/zxuexingzhijie/clichat.git"
}
```
Run `npm pkg fix` after manual edits — it will normalize the url field automatically.

**Validation command:**
```bash
npm publish --dry-run
```
Pass criteria: zero errors (warnings acceptable).

---

### `.github/workflows/release.yml` (config, event-driven)

**Analog:** `.github/workflows/release.yml` itself (current file — review only, no edit required)

**Homebrew dispatch block** (lines 90–119, full `update-homebrew` job):
```yaml
update-homebrew:
  needs: release
  runs-on: ubuntu-latest
  timeout-minutes: 5
  steps:
    - uses: actions/download-artifact@v4
      with:
        path: artifacts
        merge-multiple: true

    - name: Compute SHA256 hashes
      id: hashes
      run: |
        echo "darwin_arm64=$(sha256sum artifacts/chronicle-darwin-arm64.tar.gz | cut -d ' ' -f1)" >> "$GITHUB_OUTPUT"
        echo "darwin_x64=$(sha256sum artifacts/chronicle-darwin-x64.tar.gz | cut -d ' ' -f1)" >> "$GITHUB_OUTPUT"
        echo "linux_x64=$(sha256sum artifacts/chronicle-linux-x64.tar.gz | cut -d ' ' -f1)" >> "$GITHUB_OUTPUT"

    - name: Update Homebrew formula
      uses: peter-evans/repository-dispatch@v3
      with:
        token: ${{ secrets.HOMEBREW_TAP_TOKEN }}
        repository: zxuexingzhijie/homebrew-chronicle
        event-type: update-formula
        client-payload: >-
          {
            "version": "${{ github.ref_name }}",
            "darwin_arm64_sha256": "${{ steps.hashes.outputs.darwin_arm64 }}",
            "darwin_x64_sha256": "${{ steps.hashes.outputs.darwin_x64 }}",
            "linux_x64_sha256": "${{ steps.hashes.outputs.linux_x64 }}"
          }
```

**Verification checklist (no code change needed):**
- `repository: zxuexingzhijie/homebrew-chronicle` — matches actual tap repo (confirmed by CONTEXT.md)
- `event-type: update-formula` — must match the `repository_dispatch` trigger in the tap repo's workflow
- `token: ${{ secrets.HOMEBREW_TAP_TOKEN }}` — secret must be configured in repo settings
- Payload keys (`version`, `darwin_arm64_sha256`, `darwin_x64_sha256`, `linux_x64_sha256`) must match what the tap's `update-formula.yml` reads via `${{ github.event.client_payload.* }}`

**No edit required** if the tap repo's handler accepts these exact keys. The plan action is to review, not modify.

---

### `21-UAT-CHECKLIST.md` (documentation, manual checklist)

**Analog:** `.planning/phases/05-polish/05-HUMAN-UAT.md` (lines 1–40, exact structure match)

**YAML front matter pattern:**
```yaml
---
status: pending
phase: 21-distribution-live-validation
type: human-required
started: ~
updated: ~
---
```

**Section structure pattern** (from `05-HUMAN-UAT.md`):
```markdown
## Current Test

[not started — requires live API session with real keys]

## Tests

### N. [Test name]
expected: [Specific observable behavior]
result: [pending]

## Summary

total: N
passed: 0
pending: N
...

## Gaps

[none yet]
```

**Content to include** (from CONTEXT.md UAT-01 decisions):

Three test items required:
1. `:cost` command shows token counts including intent classification (Phase 19 addition)
2. `:replay` replays last 5 turns correctly
3. Background summarizer compresses NPC memory after 10+ interactions without unhandled rejection

**Automation gate section** (add as separate block before Tests):
```markdown
## Automation Gate

Run before manual UAT:
- [ ] `bun test` — must pass (1115+ tests, 0 failures)
- [ ] `bun tsc --noEmit` — must pass (pre-existing errors excluded)
- [ ] `npm publish --dry-run` — must pass (0 errors)
```

---

## Shared Patterns

### YAML Front Matter for UAT Files
**Source:** `.planning/phases/05-polish/05-HUMAN-UAT.md` lines 1–7
**Apply to:** `21-UAT-CHECKLIST.md`
```yaml
---
status: pending
phase: 21-distribution-live-validation
source: [manual]
started: ~
updated: ~
---
```

### UAT Test Item Format
**Source:** `.planning/phases/05-polish/05-HUMAN-UAT.md` lines 14–25
**Apply to:** `21-UAT-CHECKLIST.md` — each test item
```markdown
### N. [Test name]
expected: [Observable terminal behavior, no ambiguity]
result: [pending — requires live API session]
```

### npm package.json Conventions
**Source:** `package.json` (full file)
**Apply to:** `package.json` edits
- Field order: `name`, `version`, `description`, `type`, `bin`, `files`, `scripts`, `engines`, `keywords`, `license`, `author`, `repository`, then dependency blocks
- No `"private": true` (intentionally omitted for publishability)
- `"type": "module"` — ESM throughout

## No Analog Found

None — all three files have clear analogs or are self-referential edits.

## Metadata

**Analog search scope:** `.planning/phases/`, `.github/workflows/`, `package.json`
**Files scanned:** 6 (package.json, release.yml, ci.yml, 10-UAT.md, 19-UAT.md, 05-HUMAN-UAT.md)
**Pattern extraction date:** 2026-04-30
