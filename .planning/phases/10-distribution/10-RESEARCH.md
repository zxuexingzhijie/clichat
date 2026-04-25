# Phase 10: Distribution - Research

**Researched:** 2026-04-25
**Domain:** npm publishing, Homebrew formula distribution, Bun bundling/compilation, GitHub Actions CI/CD
**Confidence:** HIGH

## Summary

Phase 10 transforms Chronicle from a dev-only project (running via `bun src/index.tsx` from source) into a distributable product with two channels: npm (bundled JS requiring Bun/Node) and Homebrew (standalone compiled binary, zero dependencies). The core technical challenges are: (1) building a single JS bundle from 526+ modules with path alias resolution, (2) relocating world data from `src/data/codex/` to a distribution-friendly `world-data/` directory with runtime path resolution that works in dev, npm-installed, and compiled-binary contexts, (3) cross-compiling standalone binaries for 3 platform targets with embedded YAML assets, and (4) wiring GitHub Actions to automate the test-build-publish-release pipeline on tag push.

The codebase currently has zero build infrastructure (`noEmit: true`, no `bin` entry, placeholder package name `agent-a3842a5b`). All path references to codex data use `process.cwd()` + hardcoded `src/data/codex` paths, which break in any installed context. The `ai-config.yaml` loader similarly uses `process.cwd()`. These path resolution issues are the highest-risk area.

**Primary recommendation:** Implement a `resolveDataDir()` utility that checks CLI arg > env var > `import.meta.dir`-relative built-in path, wire it through all data loaders, then build the npm bundle and Homebrew binary on top of that foundation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Package name is `chronicle-cli`. Binary command is `chronicle` (via `bin` entry in package.json).
- **D-02:** Semver versioning, starting at `1.1.0` (matches v1.1 milestone).
- **D-03:** Dual build strategy -- Bun bundle (single JS file) for npm distribution + Bun compile (standalone binary) for Homebrew distribution. Currently no build step exists (`noEmit: true`, Bun runs TS directly).
- **D-04:** npm package contains: bundled JS + `world-data/` resource directory + versioned `world-manifest.json` + README + LICENSE. Excludes `src/`, tests, `.planning/`, dev config.
- **D-05:** Runtime reads built-in `world-data/` by default. External world-data directory override supported via CLI argument (`--world-dir`) and environment variable (`CHRONICLE_WORLD_DIR`). Priority: CLI arg > env var > built-in. This enables debugging, expansion packs, and future mod scenarios.
- **D-06:** Published to public npm registry (npmjs.com), unscoped package `chronicle-cli`.
- **D-07:** Separate `homebrew-chronicle` repository following standard Homebrew tap naming convention.
- **D-08:** Formula distributes standalone compiled binary with world-data and manifest embedded into the binary via `bun build --compile --embed`. Zero runtime dependencies (no Node.js, no Bun required).
- **D-09:** Three platform targets: macOS arm64, macOS x86_64, Linux x86_64. Binaries attached as GitHub Release assets, Formula downloads the correct one per platform.
- **D-10:** Tag-triggered release -- pushing a `v*` tag triggers the release workflow. Manual control over release cadence.
- **D-11:** Two workflow files: `ci.yml` (runs on PR to main -- test + type check gate) and `release.yml` (runs on `v*` tag -- publish + build + distribute).
- **D-12:** Quality gates before release: `bun test` (full 637-test suite) + `tsc --noEmit` (TypeScript type check). Failure blocks publish.
- **D-13:** Release pipeline sequence: test -> build -> npm publish -> binary build (3 platforms) -> GitHub Release with assets -> Homebrew formula auto-update in `homebrew-chronicle` repo.

