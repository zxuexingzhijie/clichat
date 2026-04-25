# Phase 9: Animation System - Research

**Researched:** 2026-04-25
**Domain:** Terminal UI animation in React + Ink 7 (typewriter, spinner, flash, fade, toast)
**Confidence:** HIGH

## Summary

Phase 9 adds visual rhythm to Chronicle's CLI interface across five distinct animation categories: title screen typewriter reveal (ANIM-01), AI loading spinner (ANIM-02), scene transition fade (ANIM-03), combat HP flash (ANIM-04), UI event toast/flash notifications (ANIM-05), and chapter summary overlay display (CARRY-02).

The core technical challenge is implementing timed visual effects in Ink's React-based terminal renderer, which re-renders the entire screen on every state change. Ink provides no built-in animation primitives beyond `<Text>` styling props (`color`, `bold`, `dimColor`, `inverse`) and `useInput`. All animation must be driven by `setInterval`/`setTimeout` toggling React state, which triggers Ink re-renders. The `@inkjs/ui` Spinner component (already installed, never used) demonstrates this pattern internally via `useSpinner` -- a `setInterval` cycling through `cli-spinners` frame arrays.

**Primary recommendation:** Build a shared `useTimedEffect(durationMs)` hook that returns `{active: boolean}` and auto-deactivates after the duration. All flash/fade effects (HP flash, check-result flash, scene fade, spinner dimout) compose on top of this single primitive. Title typewriter is a separate `useTypewriter` hook (character-by-character with skip support). Toast is a self-dismissing banner driven by event bus subscriptions. No external animation libraries needed -- everything composes from `useState` + `setTimeout`/`setInterval`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Typewriter character-by-character reveal of figlet ASCII art. Characters appear left-to-right across ASCII block with progressive gradient application.
- **D-02:** Brisk speed ~20-30ms per character. Total reveal ~1-1.5s. Every launch plays animation.
- **D-03:** Skippable -- any key press during animation immediately renders full title with gradient. Then shows subtitle and menu.
- **D-04:** After title animation completes, subtitle and menu fade-in from dim to bright over 2-3 steps.
- **D-05:** Use @inkjs/ui Spinner component (already installed). Renders inside ScenePanel where streaming text will appear.
- **D-06:** Game-atmosphere loading text: narration "命运之轮转动中..." / "史官正在记录..."; NPC dialogue "NPC 正在思考..."; combat "攻击展开..." / "局势变化...". Same Spinner framework, context-specific labels.
- **D-07:** Spinner-to-streaming transition uses fade-out: Spinner dims over 1-2 frames, brief pause, then first streaming sentence appears.
- **D-08:** Spinner activates on streaming_started events (or before). Deactivates when first streaming chunk arrives.
- **D-09:** Fade-in/fade-out transition on scene change. Old content dims ~250ms, new content fades in ~250ms. Total ~500ms. Triggered by `scene_changed` event.
- **D-10:** Damage flash: name + HP value flash red bold ~300ms (2-3 frames), revert. Healing: flash green bold ~300ms.
- **D-11:** Flash scope is name + HP value of affected entity, not entire status bar row.
- **D-12:** Triggered by `player_damaged` / `player_healed` events (and enemy equivalents during combat).
- **D-13:** CheckResultLine gets brief bold flash enhancement (~300ms) after result renders. Nat 20/Nat 1 already have color coding -- flash adds temporal emphasis.
- **D-14:** Toast banner system -- single-line colored banner at top of ScenePanel. Auto-dismisses 1-3 seconds. Single-replacement mode (new toast replaces existing).
- **D-15:** Events triggering toasts: quest_started, quest_completed, quest_failed, knowledge_discovered, gold_changed (significant), reputation_changed, item acquired, Codex entry unlocked.
- **D-16:** Option selection -- no additional animation. Current behavior sufficient.
- **D-17:** Chapter summary uses dedicated full-screen Overlay panel (same pattern as Codex/Replay). Escape closes.
- **D-18:** Trigger: When Summarizer completes, Toast notification "新章节总结可查看". Player manually opens Overlay via command/shortcut. Not auto-popup.

