# Phase 4: Differentiation - Research

**Researched:** 2026-04-22
**Domain:** Story branching, ASCII map, codex browser, keyboard shortcuts, epistemic separation
**Confidence:** HIGH

## Summary

Phase 4 introduces Chronicle's five differentiating features: (1) git-style story branching with branch registry, tree visualization, and diff comparison, (2) ASCII region map with five-level exploration tracking, (3) codex browser with epistemic visibility filtering, (4) keyboard shortcuts with Tab completion and panel-switching hotkeys, and (5) NPC cognitive boundary enforcement via a Context Assembler upgrade. These features span new stores (BranchStore, ExplorationStore, PlayerKnowledgeStore), schema extensions (LocationSchema spatial data, SaveDataV3 with branchId), 5 new UI panels, 6+ new commands, and a refactored context assembly pipeline.

The codebase from Phases 1-3 provides strong foundations: the `createStore` + immer pattern, mitt event bus, Commander-based command registry, adaptive layout system (wide >= 100 / narrow), and the existing `EpistemicMetadataSchema` with `known_by`, `visibility`, `authority`, and `truth_status` fields. The main technical risks are: (a) SaveDataV2 -> V3 migration with branch metadata while maintaining backward compatibility, (b) the context-assembler rewrite to enforce six-dimensional NPC knowledge filtering without breaking existing dialogue, and (c) location schema extension requiring coordinated data + code + test changes.

**Primary recommendation:** Build in dependency order: schemas/stores first, then branching engine (extends save infra), then map/codex/shortcuts (UI-heavy, parallelizable), and epistemic separation last (cross-cutting, touches AI layer).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (Branch Model):** Branch Registry + Save Snapshot hybrid. `branches.json` for branch metadata (branchId, name, HEAD save, parent branch, creation time, description). Each save snapshot includes `branchId` and `parentSaveId` in meta. `/branch` creates new branch record + initial snapshot from current GameState.
- **D-02 (Timeline Isolation):** NPC memory bound to `branchId`/`saveId`/`turn`. Only load current branch + ancestor memories before fork point. Copy-on-Write strategy. Isolation scope: NPC memory, NPC emotions, faction reputation, AI-retrievable history, player-discovered truths.
- **D-03 (Branch Tree Visualization):** `/branch tree` uses state-enhanced ASCII tree + Ink rendering. Git-style ASCII tree for structure, Ink for highlighting current branch/HEAD/selection. Nodes show save name, game time, location, key quest stage. Detail view: plot summary, NPC memory changes, relationship changes, branch source.
- **D-04 (Branch Compare):** `/compare` progressive comparison. Summary layer (diff count + key consequences), then structured git-style diff by category (`+`/`-`/`~`/`!`). Wide terminal: side-by-side toggle. Impact levels per diff item. Narrative impact summary. Categories: quest progress, NPC relations/memory, inventory, location, faction reputation, discovered truths.
- **D-05 (Map Data Model):** Hybrid topology+coordinate model. Exits define direction + target location_id. Optional x/y coordinates per location. Optional hand-drawn ASCII map templates.
- **D-06 (Map Visual Style):** Layered ASCII map with compact icon nodes (`[H]` town, `[T]` temple, etc.). Current location highlighted. Unexplored = `?` or dimmed. Quest locations = `!`. Bottom detail panel: type, danger, status, exits, related quests.
- **D-07 (Exploration Tracking):** Five-level discovery: `unknown` -> `rumored` -> `known` -> `visited` -> `surveyed`. Map rendering varies by state. POIs tracked independently; `surveyed` only after major POIs resolved. Records: discovery source, turn, credibility, description.
- **D-08 (Codex Layout):** Search-first adaptive browse. Wide: two-column (left search+list, right detail). Narrow: single-column list, detail on Enter. Entry detail: title, type, authority, visibility, source, confidence, summary, related entities.
- **D-09 (Discovery & Reveal):** Visibility-based: `public`/`discovered` = full; `hidden`/`secret` = `???` placeholder (hint existence); `forbidden` = completely hidden until unlocked.
- **D-10 (Shortcut Design):** Progressive shortcuts. Core: Tab completion, Up/Down history, Ctrl-R search, `?` help, Esc cancel. Extended: number keys for actions, Alt-1~9, single-key panel switches (`m`/`j`/`c`/`i`/`b`) only in non-input mode. No Ctrl-S/Ctrl-M bindings.
- **D-11 (NPC Cognitive Boundary):** Context Assembler enforces NPC Knowledge Access Policy via six-dimension filter: codex `known_by` whitelist, NPC identity/faction/profession inference, regional common knowledge, NPC personal memory, current scene visible facts, entry authority/visibility/truth_status filter.
- **D-12 (Cognitive Context Envelope):** Five context categories: `world_truth`, `npc_belief`, `player_knowledge`, `scene_visible`, `npc_memory`. NPC Actor: no `world_truth`, only own `npc_belief`/`npc_memory`/`scene_visible`. Narrative Director: reads `world_truth` but output bounded by `player_knowledge`. Codex Browser: only `public`/`discovered`/`hinted`.
- **D-13 (Player Knowledge Management):** PlayerKnowledgeStore auto-tracks player discoveries. Records: source, turn, credibility, linked codex entry, knowledge status (`heard`/`suspected`/`confirmed`/`contradicted`). `/journal` shows investigation cognition per quest. `/codex` shows known facts with source attribution. Narrative Director bounded by `player_knowledge`.

