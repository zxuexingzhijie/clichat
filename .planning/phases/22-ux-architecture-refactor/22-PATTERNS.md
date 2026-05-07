# Phase 22: UX Architecture Refactor - Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 15 new/modified files
**Analogs found:** 15 / 15

**Primary context:** `22-CONTEXT.md`, `22-UI-SPEC.md`, `CLAUDE.md`, `DESIGN.md`. `22-RESEARCH.md` was checked and does not exist at mapping time.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/ui/screens/game-screen.tsx` | component/orchestrator | request-response + event-driven | `src/ui/screens/game-screen.tsx` current layout + `src/app.tsx` provider wiring | exact existing target |
| `src/ui/panels/scene-panel.tsx` rewritten in-place as NarrativeRenderer | component | streaming + request-response | `src/ui/panels/scene-panel.tsx` + `src/ui/panels/dialogue-panel.tsx` | exact existing target |
| `src/engine/game-screen-controller.ts` moved/adapted into InputProvider | controller/utility | request-response + event-driven | `src/engine/game-screen-controller.ts` | exact existing target |
| `src/ui/hooks/use-game-input.ts` | hook | event-driven | `src/ui/hooks/use-game-input.ts` + active `useInput` panels | exact existing target |
| `src/ui/hooks/use-ai-narration.ts` | hook | streaming | `src/ui/hooks/use-ai-narration.ts` + `src/ui/hooks/use-streaming-text.ts` | exact existing target |
| `src/ui/hooks/use-npc-dialogue.ts` | hook | streaming + event-driven | `src/ui/hooks/use-npc-dialogue.ts` | exact existing target |
| `src/ui/hooks/use-game-event-toasts.ts` | hook | event-driven | `src/ui/hooks/use-game-event-toasts.ts` | exact existing target |
| `src/ui/hooks/use-timed-effect.ts` | hook/utility | timing/event-driven | `src/ui/hooks/use-timed-effect.ts` | exact existing target |
| `src/app.tsx` | provider root/config | request-response + event-driven | `src/app.tsx` existing store provider nesting | exact existing target |
| `src/ui/providers/atmosphere-provider.tsx` (implied) | provider/store | event-driven + transform | `src/app.tsx` store contexts + `use-game-event-toasts.ts` + GameScreen quest derivation | role-match |
| `src/ui/providers/narrative-provider.tsx` (implied) | provider/store | streaming + event-driven | `use-ai-narration.ts`, `use-npc-dialogue.ts`, `use-streaming-text.ts` | role-match |
| `src/ui/providers/input-provider.tsx` (implied) | provider/controller | event-driven + request-response | `use-game-input.ts`, `game-screen-controller.ts`, GameScreen global `useInput` | role-match |
| `src/time/clock.ts` or equivalent clock abstraction (implied) | utility | timing | `use-timed-effect.ts`, `use-toast.ts`, `sentence-buffer.ts` timer patterns | partial |
| `src/ui/hooks/use-timed-effect.test.ts` / clock timing tests | test | timing | `src/ui/hooks/use-timed-effect.test.ts` | role-match |
| Provider/input/narrative tests (implied) | test | event-driven + streaming | `game-screen-controller.test.ts`, `use-streaming-text.test.ts`, `event-bus.test.ts` | role-match |

## Pattern Assignments

### `src/ui/screens/game-screen.tsx` (component/orchestrator, request-response + event-driven)

**Analog:** current `src/ui/screens/game-screen.tsx` and provider root in `src/app.tsx`.

**Imports pattern** (`src/ui/screens/game-screen.tsx` lines 1-39):
```typescript
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';

import { useScreenSize } from 'fullscreen-ink';
import { Divider } from '../components/divider';
import { TitleBar } from '../panels/title-bar';
import { PanelRouter } from '../panels/panel-router';
// ... type-only imports after runtime imports
import type { Store } from '../../state/create-store';
```

**Current anti-pattern to remove** (`src/ui/screens/game-screen.tsx` lines 85-123): GameScreen currently owns store reads, input state, narration streaming, NPC streaming, toast state, and timed effects. Phase 22 should move these into providers and leave GameScreen as a layout orchestrator.
```typescript
const gameState = GameStoreCtx.useStoreState((s) => s);
const playerState = PlayerStoreCtx.useStoreState((s) => s);
const sceneState = SceneStoreCtx.useStoreState((s) => s);
const dialogueState = DialogueStoreCtx.useStoreState((s) => s);
const combatState = CombatStoreCtx.useStoreState((s) => s);
const questState = QuestStoreCtx.useStoreState((s) => s);

