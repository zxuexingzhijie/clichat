# Phase 8: Narrative Character Creation - Research

**Researched:** 2026-04-25
**Domain:** In-world character creation via NPC dialogue + weight-based attribute resolution + streaming UI
**Confidence:** HIGH

## Summary

Phase 8 replaces the existing menu-based `CharacterCreationScreen` with an in-world cinematic guard intercept at the north gate. The player defines their character through 4 rounds of fixed-option dialogue with the `npc_guard`, followed by a free-text name input, then a seamless transition to the game loop. The existing `character-creation.ts` engine (`buildCharacter`, `calculateAttributes`) is preserved and called after a new weight-accumulation layer resolves race, profession, and background IDs from dialogue responses.

The primary technical challenges are: (1) designing the dialogue tree data structure (`guard-dialogue.yaml`) with its weight-accumulation and tiebreaker system, (2) building a new `NarrativeCreationScreen` component that orchestrates a multi-stage state machine with streaming AI narration between each round, and (3) cleanly removing the old creation flow while preserving the engine.

**Primary recommendation:** Build a new `guard-dialogue.yaml` data file defining the 4-round dialogue tree with per-option weight effects, a pure-function weight resolver that deterministically produces `CharacterSelections` from accumulated weights, and a `NarrativeCreationScreen` component that reuses the Phase 7 streaming infrastructure (`useNpcDialogue` hook pattern) for guard narration between rounds.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** AI-narrated + fixed options -- guard asks questions with AI-generated prose (using NPC Actor role), player picks from fixed codex-mapped dialogue options. AI handles narration flavor; option->effect mapping is deterministic.
- **D-02:** 4 dialogue rounds matching current wizard structure: (1) origin -> race, (2) livelihood -> profession weights, (3) reason for visiting -> background weights, (4) secret -> background weights + quest hooks.
- **D-03:** Each player selection triggers an AI-narrated guard response before the next question. 4 LLM calls during creation (one per answer). Uses existing NPC Actor AI role with npc_guard identity.
- **D-04:** Seamless transition -- no confirmation screen after the 4th answer. Guard waves player through, game phase begins immediately. Guard's farewell line implicitly confirms the resolved character.
- **D-05:** Delayed free-text input -- guard does NOT ask name first. After the initial identity questions (race/profession established), the guard asks for the player's name in a natural conversational context.
- **D-06:** Free-text input with validation: length check, empty input falls back to '旅人', Tab key generates a random name suggestion. No separate rename screen -- name is part of the dialogue flow.
- **D-07:** New `narrative_creation` value added to `GamePhaseSchema`. Flow: `title -> narrative_creation -> game` for new games, `title -> game` for loaded saves. Title screen handles the branching.
- **D-08:** Old `CharacterCreationScreen` component and `character-creation-store.ts` are removed entirely. The engine (`character-creation.ts` with `buildCharacter`, `calculateAttributes`, codex queries) is preserved -- the new guard scene calls it with the same interface after weight resolution.
- **D-09:** Load game bypasses guard scene entirely -- title screen routes directly to `game` phase when restoring a save.
- **D-10:** Each guard dialogue option maps to an `effects` object containing: attribute deltas, professionWeights, backgroundWeights, tags, and quest hooks. This is NOT a direct option->codex ID mapping -- it's a weight accumulation system.
- **D-11:** Race is determined directly from the first question (origin). Profession and background are resolved AFTER all 4 questions by accumulating weights across all answers and picking the highest-weighted codex ID.
- **D-12:** Effects data lives in a standalone `guard-dialogue.yaml` file, decoupled from world codex data.
- **D-13:** Tiebreaker rule -- 4-layer deterministic resolution: (1) Last answer's weight contribution, (2) Question priority, (3) archetypePriority config, (4) Codex definition order fallback.
- **D-14:** Guard summary line on resolution -- when the guard waves the player through, the AI-narrated farewell references the resolved profession/race implicitly. No explicit stats display during creation.