### Claude's Discretion
- branches.json field naming and storage format
- ASCII map auto-layout algorithm (topology -> coordinate mapping)
- Map icon symbol choices
- Codex search matching algorithm (fuzzy/pinyin/tag weight)
- Tab completion implementation approach
- NPC Knowledge Access Policy dimension priorities and conflict resolution
- Cognitive Context Envelope prompt template details
- PlayerKnowledgeStore Zod schema field design

### Deferred Ideas (OUT OF SCOPE)
- Reputation chain propagation (Phase 5)
- LLM memory compression (Phase 5)
- Rumor spreading system (Phase 5)
- Law enforcement pursuit (Phase 5)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SAVE-02 | Player can branch storylines (`/branch name`) with branch tree visualization | D-01 BranchStore + D-03 BranchTreePanel. Extends SaveDataV2 -> V3 with branchId/parentSaveId. Branch registry in branches.json. |
| SAVE-03 | Player can compare branches showing state differences as human-readable summary | D-04 ComparePanel. Diff engine compares two SaveDataV3 snapshots across 6 dimensions. Structured diff output with impact levels. |
| SAVE-04 | Player can replay recent turns by reading stored turn log | Turn log storage in save data. Read-only replay from serialized turn events -- no AI re-generation. |
| CLI-02 | ASCII/Unicode region map via `/map` showing current location, explored areas, POIs | D-05/D-06/D-07 ExplorationStore + MapPanel. LocationSchema extended with spatial exits + optional coordinates. |
| CLI-03 | World codex browser via `/codex` with search/filter | D-08/D-09 CodexPanel. Reuses existing `codex/query.ts` functions. Adds visibility filtering via PlayerKnowledgeStore + EpistemicMetadata. |
| CLI-04 | Keyboard shortcuts: Tab completion, arrow history, Ctrl-R search, `?` help | D-10 ShortcutHelpPanel + input hook upgrades. Tab completion candidates from command registry + NPC names + directions. |
| LLM-04 | Retrieved context tagged with epistemic level; NPCs only receive character-appropriate info | D-11/D-12/D-13 Context Assembler rewrite. Cognitive Context Envelope wraps all retrieval results. NPC Actor prompt receives only filtered context. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Branch registry & save management | State / Persistence | -- | Branch metadata and save snapshots are persistence-layer concerns |
| Branch tree visualization | Frontend (Ink UI) | State (BranchStore) | UI renders tree from store data |
| Branch comparison / diff | Engine (pure functions) | Frontend (ComparePanel) | Diff computation is logic; rendering is UI |
| ASCII map rendering | Frontend (Ink UI) | State (ExplorationStore) | Layout algorithm + Ink rendering from exploration state |
| Exploration tracking | State (ExplorationStore) | Engine (event listeners) | Store tracks discovery state; scene-manager emits discovery events |
| Codex browsing | Frontend (Ink UI) | State (PlayerKnowledgeStore) | UI filters codex entries by player knowledge state |
| Keyboard shortcuts | Frontend (Ink useInput) | -- | Terminal input handling is purely client-side |
| Tab completion | Frontend (Ink UI) | Engine (command-registry) | UI captures Tab key, engine provides completion candidates |
| NPC cognitive boundary (LLM-04) | Engine (context-assembler) | AI (prompt layer) | Context Assembler filters before prompt construction; AI never sees unauthorized data |
| Player knowledge tracking | State (PlayerKnowledgeStore) | Engine (event listeners) | Store holds knowledge entries; game events trigger knowledge acquisition |
| Turn log for replay | State / Persistence | -- | Append-only event log in save data |

## Standard Stack

