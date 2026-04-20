# Phase 1: Foundation - Research

**Researched:** 2026-04-20
**Domain:** CLI game engine skeleton — command parsing, Rules Engine, immutable state, terminal UI layout, World Codex schema
**Confidence:** HIGH

## Summary

Phase 1 builds the foundational game engine: a four-panel terminal UI (React + Ink 7 + fullscreen-ink), dual-input command parsing (Commander.js for structured `/` commands, AI SDK v5 `generateObject` for NL intent classification), a deterministic D20-based Rules Engine, multi-store immutable state management (custom stores + immer + mitt event bus), and a Zod-validated YAML World Codex schema with epistemic metadata. All systems are wired together with placeholder data — no real game content or AI narration yet.

The primary technical risk is the custom four-panel layout with Unicode box-drawing borders. Ink 7's `Box` component supports custom `borderStyle` objects with arbitrary characters, but the user's mockup requires a **single outer border with internal horizontal dividers** (`├───┤`), which is NOT achievable with nested `Box` borders alone. The dividers must be rendered as custom `Text` rows containing box-drawing characters calculated to fill the terminal width. CJK character double-width is a second risk — `string-width` is mandatory for all layout width calculations.

**Primary recommendation:** Build the layout as a single outer `Box` with `borderStyle="single"` containing four vertically stacked child regions separated by custom-rendered `├───┤` divider rows. Use `fullscreen-ink`'s `useScreenSize` for responsive resize. Commander.js handles `/` prefix commands in-process (not as CLI subcommands) via a custom command registry — Commander's `.parse()` operates on split input strings, not `process.argv`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Adaptive layout — vertical stack when terminal < 100 columns, side-by-side split when >= 100 columns
- **D-02:** Single outer border wrapping entire screen, horizontal dividers between sections — not individual panel borders
- **D-03:** Title bar: game name left-aligned, time/day info right-aligned
- **D-04:** Scene panel: narration text area (largest panel)
- **D-05:** Status bar: single-line `HP/MP/Gold/Location/Quest` format
- **D-06:** Actions panel: vertical numbered list with `>` cursor selection, keyboard hints at bottom
- **D-07:** Input area: `>` prompt at bottom, `/` prefix switches to command mode
- **D-08:** AI dynamically generates 3-5 recommended actions per scene change (Phase 1 uses placeholder actions)
- **D-09:** Figlet ASCII art title screen with gradient-string on launch, press any key to enter game
- **D-10:** Auto-detect terminal background color and adapt color scheme accordingly
- **D-11:** Phase 1 uses placeholder data in all panels
- **D-12 to D-22:** D20-based Rules Engine with three-attribute system (体魄/技巧/心智), four adjudication modes (normal/opposed/probability/plot-critical), graded success, damage formula, full check display
- **D-23 to D-28:** NL intent recognition with 10 categories, Zod structured output, validation chain, repair retry, clarification flow
- **D-29 to D-32:** World Codex with 8 entry types, epistemic metadata system (authority/truth_status/scope/visibility/confidence/source_type/known_by/contradicts/volatility), typed relationship graph, minimum example data
- **D-33 to D-36:** Multi-store architecture, independent serialization, immer `produce()` globally, typed domain event bus via mitt
- **D-37 to D-40:** `/` command prefix, no aliases, NL default mode, `/help` + Tab completion

### Claude's Discretion
- Graded success level count and thresholds (recommended: 5-level with nat20/nat1 critical)
- Exact figlet font choice and gradient color scheme
- Status bar field ordering and overflow behavior
- Tab completion implementation details
- Store naming conventions and granularity beyond core stores listed

### Deferred Ideas (OUT OF SCOPE)
- Command aliases/abbreviations
- Immersion mode (collapsed check display)
- Store migration/versioning for save file format evolution
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CORE-01 | Structured command parsing (`/look`, `/go north`, `/talk NPC`, `/attack`) into game actions | Commander.js in-process parsing pattern, custom command registry with argument extraction |
| CORE-02 | Free-form NL classified into structured intent via fast LLM | AI SDK v5 `generateObject` with Zod intent schema, provider-native structured outputs |
| CORE-03 | Rules Engine adjudicates all mechanical outcomes deterministically, zero LLM | Pure TypeScript D20 resolver with attribute/modifier/DC system, deterministic PRNG for testability |
| CORE-04 | All game state as serializable JSON tree with immutable updates, snapshot/restore | Multi-store architecture with immer `produce()`, JSON serialization/deserialization with Zod validation |
| CLI-01 | Four-panel terminal layout responsive to resize | React + Ink 7 + fullscreen-ink, custom box-drawing dividers, `useScreenSize` for adaptive layout |
| WORLD-01 | World Codex as tagged YAML with schema validation | Zod schemas for 8 entry types + epistemic metadata + relationship graph, `yaml` package for dynamic loading |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Four-panel CLI layout | CLI/Terminal (Ink) | -- | Pure presentation: React components rendering to terminal |
| Command parsing | CLI Interaction | -- | In-process string parsing, no network or backend involvement |
| NL intent classification | API/Backend (LLM call) | CLI Interaction (fallback) | Requires LLM API call; CLI handles input capture and result display |
| Rules Engine adjudication | Rules Engine (pure logic) | -- | Deterministic computation, zero external dependencies |
| Game state management | State layer (stores) | -- | In-memory stores with serialization, no database |
| World Codex schema/validation | Data layer (file I/O + Zod) | -- | YAML files on disk, validated at load time |
| Title screen | CLI/Terminal (Ink) | -- | figlet + gradient-string rendering |

