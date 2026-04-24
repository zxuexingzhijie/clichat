import { useState, useCallback, useRef } from 'react';
import type { NpcProfile } from '../../ai/prompts/npc-system';
import type { NpcDialogue } from '../../ai/schemas/npc-dialogue';
import { streamNpcDialogue } from '../../ai/roles/npc-actor';
import { generateNpcDialogue } from '../../ai/roles/npc-actor';
import { createSentenceBuffer } from '../../ai/utils/sentence-buffer';
import type { SentenceBuffer } from '../../ai/utils/sentence-buffer';
import { extractNpcMetadata } from '../../ai/utils/metadata-extractor';
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
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [metadata, setMetadata] = useState<NpcDialogue | null>(null);

  const cancelledRef = useRef(false);
  const skippedRef = useRef(false);
  const fullTextRef = useRef('');
  const bufferRef = useRef<SentenceBuffer | null>(null);
  const contextRef = useRef<NpcDialogueContext | null>(null);

  const startDialogue = useCallback((context: NpcDialogueContext) => {
    cancelledRef.current = false;
    skippedRef.current = false;
    fullTextRef.current = '';
    contextRef.current = context;
    setStreamingText('');
    setIsStreaming(true);
    setError(null);
    setMetadata(null);

    bufferRef.current = createSentenceBuffer({
      onFlush: (text: string) => {
        setStreamingText(prev => prev + text);
      },
    });

    const { npcProfile, scene, playerAction, memories } = context;

    eventBus.emit('npc_dialogue_streaming_started', {
      npcId: npcProfile.id,
      npcName: npcProfile.name,
    });

    (async () => {
      try {
        const stream = streamNpcDialogue(npcProfile, scene, playerAction, memories);
        for await (const chunk of stream) {
          if (cancelledRef.current) break;
          fullTextRef.current += chunk;
          if (!skippedRef.current) {
            bufferRef.current?.push(chunk);
          }
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
          setStreamingText(fullTextRef.current);

          const extracted = extractNpcMetadata(fullTextRef.current);
          const isAllDefaults =
            extracted.emotionTag === 'neutral' &&
            !extracted.shouldRemember &&
            extracted.relationshipDelta === 0;
          const isSubstantive = fullTextRef.current.length > SUBSTANTIVE_LENGTH_THRESHOLD;

          if (isAllDefaults && isSubstantive) {
            try {
              const ctx = contextRef.current!;
              const fallbackResult = await generateNpcDialogue(
                ctx.npcProfile,
                ctx.scene,
                ctx.playerAction,
                ctx.memories,
              );
              setMetadata({
                ...fallbackResult,
                dialogue: fullTextRef.current,
              });
            } catch {
              setMetadata({
                dialogue: fullTextRef.current,
                ...extracted,
              });
            }
          } else {
            setMetadata({
              dialogue: fullTextRef.current,
              ...extracted,
            });
          }

          eventBus.emit('npc_dialogue_streaming_completed', {
            npcId: npcProfile.id,
            charCount: fullTextRef.current.length,
          });

          setIsStreaming(false);
        }
      }
    })();
  }, []);

  const skipToEnd = useCallback(() => {
    if (!skippedRef.current && isStreaming) {
      skippedRef.current = true;
      bufferRef.current?.flush();
      bufferRef.current?.dispose();
      setStreamingText(fullTextRef.current);
    }
  }, [isStreaming]);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    bufferRef.current?.dispose();
    setStreamingText('');
    setIsStreaming(false);
    setError(null);
    setMetadata(null);
  }, []);

  return {
    streamingText,
    isStreaming,
    error,
    metadata,
    startDialogue,
    skipToEnd,
    reset,
  };
}
