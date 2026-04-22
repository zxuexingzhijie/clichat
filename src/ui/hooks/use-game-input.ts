import { useState, useCallback } from 'react';

export type InputMode = 'action_select' | 'input_active' | 'processing';

export type PanelAction = 'map' | 'journal' | 'codex' | 'inventory' | 'branch_tree' | 'shortcuts' | null;

type UseGameInputReturn = {
  readonly inputMode: InputMode;
  readonly setInputMode: (mode: InputMode) => void;
  readonly selectedActionIndex: number;
  readonly setSelectedActionIndex: (index: number) => void;
  readonly isTyping: boolean;
  readonly pendingPanelAction: PanelAction;
  readonly clearPanelAction: () => void;
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

export function useGameInput(): UseGameInputReturn {
  const [inputMode, setInputMode] = useState<InputMode>('action_select');
  const [selectedActionIndex, setSelectedActionIndex] = useState(0);
  const [pendingPanelAction, setPendingPanelAction] = useState<PanelAction>(null);

  const isTyping = inputMode === 'input_active';

  const clearPanelAction = useCallback(() => {
    setPendingPanelAction(null);
  }, []);

  return {
    inputMode,
    setInputMode,
    selectedActionIndex,
    setSelectedActionIndex,
    isTyping,
    pendingPanelAction,
    clearPanelAction,
  };
}
