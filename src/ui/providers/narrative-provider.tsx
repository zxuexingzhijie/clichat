import React, { createContext, useContext, useMemo } from 'react';

import { SceneStoreCtx } from '../../app';
import { useAiNarration } from '../hooks/use-ai-narration';
import type { UseAiNarrationReturn } from '../hooks/use-ai-narration';
import { useNpcDialogue } from '../hooks/use-npc-dialogue';
import type { UseNpcDialogueReturn } from '../hooks/use-npc-dialogue';

export type NarrativeTextState = {
  readonly sceneLines: readonly string[];
  readonly streamingText: string;
  readonly dialogueStreamingText: string;
  readonly narrationError: Error | null;
  readonly dialogueError: Error | null;
};

type NarrativeContextValue = {
  readonly narration: UseAiNarrationReturn;
  readonly dialogue: UseNpcDialogueReturn;
  readonly text: NarrativeTextState;
  readonly isStreaming: boolean;
};

const NarrativeContext = createContext<NarrativeContextValue | null>(null);

function useNarrativeContext(): NarrativeContextValue {
  const context = useContext(NarrativeContext);
  if (!context) {
    throw new ReferenceError('Narrative hooks must be used within NarrativeProvider');
  }
  return context;
}

export function NarrativeProvider({ children }: { readonly children: React.ReactNode }): React.ReactNode {
  const narration = useAiNarration();
  const dialogue = useNpcDialogue();
  const sceneLines = SceneStoreCtx.useStoreState((state) => state.narrationLines);

  const isStreaming = narration.isStreaming || dialogue.isStreaming;

  const text = useMemo<NarrativeTextState>(() => ({
    sceneLines,
    streamingText: narration.streamingText,
    dialogueStreamingText: dialogue.streamingText,
    narrationError: narration.error,
    dialogueError: dialogue.error,
  }), [sceneLines, narration.streamingText, dialogue.streamingText, narration.error, dialogue.error]);

  const value = useMemo<NarrativeContextValue>(() => ({
    narration,
    dialogue,
    text,
    isStreaming,
  }), [narration, dialogue, text, isStreaming]);

  return React.createElement(NarrativeContext.Provider, { value }, children);
}

export function useNarrationStream(): UseAiNarrationReturn {
  return useNarrativeContext().narration;
}

export function useDialogueStream(): UseNpcDialogueReturn {
  return useNarrativeContext().dialogue;
}

export function useNarrativeText(): NarrativeTextState {
  return useNarrativeContext().text;
}

export function useIsStreaming(): boolean {
  return useNarrativeContext().isStreaming;
}