### Core (already installed, no new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bun | 1.3.12 | Runtime + test runner | Already in use. [VERIFIED: package.json + bun --version] |
| TypeScript | ^6.0 | Language | Already in use. [VERIFIED: package.json peerDependencies] |
| React | 19.2.5 | UI framework | Already installed. [VERIFIED: node_modules/react/package.json] |
| ink | 7.0.1 | Terminal renderer | Already installed. All 5 new panels use Box/Text/useInput. [VERIFIED: node_modules/ink/package.json] |
| @inkjs/ui | 2.0.0 | TextInput for codex search | Already installed. CodexPanel search uses TextInput. [VERIFIED: package.json] |
| zod | 4.3.6 | Schema validation | All new schemas (BranchMeta, ExplorationState, PlayerKnowledge, SaveDataV3). [VERIFIED: node_modules/zod/package.json] |
| immer | 11.1.4 | Immutable state updates | Via createStore pattern. All new stores follow same pattern. [VERIFIED: package.json] |
| mitt | 3.0.1 | Event bus | New events: branch_created, branch_switched, knowledge_discovered, location_explored. [VERIFIED: package.json] |
| nanoid | 5.1.9 | ID generation | Branch IDs, knowledge entry IDs. [VERIFIED: package.json] |
| string-width | 8.2.0 | CJK display width | Critical for map grid alignment and codex list layout. [VERIFIED: package.json] |
| commander | 14.0.3 | Command routing | New commands: /branch, /compare, /map, /codex, /replay. [VERIFIED: package.json] |
| fullscreen-ink | 0.1.0 | useScreenSize hook | Used by all panels for adaptive layout. [VERIFIED: package.json] |
| yaml | 2.8.3 | Dynamic YAML read/write | Location data extension (spatial exits). [VERIFIED: package.json] |

### No New Dependencies Required

Phase 4 builds entirely on the existing stack. No new npm packages needed. [VERIFIED: UI-SPEC checker confirms this]

## Architecture Patterns

### System Architecture Diagram

```
Player Input ("/branch rescue", "/map", "/codex", "m", "?")
      │
      ▼
┌─────────────┐     ┌──────────────────┐
│ InputRouter  │────▶│ CommandRegistry   │  new commands: /branch, /compare, /map, /codex, /replay
│ + useInput   │     │ (Commander.js)    │
│ (shortcuts)  │     └────────┬─────────┘
└──────┬──────┘              │
       │                     ▼
       │              ┌──────────────┐
       │              │  Game Loop   │  routes to subsystem
       │              └──────┬───────┘
       │                     │
       ├─────────────────────┼─────────────────────┐
       │                     │                      │
       ▼                     ▼                      ▼
┌─────────────┐   ┌──────────────────┐   ┌──────────────────────┐
│ BranchEngine│   │  SceneManager    │   │  Context Assembler   │
│ - create    │   │  + ExplorationTracker  │  (Cognitive Envelope) │
│ - switch    │   │  (triggers location   │  - NPC Knowledge Filter│
│ - compare   │   │   discovery events)   │  - Epistemic Tags     │
│ - tree      │   └──────────────────┘   └──────────┬───────────┘
└──────┬──────┘                                     │
       │                                            ▼
       ▼                                   ┌──────────────────┐
┌──────────────┐                           │  NPC Actor       │
│ SaveFileManager                          │  (filtered context│
│ (branch-aware) │                         │   only)           │
│ + branches.json│                         └──────────────────┘
└──────┬─────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│                        Stores                             │
│  BranchStore    ExplorationStore    PlayerKnowledgeStore  │
│  (new)          (new)               (new)                 │
│  + existing: player, scene, quest, relation, npcMemory   │
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│                      UI Layer (Ink)                       │
│  BranchTreePanel  ComparePanel  MapPanel  CodexPanel     │
│  ShortcutHelpPanel  (all replace scene panel slot)       │
└──────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (new files)

```
src/
├── state/
│   ├── branch-store.ts           # BranchStore (branch registry metadata)
│   ├── exploration-store.ts      # ExplorationStore (5-level discovery per location)
│   └── player-knowledge-store.ts # PlayerKnowledgeStore (D-13 knowledge tracking)
├── persistence/
│   ├── branch-manager.ts         # Branch CRUD, branch-aware save/load, branches.json I/O
│   └── save-migrator.ts          # Updated: V2 -> V3 migration
├── engine/
│   ├── branch-diff.ts            # Pure function: compare two snapshots, produce structured diff
│   ├── exploration-tracker.ts    # Listens to scene_changed, updates ExplorationStore
│   └── knowledge-tracker.ts      # Listens to dialogue/quest/scene events, updates PlayerKnowledgeStore
├── ai/
│   └── utils/
│       ├── context-assembler.ts  # REWRITE: add Cognitive Context Envelope + NPC Knowledge Filter
│       ├── npc-knowledge-filter.ts # 6-dimension NPC knowledge access policy
│       └── epistemic-tagger.ts   # Tags context chunks with epistemic level
├── ui/
│   ├── panels/
│   │   ├── branch-tree-panel.tsx # D-03 branch tree visualization
│   │   ├── compare-panel.tsx     # D-04 branch comparison view
│   │   ├── map-panel.tsx         # D-06 ASCII map rendering
│   │   ├── codex-panel.tsx       # D-08 codex browser
│   │   └── shortcut-help-panel.tsx # Shortcut reference overlay
│   ├── components/
│   │   ├── diff-line.tsx         # Styled diff line (+/-/~/!)
│   │   ├── map-node.tsx          # Single map location node
│   │   ├── category-tabs.tsx     # Horizontal category tab bar
│   │   └── inline-confirm.tsx    # Destructive action confirmation
│   └── hooks/
│       ├── use-game-input.ts     # EXTEND: add panel shortcuts, non-input mode detection
│       └── use-tab-completion.ts # New: Tab completion logic
├── input/
│   └── command-registry.ts       # EXTEND: /branch, /compare, /map, /codex, /replay commands
├── codex/
│   └── schemas/
│       └── entry-types.ts        # EXTEND: LocationSchema with spatial exits + coordinates
├── data/
│   └── codex/
│       └── locations.yaml        # EXTEND: add direction+target exits, optional coordinates
└── types/
    └── game-action.ts            # EXTEND: new action types (branch, compare, map, codex, replay)
