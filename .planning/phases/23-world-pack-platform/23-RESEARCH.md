# Phase 23: World Pack Platform - Research

**Researched:** 2026-05-08  
**Domain:** TypeScript/Bun world-pack loading, authoring CLI, cached YAML codex composition, save namespace migration  
**Confidence:** HIGH for codebase patterns; MEDIUM for performance target because runtime benchmark must be measured after implementation


<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

## Implementation Decisions

### Namespace Model

- **D-01:** Namespace all cross-system entity IDs with full `@pack/entity_id` format. This includes codex entities, quests, NPCs, locations, items, relations, save references, event logs, world memory, quest refs, scene refs, branch refs, and any other persisted/runtime entity references.
- **D-02:** The built-in Classic Fantasy pack prefix is `@classic_fantasy`. Do not use shorter aliases like `@classic` or generic names like `@core` in persisted data.
- **D-03:** Save migration is eager. Add a new save version (planner decides exact version number based on current code; likely V8 if V7 already exists) that converts existing bare IDs to `@classic_fantasy/...` on load/migration and writes namespaced IDs thereafter.
- **D-04:** Same-pack authoring may allow bare local refs for ergonomics, but the loader must normalize them to full `@pack/entity_id` in the merged WorldState. Cross-pack refs must be written explicitly as full `@pack/entity_id`.

### Pack Composition

- **D-05:** Composition is strict additive by default. Packs cannot silently override another pack's entity ID. Extensions must declare a dependency and an explicit extension target; accidental duplicate fully-qualified IDs are errors.
- **D-06:** Pack dependencies are required dependencies only for Phase 23. Manifests declare required dependencies; WorldPackLoader performs topological sort and fails on missing dependencies or cycles.
- **D-07:** Cross-pack references must be explicit full refs (`@pack/entity_id`). Same-pack bare refs are normalized by the loader. Do not implement auto-resolving bare refs across packs because ambiguity would weaken the collision-free guarantee.
- **D-08:** The planner may design extension/merge mechanics for relationships and additive content, but any override/patch semantics beyond strict additive must be explicit and test-covered. No last-wins behavior.

### Authoring CLI

- **D-09:** `chronicle init` creates a minimal valid pack: manifest, required directories, and one commented/example location, NPC, item, and quest. It should be immediately valid and useful as a starting point.
- **D-10:** `chronicle validate` performs deep validation: YAML/schema validation, reference integrity, required dependency/toposort checks, namespace rules, and Classic Fantasy self-validation after restructuring. It should catch broken refs before runtime loading.
- **D-11:** `chronicle diff` outputs an entity-grouped summary: added/removed/changed by entity, with field-level change summaries. It should be more structured than raw YAML diff but not attempt full gameplay-impact prose in Phase 23.
- **D-12:** CLI output should be author-facing and deterministic. Prefer stable ordering and actionable errors over colorful or animated output.

### Loader and Cache Boundary

- **D-13:** WorldPackLoader runs before React startup, from the CLI boot path. It must be a pure engine-layer function with no React dependency and must be called from `cli.ts` or an equivalent pre-React boundary.
- **D-14:** The loader outputs a merged WorldState / codex state artifact that App consumes, instead of App reading `world-data/codex` directly with `loadAllCodex` in a React effect.
- **D-15:** Cache stores the merged WorldState JSON plus manifest/hash metadata. Warm startup should read this cache directly when valid.
- **D-16:** Cache invalidation uses recursive mtime + size hash over all loaded pack files. Any pack file change invalidates the merged cache.
- **D-17:** Cache location is the user cache directory via existing platform path conventions (`env-paths`), keyed by pack set/hash. Do not write cache artifacts into pack source directories or `world-data/`.
- **D-18:** Provide a bypass/rebuild path if practical (`--no-cache` or validate-triggered rebuild), but the primary Phase 23 requirement is automatic validity via recursive hash.

### Claude's Discretion

- Exact TypeScript module names, schema decomposition, and CLI parser structure are Claude/planner discretion as long as they preserve the decisions above.
- Planner decides whether the save migration is V7 augmentation or V8 based on current serializer state, but the user decision is eager migration to persisted namespaced IDs.
- Planner decides whether `chronicle init` supports additional templates in later phases; Phase 23 only needs the minimal valid pack template.

### Deferred Ideas (OUT OF SCOPE)

## Deferred Ideas

- Multiple `chronicle init --template ...` variants are not required in Phase 23; future phase can add template families.
- Optional dependencies are not required in Phase 23; use required dependencies only.
- Last-wins override semantics are explicitly out of scope for Phase 23.
- Gameplay-impact prose diff reports are deferred; Phase 23 diff is structured entity/field summary.
</user_constraints>


<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WPK-01 | World Pack spec defined (manifest.yaml schema + directory structure + loader API contract) | Reuse `src/world-manifest-schema.ts` strict Zod schema style and `src/codex/loader.ts` actionable validation errors. [VERIFIED: read_file `src/world-manifest-schema.ts`, `src/codex/loader.ts`] |
| WPK-02 | Namespace prefix `@packname/entity_id` for collision-free entity composition across packs | Implement a central namespace utility and normalize same-pack refs during load; reject duplicate fully-qualified IDs. [VERIFIED: read_file `23-CONTEXT.md`, `23-PATTERNS.md`] |
| WPK-03 | Composable world interfaces with dependency declarations, interface contracts, and topological sort loading | Manifest schema must include required dependencies; loader must topologically sort and fail on missing dependencies/cycles. [VERIFIED: read_file `23-CONTEXT.md`] |
| WPK-04 | SDK CLI tooling — `chronicle init` (scaffold), `chronicle validate` (lint), `chronicle diff` (changes) | Add Commander top-level subcommands before the app boot action; keep output deterministic and author-facing. [VERIFIED: read_file `src/cli.ts`, `23-CONTEXT.md`] |
| WPK-05 | Pre-React WorldPackLoader as pure engine-layer function (no React dependency, called from cli.ts) | Current `cli.ts` is already the pre-React boundary; current `app.tsx` still loads codex in a React effect and must be changed. [VERIFIED: read_file `src/cli.ts`, `src/app.tsx`] |
| WPK-06 | Cached WorldState with JSON serialization + recursive mtime hash invalidation (<5ms cold start target) | Use `env-paths` cache location plus Bun file I/O; performance target requires a focused warm-cache benchmark after implementation. [VERIFIED: read_file `src/persistence/save-file-manager.ts`; VERIFIED: run_command `/Users/makoto/.bun/bin/bun pm ls`] |
| WPK-07 | Save migration V6→V7 (bare entity IDs → @pack/entity_id namespaced format) | Current latest save schema is already V7, so plan should add V8 unless deliberately augmenting V7; migration must be eager and idempotent. [VERIFIED: read_file `src/state/serializer.ts`, `src/persistence/save-migrator.ts`] |
| WPK-08 | Decouple src/ from world-data/ hardcoding (resolve via pack loader, not import paths) | `app.tsx`, tests, `paths.ts`, and world-data references still assume `world-data/codex`; introduce WorldState injection and update focused tests. [VERIFIED: grep_content `loadAllCodex|world-data`, read_file `src/app.tsx`] |
</phase_requirements>