const { width, height } = useScreenSize();
const { exit } = useApp();
const { inputMode, setInputMode, selectedActionIndex, setSelectedActionIndex, isTyping, inputValue, setInputValue } = useGameInput();
const { streamingText, isStreaming: isNarrationStreaming, error: narrationError, startNarration, skipToEnd: skipNarration, reset: resetNarration } = useAiNarration();
const { isStreaming: isNpcStreaming, skipToEnd: skipNpcDialogue, reset: resetNpcDialogue } = useNpcDialogue();
const { toast } = useGameEventToasts();
const { active: isSpinnerDimming, trigger: triggerSpinnerDimout } = useTimedEffect(300);
```

**Thin layout pattern to preserve** (`src/ui/screens/game-screen.tsx` lines 464-514 and 517-557): keep the responsive Ink layout stack and delegate all derived state/actions to provider hooks.
```typescript
if (isWide) {
  const actionsWidth = Math.min(WIDE_ACTIONS_WIDTH, Math.max(28, innerWidth - 48));
  const sceneWidth = innerWidth - actionsWidth - 1;

  return (
    <Box flexDirection="column" width={width} height={height} borderStyle="single">
      <TitleBar gameName="Chronicle CLI" day={gameState.day} timeOfDay={timeLabel} />
      <Divider width={innerWidth} />
      <Box flexGrow={1}>
        <Box width={sceneWidth} flexDirection="column">{scenePanelNode}</Box>
        <Text>{'│'}</Text>
        <Box width={actionsWidth} flexDirection="column">{actionsNode}</Box>
      </Box>
      <Divider width={innerWidth} />
      {statusBarNode}
      <Divider width={innerWidth} />
      <InputArea ... />
      {gameState.pendingQuit && <InlineConfirm ... />}
    </Box>
  );
}
```

**Error/guard pattern** (`src/ui/screens/game-screen.tsx` lines 79-83): provider-dependent components should fail fast with `ReferenceError` when required contexts are absent.
```typescript
const gameContextStore = React.useContext(GameStoreCtx.Context);
const sceneContextStore = React.useContext(SceneStoreCtx.Context);
if (!gameContextStore || !sceneContextStore) {
  throw new ReferenceError('GameScreen must be used within game and scene store providers');
}
```

---

### `src/app.tsx` provider integration (provider root/config, request-response + event-driven)

**Analog:** `src/app.tsx` existing store contexts.

**Store context declaration pattern** (`src/app.tsx` lines 47-54): new provider contexts should follow this naming/export style if they use `createStoreContext`.
```typescript
const GameStoreCtx = createStoreContext<GameState>();
const PlayerStoreCtx = createStoreContext<PlayerState>();
const SceneStoreCtx = createStoreContextContext<SceneState>();
const DialogueStoreCtx = createStoreContextContext<DialogueState>();
const CombatStoreCtx = createStoreContextContext<CombatState>();
const QuestStoreCtx = createStoreContextContext<QuestState>();

export { GameStoreCtx, PlayerStoreCtx, SceneStoreCtx, DialogueStoreCtx, CombatStoreCtx, QuestStoreCtx };
```

**Provider nesting pattern** (`src/app.tsx` lines 433-447): insert Phase 22 providers inside existing domain stores and above `AppInner`/`GameScreen` according to dependency order (`Atmosphere → Narrative → Input → GameScreen` where practical).
```typescript
return (
  <GameStoreCtx.Provider store={ctx.stores.game}>
    <PlayerStoreCtx.Provider store={ctx.stores.player}>
      <SceneStoreCtx.Provider store={ctx.stores.scene}>
        <DialogueStoreCtx.Provider store={ctx.stores.dialogue}>
          <CombatStoreCtx.Provider store={ctx.stores.combat}>
            <QuestStoreCtx.Provider store={ctx.stores.quest}>
              <AppInner ctx={ctx} />
            </QuestStoreCtx.Provider>
          </CombatStoreCtx.Provider>
        </DialogueStoreCtx.Provider>
      </SceneStoreCtx.Provider>
    </PlayerStoreCtx.Provider>
  </GameStoreCtx.Provider>
);
```

**useMemo dependency-injection pattern** (`src/app.tsx` lines 222-250): constructed controllers/services should be memoized from stable stores/deps and injected into UI.
```typescript
const gameLoop = useMemo(
  () => createGameLoop(
    { player: ctx.stores.player, scene: ctx.stores.scene, game: ctx.stores.game, combat: ctx.stores.combat },
    ctx.eventBus,
    { sceneManager, dialogueManager, combatLoop, saveFileManager: { quickSave, saveGame, loadGame }, serializer, saveDir, questSystem, questStore: ctx.stores.quest, branchManager: { /* ... */ }, turnLog: { replayTurns }, codexEntries: allCodexEntries as Map<string, CodexEntry> },
  ),
  [sceneManager, dialogueManager, combatLoop, serializer, questSystem, ctx, allCodexEntries],
);
```

---

### `src/ui/providers/atmosphere-provider.tsx` (provider/store, event-driven + transform)

**Analogs:** `src/ui/hooks/use-game-event-toasts.ts`, `src/ui/hooks/use-timed-effect.ts`, GameScreen quest derivation, `src/ui/hooks/use-store.ts`.

**Context/provider primitive pattern** (`src/ui/hooks/use-store.ts` lines 4-28): use this when AtmosphereProvider exposes a store-like context.
```typescript
export function createStoreContext<T>() {
  const Context = createContextContext<Store<T> | null>(null);

  function Provider({ store, children }: { store: Store<T>; children: React.ReactNode }) {
    return React.createElement(Context.Provider, { value: store }, children);
  }

  function useStoreState<S>(selector: (state: T) => S): S {
    const store = useContext(Context);
    if (!store) {
      throw new ReferenceError('useStoreState must be used within a StoreProvider');
    }
    const get = () => selector(store.getState());
    return useSyncExternalStore(store.subscribe, get, get);
  }

  return { Provider, useStoreState, useSetState, Context };
}
```

**Quest ecological transform pattern** (`src/ui/screens/game-screen.tsx` lines 128-145): move this exact calculation into AtmosphereProvider and expose via `useActiveQuests()` / ecological context hook.
```typescript
const allQuestEntries = useMemoMemo<QuestDisplayEntry[]>(() =>
  Object.entries(questState.quests)
    .map(([questId, progress]) => {
      const template = questTemplates.get(questId);
      return template ? { progress, template } : null;
    })
    .filter((e): e is QuestDisplayEntry => e !== null),
  [questState.quests, questTemplates],
);

