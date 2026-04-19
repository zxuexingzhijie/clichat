# Architecture Patterns

**Domain:** AI-driven CLI interactive novel game (text RPG)
**Researched:** 2026-04-20
**Confidence:** HIGH (grounded in Claude Code reference source, Ink docs, product design doc)

## Recommended Architecture

Chronicle is a **turn-based pipeline architecture** with strict separation between deterministic game logic and LLM generation. The system borrows three core patterns from Claude Code: (1) Skills as scoped prompt templates with declared tool permissions, (2) a lightweight immutable store for state management, and (3) React + Ink for terminal rendering with fullscreen layout.

The architecture is NOT a chatbot loop. It is a **six-stage pipeline** where each stage has clear inputs, outputs, and boundaries. LLMs participate in exactly two stages (retrieval planning and narrative generation) and are forbidden from the adjudication stage.

```
Player Input
    |
    v
[1. Input Parser] -------> Command or Intent
    |
    v
[2. Retrieval Planner] --> Retrieval Plan (what codex/memory to fetch)
    |
    v
[3. Rules Engine] -------> Adjudicated Result (deterministic)
    |
    v
[4. Narrative Director] -> Prose + NPC dialogue
    |
    v
[5. State Mutator] ------> New immutable GameState snapshot
    |
    v
[6. Renderer] -----------> Terminal UI update
```

### Component Boundaries

| Component | Responsibility | Communicates With | LLM Access |
|-----------|---------------|-------------------|------------|
| **InputParser** | Parse `:commands` and classify NL intent | Renderer (receives input), RetrievalPlanner (sends parsed intent) | Light (intent classification only) |
| **RetrievalPlanner** | Decide what codex entries, NPC memories, quest states to fetch for this turn | InputParser (receives intent), CodexStore + MemoryStore (reads), RulesEngine (provides context) | Yes (fast cheap model) |
| **RulesEngine** | Adjudicate outcomes: success/fail, resource deltas, relationship changes, turn type transitions | RetrievalPlanner (receives context), StateMutator (sends deltas) | **None -- deterministic only** |
| **NarrativeDirector** | Generate prose narration and NPC dialogue from adjudicated results | RulesEngine (receives adjudication), RetrievalPlanner (receives retrieved context), Renderer (sends prose) | Yes (fast balanced model) |
| **StateMutator** | Apply adjudicated deltas to produce new immutable GameState | RulesEngine (receives deltas), GameStateStore (writes new snapshot) | None |
| **Renderer** | React + Ink fullscreen terminal UI | StateMutator (subscribes to state), NarrativeDirector (receives prose), InputParser (sends raw input) | None |
| **SkillRegistry** | Load, activate, and invoke AI Skills per context | NarrativeDirector + RetrievalPlanner (provides skill prompts), CodexStore (provides retrieval tools) | Orchestrates LLM calls |
| **CodexStore** | Read-only world lore: races, locations, factions, spells, items (YAML files) | RetrievalPlanner (queried), NarrativeDirector (provides context) | None (retrieval target) |
| **MemoryStore** | Per-NPC episodic memory, player knowledge journal (JSON files) | RetrievalPlanner (queried), NPC Skills (read/write flags) | None (retrieval target) |
| **SaveManager** | Snapshot, branch, compare, restore game state | GameStateStore (reads/writes snapshots), Renderer (branch UI) | None |
| **LLMRouter** | Route AI requests to appropriate model based on role and latency requirements | SkillRegistry (receives requests), external APIs (sends requests) | Routes to providers |

### Data Flow

**Turn Processing Pipeline (detailed):**