## Summary

Phase 23 is primarily a codebase-native platform refactor, not a library-selection phase: the project already has Commander routing, strict Zod schemas, YAML parsing, Bun file I/O, `env-paths`, versioned save migration, and colocated Bun tests. [VERIFIED: read_file `package.json`, `src/cli.ts`, `src/codex/loader.ts`, `src/persistence/save-file-manager.ts`, `src/state/serializer.ts`] The planner should avoid adding dependencies and should instead create a `src/world-packs/` subsystem that composes the existing codex loader/schema patterns into a namespaced `WorldState`. [VERIFIED: read_file `23-CONTEXT.md`, `23-PATTERNS.md`]

The critical architecture shift is moving world loading before React startup. [VERIFIED: read_file `23-CONTEXT.md`] Today `cli.ts` resolves `--world-dir`, sets `__CHRONICLE_DATA_DIR`, and imports `index`; `index.tsx` renders `<App>`; `app.tsx` loads `${dataDir}/codex` inside a React `useEffect`. [VERIFIED: read_file `src/cli.ts`, `src/index.tsx`, `src/app.tsx`] Phase 23 should make `cli.ts` call WorldPackLoader first, then pass a prepared merged WorldState to App through a small boot boundary rather than letting React perform domain file I/O. [VERIFIED: read_file `23-CONTEXT.md`, `23-PATTERNS.md`]

Save migration is the riskiest planning area because entity IDs are stored in schema fields, map keys, event arrays, memory records, branch diff surfaces, and world memory records. [VERIFIED: read_file `src/state/serializer.ts`, `src/state/scene-store.ts`, `src/state/quest-store.ts`, `src/state/world-memory-store.ts`, `src/engine/branch-diff.ts`] The plan must treat namespace migration as a data migration plus code migration: update old saved records eagerly, and ensure new runtime writes use namespaced IDs. [VERIFIED: read_file `23-CONTEXT.md`, `src/persistence/save-migrator.ts`]

**Primary recommendation:** Plan around five waves: pack schema/namespace utilities → loader/validation/toposort → CLI init/validate/diff → cache/pre-React App boot integration → V8 save migration and reference normalization. [VERIFIED: read_file `23-PATTERNS.md`; ASSUMED: wave grouping is a planning recommendation]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pack manifest/schema validation | Engine/service layer (`src/world-packs`) | CLI controller | Zod schema validation belongs beside existing codex/world-manifest validation, while CLI only formats command results. [VERIFIED: read_file `src/codex/loader.ts`, `src/world-manifest-schema.ts`, `src/cli.ts`] |
| Namespace normalization | Engine/service layer (`src/world-packs/namespace.ts`) | Persistence migration | Loader must normalize authoring refs before runtime; migrator must normalize old persisted refs. [VERIFIED: read_file `23-CONTEXT.md`, `src/persistence/save-migrator.ts`] |
| Pack dependency topological sort | Engine/service layer | Validation CLI | Loader owns order; validate command must expose missing/cyclic dependency errors. [VERIFIED: read_file `23-CONTEXT.md`] |
| Authoring commands | CLI controller (`src/cli.ts`) | `src/world-packs/*` services | Commander is current top-level command router; implementation logic should remain in testable service functions. [VERIFIED: read_file `src/cli.ts`, `23-PATTERNS.md`] |
| WorldState cache | Engine/service utility | CLI boot path | Cache should wrap pack file scanning/loading before React starts and use `env-paths` like existing persistence paths. [VERIFIED: read_file `src/persistence/save-file-manager.ts`, `23-CONTEXT.md`] |
| App consumption | React App boot boundary | Engine managers | React should consume prepared state and continue passing `Map<string, CodexEntry>` to managers/providers. [VERIFIED: read_file `src/app.tsx`, `23-PATTERNS.md`] |
| Save migration | Persistence layer | Runtime stores | Serializer/migrator already own schema versioning and restore. [VERIFIED: read_file `src/state/serializer.ts`, `src/persistence/save-migrator.ts`] |

## Standard Stack

### Core

