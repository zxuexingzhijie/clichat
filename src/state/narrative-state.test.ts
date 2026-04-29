import { describe, it, expect } from 'bun:test';
import {
  NarrativeStateSchema,
  getDefaultNarrativeState,
  createNarrativeStore,
} from './narrative-state';

describe('getDefaultNarrativeState', () => {
  it('default state has currentAct: act1', () => {
    const state = getDefaultNarrativeState();
    expect(state.currentAct).toBe('act1');
  });

  it('default state has atmosphereTags: [mundane, curious]', () => {
    const state = getDefaultNarrativeState();
    expect(state.atmosphereTags).toEqual(['mundane', 'curious']);
  });

  it('default state has empty worldFlags', () => {
    const state = getDefaultNarrativeState();
    expect(state.worldFlags).toEqual({});
  });

  it('default state has playerKnowledgeLevel: 0', () => {
    const state = getDefaultNarrativeState();
    expect(state.playerKnowledgeLevel).toBe(0);
  });
});

describe('createNarrativeStore.restoreState', () => {
  it('round-trips cleanly via Zod parse', () => {
    const store = createNarrativeStore();
    const data = NarrativeStateSchema.parse({
      currentAct: 'act2',
      atmosphereTags: ['dread', 'urgency'],
      worldFlags: { ritual_site_active: true },
      playerKnowledgeLevel: 3,
    });
    store.restoreState(data);
    expect(store.getState()).toEqual(data);
  });

  it('overwrites existing state with restored data', () => {
    const store = createNarrativeStore();
    store.setState(draft => { draft.currentAct = 'act3'; });
    const data = getDefaultNarrativeState();
    store.restoreState(data);
    expect(store.getState().currentAct).toBe('act1');
  });
});

describe('NarrativeStateSchema', () => {
  it('worldFlags accepts arbitrary boolean keys', () => {
    const result = NarrativeStateSchema.safeParse({
      worldFlags: { some_flag: true, another_flag: false, yet_another: true },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.worldFlags['some_flag']).toBe(true);
      expect(result.data.worldFlags['another_flag']).toBe(false);
    }
  });

  it('playerKnowledgeLevel rejects values below 0', () => {
    const result = NarrativeStateSchema.safeParse({ playerKnowledgeLevel: -1 });
    expect(result.success).toBe(false);
  });

  it('playerKnowledgeLevel rejects values above 5', () => {
    const result = NarrativeStateSchema.safeParse({ playerKnowledgeLevel: 6 });
    expect(result.success).toBe(false);
  });

  it('playerKnowledgeLevel accepts boundary values 0 and 5', () => {
    expect(NarrativeStateSchema.safeParse({ playerKnowledgeLevel: 0 }).success).toBe(true);
    expect(NarrativeStateSchema.safeParse({ playerKnowledgeLevel: 5 }).success).toBe(true);
  });

  it('currentAct rejects values outside act1/act2/act3', () => {
    const result = NarrativeStateSchema.safeParse({ currentAct: 'act4' });
    expect(result.success).toBe(false);
  });
});
