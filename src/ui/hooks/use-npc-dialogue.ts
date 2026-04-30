import { useState, useCallback, useRef, useEffect } from 'react';
import type { NpcProfile } from '../../ai/prompts/npc-system';
import type { NpcDialogue } from '../../ai/schemas/npc-dialogue';
import { streamNpcDialogue } from '../../ai/roles/npc-actor';
import { generateNpcDialogue } from '../../ai/roles/npc-actor';
import { extractNpcMetadata } from '../../ai/utils/metadata-extractor';
import { useStreamingText } from './use-streaming-text';
import { eventBus } from '../../events/event-bus';

export type NpcDialogueContext = {
  readonly npcProfile: NpcProfile;
  readonly scene: string;
  readonly playerAction: string;
  readonly memories: readonly string[];
  readonly archiveSummary?: string;
  readonly relevantCodex?: readonly string[];
  readonly conversationHistory?: readonly { readonly role: 'user' | 'assistant'; readonly content: string }[];
};

type HistoryEntry = { role: 'user' | 'assistant'; content: string };

export type UseNpcDialogueReturn = {
  readonly streamingText: string;
  readonly isStreaming: boolean;
  readonly error: Error | null;
  readonly metadata: NpcDialogue | null;
  readonly startDialogue: (context: NpcDialogueContext) => void;
  readonly skipToEnd: () => void;
  readonly reset: () => void;
  readonly resetMessages: () => void;
};

const SUBSTANTIVE_LENGTH_THRESHOLD = 50;

export type NpcDialogueStateController = {
  readonly startDialogue: (context: NpcDialogueContext) => void;
  readonly startDialogueAndWait: (context: NpcDialogueContext) => Promise<void>;
  readonly reset: () => void;
  readonly resetMessages: () => void;
  readonly getMessages: () => readonly HistoryEntry[];
};

export function createNpcDialogueState(deps?: {
  streamFn?: typeof streamNpcDialogue;
  generateFn?: typeof generateNpcDialogue;
  extractFn?: typeof extractNpcMetadata;
}): NpcDialogueStateController {
  const streamFn = deps?.streamFn ?? streamNpcDialogue;
  const generateFn = deps?.generateFn ?? generateNpcDialogue;
  const extractFn = deps?.extractFn ?? extractNpcMetadata;
  const messages: HistoryEntry[] = [];
  let isStreaming = false;

  const startDialogue = (context: NpcDialogueContext): void => {
    const { npcProfile, scene, playerAction, memories } = context;

    eventBus.emit('npc_dialogue_streaming_started', {
      npcId: npcProfile.id,
      npcName: npcProfile.name,
    });

    isStreaming = true;
    streamFn(npcProfile, scene, playerAction, memories, {
      archiveSummary: context.archiveSummary,
      relevantCodex: context.relevantCodex,
      conversationHistory: messages.length > 0 ? [...messages] : context.conversationHistory,
    });
  };

  const startDialogueAndWait = async (context: NpcDialogueContext): Promise<void> => {
    const { npcProfile, scene, playerAction, memories } = context;

    eventBus.emit('npc_dialogue_streaming_started', {
      npcId: npcProfile.id,
      npcName: npcProfile.name,
    });

    isStreaming = true;
    const stream = streamFn(npcProfile, scene, playerAction, memories, {
      archiveSummary: context.archiveSummary,
      relevantCodex: context.relevantCodex,
      conversationHistory: messages.length > 0 ? [...messages] : context.conversationHistory,
    });

    let fullText = '';
    for await (const chunk of stream) {
      fullText += chunk;
    }

    messages.push(
      { role: 'user', content: playerAction },
      { role: 'assistant', content: fullText },
    );

    isStreaming = false;

    eventBus.emit('npc_dialogue_streaming_completed', {
      npcId: npcProfile.id,
      charCount: fullText.length,
    });
  };

  const reset = (): void => {
    isStreaming = false;
  };

  const resetMessages = (): void => {
    messages.length = 0;
  };

  const getMessages = (): readonly HistoryEntry[] => [...messages];

  return { startDialogue, startDialogueAndWait, reset, resetMessages, getMessages };
}

export function useNpcDialogue(): UseNpcDialogueReturn {
  const [metadata, setMetadata] = useState<NpcDialogue | null>(null);
  const contextRef = useRef<NpcDialogueContext | null>(null);
  const messagesRef = useRef<HistoryEntry[]>([]);
  const streaming = useStreamingText();
  const completionFiredRef = useRef(false);

  const startDialogue = useCallback((context: NpcDialogueContext) => {
    contextRef.current = context;
    setMetadata(null);

    const { npcProfile, scene, playerAction, memories } = context;

    eventBus.emit('npc_dialogue_streaming_started', {
      npcId: npcProfile.id,
      npcName: npcProfile.name,
    });

    streaming.start(streamNpcDialogue(npcProfile, scene, playerAction, memories, {
      archiveSummary: context.archiveSummary,
      relevantCodex: context.relevantCodex,
      conversationHistory: messagesRef.current.length > 0 ? messagesRef.current : context.conversationHistory,
    }));
  }, [streaming.start]);

  const originalReset = streaming.reset;
  const reset = useCallback(() => {
    originalReset();
    setMetadata(null);
  }, [originalReset]);

  const resetMessages = useCallback(() => {
    messagesRef.current = [];
  }, []);

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
        const isAllDefaults =
          extracted.emotionTag === 'neutral' &&
          !extracted.shouldRemember &&
          !extracted.sentiment;
        const isSubstantive = fullText.length > SUBSTANTIVE_LENGTH_THRESHOLD;

        if (isAllDefaults && isSubstantive) {
          generateNpcDialogue(
            ctx.npcProfile,
            ctx.scene,
            ctx.playerAction,
            ctx.memories,
            {
              archiveSummary: ctx.archiveSummary,
              relevantCodex: ctx.relevantCodex,
              conversationHistory: messagesRef.current.length > 0 ? messagesRef.current : ctx.conversationHistory,
            },
          ).then(result => {
            setMetadata({ ...result, dialogue: fullText });
          }).catch(() => {
            setMetadata({ dialogue: fullText, sentiment: 'neutral', ...extracted });
          });
        } else {
          setMetadata({ dialogue: fullText, sentiment: 'neutral', ...extracted });
        }

        messagesRef.current = [
          ...messagesRef.current,
          { role: 'user' as const, content: ctx.playerAction },
          { role: 'assistant' as const, content: fullText },
        ];

        eventBus.emit('npc_dialogue_streaming_completed', {
          npcId: ctx.npcProfile.id,
          charCount: fullText.length,
        });
      }
    }
  }, [streaming.isStreaming, streaming.error, streaming.streamingText]);

  return {
    streamingText: streaming.streamingText,
    isStreaming: streaming.isStreaming,
    error: streaming.error,
    metadata,
    startDialogue,
    skipToEnd: streaming.skipToEnd,
    reset,
    resetMessages,
  };
}