### Claude's Discretion
- npm `prepublishOnly` script implementation details
- GitHub Release body content and changelog format
- Homebrew formula auto-update mechanism (GitHub Actions bot commit vs PR)
- `world-manifest.json` schema and version compatibility check logic
- `files` field in package.json (exact include/exclude list)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIST-01 | Game published to npm as `chronicle-cli` -- users can run `npx chronicle-cli` or `npm install -g chronicle-cli` to play | Bun bundler produces single JS, package.json `bin` entry wires `chronicle` command, `files` field controls npm package contents |
| DIST-02 | `bin` entry in package.json and compiled entry point allow launch via `chronicle` CLI command | Bun build resolves path aliases + bundles 526 modules into single JS; `#!/usr/bin/env bun` shebang for npm, standalone binary for Homebrew |
| DIST-03 | Homebrew tap repository (`homebrew-chronicle`) exists with Formula downloading the binary | Bun `--compile` with `--target` flags for cross-compilation; Ruby Formula class downloads platform-specific binary from GitHub Release assets |
| DIST-04 | Users install via `brew tap`/`brew install` and game launches correctly | Formula uses platform detection (`Hardware::CPU.arm?`, `OS.mac?`) to select correct binary asset URL |
| DIST-05 | GitHub Actions workflow builds and publishes on `v*` tag push | `oven-sh/setup-bun@v2` action; matrix strategy for 3 platform builds; `NPM_TOKEN` secret for npm publish; `GITHUB_TOKEN` for releases |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bundle/compile build | Build Pipeline (CI) | Local dev (scripts) | CI is authoritative build; local scripts for testing |
| Path resolution (world-data) | Application Runtime | Build Pipeline | Runtime resolves data dir; build pipeline places files correctly |
| npm package structure | Build Pipeline | Package config (package.json) | `files` field + build script produce publishable artifact |
| Homebrew formula | External Repository | CI (asset upload) | Formula lives in separate repo; CI uploads binaries it references |
| CLI entry point | Application Runtime | -- | Commander.js parses args, launches Ink app |
| Cross-compilation | Build Pipeline (CI) | -- | GitHub Actions runners provide native environments for each target |
| Release automation | CI (GitHub Actions) | -- | Tag-triggered workflows orchestrate entire pipeline |

## Standard Stack

### Core (Build & Distribution)

| Library/Tool | Version | Purpose | Why Standard |
|-------------|---------|---------|--------------|
| Bun bundler | 1.3.12 (built-in) | Bundle 526 modules into single JS | Already the project runtime; resolves tsconfig `paths` aliases natively; produces 1.75MB minified bundle [VERIFIED: local `bun build` test] |
| Bun compiler | 1.3.12 (built-in) | Compile standalone binary with embedded Bun runtime | `bun build --compile` produces ~62MB self-contained binary; supports cross-compilation via `--target` [VERIFIED: local `bun build --compile` test] |
| oven-sh/setup-bun | v2 | GitHub Actions Bun installer | Official action; supports version pinning, caching [VERIFIED: Context7 bun.sh docs] |
| npm (via bun publish) | built-in | Publish to npmjs.com | `bun publish` supports lifecycle scripts, `--dry-run`, `--otp` [VERIFIED: Context7 bun.sh docs] |

### Supporting

| Library/Tool | Version | Purpose | When to Use |
|-------------|---------|---------|-------------|
| commander | ^14.0.3 (already installed) | CLI argument parsing (`--world-dir`, `--version`) | Entry point CLI wrapper; already a project dependency |
| env-paths | ^4.0.0 (already installed) | XDG-compliant save directory | Already used for save files; pattern reusable for world-data default path |
| actions/checkout | v4 | Git checkout in CI | Standard GitHub Actions step [ASSUMED] |
| actions/upload-artifact | v4 | Share build artifacts between CI jobs | Pass compiled binaries between build and release jobs [ASSUMED] |
| softprops/action-gh-release | v2 | Create GitHub Release with assets | De facto standard for tag-triggered releases [ASSUMED] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bun publish | npm publish | npm publish works but requires Node.js in CI; `bun publish` is native and faster |
| softprops/action-gh-release | gh CLI release create | gh CLI more flexible but requires more scripting; action is declarative |
| Bun compile (Homebrew) | npm-based Homebrew formula | npm formula requires Node.js runtime on user machine; compile gives zero-dep binary |
| Single bundle file (npm) | Ship unbundled source | Unbundled requires all 526 modules + node_modules; bundle is 1.75MB minified |

**Installation:** No new dependencies needed. All build tooling is built into Bun.