### Claude's Discretion
- AI prompt templates for the guard's narration style (tone, length, personality expression)
- Specific dialogue option text and flavor descriptions in guard-dialogue.yaml
- guard-dialogue.yaml schema design (exact field names, nesting structure)
- How the NarrativeCreationScreen component manages streaming of guard responses (can reuse Phase 7 streaming infrastructure)
- Random name generation strategy (name pool, algorithm)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NCC-01 | Game begins at north gate cinematic, no creation menu | D-07 adds `narrative_creation` phase; D-08 removes old screen; app.tsx routing change; title-screen.tsx branches new/load |
| NCC-02 | Guard NPC asks questions surfacing identity through dialogue choices | D-01/D-02/D-03 define dialogue structure; `npc_guard` codex entry exists; `streamNpcDialogue` for AI prose; `guard-dialogue.yaml` for fixed options |
| NCC-03 | Player responses deterministically set attributes via Rules Engine | D-10/D-11/D-12/D-13 define weight system; `buildCharacter`/`calculateAttributes` engine preserved; new weight resolver function |
| NCC-04 | After guard interaction, character fully initialized, normal game loop begins | D-04/D-05/D-06/D-14 define transition flow; farewell streaming; auto-transition to `game` phase |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dialogue option rendering + selection | CLI/UI (Ink) | -- | Pure terminal rendering, arrow/Enter/number key interaction |
| Guard AI narration (prose generation) | LLM (NPC Actor) | -- | AI generates contextual dialogue; NPC Actor role already exists |
| Streaming text delivery | UI Hook Layer | AI Service Layer | `useNpcDialogue` hook consumes `streamNpcDialogue` async generator |
| Weight accumulation + resolution | Rules Engine | -- | Deterministic pure function; NO AI involvement (CLAUDE.md boundary) |
| Character sheet construction | Rules Engine | -- | `buildCharacter` in `character-creation.ts` -- existing, preserved |
| Dialogue tree data | Data Layer (YAML) | -- | `guard-dialogue.yaml` is static content, loaded at creation start |
| Phase routing (title -> creation -> game) | State Layer | UI Layer | `GamePhaseSchema` enum + `app.tsx` conditional rendering |
| Name input with validation | UI (TextInput) | -- | @inkjs/ui `TextInput` component with `onSubmit` callback |
| Random name generation | Utility | -- | Static name pool, no AI needed |

## Standard Stack

### Core (already installed -- no new dependencies)

| Library | Version | Purpose | Why Standard | Source |
|---------|---------|---------|--------------|--------|
| React | ^19.2.5 | Component model for NarrativeCreationScreen | Required by Ink 7 | [VERIFIED: package.json] |
| ink | ^7.0.1 | Terminal renderer (Box, Text, useInput) | All UI rendering | [VERIFIED: package.json] |
| @inkjs/ui | ^2.0.0 | TextInput for name input, Select for option selection | Official Ink companion | [VERIFIED: package.json, Context7] |
| ai (Vercel AI SDK) | ^5.0.179 | streamText for guard narration | Existing AI infrastructure | [VERIFIED: package.json] |
| zod | ^4.3.6 | Schema validation for guard-dialogue.yaml data | Already used everywhere | [VERIFIED: package.json] |
| yaml | ^2.8.3 | Dynamic YAML loading for guard-dialogue.yaml | Runtime YAML parsing | [VERIFIED: package.json] |
| mitt | ^3.0.1 | Event bus for creation lifecycle events | Existing event system | [VERIFIED: package.json] |

### Supporting (no new packages needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| immer | ^11.1.4 | Immutable state updates | Used by `playerStore.setState`, `gameStore.setState` |
| nanoid | ^5.1.9 | Unique IDs | If dialogue needs unique session IDs |
| string-width | ^8.2.0 | CJK string width calculation | Name input validation for display width |

**Installation:** No new packages needed. Phase 8 operates entirely within the existing dependency set.

## Architecture Patterns

### System Architecture Diagram

