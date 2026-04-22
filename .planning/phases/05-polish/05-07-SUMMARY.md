---
phase: "05-polish"
plan: "07"
subsystem: "ai"
tags: [prompt-caching, llm, providers, anthropic, google, openai]
dependency_graph:
  requires: ["05-02", "05-03"]
  provides: ["LLM-01", "LLM-03"]
  affects: ["src/ai/providers.ts", "src/app.tsx", "src/ai/roles/narrative-director.ts", "src/ai/roles/npc-actor.ts"]
tech_stack:
  added: []
  patterns: ["provider-specific prompt caching", "Anthropic ephemeral cacheControl via messages array", "Google implicit prefix caching via stable system prompt"]
key_files:
  modified:
    - src/ai/providers.ts
    - src/ai/providers.test.ts
    - src/app.tsx
    - src/ai/roles/narrative-director.ts
    - src/ai/roles/npc-actor.ts
decisions:
  - "initRoleConfigs called in useEffect in App component (fire-and-forget, falls back to defaults on failure)"
  - "providerName field added to RoleConfig; propagated from entry.provider in buildRoleConfigs and hardcoded 'google' in DEFAULT_ROLE_CONFIGS"
  - "Anthropic caching: messages array with ephemeral cacheControl on static system content part"
  - "Google/OpenAI caching: system+prompt shorthand with stable system value per sceneType (implicit prefix caching)"
  - "npc-actor uses same conditional pattern for generateObject — Anthropic path uses messages array"
metrics:
  duration: "~8min"
  completed: "2026-04-22"
  tasks: 2
  files: 5
---

# Phase 05 Plan 07: AI Config Startup and Prompt Caching Summary

**One-liner:** Provider-aware prompt caching with Anthropic ephemeral cacheControl and Google prefix ordering, plus ai-config.yaml initialization at app startup.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add providerName to RoleConfig; call initRoleConfigs at app startup | 0be8bea | src/ai/providers.ts, src/ai/providers.test.ts, src/app.tsx |
| 2 | Implement provider-specific prompt caching in narrative-director and npc-actor | 2f58e58 | src/ai/roles/narrative-director.ts, src/ai/roles/npc-actor.ts |

## What Was Built

**Task 1** extended `RoleConfig` with `readonly providerName: string`, set `providerName: 'google'` on all 6 `DEFAULT_ROLE_CONFIGS` entries, and added `providerName: entry.provider` in `buildRoleConfigs`. `app.tsx` now imports `initRoleConfigs` and calls it in a `useEffect` (fire-and-forget, errors fall back to defaults).

**Task 2** replaced the single `generateText`/`streamText`/`generateObject` call in each role with a provider-conditional branch:
- `providerName === 'anthropic'`: uses `messages` array with a two-part `content` — static system text marked `providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } }` followed by dynamic user prompt.
- All other providers: existing `system` + `prompt` shorthand (Google auto-caches stable prefix; OpenAI caches prompts >= 1024 tokens automatically).

Both `streamNarration` and `generateNarration` in `narrative-director.ts` have the conditional. `npc-actor.ts` applies the same pattern to `generateObject`.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

```
grep -n "providerName" src/ai/providers.ts         # 8 matches (type + 6 defaults + buildRoleConfigs)
grep -n "initRoleConfigs" src/app.tsx               # 2 matches (import + call)
grep -n "cacheControl|ephemeral" src/ai/roles/narrative-director.ts  # 2 matches
grep -n "cacheControl" src/ai/roles/npc-actor.ts    # 1 match
bun test  # 637 pass, 0 fail
```

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes at trust boundaries beyond what the plan's threat model covers (T-05-15, T-05-16, T-05-17).

## Self-Check: PASSED

- src/ai/providers.ts — FOUND
- src/app.tsx — FOUND
- src/ai/roles/narrative-director.ts — FOUND
- src/ai/roles/npc-actor.ts — FOUND
- commit 0be8bea — FOUND
- commit 2f58e58 — FOUND