```
1. Player types input in Renderer (React + Ink TextInput component)
      |
2. InputParser receives raw string
   - If starts with `:` -> command parse (Commander.js pattern matching)
   - If natural language -> intent classification (fast LLM call)
   - Output: { type: 'command'|'intent', action, target, modifiers }
      |
3. RetrievalPlanner Skill activates
   - Input: parsed intent + current scene + active NPCs + active quests
   - LLM decides which codex entries and memories to fetch
   - CodexStore.query(tags) -> relevant YAML entries
   - MemoryStore.query(npcId, topic) -> relevant memory notes
   - Output: RetrievalBundle { codexEntries[], memories[], questStates[] }
      |
4. RulesEngine.adjudicate(parsedIntent, retrievalBundle, currentState)
   - Pure function, NO side effects, NO LLM
   - Evaluates: skill checks, resource costs, relationship thresholds
   - Considers: turn type (scene/conflict/journey), active conditions
   - Output: AdjudicationResult {
       outcome: 'success'|'partial'|'failure',
       stateDeltas: { hp: -5, reputation: { guard: -2 }, ... },
       narrativeHints: ['guard_suspicious', 'rain_advantage'],
       memoryFlags: [{ npcId: 'guard_01', event: 'player_lied' }],
       turnTypeTransition?: 'conflict'
     }
      |
5. NarrativeDirector Skill activates
   - Input: adjudication result + retrieval bundle + narrative style
   - NPC Actor sub-skill activates if dialogue needed
   - Output: NarrativeOutput {
       prose: string (80-180 chars Chinese),
       npcDialogue?: { speaker, text, emotionTag },
       suggestedActions: string[] (max 3),
       newPlayerKnowledge?: string[]
     }
      |
6. StateMutator.apply(currentState, adjudication.stateDeltas)
   - Creates NEW immutable GameState (never mutates)
   - Writes memory flags to MemoryStore
   - Updates player knowledge in MemoryStore
   - Output: new GameState snapshot
      |
7. Renderer re-renders from new GameState + NarrativeOutput
   - Scene panel updates with prose
   - Status bar updates with new HP/MP/reputation
   - Suggested actions panel refreshes
   - Input area reactivates for next turn
```

**Background Pipeline (async, non-blocking):**

```
After every N turns or chapter boundary:
  Summarizer Skill -> compress recent turns into chapter summary
  -> write to MemoryStore as semantic summary
  -> prune raw turn history from session context

Quest/Plot Planner Skill (triggered by story events):
  -> generate side quest hooks based on current world state
  -> write to QuestTemplateStore for future activation
```

## Core Data Structures

### GameState (immutable, the single source of truth)

```typescript
type GameState = {
  readonly meta: {
    readonly saveId: string
    readonly branchId: string
    readonly turnNumber: number
    readonly realTimeElapsed: number
  }

  readonly player: {
    readonly id: string
    readonly name: string
    readonly species: SpeciesId
    readonly profession: ProfessionId
    readonly stats: Readonly<Record<StatKey, number>>
    readonly resources: { readonly hp: number; readonly mp: number; readonly gold: number }
    readonly inventory: readonly ItemInstance[]
    readonly activeEffects: readonly Effect[]
    readonly knownFacts: readonly FactId[]  // epistemic layer: what player knows
  }

  readonly world: {
    readonly currentLocation: LocationId
    readonly currentScene: SceneState
    readonly turnType: 'scene' | 'conflict' | 'journey'
    readonly timeOfDay: TimeOfDay
    readonly dayCount: number
    readonly weather: WeatherCondition
    readonly activeQuests: readonly QuestInstance[]
    readonly completedQuests: readonly QuestId[]
    readonly globalFlags: Readonly<Record<string, boolean | number | string>>
  }

  readonly relationships: Readonly<Record<NpcId, {
    readonly reputation: number
    readonly stance: 'hostile' | 'wary' | 'neutral' | 'friendly' | 'allied'
    readonly debts: readonly Debt[]
    readonly lastInteraction: number  // turn number
  }>>

  readonly factions: Readonly<Record<FactionId, {
    readonly standing: number
    readonly rank?: string
  }>>

  readonly session: {
    readonly recentTurns: readonly TurnRecord[]  // last N for LLM context window
    readonly narrativeStyle: NarrativeStyle
  }
}
```

### Save Snapshot (for branch system)

```typescript
type SaveSnapshot = {
  readonly id: string
  readonly parentId: string | null  // null = root save
  readonly branchName: string
  readonly label: string  // player annotation
  readonly timestamp: number
  readonly turnNumber: number
  readonly state: GameState
  readonly turnHistory: readonly TurnRecord[]  // full history for replay
}

type SaveTree = {
  readonly root: SaveSnapshot
  readonly branches: Readonly<Record<string, SaveSnapshot[]>>
  readonly current: string  // active branch + save id
}
```

## Patterns to Follow

### Pattern 1: Immutable State with Functional Updaters (from Claude Code store.ts)

**What:** All state transitions produce new objects. Never mutate GameState in place.