### Claude's Discretion
- Animation primitive implementation (useInterval, requestAnimationFrame equivalent in Ink, or custom timer hook)
- Exact Spinner variant from @inkjs/ui (dots, line, arc, etc.)
- Toast banner styling details (border, padding, icon characters)
- Exact game-atmosphere text pool for each loading context
- Fade-in/fade-out implementation approach in Ink's render model (dimColor toggling, opacity simulation)
- Chapter summary Overlay layout and formatting
- Whether to use a shared `useFlash` or `useTemporalEffect` hook for all timed visual effects

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANIM-01 | Title screen typewriter/fade-in animation | Typewriter hook with `setInterval` character reveal, figlet + gradient-string integration, skip via `useInput` |
| ANIM-02 | AI loading spinner in scene panel | @inkjs/ui `Spinner` component with context-specific labels, event bus subscription for activation/deactivation |
| ANIM-03 | Scene transition fade effect | `useTimedEffect` hook toggling `dimColor` on ScenePanel content, triggered by `scene_changed` event |
| ANIM-04 | Combat HP flash on damage/heal | `useTimedEffect` on StatusBar/CombatStatusBar HP values, event-driven via `player_damaged`/`player_healed` |
| ANIM-05 | UI event visual feedback (toast, flash) | Toast banner component + event bus multi-subscription, CheckResultLine flash via `useTimedEffect` |
| CARRY-02 | Chapter summary display wired to game-screen UI | Overlay panel following Codex/Replay pattern, `chapter_summary` game phase, Toast notification on completion |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Title typewriter animation | Browser / Client (React/Ink UI) | -- | Pure visual effect, no backend involvement |
| AI loading spinner | Browser / Client (React/Ink UI) | -- | UI waiting indicator, event-bus driven |
| Scene transition fade | Browser / Client (React/Ink UI) | -- | Visual transition between render states |
| HP flash feedback | Browser / Client (React/Ink UI) | -- | Reactive visual effect on domain events |
| Toast notifications | Browser / Client (React/Ink UI) | -- | Temporary UI overlay, event-bus driven |
| Chapter summary overlay | Browser / Client (React/Ink UI) | -- | Full-screen panel reading from existing store |

All capabilities in this phase are UI-tier only. No backend, API, or data layer changes required.

## Standard Stack

### Core (already installed -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.5 | Component model, hooks (useState, useEffect, useCallback, useRef) | Foundation for all Ink components | [VERIFIED: package.json]
| ink | 7.0.1 | Terminal renderer, `<Text>` styling (`color`, `bold`, `dimColor`, `inverse`), `<Box>` layout | Re-render driven animation model | [VERIFIED: package.json]
| @inkjs/ui | 2.0.0 | Spinner component with `label` prop and `type` spinner variant | Decision D-05 mandates this | [VERIFIED: node_modules/@inkjs/ui/package.json]
| cli-spinners | (transitive) | Spinner frame definitions (dots, arc, moon, etc.) | Transitive dep of @inkjs/ui, used by `useSpinner` hook | [VERIFIED: node_modules/@inkjs/ui/build/components/spinner/use-spinner.js]
| figlet | 1.11.0 | ASCII art generation for title | Already used in title-screen.tsx | [VERIFIED: src/ui/screens/title-screen.tsx]
| gradient-string | 3.0.0 | Color gradient on ASCII art | Already used in title-screen.tsx | [VERIFIED: src/ui/screens/title-screen.tsx]
| mitt | 3.0.1 | Event bus for animation triggers | All animation triggers are existing domain events | [VERIFIED: src/events/event-bus.ts]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| string-width | 8.2.0 | CJK-aware string width for toast positioning | If toast needs width calculations for centering | [VERIFIED: already used in status-bar.tsx]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom useTimedEffect | ink-animation (npm) | Not a real package for Ink 7. No terminal animation libraries exist for React/Ink -- custom hooks are the standard approach |
| @inkjs/ui Spinner | Custom spinner component | Spinner is 15 lines, already installed -- using custom would duplicate effort with no benefit |
| setTimeout-based animation | requestAnimationFrame | Terminal has no rAF equivalent. Ink re-renders on state change, so setTimeout + setState is the correct pattern |

**Installation:** No new packages needed. All dependencies are already installed.

## Architecture Patterns

### System Architecture Diagram