```
TitleScreen
  |
  | "New Game" press
  v
+---------------------------------------------------+
| NarrativeCreationScreen                            |
|                                                    |
|  [1] Load guard-dialogue.yaml + codex             |
|       |                                            |
|  [2] State Machine (round_N_streaming/selecting)  |
|       |                                            |
|       +---> streamNpcDialogue(npc_guard, ...)     |
|       |        |                                   |
|       |        v                                   |
|       |     GuardDialoguePanel (streaming text)   |
|       |        |                                   |
|       |     Player selects option                 |
|       |        |                                   |
|       +---> accumulateWeights(option.effects)     |
|       |     (pure function, no AI)                |
|       |        |                                   |
|       +--- repeat rounds 1-4 --->                 |
|                                                    |
|  [3] Name input (GuardNameInput / TextInput)      |
|       |                                            |
|  [4] resolveCharacter(accumulatedWeights)         |
|       |  -> race from round 1 (direct)            |
|       |  -> profession from max weight            |
|       |  -> backgrounds from max weights          |
|       |  -> tiebreaker: D-13 rules                |
|       |                                            |
|  [5] buildCharacter(selections) -> PlayerState    |
|       |  (existing engine, unchanged)             |
|       |                                            |
|  [6] Farewell streaming (AI references character) |
|       |                                            |
|  [7] 500ms delay -> phase = 'game'               |
+---------------------------------------------------+
         |
         v
    GameScreen (normal game loop, loc_north_gate)
```

### Recommended Project Structure

```
src/
├── data/
│   └── codex/
│       └── guard-dialogue.yaml       # NEW: dialogue tree + effects
├── engine/
│   ├── character-creation.ts          # PRESERVED (unchanged)
│   ├── guard-dialogue-loader.ts       # NEW: load + validate YAML
│   └── weight-resolver.ts             # NEW: accumulate weights, resolve IDs, tiebreaker
├── ai/
│   └── prompts/
│       └── guard-creation-prompt.ts   # NEW: specialized guard creation prompt templates
├── ui/
│   ├── screens/
│   │   ├── narrative-creation-screen.tsx  # NEW: top-level screen + state machine
│   │   ├── character-creation-screen.tsx  # REMOVED (D-08)
│   │   └── title-screen.tsx              # MODIFIED: route "New Game" -> narrative_creation
│   ├── components/
│   │   ├── guard-dialogue-panel.tsx   # NEW: streaming text + option list
│   │   └── guard-name-input.tsx       # NEW: TextInput wrapper for name
│   └── hooks/
│       └── use-guard-streaming.ts     # NEW: thin wrapper around useNpcDialogue for creation context
├── state/
│   ├── game-store.ts                  # MODIFIED: add 'narrative_creation' to GamePhaseSchema
│   └── character-creation-store.ts    # REMOVED (D-08)
├── events/
│   └── event-types.ts                 # MODIFIED: add guard_creation events
└── app.tsx                            # MODIFIED: routing for narrative_creation phase
```

### Pattern 1: Weight Accumulation and Resolution

**What:** Each dialogue option carries an `effects` object with weights. After 4 rounds, accumulated weights determine profession and background IDs.

**When to use:** This is the core novel pattern of Phase 8.

**Example:**
```typescript
// Source: CONTEXT.md D-10, D-11, D-13
type DialogueOptionEffect = {
  readonly raceId?: string;             // Only round 1 sets this directly
  readonly professionWeights: Readonly<Record<string, number>>;  // e.g. { prof_mage: 2, prof_rogue: 1 }
  readonly backgroundWeights: Readonly<Record<string, number>>;  // e.g. { bg_refugee: 2 }
  readonly attributeDeltas: Readonly<Record<string, number>>;    // direct attribute adjustments (optional)
  readonly tags: readonly string[];      // quest hooks, narrative flags
};

type AccumulatedWeights = {
  readonly raceId: string;
  readonly professionWeights: Readonly<Record<string, number>>;
  readonly backgroundWeights: Readonly<Record<string, number>>;
  readonly tags: readonly string[];
};

// Pure function -- no side effects, fully testable
function resolveCharacter(
  weights: AccumulatedWeights,
  tiebreakerConfig: TiebreakerConfig,
): CharacterSelections {
  const professionId = resolveByWeight(
    weights.professionWeights,
    tiebreakerConfig,
    'profession'
  );
  const backgroundIds = resolveTopN(
    weights.backgroundWeights,
    2,
    tiebreakerConfig,
    'background'
  );
  return {
    name: '',  // filled separately
    raceId: weights.raceId,
    professionId,
    backgroundIds,
  };
}
```

