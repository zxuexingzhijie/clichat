# Phase 9: Animation System - Pattern Map

**Mapped:** 2026-04-25
**Files analyzed:** 17 (7 new, 10 modified)
**Analogs found:** 17 / 17

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/ui/hooks/use-timed-effect.ts` | hook | event-driven | `src/ui/hooks/use-ai-narration.ts` | role-match |
| `src/ui/hooks/use-typewriter.ts` | hook | transform | `src/ui/hooks/use-ai-narration.ts` | role-match |
| `src/ui/hooks/use-event-flash.ts` | hook | event-driven | `src/ui/hooks/use-ai-narration.ts` | role-match |
| `src/ui/hooks/use-toast.ts` | hook | event-driven | `src/ui/hooks/use-ai-narration.ts` | role-match |
| `src/ui/components/toast-banner.tsx` | component | request-response | `src/ui/components/divider.tsx` | role-match |
| `src/ui/components/scene-spinner.tsx` | component | request-response | `src/ui/components/divider.tsx` | role-match |
| `src/ui/panels/chapter-summary-panel.tsx` | panel (overlay) | request-response | `src/ui/panels/replay-panel.tsx` | exact |
| `src/ui/screens/title-screen.tsx` | screen | transform | self (current version) | exact |
| `src/ui/panels/scene-panel.tsx` | panel | request-response | self (current version) | exact |
| `src/ui/panels/status-bar.tsx` | panel | request-response | self (current version) | exact |
| `src/ui/panels/combat-status-bar.tsx` | panel | request-response | self (current version) | exact |
| `src/ui/panels/check-result-line.tsx` | panel | request-response | self (current version) | exact |
| `src/ui/screens/game-screen.tsx` | screen (wiring) | event-driven | self (current version) | exact |
| `src/events/event-types.ts` | type-def | n/a | self (current version) | exact |
| `src/state/game-store.ts` | store | event-driven | self (current version) | exact |
| `src/ui/hooks/use-timed-effect.test.ts` | test | n/a | `src/ui/hooks/use-game-input.test.ts` | role-match |
| `src/ui/hooks/use-typewriter.test.ts` | test | n/a | `src/ui/hooks/use-game-input.test.ts` | role-match |

## Pattern Assignments

### `src/ui/hooks/use-timed-effect.ts` (hook, event-driven) -- NEW

**Analog:** `src/ui/hooks/use-ai-narration.ts`

**Imports pattern** (lines 1-2):
```typescript
import { useState, useCallback, useRef } from 'react';
```

**Hook return type pattern** (lines 8-15):
```typescript
export type UseAiNarrationReturn = {
  readonly streamingText: string;
  readonly isStreaming: boolean;
  readonly error: Error | null;
  readonly startNarration: (context: NarrativeContext) => void;
  readonly skipToEnd: () => void;
  readonly reset: () => void;
};
```

**Timer cleanup pattern** -- use `useRef` for timer IDs and cleanup in `useEffect` return:
```typescript
// From use-ai-narration.ts lines 21-24 -- ref-based mutable state for timers
const cancelledRef = useRef(false);
const skippedRef = useRef(false);
const fullTextRef = useRef('');
const bufferRef = useRef<SentenceBuffer | null>(null);
```

**Key convention:** All hooks export a named return type (`UseXxxReturn`) and use `readonly` on all fields.

---

### `src/ui/hooks/use-typewriter.ts` (hook, transform) -- NEW

**Analog:** `src/ui/hooks/use-ai-narration.ts`

**Same imports and ref pattern as `use-timed-effect`.**

**Streaming text accumulation pattern** (lines 30-38):
```typescript
// Accumulate text progressively via setState callback
setStreamingText(prev => prev + text);
```

**Skip-to-end pattern** (lines 70-77):
```typescript
const skipToEnd = useCallback(() => {
  if (!skippedRef.current && isStreaming) {
    skippedRef.current = true;
    bufferRef.current?.flush();
    bufferRef.current?.dispose();
    setStreamingText(fullTextRef.current);
  }
}, [isStreaming]);
```

**useInput integration for skip** -- from `src/ui/screens/title-screen.tsx` (lines 21-25):
```typescript
const handleInput = useCallback(() => {
  onStart();
}, [onStart]);

useInput(handleInput);
```

---

### `src/ui/hooks/use-event-flash.ts` (hook, event-driven) -- NEW

**Analog:** `src/ui/hooks/use-ai-narration.ts` (event bus subscription pattern)

**Event bus subscription pattern** (lines 6, 40):
```typescript
import { eventBus } from '../../events/event-bus';

