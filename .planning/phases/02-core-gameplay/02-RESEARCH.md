# Phase 2: Core Gameplay - Research

**Researched:** 2026-04-21
**Domain:** AI-driven game content generation (Narrative Director, NPC Actor, Retrieval Planner) + character creation + scene exploration + turn-based combat -- all integrated into an existing CLI game engine skeleton
**Confidence:** HIGH

## Summary

Phase 2 transforms the Phase 1 engine skeleton into a playable game. The core challenge is integrating three AI roles (Narrative Director, NPC Actor, Retrieval Planner) into the existing deterministic game loop while maintaining the architectural boundary: AI writes prose, Rules Engine decides outcomes. The codebase already has the critical infrastructure -- D20 adjudication, damage calculation, command parsing, NL intent classification, event bus, multi-store state management, and World Codex with epistemic metadata. Phase 2 builds on top of all of this.

The four implementation domains are: (1) Character creation wizard -- a narrative-driven flow that initializes player state from codex data, (2) Scene exploration -- wiring `/look`/`/inspect`/`/scan` to real codex data with AI-generated narration, (3) NPC dialogue -- AI-driven personality-consistent dialogue with inline and full Dialogue Mode UI, (4) Turn-based combat -- extending the existing combat store with a full combat loop, deterministic resolution via Rules Engine, and AI-narrated outcomes. All AI outputs are Chinese-first, 80-180 characters, constrained by Zod schemas.

**Primary recommendation:** Build bottom-up -- AI provider abstraction and prompt infrastructure first, then character creation (no AI needed for core flow), then scene exploration with Narrative Director, then NPC dialogue, then combat (which combines Rules Engine + AI narration). Each layer depends on the previous one being solid.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Hybrid character creation -- guided wizard (narrative flow) for first play, quick mode (presets/random/import) for subsequent plays
- **D-02:** Wizard sequence: Race -> Profession -> Background Hook -> Confirm, wrapped in narrative questions ("你从哪里来？""你靠什么活下去？""你为什么来到黑松镇？""你身上有什么秘密？")
- **D-03:** Attributes determined by narrative choices (not direct number assignment) -- background hooks imply physique/finesse/mind bias
- **D-04:** Three-attribute base (physique/finesse/mind) + race/profession/background/experience tags for differentiation
- **D-05:** Background hooks write into initial world state, affecting starting quest, NPC relationships, hidden story threads
- **D-06:** Quick mode options: preset templates (北境游侠/旧贵族术士/流浪盗贼 etc.), random generation, custom
- **D-07:** Dynamic mixed narrative style by scene type (exploration=cinematic, combat=short/punchy, dialogue=light novel, lore=archaic, horror=suspense, check=explain then narrate)
- **D-08:** Mixed perspective strategy (2nd person for action/combat/exploration, direct speech for NPC dialogue, 3rd person for history/recap, objective for system log)
- **D-09:** No frequent perspective switching within same turn
- **D-10:** 80-180 Chinese chars per turn narration, AI must not invent world facts or override game state
- **D-11:** Short NPC dialogue rendered inline in Scene panel
- **D-12:** Critical dialogue (quest, relationship, checks, hidden info, multi-turn) auto-enters Dialogue Mode
- **D-13:** Dialogue Mode: dedicated layout in Scene panel area with NPC name, speech, relationship status, response options, check options
- **D-14:** NPC emotion: narrative default + check-unlocked hints (basic success = rough emotion, advanced = hidden motive/conflict)
- **D-15:** NPC dialogue via AI NPC Actor. Input: identity, goals, memories, scene, player action. Output: dialogue, emotion tag (internal), memory flag, relationship delta suggestion
- **D-16:** Combat Mode: four-panel layout with content swap (scene->battle narration, status bar->extended combat info, actions->combat menu, input unchanged)
- **D-17:** Check first, narration second: display full check data, then AI narration
- **D-18:** Combat actions resolved by Rules Engine (D20+attr+mod vs DC), AI only narrates

### Claude's Discretion
- AI Narrative Director prompt template design
- Retrieval Planner retrieval strategy details
- NPC memory initial seed data structure
- Combat balance values (weapon damage, armor, DCs)
- Character preset template specific content
- Dialogue Mode specific UI component implementation