```

### Pattern 1: Panel Slot Replacement (Established)

**What:** New panels (map, codex, branch tree, compare, shortcut help) replace the scene panel slot, following the same pattern as JournalPanel.

**When to use:** Every new full-screen panel in Phase 4.

**Example:**
```typescript
// Source: game-screen.tsx existing pattern (JournalPanel)
const isInJournal = gameState.phase === 'journal';
const isInMap = gameState.phase === 'map';
const isInCodex = gameState.phase === 'codex';
const isInBranchTree = gameState.phase === 'branch_tree';
const isInCompare = gameState.phase === 'compare';

const scenePanelNode = isInCombat
  ? combatSceneContent
  : isInDialogueMode
    ? <DialoguePanel ... />
    : isInJournal
      ? <JournalPanel ... />
      : isInMap
        ? <MapPanel ... />
        : isInCodex
          ? <CodexPanel ... />
          : isInBranchTree
            ? <BranchTreePanel ... />
            : isInCompare
              ? <ComparePanel ... />
              : <ScenePanel lines={sceneLines} />;
```
[VERIFIED: src/ui/screens/game-screen.tsx lines 203-229 show exact pattern]

### Pattern 2: Store Creation (Established)

**What:** All new stores use `createStore<T>(initialState, onChange)` with immer produce.

**When to use:** BranchStore, ExplorationStore, PlayerKnowledgeStore.

**Example:**
```typescript
// Source: established pattern in src/state/create-store.ts
import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';

export const explorationStore = createStore<ExplorationState>(
  getDefaultExplorationState(),
  ({ newState, oldState }) => {
    // Emit events on meaningful changes
    for (const locId of Object.keys(newState.locations)) {
      const newLevel = newState.locations[locId]?.level;
      const oldLevel = oldState.locations[locId]?.level;
      if (newLevel !== oldLevel) {
        eventBus.emit('location_explored', { locationId: locId, newLevel });
      }
    }
  },
);
```
[VERIFIED: src/state/quest-store.ts, relation-store.ts, npc-memory-store.ts all follow this pattern]

### Pattern 3: Command Registration (Established)

**What:** New commands registered via Commander.js in `command-registry.ts`, dispatched through `GameAction` type.

**When to use:** `/branch`, `/compare`, `/map`, `/codex`, `/replay` commands.

**Example:**
```typescript
// Source: src/input/command-registry.ts
program
  .command('branch')
  .argument('[action]', 'create|switch|tree|delete')
  .argument('[name]', 'branch name')
  .action((action?: string, name?: string) => {
    setResult({
      type: 'branch',
      target: action ?? 'tree',
      modifiers: name ? { name } : {},
      source: 'command',
    });
  });