**Version verification:**
- Bun: 1.3.12 [VERIFIED: `bun --version` on local machine]
- npm: 11.9.0 [VERIFIED: `npm --version` on local machine]
- Homebrew: 5.1.5 [VERIFIED: `brew --version` on local machine]
- `chronicle-cli` name available on npm [VERIFIED: `npm view chronicle-cli` returned exit code 1 (not found)]

## Architecture Patterns

### System Architecture Diagram

```
Developer pushes v* tag
        |
        v
[GitHub Actions: release.yml]
        |
        +---> [Quality Gate] bun test + tsc --noEmit
        |         |
        |         | (pass)
        |         v
        +---> [Bundle] bun build src/cli.ts --outfile dist/cli.js --target bun --minify
        |         |
        |         v
        +---> [npm Publish] bun publish (dist/cli.js + world-data/ + manifest)
        |
        +---> [Compile x3] bun build --compile --target={platform}
        |         |
        |         +---> macOS arm64 binary (world-data embedded)
        |         +---> macOS x86_64 binary (world-data embedded)
        |         +---> Linux x86_64 binary (world-data embedded)
        |         |
        |         v
        +---> [GitHub Release] Upload 3 binaries as assets
        |
        +---> [Homebrew Update] Update formula SHA256 + URL in homebrew-chronicle repo
```

```
Runtime Path Resolution (all 3 contexts):

User runs `chronicle --world-dir /custom/path`
        |
        v
[CLI Entry: src/cli.ts]
        |
        +---> Parse --world-dir arg (Commander.js)
        +---> Check CHRONICLE_WORLD_DIR env var
        +---> Fall back to built-in default
        |         |
        |         +---> Dev: process.cwd() + 'world-data/'
        |         +---> npm installed: import.meta.dir + '../world-data/'
        |         +---> Compiled binary: embedded via $bunfs
        |         |
        |         v
        +---> resolveDataDir() returns absolute path
        |
        v
[App Bootstrap: loads codex, ai-config, guard-dialogue]
        |
        v
[Ink fullscreen app starts]
```

### Recommended Project Structure

```
chronicle-cli/
  src/
    cli.ts               # NEW: CLI entry point (Commander.js + arg parsing)
    index.tsx             # Existing: Ink fullscreen bootstrap
    app.tsx               # Existing: React app root
    paths.ts              # NEW: resolveDataDir(), resolveConfigPath()
    ...existing code...
  world-data/             # RENAMED from src/data/codex/
    codex/
      races.yaml
      locations.yaml
      ...12 YAML files...
    ai-config.yaml        # MOVED from project root
    world-manifest.json   # NEW: version + content hash
  dist/                   # BUILD OUTPUT (gitignored)
    cli.js                # Bundled JS for npm
    chronicle-darwin-arm64    # Compiled binary
    chronicle-darwin-x64      # Compiled binary
    chronicle-linux-x64       # Compiled binary
  .github/
    workflows/
      ci.yml              # PR quality gate
      release.yml         # Tag-triggered release pipeline
  package.json            # Updated: name, version, bin, files, scripts
  README.md               # NEW: installation + usage docs
  LICENSE                 # NEW: license file
```

### Pattern 1: World-Data Path Resolution

**What:** A single utility function that resolves the world-data directory path across dev, npm-installed, and compiled-binary contexts.

**When to use:** Every data loader call (codex, ai-config, guard-dialogue).

**Example:**
```typescript
// Source: Bun docs on import.meta.dir + embedded files
// src/paths.ts

import path from 'node:path';

export function resolveDataDir(options?: {
  worldDir?: string;
}): string {
  // Priority: CLI arg > env var > built-in
  if (options?.worldDir) {
    return path.resolve(options.worldDir);
  }

  const envDir = process.env.CHRONICLE_WORLD_DIR;
  if (envDir) {
    return path.resolve(envDir);
  }

  // Built-in: relative to this file's location
  // In dev: src/paths.ts -> ../world-data/
  // In npm bundle: dist/cli.js -> ../world-data/
  // In compiled binary: embedded files accessed via $bunfs
  return path.resolve(import.meta.dir, '..', 'world-data');
}
```

### Pattern 2: CLI Entry Point Wrapping Ink App

**What:** A Commander.js program that parses CLI arguments, then bootstraps the Ink fullscreen app.

**When to use:** The `bin` entry in package.json points to this file.

