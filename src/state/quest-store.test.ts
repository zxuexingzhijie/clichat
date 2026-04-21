import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { eventBus } from '../events/event-bus';
import {
  questStore,
  questEventLog,
  appendQuestEvent,
  resetQuestEventLog,
  QuestStateSchema,
  QuestEventSchema,
  QuestProgressSchema,
  getDefaultQuestState,
} from './quest-store';

describe('QuestProgressSchema', () => {
  test('validates a correct QuestProgress object', () => {
    const progress = {
      status: 'active',
      currentStageId: 'stage_01',
      completedObjectives: ['obj_01'],
      discoveredClues: ['clue_01'],
      flags: { found_key: true },
      acceptedAt: 5,
      completedAt: null,
    };
    const parsed = QuestProgressSchema.parse(progress);
    expect(parsed.status).toBe('active');
    expect(parsed.currentStageId).toBe('stage_01');
    expect(parsed.completedObjectives).toHaveLength(1);
    expect(parsed.flags['found_key']).toBe(true);
    expect(parsed.completedAt).toBeNull();
  });

  test('validates all status enum values', () => {
    for (const status of ['unknown', 'active', 'completed', 'failed'] as const) {
      const progress = {
        status,
        currentStageId: null,
        completedObjectives: [],
        discoveredClues: [],
        flags: {},
        acceptedAt: null,
        completedAt: null,
      };
      const parsed = QuestProgressSchema.parse(progress);
      expect(parsed.status).toBe(status);
    }
  });

  test('rejects invalid status', () => {
    expect(() => QuestProgressSchema.parse({
      status: 'invalid',
      currentStageId: null,
      completedObjectives: [],
      discoveredClues: [],
      flags: {},
      acceptedAt: null,
      completedAt: null,
    })).toThrow();
  });
});

describe('QuestStateSchema', () => {
  test('validates a quests record', () => {
    const state = {
      quests: {
        q1: {
          status: 'active',
          currentStageId: null,
          completedObjectives: [],
          discoveredClues: [],
          flags: {},
          acceptedAt: 1,
          completedAt: null,
        },
      },
    };
    const parsed = QuestStateSchema.parse(state);
    expect(parsed.quests['q1']?.status).toBe('active');
  });

  test('validates empty quests record', () => {
    const parsed = QuestStateSchema.parse({ quests: {} });
    expect(parsed.quests).toEqual({});
  });
});

describe('QuestEventSchema', () => {
  test('validates a correct QuestEvent', () => {
    const event = {
      id: 'evt_abc123',
      questId: 'q1',
      type: 'quest_started',
      turnNumber: 5,
      timestamp: '2026-04-21T10:00:00.000Z',
    };
    const parsed = QuestEventSchema.parse(event);
    expect(parsed.id).toBe('evt_abc123');
    expect(parsed.type).toBe('quest_started');
  });

  test('validates all type enum values', () => {
    for (const type of ['quest_started', 'objective_completed', 'clue_discovered', 'stage_advanced', 'quest_completed', 'quest_failed'] as const) {
      const event = {
        id: 'evt_001',
        questId: 'q1',
        type,
        turnNumber: 1,
        timestamp: '2026-04-21T10:00:00.000Z',
      };
      const parsed = QuestEventSchema.parse(event);
      expect(parsed.type).toBe(type);
    }
  });

  test('allows optional details field', () => {
    const event = {
      id: 'evt_001',
      questId: 'q1',
      type: 'quest_started',
      turnNumber: 1,
      timestamp: '2026-04-21T10:00:00.000Z',
      details: { source: 'npc_01' },
    };
    const parsed = QuestEventSchema.parse(event);
    expect(parsed.details?.['source']).toBe('npc_01');
  });
});

