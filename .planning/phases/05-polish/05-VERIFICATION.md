---
phase: 05-polish
verified: 2026-04-22T12:00:00Z
status: human_needed
score: 27/27 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run the game, make an AI call (e.g. :look in a scene), then type /cost"
    expected: "Token counts update in the status bar (T:{n}) and /cost shows non-zero tokens with estimated cost"
    why_human: "Requires live AI API key; can't verify real token accumulation programmatically"
  - test: "Run the game, navigate a few turns, then type /replay 5"
    expected: "ReplayPanel opens with last 5 turns listed; arrow keys navigate; Esc returns to game"
    why_human: "Visual terminal behavior, interactive keyboard navigation requires human observation"
  - test: "Wait for background summarizer to fire (>= 10 NPC memory entries) or trigger via save"
    expected: "SummarizerWorker processes a task without blocking gameplay; NPC memory is compressed"
    why_human: "Background async behavior; requires session state to accumulate enough memory entries"
---

# Phase 05: Polish Verification Report

**Phase Goal:** Polish & Optimization — wire cost tracking UI, replay panel, background summarizer, YAML-driven multi-provider AI config, and prompt caching
**Verified:** 2026-04-22T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | TurnLogEntry carries optional npcDialogue field | ✓ VERIFIED | `src/state/serializer.ts:56` — `npcDialogue: z.array(z.string()).optional()` |
| 2 | NpcMemoryRecord carries version field for atomic summarizer write-back | ✓ VERIFIED | `src/state/npc-memory-store.ts:24` — `version: z.number().int().default(0)` |
| 3 | GamePhaseSchema includes 'replay' and 'cost' phases | ✓ VERIFIED | `src/state/game-store.ts:6` — enum includes both 'replay' and 'cost' |
| 4 | GameActionTypeSchema includes 'cost' action type | ✓ VERIFIED | `src/types/game-action.ts:7` — 'cost' in enum |
| 5 | DomainEvents includes token_usage_updated event | ✓ VERIFIED | `src/events/event-types.ts:59` — `token_usage_updated: { lastTurnTokens: number }` |
| 6 | SaveDataV4 schema and V3→V4 migration exist and are wired | ✓ VERIFIED | `src/persistence/save-migrator.ts:36` — `migrateV3ToV4`; `src/state/serializer.ts:152` — chained in restore() |
| 7 | ai-config.yaml exists with all 6 AI roles and balanced/cheap/premium profiles | ✓ VERIFIED | `ai-config.yaml` present; `default_profile: balanced`; all 6 roles under balanced |
| 8 | AiConfigSchema, loadAiConfig, buildRoleConfigs, initRoleConfigs are exported | ✓ VERIFIED | `src/ai/config/ai-config-schema.ts`, `src/ai/config/ai-config-loader.ts`, `src/ai/providers.ts` — all exports confirmed |
| 9 | getRoleConfig reads from runtime-built map with DEFAULT_ROLE_CONFIGS fallback | ✓ VERIFIED | `src/ai/providers.ts:82` — `runtimeRoleConfigs[role] ?? DEFAULT_ROLE_CONFIGS[role]` |
| 10 | Pricing fields carried on RoleConfig | ✓ VERIFIED | `src/ai/providers.ts:26` — `readonly pricing?: ModelPricing`; `src/ai/providers.ts:70` — propagated in buildRoleConfigs |
| 11 | CostSessionStore tracks per-role tokens and estimated cost | ✓ VERIFIED | `src/state/cost-session-store.ts` — `recordUsage()`, `getCostSummary()`, `resetCostSession()` exported |
| 12 | Narrative Director and NPC Actor forward usage to costSessionStore | ✓ VERIFIED | `src/ai/roles/narrative-director.ts:73,134` — `recordUsage('narrative-director', ...)` after generateText and streamText; `src/ai/roles/npc-actor.ts:67` — `recordUsage('npc-actor', ...)` |
| 13 | Cost store resets on state_restored event | ✓ VERIFIED | `src/state/cost-session-store.ts:98` — `eventBus.on('state_restored', () => { resetCostSession(); })` |
| 14 | ReplayPanel renders two-pane timeline from TurnLogEntry[] | ✓ VERIFIED | `src/ui/panels/replay-panel.tsx` — 188 lines, wide/narrow layouts, exports ReplayPanel |
| 15 | Arrow keys, n/p, PgUp/PgDn navigate the replay turn list | ✓ VERIFIED | `src/ui/panels/replay-panel.tsx:74-87` — all navigation keys handled in useInput |
| 16 | ESC closes the replay panel | ✓ VERIFIED | `src/ui/panels/replay-panel.tsx` — `key.escape` triggers `onClose()` |
| 17 | NPC dialogue displayed in replay when present | ✓ VERIFIED | `src/ui/panels/replay-panel.tsx:40-43` — conditional render of `entry.npcDialogue` |
| 18 | SummarizerQueue is priority-sorted with running flag and max 1 concurrent task | ✓ VERIFIED | `src/ai/summarizer/summarizer-queue.ts:37,65` — `enqueueTask`, `dequeuePending` exported; priority sort logic present |
| 19 | SummarizerScheduler gates on combat state and has debounce | ✓ VERIFIED | `src/ai/summarizer/summarizer-scheduler.ts:28` — `combatStore.getState().active` checked; debounce logic present |
| 20 | Atomic write-back applies only when baseVersion matches current store version | ✓ VERIFIED | `src/ai/summarizer/summarizer-worker.ts:31` — `record.version !== task.baseVersion` guards write-back |
| 21 | generateNpcMemorySummary calls AI SDK with summarizer role config | ✓ VERIFIED | `src/ai/roles/memory-summarizer.ts:12` — `getRoleConfig('summarizer')` + `generateText` + `recordUsage('summarizer', ...)` |
| 22 | /cost command returns session totals and per-role breakdown | ✓ VERIFIED | `src/game-loop.ts:272-284` — `getCostSummary()` called, formatted narration returned |
| 23 | /replay N sets phase to 'replay' and passes entries to ReplayPanel | ✓ VERIFIED | `src/game-loop.ts:268` — `gameStore.setState(draft => { draft.phase = 'replay'; })`; `getLastReplayEntries()` export |
| 24 | ReplayPanel wired in game-screen.tsx | ✓ VERIFIED | `src/ui/screens/game-screen.tsx:329-330` — ReplayPanel in panel chain with `isInReplay` guard |
| 25 | Status bar shows lastTurnTokens when > 0 | ✓ VERIFIED | `src/ui/panels/status-bar.tsx:74-75` — `T:{n}` rendered at width >= 85 |
| 26 | initRoleConfigs called at app startup | ✓ VERIFIED | `src/app.tsx:68` — `initRoleConfigs(path.join(process.cwd(), 'ai-config.yaml')).catch(...)` in useEffect |
| 27 | Anthropic roles use messages array with cacheControl on static system content | ✓ VERIFIED | `src/ai/roles/narrative-director.ts:51,112` — `cacheControl: { type: 'ephemeral' }` on Anthropic path; `src/ai/roles/npc-actor.ts:44` same |