// In the hook body:
eventBus.emit('narration_streaming_started', { sceneType: context.sceneType });
```

**Event bus subscribe/cleanup pattern** -- from `src/ui/screens/game-screen.tsx` (lines 125-129):
```typescript
useEffect(() => {
  return costSessionStore.subscribe(() => {
    setLastTurnTokens(costSessionStore.getState().lastTurnTokens);
  });
}, []);
```

**Composes on `useTimedEffect`** -- the hook should import and call `useTimedEffect` internally, then wire `trigger` to `eventBus.on(eventName)`.

---

### `src/ui/hooks/use-toast.ts` (hook, event-driven) -- NEW

**Analog:** `src/ui/hooks/use-ai-narration.ts` + `src/events/event-types.ts`

**Same ref + timer cleanup pattern as `use-timed-effect`.**

**Event types for toast triggers** -- from `src/events/event-types.ts` (lines 46-64):
```typescript
quest_started: { questId: string; questTitle: string; turnNumber: number };
quest_completed: { questId: string; rewards: unknown };
quest_failed: { questId: string; reason: string };
reputation_changed: { targetId: string; targetType: 'npc' | 'faction'; delta: number; newValue: number };
gold_changed: { delta: number; newTotal: number };
knowledge_discovered: { entryId: string; codexEntryId: string | null; knowledgeStatus: string; turnNumber: number };
```

**Multi-event subscription pattern** -- subscribe to multiple events in a single `useEffect`, clean up all:
```typescript
// Derived from game-screen.tsx event pattern
useEffect(() => {
  const handlers = [
    ['quest_started', handler1],
    ['quest_completed', handler2],
    // ...
  ] as const;
  for (const [event, handler] of handlers) {
    eventBus.on(event, handler);
  }
  return () => {
    for (const [event, handler] of handlers) {
      eventBus.off(event, handler);
    }
  };
}, []);
```

---

### `src/ui/components/toast-banner.tsx` (component, request-response) -- NEW

**Analog:** `src/ui/components/divider.tsx`

**Component pattern** (lines 1-11):
```typescript
import React from 'react';
import { Text } from 'ink';

type DividerProps = {
  readonly width: number;
};

export function Divider({ width }: DividerProps): React.ReactNode {
  const inner = '─'.repeat(Math.max(0, width - 2));
  return <Text>{'├' + inner + '┤'}</Text>;
}
```

**Color semantics** -- from `src/ui/panels/status-bar.tsx` (lines 41-42):
```typescript
const hpColor = hpRatio < 0.1 ? 'red' : hpRatio < 0.25 ? 'yellow' : undefined;
const hpBold = hpRatio < 0.1;
```

**Project color conventions:** green=success, red=danger, yellow=warning, cyan=accent, dimColor=inactive.

---

### `src/ui/components/scene-spinner.tsx` (component, request-response) -- NEW

**Analog:** `src/ui/components/divider.tsx` (structure) + `@inkjs/ui` Spinner API

**Spinner import:**
```typescript
import { Spinner } from '@inkjs/ui';
```

**Label prop usage** (from @inkjs/ui docs):
```typescript
<Spinner type="dots" label={label} />
```

**Component structure:** Stateless, receives `context` prop ('narration' | 'npc_dialogue' | 'combat'), selects label from a constant map.

---

### `src/ui/panels/chapter-summary-panel.tsx` (panel/overlay, request-response) -- NEW

**Analog:** `src/ui/panels/replay-panel.tsx`

**Overlay panel structure** (lines 1-9):
```typescript
import React, { useCallback, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useScreenSize } from 'fullscreen-ink';
import type { TurnLogEntry } from '../../state/serializer';

type ReplayPanelProps = {
  readonly entries: readonly TurnLogEntry[];
  readonly onClose: () => void;
};
```

**Title bar + Escape close pattern** (lines 97-106):
```typescript
// Empty state rendering
<Box flexDirection="column" flexGrow={1} paddingX={1}>
  <Box justifyContent="space-between">
    <Text bold color="cyan">{'【回放】'}</Text>
    <Text dimColor>Esc 返回</Text>
  </Box>
  <Box marginTop={1} justifyContent="center">
    <Text dimColor>{'暂无回放记录'}</Text>
  </Box>
</Box>
```

**Escape key handling** (lines 69-77):
```typescript
useInput(useCallback((input: string, key: {
  upArrow: boolean;
  downArrow: boolean;
  escape: boolean;
  return: boolean;
}) => {
  if (key.escape) { onClose(); return; }
  // ...
}, [onClose]));
```

**Overlay header convention:** `<Text bold color="cyan">{'【标题】'}</Text>` + `<Text dimColor>Esc 返回</Text>` in a `justifyContent="space-between"` Box.

---

### `src/ui/screens/title-screen.tsx` (screen, transform) -- MODIFY

**Current file** (lines 1-53): 53 lines total. Modifications:
- Replace static figlet render with animated typewriter using `useTypewriter` hook
- Add `useInput` skip handler (currently `useInput` calls `onStart` on any key -- change to skip animation first, then `onStart`)
- Add subtitle/menu fade-in after typewriter completes

**figlet + gradient-string usage** (lines 10-16, 27):
```typescript
function generateTitleArt(): string | null {
  try {
    return figlet.textSync('CHRONICLE', { font: 'ANSI Shadow' });
  } catch {
    return null;
  }
}

