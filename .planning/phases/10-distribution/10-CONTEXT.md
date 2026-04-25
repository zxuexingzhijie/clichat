# Phase 10: Distribution - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Any user can install and launch Chronicle in under two minutes via npm or Homebrew, and releases are automated. npm publish, Homebrew tap, GitHub Actions CI pipeline wired.

Requirements: DIST-01, DIST-02, DIST-03, DIST-04, DIST-05

</domain>

<decisions>
## Implementation Decisions

### Package identity & build
- **D-01:** Package name is `chronicle-cli`. Binary command is `chronicle` (via `bin` entry in package.json).
- **D-02:** Semver versioning, starting at `1.1.0` (matches v1.1 milestone).
- **D-03:** Dual build strategy — Bun bundle (single JS file) for npm distribution + Bun compile (standalone binary) for Homebrew distribution. Currently no build step exists (`noEmit: true`, Bun runs TS directly).

### npm publish strategy
- **D-04:** npm package contains: bundled JS + `world-data/` resource directory + versioned `world-manifest.json` + README + LICENSE. Excludes `src/`, tests, `.planning/`, dev config.
- **D-05:** Runtime reads built-in `world-data/` by default. External world-data directory override supported via CLI argument (`--world-dir`) and environment variable (`CHRONICLE_WORLD_DIR`). Priority: CLI arg > env var > built-in. This enables debugging, expansion packs, and future mod scenarios.
- **D-06:** Published to public npm registry (npmjs.com), unscoped package `chronicle-cli`.

### Homebrew tap setup
- **D-07:** Separate `homebrew-chronicle` repository following standard Homebrew tap naming convention.
- **D-08:** Formula distributes standalone compiled binary with world-data and manifest embedded into the binary via `bun build --compile --embed`. Zero runtime dependencies (no Node.js, no Bun required).
- **D-09:** Three platform targets: macOS arm64, macOS x86_64, Linux x86_64. Binaries attached as GitHub Release assets, Formula downloads the correct one per platform.

### CI/CD pipeline
- **D-10:** Tag-triggered release — pushing a `v*` tag triggers the release workflow. Manual control over release cadence.
- **D-11:** Two workflow files: `ci.yml` (runs on PR to main — test + type check gate) and `release.yml` (runs on `v*` tag — publish + build + distribute).
- **D-12:** Quality gates before release: `bun test` (full 637-test suite) + `tsc --noEmit` (TypeScript type check). Failure blocks publish.
- **D-13:** Release pipeline sequence: test → build → npm publish → binary build (3 platforms) → GitHub Release with assets → Homebrew formula auto-update in `homebrew-chronicle` repo.

### Claude's Discretion
- npm `prepublishOnly` script implementation details
- GitHub Release body content and changelog format
- Homebrew formula auto-update mechanism (GitHub Actions bot commit vs PR)
- `world-manifest.json` schema and version compatibility check logic
- `files` field in package.json (exact include/exclude list)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Distribution requirements
- `.planning/REQUIREMENTS.md` §Distribution (DIST) — DIST-01 through DIST-05 acceptance criteria
- `.planning/ROADMAP.md` §Phase 10 — Success criteria and dependency chain

### Package configuration
- `package.json` — Current state (placeholder name `agent-a3842a5b`, no bin/version/build)
- `tsconfig.json` — Current compiler config (`noEmit: true`, bundler moduleResolution, path aliases)

### World data
- `world-data/` — Runtime resource directory that must be included in npm package and embedded in Homebrew binary

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app.tsx` — Main React + Ink application entry point; needs a CLI wrapper for `bin` entry
- `src/codex/loader.ts` — World data YAML loader; path resolution may need update for bundled distribution
- `src/ai/config/ai-config-loader.ts` — YAML config loader pattern; similar path resolution needed

### Established Patterns
- Bun runtime with native TS execution — build step is new (currently `noEmit: true`)
- `tsconfig.json` path aliases (`@/*` → `./src/*`) — bundler must resolve these
- `bunfig.toml` exists with `[test]` section — build config can extend this

### Integration Points
- `package.json` — needs name, version, bin, files, scripts, description, author, license, repository, keywords, engines fields
- `.github/workflows/` — directory does not exist yet; needs ci.yml and release.yml
- `homebrew-chronicle` — separate repo to be created (outside this codebase)
- `world-data/` path resolution in codex loader — must work both in dev (relative) and in published package (resolved from package root)

</code_context>

<specifics>
## Specific Ideas

- npm 发布采用"可运行核心 + 必需资源"策略 — 不是最小包，而是自包含可运行
- world-data 覆盖机制与 Homebrew 内嵌共享同一个路径优先级逻辑（CLI arg > env var > 内置），实现代码复用
- Homebrew binary 内嵌 world-data 实现真正的零依赖安装体验

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-distribution*
*Context gathered: 2026-04-25*
