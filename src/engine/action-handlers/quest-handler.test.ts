import { describe, it, expect, mock } from 'bun:test';
import { handleQuest } from './quest-handler';
import type { ActionContext } from './types';
import type { QuestSystem } from '../quest-system';
import { createStore } from '../../state/create-store';
import { getDefaultQuestState } from '../../state/quest-store';
import type { QuestState } from '../../state/quest-store';
import type { GameAction } from '../../types/game-action';
import type { CodexEntry } from '../../codex/schemas/entry-types';

const epistemic = {
  authority: 'canonical_truth' as const,
  truth_status: 'true' as const,
  scope: 'local' as const,
  visibility: 'public' as const,
  confidence: 1.0,
  source_type: 'authorial' as const,
  known_by: [],
  contradicts: [],
  volatility: 'stable' as const,
};

const mockQuestTemplate = {
  id: 'quest_test_01',
  type: 'quest' as const,
  name: '测试任务',
  tags: ['side'],
  description: '用于测试的任务',
  epistemic,
  quest_type: 'side' as const,
  stages: [
    {
      id: 'stage_01',
      description: '找到目标',
      objectives: [],
      nextStageId: null,
    },
  ],
  rewards: {},
};

function makeQuestStore(overrides: Partial<QuestState> = {}) {
  return createStore<QuestState>({ ...getDefaultQuestState(), ...overrides });
}

function makeQuestSystem(overrides: Partial<QuestSystem> = {}): QuestSystem {
  return {
    acceptQuest: mock(() => ({ status: 'ok' as const })),
    completeObjective: mock(() => {}),
    advanceStage: mock(() => {}),
    failQuest: mock(() => {}),
    completeQuest: mock(() => {}),
    ...overrides,
  };
}

function makeCtx(
  questSystem: QuestSystem | undefined,
  questStore: ReturnType<typeof makeQuestStore>,
  codexEntries?: Map<string, CodexEntry>,
): ActionContext {
  return {
    stores: {
      game: { getState: () => ({ turnCount: 0 } as any), setState: mock(() => {}), subscribe: mock(() => () => {}) },
      player: { getState: () => ({} as any), setState: mock(() => {}), subscribe: mock(() => () => {}) },
      scene: { getState: () => ({} as any), setState: mock(() => {}), subscribe: mock(() => () => {}) },
      combat: { getState: () => ({} as any), setState: mock(() => {}), subscribe: mock(() => () => {}) },
    } as any,
    eventBus: { on: mock(() => {}), off: mock(() => {}), emit: mock(() => {}) } as any,
    questSystem,
    questStore,
    codexEntries,
  };
}

const questAction = (target: string): GameAction => ({
  type: 'quest',
  target,
  modifiers: {},
  source: 'command',
});

describe('handleQuest — status subcommand', () => {
  it('returns 当前没有进行中的任务 when no active quests', async () => {
    const questStore = makeQuestStore();
    const ctx = makeCtx(makeQuestSystem(), questStore, new Map());

    const result = await handleQuest(questAction('status'), ctx);

    expect(result.status).toBe('action_executed');
    if (result.status === 'action_executed') {
      expect(result.narration).toEqual(['当前没有进行中的任务。']);
    }
  });

  it('returns quest name and stage description for active quest', async () => {
    const questStore = makeQuestStore({
      quests: {
        quest_test_01: {
          status: 'active',
          currentStageId: 'stage_01',
          completedObjectives: [],
          discoveredClues: [],
          flags: {},
          acceptedAt: 1,
          completedAt: null,
        },
      },
    });
    const codexEntries = new Map<string, CodexEntry>([
      ['quest_test_01', mockQuestTemplate as any],
    ]);
    const ctx = makeCtx(makeQuestSystem(), questStore, codexEntries);

    const result = await handleQuest(questAction('status'), ctx);

    expect(result.status).toBe('action_executed');
    if (result.status === 'action_executed') {
      const narration = result.narration.join('\n');
      expect(narration).toContain('测试任务');
      expect(narration).toContain('找到目标');
    }
  });

  it('returns error when questSystem is missing', async () => {
    const questStore = makeQuestStore();
    const ctx = makeCtx(undefined, questStore);

    const result = await handleQuest(questAction('status'), ctx);

    expect(result.status).toBe('error');
  });
});

describe('handleQuest — journal subcommand', () => {
  it('returns 任务日志为空 when no quests', async () => {
    const questStore = makeQuestStore();
    const ctx = makeCtx(makeQuestSystem(), questStore, new Map());

    const result = await handleQuest(questAction('journal'), ctx);

    expect(result.status).toBe('action_executed');
    if (result.status === 'action_executed') {
      expect(result.narration).toEqual(['任务日志为空。']);
    }
  });

  it('shows active and completed quests with correct labels', async () => {
    const questStore = makeQuestStore({
      quests: {
        quest_test_01: {
          status: 'active',
          currentStageId: 'stage_01',
          completedObjectives: [],
          discoveredClues: [],
          flags: {},
          acceptedAt: 1,
          completedAt: null,
        },
        quest_completed_01: {
          status: 'completed',
          currentStageId: null,
          completedObjectives: [],
          discoveredClues: [],
          flags: {},
          acceptedAt: 1,
          completedAt: 5,
        },
      },
    });
    const completedTemplate = {
      ...mockQuestTemplate,
      id: 'quest_completed_01',
      name: '已完成任务',
    };
    const codexEntries = new Map<string, CodexEntry>([
      ['quest_test_01', mockQuestTemplate as any],
      ['quest_completed_01', completedTemplate as any],
    ]);
    const ctx = makeCtx(makeQuestSystem(), questStore, codexEntries);

    const result = await handleQuest(questAction('journal'), ctx);

    expect(result.status).toBe('action_executed');
    if (result.status === 'action_executed') {
      const narration = result.narration.join('\n');
      expect(narration).toContain('测试任务');
      expect(narration).toContain('已完成任务');
      expect(narration).toContain('(已完成)');
      expect(narration).toContain('找到目标');
    }
  });
});