const gradient = gradientString('cyan', 'magenta');
```

**Current render structure** (lines 29-52):
```typescript
<Box flexGrow={1} justifyContent="center" alignItems="center" flexDirection="column">
  {titleArt ? (
    <Text>{gradient.multiline(titleArt)}</Text>
  ) : (
    <Text bold color="cyan">CHRONICLE</Text>
  )}
  <Box marginTop={1}>
    <Text dimColor>{'— AI 驱动的命令行互动小说 —'}</Text>
  </Box>
  <Box marginTop={1}>
    <Text dimColor>{'按任意键开始 / Press any key'}</Text>
  </Box>
</Box>
```

---

### `src/ui/panels/scene-panel.tsx` (panel, request-response) -- MODIFY

**Current file** (lines 1-29): 29 lines. Modifications:
- Add Spinner slot (before streaming text, when waiting for AI)
- Add Toast banner slot (top of panel)
- Add fade wrapper (dimColor toggling for scene transitions)

**Current structure** (lines 10-28):
```typescript
export function ScenePanel({ lines, streamingText, isStreaming }: ScenePanelProps): React.ReactNode {
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {lines.length === 0 && !streamingText ? (
        <Text dimColor>周围一片寂静，什么也没有发生。</Text>
      ) : (
        <>
          {lines.map((line, i) => <Text key={i}>{line}</Text>)}
          {isStreaming && (
            <Text>
              {streamingText}
              <Text dimColor>...</Text>
            </Text>
          )}
        </>
      )}
    </Box>
  );
}
```

**New props needed:** `showSpinner`, `spinnerContext`, `toast`, `isDimmed`.

---

### `src/ui/panels/status-bar.tsx` (panel, request-response) -- MODIFY

**Current file** (lines 1-84): 84 lines. Modifications:
- Add HP flash effect (red on damage, green on heal) to the HP `<Text>` element

**HP rendering target** (lines 46-49):
```typescript
fields.push(
  <Text key="hp" color={hpColor} bold={hpBold}>
    HP {hp}/{maxHp}
  </Text>,
);
```

**New props or hook integration:** Add `damageFlash: boolean` and `healFlash: boolean` props (or use `useEventFlash` internally). Flash overrides `hpColor` and `hpBold` for ~300ms.

---

### `src/ui/panels/combat-status-bar.tsx` (panel, request-response) -- MODIFY

**Current file** (lines 1-91): 91 lines. Same flash treatment as `status-bar.tsx`.

**Player HP target** (lines 71-73):
```typescript
<Text color={hpColor} bold={hpBold}>
  ♥ {playerHp}/{playerMaxHp}
</Text>
```

**Enemy HP target** (lines 80-82):
```typescript
<Text color={enemyHpColor} bold={enemyHpBold}>
  ♥ {enemyHp}/{enemyMaxHp}
</Text>
```

---

### `src/ui/panels/check-result-line.tsx` (panel, request-response) -- MODIFY

**Current file** (lines 1-72): 72 lines. Add brief bold flash (~300ms) on initial render.

**Nat20/Nat1 rendering** (lines 39-57) -- already bold + colored, flash adds temporal emphasis:
```typescript
if (isNat20) {
  return (
    <Box>
      <Text color="green" bold>
        [D20: {roll}] + {attrLabel} {attributeModifier} = {total} vs DC {dc} → {gradeLabel}（天命所归！）
      </Text>
    </Box>
  );
}
```

**Normal result rendering** (lines 61-70) -- grade text gets flash:
```typescript
<Text color={gradeColor} bold={gradeBold}>{gradeLabel}</Text>
```

---

### `src/ui/screens/game-screen.tsx` (screen/wiring, event-driven) -- MODIFY

**Current file** (lines 1-536): 536 lines. Wiring point for spinner, toast, and chapter summary overlay.

**Overlay panel routing pattern** (lines 267, 369-439):
```typescript
const isInOverlayPanel = isInMap || isInCodex || isInBranchTree || isInCompare || isInShortcuts || isInReplay;

// Conditional rendering chain for panels:
: isInReplay
  ? <ReplayPanel entries={[...getLastReplayEntries()]} onClose={handlePanelClose} />
  : <ScenePanel lines={sceneLines} ... />;