| Library/Runtime | Version | Purpose | Why Standard |
|-----------------|---------|---------|--------------|
| Bun | 1.3.12 installed | Runtime, tests, file I/O, build | Project requires Bun and all current commands/tests use `bun`. [VERIFIED: run_command `/Users/makoto/.bun/bin/bun --version`; VERIFIED: read_file `CLAUDE.md`, `package.json`] |
| TypeScript | 6.0.3 installed | Type safety and schema-inferred types | Existing source and tests are TypeScript; `bun run typecheck` is the project type gate. [VERIFIED: run_command `/Users/makoto/.bun/bin/bun pm ls`; VERIFIED: read_file `package.json`, `CLAUDE.md`] |
| Commander | 14.0.3 installed | Top-level CLI routing for `chronicle init/validate/diff` and default game boot | `src/cli.ts` already uses Commander; no alternative parser should be added. [VERIFIED: run_command `/Users/makoto/.bun/bin/bun pm ls`; VERIFIED: read_file `src/cli.ts`] |
| Zod | 4.3.6 installed | Manifest, codex, save, and validation schemas | Existing strict schema pattern uses Zod; CLAUDE.md requires Zod 4. [VERIFIED: run_command `/Users/makoto/.bun/bin/bun pm ls`; VERIFIED: read_file `CLAUDE.md`, `src/codex/schemas/entry-types.ts`] |
| yaml | 2.8.3 installed | YAML manifest/codex parsing | Existing codex and AI config loaders use `yaml` parser. [VERIFIED: run_command `/Users/makoto/.bun/bin/bun pm ls`; VERIFIED: grep_content `parseYaml`] |
| env-paths | 4.0.0 installed | User cache directory selection | Existing save path convention uses `envPaths('Chronicle', { suffix: '' })`; Phase 23 context locks cache to env-paths conventions. [VERIFIED: run_command `/Users/makoto/.bun/bin/bun pm ls`; VERIFIED: read_file `src/persistence/save-file-manager.ts`, `23-CONTEXT.md`] |
| React + Ink | React 19.2.5 / Ink 7.0.1 installed | Existing terminal UI runtime | Loader must stay pre-React, but App consumption must preserve existing React/Ink tree. [VERIFIED: run_command `/Users/makoto/.bun/bin/bun pm ls`; VERIFIED: read_file `src/index.tsx`, `src/app.tsx`] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid | 5.1.9 installed | Existing event/save-generated IDs | Keep for runtime event IDs; do not use for pack entity IDs because pack IDs must be stable and author-controlled. [VERIFIED: run_command `/Users/makoto/.bun/bin/bun pm ls`; VERIFIED: read_file `src/state/quest-store.ts`] |
| immer | 11.1.4 installed | Store update immutability | Only for existing store updates; WorldPackLoader should return immutable/plain data and avoid store mutation. [VERIFIED: run_command `/Users/makoto/.bun/bin/bun pm ls`; VERIFIED: read_file `CLAUDE.md`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Current Commander | New CLI framework | Do not add; Commander is already in boot path and package dependencies. [VERIFIED: read_file `src/cli.ts`, `package.json`] |
| Current Zod schemas | JSON Schema/Ajv | Do not add; codex/save schemas already use Zod and type inference. [VERIFIED: read_file `src/codex/schemas/entry-types.ts`, `src/state/serializer.ts`] |
| Current YAML parser | A different YAML library | Do not add; `yaml` is already installed and used. [VERIFIED: grep_content `parseYaml`; VERIFIED: read_file `package.json`] |
| env-paths | Manual OS path detection | Do not hand-roll; project already uses env-paths for platform-aware data dirs. [VERIFIED: read_file `src/persistence/save-file-manager.ts`] |

**Installation:**

```bash
# No new external dependency should be planned for Phase 23.
# Existing stack is already installed in node_modules and package.json.
```

**Version verification:** `npm` and `node` were not available on PATH in this session, so registry freshness could not be verified with `npm view`; installed versions were verified with `/Users/makoto/.bun/bin/bun pm ls`. [VERIFIED: run_command `npm view...` failed with `command not found`; VERIFIED: run_command `/Users/makoto/.bun/bin/bun pm ls`]

## Architecture Patterns

### Recommended Project Structure

```text
src/
├── world-packs/                 # New pure pack platform services [VERIFIED: 23-PATTERNS.md]
│   ├── manifest-schema.ts       # Zod schema for manifest.yaml [VERIFIED: src/world-manifest-schema.ts analog]
│   ├── types.ts                 # WorldPack, LoadedPack, WorldState contracts [VERIFIED: 23-PATTERNS.md]
│   ├── namespace.ts             # @pack/id parse/format/normalize helpers [VERIFIED: 23-CONTEXT.md]
│   ├── loader.ts                # Pure async loader/toposort/merge [VERIFIED: src/codex/loader.ts analog]
│   ├── validate.ts              # Deep validation service [VERIFIED: src/codex/loader.ts analog]
│   ├── cache.ts                 # env-paths cache + recursive mtime/size hash [VERIFIED: src/persistence/save-file-manager.ts analog]
│   ├── diff.ts                  # Entity/field diff service [VERIFIED: src/engine/branch-diff.ts analog]
│   └── init.ts                  # Minimal valid pack scaffold writer [VERIFIED: 23-CONTEXT.md]
├── codex/                       # Existing entity schemas/loaders; reuse, do not duplicate [VERIFIED: src/codex/*]
├── persistence/                 # Save migration V7→V8 and readSaveData updates [VERIFIED: src/persistence/save-migrator.ts]
├── state/serializer.ts          # Latest SaveData schema/snapshot/restore [VERIFIED: src/state/serializer.ts]
├── cli.ts                       # Commander subcommands + pre-React loader call [VERIFIED: src/cli.ts]
├── index.tsx                    # Fullscreen render boundary [VERIFIED: src/index.tsx]
└── app.tsx                      # Consume prepared WorldState, no codex file I/O effect [VERIFIED: src/app.tsx]

world-data/
├── manifest.yaml                # Root pack set / built-in pack list [VERIFIED: 23-PATTERNS.md]
└── packs/classic_fantasy/       # Built-in pack source; namespace @classic_fantasy [VERIFIED: 23-CONTEXT.md]
    ├── manifest.yaml
    └── codex/*.yaml
```

### Pattern 1: Strict Zod schema + actionable error formatting

**What:** Parse YAML, validate with Zod `safeParse`, and include file path, entity ID/index, issue path, and issue message in errors. [VERIFIED: read_file `src/codex/loader.ts`]  
**When to use:** Manifest parsing, codex entity validation, relationship validation, namespace rule validation, save schema validation. [VERIFIED: read_file `src/codex/loader.ts`, `src/state/serializer.ts`]

**Example:**

```typescript
// Source: src/codex/loader.ts [VERIFIED: read_file]
const result = CodexEntrySchema.safeParse(raw);

if (!result.success) {
  const issues = result.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Codex file ${filePath}, entry "${entryId}" (index ${i}) validation failed:\n${issues}`
  );
}
```

### Pattern 2: Pure loader service returns prepared data

**What:** `WorldPackLoader` should accept explicit pack paths/options and return a merged WorldState object; it should not import React or mutate global stores. [VERIFIED: read_file `23-CONTEXT.md`, `23-PATTERNS.md`]  
**When to use:** Default game boot and `chronicle validate`; cache should wrap this function rather than live inside React. [VERIFIED: read_file `src/cli.ts`, `src/app.tsx`, `23-CONTEXT.md`]

**Example target shape:**

```typescript
// Source pattern: src/codex/loader.ts returns Map<string, CodexEntry>; adapted for Phase 23. [VERIFIED: read_file]
export interface WorldState {
  readonly entries: ReadonlyMap<string, CodexEntry>;
  readonly packOrder: readonly string[];
  readonly sourceFiles: readonly string[];
  readonly cacheKey: string;
}