### Deferred Ideas (OUT OF SCOPE)
- NPC long-term memory persistence (cross-session) -- Phase 3
- Relationship system influencing NPC behavior and dialogue availability -- Phase 3
- Quest accept/track system -- Phase 3
- Immersion mode (collapse check details) -- Phase 2 has the foundation, but UI toggle deferred
- Auto-combat option -- future optimization
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAY-01 | Character creation: choose race, profession, background; see starting stats and equipment | Character creation wizard flow, codex data (races.yaml, professions.yaml), PlayerState schema extension, CharacterCreationStore |
| PLAY-02 | Scene exploration with /look /inspect /scan: environment, NPCs, exits, objects | Scene rendering from codex LocationSchema, Narrative Director AI integration, existing SceneStore + codex query infrastructure |
| PLAY-03 | NPC dialogue via /talk: personality-consistent, context-aware, AI-generated | NPC Actor AI role, NpcDialogueSchema, DialogueStore, DialoguePanel UI, NPC personality_tags + goals + backstory from codex |
| PLAY-04 | Turn-based combat: /attack /cast /guard /flee, deterministic HP/MP, AI-narrated outcomes | CombatStore extension, combat loop, Rules Engine (adjudication + damage already built), Narrative Director combat mode, Combat Mode UI |
| AI-01 | Narrative Director: 80-180 char Chinese prose per turn from adjudicated results, no world fact invention | AI provider abstraction, narrative prompt templates per scene type, Zod output validation, guardrails (state override detection, char count) |
| AI-02 | NPC Actor: per-character dialogue informed by identity, goals, emotions, memory, scene | NPC Actor AI role, NpcDialogueSchema, per-NPC prompt templates with personality injection, memory retrieval |
| AI-03 | Retrieval Planner: decides which codex entries/NPC memories/quest states to fetch per turn | RetrievalPlanSchema, lightweight generateObject call, codex query integration, caching strategy |
| CONT-02 | Character system: 3-4 races with traits, 3-4 professions with abilities, 5-6 base stats, starting equipment | Expand existing races.yaml (2 -> 3-4), professions.yaml (2 -> 3-4), add backgrounds YAML, item data for starting equipment |
| CONT-04 | NPC content: 10-15 named NPCs with backstories, goals, relationships, personality tags | Expand npcs.yaml (2 -> 10-15), add NPC memory seeds, extend relationship edges |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Character creation flow | Frontend (React/Ink UI) | State (PlayerStore) | UI drives the wizard steps; store persists the final character |
| Scene exploration | State (SceneStore) + Codex | Frontend (ScenePanel) | Codex provides data, SceneStore tracks current scene, UI renders |
| NPC dialogue generation | API (AI NPC Actor) | State (DialogueStore) | AI generates dialogue, store manages dialogue session state |
| Narrative generation | API (AI Narrative Director) | Frontend (ScenePanel) | AI generates prose, UI renders with streaming |
| Retrieval planning | API (AI Retrieval Planner) | Codex (query.ts) | AI decides what to fetch, codex query executes the actual retrieval |
| Combat resolution | Engine (Rules Engine) | State (CombatStore) | Rules Engine adjudicates deterministically, store tracks combat state |
| Combat narration | API (AI Narrative Director) | Frontend (Combat Mode UI) | AI narrates outcomes, UI renders check results + narration |
| Input routing | Engine (input-router.ts) | Frontend (InputArea) | Existing dual-input system routes to correct handler |
| World data | Codex (YAML files) | State (in-memory Map) | YAML is source of truth, loaded into Map at startup |

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Verified |
|---------|---------|---------|----------|
| ai (Vercel AI SDK) | ^5.0.179 | LLM abstraction: generateText, generateObject, streamText | [VERIFIED: npm registry, installed in node_modules] |
| @ai-sdk/openai | ^3.0.53 | OpenAI provider (GPT-4o-mini for intent classification) | [VERIFIED: installed in node_modules] |
| zod | ^4.3.6 | Schema validation for AI outputs, game state, codex | [VERIFIED: installed] |
| React | ^19.2.5 | UI framework for Ink | [VERIFIED: installed] |
| ink | ^7.0.1 | Terminal renderer | [VERIFIED: installed] |
| @inkjs/ui | ^2.0.0 | Select, TextInput, Spinner components | [VERIFIED: installed] |
| immer | ^11.1.4 | Immutable state updates | [VERIFIED: installed] |
| mitt | ^3.0.1 | Typed event bus | [VERIFIED: installed] |
| nanoid | ^5.1.9 | ID generation | [VERIFIED: installed] |