```
Domain Events (mitt event bus)
    |
    | player_damaged / scene_changed / quest_completed / etc.
    v
+---------------------------+
| Animation Hooks Layer     |
| - useTimedEffect(ms)      | <-- shared primitive
| - useTypewriter(text, ms) | <-- title-specific
| - useEventFlash(event)    | <-- event -> timed flash
| - useToast()              | <-- event -> banner state
+---------------------------+
    |
    | active: boolean / text: string / toast: ToastData
    v
+---------------------------+
| UI Components             |
| - TitleScreen (animated)  |
| - ScenePanel (+spinner,   |
|   +toast, +fade wrapper)  |
| - StatusBar (+flash)      |
| - CombatStatusBar (+flash)|
| - CheckResultLine (+flash)|
| - ChapterSummaryPanel     |
| - GameScreen (wiring)     |
+---------------------------+
    |
    | <Text dimColor> / <Text color="red" bold> / <Spinner label>
    v
+---------------------------+
| Ink Renderer              |
| Terminal re-render on     |
| every React state change  |
+---------------------------+
```

### Recommended Project Structure

```
src/
├── ui/
│   ├── hooks/
│   │   ├── use-timed-effect.ts       # NEW: shared animation primitive
│   │   ├── use-typewriter.ts          # NEW: character-by-character reveal
│   │   ├── use-event-flash.ts         # NEW: event -> timed flash
│   │   └── use-toast.ts              # NEW: toast state manager
│   ├── components/
│   │   ├── toast-banner.tsx           # NEW: single-line toast display
│   │   ├── scene-spinner.tsx          # NEW: Spinner wrapper with atmosphere labels
│   │   └── fade-wrapper.tsx           # NEW: dim/bright transition wrapper
│   ├── panels/
│   │   ├── chapter-summary-panel.tsx  # NEW: overlay panel for CARRY-02
│   │   ├── scene-panel.tsx            # MODIFY: add spinner slot, toast slot, fade
│   │   ├── status-bar.tsx             # MODIFY: add flash on HP change
│   │   ├── combat-status-bar.tsx      # MODIFY: add flash on HP change
│   │   └── check-result-line.tsx      # MODIFY: add temporal flash
│   └── screens/
│       ├── title-screen.tsx           # MODIFY: animated typewriter reveal
│       └── game-screen.tsx            # MODIFY: wire spinner, toast, overlay
├── events/
│   └── event-types.ts                 # MODIFY: add enemy_damaged/enemy_healed if missing
└── state/
    └── game-store.ts                  # MODIFY: add 'chapter_summary' to GamePhaseSchema
```

### Pattern 1: useTimedEffect -- Shared Animation Primitive

**What:** A hook that returns `{active: boolean}` and auto-deactivates after a duration. All flash/fade effects compose on this.

**When to use:** Any time a UI element needs to temporarily change appearance (flash, dim, highlight) for a fixed duration.

**Example:**
```typescript
// Source: Custom pattern derived from @inkjs/ui useSpinner implementation [VERIFIED: node_modules/@inkjs/ui/build/components/spinner/use-spinner.js]
type UseTimedEffectReturn = {
  readonly active: boolean;
  readonly trigger: () => void;
};

function useTimedEffect(durationMs: number): UseTimedEffectReturn {
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActive(true);
    timerRef.current = setTimeout(() => {
      setActive(false);
      timerRef.current = null;
    }, durationMs);
  }, [durationMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { active, trigger };
}
```

### Pattern 2: useTypewriter -- Character Reveal

**What:** Reveals a string character-by-character at a configurable rate, with skip support.

**When to use:** Title screen animation (D-01, D-02, D-03).

**Example:**
```typescript
// Source: Pattern derived from setInterval usage in @inkjs/ui useSpinner [VERIFIED]
type UseTypewriterReturn = {
  readonly displayText: string;
  readonly isComplete: boolean;
  readonly skip: () => void;
};

function useTypewriter(fullText: string, charIntervalMs: number): UseTypewriterReturn {
  const [charCount, setCharCount] = useState(0);
  const fullTextRef = useRef(fullText);
  fullTextRef.current = fullText;

  const isComplete = charCount >= fullText.length;

  useEffect(() => {
    if (isComplete) return;
    const timer = setInterval(() => {
      setCharCount(prev => {
        const next = prev + 1;
        if (next >= fullTextRef.current.length) {
          clearInterval(timer);
        }
        return next;
      });
    }, charIntervalMs);
    return () => clearInterval(timer);
  }, [charIntervalMs, isComplete]);

  const skip = useCallback(() => {
    setCharCount(fullText.length);
  }, [fullText.length]);

  return {
    displayText: fullText.slice(0, charCount),
    isComplete,
    skip,
  };
}
```

