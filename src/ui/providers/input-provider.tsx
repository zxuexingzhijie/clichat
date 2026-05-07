import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApp, useInput } from 'ink';

import { CombatStoreCtx, DialogueStoreCtx, GameStoreCtx, SceneStoreCtx } from '../../app';
import { eventBus as defaultEventBus, type EventBus } from '../../events/event-bus';
import type { DomainEvents } from '../../events/event-types';
import type { Store } from '../../state/create-store';
import type { GameState } from '../../state/game-store';
import type { WorldMemoryState } from '../../state/world-memory-store';
import type { GameLoop } from '../../game-loop';
import type { DialogueManager } from '../../engine/dialogue-manager';
import type { CombatLoop } from '../../engine/combat-loop';
import type { LocationMapData } from '../panels/map-panel';
import type { CodexDisplayEntry } from '../panels/codex-panel';
import type { BranchDisplayNode } from '../panels/branch-tree-panel';
import type { BranchMeta } from '../../state/branch-store';
import type { SaveDataV7 } from '../../state/serializer';
import { useActiveQuests, useAtmosphereProcessing } from './atmosphere-provider';
import { useDialogueStream, useIsStreaming, useNarrationStream, useNarrativeText } from './narrative-provider';
import {
  consumeGlobalInput,
  getPanelActionForKey,
  inputStateFromDomainEvent,
  inputStateFromGamePhase,
  type InputMode,
  type InputStateName,
} from '../hooks/use-game-input';

export type InputProviderProps = {
  readonly gameLoop?: GameLoop;
  readonly dialogueManager?: DialogueManager;
  readonly combatLoop?: CombatLoop;
  readonly mapData?: {
    readonly locations: readonly LocationMapData[];
    readonly currentLocationId: string;
    readonly regionName: string;
  };
  readonly codexEntries?: readonly CodexDisplayEntry[];
  readonly branchTree?: readonly BranchDisplayNode[];
  readonly currentBranchId?: string;
  readonly branches?: Record<string, BranchMeta>;
  readonly readSaveData?: (fileName: string, saveDir: string) => Promise<SaveDataV7>;
  readonly saveDir?: string;
  readonly eventBus?: EventBus;
  readonly worldMemoryStore?: Store<WorldMemoryState>;
  readonly children: React.ReactNode;
};

type InputProviderContextValue = {
  readonly currentState: InputStateName;
  readonly setCurrentState: (state: InputStateName) => void;
  readonly inputMode: InputMode;
  readonly setInputMode: (mode: InputMode) => void;
  readonly isTyping: boolean;
  readonly inputValue: string;
  readonly setInputValue: (value: string) => void;
  readonly selectedActionIndex: number;
  readonly setSelectedActionIndex: (index: number) => void;
  readonly combatSelectedIndex: number;
  readonly setCombatSelectedIndex: (index: number) => void;
  readonly dialogueSelectedIndex: number;
  readonly setDialogueSelectedIndex: (index: number) => void;
  readonly handlePanelClose: () => void;
  readonly handlePhaseSwitch: (phase: GameState['phase']) => void;
  readonly exit: () => void;
  readonly submit: (text: string) => void;
};

const InputContext = createContext<InputProviderContextValue | null>(null);

type StateKey = { readonly upArrow?: boolean; readonly downArrow?: boolean; readonly return?: boolean; readonly escape?: boolean; readonly tab?: boolean };

function useInputContext(): InputProviderContextValue {
  const context = useContext(InputContext);
  if (!context) {
    throw new ReferenceError('Input hooks must be used within InputProvider');
  }
  return context;
}

