import { describe, it, expect } from 'bun:test';
import { getAttitudeLabel, applyReputationDelta, filterResponsesByReputation, sentimentToDelta, applyFactionReputationDelta } from './reputation-system';
import type { RelationState } from '../state/relation-store';

describe('getAttitudeLabel', () => {
  it('returns 敌视 for value -70', () => {
    expect(getAttitudeLabel(-70)).toBe('敌视');
  });

  it('returns 冷漠 for value -40', () => {
    expect(getAttitudeLabel(-40)).toBe('冷漠');
  });

  it('returns 中立 for value 0', () => {
    expect(getAttitudeLabel(0)).toBe('中立');
  });

  it('returns 友好 for value 40', () => {
    expect(getAttitudeLabel(40)).toBe('友好');
  });

  it('returns 信任 for value 70', () => {
    expect(getAttitudeLabel(70)).toBe('信任');
  });

  it('returns 冷漠 for boundary value -60 (strict less-than, -60 is NOT ≤ -60 for 敌视)', () => {
    expect(getAttitudeLabel(-60)).toBe('冷漠');
  });

  it('returns 敌视 for value -61', () => {
    expect(getAttitudeLabel(-61)).toBe('敌视');
  });

  it('returns 中立 for boundary value -20', () => {
    expect(getAttitudeLabel(-20)).toBe('中立');
  });

  it('returns 友好 for boundary value 20', () => {
    expect(getAttitudeLabel(20)).toBe('友好');
  });

  it('returns 信任 for boundary value 60', () => {
    expect(getAttitudeLabel(60)).toBe('信任');
  });
});

describe('applyReputationDelta', () => {
  const baseDisposition = {
    value: 10,
    publicReputation: 0,
    personalTrust: 0,
    fear: 0,
    infamy: 0,
    credibility: 0,
  };

  it('returns new object with value increased by delta', () => {
    const result = applyReputationDelta(baseDisposition, { value: 10 });
    expect(result.value).toBe(20);
  });

  it('does not mutate the original disposition', () => {
    const original = { ...baseDisposition };
    applyReputationDelta(baseDisposition, { value: 10 });
    expect(baseDisposition).toEqual(original);
  });

  it('clamps value to 100 maximum', () => {
    const high = { ...baseDisposition, value: 95 };
    const result = applyReputationDelta(high, { value: 20 });
    expect(result.value).toBe(100);
  });

  it('clamps value to -100 minimum', () => {
    const low = { ...baseDisposition, value: -95 };
    const result = applyReputationDelta(low, { value: -20 });
    expect(result.value).toBe(-100);
  });

  it('applies delta to other disposition fields', () => {
    const result = applyReputationDelta(baseDisposition, { personalTrust: 15 });
    expect(result.personalTrust).toBe(15);
    expect(result.value).toBe(10);
  });

  it('preserves unchanged fields', () => {
    const result = applyReputationDelta(baseDisposition, { value: 5 });
    expect(result.publicReputation).toBe(0);
    expect(result.fear).toBe(0);
    expect(result.infamy).toBe(0);
    expect(result.credibility).toBe(0);
  });
});

describe('filterResponsesByReputation', () => {
  it('returns response with locked=true when minReputation=30 and disposition=10', () => {
    const responses = [{ id: 'r1', text: 'Hello', minReputation: 30 }];
    const result = filterResponsesByReputation(responses, 10);
    expect(result[0]?.locked).toBe(true);
  });

  it('returns response with locked=false when minReputation=30 and disposition=30', () => {
    const responses = [{ id: 'r1', text: 'Hello', minReputation: 30 }];
    const result = filterResponsesByReputation(responses, 30);
    expect(result[0]?.locked).toBe(false);
  });

  it('returns locked=false when no minReputation is set', () => {
    const responses: { id: string; text: string; minReputation?: number }[] = [{ id: 'r1', text: 'Hello' }];
    const result = filterResponsesByReputation(responses, 10);
    expect(result[0]?.locked).toBe(false);
  });

  it('handles empty responses array', () => {
    const result = filterResponsesByReputation([], 10);
    expect(result).toEqual([]);
  });

  it('preserves original response fields', () => {
    const responses = [{ id: 'r1', text: 'Hello', minReputation: 10 }];
    const result = filterResponsesByReputation(responses, 20);
    expect(result[0]?.id).toBe('r1');
    expect(result[0]?.text).toBe('Hello');
  });
});

describe('sentimentToDelta', () => {
  it('returns 10 for positive', () => {
    expect(sentimentToDelta('positive')).toBe(10);
  });

  it('returns 0 for neutral', () => {
    expect(sentimentToDelta('neutral')).toBe(0);
  });

  it('returns -10 for negative', () => {
    expect(sentimentToDelta('negative')).toBe(-10);
  });

  it('returns -20 for hostile', () => {
    expect(sentimentToDelta('hostile')).toBe(-20);
  });

  it('returns 0 for unknown sentiment', () => {
    expect(sentimentToDelta('unknown')).toBe(0);
  });
});

describe('applyFactionReputationDelta', () => {
  function makeRelationStore(initial: Partial<RelationState> = {}) {
    let state: RelationState = {
      npcDispositions: {},
      factionReputations: {},
      ...initial,
    };
    return {
      getState: () => state,
      setState: (updater: (draft: RelationState) => void) => {
        const draft = { ...state, factionReputations: { ...state.factionReputations } };
        updater(draft);
        state = draft;
      },
    };
  }

  it('writes delta to factionReputations for new faction', () => {
    const store = makeRelationStore();
    applyFactionReputationDelta(store as never, 'faction_guard', 5);
    expect(store.getState().factionReputations['faction_guard']).toBe(5);
  });

  it('accumulates delta on existing faction reputation', () => {
    const store = makeRelationStore({ factionReputations: { faction_guard: 30 } });
    applyFactionReputationDelta(store as never, 'faction_guard', 10);
    expect(store.getState().factionReputations['faction_guard']).toBe(40);
  });

  it('clamps faction reputation at 100', () => {
    const store = makeRelationStore({ factionReputations: { faction_guard: 95 } });
    applyFactionReputationDelta(store as never, 'faction_guard', 20);
    expect(store.getState().factionReputations['faction_guard']).toBe(100);
  });

  it('clamps faction reputation at -100', () => {
    const store = makeRelationStore({ factionReputations: { faction_guard: -95 } });
    applyFactionReputationDelta(store as never, 'faction_guard', -20);
    expect(store.getState().factionReputations['faction_guard']).toBe(-100);
  });
});
