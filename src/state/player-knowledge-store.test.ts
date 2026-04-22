import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { eventBus } from '../events/event-bus';
import {
  KnowledgeStatusSchema,
  PlayerKnowledgeEntrySchema,
  PlayerKnowledgeStateSchema,
  playerKnowledgeStore,
  getDefaultPlayerKnowledgeState,
} from './player-knowledge-store';

describe('KnowledgeStatusSchema', () => {
  test('validates all 4 knowledge statuses', () => {
    for (const status of ['heard', 'suspected', 'confirmed', 'contradicted'] as const) {
      const parsed = KnowledgeStatusSchema.parse(status);
      expect(parsed).toBe(status);
    }
  });

  test('rejects invalid status', () => {
    expect(() => KnowledgeStatusSchema.parse('verified')).toThrow();
  });
});

describe('PlayerKnowledgeEntrySchema', () => {
  test('validates a correct PlayerKnowledgeEntry object', () => {
    const entry = {
      id: 'k_01',
      codexEntryId: 'codex_general_x',
      source: 'npc_bartender',
      turnNumber: 12,
      credibility: 0.6,
      knowledgeStatus: 'heard',
      description: '酒馆老板提到X将军可能有隐情',
      relatedQuestId: 'quest_conspiracy',
    };
    const parsed = PlayerKnowledgeEntrySchema.parse(entry);
    expect(parsed.id).toBe('k_01');
    expect(parsed.codexEntryId).toBe('codex_general_x');
    expect(parsed.knowledgeStatus).toBe('heard');
    expect(parsed.credibility).toBe(0.6);
  });

  test('accepts nullable codexEntryId and relatedQuestId', () => {
    const entry = {
      id: 'k_02',
      codexEntryId: null,
      source: 'observation',
      turnNumber: 5,
      credibility: 0.9,
      knowledgeStatus: 'confirmed',
      description: '亲眼所见',
      relatedQuestId: null,
    };
    const parsed = PlayerKnowledgeEntrySchema.parse(entry);
    expect(parsed.codexEntryId).toBeNull();
    expect(parsed.relatedQuestId).toBeNull();
  });

  test('rejects credibility out of range', () => {
    expect(() => PlayerKnowledgeEntrySchema.parse({
      id: 'k_03',
      codexEntryId: null,
      source: 'test',
      turnNumber: 1,
      credibility: 2.0,
      knowledgeStatus: 'heard',
      description: 'test',
      relatedQuestId: null,
    })).toThrow();
  });

  test('rejects negative credibility', () => {
    expect(() => PlayerKnowledgeEntrySchema.parse({
      id: 'k_04',
      codexEntryId: null,
      source: 'test',
      turnNumber: 1,
      credibility: -0.5,
      knowledgeStatus: 'heard',
      description: 'test',
      relatedQuestId: null,
    })).toThrow();
  });
});

describe('PlayerKnowledgeStateSchema', () => {
  test('validates empty entries record', () => {
    const parsed = PlayerKnowledgeStateSchema.parse({ entries: {} });
    expect(parsed.entries).toEqual({});
  });

  test('validates populated entries record', () => {
    const state = {
      entries: {
        k_01: {
          id: 'k_01',
          codexEntryId: null,
          source: 'npc',
          turnNumber: 3,
          credibility: 0.7,
          knowledgeStatus: 'suspected',
          description: '有人怀疑此事',
          relatedQuestId: null,
        },
      },
    };
    const parsed = PlayerKnowledgeStateSchema.parse(state);
    expect(parsed.entries['k_01']?.knowledgeStatus).toBe('suspected');
  });
});

describe('playerKnowledgeStore', () => {
  beforeEach(() => {
    playerKnowledgeStore.setState(() => getDefaultPlayerKnowledgeState());
  });

  test('default state has empty entries', () => {
    const state = playerKnowledgeStore.getState();
    expect(state.entries).toEqual({});
  });

  test('default state validates against PlayerKnowledgeStateSchema', () => {
    const state = getDefaultPlayerKnowledgeState();
    const parsed = PlayerKnowledgeStateSchema.parse(state);
    expect(parsed.entries).toEqual({});
  });

  test('emits knowledge_discovered when a new entry key appears', () => {
    const handler = mock(() => {});
    eventBus.on('knowledge_discovered', handler);

    playerKnowledgeStore.setState(draft => {
      draft.entries['k_01'] = {
        id: 'k_01',
        codexEntryId: 'codex_secret',
        source: 'npc_spy',
        turnNumber: 8,
        credibility: 0.4,
        knowledgeStatus: 'heard',
        description: '间谍透露了一个秘密',
        relatedQuestId: 'quest_intrigue',
      };
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const call = handler.mock.calls[0][0] as { entryId: string; codexEntryId: string | null; knowledgeStatus: string; turnNumber: number };
    expect(call.entryId).toBe('k_01');
    expect(call.codexEntryId).toBe('codex_secret');
    expect(call.knowledgeStatus).toBe('heard');
    expect(call.turnNumber).toBe(8);

    eventBus.off('knowledge_discovered', handler);
  });

  test('does not emit knowledge_discovered when updating existing entry', () => {
    playerKnowledgeStore.setState(draft => {
      draft.entries['k_01'] = {
        id: 'k_01',
        codexEntryId: null,
        source: 'observation',
        turnNumber: 5,
        credibility: 0.5,
        knowledgeStatus: 'heard',
        description: '初步消息',
        relatedQuestId: null,
      };
    });

    const handler = mock(() => {});
    eventBus.on('knowledge_discovered', handler);

    playerKnowledgeStore.setState(draft => {
      draft.entries['k_01']!.knowledgeStatus = 'confirmed';
      draft.entries['k_01']!.credibility = 1.0;
    });

    expect(handler).not.toHaveBeenCalled();
    eventBus.off('knowledge_discovered', handler);
  });

  test('emits knowledge_discovered for each new entry added at once', () => {
    const handler = mock(() => {});
    eventBus.on('knowledge_discovered', handler);

    playerKnowledgeStore.setState(draft => {
      draft.entries['k_01'] = {
        id: 'k_01',
        codexEntryId: null,
        source: 'a',
        turnNumber: 1,
        credibility: 0.5,
        knowledgeStatus: 'heard',
        description: 'first',
        relatedQuestId: null,
      };
      draft.entries['k_02'] = {
        id: 'k_02',
        codexEntryId: null,
        source: 'b',
        turnNumber: 2,
        credibility: 0.6,
        knowledgeStatus: 'suspected',
        description: 'second',
        relatedQuestId: null,
      };
    });

    expect(handler).toHaveBeenCalledTimes(2);

    eventBus.off('knowledge_discovered', handler);
  });
});