**Example:**
```typescript
// Source: Commander.js docs + existing src/index.tsx pattern
// src/cli.ts

import { Command } from 'commander';
import { version } from '../package.json';

const program = new Command()
  .name('chronicle')
  .description('AI-driven CLI interactive novel game')
  .version(version)
  .option('--world-dir <path>', 'Custom world data directory')
  .action(async (opts) => {
    // Store resolved world dir for loaders to access
    process.env.__CHRONICLE_WORLD_DIR_RESOLVED = resolveDataDir({
      worldDir: opts.worldDir,
    });

    // Dynamic import to avoid loading Ink/React before args are parsed
    const { start } = await import('./bootstrap');
    start();
  });

program.parse();
```

### Pattern 3: Bun Embed for Compiled Binary

**What:** Import YAML files with `{ type: "file" }` attribute so they get embedded into compiled binaries.

**When to use:** Only for the compiled binary path; npm bundle ships files externally.

**Example:**
```typescript
// Source: Bun docs on embedding files
// For compiled binary, embed world-data files:

// In the build script (not in source):
// bun build --compile src/cli.ts ./world-data/**/*.yaml ./world-data/world-manifest.json

// At runtime, embedded files are accessible via Bun.embeddedFiles
// or via the $bunfs:// virtual path when imported with { type: "file" }
```

### Pattern 4: Homebrew Formula for Binary Distribution

**What:** Ruby formula that downloads platform-specific pre-compiled binary from GitHub Release.

**When to use:** The `homebrew-chronicle` tap repository.

**Example:**
```ruby
# Source: Homebrew docs on formula creation
# Formula/chronicle.rb

class Chronicle < Formula
  desc "AI-driven CLI interactive novel game"
  homepage "https://github.com/OWNER/chronicle-cli"
  version "1.1.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/OWNER/chronicle-cli/releases/download/v#{version}/chronicle-darwin-arm64.tar.gz"
      sha256 "PLACEHOLDER"
    else
      url "https://github.com/OWNER/chronicle-cli/releases/download/v#{version}/chronicle-darwin-x64.tar.gz"
      sha256 "PLACEHOLDER"
    end
  end

  on_linux do
    url "https://github.com/OWNER/chronicle-cli/releases/download/v#{version}/chronicle-linux-x64.tar.gz"
    sha256 "PLACEHOLDER"
  end

  def install
    bin.install "chronicle"
  end

  test do
    assert_match "chronicle", shell_output("#{bin}/chronicle --version")
  end
end
```

### Anti-Patterns to Avoid

- **Hardcoded `process.cwd()` paths:** Current code uses `path.join(process.cwd(), 'src/data/codex')` which breaks when installed globally. Always use `import.meta.dir`-relative paths.
- **Shipping `src/` in npm package:** The `files` field must explicitly include only `dist/` and `world-data/`, never source TypeScript.
- **Running `npm publish` instead of `bun publish`:** Would require Node.js in CI and miss Bun's lifecycle script handling.
- **Building binaries sequentially in CI:** Use GitHub Actions matrix strategy to compile 3 platforms in parallel.
- **Embedding all YAML via import statements:** For npm distribution, YAML files ship as separate files. Only the compiled binary needs embedding. Use glob patterns in the `bun build --compile` command, not inline imports.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI argument parsing | Custom arg parser | Commander.js (already installed) | Handles `--version`, `--help`, `--world-dir`, subcommands; 140M weekly downloads |
| Cross-platform binary distribution | Custom download scripts | Homebrew formula + GitHub Releases | Established distribution channel; handles platform detection, versioning, updates |
| CI/CD pipeline | Shell scripts in repo | GitHub Actions workflows | Declarative YAML; matrix builds; secrets management; artifact passing between jobs |
| npm package scoping | Manual `.npmignore` | `"files"` field in package.json | Allowlist is safer than blocklist; explicitly declares what ships |
| SHA256 calculation for Homebrew | Manual hash computation | `shasum -a 256` in release workflow | CI computes hash after building; injects into formula template |
| GitHub Release creation | Manual release + upload | softprops/action-gh-release@v2 | Handles asset upload, release notes, tag association in one action |