export async function loadWorldPacks(options: LoadWorldPacksOptions): Promise Promise<WorldState> {
  const manifests = await readPackManifests(options.packDirs);
  const ordered = topologicallySortRequiredPacks(manifests);
  const entries = new Map<string, CodexEntry>();
  for (const pack of ordered) {
    for (const entry of await loadPackCodexEntries(pack)) {
      const normalized = normalizeEntryRefs(entry, pack.id);
      if (entries.has(normalized.id)) throw new Error(`Duplicate fully-qualified id: ${normalized.id}`);
      entries.set(normalized.id, normalized);
    }
  }
  return { entries, packOrder: ordered.map(p => p.id), sourceFiles: ordered.flatMap(p => p.files), cacheKey: options.cacheKey };
}
```

### Pattern 3: Commander subcommands before default app action

**What:** Add `init`, `validate`, and `diff` as top-level Commander commands, then leave the default `.action` for starting the game. [VERIFIED: read_file `src/cli.ts`, `23-PATTERNS.md`]  
**When to use:** Authoring commands and normal app boot. [VERIFIED: read_file `23-CONTEXT.md`]

**Example:**

```typescript
// Source pattern: src/cli.ts [VERIFIED: read_file]
program
  .command('validate')
  .argument('[packDir]', 'world pack directory')
  .option('--no-cache', 'bypass cached WorldState')
  .action(async (packDir, opts) => {
    const result = await validateWorldPackSet({ packDir, useCache: opts.cache });
    for (const line of formatValidationResult(result)) console.log(line);
    if (!result.ok) process.exitCode = 1;
  });

program.action(async (opts: { worldDir?: string }) => {
  const worldState = await loadWorldPacksFromCliOptions(opts);
  setBootWorldState(worldState);
  await import('./index');
});
```

### Pattern 4: Versioned save migration chain

**What:** Add a new latest schema and chained migration function; parse latest schema after migration. [VERIFIED: read_file `src/state/serializer.ts`, `src/persistence/save-migrator.ts`]  
**When to use:** WPK-07 eager namespace migration. [VERIFIED: read_file `23-CONTEXT.md`]

**Example:**

```typescript
// Source pattern: src/persistence/save-migrator.ts and src/state/serializer.ts [VERIFIED: read_file]
export function migrateV7ToV8(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const data = raw as Record<string, unknown>;
  if (data['version'] !== 7) return raw;
  return namespaceSaveData(data, '@classic_fantasy');
}

