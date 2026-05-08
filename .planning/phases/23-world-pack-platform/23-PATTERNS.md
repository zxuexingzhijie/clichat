# Phase 23: World Pack Platform - Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 22 new/modified file groups
**Analogs found:** 22 / 22

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/world-packs/manifest-schema.ts` | model/config | transform | `src/world-manifest-schema.ts` | exact |
| `src/world-packs/types.ts` | model | transform | `src/codex/schemas/entry-types.ts` | role-match |
| `src/world-packs/namespace.ts` | utility | transform | `src/codex/query.ts` | role-match |
| `src/world-packs/loader.ts` | service | file-I/O + transform | `src/codex/loader.ts` | exact |
| `src/world-packs/cache.ts` | utility/service | file-I/O | `src/persistence/save-file-manager.ts` + `src/persistence/memory-persistence.ts` | exact |
| `src/world-packs/validate.ts` | service | file-I/O + transform | `src/codex/loader.ts` | exact |
| `src/world-packs/diff.ts` | service | transform | `src/engine/branch-diff.ts` | exact |
| `src/world-packs/init.ts` | utility/service | file-I/O | `src/persistence/memory-persistence.ts` + `src/persistence/save-file-manager.ts` | role-match |
| `src/cli.ts` | controller/route | request-response | `src/cli.ts` existing commander boot path | exact |
| `src/paths.ts` | utility/config | transform | `src/paths.ts` existing resolver pattern | exact |
| `src/app.tsx` | component/provider | event-driven + state consumption | `src/app.tsx` existing codex state + provider wiring | exact |
| `src/codex/loader.ts` | service | file-I/O + transform | current `src/codex/loader.ts` | exact |
| `src/codex/query.ts` | utility | transform | current `src/codex/query.ts` | exact |
| `src/state/serializer.ts` | service/model | CRUD + transform | current `src/state/serializer.ts` | exact |
| `src/persistence/save-migrator.ts` | migration | transform | current `src/persistence/save-migrator.ts` | exact |
| `world-data/manifest.yaml` / `world-data/packs/classic_fantasy/**` | config/data | file-I/O | `world-data/world-manifest.json` + `world-data/codex/*.yaml` | exact |
| `src/world-packs/*.test.ts` | test | batch | `src/codex/loader.test.ts`, `src/codex/world-manifest.test.ts` | exact |
| `src/world-packs/cache.test.ts` | test | file-I/O | `src/persistence/save-file-manager.test.ts` | exact |
| `src/world-packs/diff.test.ts` | test | transform | `src/engine/branch-diff.test.ts` | exact |
| `src/paths.test.ts` | test | transform | current `src/paths.test.ts` | exact |
| `src/state/serializer.test.ts` | test | transform | current `src/state/serializer.test.ts` | exact |
| `src/persistence/save-migrator.test.ts` | test | transform | current `src/persistence/save-migrator.test.ts` | exact |

## Pattern Assignments

### `src/world-packs/manifest-schema.ts` (model/config, transform)

**Analog:** `src/world-manifest-schema.ts`

**Imports + strict Zod schema pattern** (lines 1-14):
```typescript
import { z } from 'zod';

const semverRegex = /^\d+\.\d+\.\d+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const WorldManifestSchema = z.object({
  version: z.string().regex(semverRegex),
  gameVersion: z.string().regex(semverRegex),
  generatedAt: z.string().regex(dateRegex).optional(),
  worldDataSchema: z.literal('2.0.0'),
  migration: z.literal('world-data-authoring-v2'),
}).strict();

export type WorldManifest = z.infer<typeof WorldManifestSchema>;
```

**Apply:** Define `WorldPackManifestSchema` with `z.object(...).strict()`, regex constants near top, and exported inferred type. Keep unknown fields invalid.

**Testing analog:** `src/codex/world-manifest.test.ts` lines 20-27 and 69-73:
```typescript
const parsed = WorldManifestSchema.parse(manifest);
expect(parsed).toEqual({
  version: "1.2.0",
  gameVersion: "1.5.0",
  generatedAt: "2026-05-03",
  worldDataSchema: "2.0.0",
  migration: "world-data-authoring-v2",
});

it("rejects a manifest with unknown fields", () => {
  const manifest = { ...validManifest, unexpected: true };

  expect(WorldManifestSchema.safeParse(manifest).success).toBe(false);
});
```

---

### `src/world-packs/types.ts` (model, transform)

**Analog:** `src/codex/schemas/entry-types.ts`

**Schema/type export pattern** (lines 15-24, 215-245):
```typescript
const baseFields = {
  id: z.string().min(1),
  name: z.string(),
  tags: z.array(z.string()),
  description: z.string(),
  epistemic: EpistemicMetadataSchema,
  player_facing: PlayerFacingSchema,
  ai_grounding: AiGroundingSchema,
  ecology: EcologySchema,
};

export const CodexEntrySchema = z.discriminatedUnion("type", [
  RaceSchema,
  ProfessionSchema,
  LocationSchema,
  FactionSchema,
  NpcSchema,
  SpellSchema,
  ItemSchema,
  HistoryEventSchema,
  EnemySchema,
  BackgroundSchema,
  QuestTemplateSchema,
]);

export type CodexEntry = z.infer<typeof CodexEntrySchema>;
```

**Apply:** Keep pure type/schema module. Export `WorldState`, `LoadedPack`, `PackDependency`, `NamespacedId`, etc. If runtime validation is needed, colocate Zod schema plus `z.infer` type.

---

### `src/world-packs/namespace.ts` (utility, transform)

**Analog:** `src/codex/query.ts`

**Small pure utility pattern** (lines 1-26):
```typescript
import type { CodexEntry } from "./schemas/entry-types.ts";
import type { RelationshipEdge } from "./schemas/relationship.ts";

export function queryByType(entries: Map<string, CodexEntry>, type: string): CodexEntry[] {
  const result: CodexEntry[] = [];
  for (const entry of entries.values()) {
    if (entry.type === type) {
      result.push(entry);
    }
  }
  return result;
}

export function queryById(entries: Map<string, CodexEntry>, id: string): CodexEntry | undefined {
  return entries.get(id);
}
```

**Apply:** Implement `isNamespacedId`, `toNamespacedId`, `normalizeLocalRef`, and reference traversal helpers as deterministic pure functions with no I/O, no React, and no global state.

---

### `src/world-packs/loader.ts` (service, file-I/O + transform)

**Analog:** `src/codex/loader.ts`

**Imports + injected fs pattern** (lines 1-7):
```typescript
import { parse as parseYaml } from "yaml";
import { readdir as nodeReaddir } from "node:fs/promises";
import { CodexEntrySchema, type CodexEntry } from "./schemas/entry-types.ts";
import { RelationshipEdgeSchema, type RelationshipEdge } from "./schemas/relationship.ts";

export const _fs = { readdir: nodeReaddir };
```

**YAML parse + schema validation + actionable error pattern** (lines 8-36):
```typescript
export async function loadCodexFile(filePath: string): Promise<CodexEntry[]> {
  const file = Bun.file(filePath);
  const text = await file.text();
  const rawEntries = parseYaml(text);

  if (!Array.isArray(rawEntries)) {
    throw new Error(`Codex file ${filePath}: expected array of entries, got ${typeof rawEntries}`);
  }

  const validated: CodexEntry[] = [];

  for (let i = 0; i < rawEntries.length; i++) {
    const raw = rawEntries[i];
    const entryId = raw?.id ?? `(index ${i})`;
    const result = CodexEntrySchema.safeParse(raw);

    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new Error(
        `Codex file ${filePath}, entry "${entryId}" (index ${i}) validation failed:\n${issues}`
      );
    }

    validated.push(result.data);
  }

  return validated;
}
```

**Directory scan + duplicate detection pattern** (lines 71-94):
```typescript
export async function loadAllCodex(codexDir: string): Promise<Map<string, CodexEntry>> {
  const allFiles = await _fs.readdir(codexDir);
  const files = allFiles.filter(
    (f) => f.endsWith(".yaml") && f !== "relationships.yaml" && f !== "guard-dialogue.yaml"
  );

  const entries = new Map<string, CodexEntry>();

  for (const file of files) {
    const filePath = `${codexDir}/${file}`;
    const fileEntries = await loadCodexFile(filePath);

    for (const entry of fileEntries) {
      if (entries.has(entry.id)) {
        throw new Error(
          `Duplicate codex entry id "${entry.id}" found in ${file}. First defined in codex.`
        );
      }
      entries.set(entry.id, entry);
    }
  }

  return entries;
}
```

**Apply:** `WorldPackLoader` should be a pure engine-layer async function over explicit pack paths. It should parse manifests, toposort dependencies, load codex files, normalize same-pack bare refs to `@pack/id`, reject duplicate fully-qualified IDs, and return a merged `WorldState` map.

---

### `src/world-packs/validate.ts` (service, file-I/O + transform)

**Analog:** `src/codex/loader.ts` + `src/codex/loader.test.ts`

**Validation error format to copy** (loader lines 24-30):
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

**Deep validation test pattern** (`src/codex/loader.test.ts` lines 136-154):
```typescript
it("throws on invalid YAML data with entry id and field info", async () => {
  const invalidYaml = `
- id: bad_entry
  name: "Bad"
  type: "race"
  tags: []
  description: "missing epistemic"
  traits: []
  abilities: []
`;
  const tmpPath = resolve(CODEX_DIR, "__test_invalid.yaml");
  await Bun.write(tmpPath, invalidYaml);
  try {
    await expect(loadCodexFile(tmpPath)).rejects.toThrow();
  } finally {
    const { unlinkSync } = await import("fs");
    unlinkSync(tmpPath);
  }
});
```

**Apply:** Use stable, author-facing error strings with file path, entity id, index, and Zod issue path. Validation should reuse `CodexEntrySchema`, relationship schema, manifest schema, namespace checks, dependency toposort, and reference integrity checks.

---

### `src/world-packs/cache.ts` (utility/service, file-I/O)

**Analog:** `src/persistence/save-file-manager.ts` and `src/persistence/memory-persistence.ts`

**Platform path pattern using `env-paths`** (`save-file-manager.ts` lines 1-27):
```typescript
import envPaths from 'env-paths';
import * as nodeFs from 'node:fs';
import { mkdir as fsMkdir, readdir as fsReaddir } from 'node:fs/promises';
import path from 'node:path';

export const _fs = {
  ...nodeFs,
  mkdir: fsMkdir,
  readdir: fsReaddir,
};

export function getSaveDir(opts?: { portable?: boolean; customDir?: string }): string {
  if (opts?.customDir) return path.resolve(opts.customDir);
  if (opts?.portable) return './saves';
  const paths = envPaths('Chronicle', { suffix: '' });
  return `${paths.data}/saves`;
}
```

**Directory create + Bun.write pattern** (`save-file-manager.ts` lines 29-42):
```typescript
export async function ensureSaveDirExists(saveDir: string): Promise<void> {
  await _fs.mkdir(saveDir, { recursive: true });
}

export async function quickSave(serializer: Serializer, saveDir: string): Promise<string> {
  await ensureSaveDirExists(saveDir);
  const filePath = `${saveDir}/quicksave.json`;
  const json = serializer.snapshot('Quick Save');
  await Bun.write(filePath, json);
  return filePath;
}
```

**JSON file read with fallback pattern** (`memory-persistence.ts` lines 58-71):
```typescript
const indexFile = Bun.file(indexPath);
const indexExists = await indexFile.exists();
let index: Record<string, unknown> = {};
if (indexExists) {
  try {
    const rawText = await indexFile.text();
    const parsed = JSON.parse(rawText);
    if (typeof parsed === 'object' && parsed !== null) {
      index = parsed as Record<string, unknown>;
    }
  } catch {
    index = {};
  }
}
```

**Apply:** Cache should live under `envPaths('Chronicle', { suffix: '' }).cache` or equivalent cache path, not inside `world-data`. Inject `_fs` for `stat`, `readdir`, `mkdir` to make hash invalidation testable. Use deterministic JSON serialization and recursive mtime/size hashing.

---

### `src/world-packs/diff.ts` (service, transform)

**Analog:** `src/engine/branch-diff.ts`

**Typed diff model pattern** (lines 5-23):
```typescript
export type DiffCategory = 'quest' | 'npc_relation' | 'inventory' | 'location' | 'faction' | 'knowledge';
export type DiffMarker = '+' | '-' | '~';

export type DiffItem = {
  readonly category: DiffCategory;
  readonly marker: DiffMarker;
  readonly key: string;
  readonly description: string;
  readonly isHighImpact: boolean;
  readonly sourceValue?: string;
  readonly targetValue?: string;
};

export type BranchDiffResult = {
  readonly diffs: readonly DiffItem[];
  readonly totalCount: number;
  readonly highImpactCount: number;
  readonly summary: string;
};
```

**Stable compare loops + summary pattern** (lines 41-55):
```typescript
export function compareBranches(source: SaveDataCompare, target: SaveDataCompare): BranchDiffResult {
  const diffs: DiffItem[] = [];

  compareQuests(source, target, diffs);
  compareNpcRelations(source, target, diffs);
  compareInventory(source, target, diffs);
  compareLocation(source, target, diffs);
  compareFactionReputation(source, target, diffs);
  compareKnowledge(source, target, diffs);

  const highImpactCount = diffs.filter(d => d.isHighImpact).length;
  const summary = `${diffs.length} differences, ${highImpactCount} high-impact`;

  return { diffs, totalCount: diffs.length, highImpactCount, summary };
}
```

**Field-level marker pattern** (lines 62-95):
```typescript
for (const questId of allKeys) {
  const src = sourceQuests[questId];
  const tgt = targetQuests[questId];

  if (src && !tgt) {
    diffs.push({
      category: 'quest',
      marker: '-',
      key: questId,
      description: `${questId} (${src.status})`,
      isHighImpact: src.status !== 'unknown',
      sourceValue: src.status,
    });
  } else if (!src && tgt) {
    diffs.push({
      category: 'quest',
      marker: '+',
      key: questId,
      description: `${questId} (${tgt.status})`,
      isHighImpact: tgt.status !== 'unknown',
      targetValue: tgt.status,
    });
  } else if (src && tgt && src.status !== tgt.status) {
    const transition = `${src.status}->${tgt.status}`;
    diffs.push({
      category: 'quest',
      marker: '~',
      key: questId,
      description: `${questId}: ${src.status} -> ${tgt.status}`,
      isHighImpact: HIGH_IMPACT_QUEST_TRANSITIONS.has(transition),
      sourceValue: src.status,
      targetValue: tgt.status,
    });
  }
}
```

**Apply:** `chronicle diff` should return entity-grouped `DiffItem[]` with `+`, `-`, `~`, stable sorted keys, and field paths. Avoid prose gameplay-impact analysis in Phase 23.

---

### `src/world-packs/init.ts` (utility/service, file-I/O)

**Analog:** `src/persistence/save-file-manager.ts` + `src/persistence/memory-persistence.ts`

**Safe write + mkdir pattern** (`save-file-manager.ts` lines 29-50):
```typescript
export async function ensureSaveDirExists(saveDir: string): Promise<void> {
  await _fs.mkdir(saveDir, { recursive: true });
}

export async function saveGame(name: string, serializer: Serializer, saveDir: string): Promise<string> {
  await ensureSaveDirExists(saveDir);
  const safeName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '-');
  const filePath = `${saveDir}/${safeName}_${formatTimestamp()}.json`;
  const json = serializer.snapshot(name);
  await Bun.write(filePath, json);
  return filePath;
}
```

**Apply:** `chronicle init` should create directories recursively and write deterministic YAML examples. Use safe slugging for pack names if generated from user input. Tests should mock `Bun.write` and `_fs.mkdir` like persistence tests.

---

### `src/cli.ts` (controller/route, request-response)

**Analog:** current `src/cli.ts`

**Commander pre-React boot pattern** (lines 1-20):
```typescript
#!/usr/bin/env bun
import { Command } from 'commander';
import { resolveDataDir, guardWorldDirPath } from './paths';

const program = new Command()
  .name('chronicle')
  .description('AI-driven CLI interactive novel game')
  .version('1.1.0')
  .option('--world-dir <path>', 'Custom world data directory')
  .action(async (opts: { worldDir?: string }) => {
    if (opts.worldDir) {
      guardWorldDirPath(opts.worldDir);
    }
    const dataDir = resolveDataDir({ worldDir: opts.worldDir });
    process.env.__CHRONICLE_DATA_DIR = dataDir;

    await import('./index');
  });

program.parse();
```

**In-game command registration analog:** `src/input/command-registry.ts` lines 8-19:
```typescript
program
  .command('look')
  .argument('[target]', 'what to look at')
  .action((target?: string) => {
    setResult({ type: 'look', target: target ?? null, modifiers: {}, source: 'command' });
  });

program
  .command('go')
  .argument('<direction>', 'direction to move')
  .action((direction: string) => {
    setResult({ type: 'move', target: direction, modifiers: {}, source: 'command' });
  });
```

**Apply:** Add top-level `init`, `validate`, and `diff` subcommands before default app `.action`. Keep WorldPackLoader call before `await import('./index')`. Set environment or pass serialized preloaded world state through a clean boundary consumed by `index`/`App`.

---

### `src/paths.ts` (utility/config, transform)

**Analog:** current `src/paths.ts`

**Runtime guard + resolver pattern** (lines 1-27):
```typescript
if (typeof Bun === 'undefined') {
  console.error('Chronicle requires Bun runtime. Install: https://bun.sh');
  process.exit(1);
}

import path from 'node:path';

export function resolveDataDir(options?: { worldDir?: string }): string {
  if (options?.worldDir) {
    return path.resolve(options.worldDir);
  }
  if (process.env.CHRONICLE_WORLD_DIR) {
    return path.resolve(process.env.CHRONICLE_WORLD_DIR);
  }
  return path.resolve(import.meta.dir, '..', 'world-data');
}

export function resolveConfigPath(dataDir: string): string {
  return path.join(dataDir, 'ai-config.yaml');
}

export function guardWorldDirPath(dirPath: string): void {
  const segments = dirPath.split(path.sep).concat(dirPath.split('/'));
  if (segments.includes('..')) {
    throw new Error(`Path traversal detected: ${dirPath}`);
  }
}
```

**Testing analog:** `src/paths.test.ts` lines 20-37 and 46-54:
```typescript
it('returns CLI arg path when worldDir is provided', async () => {
  const { resolveDataDir } = await import('./paths');
  const result = resolveDataDir({ worldDir: '/custom/path' });
  expect(result).toBe('/custom/path');
});

it('without arguments returns a path ending in world-data', async () => {
  const { resolveDataDir } = await import('./paths');
  const result = resolveDataDir();
  expect(result).toEndWith('world-data');
});

it('throws for path containing ".."', async () => {
  const { guardWorldDirPath } = await import('./paths');
  expect(() => guardWorldDirPath('/safe/../etc/passwd')).toThrow('Path traversal detected');
});
```

**Apply:** Add pack path and cache path resolvers with the same precedence and test style. Keep traversal guards deterministic.

---

### `src/app.tsx` (component/provider, event-driven + state consumption)

**Analog:** current `src/app.tsx`

**Current codex loading pattern to replace** (lines 69-91):
```typescript
const [allCodexEntries, setAllCodexEntries] = useStateState<ReadonlyMap<string, CodexEntry>>(new Map());
const [codexLoadError, setCodexLoadError] = useState<string | null>(null);

useEffect(() => {
  const dataDir = process.env.__CHRONICLE_DATA_DIR || resolveDataDir();
  const codexDir = `${dataDir}/codex`;
  loadAllCodex(codexDir).then((entries) => {
    setAllCodexEntries(entries);
  }).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Codex] Failed to load codex:', msg);
    setCodexLoadError(msg);
  });
}, []);
```

**Provider wiring and prop injection pattern** (lines 404-428):
```tsx
return (
  <GameErrorBoundary>
    <SizeGuard>
      <AtmosphereProvider questTemplates={questTemplates} eventBus={ctx.eventBus}>
        <NarrativeProvider>
          <InputProvider
            gameLoop={gameLoop}
            dialogueManager={dialogueManager}
            combatLoop={combatLoop}
            codexEntries={codexDisplayEntries}
            mapData={mapData}
            branchTree={branchTree}
            currentBranchId={branchState.currentBranchId}
            branches={branchState.branches}
            readSaveData={readSaveData}
            saveDir={saveDir}
            eventBus={ctx.eventBus}
            worldMemoryStore={ctx.stores.worldMemory}
          >
            <GameScreen />
          </InputProvider>
        </NarrativeProvider>
      </AtmosphereProvider>
    </SizeGuard>
  </GameErrorBoundary>
);
```

**Apply:** After Phase 23, `App` should consume preloaded `WorldState`/codex from the CLI boot boundary, not call `loadAllCodex` in a React effect. Preserve derived `codexDisplayEntries`, `questTemplates`, `mapData`, and manager injections from lines 93-294.

---

### `src/codex/loader.ts` (service, file-I/O + transform)

**Analog:** current `src/codex/loader.ts`

**Preserve public surface where possible:** `loadCodexFile`, `loadRelationships`, `loadAllCodex` are used by tests and systems. Phase 23 can delegate these to `WorldPackLoader` for Classic Fantasy, but should preserve existing signatures or update all call sites deliberately.

**Relationship validation pattern** (lines 39-69):
```typescript
export async function loadRelationships(filePath: string): Promise Promise<RelationshipEdge[]> {
  const file = Bun.file(filePath);
  const text = await file.text();
  const rawEdges = parseYaml(text);

  if (!Array.isArray(rawEdges)) {
    throw new Error(`Relationships file ${filePath}: expected array, got ${typeof rawEdges}`);
  }

  const validated: RelationshipEdge[] = [];

  for (let i = 0; i < rawEdges.length; i++) {
    const raw = rawEdges[i];
    const result = RelationshipEdgeSchema.safeParse(raw);

    if (!result.success) {
      const sourceId = raw?.source_id ?? "(unknown)";
      const targetId = raw?.target_id ?? "(unknown)";
      const issues = result.error.issues
        .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new Error(
        `Relationships file ${filePath}, edge ${sourceId}->${targetId} (index ${i}) validation failed:\n${issues}`
      );
    }

    validated.push(result.data);
  }

  return validated;
}
```

---

### `src/codex/query.ts` (utility, transform)

**Analog:** current `src/codex/query.ts`

**Relationship filter pattern** (lines 28-44):
```typescript
interface RelationshipFilter {
  readonly source_id?: string;
  readonly target_id?: string;
  readonly relation_type?: string;
}

export function queryRelationships(
  edges: readonly RelationshipEdge[],
  filter: RelationshipFilter,
): RelationshipEdge[] {
  return edges.filter((edge) => {
    if (filter.source_id !== undefined && edge.source_id !== filter.source_id) return false;
    if (filter.target_id !== undefined && edge.target_id !== filter.target_id) return false;
    if (filter.relation_type !== undefined && edge.relation_type !== filter.relation_type) return false;
    return true;
  });
}
```

**Apply:** Namespace-aware query helpers should still be simple map/filter functions. Add compatibility behavior only intentionally (e.g., exact namespaced id lookup first, optional same-pack normalization in loader not query).

---

### `src/state/serializer.ts` (service/model, CRUD + transform)

**Analog:** current `src/state/serializer.ts`

**Versioned schema chain pattern** (lines 99-108):
```typescript
export const SaveDataV6Schema = SaveDataV5Schema.extend({
  version: z.literal(6),
});
export type SaveDataV6 = z.infer<typeof SaveDataV6Schema>;

export const SaveDataV7Schema = SaveDataV6Schema.extend({
  version: z.literal(7),
  worldMemory: WorldMemoryStateSchema,
});
export type SaveDataV7 = z.infer<typeof SaveDataV7Schema>;
```

**Snapshot latest-version pattern** (lines 147-166):
```typescript
const data: SaveDataV7 = {
  version: 7,
  meta,
  branchId: getBranchId(),
  parentSaveId: getParentSaveId(),
  player,
  scene,
  combat: stores.combat.getState(),
  game,
  quest: stores.quest.getState(),
  relations: stores.relations.getState(),
  npcMemorySnapshot: stores.npcMemory.getState(),
  questEventLog: stores.quest.getState().eventLog,
  exploration: stores.exploration.getState(),
  playerKnowledge: stores.playerKnowledge.getState(),
  turnLog: stores.turnLog.getState().entries,
  narrativeState: stores.narrativeStore.getState(),
  worldMemory: stores.worldMemory.getState(),
};
return JSON.stringify(data);
```

**Restore migration + parse + error formatting pattern** (lines 169-186):
```typescript
restore(json: string): void {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Invalid save data: malformed JSON');
  }

  const migrated = migrateToLatest(raw);
  const result = SaveDataV7Schema.safeParse(migrated);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const detail = firstIssue
      ? `${firstIssue.path.join('.')} — ${firstIssue.message}`
      : result.error.message ?? 'unknown error';
    throw new Error(`Invalid save data: ${detail}`);
  }
```

**Apply:** Add `SaveDataV8Schema` (or V7 augmentation only if planner chooses, but current latest is already V7). Snapshot should write namespaced IDs only; restore should validate latest schema after migration.

---

### `src/persistence/save-migrator.ts` (migration, transform)

**Analog:** current `src/persistence/save-migrator.ts`

**Migration function pattern** (lines 111-123 and 145-154):
```typescript
export function migrateV5ToV6(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const data = raw as Record<string, unknown>;
  if (data['version'] !== 5) return raw;
  const scene = (data['scene'] as Record<string, unknown> | undefined) ?? {};
  return {
    ...data,
    version: 6,
    scene: {
      ...scene,
      droppedItems: scene['droppedItems'] ?? [],
    },
  };
}

export function migrateV6ToV7(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const data = raw as Record<string, unknown>;
  if (data['version'] !== 6) return raw;
  return {
    ...data,
    version: 7,
    worldMemory: getDefaultWorldMemoryState(),
  };
}
```

**Latest chain pattern** (lines 156-164):
```typescript
export function migrateToLatest(raw: unknown): SaveDataV7 {
  const v2 = migrateV1ToV2(raw);
  const v3 = migrateV2ToV3(v2);
  const v4 = migrateV3ToV4(v3);
  const v5 = migrateV4ToV5(v4);
  const v6 = migrateV5ToV6(v5);
  const normalizedV6 = normalizeNpcMemorySnapshot(v6);
  const v7 = migrateV6ToV7(normalizedV6);
  return v7 as SaveDataV7;
}
```

**Apply:** Add `migrateV7ToV8` for eager namespacing if latest remains V7 today. Convert all persisted bare entity ids to `@classic_fantasy/...`: `scene.sceneId`, exits/objects/dropped items, quest ids/stage refs/objective target ids, relation maps, NPC memory keys and participants, player knowledge `codexEntryId`, turn log/check refs if structured, world memory refs, branch refs if entity-like. Preserve non-entity ids and already namespaced ids idempotently.

---

### `world-data/manifest.yaml` / `world-data/packs/classic_fantasy/**` (config/data, file-I/O)

**Analog:** `world-data/world-manifest.json`, `world-data/codex/locations.yaml`, `world-data/codex/npcs.yaml`, `world-data/codex/quests.yaml`

**Manifest baseline** (`world-data/world-manifest.json` lines 1-7):
```json
{
  "version": "1.2.0",
  "gameVersion": "1.5.0",
  "generatedAt": "2026-05-03",
  "worldDataSchema": "2.0.0",
  "migration": "world-data-authoring-v2"
}
```

**Location reference fields to normalize** (`locations.yaml` lines 71-87):
```yaml
  exits:
    - direction: south
      targetId: loc_main_street
    - direction: north
      targetId: loc_forest_road
  notable_npcs:
    - npc_guard
    - npc_captain
    - npc_hunter
  objects:
    - notice_board
    - oil_lamp
    - gate_drop_mechanism
    - night_patrol_log
    - rutted_tracks
    - wolf_pawprints
```

**NPC reference fields to normalize** (`npcs.yaml` lines 21-29, 40-42, 53-64):
```yaml
  ecology:
    belief_hooks:
      - when: player_asks_about_gate
        holder_id: npc_guard
        holder_type: npc
        subject_id: loc_north_gate
        stance: knows
        statement: 北门守卫知道北门日常通行、夜巡临时改线和某夜提前落闸的异常。
        confidence: 0.9
  social_memory:
    shares_with:
      - faction_guard
  location_id: loc_north_gate
```

**Quest reference fields to normalize** (`quests.yaml` lines 21-36):
```yaml
  stages:
    - id: stage_rumor
      description: 雨夜入镇与酒馆命案——空棺葬礼、北门提前落闸，濒死猎人留下“它们在找名字”的遗言。
      trigger:
        event: dialogue_ended
        targetId: npc_bartender
      objectives:
        - id: obj_talk_bartender_rain_night
          type: talk
          targetId: npc_bartender
          description: 在酒馆询问雨夜命案、空棺葬礼和北门落闸的说法。
```

**Apply:** Keep authoring YAML human-readable and git-diffable. Same-pack bare refs can remain in pack source if loader normalizes them, but built-in restructured data should validate as `@classic_fantasy` in merged `WorldState`.

---

## Test Pattern Assignments

### `src/world-packs/loader.test.ts` / `validate.test.ts` (test, file-I/O + transform)

**Analog:** `src/codex/loader.test.ts`

**Temp YAML write + cleanup pattern** (lines 119-133):
```typescript
const tmpDir = await mkdtemp(join(tmpdir(), "codex-loader-v2-"));
const tmpPath = resolve(tmpDir, "loader-v2.yaml");
await Bun.write(tmpPath, yaml);
try {
  const [entry] = await loadCodexFile(tmpPath);

  expect(entry.player_facing?.short_label).toBe("Loader v2");
  expect(entry.player_facing?.sensory?.sights).toEqual(["blue lanterns"]);
  expect(entry.ai_grounding?.must_know).toEqual(["Preserve this grounding fact"]);
  expect(entry.ai_grounding?.reveal_policy?.default).toBe("public_surface_only");
  expect(entry.ecology?.facts_seeded?.[0]?.id).toBe("fact_loader_v2");
  expect(entry.ecology?.belief_hooks?.[0]?.holder_id).toBe("npc_guard");
} finally {
  await rm(tmpDir, { recursive: true, force: true });
}
```

**World-data audit style** (`loader.test.ts` lines 164-176):
```typescript
it("loads all entries keyed by id", () => {
  expect(codex.size).toBeGreaterThanOrEqual(16);
  expect(codex.has("race_human")).toBe(true);
  expect(codex.has("loc_north_gate")).toBe(true);
});

it("all entries are validated CodexEntry instances", () => {
  for (const [id, entry] of codex) {
    expect(entry.id).toBe(id);
    expect(typeof entry.type).toBe("string");
    expect(typeof entry.name).toBe("string");
  }
});
```

**Apply:** Include tests for: Classic Fantasy pack validates, two packs load together, duplicate FQIDs fail, same-pack refs normalize, cross-pack bare refs fail, missing/cyclic dependencies fail, warm cache returns merged state.

---

### `src/world-packs/cache.test.ts` (test, file-I/O)

**Analog:** `src/persistence/save-file-manager.test.ts`

**Mock Bun and injected fs pattern** (lines 1-33):
```typescript
import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import path from 'node:path';
import { _fs, getSaveDir, ensureSaveDirExists, quickSave, saveGame, loadGame, listSaves, readSaveData } from './save-file-manager';

const mockBunWrite = mock(() => Promise.resolve(0));
const mockBunFile = mock((filePath: string) => ({
  text: mock(() => Promise.resolve(JSON.stringify({ meta: { saveName: 'Test Save' } }))),
  exists: mock(() => Promise.resolve(true)),
}));

let mkdirSpy: ReturnType<typeof spyOn>;
let readdirSpy: ReturnType<typeof spyOn>;
const originalBunWrite = ((globalThis as Record<string, unknown>).Bun as Record<string, unknown> | undefined)?.write;
const originalBunFile = ((globalThis as Record<string, unknown>).Bun as Record<string, unknown> | undefined)?.file;

beforeEach(() => {
  mkdirSpy = spyOn(_fs, 'mkdir').mockImplementation(() => Promise.resolve(undefined));
  readdirSpy = spyOn(_fs, 'readdir').mockImplementation((() => Promise.resolve(['quicksave.json'])) as unknown as typeof _fs.readdir);
  if (typeof Bun !== 'undefined') {
    (Bun as unknown as Record<string, unknown>).write = mockBunWrite;
    (Bun as unknown as Record<string, unknown>).file = mockBunFile;
  }
  mockBunWrite.mockClear();
  mockBunFile.mockClear();
});
```

---

### `src/world-packs/diff.test.ts` (test, transform)

**Analog:** `src/engine/branch-diff.test.ts`

**Fixture builder + focused diff assertions** (lines 7-19, 82-104, 106-143):
```typescript
function makeMinimalSave(overrides: Partial Partial<SaveDataV4> = {}): SaveDataV4 {
  return {
    version: 4,
    meta: {
      saveName: 'test',
      timestamp: '2026-01-01T00:00:00Z',
      character: { name: 'Hero', race: 'Human', profession: 'Warrior' },
      playtime: 0,
      locationName: 'town',
    },
    ...overrides,
  } as SaveDataV4;
}

describe('compareBranches', () => {
  it('returns empty diffs for identical snapshots', () => {
    const save = makeMinimalSave();
    const result = compareBranches(save, save);
    expect(result.diffs).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.highImpactCount).toBe(0);
  });

  it('detects quest status change with marker ~', () => {
    // build source/target fixtures
    const result = compareBranches(source, target);
    const questDiff = result.diffs.find(d => d.category === 'quest' && d.key === 'quest_1');
    expect(questDiff).toBeDefined();
    expect(questDiff!.marker).toBe('~');
  });
});
```

---

### `src/persistence/save-migrator.test.ts` (test, transform)

**Analog:** current `src/persistence/save-migrator.test.ts`

**Migration tests to copy** (lines 284-299, 301-308):
```typescript
describe('migrateV6ToV7', () => {
  it('upgrades version 6 to 7 and adds empty worldMemory', () => {
    const result = migrateV6ToV7(validV6) as Record<string, unknown>;
    expect(result['version']).toBe(7);
    expect(result['worldMemory']).toEqual(getDefaultWorldMemoryState());
  });

  it('returns non-version-6 objects unchanged', () => {
    const v7 = { version: 7, worldMemory: getDefaultWorldMemoryState() };
    expect(migrateV6ToV7(v7)).toBe(v7);
  });

  it('returns null unchanged', () => {
    expect(migrateV6ToV7(null)).toBeNull();
  });
});

describe('migrateToLatest', () => {
  it('upgrades a valid V4 save to SaveDataV7 with narrativeState, droppedItems, and worldMemory', () => {
    const result = migrateToLatest(validV4);
    expect(result.version).toBe(7);
    expect(result.narrativeState).toEqual(getDefaultNarrativeState());
    expect(result.scene.droppedItems).toEqual([]);
    expect(result.worldMemory).toEqual(getDefaultWorldMemoryState());
  });
});
```

**Apply:** Add idempotency tests: already namespaced refs stay unchanged; bare Classic Fantasy refs become `@classic_fantasy/...`; migration handles nested maps and arrays; non-entity strings are preserved.

## Shared Patterns

### Strict Zod validation with actionable errors
**Source:** `src/codex/loader.ts` lines 19-30, `src/world-manifest-schema.ts` lines 6-14  
**Apply to:** manifest schema, pack validation, loader validation, save schema updates
```typescript
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

### File I/O abstraction for testability
**Source:** `src/persistence/save-file-manager.ts` lines 15-20, `src/codex/loader.ts` line 6  
**Apply to:** loader, cache, init, validate
```typescript
// Injected fs — allows tests to override without mock.module
export const _fs = {
  ...nodeFs,
  mkdir: fsMkdir,
  readdir: fsReaddir,
};
```

### Bun file operations
**Source:** `src/codex/loader.ts` lines 8-11, `src/persistence/save-file-manager.ts` lines 37-42  
**Apply to:** YAML reading, JSON cache read/write, pack scaffold writes
```typescript
const file = Bun.file(filePath);
const text = await file.text();
const rawEntries = parseYaml(text);

await Bun.write(filePath, json);
```

### Platform-aware cache/data paths
**Source:** `src/persistence/save-file-manager.ts` lines 22-27  
**Apply to:** WorldState cache path
```typescript
export function getSaveDir(opts?: { portable?: boolean; customDir?: string }): string {
  if (opts?.customDir) return path.resolve(opts.customDir);
  if (opts?.portable) return './saves';
  const paths = envPaths('Chronicle', { suffix: '' });
  return `${paths.data}/saves`;
}
```

### Commander top-level boot boundary
**Source:** `src/cli.ts` lines 5-18  
**Apply to:** `chronicle init`, `chronicle validate`, `chronicle diff`, pre-React loader
```typescript
const program = new Command()
  .name('chronicle')
  .description('AI-driven CLI interactive novel game')
  .version('1.1.0')
  .option('--world-dir <path>', 'Custom world data directory')
  .action(async (opts: { worldDir?: string }) => {
    if (opts.worldDir) {
      guardWorldDirPath(opts.worldDir);
    }
    const dataDir = resolveDataDir({ worldDir: opts.worldDir });
    process.env.__CHRONICLE_DATA_DIR = dataDir;

    await import('./index');
  });
```

### Versioned save migration
**Source:** `src/persistence/save-migrator.ts` lines 145-164 and `src/state/serializer.ts` lines 177-185  
**Apply to:** eager namespaced ID migration
```typescript
export function migrateV6ToV7(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const data = raw as Record<string, unknown>;
  if (data['version'] !== 6) return raw;
  return {
    ...data,
    version: 7,
    worldMemory: getDefaultWorldMemoryState(),
  };
}

const migrated = migrateToLatest(raw);
const result = SaveDataV7Schema.safeParse(migrated);
```

### React App consumes prepared state via props/context, not direct domain I/O
**Source:** `src/app.tsx` lines 146-155, 404-428  
**Apply to:** replace `loadAllCodex` effect with preloaded `WorldState` consumption
```typescript
const questSystem = useMemo(
  () => {
    if (allCodexEntries.size === 0) return createNoopQuestSystem();
    return createQuestSystem(
      { quest: ctx.stores.quest, relation: ctx.stores.relation, game: ctx.stores.game, player: ctx.stores.player },
      allCodexEntries as Map<string, CodexEntry>,
      ctx.eventBus,
    );
  },
  [ctx, allCodexEntries],
);
```

## No Analog Found

No target file lacks an analog. The codebase already has close matches for strict schemas, YAML loaders, commander routing, file caches, versioned migrations, diff generation, and React state consumption.

## Metadata

**Analog search scope:** `src/**/*.ts`, `src/**/*.tsx`, `world-data/**/*`, phase context, roadmap, requirements  
**Files scanned/read:** 29 primary analog/context files  
**Project skills:** checked `.claude/skills/` and `.agents/skills/`; no project skill indexes found  
**Research file:** no `23-RESEARCH.md` present during mapping  
**Pattern extraction date:** 2026-05-08