**Key insight:** The distribution pipeline is 90% configuration (package.json, workflow YAML, formula Ruby) and 10% code (path resolution utility, CLI entry point). The code changes are small but load-bearing.

## Common Pitfalls

### Pitfall 1: Path Resolution Breaks After Install

**What goes wrong:** `process.cwd()` returns the user's working directory, not the package installation directory. After `npm install -g`, codex loader tries to read `/Users/someone/Desktop/src/data/codex/` which doesn't exist.
**Why it happens:** Dev environment always runs from project root, so `process.cwd()` happens to work. This masks the fundamental path resolution problem.
**How to avoid:** Use `import.meta.dir` (Bun) or `__dirname` (Node) to resolve paths relative to the source file, not the working directory. Create a single `resolveDataDir()` function used by all loaders.
**Warning signs:** Any `process.cwd()` + hardcoded relative path in a file that will be bundled.

### Pitfall 2: react-devtools-core Resolution Failure

**What goes wrong:** `bun build` fails with "Could not resolve: react-devtools-core" because Ink's devtools module optionally imports it.
**Why it happens:** Ink 7's `build/devtools.js` has a bare import that Bun's bundler tries to resolve at build time.
**How to avoid:** Add `--external react-devtools-core` to the build command. Verified this works: bundle succeeds at 3.45MB unminified, 1.75MB minified. [VERIFIED: local build test]
**Warning signs:** Build failure mentioning `react-devtools-core` or any optional peer dependency.

### Pitfall 3: YAML Files Not Included in npm Package

**What goes wrong:** User installs `chronicle-cli` but world-data YAML files are missing because `files` field in package.json only includes `dist/`.
**Why it happens:** `files` is an allowlist; anything not listed is excluded. Easy to forget non-JS assets.
**How to avoid:** Explicitly include `"world-data/"` in the `files` array. Test with `bun publish --dry-run` and `bun pm pack` before publishing.
**Warning signs:** `bun publish --dry-run` output doesn't list YAML files.

### Pitfall 4: Compiled Binary Can't Find Embedded Files

**What goes wrong:** Standalone binary crashes because YAML files weren't passed to the compile command and aren't embedded.
**Why it happens:** `bun build --compile src/cli.ts` only bundles JS/TS imports. YAML files loaded via `Bun.file()` at runtime must be explicitly listed as additional entrypoints: `bun build --compile src/cli.ts ./world-data/**/*.yaml`.
**How to avoid:** Use glob patterns in the compile command to include all world-data files. Access them via `Bun.embeddedFiles` or the `$bunfs` path prefix at runtime. [VERIFIED: Context7 Bun docs on "Embed directories"]
**Warning signs:** Binary runs but crashes with "file not found" on first data load.

### Pitfall 5: Cross-Compilation Requires GitHub Actions Matrix

**What goes wrong:** Building all 3 platform binaries on a single macOS runner produces macOS binaries only.
**Why it happens:** Bun's `--compile` with `--target` does support cross-compilation (Bun downloads the target runtime automatically), but the resulting binaries should be tested on their native platform.
**How to avoid:** Use Bun's cross-compilation: `--target=bun-darwin-arm64`, `--target=bun-darwin-x64`, `--target=bun-linux-x64`. All three can be built on a single runner. Testing on native platforms is ideal but not blocking for initial release. [VERIFIED: Context7 Bun docs on cross-compilation targets]
**Warning signs:** Binary works on build machine but crashes on target platform.

### Pitfall 6: npm Lifecycle Script Confusion with Bun

**What goes wrong:** `prepublishOnly` script doesn't run before `bun publish`.
**Why it happens:** Bun does not run lifecycle scripts for *dependencies* by default. However, `bun publish` *does* execute the package's own lifecycle scripts (`prepublishOnly`, `prepare`, `prepack`). This only fails if publishing from a tarball (`bun publish ./my-package.tgz` skips lifecycle scripts). [VERIFIED: Context7 Bun docs]
**How to avoid:** Always publish directly via `bun publish` (not from tarball). Define `prepublishOnly` in scripts to run the build step.
**Warning signs:** Published package contains unbundled source instead of built output.

### Pitfall 7: `import.meta.dir` in Bundled Output

