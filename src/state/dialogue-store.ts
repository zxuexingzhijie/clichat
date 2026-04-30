import { z } from 'zod';
import { createStore, type Store } from './create-store';
import { eventBus } from '../events/event-bus';
import type { EventBus } from '../events/event-bus';
import { AttributeNameSchema } from '../types/common';

const DialogueEntrySchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const DialogueResponseSchema = z.object({
  id: z.string(),
  label: z.string(),
  requiresCheck: z.boolean(),
  checkAttribute: AttributeNameSchema.optional(),
  checkDc: z.number().optional(),
});

export const DialogueStateSchema = z.object({
  active: z.boolean(),
  npcId: z.string().nullable(),
  npcName: z.string(),
  mode: z.enum(['inline', 'full']),
  dialogueHistory: z.array(DialogueEntrySchema),
  availableResponses: z.array(DialogueResponseSchema),
  relationshipValue: z.number(),
  emotionHint: z.string().nullable(),
});

export type DialogueState = z.infer<typeof DialogueStateSchema>;

export function getDefaultDialogueState(): DialogueState {
  return {
    active: false,
    npcId: null,
    npcName: '',
    mode: 'inline',
    dialogueHistory: [],
    availableResponses: [],
    relationshipValue: 0,
    emotionHint: null,
  };
}

export function createDialogueStore(bus: EventBus): Store<DialogueState> {
  return createStore<DialogueState>(
    getDefaultDialogueState(),
    ({ newState, oldState }) => {
      if (newState.active && !oldState.active && newState.npcId) {
        bus.emit('dialogue_started', {
          npcId: newState.npcId,
          npcName: newState.npcName,
          mode: newState.mode,
        });
      }
      if (!newState.active && oldState.active && oldState.npcId) {
        bus.emit('dialogue_ended', { npcId: oldState.npcId });
      }
    },
  );
}

export const dialogueStore = createDialogueStore(eventBus);