```
[VERIFIED: src/input/command-registry.ts shows exact Commander pattern]

### Pattern 4: Adaptive Layout (Established)

**What:** Wide (>= 100 cols) shows side-by-side; narrow shows stacked.

**When to use:** All new panels (map, codex, branch tree, compare).

**Example:**
```typescript
// Source: src/ui/components/adaptive-layout.tsx
// Width >= 100: two-column layout
// Width < 100: single-column stacked
```
[VERIFIED: src/ui/components/adaptive-layout.tsx + game-screen.tsx lines 231-267]

### Pattern 5: Event-Driven State Updates (Established)

**What:** Domain events trigger cross-system state updates without direct coupling.

**When to use:** Exploration tracking (scene_changed -> ExplorationStore), knowledge discovery (dialogue_ended/quest events -> PlayerKnowledgeStore), branch lifecycle (branch_created/switched events).

```typescript
// Source: established pattern in src/persistence/memory-persistence.ts
eventBus.on('scene_changed', ({ sceneId }) => {
  explorationTracker.markVisited(sceneId);
});
```
[VERIFIED: memory-persistence.ts, npc-memory-store.ts, quest-store.ts all use this pattern]

### Anti-Patterns to Avoid

- **Direct store coupling:** Don't import BranchStore directly in UI components. Pass data via props from GameScreen (established pattern). [VERIFIED: game-screen.tsx passes state as props]
- **AI deciding game state:** Context Assembler provides information to AI; AI generates prose/dialogue. AI does NOT modify branch state, exploration state, or knowledge state. Only Rules Engine and event listeners do. [VERIFIED: CLAUDE.md architecture boundary]
- **Mixing epistemic levels in prompts:** Never pass `world_truth` to NPC Actor. The Context Assembler MUST filter before prompt construction, not rely on prompt instructions alone. [VERIFIED: CLAUDE.md "Truth vs. Cognition Separation"]
- **Mutating existing save format:** Don't modify SaveDataV2 in place. Create SaveDataV3 with migration path. [VERIFIED: src/persistence/save-migrator.ts exists for V1->V2]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CJK string width | Character-by-character width counting | `string-width` package | CJK chars are 2 columns, emoji varies; edge cases are endless [VERIFIED: already used in status-bar.tsx] |
| Terminal input handling | Raw stdin processing | Ink `useInput` hook | Handles keypress normalization, escape sequences, modifier keys [VERIFIED: established pattern] |
| Immutable state updates | Spread operator nesting | `immer` via `createStore` | Deep nested updates (e.g., exploration.locations[id].level) are error-prone with spreads [VERIFIED: established pattern] |
| Branch tree ASCII art | Custom tree drawing | Unicode box-drawing + simple tree walker | Standard `│├└──` patterns; no library needed, but don't invent custom characters |
| Save data migration | Manual field copying | Schema-validated migration function chain (V1->V2->V3) | Each migration is tested independently, composable [VERIFIED: save-migrator.ts] |
| Map auto-layout | Custom force-directed layout | Simple grid placement from topology | Force layout is overkill for 9 nodes; simple BFS-based grid assignment from topology graph suffices |
| Fuzzy search | Custom string matching | Simple substring + tag matching | For MVP with ~30-50 codex entries, simple matching is sufficient; pinyin can be deferred |

**Key insight:** Phase 4's complexity is in the number of features, not in any single feature's algorithmic difficulty. The risk is integration sprawl, not algorithmic novelty.

## Common Pitfalls

### Pitfall 1: SaveData Migration Breaking Existing Saves

**What goes wrong:** Adding `branchId`/`parentSaveId` to SaveMeta without proper migration means all Phase 3 saves become unloadable.
**Why it happens:** SaveDataV2Schema uses `z.literal(2)` for version. V3 needs `z.literal(3)` but must still load V2 saves.
**How to avoid:** Chain migrations: V1->V2 (exists) + V2->V3 (new). V2->V3 migration adds default branch ("main") and null parentSaveId to existing saves. Test migration with actual Phase 3 save files.
**Warning signs:** `SaveDataV2Schema.safeParse` fails on saves created after Phase 4 code ships.

### Pitfall 2: Branch Isolation Leaking NPC Memories

**What goes wrong:** After branching, NPC memories from one branch leak into another, violating D-02 "因果不能串线".
**Why it happens:** Current `npcMemoryStore` is a global singleton with no branch awareness. Memory writes go to the same record regardless of active branch.
**How to avoid:** Tag every NpcMemoryEntry with `branchId`. On branch switch, reload memories from the branch's save snapshot. On memory write, tag with current branch. On memory read for AI context, filter by current branch lineage (current branch + ancestors before fork point).
**Warning signs:** NPC references events that happened in a different branch during dialogue.

### Pitfall 3: LocationSchema Extension Breaking Codex Loader

**What goes wrong:** Changing `exits` from `z.array(z.string())` to a richer format (direction+target) breaks all existing location entries.
**Why it happens:** LocationSchema is part of the CodexEntrySchema discriminated union, validated on load.
**How to avoid:** Use a union type for exits: `z.array(z.union([z.string(), SpatialExitSchema]))`. This accepts both old simple strings and new structured exits. The map renderer interprets strings as directionless connections.
**Warning signs:** Codex loader throws validation errors on startup.

### Pitfall 4: GamePhase Enum Explosion

**What goes wrong:** Adding `'map' | 'codex' | 'branch_tree' | 'compare' | 'shortcuts'` to GamePhaseSchema creates a growing enum that's hard to manage.
**Why it happens:** Each panel needs a phase value to control the scene panel slot replacement.
**How to avoid:** This is the established pattern (already has 'title', 'character_creation', 'game', 'combat', 'dialogue', 'journal'). Accept the enum growth but document all values. Alternative: use a separate `activePanel` state field to decouple panel overlays from core game phases.
**Warning signs:** `game-screen.tsx` becomes an unreadable chain of ternaries.

### Pitfall 5: Keyboard Shortcut Conflicts with Ink/Terminal

**What goes wrong:** Single-key shortcuts (`m`, `c`, `b`) fire while player is typing in the input area.
**Why it happens:** `useInput` captures all keystrokes globally unless scoped.
**How to avoid:** Guard all single-key shortcuts with `inputMode !== 'input_active'` check. The existing `useGameInput` hook already tracks `isTyping`. Shortcuts must only activate in `action_select` mode.
**Warning signs:** Typing "map" in NL input opens the map panel.

### Pitfall 6: Context Assembler Regression

**What goes wrong:** Rewriting context-assembler.ts for cognitive envelope breaks existing Phase 2/3 dialogue and narration.
**Why it happens:** `assembleNarrativeContext` and `assembleNpcContext` are called from scene-manager.ts and dialogue-manager.ts. Changing signatures or behavior breaks callers.
**How to avoid:** Add the epistemic filtering as a new layer on top of existing functions. Create `assembleFilteredNpcContext` that calls `assembleNpcContext` internally then applies the NPC Knowledge Filter. Keep old functions working for backward compatibility during migration.
**Warning signs:** NPC dialogue breaks or scene narration stops working after context-assembler changes.

## Code Examples

### BranchStore Schema

```typescript
// Source: derived from D-01 locked decisions + established store pattern
import { z } from 'zod';