### Pattern 2: State Machine for Dialogue Rounds

**What:** The screen progresses through discrete states. Each state determines what is rendered and what input is accepted.

**When to use:** Manages the guard dialogue flow from streaming -> selecting -> next round.

**Example:**
```typescript
// Source: UI-SPEC state machine diagram [VERIFIED: 08-UI-SPEC.md]
type CreationPhase =
  | { type: 'loading' }
  | { type: 'round_streaming'; round: number }
  | { type: 'round_selecting'; round: number }
  | { type: 'name_prompt_streaming' }
  | { type: 'name_input' }
  | { type: 'farewell_streaming' }
  | { type: 'transition_delay' };

// State transitions are explicit -- no ambiguous intermediate states
function nextPhase(current: CreationPhase, event: 'stream_complete' | 'option_selected' | 'name_submitted'): CreationPhase {
  if (current.type === 'round_streaming' && event === 'stream_complete') {
    return { type: 'round_selecting', round: current.round };
  }
  if (current.type === 'round_selecting' && event === 'option_selected') {
    if (current.round < 4) return { type: 'round_streaming', round: current.round + 1 };
    return { type: 'name_prompt_streaming' };
  }
  if (current.type === 'name_prompt_streaming' && event === 'stream_complete') {
    return { type: 'name_input' };
  }
  if (current.type === 'name_input' && event === 'name_submitted') {
    return { type: 'farewell_streaming' };
  }
  // ... etc
  return current;
}
```

### Pattern 3: Guard Creation Prompt (NPC Actor Adaptation)

**What:** The guard's AI narration during creation uses the existing `streamNpcDialogue` infrastructure but with a specialized system prompt that instructs the guard to ask questions in a cinematic tone.

**When to use:** Each of the 4 rounds + name prompt + farewell.

**Example:**
```typescript
// Source: existing npc-system.ts pattern [VERIFIED: src/ai/prompts/npc-system.ts]
// Specialized prompt builder for guard creation context
function buildGuardCreationSystemPrompt(npcProfile: NpcProfile, round: number, playerSelection?: string): string {
  return `你扮演NPC "${npcProfile.name}"，一个城门守卫。
性格特征：${npcProfile.personality_tags.join('、')}
背景：${npcProfile.backstory}

你正在盘问一个刚到城门的旅人。这是角色创建场景。
当前对话轮次：${round}/4

规则：
- 用符合角色性格的语气说话（尽职、谨慎、直率）
- 自然地过渡到下一个问题
- 不超过150字
- 不发明世界事实
- 不透露任何游戏机制`;
}
```

### Anti-Patterns to Avoid

- **Letting AI decide attribute values:** The AI narrates; the Rules Engine (weight resolver) decides attributes. Never pass weight resolution to the LLM. [CLAUDE.md boundary: "AI does NOT decide whether events succeed, resources are consumed, or relationships change"]
- **Storing intermediate creation state in a global store:** The old `character-creation-store.ts` is being removed. Use component-local `useState`/`useReducer` for the dialogue state machine. Global stores are for game state that persists across screens.
- **Coupling guard-dialogue.yaml to codex entries by embedding codex data:** The dialogue YAML references codex IDs (e.g., `race_human`, `prof_mage`) but does NOT duplicate codex data. Resolution happens at the engine layer.
- **Making the farewell text a hardcoded string:** D-14 requires AI-narrated farewell that references the resolved character. Use `streamNpcDialogue` with the resolution result passed as context.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming text with sentence buffering | Custom character-by-character renderer | `useNpcDialogue` hook + `createSentenceBuffer` | Phase 7 already built and tested this exact infrastructure |
| Option list with arrow key navigation | Custom `useInput` handler for cursor | `useInput` from ink (existing pattern in `CharacterCreationScreen`) | Matches existing codebase pattern; @inkjs/ui `Select` is an alternative but the UI-SPEC calls for custom rendering matching existing `ActionsPanel` style |
| Free-text terminal input | Raw stdin reader | `TextInput` from `@inkjs/ui` | Handles cursor, backspace, paste, suggestions natively [VERIFIED: Context7 @inkjs/ui docs] |
| YAML file loading + validation | Custom parser | `yaml` package + Zod schema | Exact pattern used by codex loader [VERIFIED: src/codex/loader.ts] |
| Random name generation | LLM call for name | Static name pool array with `Math.random` | Instant, no API cost, deterministic if seeded |