**Why:** Enables save/branch system (snapshots are just references), prevents hidden side effects, makes time-travel debugging possible, and aligns with React's rendering model.

**Example:**
```typescript
import { createStore, type Store } from './store'

type GameStateStore = Store<GameState>

function applyDeltas(state: GameState, deltas: StateDeltas): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      resources: {
        ...state.player.resources,
        hp: state.player.resources.hp + (deltas.hp ?? 0),
        mp: state.player.resources.mp + (deltas.mp ?? 0),
      },
    },
    world: {
      ...state.world,
      turnType: deltas.turnTypeTransition ?? state.world.turnType,
    },
  }
}

gameStore.setState(prev => applyDeltas(prev, adjudication.stateDeltas))
```

### Pattern 2: Skills as Scoped Prompt Templates (from Claude Code bundledSkills.ts)

**What:** Each AI role (Narrative Director, NPC Actor, Retrieval Planner, etc.) is a "Skill" -- a prompt template with declared tool permissions and model assignment.

**Why:** Clean separation of concerns. Each skill has explicit boundaries on what it can read, what it can write, and which model it uses. Skills are testable in isolation.

**Example:**
```typescript
type GameSkillDefinition = {
  name: string
  description: string
  allowedTools: string[]
  disallowedTools?: string[]
  model: ModelTier
  activationCondition?: (state: GameState) => boolean
  getPrompt: (context: SkillContext) => PromptTemplate
}

const npcActorSkill: GameSkillDefinition = {
  name: 'npc-actor',
  description: 'Generate NPC dialogue and behavior',
  allowedTools: ['codex:read', 'memory:read-npc'],
  model: 'fast-balanced',
  activationCondition: (state) => state.world.currentScene.npcsPresent.length > 0,
  getPrompt: (ctx) => ({
    system: `You play ONE NPC. Only use information this NPC would know.`,
    variables: {
      npcIdentity: ctx.npc.identity,
      npcGoals: ctx.npc.goals,
      npcMemories: ctx.retrievedMemories,
      playerAction: ctx.playerAction,
      currentScene: ctx.sceneDescription,
    },
    outputSchema: {
      dialogue: 'string',
      emotionTag: 'string',
      shouldRemember: 'boolean',
      relationshipDeltaSuggestion: 'number',
    },
  }),
}
```

### Pattern 3: Tool-Based Retrieval (from Claude Code tool architecture)

**What:** Retrieval from codex and memory happens through explicit tool calls, not by dumping everything into context. The Retrieval Planner skill decides what to fetch.

**Why:** Keeps context window small, makes retrieval observable and debuggable, prevents context leakage between epistemic layers (world truth vs. NPC belief vs. player knowledge).

### Pattern 4: Epistemic Layer Tagging

**What:** Every piece of retrieved information carries a tag indicating its epistemic status: `world_truth`, `npc_belief`, or `player_knowledge`.

**Why:** Prevents NPCs from being omniscient. Enables investigation gameplay where truth and belief diverge. The Retrieval Planner filters by layer based on who is "consuming" the information.

```typescript
type EpistemicTag = 'world_truth' | 'npc_belief' | 'player_knowledge'

type TaggedEntry = {
  content: string
  epistemicTag: EpistemicTag
  sourceId: string
  visibleTo: string[]
}

function filterForNpc(entries: TaggedEntry[], npcId: string): TaggedEntry[] {
  return entries.filter(e =>
    e.epistemicTag === 'world_truth' && e.visibleTo.includes(npcId)
    || e.epistemicTag === 'npc_belief' && e.sourceId.startsWith(npcId)
  )
}
```

### Pattern 5: React + Ink Panel Layout with Fullscreen

**What:** The terminal UI uses `fullscreen-ink` for alternate screen buffer management and organizes the display into four fixed regions: Scene Panel, Status Bar, Suggested Actions, Input Area.

**Why:** Fullscreen Ink handles terminal resize, alternate screen buffer (like vim), and responsive dimensions. Box + flexbox give us the panel layout from the design doc mockups. React's declarative model means state changes automatically re-render the correct panels.

## Anti-Patterns to Avoid

### Anti-Pattern 1: LLM Adjudication

**What:** Letting the LLM decide whether actions succeed, resources are consumed, or relationships change.

