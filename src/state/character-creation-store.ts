import { z } from 'zod';
import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';
import { AttributeNameSchema } from '../types/common';

export const CharacterCreationStateSchema = z.object({
  currentStep: z.number().int().min(0).max(4),
  selectedRace: z.string().nullable(),
  selectedProfession: z.string().nullable(),
  backgroundChoices: z.array(z.string()),
  attributePreview: z.record(AttributeNameSchema, z.number()),
  isQuickMode: z.boolean(),
  isComplete: z.boolean(),
});

export type CharacterCreationState = z.infer<typeof CharacterCreationStateSchema>;

export function getDefaultCharacterCreationState(): CharacterCreationState {
  return {
    currentStep: 0,
    selectedRace: null,
    selectedProfession: null,
    backgroundChoices: [],
    attributePreview: { physique: 0, finesse: 0, mind: 0 },
    isQuickMode: false,
    isComplete: false,
  };
}

export const characterCreationStore = createStore<CharacterCreationState>(
  getDefaultCharacterCreationState(),
  ({ newState, oldState }) => {
    if (newState.currentStep !== oldState.currentStep) {
      eventBus.emit('narrative_creation_round_changed', {
        round: newState.currentStep,
        totalRounds: 4,
      });
    }
    if (newState.isComplete && !oldState.isComplete) {
      eventBus.emit('character_created', {
        name: '',
        race: newState.selectedRace ?? '',
        profession: newState.selectedProfession ?? '',
      });
    }
  },
);