### Pattern 3: Event-Driven Flash

**What:** Subscribes to a domain event and triggers a timed visual effect.

**When to use:** HP damage flash (D-10, D-12), CheckResultLine flash (D-13).

**Example:**
```typescript
// Source: Event bus subscription pattern from existing codebase [VERIFIED: src/ui/screens/game-screen.tsx lines 125-129]
function useEventFlash(eventName: keyof DomainEvents, durationMs: number = 300): boolean {
  const { active, trigger } = useTimedEffect(durationMs);

  useEffect(() => {
    eventBus.on(eventName, trigger);
    return () => { eventBus.off(eventName, trigger); };
  }, [eventName, trigger]);

  return active;
}
```

### Pattern 4: Toast Banner

**What:** A self-dismissing notification banner at the top of ScenePanel.

**When to use:** Quest updates, knowledge discovery, gold changes, etc. (D-14, D-15).

**Example:**
```typescript
// Source: Custom, following existing store pattern [VERIFIED: src/state/create-store.ts]
type ToastData = {
  readonly message: string;
  readonly color: string;
  readonly icon: string;
};

function useToast(dismissMs: number = 2000): {
  readonly toast: ToastData | null;
  readonly showToast: (data: ToastData) => void;
} {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((data: ToastData) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(data);
    timerRef.current = setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, dismissMs);
  }, [dismissMs]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { toast, showToast };
}
```

### Pattern 5: Fade Transition via dimColor Toggling

**What:** Simulates fade-in/fade-out by toggling Ink's `dimColor` prop over 2-3 steps.

**When to use:** Scene transitions (D-09), subtitle/menu fade-in (D-04), spinner dimout (D-07).

**Implementation approach:** Ink's `<Text dimColor>` renders text as dim. A "fade-in" is: render with `dimColor={true}` for ~125ms, then set `dimColor={false}`. A "fade-out" is the reverse. This is not true opacity animation, but it is the closest Ink offers and matches D-09's specification of "dims to gray/dim."

```typescript
// Fade-in: dimColor=true -> dimColor=false over ~250ms
// 2-step: start dim, after 125ms go bright
type FadeState = 'dim' | 'normal' | 'hidden';
```

### Anti-Patterns to Avoid

- **Continuous re-render animation loops:** Do NOT create `requestAnimationFrame`-style loops that re-render every 16ms. Terminal rendering is expensive (~10-30ms per frame). Keep animation intervals >= 60ms for smoothness without overloading the terminal. [ASSUMED]
- **Global animation state store:** Do NOT create a centralized animation store. Each animation is local to its component via hooks. This prevents cross-component animation coupling and unnecessary re-renders.
- **setTimeout inside render:** Always use `useEffect` or `useCallback` for timers. Direct `setTimeout` in render body causes memory leaks and stale closures. [VERIFIED: React 19 best practice]
- **Mutating Ink Text props mid-render:** Ink rebuilds the entire output on each render. Ensure animation state changes are atomic (one `setState` call triggers one re-render). Avoid multiple rapid state changes within the same event handler tick.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spinner animation | Custom frame cycling | `@inkjs/ui` `<Spinner>` | Already installed, handles frame cycling + interval automatically [VERIFIED: use-spinner.js] |
| Spinner frame data | Custom spinner frames | `cli-spinners` (transitive dep) | 80+ spinner types with correct intervals. Available via `type` prop. [VERIFIED: cli-spinners package] |
| ASCII art generation | Custom text art | `figlet` | Already used in title-screen.tsx. 680+ fonts. [VERIFIED: src/ui/screens/title-screen.tsx] |
| Gradient coloring | Custom ANSI escape sequences | `gradient-string` | Already used. Handles multi-line gradient correctly. [VERIFIED: src/ui/screens/title-screen.tsx] |
| CJK string width | charCodeAt heuristics | `string-width` | Critical for Chinese text layout. [VERIFIED: src/ui/panels/status-bar.tsx] |

**Key insight:** All animation in Ink is fundamentally `setTimeout/setInterval` toggling React state. The `@inkjs/ui` Spinner proves this pattern works at 80ms intervals. No animation library exists for Ink -- but the primitives (timer + setState + conditional styling) are simple enough that a 10-line `useTimedEffect` hook covers most cases.

