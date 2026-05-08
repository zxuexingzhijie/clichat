# Phase 23: World Pack Platform - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 23-world-pack-platform
**Areas discussed:** Namespace model, Pack composition, Authoring CLI, Loader/cache boundary

---

## Namespace Model

| Option | Description | Selected |
|--------|-------------|----------|
| All entity refs | Namespace all cross-system IDs including codex, quests, NPCs, locations, items, relations, saves, event logs, world memory | ✓ |
| Codex only | Namespace codex entries, keep saves/runtime mostly bare-ID compatible | |
| Boundary only | Namespace at pack boundary, resolve to bare IDs internally | |

**User's choice:** All entity refs.
**Notes:** Classic Fantasy prefix selected as `@classic_fantasy`. Save migration selected as eager migration to a new save version with persisted namespaced IDs.

---

## Pack Composition

| Option | Description | Selected |
|--------|-------------|----------|
| Strict additive | No silent overrides; extensions require explicit dependency and target | ✓ |
| Override allowed | Explicit override declarations can replace upstream entities | |
| Last wins | Load-order-based overwrite | |

**User's choice:** Strict additive.
**Notes:** Dependencies are required-only for Phase 23 and loader must topologically sort. Cross-pack references must use full `@pack/id`; same-pack refs may be bare and normalized by loader.

---

## Authoring CLI

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal valid | `chronicle init` creates manifest + codex directories + example location/NPC/item/quest | ✓ |
| Empty scaffold | `chronicle init` creates only directories and manifest | |
| Template variants | `chronicle init --template ...` variants | |

**User's choice:** Minimal valid for init; deep validation for validate; entity-grouped field summary for diff.
**Notes:** `chronicle validate` should check schema, refs, dependencies/toposort, namespace rules, and Classic Fantasy self-validation. `chronicle diff` should be structured and deterministic, not raw YAML diff.

---

## Loader / Cache Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| CLI pre-React | WorldPackLoader runs from CLI before React startup | ✓ |
| App boot | Keep async App useEffect loading but replace internals | |
| Hybrid | CLI parses config, App loads codex | |

**User's choice:** CLI pre-React loader.
**Notes:** Cache stores merged WorldState JSON with manifest/hash metadata. Invalidation uses recursive mtime+size hash. Cache lives in user cache dir via env-paths.

---

## Claude's Discretion

- Exact module names and schema decomposition.
- Exact save version number, while preserving eager namespaced migration.
- Whether to add optional cache bypass flags if they fit naturally.

## Deferred Ideas

- `chronicle init --template` variants.
- Optional pack dependencies.
- Last-wins or broad override semantics.
- Gameplay-impact prose diff reports.
