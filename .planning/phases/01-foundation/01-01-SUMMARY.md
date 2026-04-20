---
phase: 01-foundation
plan: 01
subsystem: state
tags: [bun, typescript, zod, immer, mitt, react, ink, store, event-bus]

requires:
  - phase: none
    provides: greenfield project

provides:
  - Bun project with 20+ dependencies installed
  - createStore factory with immer integration
  - Typed domain event bus (14 event types)
  - 4 domain stores (player, scene, combat, game) with onChange event emission
  - Zod schemas for GameAction, Intent, CheckResult, DamageResult, common types
  - React store hook via useSyncExternalStore with selector pattern
  - Chinese labels for attributes, success grades, time of day

affects: [01-02, 01-03, 01-04, 01-05, 01-06]

tech-stack:
  added: [bun@1.3.12, typescript@6.0.3, react@19.2.5, ink@7.0.1, fullscreen-ink@0.1.0, "@inkjs/ui@2.0.0", ai@5.0.179, "@ai-sdk/openai@3.0.53", zod@4.3.6, immer@11.1.4, mitt@3.0.1, commander@14.0.3, nanoid@5.1.9, figlet@1.11.0, chalk@5.6.2, yaml@2.8.3, gradient-string@3.0.0, string-width@8.2.0, strip-ansi@7.2.0]
  patterns: [createStore-with-immer, typed-event-bus-mitt, zod-schema-first-types, domain-store-onChange-events, useSyncExternalStore-selector-hook]

key-files:
  created:
    - src/state/create-store.ts
    - src/events/event-bus.ts
    - src/events/event-types.ts
    - src/types/common.ts
    - src/types/game-action.ts
    - src/types/intent.ts
    - src/state/player-store.ts
    - src/state/scene-store.ts
    - src/state/combat-store.ts
    - src/state/game-store.ts
    - src/ui/hooks/use-store.ts
  modified:
    - package.json
    - tsconfig.json
    - .gitignore

key-decisions:
  - "Used TypeScript 6.0.3 (latest) instead of 5.8 -- dropped baseUrl from tsconfig as deprecated in TS6"
  - "AI SDK installed via ai@ai-v5 dist-tag, confirmed v5.0.179 (not v6)"
  - "Zod 4.3.6 for schema-first type inference with z.infer"
  - "createStore uses immer produce() for setState recipe pattern per D-35"
  - "Domain stores emit typed events via mitt-based eventBus on onChange"

patterns-established:
  - "createStore pattern: createStore<T>(initialState, onChange) with immer produce for setState"
  - "Zod schema-first: define schema, infer type via z.infer, never hand-write types separately"
  - "Domain event bus: mitt<DomainEvents>() with typed event payloads"
  - "Store onChange pattern: diff old/new state fields, emit specific domain events"
  - "React store hook: createStoreContext<T>() returning Provider, useStoreState, useSetState"

requirements-completed: [CORE-04]

duration: 27min
completed: 2026-04-20
---

# Phase 01 Plan 01: Project Bootstrap & State Foundation Summary

**Bun project with 20+ deps, createStore/immer factory, typed event bus (mitt), 4 domain stores, Zod schema type system, React store hook**

## Performance

- **Duration:** 27 min
- **Started:** 2026-04-20T04:38:30Z
- **Completed:** 2026-04-20T05:05:31Z
- **Tasks:** 4
- **Files modified:** 17

## Accomplishments
- Bootstrapped Bun 1.3.12 project with all 20+ production and dev dependencies
- Built createStore factory with immer produce() for immutable state updates, Object.is skip, and onChange callback
- Created typed domain event bus with 14 event types covering all game subsystems
- Implemented 4 domain stores (player, scene, combat, game) with onChange event emission
- Defined complete Zod schema type system: GameAction (13 types), Intent (10 categories), CheckResult, DamageResult, common types with Chinese labels
- Built generic React store hook via createStoreContext + useSyncExternalStore

## Task Commits

Each task was committed atomically:

1. **Task 1: Project bootstrap and dependency installation** - `626999f` (feat)
2. **Task 2: Type system -- shared types, game action, intent schema** - `ae40d3e` (feat)
3. **Task 3: Event bus, createStore, and React hook** - `3651f58` (feat)
4. **Task 4: Domain stores -- player, scene, combat, game** - `4ed6c2a` (feat)