**Score:** 27/27 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/state/serializer.ts` | TurnLogEntrySchema with npcDialogue, SaveDataV4Schema | ✓ VERIFIED | npcDialogue optional, SaveDataV4Schema defined |
| `src/state/npc-memory-store.ts` | NpcMemoryRecordSchema with version field | ✓ VERIFIED | version: z.number().int().default(0) at line 24 |
| `src/state/game-store.ts` | GamePhaseSchema with replay and cost | ✓ VERIFIED | 13-element enum confirmed |
| `src/events/event-types.ts` | token_usage_updated event | ✓ VERIFIED | Line 59 |
| `src/persistence/save-migrator.ts` | migrateV3ToV4 function | ✓ VERIFIED | Exported at line 36 |
| `src/ai/config/ai-config-schema.ts` | AiConfigSchema, ProfileSchema, RoleConfigEntrySchema, ModelPricingSchema | ✓ VERIFIED | All exported |
| `src/ai/config/ai-config-loader.ts` | loadAiConfig(configPath) async | ✓ VERIFIED | Exported async function |
| `src/ai/providers.ts` | buildRoleConfigs, initRoleConfigs, providerName, pricing | ✓ VERIFIED | All present |
| `ai-config.yaml` | 6 roles under balanced, cheap/premium skeletons | ✓ VERIFIED | Present at project root |
| `src/state/cost-session-store.ts` | recordUsage, getCostSummary, resetCostSession | ✓ VERIFIED | All exported |
| `src/ai/roles/narrative-director.ts` | recordUsage wired after generateText + streamText | ✓ VERIFIED | Lines 73, 134 |
| `src/ai/roles/npc-actor.ts` | recordUsage wired after generateObject | ✓ VERIFIED | Line 67 |
| `src/ui/panels/replay-panel.tsx` | ReplayPanel component, >= 80 lines | ✓ VERIFIED | 188 lines, exported |
| `src/ai/summarizer/summarizer-queue.ts` | SummarizerTask, enqueueTask, dequeuePending | ✓ VERIFIED | All exported |
| `src/ai/summarizer/summarizer-scheduler.ts` | evaluateTriggers with combat gate | ✓ VERIFIED | combatStore.active guard at line 28 |
| `src/ai/summarizer/summarizer-worker.ts` | runSummarizerLoop, applyNpcMemoryCompression | ✓ VERIFIED | Both exported |
| `src/ai/roles/memory-summarizer.ts` | generateNpcMemorySummary, generateChapterSummary, generateTurnLogCompress | ✓ VERIFIED | All exported with recordUsage |
| `src/game-loop.ts` | getCostSummary, /cost routing, /replay phase routing, getLastReplayEntries | ✓ VERIFIED | All wired |
| `src/input/command-registry.ts` | /cost command registered | ✓ VERIFIED | Line 177 |
| `src/ui/screens/game-screen.tsx` | ReplayPanel in panel chain, lastTurnTokens subscription | ✓ VERIFIED | Lines 329-330, costSessionStore subscribe at line 93-97 |
| `src/ui/panels/status-bar.tsx` | lastTurnTokens prop, T:{n} display | ✓ VERIFIED | Lines 14, 74-75 |
| `src/app.tsx` | initRoleConfigs at startup | ✓ VERIFIED | Line 68 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/state/serializer.ts` | `src/persistence/save-migrator.ts` | `migrateV3ToV4` in restore() | ✓ WIRED | serializer.ts:152 chains migrateV3ToV4 |
| `ai-config.yaml` | `src/ai/config/ai-config-loader.ts` | loadAiConfig(path) | ✓ WIRED | loadAiConfig reads and validates YAML |
| `src/ai/config/ai-config-loader.ts` | `src/ai/providers.ts` | buildRoleConfigs(config, profile) | ✓ WIRED | providers.ts:77 — initRoleConfigs calls loadAiConfig then buildRoleConfigs |
| `src/ai/providers.ts` | all AI role call sites | getRoleConfig(role) | ✓ WIRED | narrative-director, npc-actor, memory-summarizer all call getRoleConfig |
| `src/ai/roles/narrative-director.ts` | `src/state/cost-session-store.ts` | costSessionStore.record | ✓ WIRED | recordUsage called at lines 73, 134 |
| `src/state/cost-session-store.ts` | `src/events/event-types.ts` | eventBus.emit('token_usage_updated') | ✓ WIRED | Line 36 in cost-session-store.ts |
| `state_restored` event | `src/state/cost-session-store.ts` | eventBus.on('state_restored') | ✓ WIRED | Line 98 |
| `src/ai/summarizer/summarizer-scheduler.ts` | `src/ai/summarizer/summarizer-queue.ts` | enqueueTask() | ✓ WIRED | evaluateTriggers calls enqueueTask |
| `src/ai/summarizer/summarizer-worker.ts` | `src/state/npc-memory-store.ts` | version check + setState | ✓ WIRED | summarizer-worker.ts:31 version guard |
| `npc_memory_written` event | `src/ai/summarizer/summarizer-scheduler.ts` | eventBus.on('npc_memory_written') | ✓ WIRED | scheduler.ts:88-89 |
| `src/game-loop.ts` | `src/state/cost-session-store.ts` | getCostSummary() on 'cost' action | ✓ WIRED | game-loop.ts:272-273 |
| `src/game-loop.ts` | `src/ui/screens/game-screen.tsx` | phase='replay' + getLastReplayEntries() | ✓ WIRED | game-loop.ts:268; game-screen.tsx:329 |
| `src/ui/panels/status-bar.tsx` | `src/state/cost-session-store.ts` | costSessionStore.subscribe → lastTurnTokens prop | ✓ WIRED | game-screen.tsx:93-97 subscribes, passes prop at line 238 |
| `src/app.tsx` | `src/ai/providers.ts` | await initRoleConfigs(path) | ✓ WIRED | app.tsx:68 |
| `src/ai/roles/narrative-director.ts` static system | Anthropic cache | providerOptions.anthropic.cacheControl | ✓ WIRED | Lines 51, 112 in narrative-director.ts |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/ui/panels/status-bar.tsx` | lastTurnTokens | costSessionStore.subscribe → game-screen.tsx useState | Yes — updates after every AI call via token_usage_updated event | ✓ FLOWING |
| `src/ui/panels/replay-panel.tsx` | entries prop | getLastReplayEntries() from game-loop.ts module-level array | Yes — populated on /replay action from turnLog.replayTurns() | ✓ FLOWING |
| `src/ui/screens/game-screen.tsx` | isInReplay | gameState.phase === 'replay' from gameStore | Yes — set by game-loop on 'replay' action | ✓ FLOWING |

**Note on pricing flow:** ai-config.yaml provides pricing for narrative-director, npc-actor, and summarizer. However, `initRoleConfigs` is called fire-and-forget in a `useEffect`. DEFAULT_ROLE_CONFIGS has no pricing, so estimatedCost stays 0 until initRoleConfigs completes. This is acceptable behavior — the plan explicitly designed this as a fallback. Cost-session-store handles absent pricing via optional chaining (`pricing?.price_per_1k_input_tokens`).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `bun test` | 637 pass, 0 fail | ✓ PASS |
| migrateV3ToV4 exists and is chained | `grep -n "migrateV3ToV4" src/state/serializer.ts` | Lines 12, 152 | ✓ PASS |
| /cost command registered | `grep -n "command.*cost" src/input/command-registry.ts` | Line 177 | ✓ PASS |
| ReplayPanel in game-screen panel chain | `grep -n "ReplayPanel" src/ui/screens/game-screen.tsx` | Lines 14, 329-330 | ✓ PASS |
| cacheControl present in narrative-director | `grep -n "cacheControl" src/ai/roles/narrative-director.ts` | Lines 51, 112 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AI-04 | 05-01, 05-05 | Background Summarizer compresses sessions without blocking gameplay | ✓ SATISFIED | SummarizerQueue + SummarizerWorker (non-blocking loop) + SummarizerScheduler fully implemented |
| LLM-01 | 05-01, 05-02, 05-07 | Multi-provider abstraction with per-role model routing config | ✓ SATISFIED | YAML-driven buildRoleConfigs with PROVIDER_FACTORIES (google/openai/anthropic); initRoleConfigs at startup |
| LLM-02 | 05-01, 05-03, 05-06 | Token usage and cost tracked per turn/session via /cost command | ✓ SATISFIED | CostSessionStore + recordUsage in AI roles + /cost command routing + status bar T:{n} |
| LLM-03 | 05-07 | Static prompt content cached/prefixed to reduce per-turn token costs | ✓ SATISFIED | Anthropic: cacheControl ephemeral on system content; Google/OpenAI: stable system prefix ordering |
| SAVE-04 | 05-01, 05-04, 05-06 | Player can replay recent turns via :replay N using stored turn log | ✓ SATISFIED | ReplayPanel component + /replay N game-loop routing + phase='replay' wiring in game-screen |

All 5 required requirement IDs are satisfied. No orphaned requirements found for Phase 5.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/ai/summarizer/summarizer-worker.ts` | chapter_summary and turn_log_compress store results in module-level arrays (stub storage) | ⚠️ Warning | Chapter/turn-log compression results not yet wired to game-screen display — this is acknowledged in the plan as a future concern, not a goal of Phase 5 |
| `src/state/cost-session-store.ts:44` | `as ReturnType<typeof getRoleConfig> & { pricing?: PricingInfo }` cast | ℹ️ Info | Redundant cast since providers.ts already has `readonly pricing?: ModelPricing` on RoleConfig; not a bug, just unnecessary complexity |