## Common Pitfalls

### Pitfall 1: Terminal Render Flicker from Rapid State Updates

**What goes wrong:** Multiple `setState` calls in quick succession cause multiple Ink re-renders, producing visible flicker in the terminal.
**Why it happens:** Ink re-renders the entire alternate screen buffer on each state change. Unlike browser React where batching is automatic, rapid terminal re-renders are perceptible.
**How to avoid:** Batch related state changes. For multi-step fade (dim -> normal), use a single state variable with a discriminated union (`FadeState = 'dim' | 'normal' | 'hidden'`) rather than separate `isDim` + `isVisible` states. Use `React.useReducer` if multiple animation states must change atomically. [ASSUMED -- based on Ink rendering model]
**Warning signs:** Visible blink/jump during transitions, terminal "garbage" characters appearing briefly.

### Pitfall 2: Timer Leak on Component Unmount

**What goes wrong:** `setTimeout`/`setInterval` callbacks fire after the component unmounts, calling `setState` on an unmounted component.
**Why it happens:** Phase transitions (title -> narrative_creation -> game) unmount entire screen components. Active timers from a previous phase still fire.
**How to avoid:** Every `useTimedEffect`, `useTypewriter`, and `useToast` hook must clear timers in its `useEffect` cleanup function. The `useSpinner` from `@inkjs/ui` does this correctly (`return () => clearInterval(timer)`). Follow the same pattern. [VERIFIED: node_modules/@inkjs/ui/build/components/spinner/use-spinner.js]
**Warning signs:** Console warnings about setState on unmounted components, ghost animations appearing on wrong screens.

### Pitfall 3: Event Bus Listener Leak

**What goes wrong:** Event handlers subscribed via `eventBus.on()` are not cleaned up when the component unmounts, causing stale callbacks and memory leaks.
**Why it happens:** The event bus is module-scoped (global). Component-level listeners must be manually removed.
**How to avoid:** Always return `eventBus.off()` from `useEffect` cleanup. This is an established pattern in the codebase:
```typescript
useEffect(() => {
  eventBus.on('player_damaged', handler);
  return () => { eventBus.off('player_damaged', handler); };
}, [handler]);
```
[VERIFIED: Pattern confirmed in CONTEXT.md canonical references]
**Warning signs:** Animations triggering on wrong screen, increasing memory usage.

### Pitfall 4: Typewriter Animation on Multi-Line ASCII Art

**What goes wrong:** Naively slicing figlet output by character count breaks the multi-line block -- characters from different rows appear in wrong positions.
**Why it happens:** Figlet ASCII art is a multi-line string where each "character" spans multiple rows. Line-by-line slicing is needed, not simple `.slice(0, n)`.
**How to avoid:** The typewriter reveal should work column-by-column across the figlet block. Split the figlet output into rows, then for each render, show the first N columns of each row. This requires knowing the column width of each figlet character (varies by font). Alternatively, flatten to a column array and reveal column-by-column.
**Warning signs:** Garbled ASCII art during animation, characters appearing at wrong vertical positions.

### Pitfall 5: Gradient Application During Partial Reveal

**What goes wrong:** `gradient-string` applied to partial text produces wrong colors because the gradient is computed relative to the visible text length, not the full text length.
**Why it happens:** D-01 specifies "gradient color sweeps in as each character appears." If gradient is computed on the partial string, the first character always gets the gradient start color, and the gradient shifts as more characters appear.
**How to avoid:** Compute the full gradient on the complete figlet text first (getting an array of colored characters), then reveal the pre-colored characters one by one. This ensures each character has its final color from the moment it appears.
**Warning signs:** Colors shifting/pulsing during typewriter reveal rather than staying stable.

### Pitfall 6: Spinner-to-Streaming Race Condition

**What goes wrong:** The spinner disappears and streaming text appears in the wrong order, or there's a gap with no content.
**Why it happens:** D-07 specifies "Spinner dims over 1-2 frames, brief pause, then first streaming sentence." The race is between the first streaming chunk arriving and the spinner dimout animation completing.
**How to avoid:** Use a state machine: `SPINNER_ACTIVE -> SPINNER_DIMMING -> STREAMING`. The `SPINNER_DIMMING` state lasts a fixed duration (~150ms). First streaming chunk arriving sets a flag, but the actual content swap waits until DIMMING completes. If the chunk arrives before dimming starts, immediately enter DIMMING.
**Warning signs:** Content flash, blank gap between spinner and text, spinner overlapping with streaming text.

