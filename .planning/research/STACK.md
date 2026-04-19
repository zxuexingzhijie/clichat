# Technology Stack

**Project:** Chronicle (AI-driven CLI interactive novel game)
**Researched:** 2026-04-20

## Recommended Stack

### Runtime & Language

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Bun | ^1.3.12 | Runtime, package manager, bundler, test runner | Native YAML import, fast startup (~25ms), native TypeScript, built-in test runner. Matches Claude Code reference. Node-compatible but 3-5x faster cold start -- critical for CLI feel. | HIGH |
| TypeScript | ^5.8 | Language | Type safety for complex game state, schema inference with Zod, required by Ink/AI SDK ecosystem. Bun runs TS natively without build step. | HIGH |

### Terminal UI

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| React | ^19.2.5 | UI framework | Required peer dep for Ink 7. Component model maps perfectly to game panels (scene, status bar, input). Hooks for state subscription. | HIGH |
| ink | ^7.0.1 | Terminal renderer | React-based terminal UI with Flexbox layout. Supports Box (borders, padding, flex), Text (color, bold, dim, wrap). Claude Code uses this exact stack. The only production-grade React terminal renderer. | HIGH |
| fullscreen-ink | ^0.1.0 | Fullscreen terminal mode | Alternate screen buffer (like vim/less), auto-resize handling. Essential for immersive game UI. Wraps Ink with `withFullScreen()`. Small, focused library. | HIGH |
| @inkjs/ui | ^2.0.0 | Input components | TextInput (with suggestions/autocomplete), Select, MultiSelect, Spinner, PasswordInput. Official Ink companion by same author. Saves building input widgets from scratch. | HIGH |
| chalk | ^5.6.2 | ANSI color strings | For non-React contexts (logging, string generation). Ink's `<Text color>` handles most cases, but chalk needed for formatted strings passed to components. | HIGH |
| figlet | ^1.11.0 | ASCII art text | Title screens, chapter headers, location banners. Full FIGfont spec implementation. 680+ fonts included. | HIGH |
| gradient-string | ^3.0.0 | Color gradients | Title screen polish, magical effects in text. Pairs with figlet for stylized headers. | MEDIUM |
| strip-ansi | ^7.2.0 | ANSI cleanup | Remove ANSI codes for string width calculation, logging, save file storage. | HIGH |
| string-width | ^8.2.0 | CJK string width | CRITICAL for Chinese text. Correctly calculates display width of CJK characters (width 2) and emoji. Without this, layouts break with Chinese content. | HIGH |

### CLI Parsing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| commander | ^14.0.3 | Command routing | Project constraint. Handles structured commands (`:look`, `:go north`, `:save`). Mature, well-documented, 140M weekly downloads. Supports subcommands, options, help generation. | HIGH |

**Architecture note:** Commander handles the structured command prefix (`:command`) routing. Natural language input (anything without `:` prefix) bypasses Commander and goes directly to the AI intent recognition pipeline. This dual-input pattern does NOT need a second parsing library -- just a string prefix check.

### LLM Integration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| ai (Vercel AI SDK) | ^5.0.179 | LLM abstraction core | Unified API for text generation, structured output (`generateObject` with Zod schemas), streaming, tool calling. Provider-agnostic. **Use v5, not v6** -- see rationale below. | HIGH |
| @ai-sdk/openai | ^3.0.53 | OpenAI provider | GPT-4o, GPT-4o-mini for fast narration. | HIGH |
| @ai-sdk/anthropic | ^3.0.71 | Anthropic provider | Claude for complex narrative, world-building background tasks. | HIGH |
| @ai-sdk/google | ^3.0.64 | Google provider | Gemini Flash for low-latency intent recognition. | HIGH |
| @ai-sdk/alibaba | ^1.0.17 | Alibaba/Qwen provider | Qwen-Plus, Qwen-Turbo for Chinese-optimized narration. Critical for Chinese-first content. | HIGH |
| @ai-sdk/deepseek | ^2.0.29 | DeepSeek provider | DeepSeek V3/Chat for cost-effective Chinese generation. Backup/alternative to Qwen. | HIGH |
| @ai-sdk/openai-compatible | ^2.0.41 | Fallback adapter | For any OpenAI-compatible API not covered by official providers (local models, new providers). Safety net. | MEDIUM |