export function InputProvider({ eventBus = defaultEventBus, children }: InputProviderProps): React.ReactNode {
  const { exit } = useApp();
  const gameState = GameStoreCtx.useStoreState((state) => state);
  const sceneState = SceneStoreCtx.useStoreState((state) => state);
  const dialogueState = DialogueStoreCtx.useStoreState((state) => state);
  const combatState = CombatStoreCtx.useStoreState((state) => state);
  const gameSetState = GameStoreCtx.useSetState();
  const isStreaming = useIsStreaming();
  const narrationStream = useNarrationStream();
  const dialogueStream = useDialogueStream();
  useNarrativeText();
  useActiveQuests();
  const setAtmosphereProcessingState = useAtmosphereProcessing();

  const [currentState, setCurrentState] = useState<InputStateName>(() => inputStateFromGamePhase(gameState.phase));
  const [inputMode, setInputMode] = useState<InputMode>('action_select');
  const [inputValue, setInputValue] = useState('');
  const [selectedActionIndex, setSelectedActionIndex] = useState(0);
  const [combatSelectedIndex, setCombatSelectedIndex] = useState(0);
  const [dialogueSelectedIndex, setDialogueSelectedIndex] = useState(0);
  const isTyping = inputMode === 'input_active';
  const globalConsumedRef = useRef(false);

  const handlePhaseSwitch = useCallback((phase: GameState['phase']): void => {
    gameSetState(draft => { draft.phase = phase; });
  }, [gameSetState]);

  const handlePanelClose = useCallback((): void => {
    gameSetState(draft => { draft.phase = 'game'; });
  }, [gameSetState]);

  const submit = useCallback((_text: string): void => {
    setInputMode('processing');
    setInputValue('');
  }, []);

  useEffect(() => {
    setAtmosphereProcessingState({ inputMode, isAnyStreaming: isStreaming });
  }, [inputMode, isStreaming, setAtmosphereProcessingState]);

  useEffect(() => {
    const onCombatStarted = (): void => { setCurrentState(inputStateFromDomainEvent('combat_started')); };
    const onCombatEnded = (): void => { setCurrentState(inputStateFromDomainEvent('combat_ended')); setCombatSelectedIndex(0); };
    const onDialogueStarted = (): void => { setCurrentState(inputStateFromDomainEvent('dialogue_started')); };
    const onDialogueEnded = (): void => { setCurrentState(inputStateFromDomainEvent('dialogue_ended')); setDialogueSelectedIndex(0); };
    const onGamePhaseChanged = (payload: DomainEvents['game_phase_changed']): void => {
      setCurrentState(inputStateFromGamePhase(payload.phase));
    };

    eventBus.on('combat_started', onCombatStarted);
    eventBus.on('combat_ended', onCombatEnded);
    eventBus.on('dialogue_started', onDialogueStarted);
    eventBus.on('dialogue_ended', onDialogueEnded);
    eventBus.on('game_phase_changed', onGamePhaseChanged);

    return () => {
      eventBus.off('combat_started', onCombatStarted);
      eventBus.off('combat_ended', onCombatEnded);
      eventBus.off('dialogue_started', onDialogueStarted);
      eventBus.off('dialogue_ended', onDialogueEnded);
      eventBus.off('game_phase_changed', onGamePhaseChanged);
    };
  }, [eventBus]);

  useInput(useCallback((input: string, key: StateKey & { readonly ctrl?: boolean }) => {
    globalConsumedRef.current = false;
    if (gameState.pendingQuit) return;
    const global = consumeGlobalInput({ input, key, isStreaming, inputMode, isTyping });
    if (!global.consumed) return;
    globalConsumedRef.current = true;
    if (global.action === 'exit') {
      exit();
    } else if (global.action === 'skip_stream') {
      if (narrationStream.isStreaming) narrationStream.skipToEnd();
      if (dialogueStream.isStreaming) dialogueStream.skipToEnd();
    } else if (global.action === 'escape') {
      if (inputMode === 'input_active' && inputValue.trim().length > 0) setInputValue('');
      else if (inputMode === 'input_active') setInputMode('action_select');
      else if (gameState.phase !== 'game') handlePanelClose();
    } else if (global.action === 'help') {
      handlePhaseSwitch('shortcuts');
    }
  }, [dialogueStream, exit, gameState.pendingQuit, gameState.phase, handlePanelClose, handlePhaseSwitch, inputMode, inputValue, isStreaming, isTyping, narrationStream]));

  const handleExplorationInput = useCallback((input: string, key: StateKey) => {
    if (globalConsumedRef.current) return;
    if ((input === '/' || key.tab) && !isTyping) {
      setInputMode('input_active');
      return;
    }
    const panelAction = getPanelActionForKey(input, isTyping);
    if (panelAction) {
      handlePhaseSwitch(panelAction as GameState['phase']);
      return;
    }
    if (input === 'S' && !isTyping) {
      handlePhaseSwitch('chapter_summary');
      return;
    }
    if (key.upArrow) {
      setSelectedActionIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedActionIndex(prev => Math.min(Math.max(sceneState.actions.length - 1, 0), prev + 1));
    } else if (key.return) {
      setInputMode('processing');
    }
  }, [handlePhaseSwitch, isTyping, sceneState.actions.length]);

  const handleDialogueInput = useCallback((_input: string, key: StateKey) => {
    if (globalConsumedRef.current) return;
    const optionCount = dialogueState.availableResponses.length;
    if (key.upArrow) setDialogueSelectedIndex(prev => prev <= 0 ? Math.max(optionCount - 1, 0) : prev - 1);
    else if (key.downArrow) setDialogueSelectedIndex(prev => prev >= optionCount - 1 ? 0 : prev + 1);
  }, [dialogueState.availableResponses.length]);

  const handleCombatInput = useCallback((_input: string, key: StateKey) => {
    if (globalConsumedRef.current) return;
    if (key.upArrow) setCombatSelectedIndex(prev => prev <= 0 ? 3 : prev - 1);
    else if (key.downArrow) setCombatSelectedIndex(prev => prev >= 3 ? 0 : prev + 1);
    else if (key.return && combatState.phase === 'player_turn') setInputMode('processing');
  }, [combatState.phase]);

  const handleMenuInput = useCallback((_input: string, _key: StateKey) => {
    if (globalConsumedRef.current) return;
  }, []);

  const handleCodexInput = useCallback((_input: string, _key: StateKey) => {
    if (globalConsumedRef.current) return;
  }, []);

  const handleMapInput = useCallback((_input: string, _key: StateKey) => {
    if (globalConsumedRef.current) return;
  }, []);

  const handleBranchInput = useCallback((_input: string, _key: StateKey) => {
    if (globalConsumedRef.current) return;
  }, []);

  useInput(handleExplorationInput, { isActive: currentState === 'EXPLORATION' });
  useInput(handleDialogueInput, { isActive: currentState === 'DIALOGUE' });
  useInput(handleCombatInput, { isActive: currentState === 'COMBAT' });
  useInput(handleMenuInput, { isActive: currentState === 'MENU' });
  useInput(handleCodexInput, { isActive: currentState === 'CODEX' });
  useInput(handleMapInput, { isActive: currentState === 'MAP' });
  useInput(handleBranchInput, { isActive: currentState === 'BRANCH' });

  const value = useMemo<InputProviderContextValue>(() => ({
    currentState,
    setCurrentState,
    inputMode,
    setInputMode,
    isTyping,
    inputValue,
    setInputValue,
    selectedActionIndex,
    setSelectedActionIndex,
    combatSelectedIndex,
    setCombatSelectedIndex,
    dialogueSelectedIndex,
    setDialogueSelectedIndex,
    handlePanelClose,
    handlePhaseSwitch,
    exit,
    submit,
  }), [combatSelectedIndex, currentState, dialogueSelectedIndex, exit, handlePanelClose, handlePhaseSwitch, inputMode, inputValue, isTyping, selectedActionIndex, submit]);

  return React.createElement(InputContext.Provider, { value }, children);
}

export function useInputState(): { readonly currentState: InputStateName; readonly inputMode: InputMode; readonly isTyping: boolean } {
  const context = useInputContext();
  return { currentState: context.currentState, inputMode: context.inputMode, isTyping: context.isTyping };
}

export function useInputActions(): { readonly handlePanelClose: () => void; readonly handlePhaseSwitch: (phase: GameState['phase']) => void; readonly exit: () => void } {
  const context = useInputContext();
  return { handlePanelClose: context.handlePanelClose, handlePhaseSwitch: context.handlePhaseSwitch, exit: context.exit };
}

export function useSelectedAction(): { readonly selectedActionIndex: number; readonly combatSelectedIndex: number; readonly dialogueSelectedIndex: number } {
  const context = useInputContext();
  return {
    selectedActionIndex: context.selectedActionIndex,
    combatSelectedIndex: context.combatSelectedIndex,
    dialogueSelectedIndex: context.dialogueSelectedIndex,
  };
}

export function useCommandInput(): { readonly inputValue: string; readonly setInputValue: (value: string) => void; readonly submit: (text: string) => void } {
  const context = useInputContext();
  return { inputValue: context.inputValue, setInputValue: context.setInputValue, submit: context.submit };
}