**Key insight:** Phase 8 is primarily an orchestration task -- wiring existing systems (NPC Actor, streaming hooks, character engine, codex loader) into a new UI flow. The only truly novel code is the weight accumulation/resolution logic and the guard-dialogue.yaml schema.

## Common Pitfalls

### Pitfall 1: Race Condition Between Stream Completion and State Transition

**What goes wrong:** Guard narration stream completes but the state machine transitions to `round_selecting` before the final text is flushed to screen.
**Why it happens:** `streamNpcDialogue` async generator completes and the `finally` block runs asynchronously. If the state transition is triggered in the `finally` block, React may batch the state update with the isStreaming change, causing a flicker.
**How to avoid:** Use a `useEffect` that watches `isStreaming` transitioning from `true` to `false` to advance the state machine, rather than advancing in the streaming callback itself.
**Warning signs:** Text appears to "jump" or truncate when a round completes.

### Pitfall 2: TextInput Stealing Focus from useInput

**What goes wrong:** During name input mode, @inkjs/ui `TextInput` and Ink's `useInput` both try to handle keyboard input, causing double-processing or lost keystrokes.
**Why it happens:** `TextInput` uses its own internal `useInput` hook. If the parent component also has a `useInput` handler, both fire.
**How to avoid:** Use `TextInput`'s `isDisabled` prop to disable it during non-name-input phases. During name input, disable the parent `useInput` by conditionally not handling events (or gating via the state machine phase). The UI-SPEC explicitly states `TextInput` is only active during `name_input` phase.
**Warning signs:** Pressing keys during dialogue selection also types into a hidden input field; or Tab/Enter during name input triggers option selection.

### Pitfall 3: Weight Accumulation Mutation

**What goes wrong:** Accumulated weights object is mutated across rounds, causing stale reference bugs or incorrect weight values when tests check intermediate states.
**Why it happens:** JavaScript object spread is shallow. Nested `Record<string, number>` may be mutated if not handled immutably.
**How to avoid:** Weight accumulation function must return a new object each round. Use `Object.entries` + `reduce` or spread + computed property patterns. The project's immutability convention (from CLAUDE.md coding rules) applies here.
**Warning signs:** Tests pass individually but fail when run together; weight values are higher than expected.

### Pitfall 4: Guard Prompt Token Budget Exceeded

**What goes wrong:** The guard's system prompt for creation context is too long, pushing per-round LLM calls over the token budget and causing slow responses or truncation.
**Why it happens:** The NPC Actor role has `maxTokens: 400` by default. If the system prompt includes too much context (all previous rounds, all selected options, full codex data), it leaves little room for output.
**How to avoid:** Keep the guard creation prompt lean: NPC identity (from codex, ~100 chars), round number, player's last selection (label only, not effects), and narration instructions. Do NOT include previous round transcripts -- each round is a fresh LLM call with minimal context.
**Warning signs:** Guard responses are very short, cut off, or generation fails with token limit errors.

### Pitfall 5: Old Character Creation Routes Not Fully Removed

**What goes wrong:** After removing `CharacterCreationScreen` and `character-creation-store.ts`, other files still import or reference them, causing TypeScript compilation errors.
**Why it happens:** The old `character_creation` phase value is referenced in `GamePhaseSchema`, `app.tsx`, and possibly test files.
**How to avoid:** After removal, grep the entire codebase for `character_creation` (the enum value), `CharacterCreationScreen`, `character-creation-store`, and `characterCreationStore`. Fix all references. The `character_creation` enum value should be replaced by `narrative_creation`.
**Warning signs:** TypeScript errors about missing imports; runtime errors when loading old save files that have `character_creation` as the saved phase.

### Pitfall 6: Tiebreaker Non-Determinism