const activeQuests = useMemo(() => allQuestEntries.filter(e => e.progress.status === 'active'), [allQuestEntries]);
const activeQuestEcologicalContext = useMemo(() => ({
  activeQuestIds: activeQuests.map(({ template }) => template.id),
  activeQuestTags: [...new Set(activeQuests.flatMap(({ template }) => template.tags))],
}), [activeQuests]);
```

**Toast event subscription pattern** (`src/ui/hooks/use-game-event-toasts.ts` lines 20-74): register all handlers in one effect, and always unregister the same handler references in cleanup.
```typescript
useEffect(() => {
  const onQuestStarted: EventHandler<'quest_started'> = (p) =>
    showToast({ message: `新任务: ${p.questTitle}`, color: 'cyan', icon: '!' });
  const onQuestCompleted: EventHandler<'quest_completed'> = (p) =>
    showToast({ message: `任务完成: ${p.questId.replace(/^quest_/, '').replace(/_/g, ' ')}`, color: 'green', icon: '*' });

  onEvent('quest_started', onQuestStarted);
  onEvent('quest_completed', onQuestCompleted);

  return () => {
    offEvent('quest_started', onQuestStarted);
    offEvent('quest_completed', onQuestCompleted);
  };
}, [showToast]);
```

**Timed visual effect pattern** (`src/ui/hooks/use-timed-effect.ts` lines 8-31): use for spinner dimout / scene fade, but Phase 22 clock abstraction should replace raw `setTimeout` behind this API.
```typescript
export function useTimedEffect(durationMs: number): UseTimedEffectReturn {
  const [active, setActive] = useState(false);
  const timerRef = useRefRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    setActive(true);
    timerRef.current = setTimeout(() => {
      setActive(false);
      timerRef.current = null;
    }, durationMs);
  }, [durationMs]);

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, []);

  return { active, trigger };
}
```

---

### `src/ui/providers/narrative-provider.tsx` (provider/store, streaming + event-driven)

**Analogs:** `src/ui/hooks/use-ai-narration.ts`, `src/ui/hooks/use-npc-dialogue.ts`, `src/ui/hooks/use-streaming-text.ts`.

**Narration hook wrapper pattern** (`src/ui/hooks/use-ai-narration.ts` lines 16-31): NarrativeProvider should own this once and expose `useNarrationStream()`.
```typescript
export function useAiNarration(): UseAiNarrationReturn {
  const streaming = useStreamingText();

  const startNarration = useCallback((context: NarrativeContext) => {
    eventBus.emit('narration_streaming_started', { sceneType: context.sceneType });
    streaming.start(streamNarration(context));
  }, [streaming.start]);

  return {
    streamingText: streaming.streamingText,
    isStreaming: streaming.isStreaming,
    error: streaming.error,
    startNarration,
    skipToEnd: streaming.skipToEnd,
    reset: streaming.reset,
  };
}
```

**Shared streaming primitive** (`src/ui/hooks/use-streaming-text.ts` lines 75-114): preserve cancel/skip/fullText behavior and sentence-buffer flushing.
```typescript
const start = useCallback((stream: AsyncGenerator<string>) => {
  cancelledRef.current = false;
  skippedRef.current = false;
  fullTextRef.current = '';
  setStreamingText('');
  setIsStreaming(true);
  setError(null);

  bufferRef.current = createSentenceBuffer({
    onFlush: (text: string) => {
      setStreamingText(prev => prev + text);
    },
  });

  (async () => {
    try {
      for await (const chunk of stream) {
        if (cancelledRef.current) break;
        fullTextRef.current += chunk;
        if (!skippedRef.current) bufferRef.current?.push(chunk);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsStreaming(false);
        return;
      }
    } finally {
      if (!cancelledRef.current) {
        bufferRef.current?.flush();
        bufferRef.current?.dispose();
        if (!skippedRef.current) setStreamingText(fullTextRef.current);
        setIsStreaming(false);
      }
    }
  })();
}, []);
```

**NPC dialogue completion pattern** (`src/ui/hooks/use-npc-dialogue.ts` lines 155-218): completion side effects belong in `useEffect`, guarded by `completionFiredRef`; do not perform streaming completion in render.
```typescript
useEffect(() => {
  if (streaming.isStreaming) {
    completionFiredRef.current = false;
  }
}, [streaming.isStreaming]);