## Project Constraints (from CLAUDE.md)

- **Tech stack:** TypeScript + Bun runtime
- **Terminal UI:** React + Ink
- **LLM:** Multi-provider via AI SDK; fast models for online, quality for background
- **No vector DB:** File-based keyword/tag search on YAML codex + JSON memory
- **World data:** Human-readable YAML/JSON, git-diffable
- **CLI parsing:** Commander.js
- **Critical boundary:** AI writes prose only; Rules Engine owns all mechanical outcomes
- **Dual-input system:** `/` commands + natural language; NL goes through intent recognition before narrative layer
- **Immutability required:** All state updates must be immutable (from CLAUDE.md coding style)
- **File organization:** Many small files, 200-400 lines typical, 800 max
- **Error handling:** Comprehensive at every level, never swallow errors
- **Input validation:** Validate at system boundaries with schema-based validation

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard | Confidence |
|---------|---------|---------|--------------|------------|
| react | 19.2.5 | UI framework | Required peer dep for Ink 7. Component model for game panels. | HIGH [VERIFIED: npm registry] |
| ink | 7.0.1 | Terminal renderer | React-based terminal UI with Flexbox layout. Custom borderStyle for box-drawing chars. | HIGH [VERIFIED: npm registry, Context7] |
| fullscreen-ink | 0.1.0 | Fullscreen terminal mode | Alternate screen buffer, `useScreenSize` hook for resize. Essential for immersive game UI. | HIGH [VERIFIED: npm registry, Context7] |
| @inkjs/ui | 2.0.0 | Input components | TextInput (with suggestions), Select, Spinner. Official Ink companion. | HIGH [VERIFIED: npm registry] |
| commander | 14.0.3 | Command routing | Project constraint. Handles structured `/` commands. | HIGH [VERIFIED: npm registry, Context7] |
| ai (v5) | 5.0.179 | LLM abstraction | Unified API for structured output (`generateObject` with Zod). Install via `ai@ai-v5` dist-tag. | HIGH [VERIFIED: npm registry dist-tags] |
| @ai-sdk/openai | 3.0.53 | OpenAI provider | GPT-4o-mini for fast NL intent classification in Phase 1. | HIGH [VERIFIED: npm registry] |
| zod | 4.3.6 | Schema validation | Required peer dep of AI SDK. Used for: intent schemas, game state, codex validation, Rules Engine result types. | HIGH [VERIFIED: npm registry] |
| immer | 11.1.4 | Immutable state updates | `produce()` for all store mutations (D-35). Works with plain objects, Zod-compatible. | HIGH [VERIFIED: npm registry] |
| mitt | 3.0.1 | Event bus | 200 bytes. Type-safe. For domain events between game systems. | HIGH [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| figlet | 1.11.0 | ASCII art text | Title screen (D-09). | [VERIFIED: npm registry] |
| gradient-string | 3.0.0 | Color gradients | Title screen polish (D-09). | [VERIFIED: npm registry] |
| chalk | 5.6.2 | ANSI color strings | Non-React string formatting, logging. | [VERIFIED: npm registry] |
| string-width | 8.2.0 | CJK string width | CRITICAL for Chinese text layout calculations. | [VERIFIED: npm registry] |
| strip-ansi | 7.2.0 | ANSI cleanup | Width calculation, logging, save data. | [VERIFIED: npm registry] |
| nanoid | 5.1.9 | Unique IDs | Save IDs, NPC IDs, quest IDs, codex entry IDs. | [VERIFIED: npm registry] |
| yaml | 2.8.3 | Dynamic YAML read/write | Runtime codex loading by path. Bun native import for static files. | [VERIFIED: npm registry] |
| @types/react | 19.2.14+ | React type defs | Required for TS + React 19 / Ink 7. | [VERIFIED: npm registry] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AI SDK v5 `generateObject` | AI SDK v6 `generateText` + `Output.object()` | v6 deprecates `generateObject`. But v5 is stable, actively maintained on `ai-v5` dist-tag, and avoids API churn. Project decided v5. |
| Custom store + immer | Zustand | React coupling unnecessary — game state must be UI-independent and testable without React |
| Individual Box borders | Single outer border + custom dividers | Ink Box borders wrap each box individually; user mockup requires shared outer border with `├───┤` dividers — must use custom rendering |

**Installation:**
```bash
# Install Bun first (NOT currently installed on this machine)
curl -fsSL https://bun.sh/install | bash

# Core UI
bun add react ink fullscreen-ink @inkjs/ui

# CLI
bun add commander

# LLM (CRITICAL: ai@ai-v5 installs v5, NOT latest which is v6)
bun add ai@ai-v5 @ai-sdk/openai

# Schema & Data
bun add zod yaml

# State & Events
bun add immer mitt

# Utilities
bun add nanoid figlet gradient-string chalk string-width strip-ansi

# Dev dependencies
bun add -d @types/react @types/figlet typescript
```

### Version Compatibility Matrix

| Package | Requires | Notes |
|---------|----------|-------|
| ink 7.0.1 | react >=19.2.0, @types/react >=19.2.0 | React 19 mandatory |
| ai 5.0.179 | zod ^3.25.76 \|\| ^4.1.8 | Zod 4.3.6 satisfies |
| @inkjs/ui 2.0.0 | ink >=5 | Compatible with Ink 7 |
| fullscreen-ink 0.1.0 | ink (peer) | Wraps Ink render instance |
| immer 11.1.4 | none | Zero peer deps |

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Terminal (stdout/stdin)                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              fullscreen-ink (alt screen buffer)            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │           React + Ink Render Tree                    │  │  │
│  │  │                                                      │  │  │
│  │  │   TitleScreen ──press-any-key──▶ GameScreen          │  │  │
│  │  │                                                      │  │  │
│  │  │   GameScreen                                         │  │  │
│  │  │   ├── TitleBar (game name + day/time)                │  │  │
│  │  │   ├── Divider ├───┤                                  │  │  │
│  │  │   ├── ScenePanel (narration text)                    │  │  │
│  │  │   ├── Divider ├───┤                                  │  │  │
│  │  │   ├── StatusBar (HP/MP/Gold/Location/Quest)          │  │  │
│  │  │   ├── Divider ├───┤                                  │  │  │
│  │  │   ├── ActionsPanel (numbered list + cursor)          │  │  │
│  │  │   ├── Divider ├───┤                                  │  │  │
│  │  │   └── InputArea (> prompt)                           │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

     User Input
         │
         ▼
  ┌──────────────┐     starts with "/"?
  │  Input Router │──── YES ──▶ CommandParser (Commander.js)
  │              │                    │
  │              │──── NO ───▶ IntentClassifier (AI SDK v5)
  └──────────────┘                    │
         │                            │
         ▼                            ▼
  ┌──────────────────────────────────────┐
  │        Parsed GameAction             │
  │  { type, target, modifiers, raw }    │
  └──────────────────────────────────────┘
                    │
                    ▼
  ┌──────────────────────────────────────┐
  │          Rules Engine                 │
  │  D20 roll + attribute + modifiers    │
  │  vs DC → graded success result       │
  │  (deterministic, zero LLM)           │
  └──────────────────────────────────────┘
                    │
                    ▼
  ┌──────────────────────────────────────┐
  │          Domain Event Bus (mitt)      │
  │  "action_resolved", "state_changed"  │
  │  "scene_updated", "combat_event"     │
  └──────────────────────────────────────┘
                    │
          ┌────────┼────────┐
          ▼        ▼        ▼
    PlayerStore  SceneStore  CombatStore ...
    (immer)      (immer)     (immer)
                    │
                    ▼
          React re-render via
          store.subscribe()
```

### Recommended Project Structure

```
src/
├── index.tsx                  # Entry point: withFullScreen(<App />)
├── app.tsx                    # Root component: TitleScreen vs GameScreen routing
├── ui/
│   ├── screens/
│   │   ├── title-screen.tsx   # Figlet + gradient title, press-any-key
│   │   └── game-screen.tsx    # Four-panel layout orchestrator
│   ├── panels/
│   │   ├── title-bar.tsx      # Game name + day/time
│   │   ├── scene-panel.tsx    # Narration text display
│   │   ├── status-bar.tsx     # HP/MP/Gold/Location/Quest
│   │   ├── actions-panel.tsx  # Numbered action list with cursor
│   │   └── input-area.tsx     # > prompt + / command mode
│   ├── components/
│   │   ├── divider.tsx        # ├───┤ horizontal divider
│   │   ├── outer-border.tsx   # Single outer border wrapper
│   │   └── adaptive-layout.tsx # <100 col vs >=100 col switching
│   └── hooks/
│       ├── use-game-input.ts  # Input routing: / → command, else → NL
│       └── use-store.ts       # React hook for store subscription
├── input/
│   ├── command-parser.ts      # Commander.js in-process command registry
│   ├── command-registry.ts    # Command definitions: /look, /go, /talk, etc.
│   └── intent-classifier.ts   # AI SDK generateObject for NL → intent
├── engine/
│   ├── rules-engine.ts        # D20 resolver: roll + mods vs DC → result
│   ├── dice.ts                # D20/percentage roll functions (seedable PRNG)
│   ├── adjudication.ts        # Normal/opposed/probability/plot-critical modes
│   ├── damage.ts              # Weapon base + attr mod + grade bonus - armor
│   └── types.ts               # GameAction, CheckResult, DamageResult types
├── state/
│   ├── create-store.ts        # Generic createStore<T> (Claude Code pattern)
│   ├── player-store.ts        # HP, MP, gold, attributes, equipment, tags
│   ├── scene-store.ts         # Current scene, narration, NPCs present, exits
│   ├── combat-store.ts        # Combat state, turn order, active effects
│   ├── game-store.ts          # Meta: day/time, game phase, settings
│   └── serializer.ts          # Snapshot all stores → JSON, restore from JSON
├── events/
│   ├── event-bus.ts           # mitt instance with typed domain events
│   └── event-types.ts         # All domain event type definitions
├── codex/
│   ├── schemas/
│   │   ├── entry-types.ts     # Zod schemas: race, profession, location, etc.
│   │   ├── epistemic.ts       # authority, truth_status, scope, visibility, etc.
│   │   └── relationship.ts    # Typed relationship edge schema
│   ├── loader.ts              # YAML file loading + Zod validation
│   └── query.ts               # Query codex by type, tag, id, relationship
├── data/
│   ├── codex/                 # YAML files: races.yaml, locations.yaml, etc.
│   └── placeholder/           # Phase 1 placeholder scene/actions data
└── types/
    ├── intent.ts              # NL intent Zod schema (10 categories)
    ├── game-action.ts         # Unified game action type
    └── common.ts              # Shared types: EntityId, Position, etc.
```

### Pattern 1: Custom Store with Immer Integration

**What:** Extend Claude Code's `createStore` pattern with mandatory immer `produce()` for all mutations.
**When to use:** Every domain store (player, scene, combat, game).

```typescript
// Source: Claude Code src/state/store.ts + immer integration per D-35
import { produce } from 'immer';

type Listener = () => void;
type OnChange<T> = (args: { newState: T; oldState: T }) => void;

export type Store<T> = {
  getState: () => T;
  setState: (recipe: (draft: T) => void) => void;
  subscribe: (listener: Listener) => () => void;
};

export function createStore<T>(
  initialState: T,
  onChange?: OnChange<T>,
): Store<T> {
  let state = initialState;
  const listeners = new Set<Listener>();

  return {
    getState: () => state,

    setState: (recipe: (draft: T) => void) => {
      const prev = state;
      const next = produce(prev, recipe);
      if (Object.is(next, prev)) return;
      state = next;
      onChange?.({ newState: next, oldState: prev });
      for (const listener of listeners) listener();
    },

    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```

### Pattern 2: Commander.js In-Process Command Parsing

**What:** Commander.js parsing user input strings at runtime, not `process.argv`.
**When to use:** When player types `/go north`, `/look`, `/talk guard`.

```typescript
// Source: Context7 /tj/commander.js — .parse() with { from: 'user' }
import { Command } from 'commander';
import type { GameAction } from '../types/game-action';

export function createCommandParser() {
  const program = new Command();
  program.exitOverride(); // Prevent process.exit on errors
  program.configureOutput({
    writeOut: () => {},  // Suppress stdout
    writeErr: () => {},  // Suppress stderr
  });

  let result: GameAction | null = null;

  program
    .command('look')
    .argument('[target]', 'what to look at')
    .action((target) => {
      result = { type: 'look', target: target ?? null, modifiers: {} };
    });

  program
    .command('go')
    .argument('<direction>', 'direction to move')
    .action((direction) => {
      result = { type: 'move', target: direction, modifiers: {} };
    });

  program
    .command('talk')
    .argument('<npc>', 'NPC to talk to')
    .action((npc) => {
      result = { type: 'talk', target: npc, modifiers: {} };
    });

  // ... more commands

  return {
    parse(input: string): GameAction | null {
      result = null;
      const args = input.replace(/^\//, '').trim().split(/\s+/);
      try {
        program.parse(args, { from: 'user' });
      } catch {
        return null; // Unknown command
      }
      return result;
    },
  };
}
```

### Pattern 3: Typed Domain Event Bus

**What:** Wrap mitt with strongly-typed domain events for decoupled system communication.
**When to use:** Rules Engine emits "action_resolved", stores emit "state_changed", UI subscribes.

```typescript
// Source: [ASSUMED] based on mitt API + D-36 typed domain event requirement
import mitt from 'mitt';
import type { CheckResult } from '../engine/types';
import type { GameAction } from '../types/game-action';

type DomainEvents = {
  action_resolved: { action: GameAction; result: CheckResult };
  scene_changed: { sceneId: string };
  combat_started: { enemies: string[] };
  combat_ended: { outcome: 'victory' | 'defeat' | 'flee' };
  player_damaged: { amount: number; source: string };
  state_snapshot_requested: void;
};

export const eventBus = mitt<DomainEvents>();
```

### Pattern 4: NL Intent Classification with AI SDK v5

**What:** Use `generateObject` with Zod schema for structured intent extraction.
**When to use:** Player types free-form Chinese/English text instead of `/` commands.

```typescript
// Source: [VERIFIED: npm registry ai@ai-v5] + [CITED: Context7 /vercel/ai generateObject]
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const IntentSchema = z.object({
  action: z.enum([
    'move', 'look', 'talk', 'attack', 'use_item',
    'cast', 'guard', 'flee', 'inspect', 'trade',
  ]),
  target: z.string().nullable(),
  modifiers: z.record(z.string()).optional(),
  confidence: z.number().min(0).max(1),
  raw_interpretation: z.string(),
});

export type Intent = z.infer<typeof IntentSchema>;

export async function classifyIntent(
  input: string,
  sceneContext: string,
): Promise<Intent> {
  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: IntentSchema,
    prompt: `You are an intent classifier for a fantasy RPG game.
Current scene: ${sceneContext}
Player input: ${input}

Classify the player's intent into a structured game action.`,
  });
  return object;
}
```

### Pattern 5: Custom Box-Drawing Layout (Single Outer Border + Dividers)

**What:** Render the user's mockup layout with `┌─┤└` outer border and `├───┤` internal dividers.
**When to use:** The main GameScreen layout.

```tsx
// Source: [VERIFIED: Context7 /vadimdemedes/ink borderStyle custom object]
// + [VERIFIED: Context7 /daniguardiola/fullscreen-ink useScreenSize]
import { Box, Text } from 'ink';
import { useScreenSize } from 'fullscreen-ink';

function Divider({ width }: { width: number }) {
  const inner = '─'.repeat(Math.max(0, width - 2));
  return <Text>{'├' + inner + '┤'}</Text>;
}

function GameScreen() {
  const { width, height } = useScreenSize();

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="single"
    >
      {/* Title bar */}
      <Box justifyContent="space-between" paddingX={1}>
        <Text bold> Chronicle CLI </Text>
        <Text dimColor> Day 1 / Night </Text>
      </Box>

      <Divider width={width} />

      {/* Scene panel — flexGrow to fill available space */}
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <Text>雨夜的黑松镇北门前，守卫的油灯在风中摇晃。</Text>
      </Box>

      <Divider width={width} />

      {/* Status bar */}
      <Box paddingX={1}>
        <Text>HP 30/30  MP 8/8  Gold 12  Location: 黑松镇·北门  Quest: None</Text>
      </Box>

      <Divider width={width} />

      {/* Actions panel */}
      <Box flexDirection="column" paddingX={1}>
        <Text bold>Actions</Text>
        {/* Action items with cursor */}
      </Box>

      <Divider width={width} />

      {/* Input area */}
      <Box paddingX={1}>
        <Text>{'> '}</Text>
        {/* TextInput component here */}
      </Box>
    </Box>
  );
}
```

### Anti-Patterns to Avoid

- **Nested Box borders for panel separators:** Each Ink `Box` with `borderStyle` renders its own complete border rectangle. Nesting bordered boxes creates double lines at junctions. Use a single outer border + custom divider `Text` rows instead.
- **Commander.js on process.argv in an Ink app:** Ink owns the process. Commander must parse split strings with `{ from: 'user' }`, not `process.argv`. Use `exitOverride()` to prevent `process.exit()`.
- **Direct LLM output to Rules Engine:** NL input must go through: Intent Classifier → Zod validation → domain rule validation → confidence gating → THEN Rules Engine. Never pass raw model output to adjudication.
- **Mutable state updates:** Never `state.player.hp -= damage`. Always `store.setState(draft => { draft.player.hp -= damage })` via immer.
- **String length for CJK layout:** `"北门".length === 2` but display width is 4. Always use `string-width` for layout calculations.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Terminal Flexbox layout | Custom ANSI cursor positioning | Ink 7 `Box` with flexDirection/flexGrow | Ink handles terminal resize, reflow, overflow — hundreds of edge cases |
| Fullscreen alternate buffer | Manual `\x1b[?1049h` escape sequences | fullscreen-ink `withFullScreen` | Handles cleanup on crash/exit, resize events, cursor hiding |
| YAML parsing | Custom parser or regex | `yaml` package (v2.8.3) | Full YAML 1.2 spec, error messages with line numbers, round-trip support |
| Schema validation | Manual `if/else` type checking | Zod 4 schemas | Type inference, composable, error messages, AI SDK integration |
| LLM structured output | Manual JSON.parse + validation | AI SDK `generateObject` | Handles provider-native structured outputs, retry on validation failure, streaming |
| Event emitter | Custom pub/sub | mitt | 200 bytes, typed generics, no memory leak footprint |
| CJK string width | `String.length` or manual counting | `string-width` | Handles CJK (width 2), emoji, ANSI codes, zero-width chars |
| Unique IDs | `Math.random().toString(36)` | nanoid | Cryptographically secure, URL-safe, collision-resistant |
| Immutable updates | Manual spread operator chains | immer `produce()` | Deeply nested state (inventory > items > modifiers) without spread hell |

**Key insight:** Terminal rendering, CJK text measurement, and LLM structured output each have hundreds of edge cases that custom implementations will miss. The libraries listed above are battle-tested specifically for these problems.

## Common Pitfalls

### Pitfall 1: Ink Box Border + Divider Mismatch
**What goes wrong:** Using individual `Box` borders for each panel creates double lines where panels meet — `┘` meets `┌` instead of clean `├───┤`.
**Why it happens:** Ink renders each Box border independently. No "merge adjacent borders" feature exists.
**How to avoid:** Single outer `Box` with `borderStyle="single"`. Internal dividers are `Text` components rendering `├` + `─`.repeat(n) + `┤`. Calculate divider width from `useScreenSize().width` minus the outer border (2 chars).
**Warning signs:** Double horizontal lines between panels, or gaps in the border.

### Pitfall 2: CJK Characters Break Layout Width
**What goes wrong:** Chinese characters like `黑松镇` occupy 2 terminal columns each but `String.length` returns 3. Status bar overflows or gets clipped incorrectly.
**Why it happens:** Terminal uses East Asian Width property; JavaScript `String.length` counts UTF-16 code units.
**How to avoid:** Use `string-width` for ALL display width calculations. Especially in: status bar truncation, scene text wrapping, divider width, title bar left/right alignment.
**Warning signs:** Misaligned columns, text overflowing borders, status bar wrapping to next line.

### Pitfall 3: Commander.js Calls process.exit()
**What goes wrong:** Commander exits the entire Node/Bun process when parsing fails or user types `--help`.
**Why it happens:** Commander's default behavior is designed for standalone CLI tools, not embedded command parsers.
**How to avoid:** Call `program.exitOverride()` during setup. Catch the `CommanderError` exception. Suppress output with `program.configureOutput({ writeOut: () => {}, writeErr: () => {} })`.
**Warning signs:** Game crashes when player types an invalid command or `/help`.

### Pitfall 4: AI SDK v6 Installed Instead of v5
**What goes wrong:** `generateObject` is deprecated in v6 and may emit warnings or behave differently. Project code breaks.
**Why it happens:** `npm install ai` or `bun add ai` installs `latest` which is v6. Must use `ai@ai-v5` dist-tag.
**How to avoid:** Always install with `bun add ai@ai-v5`. Verify with `npm view ai@ai-v5 version` → should be 5.0.179. Add a postinstall check or pin in package.json.
**Warning signs:** Import errors for `generateObject`, deprecation warnings, `Output.object` appearing in autocomplete.

### Pitfall 5: Ink useInput Conflicts with TextInput
**What goes wrong:** `useInput` in a parent component captures keystrokes before `TextInput` can process them, causing the input field to miss characters.
**Why it happens:** Ink's input system is global to the process stdin. Multiple `useInput` hooks compete.
**How to avoid:** Use `useInput` with `{ isActive: !isTyping }` option to disable parent input capture when TextInput has focus. Track focus state explicitly.
**Warning signs:** Characters typed in the input field don't appear, or arrow keys in input field trigger game actions.

### Pitfall 6: fullscreen-ink Cleanup on Crash
**What goes wrong:** If the app crashes, the terminal stays in alternate screen buffer mode — user sees blank screen, can't see their shell.
**Why it happens:** fullscreen-ink needs to restore the original buffer on exit. Uncaught exceptions bypass cleanup.
**How to avoid:** Wrap the entire app in try/catch at the top level. Register `process.on('uncaughtException')` and `process.on('SIGINT')` handlers that call Ink instance cleanup. fullscreen-ink's `withFullScreen` handles graceful exit but not crashes.
**Warning signs:** Terminal stuck in alt buffer after error, user has to `reset` terminal.

### Pitfall 7: Immer Frozen State Returned to React
**What goes wrong:** Immer's `produce()` returns frozen objects in development. Attempting to modify returned state (even accidentally in a React render) throws.
**Why it happens:** Immer freezes returned objects by default to catch mutation bugs.
**How to avoid:** This is actually desired behavior — it enforces immutability. Never mutate state outside of `store.setState()`. If performance is a concern with very large state trees, `setAutoFreeze(false)` is available but not recommended.
**Warning signs:** `Cannot assign to read-only property` errors in React components.

### Pitfall 8: Bun Not Installed
**What goes wrong:** Project can't start at all.
**Why it happens:** Bun is not installed on this machine (verified).
**How to avoid:** First task in Phase 1 must install Bun. `curl -fsSL https://bun.sh/install | bash`. Verify with `bun --version` >= 1.3.12.
**Warning signs:** `command not found: bun`.

## Code Examples

### D20 Check Resolution (Normal Mode)

```typescript
// Source: [ASSUMED] based on D-12 through D-20 specification
import type { CheckResult } from './types';

interface CheckParams {
  roll: number;                // D20 result (1-20)
  attributeModifier: number;   // 体魄/技巧/心智 modifier
  skillModifier: number;       // From tags/profession/equipment
  environmentModifier: number; // Situational bonuses/penalties
  dc: number;                  // Difficulty Class
}

type SuccessGrade =
  | 'critical_success'  // nat20
  | 'great_success'     // total >= DC + 10
  | 'success'           // total >= DC
  | 'partial_success'   // total >= DC - 5
  | 'failure'           // total < DC - 5
  | 'critical_failure'; // nat1

function resolveNormalCheck(params: CheckParams): CheckResult {
  const { roll, attributeModifier, skillModifier, environmentModifier, dc } = params;
  const total = roll + attributeModifier + skillModifier + environmentModifier;

  let grade: SuccessGrade;
  if (roll === 20) grade = 'critical_success';
  else if (roll === 1) grade = 'critical_failure';
  else if (total >= dc + 10) grade = 'great_success';
  else if (total >= dc) grade = 'success';
  else if (total >= dc - 5) grade = 'partial_success';
  else grade = 'failure';

  return {
    roll,
    attributeModifier,
    skillModifier,
    environmentModifier,
    total,
    dc,
    grade,
    display: `[D20: ${roll}] + 属性 ${attributeModifier} + 技能 ${skillModifier} + 环境 ${environmentModifier} = ${total} vs DC ${dc} → ${gradeToLabel(grade)}`,
  };
}

function gradeToLabel(grade: SuccessGrade): string {
  const labels: Record<SuccessGrade, string> = {
    critical_success: '大成功！',
    great_success: '出色成功！',
    success: '成功！',
    partial_success: '勉强成功',
    failure: '失败',
    critical_failure: '大失败！',
  };
  return labels[grade];
}
```

### World Codex Epistemic Metadata Schema

```typescript
// Source: [VERIFIED: D-30 specification from CONTEXT.md]
import { z } from 'zod';

const AuthorityLevel = z.enum([
  'canonical_truth',
  'established_canon',
  'regional_common_knowledge',
  'institutional_doctrine',
  'scholarly_dispute',
  'street_rumor',
]);

const TruthStatus = z.enum([
  'true', 'false', 'partially_true', 'misleading',
  'unknown', 'contested', 'propaganda', 'mythic',
]);

const Scope = z.enum([
  'global', 'kingdom_wide', 'regional', 'local',
  'faction_internal', 'personal', 'ancient', 'forbidden',
]);

const Visibility = z.enum([
  'public', 'discovered', 'hidden', 'secret', 'forbidden',
]);

const SourceType = z.enum([
  'authorial', 'official_record', 'ancient_text', 'oral_history',
  'npc_memory', 'faction_claim', 'street_rumor', 'player_found',
  'system_event',
]);

const Volatility = z.enum(['stable', 'evolving', 'deprecated']);

export const EpistemicMetadataSchema = z.object({
  authority: AuthorityLevel,
  truth_status: TruthStatus,
  scope: Scope,
  scope_ref: z.string().optional(),
  visibility: Visibility,
  confidence: z.number().min(0).max(1),
  source_type: SourceType,
  source_bias: z.string().optional(),
  known_by: z.array(z.string()).default([]),
  contradicts: z.array(z.string()).default([]),
  volatility: Volatility.default('stable'),
});
```

### Store Serialization/Deserialization

```typescript
// Source: [ASSUMED] based on D-33/D-34 multi-store serialization
import { z } from 'zod';

interface StoreRegistry {
  [key: string]: { getState: () => unknown; setState: (updater: (draft: any) => void) => void };
}

export function createSerializer(stores: StoreRegistry) {
  return {
    snapshot(): string {
      const data: Record<string, unknown> = {};
      for (const [key, store] of Object.entries(stores)) {
        data[key] = store.getState();
      }
      return JSON.stringify(data);
    },

    restore(json: string, schemas: Record<string, z.ZodType>): void {
      const data = JSON.parse(json) as Record<string, unknown>;
      for (const [key, store] of Object.entries(stores)) {
        if (key in data) {
          const validated = schemas[key].parse(data[key]);
          store.setState(() => validated);
        }
      }
    },
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AI SDK v4 `generateObject` | AI SDK v5 `generateObject` (stable) | 2025 | v5 is the active LTS branch; v6 deprecated `generateObject` |
| Ink 4-5 | Ink 7 + React 19 | 2025 | New API: custom borderStyle objects, React 19 peer dep required |
| Zod 3 | Zod 4.3.6 | 2025 | 2-7x faster parsing, AI SDK requires ^4.1.8 or ^3.25.76 |
| blessed (terminal UI) | Ink 7 | ~2020 (blessed abandoned) | blessed unmaintained since 2020; Ink is the standard |
| Manual ANSI rendering | React component model (Ink) | ~2022 | Flexbox layout, hooks, component reuse |

**Deprecated/outdated:**
- `blessed` / `blessed-contrib`: Abandoned since 2020, no TypeScript, no React model
- `terminal-kit`: Lower-level imperative API, no component model
- AI SDK v6 `generateObject`: Deprecated in v6 — replaced by `generateText` + `Output.object()`; but v5 keeps it as primary API

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 5-level graded success (critical_success/great_success/success/partial_success/failure + critical_failure) with nat20/nat1 as criticals | Code Examples (D20 Check) | Low — user approved Claude's discretion for this; thresholds easily adjustable |
| A2 | Commander.js `.exitOverride()` + `.configureOutput()` suppress all stdout/stderr side effects when embedded in Ink app | Architecture Patterns | Medium — if Commander still writes to stdout it could corrupt Ink rendering. Must test. |
| A3 | Ink 7 `Box` with `borderStyle="single"` plus custom divider `Text` rows achieves the user's mockup layout | Architecture Patterns | High — the outer border + inner dividers approach is based on Ink's known capabilities, but the exact visual alignment with `├───┤` touching the outer border's `│` needs implementation testing |
| A4 | fullscreen-ink 0.1.0 works with Ink 7.0.1 | Standard Stack | Medium — fullscreen-ink declares `ink` as peer dep without version constraint, but it's a small library (0.1.0) and may not have been tested with Ink 7 specifically |
| A5 | Bun native YAML import works for static codex files | Standard Stack | Low — documented in Bun docs, but codex files may need dynamic loading (covered by `yaml` package) |
| A6 | `@inkjs/ui` TextInput supports Chinese input correctly | Standard Stack | Medium — TextInput handles stdin characters, but CJK IME composition behavior in terminal is host-dependent |
| A7 | Background color auto-detection (D-10) is achievable via terminal escape sequence query | Locked Decisions | Medium — `\x1b]11;?\x07` OSC query returns bg color on some terminals; may not work on all terminals (Windows Terminal, older xterm). Need fallback. |

## Open Questions

1. **Outer border + divider alignment** (RESOLVED)
   - What we know: Ink `Box` with `borderStyle="single"` draws `┌┐└┘│─`. Custom `Text` rows can render `├───┤`.
   - What's unclear: Will the `├` and `┤` characters visually connect with the outer border's `│` when the divider `Text` is inside a bordered `Box`? The border characters occupy padding space, and the divider is content inside the box.
   - **Resolution:** Plan 04 Task 1 creates a Divider component rendering `├` + `─`.repeat(width-2) + `┤` as content inside the bordered Box. Plan 04 Task 2 instructs the executor to prototype and adapt if Ink's border chars don't merge visually — fallback is manual border rendering as Text rows. This is handled at execution time, not pre-decided.

2. **Commander.js + Ink stdin conflict** (RESOLVED)
   - What we know: Ink captures stdin via `useInput`/`useStdin`. Commander.js expects to parse strings.
   - What's unclear: Whether Commander's `.parse(args, { from: 'user' })` has any side effects on stdin/stdout even with `exitOverride()`.
   - **Resolution:** Plan 05 uses Commander in pure string-parsing mode: `program.parse(args, { from: 'user' })` with `exitOverride()` and `configureOutput({ writeOut: () => {}, writeErr: () => {} })`. Commander never touches stdin/stdout. Ink captures keystrokes, passes the completed string to Commander for parsing. No conflict.

3. **Terminal background color detection (D-10)** (RESOLVED)
   - What we know: OSC 11 escape sequence (`\x1b]11;?\x07`) can query background color on xterm-compatible terminals.
   - What's unclear: Coverage across terminal emulators (iTerm2 yes, Terminal.app partial, Windows Terminal unknown).
   - **Resolution:** Phase 1 defaults to dark theme (`isDarkTheme: true` in GameStore). Background color detection deferred — not in Phase 1 scope. User can toggle via future config. D-10 is a nice-to-have, not a Phase 1 requirement.

4. **Bun + Ink 7 compatibility** (RESOLVED)
   - What we know: Claude Code runs on Bun + Ink (confirmed by reference implementation). CLAUDE.md states Bun runtime.
   - What's unclear: Exact Bun version compatibility with Ink 7.0.1 + React 19.
   - **Resolution:** Plan 01 Task 1 installs Bun >= 1.3.12, React 19, and Ink 7. Plan 04 Task 2 renders the full UI as first validation. If compatibility issues surface, they are caught at execution time with clear error messages. Claude Code's production use of Bun + Ink gives high confidence.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Runtime (project constraint) | **NO** | -- | Must install: `curl -fsSL https://bun.sh/install \| bash` |