```

**Add `chapter_summary` to the overlay chain** -- follow the same ternary pattern.

**Phase close pattern** (lines 259-265):
```typescript
const handlePanelClose = useCallback(() => {
  gameStore.setState(draft => { draft.phase = 'game'; });
}, []);
```

**Store import pattern** (lines 24-25):
```typescript
import { gameStore, type GameState } from '../../state/game-store';
import { costSessionStore } from '../../state/cost-session-store';
```

---

### `src/events/event-types.ts` (type-def) -- MODIFY

**Current file** (lines 1-66): Add `enemy_damaged` and `enemy_healed` events if needed for combat flash.

**Event type definition pattern** (lines 14-16):
```typescript
player_damaged: { amount: number; source: string };
player_healed: { amount: number; source: string };
gold_changed: { delta: number; newTotal: number };
```

---

### `src/state/game-store.ts` (store, event-driven) -- MODIFY

**Current file** (lines 1-43): Add `'chapter_summary'` to `GamePhaseSchema` enum.

**GamePhaseSchema pattern** (line 6):
```typescript
export const GamePhaseSchema = z.enum(['title', 'narrative_creation', 'game', 'combat', 'dialogue', 'journal', 'map', 'codex', 'branch_tree', 'compare', 'shortcuts', 'replay', 'cost']);
```

---

## Shared Patterns

### Event Bus Subscription in Hooks
**Source:** `src/ui/hooks/use-ai-narration.ts` lines 6, 40 + `src/ui/screens/game-screen.tsx` lines 125-129
**Apply to:** `use-event-flash.ts`, `use-toast.ts`, any hook that listens for domain events

```typescript
import { eventBus } from '../../events/event-bus';

// Subscribe in useEffect, return cleanup
useEffect(() => {
  const handler = (payload: SomeType) => { /* trigger effect */ };
  eventBus.on('event_name', handler);
  return () => { eventBus.off('event_name', handler); };
}, [handler]);
```

### Overlay Panel Structure
**Source:** `src/ui/panels/replay-panel.tsx` lines 62-186 + `src/ui/panels/codex-panel.tsx` lines 115-375
**Apply to:** `chapter-summary-panel.tsx`

```typescript
// Header: title + escape hint
<Box justifyContent="space-between">
  <Text bold color="cyan">{'【标题】'}</Text>
  <Text dimColor>Esc 返回</Text>
</Box>

// Escape handling
useInput(useCallback((input, key) => {
  if (key.escape) { onClose(); return; }
}, [onClose]));

// Props pattern
type XxxPanelProps = {
  readonly someData: SomeType;
  readonly onClose: () => void;
};
```

### Hook Export Convention
**Source:** `src/ui/hooks/use-ai-narration.ts` lines 8-15, 17
**Apply to:** All new hooks

```typescript
// Named return type with readonly fields
export type UseXxxReturn = {
  readonly fieldA: TypeA;
  readonly fieldB: TypeB;
};

// Named export (not default)
export function useXxx(): UseXxxReturn {
  // ...
}
```

### Component Export Convention
**Source:** `src/ui/components/divider.tsx`, `src/ui/panels/scene-panel.tsx`
**Apply to:** All new components

```typescript
// Readonly props type
type XxxProps = {
  readonly propA: TypeA;
  readonly propB: TypeB;
};

// Named export, React.ReactNode return type
export function Xxx({ propA, propB }: XxxProps): React.ReactNode {
  // ...
}
```

### Color Semantics
**Source:** `src/ui/panels/status-bar.tsx` lines 41-42, `src/ui/panels/check-result-line.tsx` lines 11-23
**Apply to:** `toast-banner.tsx`, any component with color-coded feedback

| Color | Meaning | Example |
|-------|---------|---------|
| `green` | success / heal | quest_completed, player_healed |
| `red` | danger / damage | quest_failed, player_damaged |
| `yellow` | warning / partial | partial_success, low HP |
| `cyan` | accent / active | panel titles, player turn |
| `dimColor` | inactive / secondary | hints, escape text |

### Game Phase Routing
**Source:** `src/ui/screens/game-screen.tsx` lines 137-142, 267
**Apply to:** `game-screen.tsx` modification for chapter_summary overlay

```typescript
// Phase flag extraction
const isInChapterSummary = gameState.phase === 'chapter_summary';

// Add to overlay check
const isInOverlayPanel = isInMap || isInCodex || ... || isInChapterSummary;

// Add to conditional render chain (before final ScenePanel fallback)
: isInChapterSummary
  ? <ChapterSummaryPanel summary={summaryText} onClose={handlePanelClose} />
```

## No Analog Found

No files in this phase lack analogs. Every new file has a strong pattern source in the existing codebase.

## Metadata

**Analog search scope:** `src/ui/hooks/`, `src/ui/components/`, `src/ui/panels/`, `src/ui/screens/`, `src/events/`, `src/state/`
**Files scanned:** 27 (all relevant UI, hook, event, and state files)
**Pattern extraction date:** 2026-04-25