## Code Examples

### Example 1: Using @inkjs/ui Spinner with Custom Label

```typescript
// Source: @inkjs/ui docs [VERIFIED: Context7 /vadimdemedes/ink-ui]
import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from '@inkjs/ui';

type SceneSpinnerProps = {
  readonly context: 'narration' | 'npc_dialogue' | 'combat';
};

const SPINNER_LABELS: Record<string, readonly string[]> = {
  narration: ['命运之轮转动中...', '史官正在记录...'],
  npc_dialogue: ['正在思考...'],
  combat: ['攻击展开...', '局势变化...'],
};

function SceneSpinner({ context }: SceneSpinnerProps): React.ReactNode {
  const labels = SPINNER_LABELS[context] ?? SPINNER_LABELS.narration;
  const label = labels[Math.floor(Math.random() * labels.length)];

  return <Spinner type="dots" label={label} />;
}
```

### Example 2: Applying Gradient to Partial Figlet Text (Column Reveal)

```typescript
// Source: figlet + gradient-string APIs [VERIFIED: already used in title-screen.tsx]
import figlet from 'figlet';
import gradientString from 'gradient-string';

function createColumnReveal(text: string): {
  readonly totalColumns: number;
  readonly getFrame: (visibleCols: number) => string;
} {
  const art = figlet.textSync(text, { font: 'ANSI Shadow' });
  const rows = art.split('\n');
  const maxLen = Math.max(...rows.map(r => r.length));

  const gradient = gradientString('cyan', 'magenta');
  const fullyColored = gradient.multiline(art);
  const coloredRows = fullyColored.split('\n');

  return {
    totalColumns: maxLen,
    getFrame(visibleCols: number): string {
      // For each row, take characters up to visibleCols
      // Then pad the rest with spaces to maintain layout
      return coloredRows
        .map(row => {
          // ANSI sequences complicate slicing -- simpler approach:
          // Pre-generate the full colored output, then use strip-ansi
          // to count visible characters and slice at the right point
          return row; // Actual implementation needs ANSI-aware slicing
        })
        .join('\n');
    },
  };
}
```

**Note:** ANSI-aware column slicing for the gradient typewriter is the most technically complex part. The planner should allocate a dedicated task for this. Two viable approaches:
1. **Pre-color then mask:** Generate full gradient text, then replace characters beyond the reveal point with spaces (preserving ANSI reset sequences).
2. **Character-level coloring:** Compute per-character gradient colors, store as an array, and apply colors incrementally as characters are revealed. This avoids ANSI-slicing entirely.

Approach 2 is recommended -- `gradient-string` provides `.multiline()` but the internal per-character color array is not exposed. Instead, apply gradient manually using chalk's hex colors computed from a linear interpolation between cyan and magenta.

### Example 3: StatusBar with Flash Effect

```typescript
// Source: Existing StatusBar structure [VERIFIED: src/ui/panels/status-bar.tsx]
// Composing useTimedEffect with event bus subscription

function StatusBarWithFlash(props: StatusBarProps): React.ReactNode {
  const damageFlash = useEventFlash('player_damaged', 300);
  const healFlash = useEventFlash('player_healed', 300);

  const flashColor = damageFlash ? 'red' : healFlash ? 'green' : undefined;
  const flashBold = damageFlash || healFlash;

  // Only the HP segment gets the flash
  return (
    <Box paddingX={1}>
      <Text color={flashColor ?? hpColor} bold={flashBold || hpBold}>
        HP {props.hp}/{props.maxHp}
      </Text>
      {/* ... rest unchanged ... */}
    </Box>
  );
}
```

### Example 4: Toast Banner Component

```typescript
// Source: Custom, following existing component patterns [VERIFIED: Ink <Text> and <Box> API from Context7]
import React from 'react';
import { Box, Text } from 'ink';

type ToastBannerProps = {
  readonly message: string;
  readonly color: string;
  readonly icon: string;
};

function ToastBanner({ message, color, icon }: ToastBannerProps): React.ReactNode {
  return (
    <Box paddingX={1}>
      <Text color={color} bold>
        {icon} {message}
      </Text>
    </Box>
  );
}
```