| Node.js | npm for package verification | Yes | v24.14.0 | -- |
| npm/npx | Package management (fallback) | Yes | 11.9.0 | -- |
| Git | Version control | Yes | (via git repo) | -- |
| Terminal with Unicode | CJK display, box-drawing | Yes | macOS Terminal/iTerm2 | -- |

**Missing dependencies with no fallback:**
- **Bun runtime**: NOT installed. Must be installed before any project work. This is a blocking prerequisite.

**Missing dependencies with fallback:**
- None. Once Bun is installed, all other dependencies come from npm/bun packages.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | bun test (built-in, Jest-compatible API) |
| Config file | none — see Wave 0 (bunfig.toml may be needed) |
| Quick run command | `bun test --bail` |
| Full suite command | `bun test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORE-01 | `/look`, `/go north`, `/talk NPC` parsed into GameAction | unit | `bun test src/input/command-parser.test.ts` | Wave 0 |
| CORE-02 | Free-form NL classified into structured intent | integration | `bun test src/input/intent-classifier.test.ts` | Wave 0 |
| CORE-03 | D20 check resolves deterministically | unit | `bun test src/engine/rules-engine.test.ts` | Wave 0 |
| CORE-04 | State serialized to JSON and restored identically | unit | `bun test src/state/serializer.test.ts` | Wave 0 |
| CLI-01 | Four-panel layout renders without error, responds to resize | integration | `bun test src/ui/screens/game-screen.test.tsx` | Wave 0 |
| WORLD-01 | YAML codex validates against Zod schema | unit | `bun test src/codex/loader.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test --bail`
- **Per wave merge:** `bun test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/input/command-parser.test.ts` — covers CORE-01
- [ ] `src/input/intent-classifier.test.ts` — covers CORE-02 (needs mock LLM provider)
- [ ] `src/engine/rules-engine.test.ts` — covers CORE-03 (seedable PRNG for deterministic tests)
- [ ] `src/state/serializer.test.ts` — covers CORE-04
- [ ] `src/ui/screens/game-screen.test.tsx` — covers CLI-01 (Ink `render` test utility)
- [ ] `src/codex/loader.test.ts` — covers WORLD-01
- [ ] `bunfig.toml` — test configuration if needed
- [ ] Framework install: `curl -fsSL https://bun.sh/install | bash` — Bun not detected

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A — single-player local game |
| V3 Session Management | No | N/A — no sessions, local state only |
| V4 Access Control | No | N/A — no multi-user access |
| V5 Input Validation | **Yes** | Zod schema validation on all inputs: commands, NL intents, YAML codex, JSON state |
| V6 Cryptography | No | N/A — no secrets, no encryption needed |