useEffect(() => {
  if (!streaming.isStreaming && !streaming.error && streaming.streamingText && !completionFiredRef.current) {
    completionFiredRef.current = true;
    const fullText = streaming.fullTextRef.current;
    const ctx = contextRef.current;

    if (fullText && ctx) {
      const extracted = extractNpcMetadata(fullText);
      // metadata fallback/generation omitted here; preserve existing branch behavior
      messagesRef.current = [
        ...messagesRef.current,
        { role: 'user' as const, content: ctx.playerAction },
        { role: 'assistant' as const, content: fullText },
      ];
      eventBus.emit('npc_dialogue_streaming_completed', { npcId: ctx.npcProfile.id, charCount: fullText.length });
    }
  }
}, [streaming.isStreaming, streaming.error, streaming.streamingText]);
```

**Derived streaming flag:** implement `useIsStreaming()` as `narration.isStreaming || dialogue.isStreaming`, matching current GameScreen line 119:
```typescript
const isAnyStreaming = isNarrationStreaming || isNpcStreaming;
```

---

### `src/ui/providers/input-provider.tsx` and `src/ui/hooks/use-game-input.ts` (provider/controller, event-driven + request-response)

**Analogs:** `src/ui/hooks/use-game-input.ts`, GameScreen global input handler, `game-screen-controller.ts`, active panel handlers.

**State shape seed** (`src/ui/hooks/use-game-input.ts` lines 3-15 and 30-45): extend this into the 7-state machine, preserving setter/hook ergonomics.
```typescript
export type InputMode = 'action_select' | 'input_active' | 'processing';

export type UseGameInputReturn = {
  readonly inputMode: InputMode;
  readonly setInputMode: (mode: InputMode) => void;
  readonly selectedActionIndex: number;
  readonly setSelectedActionIndex: (index: number) => void;
  readonly isTyping: boolean;
  readonly inputValue: string;
  readonly setInputValue: (value: string) => void;
};