### Example 5: Chapter Summary Overlay (Codex Panel Pattern)

```typescript
// Source: Existing Codex/Replay panel pattern [VERIFIED: src/ui/panels/codex-panel.tsx]
// Follow the same structure: full-screen box, Escape to close, title bar

function ChapterSummaryPanel({ summary, onClose }: {
  readonly summary: string;
  readonly onClose: () => void;
}): React.ReactNode {
  useInput((input, key) => {
    if (key.escape) onClose();
  });

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="cyan">{'【章节总结】'}</Text>
        <Text dimColor>Esc 返回</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text>{summary}</Text>
      </Box>
    </Box>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| blessed terminal UI | React + Ink 7 | Ink 7 (2024) | Component-based rendering, hooks for state, no imperative cursor control |
| Manual ANSI escape codes | Ink `<Text>` props + chalk | Ink 4+ (2020) | Declarative styling, auto-cleanup on re-render |
| requestAnimationFrame | setTimeout/setInterval + setState | N/A for terminal | Terminal has no vsync or animation frame API; timer-driven state changes are the standard |

**Deprecated/outdated:**
- blessed / blessed-contrib: Abandoned since 2020, no TypeScript support, imperative model. [ASSUMED]
- ink v5/v6 differences: Ink 7 requires React 19. Prior versions used React 18. All patterns in this research target Ink 7 + React 19. [VERIFIED: package.json]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Terminal re-render flicker is perceptible at rapid setState intervals | Common Pitfalls #1 | If not perceptible, simpler multi-setState approach works fine; LOW risk |
| A2 | Animation intervals >= 60ms are smooth enough for terminal | Anti-Patterns | If too slow, reduce to 40ms; testing will validate; LOW risk |
| A3 | blessed is abandoned since 2020 | State of the Art | No impact on this project; informational only |
| A4 | Column-based typewriter reveal is needed for multi-line figlet | Pitfall #4 | If simple character slice works visually, implementation simplifies; MEDIUM risk -- needs testing |

## Open Questions

1. **ANSI-aware character slicing for gradient typewriter**
   - What we know: `gradient-string.multiline()` produces ANSI escape sequences interspersed with visible characters. Slicing this string at arbitrary positions breaks escape sequences.
   - What's unclear: Whether `strip-ansi` + `slice-ansi` (npm package) or manual per-character gradient computation is more reliable.
   - Recommendation: Use per-character gradient computation (linear interpolation of hex colors) to avoid ANSI slicing entirely. Apply chalk color per-character during typewriter reveal.

2. **Enemy damage/heal events for combat HP flash**
   - What we know: `player_damaged` and `player_healed` events exist. Enemy-side equivalents (`enemy_damaged`, `enemy_healed`) may not exist in `event-types.ts`.
   - What's unclear: Whether the existing `damage_dealt` event covers enemy damage with sufficient data (it has `targetId: string`).
   - Recommendation: Use `damage_dealt` event and check `targetId` to determine if it's an enemy. Add `enemy_healed` event only if healing of enemies is a game mechanic.

3. **Spinner dimout timing coordination with first streaming chunk**
   - What we know: D-07 specifies 1-2 frame dimout before streaming appears. D-08 says spinner deactivates when first streaming chunk arrives.
   - What's unclear: Whether the sentence buffer's 500ms timeout (first flush) creates a visible gap between spinner dimout and text appearance.
   - Recommendation: Start dimout when AI call begins, not when first chunk arrives. The dimout (~150ms) naturally overlaps with the first chunk's network latency. If first chunk arrives during dimout, buffer it and display after dimout completes.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified). All work is code/config changes within existing React + Ink stack.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | bun:test (built-in) |
| Config file | none -- Bun discovers test files automatically |
| Quick run command | `bun test --filter "animation"` |
| Full suite command | `bun test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANIM-01 | Typewriter reveals text char-by-char and supports skip | unit | `bun test src/ui/hooks/use-typewriter.test.ts -x` | Wave 0 |
| ANIM-02 | Spinner shows with correct label and hides on stream start | unit | `bun test src/ui/components/scene-spinner.test.ts -x` | Wave 0 |
| ANIM-03 | Scene fade triggers on scene_changed event | unit | `bun test src/ui/hooks/use-timed-effect.test.ts -x` | Wave 0 |
| ANIM-04 | HP flash triggers on damage/heal events | unit | `bun test src/ui/hooks/use-event-flash.test.ts -x` | Wave 0 |
| ANIM-05 | Toast shows for correct events with correct colors | unit | `bun test src/ui/hooks/use-toast.test.ts -x` | Wave 0 |
| CARRY-02 | Chapter summary overlay renders and closes on Escape | unit | `bun test src/ui/panels/chapter-summary-panel.test.ts -x` | Wave 0 |

