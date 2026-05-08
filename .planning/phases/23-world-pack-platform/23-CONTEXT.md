# Phase 23: World Pack Platform - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning


<domain>
## Phase Boundary

Build the World Pack Platform so Chronicle can load Classic Fantasy as a namespaced built-in pack and load a second pack alongside it without ID collisions. This phase defines the pack manifest/directory contract, namespace migration, composable dependency loading, authoring CLI commands (`chronicle init`, `chronicle validate`, `chronicle diff`), pre-React pure WorldPackLoader, cached WorldState, and save migration to namespaced IDs.

</domain>


<decisions>
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

</decisions>


<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product / Roadmap

- `.planning/ROADMAP.md` §Phase 23 — phase goal and success criteria.
- `.planning/REQUIREMENTS.md` §World Pack Platform — WPK-01 through WPK-08 definitions.
- `.planning/PROJECT.md` §Current Milestone and §Constraints — CLI-first, TypeScript+Bun, YAML/JSON world data, no vector DB.

### Prior Phase Architecture

- `.planning/phases/22-ux-architecture-refactor/22-VERIFICATION.md` — confirms Phase 22 architecture is complete and GameScreen/App/provider boundaries are stable.
- `.planning/phases/22-ux-architecture-refactor/22-CONTEXT.md` — provider and input architecture decisions relevant to App integration.

### Current Code Integration Points

- `src/cli.ts` — current pre-React CLI boundary; presently resolves `--world-dir`, sets `__CHRONICLE_DATA_DIR`, then imports `index`.
- `src/paths.ts` — current `resolveDataDir` defaulting to `world-data`.
- `src/app.tsx` — current codex loading integration; must stop hardcoding direct `world-data/codex` loading after WorldPackLoader exists.
- `src/codex/loader.ts` — existing YAML codex loader and duplicate bare-ID detection.
- `src/codex/schemas/entry-types.ts` and `src/codex/schemas/authoring-v2.ts` — codex schema patterns for pack validation.
- `src/world-manifest-schema.ts` and `world-data/world-manifest.json` — current single-world manifest baseline.
- `src/persistence/save-migrator.ts` and `src/state/serializer.ts` — save schema/migration path for namespaced ID migration.
- `src/engine/world-memory-recorder.ts` — static world data seeding from codex entries; pack composition/toposort may affect this.
- `world-data/` — current Classic Fantasy content to restructure/validate as the built-in `@classic_fantasy` pack.

</canonical_refs>


<code_context>
## Existing Code Insights

### Reusable Assets

- `src/world-manifest-schema.ts` and `src/codex/world-manifest.test.ts`: current strict manifest schema/test pattern for extending to pack manifests.
- `src/codex/loader.ts`: existing YAML read/parse/validate loop and duplicate ID error path; useful starting point for per-pack loading and merged map construction.
- `src/codex/schemas/*`: strict Zod schemas for entity validation; `validate` should reuse these rather than inventing a second schema system.
- `src/persistence/save-migrator.ts`: existing migration chain; use it for eager namespaced ID migration.
- `src/paths.ts`: current path resolution and world-dir override seam.
- `env-paths` dependency: already available for user cache directory selection.

### Established Patterns

- CLI uses `commander` and currently routes boot options before importing React app.
- World data is human-readable YAML/JSON and should remain git-diffable.
- Existing schema validation is strict Zod validation; errors should be deterministic and actionable.
- Runtime game systems consume `Map<string, CodexEntry>` heavily; pack loader should preserve or adapt that surface carefully.
- Save data uses versioned schemas and migration functions; do not mutate old saves in place without schema migration.

### Integration Points

- `cli.ts`: add authoring subcommands and/or pre-React loader invocation here.
- `app.tsx`: consume loaded WorldState instead of loading `world-data/codex` from a React effect.
- `queryById`, scene manager, dialogue manager, quest system, world memory seeding: all likely need namespace-aware IDs or normalized namespaced entries.
- `save-migrator.ts` / `serializer.ts`: add eager migration and updated save schema for namespaced IDs.
- Cache layer: should sit between pack file scanning and App boot, not inside React components.

</code_context>

<specifics>
## Specific Ideas

- Classic Fantasy should become `@classic_fantasy`, not `@classic` or `@core`.
- `chronicle init` should create a minimal valid pack with examples and comments rather than an empty skeleton.
- `chronicle validate` should be deep enough to fail broken refs/dependencies before runtime.
- `chronicle diff` should be entity-grouped and field-aware, not raw YAML diff.
- Cache should be invisible to authors by default and live in the user cache directory, not in pack source.

</specifics>


<deferred>
## Deferred Ideas

- Multiple `chronicle init --template ...` variants are not required in Phase 23; future phase can add template families.
- Optional dependencies are not required in Phase 23; use required dependencies only.
- Last-wins override semantics are explicitly out of scope for Phase 23.
- Gameplay-impact prose diff reports are deferred; Phase 23 diff is structured entity/field summary.

</deferred>

---

*Phase: 23-World Pack Platform*
*Context gathered: 2026-05-08*
