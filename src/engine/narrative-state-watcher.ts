import narrativeTransitions from '../../world-data/narrative-transitions.yaml';
import type { NarrativeStore } from '../state/narrative-state';
import type { EventBus } from '../events/event-bus';

type TransitionEntry = {
  on_stage: string;
  set_act: 'act1' | 'act2' | 'act3';
  set_atmosphere: string[];
  set_knowledge_level: number;
  set_world_flags: Record<string, boolean>;
};

export function createNarrativeStateWatcher(
  narrativeStore: NarrativeStore,
  bus: EventBus,
): () => void {
  const transitions = (narrativeTransitions as { transitions: TransitionEntry[] }).transitions;

  const onStageAdvanced = ({ newStageId }: { questId: string; newStageId: string; turnNumber: number }) => {
    const match = transitions.find(t => t.on_stage === newStageId);
    if (!match) return;

    narrativeStore.setState(draft => {
      draft.currentAct = match.set_act;
      draft.atmosphereTags = match.set_atmosphere;
      draft.playerKnowledgeLevel = match.set_knowledge_level;
      for (const [key, value] of Object.entries(match.set_world_flags)) {
        draft.worldFlags[key] = value;
      }
    });
  };

  bus.on('quest_stage_advanced', onStageAdvanced);
  return () => bus.off('quest_stage_advanced', onStageAdvanced);
}
