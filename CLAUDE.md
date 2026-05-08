# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
bun install              # Install dependencies
bun test                 # Run all tests (1346 tests, ~4s)
bun test src/engine/     # Run tests in a directory
bun test --filter "combat"  # Run tests matching pattern
bun run typecheck        # TypeScript check (tsc --noEmit)
bun run build            # Bundle to dist/cli.js
bun run src/cli.ts       # Run the game locally
bun run src/cli.ts --world-dir ./world-data  # Custom world data path
```

Tests use `bun test` (Jest-compatible API: `describe`/`it`/`expect`). Test files live next to source as `*.test.ts(x)`.

## Project Overview

**Chronicle** — AI-driven CLI interactive novel game. Chinese-first, CLI-first, single-player. TypeScript + Bun + React/Ink for terminal UI. AI handles narration and NPC behavior; a deterministic Rules Engine controls truth, state, and pacing.

Core loop: **Input → Parse/Classify Intent → Rules Engine Adjudicates → AI Narrates → State Updates → Render**

**Critical boundary**: AI writes prose and NPC dialogue. AI does NOT decide whether events succeed, resources are consumed, or relationships change — the Rules Engine owns those decisions.

## Architecture

### Source Layout (`src/`)

| Directory | Role |
|-----------|------|
| `cli.ts` → `index.tsx` → `app.tsx` | Entry chain: Commander CLI → fullscreen Ink app → React tree |
| `engine/` | Game logic: rules-engine, combat-loop, dialogue-manager, scene-manager, quest-system, action-handlers/ |
| `state/` | Immutable stores (15 stores via `createStore` + immer). Each store is a standalone module. |
| `ai/` | LLM integration: roles/ (narrative-director, npc-actor, retrieval-planner, safety-filter), config/, prompts/, summarizer/ |
| `input/` | Dual-input: command-parser (slash commands) + intent-classifier (NL → GameAction) + input-router |
| `ui/` | React/Ink: screens/, panels/, components/, hooks/, providers/ |
| `codex/` | World data loading + query from YAML files |
| `persistence/` | Save/load, branching, memory persistence |
| `events/` | mitt-based typed event bus for cross-system communication |
| `context/` | GameContext factory — wires all 15 stores + eventBus into a single injectable context |
| `types/` | Shared type definitions (GameAction, intents, common types) |
| `time/` | Clock abstraction for timing |

### Key Patterns

**Store pattern** (`src/state/create-store.ts`): 35-line custom store with immer. `createStore<T>(initialState, onChange?)` → `{ getState, setState(recipe), subscribe }`. All state updates go through immer `produce()` — never mutate directly.

**Action handler registry** (`src/engine/action-handlers/`): Each game action type (look, move, talk, attack, save, branch...) has a dedicated handler. `createDefaultRegistry()` maps action types to handlers. Combat actions are intercepted when combat is active.

**Dual-input routing** (`src/input/input-router.ts`): Slash commands (`/look`, `/go north`) → command-parser → GameAction. Free-form text → safety-filter → intent-classifier → GameAction. Both paths produce the same `GameAction` type.

**AI roles** (`src/ai/roles/`): Each AI function is a separate module with its own prompt and Zod output schema. Uses Vercel AI SDK v5 `generateObject`/`generateText`. Provider config lives in `world-data/ai-config.yaml`.

**Context providers** (`src/ui/providers/`): AtmosphereProvider, NarrativeProvider, InputProvider wrap the game screen with reactive state derived from stores.

**Game phases** (UI state machine in `game-store.ts`): title → character_creation → playing → combat → dialogue → (various overlay states).

### Data Flow

```
Player Input
  ↓
input-router.ts (parse or classify)
  ↓
GameAction { type, target, modifiers, source }
  ↓
action-handlers/registry → specific handler
  ↓
rules-engine.ts (d20 rolls, DC checks, deterministic outcomes)
  ↓
Store updates (scene, player, combat, relation, quest...)
  ↓
ai/roles/narrative-director.ts (generates narration from adjudicated result)
  ↓
UI re-renders via store subscriptions
```

### World Data (`world-data/`)

YAML codex files: races, professions, locations, npcs, quests, items, spells, factions, enemies, relationships, history_events. Loaded at startup via `src/codex/loader.ts`. No vector DB — keyword/tag search on structured YAML.

## Conventions

- **AI SDK v5** — do NOT use v6. `generateObject` with Zod schemas for structured output.
- **Zod 4** — required peer dep of AI SDK. Used for all schema validation.
- **Commands use `/` prefix** in-game (not `:` as some docs say): `/look`, `/go north`, `/save`
- **Chinese-first content** — all player-facing strings in Chinese. Use `string-width` for CJK layout calculations.
- **Immutable state** — all store updates via `setState(draft => { ... })` using immer. Never mutate `getState()` result.
- **Event bus** — `mitt<DomainEvents>` for cross-system communication. Typed events defined in `src/events/event-types.ts`.
- **Test colocation** — test files next to source: `foo.ts` → `foo.test.ts`

## Gotchas

- `NarrativeStore` mock in tests needs ALL 4 fields including `worldFlags` + `playerKnowledgeLevel`
- Trust scale formula: `(personalTrust + 100) / 20` — 0 maps to 5, not < 5
- `quest` field in `createDialogueManager` stores must remain optional
- 3 pre-existing tsc errors (summarizer-worker, quest-handler.test, game-loop.test) — known, don't try to fix unless specifically asked
- `fullscreen-ink` uses `withFullScreen()` wrapping the React element — NOT a component

## Planning & Phases

Project roadmap and phase plans live in `.planning/`. Current milestone: v1.5 (Ecosystem Engine) with phases 22-24. Phase execution follows GSD workflow.

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