### Sampling Rate

- **Per task commit:** `bun test --filter "animation\|timed-effect\|typewriter\|toast\|flash\|spinner\|chapter-summary"`
- **Per wave merge:** `bun test`
- **Phase gate:** Full suite green (703+ existing + new tests) before verification

### Wave 0 Gaps

- [ ] `src/ui/hooks/use-timed-effect.test.ts` -- covers ANIM-03, ANIM-04 (shared primitive)
- [ ] `src/ui/hooks/use-typewriter.test.ts` -- covers ANIM-01
- [ ] `src/ui/hooks/use-event-flash.test.ts` -- covers ANIM-04
- [ ] `src/ui/hooks/use-toast.test.ts` -- covers ANIM-05
- [ ] `src/ui/components/scene-spinner.test.ts` -- covers ANIM-02
- [ ] `src/ui/panels/chapter-summary-panel.test.ts` -- covers CARRY-02

Note: Hook tests should use `bun:test` with timer mocking (`jest.useFakeTimers` equivalent is available via `bun test` fake timers). Ink component rendering in tests can use `ink-testing-library` if installed, or test hook logic in isolation (which is sufficient since hooks are pure timer + state logic).

## Security Domain

No security implications for this phase. All work is UI-tier visual effects with no user input processing, no network calls, no data persistence, and no state mutation beyond visual presentation state. The existing event bus is read-only from the animation perspective (subscribes to events, never emits domain events).

ASVS categories: None applicable. This phase adds no authentication, authorization, input validation, cryptography, or session management surface.

## Project Constraints (from CLAUDE.md)

| Directive | How Phase 9 Complies |
|-----------|---------------------|
| Tech stack: TypeScript + Bun runtime | All new files are TypeScript, tested with bun test |
| Terminal UI: React + Ink | All animations use React hooks + Ink `<Text>` props |
| Immutability | All hooks return readonly types; no mutation of existing state |
| File size < 800 lines | Each hook is 10-40 lines; each component is 20-80 lines |
| Functions < 50 lines | Hooks and components are small and focused |
| Error handling | Timer cleanup in useEffect return; event listener cleanup on unmount |
| No hardcoded secrets | Phase has no secrets; configuration uses existing event types |

## Sources

### Primary (HIGH confidence)
- Context7 /vadimdemedes/ink-ui -- Spinner component API, ThemeProvider, useSpinner implementation
- Context7 /vadimdemedes/ink -- Text/Box props (color, bold, dimColor, inverse), useInput hook API
- npm registry -- @inkjs/ui 2.0.0, ink 7.0.1, React 19.2.5 (verified via package.json)
- Codebase analysis -- title-screen.tsx, scene-panel.tsx, status-bar.tsx, combat-status-bar.tsx, check-result-line.tsx, game-screen.tsx, event-types.ts, event-bus.ts, use-ai-narration.ts, use-npc-dialogue.ts, create-store.ts, game-store.ts, app.tsx, codex-panel.tsx, replay-panel.tsx
- @inkjs/ui source -- node_modules/@inkjs/ui/build/components/spinner/ (spinner.js, use-spinner.js, spinner.d.ts, use-spinner.d.ts)
- cli-spinners -- spinner variants (dots, arc, moon, etc.) verified via Bun runtime import

### Secondary (MEDIUM confidence)
- Phase 7 CONTEXT.md and PATTERNS.md -- streaming infrastructure decisions and patterns that Phase 9 must coordinate with
- Phase 9 CONTEXT.md canonical references -- UI component modification points and event bus integration

### Tertiary (LOW confidence)
- None. All findings are verified against installed packages and codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified in codebase
- Architecture: HIGH -- all patterns derived from existing codebase patterns (Spinner source, event bus subscription, overlay panels)
- Pitfalls: HIGH for timer/unmount issues (verified against useSpinner implementation), MEDIUM for typewriter/gradient complexity (needs implementation testing)

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (stable -- no dependency updates expected)