### Known Threat Patterns for CLI + LLM Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via player input | Tampering | Intent classifier output validated by Zod schema; Rules Engine never receives raw LLM output; system prompt isolated from player text |
| Malicious YAML codex content | Tampering | Zod schema validation on all loaded YAML; reject unknown fields; no `eval()` or dynamic code execution from data files |
| LLM hallucinating game state changes | Elevation of Privilege | AI generates prose only; Rules Engine owns all state mutations; game actions validated before execution |
| Save file tampering | Tampering | Zod validation on restore; treat loaded JSON as untrusted input; fail gracefully on invalid saves |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: npm registry] — All package versions verified via `npm view <package> version` on 2026-04-20
- [VERIFIED: npm registry] — AI SDK dist-tags: `ai-v5` → 5.0.179, `latest` → 6.0.168
- [Context7 /vadimdemedes/ink] — Box layout, borderStyle (custom + predefined), useInput hook, Text component
- [Context7 /daniguardiola/fullscreen-ink] — withFullScreen API, useScreenSize hook, alternate screen buffer
- [Context7 /tj/commander.js] — .parse() with `{ from: 'user' }`, .command(), .action(), .argument()
- [Context7 /vercel/ai] — generateObject (v5), generateText + Output.object (v6 migration), structured output patterns
- [Claude Code src/state/store.ts] — createStore pattern (34 lines, getState/setState/subscribe)
- [Claude Code src/ink.ts] — React + Ink + ThemeProvider wrapping pattern

### Secondary (MEDIUM confidence)
- [CONTEXT.md D-01 through D-40] — All locked decisions from user discuss session
- [CLAUDE.md] — Project architecture spec, stack decisions, layer model

### Tertiary (LOW confidence)
- [ASSUMED: A1-A7] — See Assumptions Log above. Particularly A3 (border alignment) and A7 (background color detection) need validation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry, peer deps checked, compatibility matrix confirmed
- Architecture: HIGH for patterns, MEDIUM for the specific border/divider approach (needs prototype validation, see A3)
- Pitfalls: HIGH — drawn from verified library documentation and known terminal rendering issues
- Rules Engine: MEDIUM — game logic design is per user spec, implementation patterns are assumed (A1)
- NL Intent: HIGH — AI SDK v5 `generateObject` pattern verified via Context7

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (stable ecosystem, 30-day window appropriate)