**Why AI SDK v5, not v6:** V6 (current `latest` npm tag, v6.0.168) deprecates `generateObject()` in favor of `generateText()` + `Output.object()`. V5 still receives active updates (v5.0.179 via `ai-v5` npm tag). V5's `generateObject()` is cleaner for our heavy structured output use case (NPC dialogue schemas, combat result schemas, intent recognition). V6's migration adds complexity without benefit for a CLI app (v6 changes primarily benefit web/streaming UI). V5 provider packages (@ai-sdk/*) are cross-compatible with both v5 and v6. V7 beta (7.0.0-beta.111) exists -- too early. **Revisit at Phase 3+ when v6 patterns stabilize.**

### Schema Validation & Structured Data

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| zod | ^4.3.6 | Schema validation | TypeScript-first schema validation. Required peer dep of AI SDK (requires ^4.1.8). Used for: game state schemas, NPC dialogue output schemas, combat result schemas, config validation, YAML codex validation. Zod 4 has 2-7x faster parsing than v3. | HIGH |

### Data Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Bun native YAML | built-in | YAML codex reading | `import config from "./config.yaml"` -- Bun parses YAML natively at import time. For static codex files (races, locations, spells), this is zero-dep and fast. | HIGH |
| yaml | ^2.8.3 | Dynamic YAML read/write | For runtime YAML operations (saving modified codex state, dynamic file loading by path). The `yaml` package handles serialization that Bun's native import cannot do dynamically. Actively maintained, full YAML 1.2 spec. | HIGH |
| Bun.file() / Bun.write() | built-in | File I/O | Native file API for JSON state read/write. ~10x faster than Node fs for large files. Built-in JSON serialization. | HIGH |

**No database.** All persistence is file-based JSON/YAML. This is a project constraint and correct for the use case: git-diffable, human-readable, version-controllable game state.

### State Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Custom Store (Claude Code pattern) | n/a | Application state | Claude Code's minimal store pattern: `createStore<T>(initialState, onChange)` with `getState/setState/subscribe`. ~35 lines of code. No dependencies. Immutable updates via spread. Perfect for a game loop where state changes are explicit and auditable. | HIGH |
| immer | ^11.1.4 | Immutable state updates | `produce()` for complex nested state updates (inventory changes, relationship deltas, multi-field combat results). Without immer, deeply nested spreads become error-prone. Use selectively for complex mutations, not everywhere. | HIGH |

**Why not Zustand:** Zustand is React-focused and adds React peer dep coupling to non-UI state. Chronicle's Rules Engine and game state must be React-independent (testable without Ink rendering). The custom store pattern is simpler, lighter, and matches the reference architecture exactly.

**Why not XState (v5.30.0):** XState is excellent for formal state machines but adds ~50KB and significant API surface. Chronicle's turn flow (scene/conflict/journey) is better modeled as a simple state + reducer pattern. The turn cycle is sequential, not concurrent. If combat state machines become complex later, XState can be added to just the combat module without touching the rest.

### Event System

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| mitt | ^3.0.1 | Lightweight event bus | 200 bytes. Type-safe event emitter. For decoupled communication between game systems (Rules Engine emits "damage_dealt", UI subscribes to render effects). Prefer over Node EventEmitter for TypeScript generics and tree-shaking. | HIGH |

### ID Generation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| nanoid | ^5.1.9 | Unique IDs | Save file IDs, branch IDs, NPC instance IDs, quest IDs. URL-friendly, 21 chars default, 126-bit entropy. Smaller and faster than uuid. | HIGH |

### Development & Testing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| bun test | built-in | Unit/integration testing | Built into Bun runtime. Jest-compatible API (describe/it/expect). No setup needed. ~30x faster than Jest. | HIGH |
| @types/react | ^19.2.14 | React type defs | Required for TypeScript + React 19/Ink 7 development. | HIGH |
| @types/figlet | latest | Figlet type defs | Type safety for ASCII art generation. | LOW |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Runtime | Bun | Node.js 22+ | Slower startup, no native YAML, needs tsx/ts-node for TS execution. |
| Runtime | Bun | Deno | Ink ecosystem not tested on Deno. Bun has proven Ink compatibility (Claude Code ships on it). |
| Terminal UI | Ink 7 | blessed / blessed-contrib | Abandoned (no updates since 2020). No React model. No TypeScript support. |
| Terminal UI | Ink 7 | terminal-kit (v3.1.2) | Lower-level imperative API. Would require reimplementing layout engine. No component model. |
| LLM SDK | AI SDK v5 | LangChain.js | Over-engineered for this use case. AI SDK is lighter, better typed, provider system is cleaner. No vector DB means zero LangChain retrieval benefit. |
| LLM SDK | AI SDK v5 | Direct HTTP per provider | Would need to reimplement streaming, structured output, retry logic, error normalization for 5+ providers. AI SDK solves all of this. |
| LLM SDK | AI SDK v5 | AI SDK v6 | API churn (`generateObject` deprecated), primarily benefits web apps with new streaming patterns. V5 stable and actively maintained. |
| Schema | Zod 4 | TypeBox | Zod is AI SDK's required peer dep. Using anything else means maintaining two schema systems in parallel. |
| Schema | Zod 4 | Effect Schema (v0.75.5) | Requires buying into entire Effect ecosystem. Overkill for validation. |
| State | Custom store | Zustand (v5.0.12) | React coupling, unnecessary abstraction for game logic that must be UI-independent and testable. |
| State | Custom store + Immer | Redux Toolkit | Heavyweight boilerplate for a single-player game. No middleware/saga needs. |
| State | Immer (selective) | Immutable.js | Immer works with plain JS objects. Immutable.js requires proprietary data structures that break Zod schema validation and JSON serialization. |
| Event bus | mitt | EventEmitter3 (v5.0.4) | mitt is smaller (200B vs 1.5KB) and has better TypeScript generic support. |
| YAML | yaml (v2.8.3) | js-yaml | `yaml` is actively maintained with full YAML 1.2 spec. js-yaml stuck on YAML 1.1, lower type safety. |
| CLI parse | Commander | yargs | Commander is simpler, lighter, better TS support. Project constraint anyway. |

## Version Compatibility Matrix

| Package | Requires | Notes |
|---------|----------|-------|
| ink 7.0.1 | react >=19.2.0, @types/react >=19.2.0 | React 19 is mandatory |
| ai 5.0.179 | zod ^3.25.76 \|\| ^4.1.8 | Zod 4.3.6 satisfies this |
| @ai-sdk/* providers | zod ^3.25.76 \|\| ^4.1.8 | Same Zod constraint as core |
| fullscreen-ink 0.1.0 | ink (peer) | Wraps Ink render instance |
| @inkjs/ui 2.0.0 | ink 7, react 19 | Official companion to Ink 7 |
| immer 11.1.4 | none | Zero peer deps |
| Bun 1.3.12 | n/a | Runs React 19 + Ink 7 natively |

## Installation

```bash
# Core UI
bun add react ink fullscreen-ink @inkjs/ui

# CLI
bun add commander

# LLM (note: ai@ai-v5 installs from v5 dist-tag, NOT latest which is v6)
bun add ai@ai-v5 @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google @ai-sdk/alibaba @ai-sdk/deepseek @ai-sdk/openai-compatible

# Schema & Data
bun add zod yaml immer

# Utilities
bun add chalk figlet gradient-string strip-ansi string-width mitt nanoid

# Dev dependencies
bun add -d @types/react @types/figlet typescript
```

**Critical:** `ai@ai-v5` pins to the v5 dist-tag. Plain `bun add ai` installs v6 (current `latest`).

## Key Architecture Decisions Driven by Stack

1. **Bun native YAML import for static codex, `yaml` package for dynamic operations.** Static world data (race definitions, spell lists) loaded at startup via `import data from "./races.yaml"`. Runtime modifications (NPC memory writes, save state serialization) use the `yaml` package for stringify/parse.

2. **React 19 is non-negotiable.** Ink 7 requires it as a peer dependency. Every Ink-compatible library must support React 19. Check peer deps before adding any UI package.

3. **AI SDK v5 with explicit version pinning.** Use `ai@ai-v5` npm tag. The v5/v6 situation is fluid -- npm `latest` points to v6 but v5 is actively maintained in parallel via its own tag. Pin to avoid accidental major version bumps during `bun update`.

4. **Custom store, not Zustand, for game state.** Game logic (Rules Engine, NPC actors, quest tracker) must be testable without React rendering context. The custom store pattern (35 lines, zero deps) keeps game state decoupled from UI framework. Claude Code proves this pattern works at scale.

5. **string-width is mandatory for CJK.** Every text layout calculation, text wrapping, and box sizing must use string-width instead of `String.length`. Chinese characters are display-width 2. This is the single most likely source of layout bugs in a Chinese-first terminal application.

6. **mitt event bus for system decoupling.** The Rules Engine, AI pipeline, and UI are separate systems. mitt provides typed events (`GameEvent = { damage_dealt: DamageEvent; npc_spoke: DialogueEvent; ... }`) for loose coupling without import dependency chains.

## Sources

- npm registry: direct `npm view` queries for all package versions (2026-04-20)
- Context7: /vadimdemedes/ink (Ink 7 layout API, Box/Text components)
- Context7: /daniguardiola/fullscreen-ink (withFullScreen API, useScreenSize hook)
- Context7: /vadimdemedes/ink-ui (resolved to @inkjs/ui, TextInput/Select/Spinner components)
- Context7: /vercel/ai (AI SDK v5/v6 structured output, providers, migration guide)
- Context7: /tj/commander.js (subcommand API, action handlers)
- Context7: /colinhacks/zod (v4 features)
- Context7: /websites/bun_sh (native YAML import, dynamic YAML loading, file I/O)
- Context7: /websites/ai-sdk_dev (generateText + Output.object v6 migration, provider list)
- Claude Code reference: src/state/store.ts (custom createStore pattern, 35 lines)
- Claude Code reference: src/ink.ts (React + Ink + ThemeProvider wrapping pattern)