**What goes wrong:** `import.meta.dir` in the bundled JS file resolves to the *dist/* directory at npm install time, but `world-data/` is a sibling to `dist/`, not inside it.
**Why it happens:** After bundling, `import.meta.dir` resolves to the directory of the *output* file, which changes the relative path relationship.
**How to avoid:** Structure the npm package so `dist/cli.js` and `world-data/` are at known relative positions. Use `path.resolve(import.meta.dir, '..', 'world-data')` from the bundled entry point.
**Warning signs:** Path resolution works in dev but returns wrong directory after install.

## Code Examples

### CLI Entry Point

```typescript
// src/cli.ts -- NEW file
// Wraps the existing Ink app with Commander.js argument parsing
import { Command } from 'commander';

const program = new Command()
  .name('chronicle')
  .description('AI-driven CLI interactive novel game')
  .version('1.1.0') // or read from package.json
  .option('--world-dir <path>', 'Override world data directory')
  .option('--config <path>', 'Override AI config file path')
  .action(async (opts) => {
    // Make resolved paths available to the app
    if (opts.worldDir) {
      process.env.CHRONICLE_WORLD_DIR = opts.worldDir;
    }
    if (opts.config) {
      process.env.CHRONICLE_CONFIG_PATH = opts.config;
    }

    // Dynamic import -- avoids loading React/Ink before args parsed
    await import('./index');
  });

program.parse();
```

### Package.json Updates

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
    "build:binary": "bun run scripts/build-binaries.ts",
    "prepublishOnly": "bun run build",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "engines": {
    "bun": ">=1.3.12"
  },
  "keywords": ["cli", "game", "interactive-fiction", "ai", "rpg", "terminal"],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/OWNER/chronicle-cli.git"
  }
}
```

### World Manifest Schema

```typescript
// world-manifest.json schema
import { z } from 'zod';

const WorldManifestSchema = z.object({
  version: z.string(),           // semver, matches package version
  gameVersion: z.string(),       // minimum game version required
  contentHash: z.string(),       // SHA256 of all world-data files concatenated
  files: z.array(z.object({
    path: z.string(),            // relative to world-data/
    hash: z.string(),            // individual file hash
  })),
});
```

### GitHub Actions CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.3.12"
      - run: bun ci
      - run: bun run typecheck
      - run: bun test
```

### GitHub Actions Release Workflow (Skeleton)

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.3.12"
      - run: bun ci
      - run: bun run typecheck
      - run: bun test

  publish-npm:
    needs: quality-gate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun ci
      - run: bun run build
      - run: bun publish --access public
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}

  build-binaries:
    needs: quality-gate
    runs-on: ubuntu-latest  # Bun cross-compiles, single runner sufficient
    strategy:
      matrix:
        target:
          - { name: darwin-arm64, flag: bun-darwin-arm64 }
          - { name: darwin-x64, flag: bun-darwin-x64 }
          - { name: linux-x64, flag: bun-linux-x64 }
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun ci
      - run: |
          bun build --compile src/cli.ts \
            --target ${{ matrix.target.flag }} \
            --outfile chronicle-${{ matrix.target.name }} \
            --external react-devtools-core \
            ./world-data/**/*.yaml \
            ./world-data/world-manifest.json
      # Tar + upload artifact for release job

  release:
    needs: [publish-npm, build-binaries]
    runs-on: ubuntu-latest
    steps:
      # Download artifacts, create GitHub Release, upload binaries
      # Compute SHA256 for each binary
      # Update homebrew-chronicle formula via repository_dispatch or direct commit
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|-------------|------------------|--------------|--------|
| Node.js + pkg/nexe for standalone | Bun `--compile` for standalone binaries | Bun 1.0 (2023) | Single command, cross-compile, smaller binaries, faster startup |
| `npm publish` only | `bun publish` native | Bun 1.1 (2024) | No Node.js dependency in CI, runs lifecycle scripts |
| Webpack/Rollup for bundling | Bun bundler built-in | Bun 1.0 (2023) | Zero-config for Bun projects, resolves tsconfig paths natively |
| `__dirname` for path resolution | `import.meta.dir` (ESM) | ES Modules standard | Works in ESM context; Bun-native |
| `.npmignore` for package scoping | `"files"` allowlist in package.json | npm best practice | Allowlist safer than blocklist |

