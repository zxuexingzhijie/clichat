import { useState } from 'react';
import type { GameState } from '../../state/game-store';

export type InputMode = 'action_select' | 'input_active' | 'processing';

export type InputStateName = 'EXPLORATION' | 'DIALOGUE' | 'COMBAT' | 'MENU' | 'CODEX' | 'MAP' | 'BRANCH';

export const INPUT_STATE_NAMES: readonly InputStateName[] = ['EXPLORATION', 'DIALOGUE', 'COMBAT', 'MENU', 'CODEX', 'MAP', 'BRANCH'];

export type PanelAction = 'map' | 'journal' | 'codex' | 'inventory' | 'branch_tree' | 'shortcuts' | null;

export type GlobalInputAction = 'exit' | 'help' | 'escape' | 'skip_stream' | null;

export type GlobalInputResult = {
  readonly consumed: boolean;
  readonly action: GlobalInputAction;
};

export type GlobalInputKey = {
  readonly ctrl?: boolean;
  readonly escape?: boolean;
  readonly return?: boolean;
  readonly tab?: boolean;
};

export type GlobalInputContext = {
  readonly input: string;
  readonly key: GlobalInputKey;
  readonly isStreaming: boolean;
  readonly inputMode: InputMode;
  readonly isTyping: boolean;
};

export type UseGameInputReturn = {
  readonly inputMode: InputMode;
  readonly setInputMode: (mode: InputMode) => void;
  readonly selectedActionIndex: number;
  readonly setSelectedActionIndex: (index: number) => void;
  readonly isTyping: boolean;
  readonly inputValue: string;
  readonly setInputValue: (value: string) => void;
};

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

export function inputStateFromGamePhase(phase: GameState['phase'] | string): InputStateName {
  switch (phase) {
    case 'combat':
      return 'COMBAT';
    case 'dialogue':
      return 'DIALOGUE';
    case 'codex':
      return 'CODEX';
    case 'map':
      return 'MAP';
    case 'branch_tree':
    case 'compare':
      return 'BRANCH';
    case 'journal':
    case 'inventory':
    case 'shortcuts':
    case 'replay':
    case 'chapter_summary':
    case 'cost':
    case 'title':
    case 'narrative_creation':
    case 'game_over':
    case 'victory':
      return 'MENU';
    case 'game':
    default:
      return 'EXPLORATION';
  }
}

export function inputStateFromDomainEvent(eventName: 'combat_started' | 'combat_ended' | 'dialogue_started' | 'dialogue_ended'): InputStateName {
  switch (eventName) {
    case 'combat_started':
      return 'COMBAT';
    case 'dialogue_started':
      return 'DIALOGUE';
    case 'combat_ended':
    case 'dialogue_ended':
      return 'EXPLORATION';
  }
}

export function consumeGlobalInput({ input, key, isStreaming, inputMode, isTyping }: GlobalInputContext): GlobalInputResult {
  if (key.ctrl && input === 'c') {
    return { consumed: true, action: 'exit' };
  }
  if (inputMode === 'processing' && isStreaming && (key.return || input === ' ')) {
    return { consumed: true, action: 'skip_stream' };
  }
  if (key.escape) {
    return { consumed: true, action: 'escape' };
  }
  if (input === '?' && !isTyping) {
    return { consumed: true, action: 'help' };
  }
  return { consumed: false, action: null };
}

export function useGameInput(): UseGameInputReturn {
  const [inputMode, setInputMode] = useState<InputMode>('action_select');
  const [selectedActionIndex, setSelectedActionIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');

  const isTyping = inputMode === 'input_active';

  return {
    inputMode,
    setInputMode,
    selectedActionIndex,
    setSelectedActionIndex,
    isTyping,
    inputValue,
    setInputValue,
  };
}
