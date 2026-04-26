# Phase 10: Distribution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 10-distribution
**Areas discussed:** Package identity & build, npm publish strategy, Homebrew tap setup, CI/CD pipeline

---

## Package identity & build

| Option | Description | Selected |
|--------|-------------|----------|
| chronicle-cli | Matches REQUIREMENTS.md (DIST-01). Users run `npx chronicle-cli`. | ✓ |
| chronicle | Shorter, but may conflict with existing npm packages. | |
| @yourscope/chronicle | Scoped package under npm user. Less likely to conflict. | |

**User's choice:** chronicle-cli
**Notes:** Aligns with DIST-01 requirement specification.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Bun compile (standalone binary) | Single binary, no runtime needed. ~50-80MB. Best for Homebrew. | |
| Bun bundle (JS output) | Bundle TS → single JS file. Users need Node/Bun. ~1-2MB. | |
| Both | Compile for Homebrew, bundle for npm. Best of both worlds. | ✓ |

**User's choice:** Both (compile for Homebrew, bundle for npm)
**Notes:** None.

---

| Option | Description | Selected |
|--------|-------------|----------|
| semver, start at 1.1.0 | Standard semver. Matches v1.1 milestone. | ✓ |
| semver, start at 0.1.0 | Signals early/beta for first public release. | |
| CalVer | Date-based versioning like 2026.04.1. | |

**User's choice:** semver, start at 1.1.0
**Notes:** None.

---

## npm publish strategy

**User's choice:** Free-text response (rejected preset options)
**Notes:** User provided detailed strategy: npm package adopts "runnable core + required resources" approach. Includes bundled JS, world-data resource files, versioned world-manifest.json, and basic docs. Excludes src/, tests, planning docs. Runtime defaults to built-in world-data but supports external directory override via CLI arg or env var for debugging, expansion packs, and future mod scenarios.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 10 only built-in | Only implement built-in world-data reading. Override deferred. | |
| Override included | Implement CLI arg + env var override together. Simple path priority logic. | ✓ |

**User's choice:** Override included in Phase 10 scope
**Notes:** User considers path resolution priority logic simple enough to include.

---

## Homebrew tap setup

| Option | Description | Selected |
|--------|-------------|----------|
| homebrew-chronicle repo | Standard Homebrew naming. Separate repo. | ✓ |
| Formula in main repo | Simplified but non-standard. | |
| Skip Homebrew | npm only for now. | |

**User's choice:** homebrew-chronicle repo
**Notes:** None.

---

**User's choice:** Free-text response (rejected preset options)
**Notes:** User specified: Homebrew Formula distributes standalone binary with world-data and manifest embedded into the binary. Zero dependencies. Same external override entry point preserved for debugging and mod extensibility.

---

## CI/CD pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| Tag-triggered release | Push `v*` tag triggers release. Test first, then publish. | ✓ |
| Push to main | Auto-publish on merge. High frequency, high risk. | |
| Manual release dispatch | GitHub Releases UI manual trigger. Extra step. | |

**User's choice:** Tag-triggered release
**Notes:** None.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Single workflow | One file, sequential jobs. Simple. | |
| Split: CI + Release | ci.yml (test on PR) + release.yml (publish on tag). Clear separation. | ✓ |
| Three separate workflows | ci + npm-release + homebrew-update. Over-engineered. | |

**User's choice:** Split: CI + Release
**Notes:** None.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full test suite | `bun test` all 637 tests. Failure blocks release. | |
| Tests + type check | Full tests + `tsc --noEmit`. Stricter. | ✓ |
| Tests + types + lint | Most strict but ESLint not installed. | |

**User's choice:** Tests + type check
**Notes:** None.

---

## Claude's Discretion

- npm `prepublishOnly` script details
- GitHub Release body/changelog format
- Homebrew formula auto-update mechanism
- `world-manifest.json` schema
- `files` field exact include/exclude list

## Deferred Ideas

None — discussion stayed within phase scope
