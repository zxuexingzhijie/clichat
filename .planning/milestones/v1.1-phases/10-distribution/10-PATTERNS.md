# Phase 10: Distribution - Pattern Map

**Mapped:** 2026-04-25
**Files analyzed:** 10 new/modified files
**Analogs found:** 7 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/cli.ts` | controller | request-response | `src/index.tsx` | role-match |
| `src/paths.ts` | utility | file-I/O | `src/persistence/save-file-manager.ts` (`getSaveDir`) | exact |
| `world-data/world-manifest.json` | config | static | `src/ai/config/ai-config-schema.ts` | role-match |
| `package.json` (modify) | config | static | (self -- existing file) | exact |
| `bunfig.toml` (modify) | config | static | (self -- existing file) | exact |
| `.github/workflows/ci.yml` | config | batch | -- | no-analog |
| `.github/workflows/release.yml` | config | batch | -- | no-analog |
| `scripts/build-binaries.ts` | utility | batch | -- | no-analog |
| `src/codex/loader.ts` (modify) | service | file-I/O | (self -- path resolution refactor) | exact |
| `src/app.tsx` (modify) | component | request-response | (self -- path resolution refactor) | exact |

## Pattern Assignments

### `src/cli.ts` (controller, request-response)

**Analog:** `src/index.tsx`

**Imports pattern** (lines 1-4):
```typescript
import React from 'react';
import { withFullScreen } from 'fullscreen-ink';
import { App } from './app';
import { gameStore } from './state/game-store';
```

**Process signal handling pattern** (lines 6-21):
```typescript
process.on('uncaughtException', (err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  try {
    gameStore.setState(draft => { draft.pendingQuit = true; });
  } catch {
    process.exit(0);
  }
});

process.on('SIGTERM', () => {
  process.exit(0);
});
```

**App bootstrap pattern** (lines 23-24):
```typescript
const { start } = withFullScreen(React.createElement(App));
start();
```

**Key adaptation:** `src/cli.ts` wraps this bootstrap with Commander.js argument parsing. The signal handlers and `withFullScreen` call move inside the Commander action callback. The existing `src/index.tsx` becomes the dynamic import target (or its contents fold into cli.ts).

---

### `src/paths.ts` (utility, file-I/O)

**Analog:** `src/persistence/save-file-manager.ts` -- `getSaveDir()` function

**Path resolution pattern with priority chain** (lines 15-20):
```typescript
export function getSaveDir(opts?: { portable?: boolean; customDir?: string }): string {
  if (opts?.customDir) return path.resolve(opts.customDir);
  if (opts?.portable) return './saves';
  const paths = envPaths('Chronicle', { suffix: '' });
  return `${paths.data}/saves`;
}
```

**Imports pattern** (lines 1-4):
```typescript
import envPaths from 'env-paths';
import * as nodeFs from 'node:fs';
import path from 'node:path';
```

**Path traversal guard pattern** (lines 48-54):
```typescript
const resolvedPath = path.resolve(filePath);
if (saveDir) {
  const resolvedSaveDir = path.resolve(saveDir);
  if (!resolvedPath.startsWith(resolvedSaveDir + path.sep) && resolvedPath !== resolvedSaveDir) {
    throw new Error(`Path traversal detected: ${filePath} is outside save directory`);
  }
}
```

**Key adaptation:** `resolveDataDir()` follows the same priority chain pattern (CLI arg > env var > built-in default) but resolves to `import.meta.dir`-relative path instead of `envPaths`. The path traversal guard should be reused for `--world-dir` validation.

---

### `world-data/world-manifest.json` schema (config, static)

**Analog:** `src/ai/config/ai-config-schema.ts`

**Zod schema definition pattern** (lines 1-25):
```typescript
import { z } from 'zod';

export const ModelPricingSchema = z.object({
  price_per_1k_input_tokens: z.number().optional(),
  price_per_1k_output_tokens: z.number().optional(),
});

export const RoleConfigEntrySchema = z.object({
  provider: z.string(),
  model: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  pricing: ModelPricingSchema.optional(),
});

// ...