**Deprecated/outdated:**
- `pkg` (Vercel): abandoned, no updates since 2023
- `nexe`: no Bun support
- `__dirname`: not available in ESM modules without `import.meta.dir` or `fileURLToPath`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `actions/checkout@v4` is current stable version | Standard Stack | Low -- easily updated to correct version |
| A2 | `actions/upload-artifact@v4` is current stable version | Standard Stack | Low -- easily updated |
| A3 | `softprops/action-gh-release@v2` is current stable and handles multi-asset upload | Standard Stack | Medium -- may need alternative action; `gh release create` as fallback |
| A4 | `oven-sh/setup-bun@v2` supports `bun-version: "1.3.12"` pinning | Code Examples | Low -- version pinning documented in Context7 |
| A5 | `bun publish` respects `NPM_TOKEN` env var for authentication in CI | Code Examples | Medium -- may need `.npmrc` file with `//registry.npmjs.org/:_authToken=${NPM_TOKEN}` |
| A6 | Bun cross-compilation on Linux runner can target macOS | Common Pitfalls | Low -- Bun docs explicitly list cross-compile targets; downloads target runtime |
| A7 | `Bun.embeddedFiles` API works with glob-included files in compile mode | Architecture Patterns | Medium -- verified via Context7 docs but not tested locally with YAML files |
| A8 | The project license will be MIT | Code Examples | Low -- common choice; easily changed |

## Open Questions (RESOLVED)

1. **GitHub repository owner/org for release URLs** -- RESOLVED: Using `OWNER` placeholder in all templates (Plan 03, Plan 04). User replaces during final review checkpoint (Plan 05 Task 2).
   - What we know: Formula URLs and GitHub Release URLs need `OWNER/chronicle-cli` format
   - What's unclear: The GitHub username or organization that will own the `chronicle-cli` and `homebrew-chronicle` repositories
   - Recommendation: Use placeholder `OWNER` in templates; replace during execution when user confirms

2. **Embedded file access pattern in compiled binary** -- RESOLVED: Using glob patterns in `bun build --compile` command (Plan 03 release.yml). Runtime reads via standard Bun.file() paths.
   - What we know: `bun build --compile` with glob patterns embeds files; `Bun.embeddedFiles` iterates them; `import ... with { type: "file" }` gives `$bunfs` paths
   - What's unclear: Whether `Bun.file()` with a relative path transparently reads from embedded filesystem in compiled mode, or if code must use `$bunfs` prefix
   - Recommendation: Test locally with a small compiled binary that reads YAML via `Bun.file()`. If it fails, switch to `import with { type: "file" }` + `Bun.file(embeddedPath).text()` pattern

3. **npm `engines` field enforcement** -- RESOLVED: Added engines field in package.json (Plan 02) plus runtime Bun check in src/paths.ts (Plan 01).
   - What we know: The bundled JS file uses Bun APIs (`Bun.file()`, `Bun.write()`); it won't work on Node.js
   - What's unclear: Whether `engines: { "bun": ">=1.3.12" }` is respected by `npx` or `npm install -g`
   - Recommendation: Add `engines` field for documentation. Add a runtime check in `cli.ts`: `if (typeof Bun === 'undefined') { console.error('Chronicle requires Bun runtime...'); process.exit(1); }`

4. **Homebrew formula auto-update mechanism** -- RESOLVED: Using repository_dispatch from release.yml to homebrew-chronicle repo (Plan 03 Task 2 + Plan 04 Task 1). PAT via HOMEBREW_TAP_TOKEN.
   - What we know: After CI builds binaries and creates a GitHub Release, the formula in `homebrew-chronicle` must be updated with new version, URLs, and SHA256 hashes
   - What's unclear: Best mechanism -- direct git push to formula repo, or create PR, or use `repository_dispatch` event
   - Recommendation: Direct push via GitHub Actions using a deploy key or PAT. Simpler than PR-based flow for a single-maintainer project.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Build + runtime | Yes | 1.3.12 | -- |
| npm | Package check / publish fallback | Yes | 11.9.0 | bun publish preferred |
| Homebrew | Formula testing | Yes | 5.1.5 | -- |
| gh CLI | GitHub Release creation | No | -- | Use softprops/action-gh-release in CI; manual release locally |
| tsc | Type checking gate | Yes (via typescript peer dep) | ^6.0.3 | -- |

