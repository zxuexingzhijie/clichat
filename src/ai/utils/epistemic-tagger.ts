export type EpistemicLevel =
  | 'world_truth'
  | 'npc_belief'
  | 'player_knowledge'
  | 'scene_visible'
  | 'npc_memory';

export type TaggedContextChunk = {
  readonly content: string;
  readonly epistemicLevel: EpistemicLevel;
  readonly sourceId: string;
  readonly sourceType: string;
};

export type CognitiveContextEnvelope = {
  readonly worldTruth: readonly TaggedContextChunk[];
  readonly npcBelief: readonly TaggedContextChunk[];
  readonly playerKnowledge: readonly TaggedContextChunk[];
  readonly sceneVisible: readonly TaggedContextChunk[];
  readonly npcMemory: readonly TaggedContextChunk[];
};

export function tagContextChunk(
  content: string,
  level: EpistemicLevel,
  sourceId: string,
  sourceType: string,
): TaggedContextChunk {
  return { content, epistemicLevel: level, sourceId, sourceType };
}

export function buildCognitiveEnvelope(
  chunks: readonly TaggedContextChunk[],
): CognitiveContextEnvelope {
  return {
    worldTruth: chunks.filter(c => c.epistemicLevel === 'world_truth'),
    npcBelief: chunks.filter(c => c.epistemicLevel === 'npc_belief'),
    playerKnowledge: chunks.filter(c => c.epistemicLevel === 'player_knowledge'),
    sceneVisible: chunks.filter(c => c.epistemicLevel === 'scene_visible'),
    npcMemory: chunks.filter(c => c.epistemicLevel === 'npc_memory'),
  };
}

export function filterForNpcActor(
  envelope: CognitiveContextEnvelope,
  npcId: string,
): readonly TaggedContextChunk[] {
  return [
    ...envelope.sceneVisible,
    ...envelope.npcMemory.filter(c => c.sourceId === npcId),
    ...envelope.npcBelief.filter(c => c.sourceId === npcId),
  ];
}

export function filterForNarrativeDirector(
  envelope: CognitiveContextEnvelope,
): readonly TaggedContextChunk[] {
  return [
    ...envelope.worldTruth,
    ...envelope.sceneVisible,
    ...envelope.playerKnowledge,
  ];
}