### New Dependencies Required
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @ai-sdk/google | ^3.0.64 | Google Gemini provider | AI-SPEC mandates Gemini 2.0 Flash as primary model for Narrative Director, NPC Actor, Retrieval Planner [VERIFIED: npm registry] |
| @ai-sdk/anthropic | ^3.0.71 | Anthropic provider | Background quest planning (Claude Sonnet) per AI-SPEC model routing [VERIFIED: npm registry] |
| @ai-sdk/alibaba | ^1.0.17 | Alibaba Qwen provider | Chinese-optimized narration (Qwen-Plus/Turbo) -- critical for Chinese-first content [VERIFIED: npm registry] |
| @ai-sdk/deepseek | ^2.0.29 | DeepSeek provider | Cost-effective Chinese generation, backup for Qwen [VERIFIED: npm registry] |
| promptfoo | ^0.121.5 | AI evaluation framework | AI-SPEC mandates for eval suite. CLI-first, CI/CD compatible. Dev dependency only. [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Multiple AI providers | Single provider (OpenAI only) | Lose Chinese-optimized models (Qwen, DeepSeek) and cost optimization. Project constraint mandates multi-provider. |
| Promptfoo | Custom eval scripts | Promptfoo provides standardized eval framework with built-in LLM judge support. Custom scripts require more maintenance. |
| generateObject (v5) | generateText + Output.object (v6) | Project locked on v5. Context7 docs show v6 pattern; existing intent-classifier.ts confirms v5 generateObject works correctly. |

**Installation:**
```bash
bun add @ai-sdk/google @ai-sdk/anthropic @ai-sdk/alibaba @ai-sdk/deepseek
bun add -d promptfoo
```

## Architecture Patterns

### System Architecture Diagram

```
Player Input
    │
    ├── "/" prefix ──> Command Parser ──> GameAction
    │                                        │
    └── NL text ───> Intent Classifier ──> GameAction
                     (AI SDK generateObject)     │
                                                 │
                                    ┌────────────┴───────────────┐
                                    │         Game Loop           │
                                    │                             │
                                    │  1. Retrieval Planner (AI)  │
                                    │     └─> Codex Query         │
                                    │         └─> Retrieved ctx   │
                                    │                             │
                                    │  2. Rules Engine (D20)      │
                                    │     └─> CheckResult         │
                                    │     └─> DamageResult        │
                                    │                             │
                                    │  3. State Updates           │
                                    │     (PlayerStore,           │
                                    │      CombatStore,           │
                                    │      SceneStore)            │
                                    │                             │
                                    │  4. Narrative Director (AI) │
                                    │     or NPC Actor (AI)       │
                                    │     └─> Narration/Dialogue  │
                                    │                             │
                                    │  5. Event Bus Emit          │
                                    └────────────┬───────────────┘
                                                 │
                                    ┌────────────┴───────────────┐
                                    │      React/Ink UI           │
                                    │  ┌──────────────────────┐   │
                                    │  │ CharCreation Screen  │   │
                                    │  │ GameScreen           │   │
                                    │  │  ├─ ScenePanel       │   │
                                    │  │  │  ├─ DialoguePanel │   │
                                    │  │  │  └─ CombatNarr    │   │
                                    │  │  ├─ StatusBar        │   │
                                    │  │  ├─ ActionsPanel     │   │
                                    │  │  └─ InputArea        │   │
                                    │  └──────────────────────┘   │
                                    └─────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── ai/                          # NEW — all AI integration
│   ├── providers.ts             # Model registry: role -> provider/model
│   ├── prompts/
│   │   ├── narrative-system.ts  # System prompts per scene type
│   │   ├── npc-system.ts        # NPC Actor system prompt builder
│   │   └── retrieval-system.ts  # Retrieval Planner prompt
│   ├── schemas/
│   │   ├── narration-output.ts  # Zod schema for narration validation
│   │   ├── npc-dialogue.ts      # NpcDialogueSchema
│   │   └── retrieval-plan.ts    # RetrievalPlanSchema
│   ├── roles/
│   │   ├── narrative-director.ts # generateText/streamText wrapper
│   │   ├── npc-actor.ts          # generateObject wrapper
│   │   ├── retrieval-planner.ts  # generateObject wrapper
│   │   └── safety-filter.ts     # Content safety check
│   └── utils/
│       ├── context-assembler.ts # Build prompt context from stores + codex
│       └── fallback.ts          # Fallback narration when AI fails
├── engine/
│   ├── combat-loop.ts           # NEW — full combat turn loop
│   ├── scene-manager.ts         # NEW — scene transitions, exploration
│   └── character-creation.ts    # NEW — wizard logic (non-UI)
├── state/
│   ├── character-creation-store.ts  # NEW
│   ├── dialogue-store.ts            # NEW
│   └── npc-memory-store.ts          # NEW — per-NPC episodic memory (session)
├── ui/
│   ├── screens/
│   │   └── character-creation-screen.tsx  # NEW
│   ├── panels/
│   │   ├── dialogue-panel.tsx        # NEW
│   │   ├── combat-status-bar.tsx     # NEW — extended status for combat
│   │   ├── combat-actions-panel.tsx  # NEW
│   │   └── check-result-line.tsx     # NEW — formatted check display
│   └── hooks/
│       └── use-ai-narration.ts       # NEW — async AI call hook
├── data/codex/
│   ├── backgrounds.yaml              # NEW — background hook definitions
│   ├── races.yaml                    # EXPAND — 2 -> 3-4 races
│   ├── professions.yaml              # EXPAND — 2 -> 3-4 professions
│   ├── npcs.yaml                     # EXPAND — 2 -> 10-15 NPCs
│   ├── items.yaml                    # EXPAND — more weapons/armor/consumables
│   └── enemies.yaml                  # NEW — enemy stat blocks for combat
└── data/
    └── npc-memory/                   # NEW — JSON files per NPC for session memory
```

### Pattern 1: AI Role Abstraction
**What:** Centralized model routing with per-role configuration
**When to use:** Every AI call in the game
**Example:**
```typescript
// src/ai/providers.ts
import type { LanguageModel } from 'ai';
import { google } from '@ai-sdk/google';

type AiRole = 'narrative-director' | 'npc-actor' | 'retrieval-planner' | 'safety-filter';

interface RoleConfig {
  readonly model: () => LanguageModel;
  readonly temperature: number;
  readonly maxTokens: number;
}

const ROLE_CONFIGS: Record<AiRole, RoleConfig> = {
  'narrative-director': { model: () => google('gemini-2.0-flash'), temperature: 0.7, maxTokens: 512 },
  'npc-actor': { model: () => google('gemini-2.0-flash'), temperature: 0.8, maxTokens: 400 },
  'retrieval-planner': { model: () => google('gemini-2.0-flash'), temperature: 0.1, maxTokens: 200 },
  'safety-filter': { model: () => google('gemini-2.0-flash'), temperature: 0.0, maxTokens: 50 },
};

export function getRoleConfig(role: AiRole): RoleConfig {
  return ROLE_CONFIGS[role];
}
```
Source: [CITED: AI-SPEC Section 4, Model Configuration table]

### Pattern 2: Structured AI Output with Schema Validation
**What:** All AI outputs validated via Zod schemas using `generateObject` (v5 API)
**When to use:** NPC dialogue, retrieval plans, safety filter results
**Example:**
```typescript
// src/ai/roles/npc-actor.ts
import { generateObject } from 'ai';
import { NpcDialogueSchema } from '../schemas/npc-dialogue';
import { getRoleConfig } from '../providers';

export async function generateNpcDialogue(
  npcProfile: NpcProfile,
  scene: SceneContext,
  playerAction: string,
  memories: readonly NpcMemory[],
): Promise<NpcDialogue> {
  const config = getRoleConfig('npc-actor');
  const { object } = await generateObject({
    model: config.model(),
    schema: NpcDialogueSchema,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    system: buildNpcSystemPrompt(npcProfile),
    prompt: buildNpcUserPrompt({ scene, playerAction, memories }),
  });
  return object;
}
```
Source: [VERIFIED: existing intent-classifier.ts uses identical generateObject pattern with AI SDK v5]

### Pattern 3: Streaming Narration
**What:** Narrative Director uses `streamText` for real-time text display
**When to use:** Scene narration, combat narration (player sees text appear progressively)
**Example:**
```typescript
// src/ai/roles/narrative-director.ts
import { streamText } from 'ai';
import { getRoleConfig } from '../providers';

export async function* streamNarration(
  context: NarrativeContext,
): AsyncGenerator<string> {
  const config = getRoleConfig('narrative-director');
  const { textStream } = streamText({
    model: config.model(),
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    system: buildNarrativeSystemPrompt(context.sceneType),
    prompt: buildNarrativeUserPrompt(context),
  });
  for await (const chunk of textStream) {
    yield chunk;
  }
}
```
Source: [VERIFIED: Context7 /vercel/ai streamText docs + AI-SPEC Section 4b.2]

### Pattern 4: Context Assembly Pipeline
**What:** Per-turn context assembly: Retrieval Planner -> Codex Query -> Context Assembler -> AI Role
**When to use:** Every turn that needs AI narration
**Example:**
```typescript
// src/ai/utils/context-assembler.ts
interface AssembledContext {
  readonly codexEntries: readonly CodexEntry[];
  readonly npcMemories: readonly NpcMemory[];
  readonly recentNarration: readonly string[];
  readonly checkResult?: CheckResult;
  readonly playerAction: GameAction;
}

export function assembleNarrativeContext(
  retrievalPlan: RetrievalPlan,
  codexEntries: Map<string, CodexEntry>,
  npcMemories: readonly NpcMemory[],
  sceneState: SceneState,
  action: GameAction,
  checkResult?: CheckResult,
): AssembledContext {
  const entries = retrievalPlan.codexIds
    .map(id => codexEntries.get(id))
    .filter(Boolean)
    .slice(0, 3);

  const memories = npcMemories
    .filter(m => retrievalPlan.npcIds.includes(m.npcId))
    .slice(0, 3);

  return {
    codexEntries: entries,
    npcMemories: memories,
    recentNarration: sceneState.narrationLines.slice(-6),
    checkResult,
    playerAction: action,
  };
}
```
Source: [CITED: AI-SPEC Section 4, Context Window Strategy + CLAUDE.md RAG Strategy]

### Pattern 5: Combat Loop State Machine
**What:** Turn-based combat as explicit state machine within CombatStore
**When to use:** All combat encounters
**Example:**
```typescript
// Combat phases: INIT -> PLAYER_TURN -> ENEMY_TURN -> CHECK_END -> PLAYER_TURN...
type CombatPhase = 'init' | 'player_turn' | 'enemy_turn' | 'resolving' | 'narrating' | 'ended';
```
Source: [ASSUMED -- standard game loop pattern for turn-based combat]

### Anti-Patterns to Avoid
- **AI decides outcomes:** AI must NEVER determine success/failure, damage, or state changes. Only the Rules Engine does this. AI receives adjudicated results and narrates them. [CITED: CLAUDE.md "Critical boundary"]
- **Raw NL to LLM for adjudication:** NL input must go through intent classification before reaching any AI role. Never bypass the intent classifier. [CITED: CLAUDE.md Dual-Input System]
- **Context window stuffing:** Do NOT dump entire codex into system prompts. Retrieval Planner selects max 3 entries per turn, each truncated to 200 chars. [CITED: AI-SPEC Section 4, Context Window Strategy]
- **Mutable state updates:** All store updates via immer `produce()`. No direct mutation. [CITED: Phase 1 D-35, CLAUDE.md global rules]
- **AI generating beyond boundaries:** Narration must stay within 80-180 Chinese chars. Use Zod `.min()/.max()` on output schema or post-validation to enforce. [CITED: D-10]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM structured output | Custom JSON parsing + retry | `generateObject` (AI SDK v5) | Handles schema validation, provider-specific modes (function calling, JSON mode), automatic retry |
| LLM streaming | Custom chunked HTTP | `streamText` (AI SDK v5) | Handles backpressure, async iteration, provider normalization |
| Multi-provider routing | Per-provider HTTP clients | AI SDK provider packages | Unified API across Google/OpenAI/Anthropic/Alibaba/DeepSeek |
| Terminal Flexbox layout | Manual ANSI escape codes | Ink Box/Text components | Yoga layout engine, declarative React model, handles resize |
| CJK string width | `String.length` for layout | `string-width` | CJK chars are 2 columns wide; `string-width` handles this correctly |
| Select/TextInput widgets | Custom arrow key handling | @inkjs/ui Select/TextInput | Handles focus, keyboard, accessibility; already used in Phase 1 pattern |
| AI eval framework | Custom test harness | Promptfoo | LLM judge, assertion types, YAML config, CI/CD integration |

**Key insight:** The AI SDK v5 already solves the hardest integration problems (provider normalization, structured output, streaming). The project's job is prompt engineering and game logic, not LLM plumbing.

## Common Pitfalls

### Pitfall 1: AI SDK v5 vs v6 API Confusion
**What goes wrong:** Using `generateText` + `Output.object()` (v6 pattern) instead of `generateObject` (v5 pattern). Context7 docs heavily feature v6 examples.
**Why it happens:** AI SDK v6 is the latest major version. Documentation and training data increasingly show v6 patterns.
**How to avoid:** Project is locked on `ai@^5.0.179`. Always use `generateObject` for structured output. The existing `intent-classifier.ts` is the canonical reference for correct v5 usage.
**Warning signs:** Import of `Output` from `ai` (that's v6). Compilation error about `Output` not being exported.

### Pitfall 2: AI State Override in Narration
**What goes wrong:** AI narration says "you found a magic sword" or "the enemy falls" but game state doesn't reflect this.
**Why it happens:** LLMs naturally want to advance the story. Without explicit constraints, they invent mechanical outcomes.
**How to avoid:** System prompt must explicitly prohibit mechanical claims. Post-generation guardrail checks for state-override keywords (获得, 失去, HP, 伤害, 等级). CheckResult is the ONLY source of mechanical truth.
**Warning signs:** Player reports inventory items they don't have; HP/MP mismatch between narration and status bar.

### Pitfall 3: NPC Personality Collapse Over Long Dialogue
**What goes wrong:** After 5+ turns of dialogue, NPC loses unique voice and starts giving generic responses.
**Why it happens:** Context window fills with dialogue history; NPC personality template weight dilutes.
**How to avoid:** NPC personality tags are ALWAYS in the system prompt (high priority position). Dialogue history limited to last 3-5 exchanges. When approaching limit, summarize earlier dialogue rather than keeping full history.
**Warning signs:** Different NPCs giving similar responses; NPC using vocabulary inconsistent with their personality_tags.

### Pitfall 4: Missing API Keys at Runtime
**What goes wrong:** AI calls fail because provider API keys are not set.
**Why it happens:** Environment variables not configured. Only `@ai-sdk/openai` is currently installed; other providers aren't even in package.json yet.
**How to avoid:** Startup validation checks for required API keys. Graceful fallback to static narration when AI is unavailable. Tests must mock all AI calls.
**Warning signs:** Unhandled promise rejections from AI SDK; "API key not found" errors.

### Pitfall 5: Chinese Character Count vs Byte Count
**What goes wrong:** 80-180 char limit enforced using `string.length` counts code points correctly for Chinese, but trimming mid-character can break.
**Why it happens:** JavaScript `string.length` counts UTF-16 code units, which for basic Chinese characters equals character count. But emoji (used in combat UI) can be multi-code-unit.
**How to avoid:** Use `[...str].length` (spread into array of grapheme clusters) for accurate character count. Use `string-width` for display width.
**Warning signs:** Narration appearing truncated or overflowing panel width.

### Pitfall 6: Combat Store Race Conditions
**What goes wrong:** Player and enemy actions resolve simultaneously or out of order.
**Why it happens:** AI narration is async; if game loop doesn't wait for narration to complete before advancing to next turn, state can get ahead of UI.
**How to avoid:** Combat loop must be a sequential state machine: resolve action -> update state -> generate narration -> wait for narration complete -> advance turn. Never advance turn while narration is pending.
**Warning signs:** Status bar shows different HP than narration describes; turn counter skips ahead.

### Pitfall 7: GamePhase Enum Missing States
**What goes wrong:** `GamePhaseSchema` currently has `['title', 'game', 'combat', 'dialogue']` but character creation needs its own phase.
**Why it happens:** Phase 1 only needed title and game phases. Phase 2 adds character_creation as a new screen.
**How to avoid:** Extend GamePhaseSchema to include `'character_creation'`. Update App routing logic.
**Warning signs:** App component doesn't know how to render character creation; crashes on unknown phase.

## Code Examples

### Verified: Existing generateObject Pattern (v5)
```typescript
// Source: src/input/intent-classifier.ts (existing code)
const { object } = await generateObject({
  model,
  schema: IntentSchema,
  system: INTENT_SYSTEM_PROMPT,
  prompt: `Current scene: ${sceneContext}\nPlayer input: ${input}\nClassify the player's intent.`,
});
return object;
```

### Verified: Existing createStore Pattern
```typescript
// Source: src/state/create-store.ts (existing code)
export function createStore<T>(initialState: T, onChange?: OnChange<T>): Store<T> {
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
      return () => { listeners.delete(listener); };
    },
  };
}
```

### Verified: Existing Damage Calculation
```typescript
// Source: src/engine/damage.ts (existing code)
export function calculateDamage(params: DamageParams): DamageResult {
  const { weaponBase, attributeModifier, grade, armorReduction } = params;
  const gradeBonus = getGradeBonus(grade);
  const total = Math.max(0, weaponBase + attributeModifier + gradeBonus - armorReduction);
  // ...
}
```

### Recommended: NPC Dialogue Schema
```typescript
// Source: [CITED: AI-SPEC Section 4b.1]
import { z } from 'zod';