export const BranchMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentBranchId: z.string().nullable(),
  parentSaveId: z.string().nullable(),
  headSaveId: z.string().nullable(),
  createdAt: z.string(),
  description: z.string(),
});
export type BranchMeta = z.infer<typeof BranchMetaSchema>;

export const BranchStateSchema = z.object({
  branches: z.record(z.string(), BranchMetaSchema),
  currentBranchId: z.string(),
});
export type BranchState = z.infer<typeof BranchStateSchema>;
```
[ASSUMED — field names are Claude's discretion per CONTEXT.md]

### ExplorationStore Schema

```typescript
// Source: derived from D-07 locked decisions
import { z } from 'zod';

export const ExplorationLevelSchema = z.enum([
  'unknown', 'rumored', 'known', 'visited', 'surveyed',
]);

export const LocationExplorationSchema = z.object({
  locationId: z.string(),
  level: ExplorationLevelSchema,
  discoveredAt: z.number(),
  discoverySource: z.string(),
  credibility: z.number().min(0).max(1),
  discoveredPOIs: z.array(z.string()),
});

export const ExplorationStateSchema = z.object({
  locations: z.record(z.string(), LocationExplorationSchema),
});
```
[ASSUMED — exact field names are implementation detail]

### Cognitive Context Envelope

```typescript
// Source: derived from D-12 locked decisions
export type EpistemicLevel =
  | 'world_truth'
  | 'npc_belief'
  | 'player_knowledge'
  | 'scene_visible'
  | 'npc_memory';

export type TaggedContextChunk = {
  readonly content: string;
  readonly epistemicLevel: EpistemicLevel;
  readonly sourceId: string;
};

export type CognitiveContextEnvelope = {
  readonly worldTruth: readonly TaggedContextChunk[];
  readonly npcBelief: readonly TaggedContextChunk[];
  readonly playerKnowledge: readonly TaggedContextChunk[];
  readonly sceneVisible: readonly TaggedContextChunk[];
  readonly npcMemory: readonly TaggedContextChunk[];
};

// NPC Actor receives filtered envelope
export function filterForNpcActor(
  envelope: CognitiveContextEnvelope,
  npcId: string,
): readonly TaggedContextChunk[] {
  return [
    ...envelope.sceneVisible,
    ...envelope.npcMemory.filter(c => c.sourceId === npcId),
    ...envelope.npcBelief.filter(c => c.sourceId === npcId),
    // NO world_truth, NO player_knowledge
  ];
}
```
[ASSUMED — implementation detail derived from D-12 requirements]

### LocationSchema Extension (Backward Compatible)

```typescript
// Source: derived from D-05 + existing LocationSchema
export const SpatialExitSchema = z.object({
  direction: z.string(),
  targetId: z.string(),
  distance: z.number().optional(),
});

// Backward-compatible: accepts both old string[] and new structured exits
export const LocationSchemaV2 = z.object({
  ...baseFields,
  type: z.literal("location"),
  region: z.string(),
  danger_level: z.number().min(0).max(10),
  exits: z.array(z.union([z.string(), SpatialExitSchema])),
  notable_npcs: z.array(z.string()),
  objects: z.array(z.string()),
  coordinates: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
  map_icon: z.string().optional(),
});
```
[ASSUMED — backward-compatible union approach is Claude's discretion]

### Branch Diff Engine (Pure Function)

```typescript
// Source: derived from D-04 requirements
export type DiffMarker = '+' | '-' | '~';
export type DiffItem = {
  readonly category: 'quest' | 'npc_relation' | 'inventory' | 'location' | 'faction' | 'knowledge';
  readonly marker: DiffMarker;
  readonly description: string;
  readonly isHighImpact: boolean;
};