## Files Created/Modified
- `package.json` - Project manifest with 20+ dependencies
- `tsconfig.json` - TypeScript strict config with bundler resolution
- `bunfig.toml` - Bun test runner configuration
- `.gitignore` - Added node_modules, .DS_Store, *.log
- `src/index.tsx` - Minimal entry point
- `src/types/common.ts` - EntityId, Position, AttributeName, SuccessGrade, CheckResult, DamageResult, TimeOfDay schemas + Chinese labels
- `src/types/game-action.ts` - GameActionType (13 types) and GameAction schema
- `src/types/intent.ts` - IntentAction (10 categories) and Intent schema with confidence gating
- `src/state/create-store.ts` - Generic store factory with immer produce() integration
- `src/events/event-types.ts` - DomainEvents type with 14 typed event definitions
- `src/events/event-bus.ts` - mitt-based typed event bus singleton
- `src/state/player-store.ts` - Player state with hp/mp/gold/attributes and damage/heal/gold events
- `src/state/scene-store.ts` - Scene state with narration, actions, scene_changed events
- `src/state/combat-store.ts` - Combat state with active flag, enemies, combat events
- `src/state/game-store.ts` - Game state with day/time/phase, time_advanced events
- `src/ui/hooks/use-store.ts` - Generic createStoreContext with useSyncExternalStore selector pattern
- `src/types/types.test.ts` - 21 tests for type schemas
- `src/state/create-store.test.ts` - 8 tests for store factory
- `src/events/event-bus.test.ts` - 4 tests for event bus
- `src/state/stores.test.ts` - 9 tests for domain stores

## Decisions Made
- Used TypeScript 6.0.3 (latest available via bun) instead of 5.8 -- dropped deprecated `baseUrl` from tsconfig, `paths` work without it in TS6
- Simplified bunfig.toml to just `[test]` section (empty `preload = []` caused Bun parse error in v1.3.12)
- AI SDK confirmed at v5.0.179 via `ai@ai-v5` dist-tag -- critical to avoid v6 API churn

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript 6.0 deprecation of baseUrl**
- **Found during:** Task 1
- **Issue:** `bun add -d typescript` installed v6.0.3 (latest), which deprecates `baseUrl` in tsconfig. The plan specified TS ^5.8 but Bun resolved to v6.
- **Fix:** Removed `baseUrl` from tsconfig.json. Path aliases (`@/*`) still work with relative paths in the `paths` field.
- **Files modified:** tsconfig.json
- **Verification:** `bunx tsc --noEmit` passes clean
- **Committed in:** 626999f

**2. [Rule 3 - Blocking] bunfig.toml empty preload array parse error**
- **Found during:** Task 1
- **Issue:** `preload = []` in bunfig.toml caused Bun 1.3.12 parse error: "Expected preload to be an array"
- **Fix:** Removed the `preload` key entirely, keeping just the `[test]` section header
- **Files modified:** bunfig.toml
- **Verification:** `bun test` runs without config errors
- **Committed in:** 626999f

**3. [Rule 1 - Bug] TypeScript strict mode string literal inference in test arrays**
- **Found during:** Task 2
- **Issue:** Iterating string arrays with `for..of` and passing to `toBe()` failed TypeScript strict mode because array elements inferred as `string` not the specific union type
- **Fix:** Added `as const` to all enum validation test arrays
- **Files modified:** src/types/types.test.ts
- **Verification:** `bunx tsc --noEmit` passes, all 21 tests pass
- **Committed in:** ae40d3e

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All foundation types, stores, and event bus ready for downstream plans
- Plan 01-02 (Rules Engine) can import from `src/types/common.ts` and `src/state/create-store.ts`
- Plan 01-03 (CLI Layout) can use `src/ui/hooks/use-store.ts` and all domain stores
- 42 tests passing, TypeScript strict mode clean, all dependencies locked

## Self-Check: PASSED

All 20 created files verified present. All 4 task commit hashes verified in git log.

---
*Phase: 01-foundation*
*Completed: 2026-04-20*