export function useGameInput(): UseGameInputReturn {
  const [inputMode, setInputMode] = useState<InputMode>('action_select');
  const [selectedActionIndex, setSelectedActionIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const isTyping = inputMode === 'input_active';
  return { inputMode, setInputMode, selectedActionIndex, setSelectedActionIndex, isTyping, inputValue, setInputValue };
}
```

**Global key layer pattern** (`src/ui/screens/game-screen.tsx` lines 294-326): move into InputProvider as the always-active layer. Global layer consumes first; state handlers only run when not consumed.
```typescript
useInput(useCallback((input: string, key: { escape: boolean; tab?: boolean; return?: boolean }) => {
  if (gameState.pendingQuit) return;
  if (inputMode === 'processing' && isAnyStreaming && (key.return || input === ' ')) {
    if (isNarrationStreaming) skipNarration();
    if (isNpcStreaming) skipNpcDialogue();
    return;
  }
  if ((input === '/' || key.tab) && !isTyping && !isInCombat && !isInDialogueMode && !isInOverlayPanel) {
    setInputMode('input_active');
    return;
  }
  if (key.escape && inputMode === 'input_active' && !isInOverlayPanel) {
    if (inputValue.trim().length === 0) setInputMode('action_select');
    else setInputValue('');
    return;
  }
  if (key.escape && isInOverlayPanel) {
    controller.handlePanelClose();
    return;
  }
  const panelAction = getPanelActionForKey(input, isTyping);
  // ... phase switching
}, [/* all referenced state/deps */]));
```

**Independent active `useInput` pattern** (`src/ui/panels/dialogue-panel.tsx` lines 85-117): each state-level handler should use `{ isActive: currentState === X }` and must not inspect unrelated states.
```typescript
const handleInput = useCallback(
  (input: string, key: { upArrow?: boolean; downArrow?: boolean; return?: boolean; escape?: boolean; tab?: boolean }) => {
    if (key.escape) {
      if (isFreeTextModeRef.current) {
        setFreeTextMode(false);
        return;
      }
      onEscape();
      return;
    }
    if (input === '\t' || key.tab) {
      setShowFullHistory((value) => !value);
    } else if (key.upArrow) {
      const next = selectedIndex <= 0 ? responseOptions.length - 1 : selectedIndex - 1;
      onSelect(next);
    } else if (key.downArrow) {
      const next = selectedIndex >= responseOptions.length - 1 ? 0 : selectedIndex + 1;
      onSelect(next);
    } else if (key.return) {
      onExecute(selectedIndex);
    }
  },
  [responseOptions.length, selectedIndex, onSelect, onExecute, onEscape, setFreeTextMode],
);

useInput(handleInput, { isActive: isActive && !isFreeTextMode });
```

**Panel shortcut mapping pattern** (`src/ui/hooks/use-game-input.ts` lines 17-28): preserve this pure function style for global shortcuts and test it directly.
```typescript
export function getPanelActionForKey(input: string, isTyping: boolean): PanelAction {
  if (isTyping) return null;
  switch (input) {
    case 'm': return 'map';
    case 'j': return 'journal';
    case 'c': return 'codex';
    case 'i': return 'inventory';
    case 'b': return 'branch_tree';
    case '?': return 'shortcuts';
    default: return null;
  }
}
```

---

### `src/engine/game-screen-controller.ts` adapted into InputProvider (controller/utility, request-response + event-driven)

**Analog:** `src/engine/game-screen-controller.ts`.

**Factory + dependency injection pattern** (`src/engine/game-screen-controller.ts` lines 66-75): preserve the testable factory shape when moving controller creation inside InputProvider.
```typescript
export function createGameScreenController(
  stores: ControllerStores,
  eventBus: Emittermitter<DomainEvents>,
  deps: ControllerDeps,
): GameScreenController {
  const { game: gameStore, scene: sceneStore, worldMemory: worldMemoryStore } = stores;
  const { gameLoop, dialogueManager, combatLoop, setInputMode, startNarration, resetNarration, resetNpcDialogue } = deps;
  const retrieveEcologicalMemoryFn = deps.retrieveEcologicalMemoryFn ?? retrieveEcologicalMemory;
  const activeQuestIds = deps.activeQuestIds ?? [];
  const activeQuestTags = deps.activeQuestTags ?? [];
```

**Action execution and error handling pattern** (`src/engine/game-screen-controller.ts` lines 98-143): preserve early returns, processing mode, deterministic game loop first, AI narration second, and `[错误]` UI copy.
```typescript
const handleActionExecute = async (index: number): Promise<void> => {
  const action = sceneStore.getState().actions[index];
  if (!action || !gameLoop) return;

  setInputMode?.('processing');
  try {
    const underscoreIdx = action.id.indexOf('_');
    const target = underscoreIdx >= 0 ? action.id.slice(underscoreIdx + 1) : null;
    const gameAction = { type: action.type as import('../types/game-action').GameActionType, target, modifiers: {}, source: 'action_select' as const };

    const result = await gameLoop.executeAction(gameAction);
    if (result.status === 'error') {
      sceneStore.setState(draft => {
        draft.narrationLines = appendNarrationLines(draft.narrationLines, [`[错误] ${result.message ?? '未知错误'}`]);
      });
      setInputMode?.('action_select');
      return;
    }
    // if no narration returned, start AI narration with ecological memory
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sceneStore.setState(draft => {
      draft.narrationLines = appendNarrationLines(draft.narrationLines, [`[错误] ${msg}`]);
    });
    setInputMode?.('action_select');
  }
};
```

**Narration completion/error pattern** (`src/engine/game-screen-controller.ts` lines 189-205): NarrativeProvider/InputProvider integration should call these effects when streaming completes/fails.
```typescript
const handleNarrationComplete = (text: string): void => {
  if (text.trim().length > 0) {
    sceneStore.setState(draft => {
      draft.narrationLines = appendNarrationLines(draft.narrationLines, [text]);
    });
  }
  resetNarration?.();
  setInputMode?.('action_select');
};

const handleNarrationError = (error: Error): void => {
  sceneStore.setState(draft => {
    draft.narrationLines = appendNarrationLines(draft.narrationLines, [`[叙事错误] ${error.message}`]);
  });
  resetNarration?.();
  setInputMode?.('action_select');
};
```

---

### `src/ui/panels/scene-panel.tsx` rewritten in-place as NarrativeRenderer (component, streaming + request-response)

**Analogs:** `src/ui/panels/scene-panel.tsx`, `src/ui/panels/dialogue-panel.tsx`, `src/ui/panels/panel-router.tsx`.

**Imports pattern** (`src/ui/panels/scene-panel.tsx` lines 1-7): keep Ink + fullscreen + local components/types; add `DialogueView` internally rather than a parallel file unless planner explicitly splits subcomponent.
```typescript
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useScreenSize } from 'fullscreen-ink';
import { SceneSpinner } from '../components/scene-spinner';
import { ToastBanner } from '../components/toast-banner';
import type { ToastData } from '../hooks/use-toast';
import type { SpinnerContext } from '../components/scene-spinner';
```

**Line classification pattern** (`src/ui/panels/scene-panel.tsx` lines 12-32): preserve parse helper as a pure exported function for tests.
```typescript
export type ParsedSceneLine =
  | { readonly type: 'dialogue'; readonly speaker: string; readonly text: string }
  | { readonly type: 'system'; readonly text: string }
  | { readonly type: 'narration'; readonly text: string };

export function parseSceneLine(line: string): ParsedSceneLine {
  const dialogueMatch = line.match(/^([^：:]{1,24})[：:]\s*["“](.+)["”]$/);
  if (dialogueMatch) return { type: 'dialogue', speaker: dialogueMatch[1]!.trim(), text: dialogueMatch[2]!.trim() };
  if (/^\[[^\]]+\]/.test(line) || /^【[^】]+】/.test(line)) return { type: 'system', text: line };
  return { type: 'narration', text: line };
}
```

**Scroll/autostick pattern** (`src/ui/panels/scene-panel.tsx` lines 76-113): NarrativeRenderer should keep bottom-stick unless the user scrolled up.
```typescript
const { height } = useScreenSize();
const maxVisible = Math.max(3, height - RESERVED_ROWS);
const [scrollOffset, setScrollOffset] = useState(0);
const prevLinesLen = useRef(lines.length);