**What goes wrong:** Two players making the same 4 choices get different professions or backgrounds.
**Why it happens:** If the tiebreaker logic uses `Object.keys()` order (which is stable in V8 for string keys but not guaranteed by spec) or `Map` iteration order inconsistently.
**How to avoid:** D-13 specifies a 4-layer deterministic tiebreaker. Implement it as an explicit priority chain in the resolver, with the final fallback being codex definition order (array index in the YAML file). Write tests that verify every possible tie scenario produces a consistent result.
**Warning signs:** Flaky tests where the same inputs occasionally produce different outputs.

## Code Examples

### Loading and Validating guard-dialogue.yaml

```typescript
// Source: codex/loader.ts pattern [VERIFIED: src/codex/loader.ts]
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

const DialogueOptionEffectSchema = z.object({
  raceId: z.string().optional(),
  professionWeights: z.record(z.string(), z.number()).default({}),
  backgroundWeights: z.record(z.string(), z.number()).default({}),
  tags: z.array(z.string()).default([]),
});

const DialogueOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  effects: DialogueOptionEffectSchema,
});

const DialogueRoundSchema = z.object({
  round: z.number().int().min(1).max(4),
  guardPromptHint: z.string(),
  options: z.array(DialogueOptionSchema).min(2),
});

const GuardDialogueConfigSchema = z.object({
  rounds: z.array(DialogueRoundSchema).length(4),
  archetypePriority: z.object({
    profession: z.array(z.string()),
    background: z.array(z.string()),
  }),
  namePool: z.array(z.string()).min(1),
});

export type GuardDialogueConfig = z.infer<typeof GuardDialogueConfigSchema>;

export async function loadGuardDialogue(filePath: string): Promise<GuardDialogueConfig> {
  const file = Bun.file(filePath);
  const text = await file.text();
  const raw = parseYaml(text);
  return GuardDialogueConfigSchema.parse(raw);
}
```

### Using @inkjs/ui TextInput for Name Input

```tsx
// Source: Context7 @inkjs/ui TextInput docs [VERIFIED]
import { TextInput } from '@inkjs/ui';

function GuardNameInput({ onSubmit, onTabRandomName }: {
  readonly onSubmit: (name: string) => void;
  readonly onTabRandomName: () => string;
}) {
  const [value, setValue] = useState('');

  // Tab handling requires useInput since TextInput doesn't have onTab
  useInput((input, key) => {
    if (key.tab) {
      const randomName = onTabRandomName();
      setValue(randomName);
    }
  });

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color="cyan">{'> '}</Text>
        <TextInput
          placeholder="输入你的名字..."
          defaultValue={value}
          onChange={setValue}
          onSubmit={(val) => onSubmit(val || '旅人')}
        />
      </Box>
      <Text dimColor>{'Enter 确认    Tab 随机名字    留空为\'旅人\''}</Text>
    </Box>
  );
}
```

### Reusing useNpcDialogue for Guard Streaming

```typescript
// Source: existing hook pattern [VERIFIED: src/ui/hooks/use-npc-dialogue.ts]
// The existing useNpcDialogue hook works directly for guard creation streaming.
// The guard NPC profile is built from the npc_guard codex entry.

const guardProfile: NpcProfile = {
  id: 'npc_guard',
  name: '北门守卫',
  personality_tags: ['dutiful', 'cautious', 'honest'],
  goals: ['protect_gate'],
  backstory: '从小在黑松镇长大，五年前狼灾后加入守卫队。',
};

// In the NarrativeCreationScreen:
const npcDialogue = useNpcDialogue();

// When entering a streaming phase:
npcDialogue.startDialogue({
  npcProfile: guardProfile,
  scene: '黑松镇北门，夜色中一个旅人走来',
  playerAction: selectedOptionLabel,  // player's choice from previous round
  memories: [],  // no memories during creation
});
```

### @inkjs/ui Select vs Custom Option List

The UI-SPEC specifies a custom option rendering pattern matching the existing `ActionsPanel` style (`>` prefix + `bold` + `color="cyan"` for selected, dimColor for unselected). Two approaches:

```tsx
// Option A: @inkjs/ui Select component (simpler, less style control)
// [VERIFIED: Context7 @inkjs/ui Select docs]
<Select
  options={round.options.map(opt => ({ label: opt.label, value: opt.id }))}
  onChange={(value) => handleOptionSelected(value)}
  isDisabled={phase.type !== 'round_selecting'}
/>

// Option B: Custom list with useInput (matches existing ActionsPanel pattern)
// [VERIFIED: src/ui/screens/character-creation-screen.tsx lines 152-159]
// This matches the UI-SPEC more precisely (custom indicators, number key direct-select)
{options.map((opt, i) => (
  <Box key={opt.id}>
    <Text bold={i === cursor} color={i === cursor ? 'cyan' : undefined} dimColor={i !== cursor}>
      {i === cursor ? '❯ ' : '  '}{i + 1}. {opt.label}
    </Text>
  </Box>
))}
```

**Recommendation:** Use Option B (custom list). The UI-SPEC explicitly calls for `>` prefix + cyan + bold matching the existing `ActionsPanel` pattern, plus number-key direct-select which `Select` doesn't support. The existing `CharacterCreationScreen` already implements this exact pattern. [ASSUMED: Select component does not natively support number-key direct-select; based on API docs showing only arrow key navigation]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Menu-based step wizard | In-world NPC dialogue with weight system | Phase 8 (this phase) | Core UX shift from "create then play" to "play from the first second" |
| Direct mapping (step -> codex ID) | Weight accumulation across all answers | Phase 8 (this phase) | More nuanced character builds; same answers can lead to different results based on combination |
| Confirmation screen at end | Seamless guard farewell + auto-transition | Phase 8 (this phase) | Faster flow, more cinematic |

**Deprecated/outdated:**
- `CharacterCreationScreen` (character-creation-screen.tsx): Removed by D-08
- `character-creation-store.ts`: Removed by D-08
- `character_creation` enum value in `GamePhaseSchema`: Replaced by `narrative_creation`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | @inkjs/ui `Select` does not support number-key direct-select, only arrow keys | Code Examples | If Select supports it, could simplify option rendering -- low risk either way since custom list is a proven pattern |
| A2 | @inkjs/ui `TextInput` does not have a built-in `onTab` callback, requiring a separate `useInput` handler for Tab key | Code Examples | If TextInput handles Tab internally, the Tab-for-random-name feature might need different wiring -- medium risk |
| A3 | Guard farewell streaming completes reliably within 3-5 seconds with default NPC Actor model config | Pitfall 4 | If unreliable, may need a timeout or fallback farewell text |

## Open Questions

1. **TextInput + useInput Tab Key Conflict**
   - What we know: `TextInput` from @inkjs/ui uses its own `useInput` internally. Tab is commonly used for autocomplete in `TextInput` (the component has a `suggestions` prop). Adding a parallel `useInput` for Tab may cause conflicts.
   - What's unclear: Whether `TextInput`'s internal Tab handler fires even when no `suggestions` are provided. If it does, Tab might be consumed before our handler sees it.
   - Recommendation: Test empirically during implementation. If Tab is consumed, use a different key (e.g., Ctrl-R) for random name, or provide the random name via TextInput's `suggestions` prop as a single-item array.

2. **Save File Backward Compatibility**
   - What we know: Old save files store `phase: 'character_creation'` in `GameState`. After Phase 8, this enum value no longer exists in `GamePhaseSchema`.
   - What's unclear: Whether any save files could have `character_creation` as the saved phase (unlikely -- saves happen during `game` phase, not mid-creation).
   - Recommendation: Add a migration step in save file loading that maps `character_creation` -> `title` (restart creation). This is defensive and costs nothing.

