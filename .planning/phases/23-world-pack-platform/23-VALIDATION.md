---
phase: 23
slug: world-pack-platform
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-08
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test 1.3.12 |
| **Config file** | `package.json` scripts; no separate test config required |
| **Quick run command** | `/Users/makoto/.bun/bin/bun test src/world-packs/ src/persistence/save-migrator.test.ts src/state/serializer.test.ts src/paths.test.ts` |
| **Full suite command** | `/Users/makoto/.bun/bin/bun test && /Users/makoto/.bun/bin/bun run typecheck` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run the focused `<automated>` command listed in that task.
- **After every plan:** Run focused phase tests plus `/Users/makoto/.bun/bin/bun run typecheck`; final integration plans also run full suite.
- **Before `/gsd-verify-work`:** Full suite, typecheck, build, Classic Fantasy validation, and warm-cache benchmark must be green.
- **Max feedback latency:** one task for module-level tests; one plan for full-suite feedback.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 23-01-01 | TBD | TBD | WPK-01 | T-23-path / T-23-yaml | Manifest rejects malformed/unsafe pack metadata | unit | `/Users/makoto/.bun/bin/bun test src/world-packs/manifest-schema.test.ts` | ❌ W0 | ⬜ pending |
| 23-01-02 | TBD | TBD | WPK-02 | T-23-ref | Namespace helpers normalize same-pack refs and reject ambiguous cross-pack refs | unit | `/Users/makoto/.bun/bin/bun test src/world-packs/namespace.test.ts` | ❌ W0 | ⬜ pending |
| 23-02-01 | TBD | TBD | WPK-01, WPK-02, WPK-03 | T-23-ref / T-23-dup | Loader validates schema, refs, duplicates, missing deps, and cycles before runtime | unit | `/Users/makoto/.bun/bin/bun test src/world-packs/loader.test.ts src/world-packs/validate.test.ts` | ❌ W0 | ⬜ pending |
| 23-03-01 | TBD | TBD | WPK-04 | T-23-path | `chronicle init` scaffolds a valid pack without unsafe writes | unit/integration | `/Users/makoto/.bun/bin/bun test src/world-packs/init.test.ts src/cli.test.ts` | ❌ W0 | ⬜ pending |
| 23-03-02 | TBD | TBD | WPK-04 | T-23-ref | `chronicle validate` catches broken refs/deps/namespace rules | unit/integration | `/Users/makoto/.bun/bin/bun test src/world-packs/validate.test.ts src/cli.test.ts` | ❌ W0 | ⬜ pending |
| 23-03-03 | TBD | TBD | WPK-04 | N/A | `chronicle diff` emits deterministic entity/field summary | unit/integration | `/Users/makoto/.bun/bin/bun test src/world-packs/diff.test.ts src/cli.test.ts` | ❌ W0 | ⬜ pending |
| 23-04-01 | TBD | TBD | WPK-05, WPK-08 | T-23-boot | WorldPackLoader runs before React and App consumes prepared WorldState | integration/source | `/Users/makoto/.bun/bin/bun test src/cli.test.ts src/app.test.tsx src/paths.test.ts` | ❌ W0 | ⬜ pending |
| 23-04-02 | TBD | TBD | WPK-06 | T-23-cache | Warm cache validates metadata/hash and avoids stale/cache-poisoned data | unit/perf | `/Users/makoto/.bun/bin/bun test src/world-packs/cache.test.ts` | ❌ W0 | ⬜ pending |
| 23-05-01 | TBD | TBD | WPK-07 | T-23-migration | Save migration eagerly/idempotently namespaces persisted refs without data loss | unit | `/Users/makoto/.bun/bin/bun test src/persistence/save-migrator.test.ts src/state/serializer.test.ts` | ✅ existing files need updates | ⬜ pending |
| 23-05-02 | TBD | TBD | WPK-01..WPK-08 | T-23-regression | Classic Fantasy validates as `@classic_fantasy`; two packs load together; full suite remains green | integration | `/Users/makoto/.bun/bin/bun test && /Users/makoto/.bun/bin/bun run typecheck && /Users/makoto/.bun/bin/bun run build` | ✅ existing infra | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/world-packs/manifest-schema.test.ts` — WPK-01 manifest schema and directory contract tests.
- [ ] `src/world-packs/namespace.test.ts` — WPK-02 namespace/ref normalization tests.
- [ ] `src/world-packs/loader.test.ts` — WPK-01/WPK-02/WPK-03/WPK-05 loader/toposort tests.
- [ ] `src/world-packs/validate.test.ts` — WPK-04 deep validation tests.
- [ ] `src/world-packs/diff.test.ts` — WPK-04 entity/field diff tests.
- [ ] `src/world-packs/cache.test.ts` — WPK-06 cache hit/miss/invalidation and warm-cache benchmark tests.
- [ ] `src/world-packs/init.test.ts` — WPK-04 valid scaffold tests.
- [ ] `src/cli.test.ts` or equivalent boot/command routing tests — WPK-04/WPK-05 coverage.
- [ ] Update `src/persistence/save-migrator.test.ts` and `src/state/serializer.test.ts` — WPK-07 namespaced save migration coverage.

---

## Manual-Only Verifications

All Phase 23 core behaviors should have automated verification. Optional human review of generated scaffold readability may be useful, but it is not a blocking validation item.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] Feedback latency bounded to one task/plan.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-05-08