**Missing dependencies with no fallback:**
- None blocking

**Missing dependencies with fallback:**
- `gh` CLI not installed locally. Fallback: all GitHub Release operations happen in CI via GitHub Actions (not locally). Formula testing can use `brew install --build-from-source` with local formula file.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | bun test (built-in, Jest-compatible API) |
| Config file | bunfig.toml `[test]` section |
| Quick run command | `bun test` |
| Full suite command | `bun test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIST-01 | npm package installable and launchable | smoke | `bun publish --dry-run` + `bun pm pack` inspect | No -- Wave 0 |
| DIST-02 | `chronicle` binary launches via bin entry | integration | `bun run build && node -e "require('child_process').execSync('dist/cli.js --version')"` | No -- Wave 0 |
| DIST-03 | Homebrew formula valid Ruby syntax | unit | `brew audit --formula Formula/chronicle.rb` (local) | No -- separate repo |
| DIST-04 | Homebrew install + launch | smoke/manual | Manual: `brew install --build-from-source ./Formula/chronicle.rb` | Manual only |
| DIST-05 | CI workflow syntax valid | unit | `actionlint .github/workflows/*.yml` (if available) | No -- Wave 0 |

### Sampling Rate

- **Per task commit:** `bun test` (existing test suite must not regress)
- **Per wave merge:** `bun test` + `bun run build` (verify bundle succeeds)
- **Phase gate:** Full suite green + `bun publish --dry-run` + manual `chronicle --version` from built artifact

### Wave 0 Gaps

- [ ] `scripts/build-binaries.ts` -- build script for 3 platform targets (or shell script)
- [ ] `bun publish --dry-run` test step in CI
- [ ] Path resolution test: verify `resolveDataDir()` returns correct path in bundled context
- [ ] Build output test: verify `dist/cli.js` exists and is executable after `bun run build`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | -- |
| V3 Session Management | No | -- |
| V4 Access Control | No | -- |
| V5 Input Validation | Yes | Validate `--world-dir` path (no path traversal); validate `world-manifest.json` with Zod |
| V6 Cryptography | No | SHA256 for integrity checks only (not security-critical) |

### Known Threat Patterns for Distribution

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| npm supply chain (typosquatting) | Spoofing | Publish under verified account; enable npm 2FA; use `--access public` explicitly |
| Malicious world-data override | Tampering | Validate manifest hash on load; warn if external world-data detected |
| NPM_TOKEN leak | Information Disclosure | Store as GitHub Actions secret; never log; use `--otp` for manual publish |
| Binary tampering via release assets | Tampering | SHA256 checksums in Homebrew formula; consider code signing for macOS (via `codesign`) |
| `--world-dir` path traversal | Tampering | `path.resolve()` + validate within expected parent; reuse existing `guardPathTraversal` from save-file-manager |

## Sources

### Primary (HIGH confidence)
- Context7 /websites/bun_sh -- Bun build/compile docs, embed files, cross-compilation targets, GitHub Actions setup, publish command, lifecycle scripts
- Context7 /websites/brew_sh -- Homebrew formula creation, tap setup, binary formula pattern
- Local verification -- `bun build` test (526 modules, 3.45MB unminified, 1.75MB minified), `bun build --compile` test (62MB binary), `npm view chronicle-cli` (name available)

### Secondary (MEDIUM confidence)
- Context7 Bun docs on `Bun.embeddedFiles` API and `$bunfs` virtual path (verified in docs, not tested locally with YAML)

### Tertiary (LOW confidence)
- GitHub Actions action versions (actions/checkout@v4, softprops/action-gh-release@v2) -- based on training knowledge, need verification at execution time

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools verified locally or via Context7; no new dependencies
- Architecture: HIGH -- path resolution pattern is the core challenge, well-understood; build commands tested locally
- Pitfalls: HIGH -- identified 7 specific pitfalls from codebase analysis and build testing; most critical (path resolution, react-devtools-core) verified locally

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (stable domain -- npm/Homebrew/GitHub Actions patterns don't change frequently)