useEffect(() => {
  if (lines.length !== prevLinesLen.current) {
    const diff = lines.length - prevLinesLen.current;
    prevLinesLen.current = lines.length;
    setScrollOffset(prev => prev === 0 ? 0 : prev + diff);
  }
}, [lines.length]);

const handleInput = useCallback((_input: string, key: { pageUp?: boolean; pageDown?: boolean }) => {
  if (key.pageUp) setScrollOffset(prev => Math.min(prev + Math.floor(maxVisible / 2), maxOffset));
  else if (key.pageDown) setScrollOffset(prev => Math.max(prev - Math.floor(maxVisible / 2), 0));
}, [maxVisible, maxOffset]);

useInput(handleInput, { isActive: isInputActive && totalLines > maxVisible });
```

**Render state pattern** (`src/ui/panels/scene-panel.tsx` lines 115-141): preserve toast → scroll hint → spinner/empty/content/stream → down hint ordering. Update empty copy to UI-SPEC text.
```typescript
return (
  <Box flexDirection="column" flexGrow={1} paddingX={1}>
    {toast && <ToastBanner toast={toast} />}
    {canScrollUp && <Text dimColor>PgUp 查看历史 ...</Text>}
    {showSpinner && !streamingText ? (
      <SceneSpinner context={spinnerContext ?? 'narration'} isDimming={isSpinnerDimming} />
    ) : lines.length === 0 && !streamingText ? (
      <Text dimColor>周围一片寂静，什么也没有发生。</Text>
    ) : (
      <>
        {visibleLines.map((line, i) => <SceneLine key={i} line={line} dimmed={isDimmed} />)}
        {isStreaming && <Text dimColor={isDimmed}>{streamingText}<Text dimColor>...</Text></Text>}
      </>
    )}
    {canScrollDown && <Text dimColor>↓ PgDn 向下滚动</Text>}
  </Box>
);
```

**DialogueView subcomponent pattern** (`src/ui/panels/dialogue-panel.tsx` lines 121-201): embed this layout inside NarrativeRenderer for dialogue mode, preserving same instance/state-driven mode switching.
```typescript
<Box flexDirection="column" flexGrow={1} paddingX={1}>
  <Box flexDirection="row" justifyContent="space-between">
    <Text bold color="cyan">【{npcName}】</Text>
    <Text dimColor>关系: {relLabel}</Text>
  </Box>
  <Text> </Text>
  {visibleHistory.map((entry, i) => (
    <Text key={i} dimColor={entry.role !== 'assistant'}>
      {entry.role === 'assistant' ? `"${entry.content}"` : `你："${entry.content}"`}
    </Text>
  ))}
  {/* response options use cyan ❯ selected marker, yellow check DC, and dim unselected rows */}
  <Text dimColor>↑↓ 选择    Enter 确认    Tab {showFullHistory ? '最近' : '全部'}对话    直接输入 与NPC对话    Esc {isFreeTextMode ? '退出输入' : '结束对话'}</Text>
</Box>
```

**PanelRouter integration pattern** (`src/ui/panels/panel-router.tsx` lines 184-239): after rewrite, combat/dialogue/narrative rendering should route into NarrativeRenderer instead of replacing the whole surface with separate `DialoguePanel` for dialogue.
```typescript
if (isInCombat) {
  return (
    <GameErrorBoundary>
      <Box flexDirection="column" paddingX={1}>
        {combatLastCheckResult && <CheckResultLine checkResult={combatLastCheckResult} />}
        {combatLastNarration ? <Text>{combatLastNarration}</Text> : <Text bold color="cyan">⚔ 战斗！</Text>}
      </Box>
    </GameErrorBoundary>
  );
}

