import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { eventBus } from '../events/event-bus';
import { playerKnowledgeStore, getDefaultPlayerKnowledgeState } from '../state/player-knowledge-store';
import { gameStore, getDefaultGameState } from '../state/game-store';

const stores = { playerKnowledge: playerKnowledgeStore, game: gameStore };

describe('KnowledgeTracker', () => {
  let cleanup: (() => void) | null = null;

  beforeEach(() => {
    playerKnowledgeStore.setState(() => getDefaultPlayerKnowledgeState());
    gameStore.setState(() => getDefaultGameState());
    cleanup = null;
  });

  afterEach(() => {
    if (cleanup) cleanup();
    eventBus.all.clear();
  });

  test('dialogue_ended adds knowledge entry with source dialogue and status heard', async () => {
    const { initKnowledgeTracker } = await import('./knowledge-tracker');
    cleanup = initKnowledgeTracker(stores, eventBus);

    gameStore.setState(draft => { draft.turnCount = 5; });
    eventBus.emit('dialogue_ended', { npcId: 'npc_bartender' });

    const entries = Object.values(playerKnowledgeStore.getState().entries);
    expect(entries.length).toBe(1);
    expect(entries[0]!.source).toBe('dialogue');
    expect(entries[0]!.knowledgeStatus).toBe('heard');
    expect(entries[0]!.codexEntryId).toBe('npc_bartender');
  });

  test('quest_stage_advanced adds knowledge entry with source quest_progress and status suspected', async () => {
    const { initKnowledgeTracker } = await import('./knowledge-tracker');
    cleanup = initKnowledgeTracker(stores, eventBus);

    gameStore.setState(draft => { draft.turnCount = 10; });
    eventBus.emit('quest_stage_advanced', {
      questId: 'quest_01',
      newStageId: 'stage_02',
      turnNumber: 10,
    });

    const entries = Object.values(playerKnowledgeStore.getState().entries);
    expect(entries.length).toBe(1);
    expect(entries[0]!.source).toBe('quest_progress');
    expect(entries[0]!.knowledgeStatus).toBe('suspected');
    expect(entries[0]!.relatedQuestId).toBe('quest_01');
  });

  test('quest_completed adds knowledge entry with source quest_completion and status confirmed', async () => {
    const { initKnowledgeTracker } = await import('./knowledge-tracker');
    cleanup = initKnowledgeTracker(stores, eventBus);

    gameStore.setState(draft => { draft.turnCount = 20; });
    eventBus.emit('quest_completed', { questId: 'quest_01', rewards: {} });

    const entries = Object.values(playerKnowledgeStore.getState().entries);
    expect(entries.length).toBe(1);
    expect(entries[0]!.source).toBe('quest_completion');
    expect(entries[0]!.knowledgeStatus).toBe('confirmed');
    expect(entries[0]!.credibility).toBe(1.0);
  });

  test('scene_changed adds knowledge entry with source exploration and status confirmed', async () => {
    const { initKnowledgeTracker } = await import('./knowledge-tracker');
    cleanup = initKnowledgeTracker(stores, eventBus);

    gameStore.setState(draft => { draft.turnCount = 15; });
    eventBus.emit('scene_changed', { sceneId: 'loc_market', previousSceneId: null });

    const entries = Object.values(playerKnowledgeStore.getState().entries);
    expect(entries.length).toBe(1);
    expect(entries[0]!.source).toBe('exploration');
    expect(entries[0]!.knowledgeStatus).toBe('confirmed');
    expect(entries[0]!.codexEntryId).toBe('loc_market');
  });

  test('addKnowledge does not overwrite entry with lower-ranked status', async () => {
    const { addKnowledge, initKnowledgeTracker } = await import('./knowledge-tracker');
    cleanup = initKnowledgeTracker(stores, eventBus);

    gameStore.setState(draft => { draft.turnCount = 5; });

    addKnowledge(stores, {
      codexEntryId: 'fact_01',
      source: 'quest_completion',
      knowledgeStatus: 'confirmed',
      description: 'Confirmed fact',
      credibility: 1.0,
    });

    addKnowledge(stores, {
      codexEntryId: 'fact_01',
      source: 'dialogue',
      knowledgeStatus: 'heard',
      description: 'Heard version',
      credibility: 0.5,
    });

    const entries = Object.values(playerKnowledgeStore.getState().entries);
    expect(entries.length).toBe(1);
    expect(entries[0]!.knowledgeStatus).toBe('confirmed');
    expect(entries[0]!.credibility).toBe(1.0);
  });

  test('contradicted status overrides any existing status', async () => {
    const { addKnowledge, initKnowledgeTracker } = await import('./knowledge-tracker');
    cleanup = initKnowledgeTracker(stores, eventBus);

    gameStore.setState(draft => { draft.turnCount = 5; });

    addKnowledge(stores, {
      codexEntryId: 'fact_02',
      source: 'quest_completion',
      knowledgeStatus: 'confirmed',
      description: 'Original fact',
      credibility: 1.0,
    });

    addKnowledge(stores, {
      codexEntryId: 'fact_02',
      source: 'discovery',
      knowledgeStatus: 'contradicted',
      description: 'Contradicted by evidence',
      credibility: 0.9,
    });

    const entries = Object.values(playerKnowledgeStore.getState().entries);
    expect(entries.length).toBe(1);
    expect(entries[0]!.knowledgeStatus).toBe('contradicted');
  });

  test('knowledge entry has correct turnNumber, credibility, and codexEntryId', async () => {
    const { addKnowledge, initKnowledgeTracker } = await import('./knowledge-tracker');
    cleanup = initKnowledgeTracker(stores, eventBus);

    gameStore.setState(draft => { draft.turnCount = 33; });

    addKnowledge(stores, {
      codexEntryId: 'codex_dragon',
      source: 'exploration',
      knowledgeStatus: 'suspected',
      description: 'Dragon sighting',
      credibility: 0.7,
      relatedQuestId: 'quest_dragon',
    });

    const entries = Object.values(playerKnowledgeStore.getState().entries);
    expect(entries.length).toBe(1);
    expect(entries[0]!.turnNumber).toBe(33);
    expect(entries[0]!.credibility).toBe(0.7);
    expect(entries[0]!.codexEntryId).toBe('codex_dragon');
    expect(entries[0]!.relatedQuestId).toBe('quest_dragon');
  });

  test('entries without codexEntryId do not deduplicate by codex', async () => {
    const { addKnowledge, initKnowledgeTracker } = await import('./knowledge-tracker');
    cleanup = initKnowledgeTracker(stores, eventBus);

    gameStore.setState(draft => { draft.turnCount = 5; });

    addKnowledge(stores, {
      codexEntryId: null,
      source: 'quest_progress',
      knowledgeStatus: 'suspected',
      description: 'Quest progress 1',
      credibility: 0.8,
      relatedQuestId: 'quest_01',
    });

    addKnowledge(stores, {
      codexEntryId: null,
      source: 'quest_progress',
      knowledgeStatus: 'suspected',
      description: 'Quest progress 2',
      credibility: 0.8,
      relatedQuestId: 'quest_01',
    });

    const entries = Object.values(playerKnowledgeStore.getState().entries);
    expect(entries.length).toBe(2);
  });
});
