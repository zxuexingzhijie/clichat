import { useState, useCallback, useRef } from 'react';
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
};

export type UseNpcDialogueReturn = {
  readonly streamingText: string;
  readonly isStreaming: boolean;
  readonly error: Error | null;
  readonly metadata: NpcDialogue | null;
  readonly startDialogue: (context: NpcDialogueContext) => void;
  readonly skipToEnd: () => void;
  readonly reset: () => void;
};

const SUBSTANTIVE_LENGTH_THRESHOLD = 50;

export function useNpcDialogue(): UseNpcDialogueReturn {
  const [metadata, setMetadata] = useState<NpcDialogue | null>(null);
  const contextRef = useRef<NpcDialogueContext | null>(null);
  const streaming = useStreamingText();

  const startDialogue = useCallback((context: NpcDialogueContext) => {
    contextRef.current = context;
    setMetadata(null);

    const { npcProfile, scene, playerAction, memories } = context;

    eventBus.emit('npc_dialogue_streaming_started', {
      npcId: npcProfile.id,
      npcName: npcProfile.name,
    });

    streaming.start(streamNpcDialogue(npcProfile, scene, playerAction, memories));
  }, [streaming.start]);

  const originalReset = streaming.reset;
  const reset = useCallback(() => {
    originalReset();
    setMetadata(null);
  }, [originalReset]);

  // Post-stream metadata extraction — runs when streaming completes
  const prevIsStreaming = useRef(streaming.isStreaming);
  if (prevIsStreaming.current && !streaming.isStreaming && !streaming.error) {
    prevIsStreaming.current = false;
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
        ).then(result => {
          setMetadata({ ...result, dialogue: fullText });
        }).catch(() => {
          setMetadata({ dialogue: fullText, sentiment: 'neutral', ...extracted });
        });
      } else {
        setMetadata({ dialogue: fullText, sentiment: 'neutral', ...extracted });
      }

      eventBus.emit('npc_dialogue_streaming_completed', {
        npcId: ctx.npcProfile.id,
        charCount: fullText.length,
      });
    }
  }
  prevIsStreaming.current = streaming.isStreaming;

  return {
    streamingText: streaming.streamingText,
    isStreaming: streaming.isStreaming,
    error: streaming.error,
    metadata,
    startDialogue,
    skipToEnd: streaming.skipToEnd,
    reset,
  };
}