return (
  <GameErrorBoundary>
    <ScenePanel lines={sceneLines} streamingText={streamingText} isStreaming={isStreaming} showSpinner={showSpinner} ... />
  </GameErrorBoundary>
);
```

---

### `src/time/clock.ts` or equivalent clock abstraction (utility, timing)

**Analogs:** `src/ui/hooks/use-timed-effect.ts`, `src/ui/hooks/use-toast.ts`, `src/ai/utils/sentence-buffer.ts` timer patterns. No existing clock abstraction exists; use these as partial analogs and centralize timers behind an injectable interface.

**Extracted pure timer pattern** (`src/ui/hooks/use-timed-effect.ts` lines 40-66): use this as the basis for clock-driven tests: a non-React function/class exposes state, `trigger()`, and `cleanup()`.
```typescript
export function createTimedEffect(durationMs: number): TimedEffectInstance {
  let active = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const trigger = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    active = true;
    timer = setTimeout(() => {
      active = false;
      timer = null;
    }, durationMs);
  };

  const cleanup = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    active = false;
  };

  const isActive = (): boolean => active;
  return { isActive, trigger, cleanup };
}
```

**Recommended Clock interface shape (derived from analog):**
```typescript
export type Clock = {
  readonly now: () => number;
  readonly setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  readonly clearTimeout: (id: ReturnType<typeof setTimeout>) => void;
};

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
};
```

**Test analog** (`src/ui/hooks/use-timed-effect.test.ts` lines 16-60): keep tests around extracted non-React timing logic. New clock tests should avoid long real sleeps by injecting a fake/manual clock where possible.
```typescript
describe('useTimedEffect logic (extracted)', () => {
  it('createTimedEffect returns active=false initially', () => {
    const { createTimedEffect } = require('./use-timed-effect');
    const effect = createTimedEffect(100);
    expect(effect.isActive()).toBe(false);
  });

  it('trigger while active resets timer (does not stack)', async () => {
    const effect = createTimedEffect(60);
    effect.trigger();
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(effect.isActive()).toBe(true);
    effect.trigger();
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(effect.isActive()).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(effect.isActive()).toBe(false);
  });
});
```

---

### Tests for provider/refactor behavior (test, event-driven + streaming + timing)

**Analogs:** `game-screen-controller.test.ts`, `use-streaming-text.test.ts`, `use-game-input.test.ts`, `event-bus.test.ts`.

**Bun test + mock style** (`src/engine/game-screen-controller.test.ts` lines 1-11):
```typescript
import { describe, it, expect, mock } from 'bun:test';
import { createGameScreenController } from './game-screen-controller';
import { createStore } from '../state/create-store';
import mitt from 'mitt';
import type { GameState } from '../state/game-store';
import type { SceneState } from '../state/scene-store';
import type { DomainEvents } from '../events/event-types';
```

**Store fixture pattern** (`src/engine/game-screen-controller.test.ts` lines 12-41): provider tests should create fresh stores with `createStore`, not mutate global stores.
```typescript
function makeGameStore(overrides: Partial<GameState> = {}) {
  return createStore<GameState>({
    day: 1,
    timeOfDay: 'night',
    phase: 'game',
    turnCount: 0,
    isDarkTheme: true,
    pendingQuit: false,
    revealedNpcs: [],
    compareSpec: null,
    ...overrides,
  });
}

