import { describe, it, expect } from 'bun:test';
import mitt from 'mitt';
import type { DomainEvents } from '../events/event-types';
import { createNarrativeStore, getDefaultNarrativeState } from '../state/narrative-state';
import { createNarrativeStateWatcher } from './narrative-state-watcher';

function freshBus() {
  return mitt<DomainEvents>();
}

describe('createNarrativeStateWatcher', () => {
  it('emitting quest_stage_advanced with stage_truth_in_forest sets act2 and ritual_site_active', () => {
    const store = createNarrativeStore();
    const bus = freshBus();
    createNarrativeStateWatcher(store, bus);

    bus.emit('quest_stage_advanced', { questId: 'quest_main_01', newStageId: 'stage_truth_in_forest', turnNumber: 10 });

    expect(store.getState().currentAct).toBe('act2');
    expect(store.getState().atmosphereTags).toEqual(['dread', 'mystery', 'urgency']);
    expect(store.getState().worldFlags['ritual_site_active']).toBe(true);
    expect(store.getState().playerKnowledgeLevel).toBe(2);
  });

  it('emitting quest_stage_advanced with stage_disappearances sets act1 and knowledgeLevel 1', () => {
    const store = createNarrativeStore();
    const bus = freshBus();
    createNarrativeStateWatcher(store, bus);

    bus.emit('quest_stage_advanced', { questId: 'quest_main_01', newStageId: 'stage_disappearances', turnNumber: 5 });

    expect(store.getState().currentAct).toBe('act1');
    expect(store.getState().atmosphereTags).toEqual(['mundane', 'curious', 'unsettled']);
    expect(store.getState().playerKnowledgeLevel).toBe(1);
  });

  it('unknown stage IDs are ignored — store remains unchanged', () => {
    const store = createNarrativeStore();
    const bus = freshBus();
    createNarrativeStateWatcher(store, bus);

    const before = store.getState();
    bus.emit('quest_stage_advanced', { questId: 'quest_x', newStageId: 'stage_unknown_xyz', turnNumber: 1 });

    expect(store.getState()).toEqual(before);
  });

  it('cleanup function removes listener — store no longer updates after cleanup', () => {
    const store = createNarrativeStore();
    const bus = freshBus();
    const cleanup = createNarrativeStateWatcher(store, bus);

    cleanup();

    bus.emit('quest_stage_advanced', { questId: 'quest_main_01', newStageId: 'stage_truth_in_forest', turnNumber: 10 });

    expect(store.getState().currentAct).toBe('act1');
  });

  it('stage_consequence_justice sets worldFlags.mayor_arrested and act3', () => {
    const store = createNarrativeStore();
    const bus = freshBus();
    createNarrativeStateWatcher(store, bus);

    bus.emit('quest_stage_advanced', { questId: 'quest_main_01', newStageId: 'stage_consequence_justice', turnNumber: 20 });

    expect(store.getState().currentAct).toBe('act3');
    expect(store.getState().worldFlags['mayor_arrested']).toBe(true);
    expect(store.getState().playerKnowledgeLevel).toBe(5);
  });

  it('multiple transitions accumulate worldFlags correctly', () => {
    const store = createNarrativeStore();
    const bus = freshBus();
    createNarrativeStateWatcher(store, bus);

    bus.emit('quest_stage_advanced', { questId: 'quest_main_01', newStageId: 'stage_truth_in_forest', turnNumber: 10 });
    bus.emit('quest_stage_advanced', { questId: 'quest_main_01', newStageId: 'stage_mayor_secret', turnNumber: 15 });

    expect(store.getState().worldFlags['ritual_site_active']).toBe(true);
    expect(store.getState().worldFlags['mayor_secret_known']).toBe(true);
    expect(store.getState().currentAct).toBe('act2');
  });
});
