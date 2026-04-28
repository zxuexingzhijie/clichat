import type { NpcDisposition, RelationState } from '../state/relation-store';
import type { Store } from '../state/create-store';

const SENTIMENT_DELTAS: Record<string, number> = {
  positive: 10,
  neutral: 0,
  negative: -10,
  hostile: -20,
};

export function sentimentToDelta(sentiment: string): number {
  return SENTIMENT_DELTAS[sentiment] ?? 0;
}

export function getAttitudeLabel(value: number): string {
  if (value < -60) return '敌视';
  if (value < -20) return '冷漠';
  if (value < 20) return '中立';
  if (value < 60) return '友好';
  return '信任';
}

export function applyReputationDelta(
  current: NpcDisposition,
  delta: Partial<NpcDisposition>,
): NpcDisposition {
  const clamp = (v: number) => Math.min(100, Math.max(-100, v));
  return {
    value: clamp((current.value) + (delta.value ?? 0)),
    publicReputation: clamp((current.publicReputation) + (delta.publicReputation ?? 0)),
    personalTrust: clamp((current.personalTrust) + (delta.personalTrust ?? 0)),
    fear: clamp((current.fear) + (delta.fear ?? 0)),
    infamy: clamp((current.infamy) + (delta.infamy ?? 0)),
    credibility: clamp((current.credibility) + (delta.credibility ?? 0)),
  };
}

export function filterResponsesByReputation<T extends { minReputation?: number }>(
  responses: T[],
  dispositionValue: number,
): (T & { locked: boolean })[] {
  return responses.map(r => ({
    ...r,
    locked: r.minReputation !== undefined && dispositionValue < r.minReputation,
  }));
}

export function applyFactionReputationDelta(
  relationStore: Store<RelationState>,
  factionId: string,
  delta: number,
): void {
  relationStore.setState((draft) => {
    const current = draft.factionReputations[factionId] ?? 0;
    draft.factionReputations = {
      ...draft.factionReputations,
      [factionId]: Math.max(-100, Math.min(100, current + delta)),
    };
  });
}