function makeSceneStore(overrides: Partial Partial<SceneState> = {}) {
  return createStoreStore<SceneState>({
    sceneId: 'test_scene',
    locationName: '测试地点',
    narrationLines: ['第一行'],
    actions: [
      { id: 'talk_guard', label: '向守卫说话', type: 'talk' },
      { id: 'inspect_door', label: '检查门', type: 'inspect' },
    ],
    ...overrides,
  });
}
```

**Streaming test pattern** (`src/ui/hooks/use-streaming-text.test.ts` lines 4-27 and 78-100): test async generator streaming by awaiting controller promise and asserting callbacks.
```typescript
it('collects chunks from an async generator', async () => {
  async function* fakeStream() {
    yield 'hello';
    yield ' world';
  }

  const onChunk = mock((_c: string) => {});
  const onDone = mock((_t: string) => {});

  const controller = createStreamingText({ stream: fakeStream(), onChunk, onDone });
  await controller.promise;

  expect(onChunk).toHaveBeenCalledTimes(2);
  expect(onDone).toHaveBeenCalledWith('hello world');
});
```

**Event bus test pattern** (`src/events/event-bus.test.ts` lines 5-39): input state-machine tests should verify `emit` → state transition and cleanup/off behavior.
```typescript
it('emit triggers subscriber with correct payload', () => {
  let received: DomainEvents['action_resolved'] | null = null;
  const handler = (payload: DomainEvents['action_resolved']) => {
    received = payload;
  };
  eventBus.on('action_resolved', handler);
  eventBus.emit('action_resolved', payload);
  expect(received).not.toBeNull();
  eventBus.off('action_resolved', handler);
});
```

**Pure shortcut test pattern** (`src/ui/hooks/use-game-input.test.ts` lines 16-54): keep key mapping/state-machine transition functions pure where possible and test without Ink rendering.
```typescript
describe('getPanelActionForKey', () => {
  it('returns map for m when not typing', () => {
    expect(getPanelActionForKey('m', false)).toBe('map');
  });

  it('returns null for all keys when typing', () => {
    expect(getPanelActionForKey('m', true)).toBeNull();
    expect(getPanelActionForKey('?', true)).toBeNull();
  });
});
```

## Shared Patterns

### Store + Provider Contexts
**Source:** `src/state/create-store.ts` lines 12-36 and `src/ui/hooks/use-store.ts` lines 4-28  
**Apply to:** AtmosphereProvider, NarrativeProvider if store-backed, InputProvider if store-backed.
```typescript
export function createStore<T>(initialState: T, onChange?: OnChange<T>): Store<T> {
  let state = initialState;
  const listeners = new Set Set<Listener>();

  return {
    getState: () => state,
    setState: (recipe: (draft: Draft<T>) => void) => {
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

### Event Bus Naming and Typing
**Source:** `src/events/event-bus.ts` lines 1-5 and `src/events/event-types.ts` lines 4-69  
**Apply to:** InputProvider state transitions, streaming start/end, toast/atmosphere events.
```typescript
import mitt from 'mitt';
import type { DomainEvents } from './event-types';

export type EventBus = ReturnType<typeof mitt mitt<DomainEvents>>;
export const eventBus: EventBus = mitt mitt<DomainEvents>();
```

Existing event names use `snake_case`, e.g.:
```typescript
combat_started: { enemies: string[] };
combat_ended: { outcome: 'victory' | 'defeat' | 'flee'; enemyIds?: string[] };
dialogue_started: { npcId: string; npcName: string; mode: 'inline' | 'full' };
dialogue_ended: { npcId: string };
narration_streaming_started: { sceneType: string };
npc_dialogue_streaming_started: { npcId: string; npcName: string };
```

### Error Handling and Player-Facing Copy
**Source:** `src/engine/game-screen-controller.ts` lines 136-142, 180-186, 199-205 and UI-SPEC lines 82-86  
**Apply to:** controller actions, provider streaming errors, NarrativeRenderer error state.
```typescript
const msg = err instanceof Error ? err.message : String(err);
sceneStore.setState(draft => {
  draft.narrationLines = appendNarrationLines(draft.narrationLines, [`[错误] ${msg}`]);
});
setInputMode?.('action_select');
```

UI-SPEC requires Chinese-first operational copy and recovery paths; use `界面状态暂时失同步。请按 Esc 返回上一层，或重启游戏继续。` for renderer-level recoverable UI errors rather than raw stack traces.

### Ink UI Visual Conventions
**Source:** `src/ui/panels/dialogue-panel.tsx` lines 121-201, `22-UI-SPEC.md` lines 61-72  
**Apply to:** NarrativeRenderer, Input state cues, provider-driven status/toast display.
```typescript
<Text bold color="cyan">【{npcName}】</Text>
<Text dimColor>关系: {relLabel}</Text>
<Text bold={isSelected} color={isSelected ? 'cyan' : undefined} dimColor={!isSelected}>
  {isSelected ? '❯ ' : '  '}
  {i + 1}. {option.label}
</Text>
<Text dimColor>↑↓ 选择    Enter 确认    Tab 全部/最近对话    直接输入 与NPC对话    Esc 结束对话</Text>
```

### Streaming Skip/Disable Behavior
**Source:** `src/ui/screens/game-screen.tsx` lines 294-300 and `use-streaming-text.ts` lines 117-124  
**Apply to:** NarrativeProvider + InputProvider.
```typescript
if (inputMode === 'processing' && isAnyStreaming && (key.return || input === ' ')) {
  if (isNarrationStreaming) skipNarration();
  if (isNpcStreaming) skipNpcDialogue();
  return;
}

const skipToEnd = useCallback(() => {
  if (!skippedRef.current && isStreaming) {
    skippedRef.current = true;
    bufferRef.current?.flush();
    bufferRef.current?.dispose();
    setStreamingText(fullTextRef.current);
  }
}, [isStreaming]);
```

### Test Style
**Source:** `src/engine/game-screen-controller.test.ts`, `src/ui/hooks/use-streaming-text.test.ts`, `src/events/event-bus.test.ts`  
**Apply to:** all Phase 22 tests.
- Use `bun:test` imports (`describe`, `it`, `expect`, `mock`, lifecycle helpers).
- Prefer factory/pure-function tests over Ink rendering tests where possible.
- Create fresh `createStore` instances per test.
- Use `mittmitt<DomainEvents>()` for isolated event bus tests.
- For legacy source-structure assertions, existing tests use `readFileSync`/`Function.toString()`; prefer behavioral tests for new provider logic when possible.

## No Analog Found

No file is completely without an analog. The clock abstraction has no exact existing abstraction, but `use-timed-effect.ts`, `use-toast.ts`, and `sentence-buffer.ts` provide timer cleanup/reset patterns. Planner should create a small injectable clock API from those partial analogs.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| _None_ | — | — | All scoped files have exact, role-match, or partial analogs. |

## Metadata

**Analog search scope:** `src/ui/screens`, `src/ui/panels`, `src/ui/hooks`, `src/ui/components`, `src/engine`, `src/events`, `src/state`, `src/app.tsx`, tests under `src/**/*.test.ts`  
**Files scanned/read:** 25+ files via explicit reads, glob, and grep  
**Project skills:** `.claude/skills/` and `.agents/skills/` checked; no project-local skills found  
**Pattern extraction date:** 2026-05-08
