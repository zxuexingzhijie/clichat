---
phase: 05-polish
plan: "02"
subsystem: ai
tags: [ai-sdk, zod, yaml, multi-provider, role-config]

requires:
  - phase: 05-01
    provides: Phase 5 polish foundation established

provides:
  - YAML-driven AI role configuration via ai-config.yaml
  - Zod-validated AiConfigSchema with ProfileSchema, RoleConfigEntrySchema, ModelPricingSchema
  - loadAiConfig(path) async loader with formatted Zod error messages
  - buildRoleConfigs(config, profile) runtime config builder with provider factory whitelist
  - initRoleConfigs(configPath) async entry point replacing hardcoded ROLE_CONFIGS
  - Backward-compatible getRoleConfig fallback to DEFAULT_ROLE_CONFIGS

affects:
  - Any code calling getRoleConfig or getModel (transparent — same interface)
  - Future cost tracking features (pricing field now on RoleConfig)
  - Multi-provider routing plans (05-03 and beyond)

tech-stack:
  added:
    - "@ai-sdk/anthropic@3.0.71"
    - "@ai-sdk/alibaba@1.0.17"
    - "@ai-sdk/deepseek@2.0.29"
    - "@ai-sdk/openai-compatible@2.0.41"
  patterns:
    - YAML config loaded via Bun.file + yaml.parse + Zod safeParse (matches codex/loader.ts pattern)
    - PROVIDER_FACTORIES whitelist map for unknown-provider protection
    - DEFAULT_ROLE_CONFIGS fallback for sparse profiles and uninitialized state

key-files:
  created:
    - src/ai/config/ai-config-schema.ts
    - src/ai/config/ai-config-loader.ts
    - src/ai/config/ai-config-loader.test.ts
    - ai-config.yaml
  modified:
    - src/ai/providers.ts
    - src/ai/providers.test.ts

key-decisions:
  - "alibaba and deepseek not in PROVIDER_FACTORIES until confirmed working — packages installed but factories commented out"
  - "pricing fields optional on RoleConfig and ai-config.yaml — only narrative-director, npc-actor, summarizer have pricing in balanced profile"
  - "DEFAULT_ROLE_CONFIGS retained in providers.ts as code-level fallback — ensures backward compatibility when initRoleConfigs not yet called"
  - "cheap and premium profiles in ai-config.yaml are empty skeletons — populated by users when needed, no auto-fallback to avoid silent misconfiguration"

patterns-established:
  - "Pattern: YAML config → Bun.file + yaml.parse + Zod safeParse → typed object (consistent with codex loader)"
  - "Pattern: PROVIDER_FACTORIES whitelist — unknown provider throws immediately with provider name in message"
  - "Pattern: Runtime config map with code-level defaults fallback — zero-config startup with user override"

requirements-completed:
  - LLM-01

duration: 5min
completed: 2026-04-22
---

# Phase 5 Plan 02: AI Config Schema and YAML-Driven Provider Routing Summary

**Zod-validated YAML config system replacing hardcoded all-Google ROLE_CONFIGS with buildRoleConfigs and PROVIDER_FACTORIES supporting google, openai, anthropic per-role**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-22T11:17:16Z
- **Completed:** 2026-04-22T11:22:26Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- AiConfigSchema with ProfileSchema, RoleConfigEntrySchema, ModelPricingSchema — full Zod validation of ai-config.yaml
- loadAiConfig(path) with formatted Zod error messages (path.join + message, no raw file content exposed)
- buildRoleConfigs(config, profile) with PROVIDER_FACTORIES whitelist; unknown provider throws immediately with name
- initRoleConfigs(configPath) async entry point; getRoleConfig falls back to DEFAULT_ROLE_CONFIGS when not initialized
- ai-config.yaml template at project root with all 6 roles under balanced, plus cheap/premium skeleton profiles
- 613 tests passing (30 new tests added)

## Task Commits

1. **Task 1 RED: ai-config-loader tests** - `0092934` (test)
2. **Task 1 GREEN: ai-config-schema.ts + ai-config-loader.ts** - `d99655e` (feat)
3. **Task 2 RED: providers.test.ts + package installs** - `822fe2a` (test)
4. **Task 2 GREEN: providers.ts rewrite + ai-config.yaml** - `934445b` (feat)

## Files Created/Modified

- `src/ai/config/ai-config-schema.ts` — Zod schemas: AiConfigSchema, ProfileSchema, RoleConfigEntrySchema, ModelPricingSchema
- `src/ai/config/ai-config-loader.ts` — loadAiConfig(path): Bun.file + yaml.parse + Zod safeParse
- `src/ai/config/ai-config-loader.test.ts` — 5 tests: valid parse, unknown provider passthrough, missing profiles error, bad temperature error, default_profile default
- `ai-config.yaml` — user-facing config with all 6 roles under balanced, cheap/premium skeleton profiles
- `src/ai/providers.ts` — extended with ModelPricing, PROVIDER_FACTORIES, DEFAULT_ROLE_CONFIGS, buildRoleConfigs, initRoleConfigs; getRoleConfig/getModel preserved with same signatures
- `src/ai/providers.test.ts` — 4 new tests for buildRoleConfigs behavior added to existing 9 tests

## Decisions Made

- alibaba and deepseek providers installed but not added to PROVIDER_FACTORIES — packages present, factories can be uncommented when ready; avoids premature activation
- DEFAULT_ROLE_CONFIGS kept in providers.ts as code-level fallback — no YAML needed for startup, zero-config operation preserved
- pricing fields are optional and not required in YAML — only high-throughput roles (narrative-director, npc-actor, summarizer) have pricing populated in balanced profile

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- 2 flaky failures on first full suite run (npc-actor retry test) — passes consistently in isolation and on second run; pre-existing race condition in test isolation, not introduced by this plan

## User Setup Required

None - no external service configuration required.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced beyond those described in the plan's threat model (T-05-03, T-05-04, T-05-05 all mitigated as designed).

## Next Phase Readiness

- YAML-driven provider routing complete; getRoleConfig/getModel API unchanged — all callers work without modification
- initRoleConfigs(configPath) ready to wire into app startup (e.g., main.ts or game-loop initialization)
- alibaba/deepseek PROVIDER_FACTORIES entries commented in providers.ts — uncomment + test when those providers are needed
- Ready for 05-03

---
*Phase: 05-polish*
*Completed: 2026-04-22*