export function migrateToLatest(raw: unknown): SaveDataV8 {
  const v7 = migrateV6ToV7(normalizeNpcMemorySnapshot(migrateV5ToV6(migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(raw)))))));
  const v8 = migrateV7ToV8(v7);
  return v8 as SaveDataV8;
}
```

### Anti-Patterns to Avoid

- **Last-wins pack merging:** Silent overwrite is explicitly out of scope; duplicate fully-qualified IDs must error unless an explicit extension target is declared. [VERIFIED: read_file `23-CONTEXT.md`]
- **Cross-pack bare-ref guessing:** Bare refs are only same-pack authoring sugar; cross-pack refs must already be full `@pack/id`. [VERIFIED: read_file `23-CONTEXT.md`]
- **React-side world file I/O:** `app.tsx` currently loads codex in an effect, but Phase 23 requires pre-React loading. [VERIFIED: read_file `src/app.tsx`, `23-CONTEXT.md`]
- **Writing cache into pack folders:** Cache must use `env-paths` user cache conventions, not source directories. [VERIFIED: read_file `23-CONTEXT.md`, `src/persistence/save-file-manager.ts`]
- **Schema duplication:** Reuse `CodexEntrySchema`, relationship schemas, and strict Zod patterns instead of creating a second validation system. [VERIFIED: read_file `src/codex/schemas/entry-types.ts`, `src/codex/schemas/relationship.ts`, `src/codex/loader.ts`]
- **Partial save namespacing:** Migrating only `scene.sceneId` is insufficient; save data includes many nested entity-reference containers. [VERIFIED: read_file `src/state/serializer.ts`, `src/state/scene-store.ts`, `src/state/quest-store.ts`, `src/state/world-memory-store.ts`]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI parsing | Custom `process.argv` parser | Commander | Already used by `src/cli.ts`; preserves existing routing model. [VERIFIED: read_file `src/cli.ts`] |
| YAML parsing | Ad-hoc line parser | `yaml` package | Existing codex/config loaders use `parseYaml`; YAML edge cases are non-trivial. [VERIFIED: grep_content `parseYaml`] |
| Schema validation | Manual `if` chains | Zod strict schemas | Existing codex/save schemas already encode types and produce structured errors. [VERIFIED: read_file `src/codex/schemas/entry-types.ts`, `src/state/serializer.ts`] |
| Cache directory detection | OS-specific path concatenation | `env-paths` | Existing persistence convention is platform-aware and already installed. [VERIFIED: read_file `src/persistence/save-file-manager.ts`] |
| Save migration | In-place mutation of old files without version bump | Serializer migration chain | Existing restore path calls `migrateToLatest` then parses latest schema. [VERIFIED: read_file `src/state/serializer.ts`] |
| Entity diff | Raw text diff as user output | Entity/field diff service modeled after branch diff | Phase 23 requires entity-grouped field summaries, not raw YAML diff. [VERIFIED: read_file `23-CONTEXT.md`, `src/engine/branch-diff.ts`] |
| Dependency ordering | Load in filesystem order | Topological sort over manifest required dependencies | Filesystem order is not dependency semantics; context requires missing/cyclic dependency failure. [VERIFIED: read_file `23-CONTEXT.md`; ASSUMED: topological sort implementation will be custom because no graph library is present] |

**Key insight:** The hard parts are normalization boundaries and migration completeness, not raw file parsing; existing libraries solve parsing/validation/routing/cache-path concerns already. [VERIFIED: read_file `23-CONTEXT.md`, `23-PATTERNS.md`; ASSUMED: “hard parts” prioritization is research judgment]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Save JSON schema currently latest V7 and includes `scene`, `quest`, `relations`, `npcMemorySnapshot`, `exploration`, `playerKnowledge`, `turnLog`, `worldMemory`; repo also contains `world-data/memory/*.json`. [VERIFIED: read_file `src/state/serializer.ts`; VERIFIED: glob_path `world-data/**/*.json`] | Add V8 or explicit V7 augmentation migration; normalize saved entity references and memory files/records where loaded into state; ensure idempotency for already namespaced refs. [VERIFIED: read_file `23-CONTEXT.md`, `23-PATTERNS.md`] |
| Live service config | No external live service configuration is required for pack loading in Phase 23; AI provider config is local `world-data/ai-config.yaml`. [VERIFIED: glob_path `world-data/**/*.{yaml,json}`; VERIFIED: read_file `src/app.tsx`] | No live-service migration required; keep AI config path resolution working after data-dir/pack restructure. [VERIFIED: read_file `src/app.tsx`, `src/paths.ts`] |
| OS-registered state | No launchd/systemd/pm2/task scheduler files were found in required code/context search; runtime CLI is started directly via Bun/npm bin. [VERIFIED: read_file `package.json`, `src/cli.ts`; ASSUMED: absence of OS registrations because no explicit OS registration files were discovered in research scope] | None unless user has manually installed wrappers outside repo; not a Phase 23 repo task. [ASSUMED] |
| Secrets/env vars | `CHRONICLE_WORLD_DIR` and internal `__CHRONICLE_DATA_DIR` influence data resolution; no Phase 23 secret key rename is required. [VERIFIED: read_file `src/paths.ts`, `src/cli.ts`, `src/app.tsx`] | Preserve `CHRONICLE_WORLD_DIR` compatibility or document replacement; use new pack options without breaking current env var path. [VERIFIED: read_file `23-CONTEXT.md`, `src/paths.ts`] |
| Build artifacts | `dist/cli.js` is package output; package files include `world-data/`; Bun build bundles `src/cli.ts`. [VERIFIED: read_file `package.json`] | Update `package.json.files` if Classic Fantasy moves under `world-data/packs/classic_fantasy`; run `bun run build` and package dry-run in execution/verification. [VERIFIED: read_file `package.json`; ASSUMED: package dry-run should be part of verification because Phase 21 used it] |

## Common Pitfalls

### Pitfall 1: Normalizing IDs in entries but not references

**What goes wrong:** Entries have `@classic_fantasy/...` IDs, but fields like `location_id`, `notable_npcs`, exits, quest triggers, faction refs, relationship edges, and memory refs still use bare IDs. [VERIFIED: read_file `src/codex/schemas/entry-types.ts`, `src/state/world-memory-store.ts`]  
**Why it happens:** Codex schemas treat references as plain strings, not typed `EntityRef` values. [VERIFIED: read_file `src/codex/schemas/entry-types.ts`]  
**How to avoid:** Centralize `normalizeEntityRef(value, currentPack)` and per-entry-type reference-walkers; validate all refs against merged `entries`. [VERIFIED: read_file `23-CONTEXT.md`; ASSUMED: implementation detail]  
**Warning signs:** `queryById(codexEntries, bareId)` returns undefined after loader normalization. [VERIFIED: read_file `src/codex/query.ts`, `src/engine/quest-system.ts`]

### Pitfall 2: Letting React remain the loader

**What goes wrong:** CLI authoring commands and app boot diverge, and cached warm start cannot skip React effect loading. [VERIFIED: read_file `src/app.tsx`, `23-CONTEXT.md`]  
**Why it happens:** Current `app.tsx` owns `loadAllCodex` inside `useEffect`. [VERIFIED: read_file `src/app.tsx`]  
**How to avoid:** Load/cached WorldState in `cli.ts`, then pass through `index.tsx`/`App` as props or a boot-state module. [VERIFIED: read_file `src/cli.ts`, `src/index.tsx`; ASSUMED: boot-state module is one acceptable approach]  
**Warning signs:** New code still imports `loadAllCodex` in `app.tsx`. [VERIFIED: grep_content `loadAllCodex`]

### Pitfall 3: Cache invalidation misses files

**What goes wrong:** Warm cache returns stale entities after a YAML file changes, moves, or is deleted. [VERIFIED: read_file `23-CONTEXT.md`]  
**Why it happens:** Hashing only manifest files or top-level directory mtimes misses nested codex changes. [ASSUMED]  
**How to avoid:** Recursively collect all loaded pack files, sort stable relative paths, and hash path + mtime + size metadata as locked by D-16. [VERIFIED: read_file `23-CONTEXT.md`]  
**Warning signs:** `chronicle validate` sees new content but normal boot does not. [ASSUMED]

### Pitfall 4: Save migration is not idempotent

**What goes wrong:** Loading a V8 save may double-prefix refs (`@classic_fantasy/@classic_fantasy/id`) or corrupt non-entity strings. [VERIFIED: read_file `23-PATTERNS.md`]  
**Why it happens:** Recursive string replacement lacks field awareness and namespace parsing. [ASSUMED]  
**How to avoid:** Namespace only known entity-reference fields/keys and return already namespaced refs unchanged. [VERIFIED: read_file `23-CONTEXT.md`, `23-PATTERNS.md`]  
**Warning signs:** Migration tests pass for one flat field but not nested maps/arrays. [VERIFIED: read_file `23-PATTERNS.md`]

### Pitfall 5: CLI output becomes nondeterministic

**What goes wrong:** Authoring tests become flaky and diffs are hard to review. [VERIFIED: read_file `23-CONTEXT.md`]  
**Why it happens:** Directory traversal, Map iteration, and object key enumeration can vary when not explicitly sorted. [ASSUMED]  
**How to avoid:** Sort pack IDs, file paths, entity IDs, error lists, and diff fields before output. [VERIFIED: read_file `23-CONTEXT.md`; ASSUMED: deterministic sorting implementation detail]  
**Warning signs:** Snapshot-like tests fail with order-only changes. [ASSUMED]

## Code Examples

### Manifest schema pattern

```typescript
// Source: src/world-manifest-schema.ts [VERIFIED: read_file]
import { z } from 'zod';

const semverRegex = /^\d+\.\d+\.\d+$/;

export const WorldPackManifestSchema = z.object({
  id: z.string().regex(/^@[a-z0-9_]+$/),
  version: z.string().regex(semverRegex),
  displayName: z.string().min(1),
  schemaVersion: z.literal('1.0.0'),
  dependencies: z.array(z.string().regex(/^@[a-z0-9_]+$/)).default([]),
}).strict();
```

### Namespace helper pattern

```typescript
// Source: Phase 23 decisions D-01..D-07 [VERIFIED: read_file 23-CONTEXT.md]
export function isNamespacedId(id: string): boolean {
  return /^@[a-z0-9_]+\/.+/.test(id);
}

export function toNamespacedId(id: string, packId: string): string {
  if (isNamespacedId(id)) return id;
  return `${packId}/${id}`;
}

export function requireExplicitCrossPackRef(ref: string, currentPack: string): string {
  if (!isNamespacedId(ref)) return toNamespacedId(ref, currentPack);
  return ref;
}
```

### Cache path pattern

```typescript
// Source: src/persistence/save-file-manager.ts [VERIFIED: read_file]
import envPaths from 'env-paths';
import path from 'node:path';

