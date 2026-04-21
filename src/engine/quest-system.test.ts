import { describe, it, expect, beforeEach } from 'bun:test';
import { questStore, resetQuestEventLog, getDefaultQuestState } from '../state/quest-store';
import { relationStore } from '../state/relation-store';

function resetStores() {
  questStore.setState(draft => { Object.assign(draft, getDefaultQuestState()); });
  relationStore.setState(draft => {
    draft.npcDispositions = {};
    draft.factionReputations = {};
  });
  resetQuestEventLog();
}

const mockQuestSideOre = {
  id: 'quest_side_missing_ore',
  type: 'quest' as const,
  name: '失踪的矿石',
  tags: ['side', 'blackpine_town'],
  description: '帮助矿工找回被偷走的矿石',
  epistemic: {
    authority: 'canonical_truth' as const,
    truth_status: 'true' as const,
    scope: 'local' as const,
    visibility: 'public' as const,
    confidence: 1.0,
    source_type: 'authorial' as const,
    known_by: [],
    contradicts: [],
    volatility: 'stable' as const,
  },
  quest_type: 'side' as const,
  region: 'blackpine_town',
  stages: [
    {
      id: 'stage_01',
      description: '找到矿石',
      objectives: [{ id: 'obj_01', type: 'find_item' as const, description: '找到矿石' }],
      nextStageId: null,
    },
  ],
  rewards: { gold: 50 },
};

const mockQuestOverdueDebt = {
  id: 'quest_side_overdue_debt',
  type: 'quest' as const,
  name: '债务清算',
  tags: ['side', 'blackpine_town'],
  description: '帮助商人收债',
  epistemic: {
    authority: 'canonical_truth' as const,
    truth_status: 'true' as const,
    scope: 'local' as const,
    visibility: 'public' as const,
    confidence: 1.0,
    source_type: 'authorial' as const,
    known_by: [],
    contradicts: [],
    volatility: 'stable' as const,
  },
  quest_type: 'side' as const,
  region: 'blackpine_town',
  required_npc_id: 'npc_merchant',
  min_reputation: -20,
  stages: [
    {
      id: 'stage_01',
      description: '找到欠债人',
      objectives: [{ id: 'obj_01', type: 'talk' as const, targetId: 'npc_debtor', description: '与欠债人谈话' }],
      nextStageId: null,
    },
  ],
  rewards: { gold: 100 },
};

const mockQuestMain = {
  id: 'quest_main_01',
  type: 'quest' as const,
  name: '主线任务',
  tags: ['main'],
  description: '主要任务',
  epistemic: {
    authority: 'canonical_truth' as const,
    truth_status: 'true' as const,
    scope: 'local' as const,
    visibility: 'public' as const,
    confidence: 1.0,
    source_type: 'authorial' as const,
    known_by: [],
    contradicts: [],
    volatility: 'stable' as const,
  },
  quest_type: 'main' as const,
  stages: [
    {
      id: 'stage_01',
      description: '开始调查',
      objectives: [{ id: 'obj_01', type: 'visit_location' as const, description: '前往调查' }],
      nextStageId: 'stage_02',
    },
    {
      id: 'stage_02',
      description: '深入调查',
      objectives: [],
      nextStageId: null,
    },
  ],
  rewards: {},
};

const mockCodexEntries = new Map<string, any>([
  ['quest_side_missing_ore', mockQuestSideOre],
  ['quest_side_overdue_debt', mockQuestOverdueDebt],
  ['quest_main_01', mockQuestMain],
]);

describe('createQuestSystem', () => {
  beforeEach(resetStores);

  it('acceptQuest returns { status: ok } and sets quest to active when no gate', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const questSystem = createQuestSystem(mockCodexEntries as any);

    const result = questSystem.acceptQuest('quest_side_missing_ore');

    expect(result.status).toBe('ok');
    expect(questStore.getState().quests['quest_side_missing_ore']?.status).toBe('active');
  });

  it('acceptQuest returns { status: gated, reason: 声望不足 } when reputation below threshold', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const questSystem = createQuestSystem(mockCodexEntries as any);

    relationStore.setState(draft => {
      draft.npcDispositions['npc_merchant'] = {
        value: -50,
        publicReputation: 0,
        personalTrust: 0,
        fear: 0,
        infamy: 0,
        credibility: 0,
      };
    });

    const result = questSystem.acceptQuest('quest_side_overdue_debt');

    expect(result.status).toBe('gated');
    if (result.status === 'gated') {
      expect(result.reason).toBe('声望不足');
    }
  });

  it('acceptQuest returns { status: ok } when reputation meets threshold', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const questSystem = createQuestSystem(mockCodexEntries as any);

    relationStore.setState(draft => {
      draft.npcDispositions['npc_merchant'] = {
        value: 0,
        publicReputation: 0,
        personalTrust: 0,
        fear: 0,
        infamy: 0,
        credibility: 0,
      };
    });

    const result = questSystem.acceptQuest('quest_side_overdue_debt');

    expect(result.status).toBe('ok');
  });

  it('acceptQuest returns { status: error } for unknown quest id', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const questSystem = createQuestSystem(mockCodexEntries as any);

    const result = questSystem.acceptQuest('quest_unknown_id');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toBe('找不到任务: quest_unknown_id');
    }
  });

  it('completeObjective adds objectiveId to completedObjectives', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const questSystem = createQuestSystem(mockCodexEntries as any);

    questSystem.acceptQuest('quest_main_01');
    questSystem.completeObjective('quest_main_01', 'obj_01');

    expect(questStore.getState().quests['quest_main_01']?.completedObjectives).toContain('obj_01');
  });

  it('advanceStage sets currentStageId', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const questSystem = createQuestSystem(mockCodexEntries as any);

    questSystem.acceptQuest('quest_main_01');
    questSystem.advanceStage('quest_main_01', 'stage_02');

    expect(questStore.getState().quests['quest_main_01']?.currentStageId).toBe('stage_02');
  });

  it('failQuest sets status to failed', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const questSystem = createQuestSystem(mockCodexEntries as any);

    questSystem.acceptQuest('quest_main_01');
    questSystem.failQuest('quest_main_01');

    expect(questStore.getState().quests['quest_main_01']?.status).toBe('failed');
  });
});