No blockers found.

### Human Verification Required

#### 1. Live /cost Command with Real Token Data

**Test:** Run the game with a valid Google/Anthropic API key. Navigate to a scene and trigger an AI-generating action (e.g. `:look` or talk to an NPC). Then type `/cost`.
**Expected:** Status bar shows `T:{n}` with the token count from the AI call. The `/cost` output shows non-zero `totalInputTokens`/`totalOutputTokens`. If narrative-director or npc-actor pricing is populated via ai-config.yaml, `estimatedCost` should be non-zero.
**Why human:** Requires live AI API keys; can't verify real token accumulation or estimated cost calculation with static code analysis alone.

#### 2. /replay N Interactive Panel

**Test:** Play a few turns in the game, then type `/replay 5`.
**Expected:** ReplayPanel opens showing the last 5 turns in the left pane. Arrow keys (↑/↓) or `p`/`n` navigate between turns. Selected turn's narration appears in the right pane. Pressing Esc returns to the game screen.
**Why human:** Visual terminal rendering and interactive keyboard navigation must be observed in a live terminal session.

#### 3. Background Summarizer Fires Without Blocking Gameplay

**Test:** Play long enough for an NPC to accumulate 10+ memory entries (or trigger manually by wiring a test save). Observe that the summarizer task runs in the background.
**Expected:** NPC memory is compressed (recentMemories shortened, archiveSummary updated, version incremented) without any visible lag during player input/response cycles.
**Why human:** Background async behavior requires session-level observation; automated tests mock the LLM, so only a real session verifies non-blocking behavior.

### Gaps Summary

No gaps found. All 27 observable truths are verified against the actual codebase. All 5 requirement IDs (AI-04, LLM-01, LLM-02, LLM-03, SAVE-04) are satisfied with implementation evidence.

The 3 human verification items are behavioral/interactive checks that cannot be verified programmatically. They do not indicate missing implementation — the code is fully wired. Human sign-off confirms the wired code behaves correctly in a live session.

---

_Verified: 2026-04-22T12:00:00Z_
_Verifier: Ducc (gsd-verifier)_