export function getWorldPackCacheDir(customDir?: string): string {
  if (customDir) return path.resolve(customDir);
  const paths = envPaths('Chronicle', { suffix: '' });
  return `${paths.cache}/world-packs`;
}
```

### Serializer latest schema update pattern

```typescript
// Source: src/state/serializer.ts [VERIFIED: read_file]
export const SaveDataV8Schema = SaveDataV7Schema.extend({
  version: z.literal(8),
  worldPacks: z.object({
    loaded: z.array(z.string()),
    primary: z.string(),
  }),
});
export type SaveDataV8 = z.infer<typeof SaveDataV8Schema>;
```

## State of the Art

| Old Approach | Current Phase 23 Approach | When Changed | Impact |
|--------------|---------------------------|--------------|--------|
| Single `world-data/codex` folder loaded inside React | Pre-React WorldPackLoader returns merged WorldState | Phase 23 requirement WPK-05/WPK-08 | Enables authoring CLI, cache, and pack composition before UI starts. [VERIFIED: read_file `REQUIREMENTS.md`, `src/app.tsx`] |
| Bare entity IDs (`loc_north_gate`) | Fully qualified `@classic_fantasy/loc_north_gate` | Phase 23 decision D-01/D-02 | Prevents cross-pack collisions and makes saves portable across pack sets. [VERIFIED: read_file `23-CONTEXT.md`] |
| Single latest SaveDataV7 | New latest save schema for namespaced IDs, likely V8 | Phase 23 WPK-07 | Migration chain remains backward-compatible. [VERIFIED: read_file `src/state/serializer.ts`, `23-CONTEXT.md`] |
| Raw/world-data filesystem as runtime source every boot | Cached merged WorldState JSON keyed by recursive mtime+size hash | Phase 23 WPK-06/D-15/D-16 | Warm cache can bypass YAML parse/merge work. [VERIFIED: read_file `REQUIREMENTS.md`, `23-CONTEXT.md`] |

**Deprecated/outdated for Phase 23:**
- Direct `app.tsx` codex loading from `${dataDir}/codex` should be replaced by prepared WorldState consumption. [VERIFIED: read_file `src/app.tsx`, `23-CONTEXT.md`]
- Persisting new saves with bare entity IDs should stop once the new schema is introduced. [VERIFIED: read_file `23-CONTEXT.md`]
- Assuming `world-data/` itself is the only world should stop; Classic Fantasy becomes a built-in pack under `@classic_fantasy`. [VERIFIED: read_file `23-CONTEXT.md`]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Five-wave grouping is the recommended plan structure. | Summary | Planner may choose a different task split; low technical risk. |
| A2 | Topological sort implementation will be custom because no graph library is present. | Don't Hand-Roll | If a hidden graph utility exists, planner may reuse it instead. |
| A3 | No OS-registered runtime state exists outside repo. | Runtime State Inventory | User-installed wrappers could retain old paths/names and require manual update. |
| A4 | Cache invalidation pitfalls around directory mtimes are based on general filesystem behavior. | Common Pitfalls | Planner should still write tests that prove current implementation catches edits/deletes. |
| A5 | Package dry-run should be part of verification because Phase 21 used distribution checks. | Runtime State Inventory | Could add verification work beyond strict WPK requirements, but it protects packaging after moving world-data. |

## Open Questions (RESOLVED)

1. **RESOLVED: Prepared WorldState handoff**
   - Decision: Use an explicit exported boot function (`startApp({ worldState })` or equivalent small boot module) from the pre-React entry path. `cli.ts` calls WorldPackLoader first, then passes the prepared WorldState into app startup. Do not serialize large WorldState through env vars. [VERIFIED: `23-CONTEXT.md` D-13/D-14; VERIFIED: `src/cli.ts`, `src/index.tsx`, `src/app.tsx`]

2. **RESOLVED: Pack manifest optional metadata**
   - Decision: Keep the Phase 23 manifest strict and operational. Include required pack identity/version/schema/dependencies/content roots plus minimal author-facing metadata such as name/description/author/license only if useful for `init/validate/diff`. Do not add registry/marketplace fields in this phase. [VERIFIED: `23-CONTEXT.md` D-09/D-10 and deferred ideas]

3. **RESOLVED: `<5ms` warm-cache benchmark scope**
   - Decision: Measure the WorldPackLoader warm-cache function path only: validate cache metadata/hash, read merged WorldState JSON, parse it, and return it. Exclude Bun process startup and React render. [VERIFIED: `23-CONTEXT.md` D-13/D-17; VERIFIED: `ROADMAP.md` WPK-06 success criterion]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Bun | Runtime, tests, build, file I/O | ✓ | 1.3.12 | None; package requires Bun. [VERIFIED: run_command `/Users/makoto/.bun/bin/bun --version`, read_file `package.json`] |
| Git | Diff/reference workflow | ✓ | 2.39.5 (Apple Git-154) | None needed for planning. [VERIFIED: run_command `git --version`] |
| Node | GSD init helper / npm registry checks | ✗ on PATH | — | Use Bun and installed package metadata; registry freshness not available. [VERIFIED: run_command `node ...` failed] |
| npm | `npm view` version verification | ✗ on PATH | — | Use `bun pm ls` for installed versions; do not add dependencies. [VERIFIED: run_command `npm view...` failed; VERIFIED: run_command `bun pm ls`] |

**Missing dependencies with no fallback:**
- None for implementation, because Phase 23 can be built/tested with existing Bun stack. [VERIFIED: read_file `package.json`, run_command `/Users/makoto/.bun/bin/bun --version`]

**Missing dependencies with fallback:**
- `npm`/`node` are unavailable on PATH for registry checks and GSD helper commands; fallback is installed dependency verification via Bun because no new package should be added. [VERIFIED: run_command failures and `bun pm ls`]

## Project Constraints (from CLAUDE.md)

- Use Bun commands: `bun install`, `bun test`, `bun run typecheck`, `bun run build`, and `bun run src/cli.ts`; tests are colocated `*.test.ts(x)` using Bun's Jest-compatible API. [VERIFIED: read_file `CLAUDE.md`]
- Project is TypeScript + Bun + React/Ink terminal UI; Chronicle is Chinese-first, CLI-first, single-player. [VERIFIED: read_file `CLAUDE.md`, `PROJECT.md`]
- Preserve the Rules Engine boundary: AI writes prose/dialogue, but deterministic engine owns success, resource consumption, relationship changes, truth, state, and pacing. [VERIFIED: read_file `CLAUDE.md`, `PROJECT.md`]
- Source layout responsibilities: `cli.ts → index.tsx → app.tsx` entry chain, `engine/` game logic, `state/` stores, `ai/` LLM roles, `input/` routing, `ui/` React/Ink, `codex/` world data loading/query, `persistence/` save/load/memory. [VERIFIED: read_file `CLAUDE.md`]
- Store updates must use immutable `setState(draft => ...)` via immer; do not mutate `getState()` results. [VERIFIED: read_file `CLAUDE.md`]
- Use AI SDK v5 and Zod 4; do not use AI SDK v6. [VERIFIED: read_file `CLAUDE.md`] Phase 23 should not touch AI SDK unless boot config paths are affected. [ASSUMED]
- Player-facing strings should be Chinese-first; authoring CLI output should still be deterministic and actionable per Phase 23 context. [VERIFIED: read_file `CLAUDE.md`, `23-CONTEXT.md`]
- Commands use `/` prefix in-game; top-level authoring commands are `chronicle init/validate/diff` and should not be confused with in-game slash commands. [VERIFIED: read_file `CLAUDE.md`, `23-CONTEXT.md`]
- Event bus uses typed `mittmitt<DomainEvents>`; do not create untyped global event side channels for pack loading. [VERIFIED: read_file `CLAUDE.md`] 
- Known gotcha from CLAUDE.md about pre-existing tsc errors is now stale relative to Phase 22 verification reporting `bun run typecheck` exit 0. [VERIFIED: read_file `CLAUDE.md`, `22-VERIFICATION.md`] Planner should run current typecheck rather than assume failures. [ASSUMED]
- `fullscreen-ink` uses `withFullScreen()` wrapping the React element, not a component. [VERIFIED: read_file `CLAUDE.md`, `src/index.tsx`]
- GSD workflow requires planning/execution artifacts; do not make direct implementation edits outside the workflow. [VERIFIED: read_file `CLAUDE.md`]
- For visual/UI decisions, read `DESIGN.md`; Phase 23 has no new visual design scope except CLI text output. [VERIFIED: read_file `CLAUDE.md`; ASSUMED: no visual scope beyond CLI output]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bun test 1.3.12 with Jest-compatible API. [VERIFIED: read_file `CLAUDE.md`; VERIFIED: run_command `/Users/makoto/.bun/bin/bun --version`] |
| Config file | None found/needed; tests run via package script `bun test`. [VERIFIED: read_file `package.json`; VERIFIED: glob_path `*.test.ts(x)`] |
| Quick run command | `/Users/makoto/.bun/bin/bun test src/world-packs/ src/persistence/save-migrator.test.ts src/state/serializer.test.ts src/paths.test.ts` [VERIFIED: existing test style from glob_path; ASSUMED: new `src/world-packs/` tests will exist after Wave 0] |
| Full suite command | `/Users/makoto/.bun/bin/bun test && /Users/makoto/.bun/bin/bun run typecheck` [VERIFIED: read_file `CLAUDE.md`, `package.json`] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| WPK-01 | Manifest schema accepts minimal valid pack and rejects malformed fields/directories | unit | `/Users/makoto/.bun/bin/bun test src/world-packs/manifest-schema.test.ts src/world-packs/loader.test.ts` | ❌ Wave 0 [VERIFIED: glob_path no `src/world-packs`] |
| WPK-02 | Same-pack bare refs normalize to `@pack/id`; cross-pack refs must be explicit; duplicates error | unit | `/Users/makoto/.bun/bin/bun test src/world-packs/namespace.test.ts src/world-packs/loader.test.ts` | ❌ Wave 0 [VERIFIED: glob_path no `src/world-packs`] |
| WPK-03 | Required dependency toposort orders packs and fails missing/cyclic dependencies | unit | `/Users/makoto/.bun/bin/bun test src/world-packs/loader.test.ts src/world-packs/validate.test.ts` | ❌ Wave 0 [VERIFIED: glob_path no `src/world-packs`] |
| WPK-04 | `chronicle init/validate/diff` services scaffold, validate, and diff deterministic outputs | unit/integration | `/Users/makoto/.bun/bin/bun test src/world-packs/init.test.ts src/world-packs/validate.test.ts src/world-packs/diff.test.ts src/cli.test.ts` | ❌ Wave 0 [VERIFIED: glob_path no `src/world-packs`; `src/cli.test.ts` absent] |
| WPK-05 | WorldPackLoader is called before React boot and App consumes prepared WorldState | integration | `/Users/makoto/.bun/bin/bun test src/cli.test.ts src/app.test.tsx` | ❌ Wave 0 [VERIFIED: glob_path] |
| WPK-06 | Warm cache reads valid merged WorldState and invalidates on recursive mtime/size hash changes | unit/perf | `/Users/makoto/.bun/bin/bun test src/world-packs/cache.test.ts` | ❌ Wave 0 [VERIFIED: glob_path no `src/world-packs`] |
| WPK-07 | V7 saves migrate eagerly/idempotently to namespaced latest schema | unit | `/Users/makoto/.bun/bin/bun test src/persistence/save-migrator.test.ts src/state/serializer.test.ts` | ✅ existing files need updates [VERIFIED: glob_path] |
| WPK-08 | Source no longer hardcodes `world-data/codex` as app runtime loader path | unit/source check | `/Users/makoto/.bun/bin/bun test src/paths.test.ts src/app.test.tsx` plus grep check in verification | ⚠️ partial; source tests exist, App test likely absent [VERIFIED: glob_path, grep_content] |

### Sampling Rate

- **Per task commit:** Run the focused test file for changed module, e.g. `/Users/makoto/.bun/bin/bun test src/world-packs/loader.test.ts`. [VERIFIED: CLAUDE.md test conventions]
- **Per wave merge:** Run `/Users/makoto/.bun/bin/bun test src/world-packs/ src/persistence/save-migrator.test.ts src/state/serializer.test.ts src/paths.test.ts`. [ASSUMED: wave command based on expected changed files]
- **Phase gate:** Run `/Users/makoto/.bun/bin/bun test && /Users/makoto/.bun/bin/bun run typecheck && /Users/makoto/.bun/bin/bun run build`. [VERIFIED: read_file `CLAUDE.md`, `package.json`]
- **Performance gate for WPK-06:** Add a focused benchmark/test that measures warm-cache loader function elapsed time after cache creation; exclude process startup. [ASSUMED: benchmark scope recommendation]

### Wave 0 Gaps

- [ ] `src/world-packs/manifest-schema.test.ts` — covers WPK-01. [VERIFIED: no file found]
- [ ] `src/world-packs/namespace.test.ts` — covers WPK-02 and migration helper idempotency. [VERIFIED: no file found]
- [ ] `src/world-packs/loader.test.ts` — covers WPK-01/WPK-02/WPK-03/WPK-05. [VERIFIED: no file found]
- [ ] `src/world-packs/validate.test.ts` — covers WPK-04 deep validation. [VERIFIED: no file found]
- [ ] `src/world-packs/diff.test.ts` — covers WPK-04 deterministic entity/field diff. [VERIFIED: no file found]
- [ ] `src/world-packs/cache.test.ts` — covers WPK-06 cache hit/miss/invalidation. [VERIFIED: no file found]
- [ ] `src/world-packs/init.test.ts` — covers WPK-04 scaffold validity. [VERIFIED: no file found]
- [ ] `src/cli.test.ts` or equivalent boot routing test — covers WPK-04/WPK-05. [VERIFIED: glob_path no `src/cli.test.ts`]
- [ ] Update `src/persistence/save-migrator.test.ts` and `src/state/serializer.test.ts` for V8 namespaced save behavior. [VERIFIED: glob_path existing tests]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Single-player local CLI; no auth feature in Phase 23. [VERIFIED: read_file `PROJECT.md`, `REQUIREMENTS.md`] |
| V3 Session Management | no | No web session or user session management feature in Phase 23. [VERIFIED: read_file `PROJECT.md`, `REQUIREMENTS.md`] |
| V4 Access Control | limited | Local file access only; guard path traversal and restrict save/path resolution to intended dirs. [VERIFIED: read_file `src/paths.ts`, `src/persistence/save-file-manager.ts`] |
| V5 Input Validation | yes | Zod schemas for manifest/codex/save and strict reference validation. [VERIFIED: read_file `src/codex/schemas/entry-types.ts`, `src/state/serializer.ts`] |
| V6 Cryptography | no | No cryptographic feature in Phase 23; cache hash is for invalidation, not security. [VERIFIED: read_file `REQUIREMENTS.md`, `23-CONTEXT.md`] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `--world-dir`, pack dir, diff inputs, or save reads | Tampering / Information Disclosure | Reuse segment/path guards and resolved-dir containment checks; never trust raw CLI paths. [VERIFIED: read_file `src/paths.ts`, `src/persistence/save-file-manager.ts`] |
| Prototype pollution via YAML object keys used as record keys | Tampering | Reject unsafe record keys like `__proto__`, `prototype`, `constructor` when moving YAML IDs into object maps; `world-memory-store` already has a safe-key pattern. [VERIFIED: read_file `src/state/world-memory-store.ts`] |
| Malicious or malformed pack refs | Tampering | Validate namespace syntax, explicit cross-pack refs, duplicate FQIDs, and reference integrity before runtime boot. [VERIFIED: read_file `23-CONTEXT.md`] |
| Cache poisoning/stale cache | Tampering | Include pack set, manifest metadata, recursive file metadata hash, and schema/cache version in cache metadata; rebuild on mismatch. [VERIFIED: read_file `23-CONTEXT.md`; ASSUMED: schema/cache version metadata recommendation] |

## Sources

### Primary (HIGH confidence)

- `CLAUDE.md` — project commands, architecture, conventions, gotchas, GSD workflow. [VERIFIED: read_file]
- `.planning/STATE.md` — current milestone and Phase 23 position. [VERIFIED: read_file]
- `.planning/ROADMAP.md` — Phase 23 goal and success criteria. [VERIFIED: read_file]
- `.planning/REQUIREMENTS.md` — WPK-01 through WPK-08 definitions. [VERIFIED: read_file]
- `.planning/PROJECT.md` — project constraints and key decisions. [VERIFIED: read_file]
- `.planning/phases/23-world-pack-platform/23-CONTEXT.md` — locked Phase 23 decisions. [VERIFIED: read_file]
- `.planning/phases/23-world-pack-platform/23-PATTERNS.md` — code analogs and pattern assignments. [VERIFIED: read_file]
- `.planning/phases/22-ux-architecture-refactor/22-VERIFICATION.md` — Phase 22 boundary verification and current typecheck/full-suite status at prior phase close. [VERIFIED: read_file]
- `package.json` — installed dependency declarations and scripts. [VERIFIED: read_file]
- `src/cli.ts`, `src/index.tsx`, `src/app.tsx`, `src/paths.ts` — current boot/data-dir/App loading boundaries. [VERIFIED: read_file]
- `src/codex/loader.ts`, `src/codex/query.ts`, `src/codex/schemas/*` — YAML/codex/schema/query patterns. [VERIFIED: read_file]
- `src/state/serializer.ts`, `src/persistence/save-migrator.ts`, `src/persistence/save-file-manager.ts`, `src/state/world-memory-store.ts` — save/cache/migration/security patterns. [VERIFIED: read_file]
- `/Users/makoto/.bun/bin/bun pm ls` — installed versions for package stack. [VERIFIED: run_command]

### Secondary (MEDIUM confidence)

- None from web search; this phase should not assume new external dependencies and available package versions were verified locally. [VERIFIED: research_scope, run_command]

### Tertiary (LOW confidence)

- General filesystem/cache and planning recommendations marked `[ASSUMED]` in the Assumptions Log. [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all recommended tools are already present in `package.json`/node_modules and code imports. [VERIFIED: read_file `package.json`; VERIFIED: run_command `bun pm ls`; VERIFIED: grep_content]
- Architecture: HIGH — current integration points and required boundary shift are explicitly documented and verified in source. [VERIFIED: read_file `23-CONTEXT.md`, `23-PATTERNS.md`, `src/cli.ts`, `src/app.tsx`]
- Pitfalls: MEDIUM-HIGH — most are directly derived from current schema/string-ref surfaces; cache/performance details need implementation tests. [VERIFIED: read_file `src/*`; ASSUMED: cache edge-case details]
- Validation: HIGH for test framework and existing test layout; MEDIUM for exact new test file names because files do not exist yet. [VERIFIED: glob_path, `CLAUDE.md`; ASSUMED: new file naming]

**Research date:** 2026-05-08  
**Valid until:** 2026-06-07 for codebase patterns; re-check package versions if adding dependencies or changing package manager assumptions. [ASSUMED]