**Why bad:** Destroys consistency. The LLM will sometimes say the player succeeded when they should have failed, or invent resources, or forget debts. The world stops feeling real. This is the single most common failure mode in AI game projects.

**Instead:** RulesEngine is a pure TypeScript module with zero LLM access. It takes parsed intent + current state + codex data and outputs deterministic results. The LLM only describes what happened, never decides what happened.

### Anti-Pattern 2: Context Window as Memory

**What:** Keeping all conversation history in the LLM context window as the "memory" system.

**Why bad:** Context windows are expensive, have hard limits, and models degrade on long contexts (lost-in-the-middle problem). After 50 turns, you will either exceed context limits or blow your cost budget.

**Instead:** Session context holds only the current scene + last N turns. Everything else goes into structured memory (codex YAML, NPC memory JSON, chapter summaries). The Retrieval Planner pulls in only what is needed per turn.

### Anti-Pattern 3: Global Mutable State

**What:** A single mutable game state object that gets modified in place throughout the turn pipeline.

**Why bad:** Breaks save/branch (cannot cheaply snapshot), creates race conditions with async LLM calls, makes debugging extremely difficult, violates React's rendering expectations.

**Instead:** Immutable state with functional updaters. Each state transition creates a new object. Saves are just references to past state objects.

### Anti-Pattern 4: Monolithic Prompt

**What:** One giant system prompt that tries to handle narration, NPC behavior, retrieval planning, and safety all at once.

**Why bad:** Prompt conflicts (narrator style fights NPC voice), impossible to test individual behaviors, model confusion on complex multi-role instructions, cannot route different roles to different models.

**Instead:** Skills pattern. Each AI role has its own prompt template, its own allowed tools, and its own model assignment.

### Anti-Pattern 5: Synchronous Full Pipeline

**What:** Waiting for every step to complete before showing anything to the player.

**Why bad:** LLM latency is 500ms-3s per call. If you have retrieval planning + narrative generation + NPC dialogue, the player waits 2-9 seconds with zero feedback.

**Instead:** Stream narrative output to the Renderer as it generates. Show the adjudication result (HP changes, etc.) immediately while narrative streams in.

## Save/Branch System Architecture

The save system uses a tree structure modeled after git, stored as JSON files on disk.

```
saves/
  tree.json          # SaveTree metadata (branches, current pointer)
  snapshots/
    <save-id>.json   # Full GameState snapshot
  history/
    <save-id>.jsonl   # Turn history for replay (append-only lines)
```

**Operations:**

| Operation | What Happens |
|-----------|-------------|
| `:save "label"` | Serialize current GameState to new snapshot, append to current branch |
| `:branch name` | Copy current snapshot, create new branch entry in tree.json |
| `:compare a..b` | Load two snapshots, diff key fields, present human-readable summary |
| `:replay N` | Read last N entries from turn history JSONL, render as condensed log |
| `:restore id` | Load snapshot, set as current state, continue from that point |

## Scalability Considerations

| Concern | MVP (1 region) | V1 (3-5 regions) | V2+ (open world packs) |
|---------|---------------|-------------------|----------------------|
| Codex size | ~50-100 YAML files, in-memory index | ~500 files, still in-memory | Consider SQLite index over YAML files |
| Memory store | JSON files, read on demand | JSON files with LRU cache | Consider SQLite for NPC memories |
| Save snapshots | JSON files, ~50KB each | Same, with compression | Same, consider delta-based snapshots |
| LLM calls per turn | 2-3 (intent + retrieval + narrative) | Same | Same, add parallel NPC calls for multi-NPC scenes |
| Turn latency target | <3s total | <3s total | <3s with streaming start <1s |

## Sources

- Claude Code source (local reference: `claude-code-main/src/`) -- skills system, store pattern, Ink architecture. **HIGH confidence.**
- Ink documentation (Context7: `/vadimdemedes/ink`) -- Box, Text, useInput, flexbox layout. **HIGH confidence.**
- Fullscreen Ink documentation (Context7: `/daniguardiola/fullscreen-ink`) -- alternate screen, useScreenSize, responsive layout. **HIGH confidence.**
- Ink UI documentation (Context7: `/vadimdemedes/ink-ui`) -- TextInput, Alert, Spinner components. **HIGH confidence.**
- Product design document (`deep-research-report (1).md`) -- game loop, AI roles, content structure, save system UX. **HIGH confidence.**