export function compareBranches(
  sourceSnapshot: SaveDataV3,
  targetSnapshot: SaveDataV3,
): readonly DiffItem[] {
  const diffs: DiffItem[] = [];
  // Compare quest progress
  // Compare NPC relations/memory
  // Compare inventory
  // Compare location
  // Compare faction reputation
  // Compare discovered truths
  return diffs;
}
```
[ASSUMED — pure function signature]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SaveDataV2 (no branch awareness) | SaveDataV3 (branchId + parentSaveId) | Phase 4 | All new saves include branch metadata; migration from V2 adds default "main" branch |
| Simple exits (`string[]`) | Spatial exits (direction + targetId, backward-compatible union) | Phase 4 | Map system needs topology direction info; old data still loads |
| Flat context assembly | Cognitive Context Envelope | Phase 4 | All AI context tagged with epistemic level before delivery to AI roles |
| No exploration tracking | ExplorationStore with 5-level discovery | Phase 4 | Map and codex both use exploration state for visibility |
| No player knowledge tracking | PlayerKnowledgeStore | Phase 4 | Codex browser and Narrative Director bounded by player knowledge |

**Deprecated/outdated:**
- `assembleNpcContext` without epistemic filtering: Still works but should be wrapped with `assembleFilteredNpcContext` for all NPC Actor calls.
- `SaveDataV2Schema`: Still parseable (migration chain), but all new saves use V3.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | BranchMeta field names (id, name, parentBranchId, headSaveId, etc.) | Code Examples / BranchStore | LOW -- field naming is Claude's discretion per CONTEXT.md |
| A2 | ExplorationStore schema fields (discoveredAt, discoverySource, credibility) | Code Examples / ExplorationStore | LOW -- field details are implementation choices |
| A3 | LocationSchema can use union type for backward-compatible exits | Code Examples / LocationSchema Extension | MEDIUM -- if Zod discriminated union interacts poorly with union exit types, may need different approach |
| A4 | Simple BFS grid placement sufficient for 9-location map layout | Don't Hand-Roll / Map auto-layout | LOW -- topology is a small tree; force-directed layout would be overkill |
| A5 | Separate `activePanel` state field vs. extending GamePhaseSchema enum | Pitfall 4 | LOW -- either approach works; enum extension is the established pattern |
| A6 | CognitiveContextEnvelope type structure | Code Examples | MEDIUM -- prompt template design affects how well LLM respects boundaries |
| A7 | No quests.yaml exists yet (quest templates may be inline in code or generated) | Data investigation | LOW -- QuestTemplateSchema exists in codex but no quest data file was found; may need to be created or is in another location |

## Open Questions

1. **Turn log storage format for SAVE-04 (replay)**
   - What we know: SAVE-04 requires replay by reading stored turn log, not re-generating AI output.
   - What's unclear: Current save data (V2) does not include a turn log. `questEventLog` is the closest thing but only tracks quest events, not full turn history (narration, actions, check results).
   - Recommendation: Add a `turnLog` array to SaveDataV3 that records per-turn snapshots: `{ turnNumber, action, checkResult?, narrationLines, timestamp }`. Cap at last N turns (e.g., 50) to limit save file size.

2. **Existing quest data location**
   - What we know: `QuestTemplateSchema` exists in codex schemas. No `quests.yaml` file found in `src/data/codex/`.
   - What's unclear: Quest templates may have been created elsewhere or are generated at runtime in Phase 3.
   - Recommendation: Verify with codebase grep for quest template instantiation. This affects branch comparison (D-04 compares quest progress between branches).

3. **Map coordinate assignment for existing locations**
   - What we know: 9 locations exist in `locations.yaml`. None have x/y coordinates. The D-05 decision says coordinates are optional for layout hints.
   - What's unclear: Should the planner assign coordinates to all 9 locations in the data expansion task, or should the auto-layout algorithm handle it?
   - Recommendation: Assign coordinates to all 9 locations in the data file for deterministic, designer-controlled layout. Auto-layout is a fallback for locations without coordinates.

## Project Constraints (from CLAUDE.md)

- **Tech stack:** TypeScript + Bun runtime
- **Terminal UI:** React + Ink
- **No vector DB:** RAG uses file-based keyword/tag search on YAML codex + JSON memory
- **World data:** Human-readable YAML/JSON, git-diffable
- **CLI parsing:** Commander.js
- **AI boundary:** AI writes prose and NPC dialogue. AI does NOT decide game state changes.
- **Immutability:** Always create new objects, never mutate (enforced by immer + createStore pattern)
- **File organization:** Many small files > few large files (200-400 lines typical, 800 max)
- **Error handling:** Handle errors explicitly at every level
- **Input validation:** Validate at system boundaries (Zod schemas)
- **Security:** All player input and community content are untrusted. Prompt injection defense: NPC/narration skills cannot modify game state.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | bun test (built-in, Jest-compatible API) |
| Config file | none (Bun detects *.test.ts automatically) |
| Quick run command | `bun test --bail` |
| Full suite command | `bun test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAVE-02 | Branch create, switch, delete, tree listing | unit | `bun test src/persistence/branch-manager.test.ts` | Wave 0 |
| SAVE-02 | BranchStore state management | unit | `bun test src/state/branch-store.test.ts` | Wave 0 |
| SAVE-03 | Branch diff comparison across 6 dimensions | unit | `bun test src/engine/branch-diff.test.ts` | Wave 0 |
| SAVE-04 | Turn log storage and replay read | unit | `bun test src/persistence/turn-log.test.ts` | Wave 0 |
| CLI-02 | ExplorationStore 5-level state tracking | unit | `bun test src/state/exploration-store.test.ts` | Wave 0 |
| CLI-02 | Map layout algorithm (topology -> grid) | unit | `bun test src/ui/panels/map-panel.test.ts` | Wave 0 |
| CLI-03 | Codex filtering by visibility + knowledge | unit | `bun test src/ui/panels/codex-panel.test.ts` | Wave 0 |
| CLI-04 | Keyboard shortcut activation guards | unit | `bun test src/ui/hooks/use-game-input.test.ts` | Wave 0 |
| LLM-04 | NPC knowledge filter (6-dimension) | unit | `bun test src/ai/utils/npc-knowledge-filter.test.ts` | Wave 0 |
| LLM-04 | Cognitive context envelope construction | unit | `bun test src/ai/utils/context-assembler.test.ts` | Wave 0 |
| SAVE-02 | SaveData V2->V3 migration | unit | `bun test src/persistence/save-migrator.test.ts` | Exists (extend) |
| ALL | End-to-end: branch, map, codex commands | integration | `bun test src/e2e/phase4-verification.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `bun test --bail`
- **Per wave merge:** `bun test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/state/branch-store.test.ts` -- covers SAVE-02 state management
- [ ] `src/state/exploration-store.test.ts` -- covers CLI-02 exploration tracking
- [ ] `src/state/player-knowledge-store.test.ts` -- covers LLM-04 knowledge tracking
- [ ] `src/persistence/branch-manager.test.ts` -- covers SAVE-02 branch CRUD
- [ ] `src/engine/branch-diff.test.ts` -- covers SAVE-03 comparison logic
- [ ] `src/ai/utils/npc-knowledge-filter.test.ts` -- covers LLM-04 epistemic filtering
- [ ] `src/ai/utils/context-assembler.test.ts` -- covers LLM-04 envelope construction (new file, existing has no tests)
- [ ] `src/e2e/phase4-verification.test.ts` -- integration test scaffold

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Single-player CLI, no auth |
| V3 Session Management | No | File-based saves, no sessions |
| V4 Access Control | Yes (epistemic) | NPC Knowledge Filter enforces information access control at AI layer |
| V5 Input Validation | Yes | Zod schema validation on all save data, branch names, codex queries |
| V6 Cryptography | No | No encryption needed for save files |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Branch name injection (special chars in branch names) | Tampering | Sanitize branch names same as save names: `name.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '-')` [VERIFIED: save-file-manager.ts line 40] |
| Path traversal via branch/save file paths | Tampering | Resolve all paths and check they stay within save directory [VERIFIED: save-file-manager.ts lines 49-53] |
| Codex search injection | Info Disclosure | Treat search query as plain text; no regex or code execution from user input |
| Epistemic boundary bypass via prompt injection | Info Disclosure | Context Assembler filters BEFORE prompt construction; even if AI is manipulated, it cannot access data it was never given |
| Save file tampering (manually edited JSON) | Tampering | Zod schema validation on every load; invalid data rejected with clear error |

## Sources

### Primary (HIGH confidence)
- Codebase inspection: all source files listed in canonical_refs section -- read and analyzed
- Installed package versions: verified via `node_modules/*/package.json` for ink 7.0.1, react 19.2.5, zod 4.3.6
- Bun test runner: verified via `bun test --list` (418 tests across 34 files from Phase 3)
- Phase 4 CONTEXT.md: 13 locked decisions (D-01 through D-13)
- Phase 4 UI-SPEC.md: approved 2026-04-22, 5 panel layout contracts, keyboard interaction contract, CJK handling contract

### Secondary (MEDIUM confidence)
- CLAUDE.md architecture specification: layer model, AI boundary rules, RAG strategy

### Tertiary (LOW confidence)
- None -- all claims verified against codebase or project documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages already installed and verified, no new dependencies
- Architecture: HIGH -- all patterns established in Phases 1-3, extensions follow same conventions
- Pitfalls: HIGH -- identified from direct codebase analysis of existing schemas, stores, and integration points
- Epistemic separation: MEDIUM -- design is clear from CONTEXT.md but prompt effectiveness for LLM boundary enforcement is inherently uncertain

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (stable -- no external dependency changes expected)