export type AiConfig = z.infer<typeof AiConfigSchema>;
```

**Key adaptation:** Same pattern -- define schema with Zod, export both schema and inferred type. `WorldManifestSchema` validates `world-manifest.json` at runtime load.

---

### `src/codex/loader.ts` (modify -- path resolution)

**Current path usage** (called from `src/ui/screens/narrative-creation-screen.tsx` line 60):
```typescript
const codexDir = path.join(process.cwd(), 'src/data/codex');
```

**Current loader interface** (`src/codex/loader.ts` line 68):
```typescript
export async function loadAllCodex(codexDir: string): Promise<Map<string, CodexEntry>> {
```

**File I/O pattern** (lines 6-8):
```typescript
const file = Bun.file(filePath);
const text = await file.text();
const rawEntries = parseYaml(text);
```

**Validation error pattern** (lines 21-28):
```typescript
if (!result.success) {
  const issues = result.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Codex file ${filePath}, entry "${entryId}" (index ${i}) validation failed:\n${issues}`
  );
}
```

**Key adaptation:** The loader interface already takes `codexDir` as a parameter -- no signature change needed. The callers (`narrative-creation-screen.tsx`, tests) need updating to use `resolveDataDir()` instead of `process.cwd()` + hardcoded path. The loader itself is unchanged.

---

### `src/app.tsx` (modify -- ai-config path resolution)

**Current hardcoded path** (line 85):
```typescript
initRoleConfigs(path.join(process.cwd(), 'ai-config.yaml')).catch((err) => {
  console.error('[AI Config] Failed to load ai-config.yaml, using defaults:', err instanceof Error ? err.message : String(err));
});
```

**Key adaptation:** Replace `path.join(process.cwd(), 'ai-config.yaml')` with a path resolved from `resolveDataDir()` (e.g., `path.join(resolveDataDir(), 'ai-config.yaml')`). The error handling pattern (`.catch` with console.error fallback) stays the same.

---

### `src/ai/config/ai-config-loader.ts` (reference -- YAML load + validate)

**YAML load + Zod validate pattern** (full file, lines 1-16):
```typescript
import { parse as parseYaml } from 'yaml';
import { AiConfigSchema, type AiConfig } from './ai-config-schema';

export async function loadAiConfig(configPath: string): Promise<AiConfig> {
  const file = Bun.file(configPath);
  const text = await file.text();
  const parsed = parseYaml(text) as unknown;
  const result = AiConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`ai-config.yaml validation failed:\n${issues}`);
  }
  return result.data;
}
```

**Key adaptation:** This exact pattern (Bun.file -> text -> parseYaml -> safeParse -> throw on error) should be reused for loading and validating `world-manifest.json`, except using `JSON.parse` instead of `parseYaml`.

---

## Shared Patterns

### File I/O (Bun.file + YAML/JSON parse)
**Source:** `src/codex/loader.ts` lines 6-8, `src/ai/config/ai-config-loader.ts` lines 5-7
**Apply to:** `src/paths.ts` (manifest loading), any new loader functions
```typescript
const file = Bun.file(filePath);
const text = await file.text();
const parsed = parseYaml(text); // or JSON.parse(text) for JSON
```

### Zod Validation Error Formatting
**Source:** `src/codex/loader.ts` lines 22-27, `src/ai/config/ai-config-loader.ts` lines 9-13
**Apply to:** World manifest schema validation, any new config validation
```typescript
if (!result.success) {
  const issues = result.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`<context> validation failed:\n${issues}`);
}
```

### Path Resolution Priority Chain
**Source:** `src/persistence/save-file-manager.ts` lines 15-20
**Apply to:** `src/paths.ts` `resolveDataDir()`
```typescript
// Priority: explicit arg > environment variable > built-in default
if (opts?.customDir) return path.resolve(opts.customDir);
// ... env check ...
// ... default fallback ...
```

### Test Pattern: Temp File + Cleanup
**Source:** `src/ai/config/ai-config-loader.test.ts` lines 8-12
**Apply to:** Tests for `src/paths.ts`, world manifest validation
```typescript
function writeTmpYaml(name: string, content: string): string {
  const filePath = join(TMP_DIR, `${name}-${Date.now()}.yaml`);
  writeFileSync(filePath, content);
  return filePath;
}
// ... test body ...
// finally { unlinkSync(filePath); }
```

### Test Pattern: import.meta.dir for Test Data Resolution
**Source:** `src/codex/loader.test.ts` line 8
**Apply to:** Any test that needs to resolve paths relative to the test file
```typescript
const CODEX_DIR = resolve(import.meta.dir, "../data/codex");
```

### Process Signal Handling
**Source:** `src/index.tsx` lines 6-21
**Apply to:** `src/cli.ts` (must retain signal handlers when wrapping bootstrap)
```typescript
process.on('uncaughtException', (err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.github/workflows/ci.yml` | config | batch | No GitHub Actions workflows exist in codebase. Use RESEARCH.md code examples section. |
| `.github/workflows/release.yml` | config | batch | No GitHub Actions workflows exist in codebase. Use RESEARCH.md code examples section. |
| `scripts/build-binaries.ts` | utility | batch | No build scripts exist in codebase. Bun CLI commands from RESEARCH.md are the reference. |

## Critical Path Observations

### Files that reference `process.cwd()` + hardcoded codex path (must be updated)

1. `src/app.tsx` line 85: `path.join(process.cwd(), 'ai-config.yaml')`
2. `src/ui/screens/narrative-creation-screen.tsx` line 60: `path.join(process.cwd(), 'src/data/codex')`

### Files that use relative `src/data/codex` path in tests (may need update after world-data move)

1. `src/codex/loader.test.ts` line 8: `resolve(import.meta.dir, "../data/codex")`
2. `src/engine/character-creation.test.ts` line 10: `loadAllCodex('src/data/codex')`
3. `src/e2e/phase1-verification.test.ts` line 202: `loadCodexFile('src/data/codex/locations.yaml')`

### package.json fields that must change

Current: `"name": "agent-a3842a5b"`, `"private": true`, no `bin`, no `version`, no `files`, no `scripts.build`
Target: `"name": "chronicle-cli"`, remove `"private"`, add `bin`, `version`, `files`, `scripts`, `engines`, `keywords`, `license`, `repository`, `description`

## Metadata

**Analog search scope:** `src/` directory (all TypeScript/TSX files)
**Files scanned:** ~90 source files
**Pattern extraction date:** 2026-04-25
