import { describe, it, expect, beforeEach, mock } from 'bun:test';

// Mock the event bus before importing the store
const emitMock = mock(() => {});
mock.module('../events/event-bus', () => ({
  eventBus: { emit: emitMock, on: mock(() => () => {}) },
}));

const { NpcDispositionSchema, RelationStateSchema, getDefaultRelationState, relationStore } =
  await import('./relation-store');

describe('NpcDispositionSchema', () => {
  it('validates with all 6 fields in [-100, 100]', () => {
    const result = NpcDispositionSchema.safeParse({
      value: 30,
      publicReputation: -50,
      personalTrust: 100,
      fear: -100,
      infamy: 0,
      credibility: 70,
    });
    expect(result.success).toBe(true);
  });

  it('rejects value out of range', () => {
    const result = NpcDispositionSchema.safeParse({
      value: 101,
      publicReputation: 0,
      personalTrust: 0,
      fear: 0,
      infamy: 0,
      credibility: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects value below range', () => {
    const result = NpcDispositionSchema.safeParse({
      value: -101,
      publicReputation: 0,
      personalTrust: 0,
      fear: 0,
      infamy: 0,
      credibility: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('RelationStateSchema', () => {
  it('validates with empty npcDispositions and factionReputations', () => {
    const result = RelationStateSchema.safeParse({
      npcDispositions: {},
      factionReputations: {},
    });
    expect(result.success).toBe(true);
  });

  it('validates with populated npcDispositions', () => {
    const result = RelationStateSchema.safeParse({
      npcDispositions: {
        npc_guard: { value: 30, publicReputation: 0, personalTrust: 0, fear: 0, infamy: 0, credibility: 0 },
      },
      factionReputations: { faction_a: 50 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects factionReputations values out of range', () => {
    const result = RelationStateSchema.safeParse({
      npcDispositions: {},
      factionReputations: { faction_a: 150 },
    });
    expect(result.success).toBe(false);
  });
});

describe('getDefaultRelationState', () => {
  it('returns empty npcDispositions and factionReputations', () => {
    const state = getDefaultRelationState();
    expect(state).toEqual({ npcDispositions: {}, factionReputations: {} });
  });
});

describe('relationStore onChange', () => {
  beforeEach(() => {
    emitMock.mockClear();
    // Reset store to default state
    relationStore.setState(draft => {
      draft.npcDispositions = {};
      draft.factionReputations = {};
    });
    emitMock.mockClear();
  });

  it('emits reputation_changed when npcDispositions value changes (npc_guard delta=30)', () => {
    relationStore.setState(draft => {
      draft.npcDispositions['npc_guard'] = {
        value: 30,
        publicReputation: 0,
        personalTrust: 0,
        fear: 0,
        infamy: 0,
        credibility: 0,
      };
    });

    expect(emitMock).toHaveBeenCalledWith('reputation_changed', {
      targetId: 'npc_guard',
      targetType: 'npc',
      delta: 30,
      newValue: 30,
    });
  });

  it('emits reputation_changed when factionReputations changes (faction_guard delta=15)', () => {
    relationStore.setState(draft => {
      draft.factionReputations['faction_guard'] = 15;
    });

    expect(emitMock).toHaveBeenCalledWith('reputation_changed', {
      targetId: 'faction_guard',
      targetType: 'faction',
      delta: 15,
      newValue: 15,
    });
  });

  it('does not emit when state does not change', () => {
    // Set up initial state with npc_guard
    relationStore.setState(draft => {
      draft.npcDispositions['npc_guard'] = {
        value: 30,
        publicReputation: 0,
        personalTrust: 0,
        fear: 0,
        infamy: 0,
        credibility: 0,
      };
    });
    emitMock.mockClear();

    // Set same value again (no change)
    relationStore.setState(draft => {
      draft.npcDispositions['npc_guard'] = {
        value: 30,
        publicReputation: 0,
        personalTrust: 0,
        fear: 0,
        infamy: 0,
        credibility: 0,
      };
    });

    expect(emitMock).not.toHaveBeenCalledWith('reputation_changed', expect.anything());
  });
});