describe('questStore', () => {
  beforeEach(() => {
    questStore.setState(() => getDefaultQuestState());
    resetQuestEventLog();
  });

  test('getState() returns empty quests record by default', () => {
    const state = questStore.getState();
    expect(state.quests).toEqual({});
  });

  test('default state validates against QuestStateSchema', () => {
    const state = getDefaultQuestState();
    const parsed = QuestStateSchema.parse(state);
    expect(parsed.quests).toEqual({});
  });

  test('emits quest_started when quest status transitions to active', () => {
    const handler = mock(() => {});
    eventBus.on('quest_started', handler);

    questStore.setState(draft => {
      draft.quests['q1'] = {
        status: 'active',
        currentStageId: null,
        completedObjectives: [],
        discoveredClues: [],
        flags: {},
        acceptedAt: 1,
        completedAt: null,
      };
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const call = handler.mock.calls[0][0] as { questId: string; questTitle: string; turnNumber: number };
    expect(call.questId).toBe('q1');

    eventBus.off('quest_started', handler);
  });

  test('emits quest_completed when status transitions from active to completed', () => {
    questStore.setState(draft => {
      draft.quests['q1'] = {
        status: 'active',
        currentStageId: null,
        completedObjectives: [],
        discoveredClues: [],
        flags: {},
        acceptedAt: 1,
        completedAt: null,
      };
    });

    const handler = mock(() => {});
    eventBus.on('quest_completed', handler);

    questStore.setState(draft => {
      draft.quests['q1']!.status = 'completed';
      draft.quests['q1']!.completedAt = 10;
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const call = handler.mock.calls[0][0] as { questId: string; rewards: unknown };
    expect(call.questId).toBe('q1');

    eventBus.off('quest_completed', handler);
  });

  test('emits quest_failed when status transitions from active to failed', () => {
    questStore.setState(draft => {
      draft.quests['q1'] = {
        status: 'active',
        currentStageId: null,
        completedObjectives: [],
        discoveredClues: [],
        flags: {},
        acceptedAt: 1,
        completedAt: null,
      };
    });

    const handler = mock(() => {});
    eventBus.on('quest_failed', handler);

    questStore.setState(draft => {
      draft.quests['q1']!.status = 'failed';
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const call = handler.mock.calls[0][0] as { questId: string; reason: string };
    expect(call.questId).toBe('q1');

    eventBus.off('quest_failed', handler);
  });

  test('does not emit quest_started when already active', () => {
    questStore.setState(draft => {
      draft.quests['q1'] = {
        status: 'active',
        currentStageId: null,
        completedObjectives: [],
        discoveredClues: [],
        flags: {},
        acceptedAt: 1,
        completedAt: null,
      };
    });

    const handler = mock(() => {});
    eventBus.on('quest_started', handler);

    questStore.setState(draft => {
      draft.quests['q1']!.currentStageId = 'stage_02';
    });

    expect(handler).not.toHaveBeenCalled();
    eventBus.off('quest_started', handler);
  });
});

describe('questEventLog', () => {
  beforeEach(() => {
    resetQuestEventLog();
  });

  test('questEventLog starts as an empty array', () => {
    expect(questEventLog).toHaveLength(0);
  });

  test('appendQuestEvent pushes a QuestEvent with nanoid id to questEventLog', () => {
    appendQuestEvent({
      questId: 'q1',
      type: 'quest_started',
      turnNumber: 5,
    });

    expect(questEventLog).toHaveLength(1);
    expect(questEventLog[0].questId).toBe('q1');
    expect(questEventLog[0].type).toBe('quest_started');
    expect(questEventLog[0].id).toBeTruthy();
    expect(questEventLog[0].timestamp).toBeTruthy();
  });

  test('appendQuestEvent creates new array (immutable spread)', () => {
    const before = questEventLog;

    appendQuestEvent({
      questId: 'q1',
      type: 'quest_started',
      turnNumber: 1,
    });

    expect(questEventLog).not.toBe(before);
  });

  test('multiple appendQuestEvent calls accumulate events', () => {
    appendQuestEvent({ questId: 'q1', type: 'quest_started', turnNumber: 1 });
    appendQuestEvent({ questId: 'q1', type: 'stage_advanced', turnNumber: 3 });
    appendQuestEvent({ questId: 'q1', type: 'quest_completed', turnNumber: 7 });

    expect(questEventLog).toHaveLength(3);
    expect(questEventLog[0].type).toBe('quest_started');
    expect(questEventLog[1].type).toBe('stage_advanced');
    expect(questEventLog[2].type).toBe('quest_completed');
  });

  test('resetQuestEventLog clears the log', () => {
    appendQuestEvent({ questId: 'q1', type: 'quest_started', turnNumber: 1 });
    expect(questEventLog).toHaveLength(1);

    resetQuestEventLog();
    expect(questEventLog).toHaveLength(0);
  });

  test('each event gets a unique id', () => {
    appendQuestEvent({ questId: 'q1', type: 'quest_started', turnNumber: 1 });
    appendQuestEvent({ questId: 'q2', type: 'quest_started', turnNumber: 2 });

    expect(questEventLog[0].id).not.toBe(questEventLog[1].id);
  });
});

describe('Exports', () => {
  test('QuestStateSchema is exported', () => {
    expect(QuestStateSchema).toBeDefined();
    expect(typeof QuestStateSchema.parse).toBe('function');
  });

  test('QuestEventSchema is exported', () => {
    expect(QuestEventSchema).toBeDefined();
    expect(typeof QuestEventSchema.parse).toBe('function');
  });

  test('QuestProgressSchema is exported', () => {
    expect(QuestProgressSchema).toBeDefined();
    expect(typeof QuestProgressSchema.parse).toBe('function');
  });

  test('getDefaultQuestState is exported', () => {
    expect(getDefaultQuestState).toBeDefined();
    const state = getDefaultQuestState();
    expect(state.quests).toEqual({});
  });
});