3. **guard-dialogue.yaml File Location**
   - What we know: D-12 says effects data lives in a standalone YAML file. The codex lives in `src/data/codex/`.
   - What's unclear: Whether `guard-dialogue.yaml` belongs in the codex directory (alongside other YAML data) or in a separate location (since it's not a codex entry type).
   - Recommendation: Place in `src/data/codex/` for consistency with the existing `loadAllCodex` infrastructure, but exclude it from `loadAllCodex` (it doesn't conform to `CodexEntrySchema`). Load it via a separate `loadGuardDialogue` function using the same `yaml` package + Zod pattern.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | bun:test (built-in, Jest-compatible API) |
| Config file | bunfig.toml (`[test]` section, minimal config) |
| Quick run command | `bun test src/engine/weight-resolver.test.ts -x` |
| Full suite command | `bun test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NCC-01 | Game starts at north gate, no creation menu | integration | `bun test src/ui/screens/narrative-creation-screen.test.ts::test_initial_phase -x` | Wave 0 |
| NCC-02 | Guard asks questions via fixed options | unit | `bun test src/engine/guard-dialogue-loader.test.ts -x` | Wave 0 |
| NCC-03a | Weight accumulation produces correct totals | unit | `bun test src/engine/weight-resolver.test.ts::test_accumulate -x` | Wave 0 |
| NCC-03b | Weight resolution picks correct profession/background | unit | `bun test src/engine/weight-resolver.test.ts::test_resolve -x` | Wave 0 |
| NCC-03c | Tiebreaker is deterministic across all combos | unit | `bun test src/engine/weight-resolver.test.ts::test_tiebreaker -x` | Wave 0 |
| NCC-03d | buildCharacter called with resolved selections produces valid PlayerState | unit | `bun test src/engine/character-creation.test.ts -x` | Exists (11 tests pass) |
| NCC-04 | After farewell, phase transitions to game with initialized character | integration | `bun test src/ui/screens/narrative-creation-screen.test.ts::test_transition -x` | Wave 0 |

### Sampling Rate

- **Per task commit:** `bun test src/engine/weight-resolver.test.ts src/engine/guard-dialogue-loader.test.ts -x`
- **Per wave merge:** `bun test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/engine/weight-resolver.test.ts` -- covers NCC-03a, NCC-03b, NCC-03c (weight accumulation, resolution, tiebreaker determinism)
- [ ] `src/engine/guard-dialogue-loader.test.ts` -- covers NCC-02 (YAML loading, schema validation)
- [ ] `src/data/codex/guard-dialogue.yaml` -- the data file itself (needed for loader tests)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | yes | Zod schema validation for guard-dialogue.yaml; string-width/length check for name input |
| V6 Cryptography | no | n/a |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Name input injection (XSS-like ANSI escape sequences) | Tampering | Ink's `<Text>` component escapes ANSI by default; validate name length (max ~20 chars) and strip control characters |
| Prompt injection via name input passed to LLM | Tampering | Name is passed to the farewell AI call as part of context; use the existing NPC Actor prompt structure which constrains output format. Name is a small field in a structured prompt -- low risk. |
| guard-dialogue.yaml tampering (codex ID injection) | Tampering | Zod schema validation ensures IDs match expected patterns; `buildCharacter` validates against loaded codex entries (unknown IDs produce defaults) |

## Sources

### Primary (HIGH confidence)
- Project codebase: `src/engine/character-creation.ts`, `src/ui/screens/character-creation-screen.tsx`, `src/state/game-store.ts`, `src/app.tsx`, `src/ai/roles/npc-actor.ts`, `src/ui/hooks/use-npc-dialogue.ts`, `src/ui/hooks/use-ai-narration.ts`, `src/data/codex/npcs.yaml`, `src/data/codex/races.yaml`, `src/data/codex/professions.yaml`, `src/data/codex/backgrounds.yaml` -- all directly read and analyzed
- Context7 `/vadimdemedes/ink-ui` -- TextInput and Select component APIs, props, usage patterns
- Phase 8 CONTEXT.md -- 14 locked decisions, canonical references, code context
- Phase 8 UI-SPEC.md -- Layout contract, state machine, interaction contract, copywriting
- Phase 7 PATTERNS.md -- Streaming infrastructure patterns (sentence buffer, hooks, event bus)

### Secondary (MEDIUM confidence)
- `CLAUDE.md` project instructions -- layer model, AI boundary rules, tech stack, RAG strategy

### Tertiary (LOW confidence)
- None -- all claims verified against codebase or official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages already installed and in use, versions verified against package.json
- Architecture: HIGH -- all integration points verified against existing codebase; patterns follow established Phase 7 streaming infrastructure
- Pitfalls: HIGH -- derived from direct code analysis of existing streaming hooks, Ink component interactions, and JavaScript immutability patterns
- Weight system: MEDIUM -- the weight accumulation and tiebreaker pattern is novel (no existing analog in codebase), but the design is fully specified by D-10 through D-13

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (stable -- existing stack, no external dependencies changing)