export const NpcDialogueSchema = z.object({
  dialogue: z.string().min(10).max(300).describe('NPC对白，自然口语'),
  emotionTag: z.enum(['neutral', 'happy', 'angry', 'sad', 'fearful', 'amused', 'suspicious']),
  shouldRemember: z.boolean().describe('是否将此次互动写入NPC长期记忆'),
  relationshipDelta: z.number().min(-0.5).max(0.5).describe('关系值变化建议'),
});
```

### Recommended: Retrieval Plan Schema
```typescript
// [ASSUMED -- based on AI-SPEC retrieval strategy description]
import { z } from 'zod';

export const RetrievalPlanSchema = z.object({
  codexIds: z.array(z.string()).max(3).describe('Codex entry IDs to retrieve'),
  npcIds: z.array(z.string()).max(2).describe('NPC IDs whose memories to fetch'),
  questIds: z.array(z.string()).max(1).describe('Active quest IDs for context'),
  reasoning: z.string().describe('Why these entries are relevant'),
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AI SDK v5 `generateObject` | AI SDK v6 `generateText` + `Output.object()` | v6.0.0 (2025+) | Project stays on v5; `generateObject` remains correct. Do NOT migrate. |
| Zod v3 | Zod v4 (^4.3.6) | 2025 | 2-7x faster parsing. AI SDK supports both `^3.25.76 || ^4.1.8`. Project uses v4. |
| Single model for all roles | Per-role model routing | Industry trend 2024+ | Cost and latency optimization. Fast models for online path, quality models for background. |

**Deprecated/outdated:**
- `experimental_generateObject` (AI SDK v4) -- replaced by `generateObject` in v5
- `Output.object` without `generateText` wrapper -- that's the v6 API; v5 uses `generateObject` directly

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Combat loop should be implemented as explicit state machine (init -> player_turn -> enemy_turn -> check_end) | Architecture Patterns / Pattern 5 | Low -- standard game design pattern; alternative would be event-driven but state machine is more predictable for turn-based |
| A2 | RetrievalPlanSchema fields (codexIds, npcIds, questIds, reasoning) | Code Examples | Medium -- schema design is Claude's discretion per CONTEXT.md; planner may adjust based on implementation needs |
| A3 | NPC memory seed structure should be JSON files per NPC keyed by NPC ID | Project Structure | Low -- CONTEXT.md gives Claude discretion on NPC memory data structure; JSON is consistent with project's file-based approach |
| A4 | Background hooks YAML needs a new `backgrounds.yaml` file | Project Structure | Low -- backgrounds could alternatively be embedded in professions.yaml or a creation-config file |
| A5 | Enemies need a separate `enemies.yaml` codex file | Project Structure | Medium -- enemies could be defined as NPC codex entries with additional combat stats, but a dedicated file is cleaner for Phase 2 combat |
| A6 | Promptfoo eval suite runs separately from bun test | Validation Architecture | Low -- standard practice; AI evals are slow and require API keys, shouldn't block unit tests |

## Open Questions (RESOLVED)

1. **API Key Configuration Strategy**
   - What we know: No API keys are currently set in the environment. AI-SPEC mandates Google Gemini as primary model.

   - RESOLVED: Mock provider for testing/dev. Real provider configurable via env vars. Tests always use mocks (mock.module pattern). Plan 01 providers.ts + Plan 04 tests implement this.

2. **Background Hook Data Design**
   - What we know: D-02 specifies 4 narrative questions. D-03 says choices imply attribute bias. D-05 says hooks write into world state.

   - RESOLVED: 3-4 options per question, each +1 to 1-2 attributes. Plan 02 creates backgrounds.yaml (7 entries). Plan 03 character-creation.ts implements attribute calculation.

3. **NPC Content Scale for Phase 2**
   - What we know: CONT-04 requires 10-15 named NPCs. Currently only 2 exist (guard, bartender).

   - RESOLVED: 12 NPCs (2 existing + 10 new) in Plan 02. 5-6 fully AI-dialogue-capable, rest background NPCs with inline responses. Plan 06 dialogue-manager handles mode detection.

4. **Scene Transition Mechanics**
   - What we know: Locations have exits linking to other locations. `/go <direction>` moves between them.

   - RESOLVED: Scene entry generates AI narration once. /look shows cached. /look <target> generates fresh. Plan 05 scene-manager.ts implements via loadScene() and handleLook(target?).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Runtime | YES | 1.3.12 | -- |
| Node.js | Promptfoo (uses Node internally) | YES | 24.14.0 | -- |
| @ai-sdk/google | Narrative Director, NPC Actor, Retrieval Planner | NOT INSTALLED | -- | Install required. Fallback: @ai-sdk/openai |
| @ai-sdk/anthropic | Background quest planning | NOT INSTALLED | -- | Install required. Not blocking for Phase 2 core. |
| @ai-sdk/alibaba | Chinese-optimized narration | NOT INSTALLED | -- | Install required. Fallback: Google Gemini |
| @ai-sdk/deepseek | Cost-effective Chinese generation | NOT INSTALLED | -- | Install required. Fallback: Alibaba Qwen |
| OPENAI_API_KEY | Intent classifier (existing) | NOT SET | -- | Mock provider for tests |
| GOOGLE_GENERATIVE_AI_KEY | Primary AI roles | NOT SET | -- | Mock provider for tests; must configure for real gameplay |
| promptfoo | AI eval suite | NOT INSTALLED | -- | Install as dev dependency |

**Missing dependencies with no fallback:**
- At least ONE AI provider API key must be set for the game to function (all AI roles need a real model). No pure-offline mode exists.

**Missing dependencies with fallback:**
- `@ai-sdk/google` can fall back to `@ai-sdk/openai` (already installed) for development, though Chinese output quality will degrade
- `@ai-sdk/alibaba` and `@ai-sdk/deepseek` are nice-to-have for Chinese optimization; Google Gemini handles Chinese adequately

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | bun test (built-in, Jest-compatible) |
| Config file | none -- bun test works out of the box |
| Quick run command | `bun test` |
| Full suite command | `bun test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAY-01 | Character creation flow: race/profession/background -> stats + equipment | unit + integration | `bun test src/engine/character-creation.test.ts -t "character creation"` | Wave 0 |
| PLAY-02 | Scene exploration: /look /inspect /scan return correct codex data | unit + integration | `bun test src/engine/scene-manager.test.ts` | Wave 0 |
| PLAY-03 | NPC dialogue: /talk triggers AI dialogue with personality | integration | `bun test src/ai/roles/npc-actor.test.ts` | Wave 0 |
| PLAY-04 | Combat: /attack /cast /guard /flee resolves deterministically | unit + integration | `bun test src/engine/combat-loop.test.ts` | Wave 0 |
| AI-01 | Narrative Director: 80-180 chars, no fact invention | unit (mock) + AI eval | `bun test src/ai/roles/narrative-director.test.ts` | Wave 0 |
| AI-02 | NPC Actor: personality-consistent dialogue | unit (mock) + AI eval | `bun test src/ai/roles/npc-actor.test.ts` | Wave 0 |
| AI-03 | Retrieval Planner: structured plan output | unit (mock) | `bun test src/ai/roles/retrieval-planner.test.ts` | Wave 0 |
| CONT-02 | Character data: 3-4 races, 3-4 professions, starting equipment | unit | `bun test src/codex/loader.test.ts` | Extend existing |
| CONT-04 | NPC content: 10-15 NPCs validate against schema | unit | `bun test src/codex/loader.test.ts` | Extend existing |

### AI Eval (separate from unit tests)
| Eval | Type | Command |
|------|------|---------|
| Narrative quality | LLM judge + code validators | `bun run test:ai-eval` (promptfoo) |
| NPC personality | LLM judge | `bun run test:ai-eval` (promptfoo) |
| World fact faithfulness | Code (codex cross-check) | `bun run test:ai-eval` (promptfoo) |

### Sampling Rate
- **Per task commit:** `bun test` (unit/integration, mocked AI)
- **Per wave merge:** `bun test` (full suite, ~200ms)
- **Phase gate:** Full unit suite green + AI eval suite green (with real API keys)

### Wave 0 Gaps
- [ ] `src/engine/character-creation.test.ts` -- covers PLAY-01, CONT-02
- [ ] `src/engine/scene-manager.test.ts` -- covers PLAY-02
- [ ] `src/engine/combat-loop.test.ts` -- covers PLAY-04
- [ ] `src/ai/roles/narrative-director.test.ts` -- covers AI-01 (mocked)
- [ ] `src/ai/roles/npc-actor.test.ts` -- covers AI-02, PLAY-03 (mocked)
- [ ] `src/ai/roles/retrieval-planner.test.ts` -- covers AI-03 (mocked)
- [ ] `tests/ai-eval/promptfoo.yaml` -- AI eval config
- [ ] `tests/ai-eval/datasets/` -- reference dataset (20 examples per AI-SPEC)
- [ ] AI provider mock utility for deterministic testing

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A (single-player CLI game, no user accounts) |
| V3 Session Management | No | N/A (no sessions, local state only) |
| V4 Access Control | No | N/A (single-player, no permissions model) |
| V5 Input Validation | Yes | Zod schema validation on all inputs (player commands, AI outputs, codex data). Existing pattern from Phase 1. |
| V6 Cryptography | No | N/A (no encryption needed for single-player game state) |

### Known Threat Patterns for AI-Driven CLI Game

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via NL input | Tampering | Player input sanitized before AI prompt injection. AI roles constrained by system prompt. AI cannot modify game state -- only Rules Engine can. |
| AI hallucinating world facts | Information Disclosure (internal) | Retrieval Planner limits context. Post-generation guardrails check for unknown entity references. |
| AI generating unsafe content | Information Disclosure | Safety Filter (AI-SPEC Section 6) checks all AI output before display. Fallback narration on filter trigger. |
| API key exposure | Information Disclosure | Keys in environment variables only, never in code or config files. .env files in .gitignore. |

## Project Constraints (from CLAUDE.md)

- **Immutability:** All state updates via immer produce(). Never mutate existing objects.
- **File organization:** Many small files (200-400 lines typical, 800 max).
- **Error handling:** Handle errors explicitly. AI failures must have fallback narration.
- **Input validation:** Zod schemas at all system boundaries (player input, AI output, codex data).
- **Functions < 50 lines, files < 800 lines, no nesting > 4 levels.**
- **Tech stack locked:** TypeScript + Bun + React/Ink + AI SDK v5 + Commander + Zod 4.
- **No vector DB:** RAG uses file-based keyword/tag search on YAML codex + JSON memory.
- **Chinese-first:** All player-facing text in Chinese.
- **Command prefix:** `/` (not `:`).
- **AI boundary:** AI writes prose and NPC dialogue. AI does NOT decide outcomes.
- **TDD not enforced:** `workflow.tdd_mode: false` in config, but tests still required for verification.
- **No co-author line:** Git commit attribution disabled per user's settings.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: all 54 TypeScript/TSX files + 9 YAML data files read and analyzed
- npm registry: version verification for ai, @ai-sdk/google, @ai-sdk/anthropic, @ai-sdk/alibaba, @ai-sdk/deepseek, promptfoo (2026-04-21)
- Context7 /vercel/ai: generateText, generateObject, streamText API patterns (v5 and v6 differentiation)
- Context7 /vadimdemedes/ink: Box, Text, useInput component API
- Phase 2 AI-SPEC (02-AI-SPEC.md): model configuration, evaluation strategy, guardrails, context window strategy
- Phase 2 UI-SPEC (02-UI-SPEC.md): component inventory, interaction patterns, copywriting contract
- Phase 1 CONTEXT.md: prior decisions on CLI layout, Rules Engine, state management

### Secondary (MEDIUM confidence)
- AI-SPEC domain context: AI Dungeon, NovelAI, Character.AI failure mode analysis (cited from domain research)

### Tertiary (LOW confidence)
- None -- all claims verified against codebase or official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified against npm registry and installed codebase
- Architecture: HIGH -- patterns derived from existing Phase 1 code + AI-SPEC + CLAUDE.md architecture spec
- Pitfalls: HIGH -- v5/v6 confusion verified via Context7; other pitfalls from AI-SPEC domain analysis and codebase inspection
- Content requirements: MEDIUM -- CONT-02 and CONT-04 require significant content authoring; scope depends on quality bar

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (30 days -- stable stack, no fast-moving dependencies)
