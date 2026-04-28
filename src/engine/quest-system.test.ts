import { describe, it, expect, beforeEach } from 'bun:test';
import mitt from 'mitt';
import { questStore, resetQuestEventLog, getDefaultQuestState } from '../state/quest-store';
import { relationStore } from '../state/relation-store';
import { gameStore } from '../state/game-store';
import type { DomainEvents } from '../events/event-types';

const stores = { quest: questStore, relation: relationStore, game: gameStore };

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
    const questSystem = createQuestSystem(stores, mockCodexEntries as any);

    const result = questSystem.acceptQuest('quest_side_missing_ore');

    expect(result.status).toBe('ok');
    expect(questStore.getState().quests['quest_side_missing_ore']?.status).toBe('active');
  });

  it('acceptQuest returns { status: gated, reason: 声望不足 } when reputation below threshold', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const questSystem = createQuestSystem(stores, mockCodexEntries as any);

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
    const questSystem = createQuestSystem(stores, mockCodexEntries as any);

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
    const questSystem = createQuestSystem(stores, mockCodexEntries as any);

    const result = questSystem.acceptQuest('quest_unknown_id');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toBe('找不到任务: quest_unknown_id');
    }
  });

  it('completeObjective adds objectiveId to completedObjectives', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const questSystem = createQuestSystem(stores, mockCodexEntries as any);

    questSystem.acceptQuest('quest_main_01');
    questSystem.completeObjective('quest_main_01', 'obj_01');

    expect(questStore.getState().quests['quest_main_01']?.completedObjectives).toContain('obj_01');
  });

  it('advanceStage sets currentStageId', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const questSystem = createQuestSystem(stores, mockCodexEntries as any);

    questSystem.acceptQuest('quest_main_01');
    questSystem.advanceStage('quest_main_01', 'stage_02');

    expect(questStore.getState().quests['quest_main_01']?.currentStageId).toBe('stage_02');
  });

  it('failQuest sets status to failed', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const questSystem = createQuestSystem(stores, mockCodexEntries as any);

    questSystem.acceptQuest('quest_main_01');
    questSystem.failQuest('quest_main_01');

    expect(questStore.getState().quests['quest_main_01']?.status).toBe('failed');
  });

  it('completeQuest sets status to completed and records completedAt', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const questSystem = createQuestSystem(stores, mockCodexEntries as any);

    questSystem.acceptQuest('quest_main_01');
    questSystem.completeQuest('quest_main_01');

    const progress = questStore.getState().quests['quest_main_01'];
    expect(progress?.status).toBe('completed');
    expect(progress?.completedAt).not.toBeNull();
  });

  it('completeQuest applies reputation_delta to factionReputations', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const mockQuestWithRewards = {
      ...mockQuestMain,
      id: 'quest_with_rewards',
      rewards: { reputation_delta: { faction_guard: 20 } },
    };
    const entries = new Map<string, any>([
      ...mockCodexEntries,
      ['quest_with_rewards', mockQuestWithRewards],
    ]);
    const questSystem = createQuestSystem(stores, entries as any);

    questSystem.acceptQuest('quest_with_rewards');
    questSystem.completeQuest('quest_with_rewards');

    expect(relationStore.getState().factionReputations['faction_guard']).toBe(20);
  });
});

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

const mockQuestWithDialogueTrigger = {
  id: 'quest_dialogue_trigger',
  type: 'quest' as const,
  name: '对话触发任务',
  tags: ['side'],
  description: '需要与NPC对话',
  epistemic,
  quest_type: 'side' as const,
  stages: [
    {
      id: 'stage_01',
      description: '与旅馆老板对话',
      objectives: [],
      nextStageId: 'stage_02',
      trigger: { event: 'dialogue_ended' as const, targetId: 'npc_innkeeper' },
    },
    {
      id: 'stage_02',
      description: '任务完成',
      objectives: [],
      nextStageId: null,
    },
  ],
  rewards: {},
};

const mockQuestWithSceneTrigger = {
  id: 'quest_scene_trigger',
  type: 'quest' as const,
  name: '地点触发任务',
  tags: ['side'],
  description: '需要前往特定地点',
  epistemic,
  quest_type: 'side' as const,
  stages: [
    {
      id: 'stage_01',
      description: '前往古老神殿',
      objectives: [],
      nextStageId: 'stage_02',
      trigger: { event: 'location_entered' as const, targetId: 'loc_ancient_temple' },
    },
    {
      id: 'stage_02',
      description: '任务完成',
      objectives: [],
      nextStageId: null,
    },
  ],
  rewards: {},
};

const mockQuestWithItemTrigger = {
  id: 'quest_item_trigger',
  type: 'quest' as const,
  name: '道具触发任务',
  tags: ['side'],
  description: '需要获得特定道具',
  epistemic,
  quest_type: 'side' as const,
  stages: [
    {
      id: 'stage_01',
      description: '找到神秘药水',
      objectives: [],
      nextStageId: null,
      trigger: { event: 'item_found' as const, targetId: 'item_mystic_potion' },
    },
  ],
  rewards: {},
};

const mockQuestWithCombatTrigger = {
  id: 'quest_combat_trigger',
  type: 'quest' as const,
  name: '战斗触发任务',
  tags: ['side'],
  description: '需要战胜敌人',
  epistemic,
  quest_type: 'side' as const,
  stages: [
    {
      id: 'stage_01',
      description: '击败强盗',
      objectives: [],
      nextStageId: null,
      trigger: { event: 'combat_ended' as const },
    },
  ],
  rewards: {},
};

const mockQuestWithMultiCondition = {
  id: 'quest_multi_condition',
  type: 'quest' as const,
  name: '双条件任务',
  tags: ['main'],
  description: '需要同时满足两个条件',
  epistemic,
  quest_type: 'main' as const,
  stages: [
    {
      id: 'stage_01',
      description: '与NPC对话并前往地点',
      objectives: [],
      nextStageId: 'stage_02',
      trigger: {
        event: 'dialogue_ended' as const,
        targetId: 'npc_elder',
        secondaryEvent: 'location_entered' as const,
        secondaryTargetId: 'loc_village_center',
      },
    },
    {
      id: 'stage_02',
      description: '任务完成',
      objectives: [],
      nextStageId: null,
    },
  ],
  rewards: {},
};

const mockQuestWithTargetIdDialogue = {
  id: 'quest_targeted_dialogue',
  type: 'quest' as const,
  name: '指定NPC对话任务',
  tags: ['side'],
  description: '必须与特定NPC对话',
  epistemic,
  quest_type: 'side' as const,
  stages: [
    {
      id: 'stage_01',
      description: '与铁匠对话',
      objectives: [],
      nextStageId: 'stage_02',
      trigger: { event: 'dialogue_ended' as const, targetId: 'npc_blacksmith' },
    },
    {
      id: 'stage_02',
      description: '完成',
      objectives: [],
      nextStageId: null,
    },
  ],
  rewards: {},
};

describe('createQuestSystem — event-based advancement', () => {
  beforeEach(resetStores);

  it('emitting dialogue_ended advances quest with matching dialogue_ended trigger', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const bus = mitt<DomainEvents>();
    const entries = new Map<string, any>([['quest_dialogue_trigger', mockQuestWithDialogueTrigger]]);
    const questSystem = createQuestSystem(stores, entries, bus);

    questSystem.acceptQuest('quest_dialogue_trigger');
    expect(questStore.getState().quests['quest_dialogue_trigger']?.currentStageId).toBe('stage_01');

    bus.emit('dialogue_ended', { npcId: 'npc_innkeeper' });

    expect(questStore.getState().quests['quest_dialogue_trigger']?.currentStageId).toBe('stage_02');
  });

  it('emitting scene_changed with matching sceneId advances location_entered trigger', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const bus = mitt<DomainEvents>();
    const entries = new Map<string, any>([['quest_scene_trigger', mockQuestWithSceneTrigger]]);
    const questSystem = createQuestSystem(stores, entries, bus);

    questSystem.acceptQuest('quest_scene_trigger');
    expect(questStore.getState().quests['quest_scene_trigger']?.currentStageId).toBe('stage_01');

    bus.emit('scene_changed', { sceneId: 'loc_ancient_temple', previousSceneId: null });

    expect(questStore.getState().quests['quest_scene_trigger']?.currentStageId).toBe('stage_02');
  });

  it('emitting item_acquired advances item_found trigger', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const bus = mitt<DomainEvents>();
    const entries = new Map<string, any>([['quest_item_trigger', mockQuestWithItemTrigger]]);
    const questSystem = createQuestSystem(stores, entries, bus);

    questSystem.acceptQuest('quest_item_trigger');
    expect(questStore.getState().quests['quest_item_trigger']?.currentStageId).toBe('stage_01');

    bus.emit('item_acquired', { itemId: 'item_mystic_potion', itemName: '神秘药水', quantity: 1 });

    expect(questStore.getState().quests['quest_item_trigger']?.status).toBe('completed');
  });

  it('emitting combat_ended with victory advances combat_ended trigger', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const bus = mitt<DomainEvents>();
    const entries = new Map<string, any>([['quest_combat_trigger', mockQuestWithCombatTrigger]]);
    const questSystem = createQuestSystem(stores, entries, bus);

    questSystem.acceptQuest('quest_combat_trigger');
    bus.emit('combat_ended', { outcome: 'victory' });

    expect(questStore.getState().quests['quest_combat_trigger']?.status).toBe('completed');
  });

  it('multi-condition stage requires both primary and secondary before advancing', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const bus = mitt<DomainEvents>();
    const entries = new Map<string, any>([['quest_multi_condition', mockQuestWithMultiCondition]]);
    const questSystem = createQuestSystem(stores, entries, bus);

    questSystem.acceptQuest('quest_multi_condition');
    expect(questStore.getState().quests['quest_multi_condition']?.currentStageId).toBe('stage_01');

    bus.emit('dialogue_ended', { npcId: 'npc_elder' });
    expect(questStore.getState().quests['quest_multi_condition']?.currentStageId).toBe('stage_01');

    bus.emit('scene_changed', { sceneId: 'loc_village_center', previousSceneId: null });
    expect(questStore.getState().quests['quest_multi_condition']?.currentStageId).toBe('stage_02');
  });

  it('dialogue_ended without matching targetId does NOT advance a stage with targetId set', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const bus = mitt<DomainEvents>();
    const entries = new Map<string, any>([['quest_targeted_dialogue', mockQuestWithTargetIdDialogue]]);
    const questSystem = createQuestSystem(stores, entries, bus);

    questSystem.acceptQuest('quest_targeted_dialogue');
    bus.emit('dialogue_ended', { npcId: 'npc_farmer' });

    expect(questStore.getState().quests['quest_targeted_dialogue']?.currentStageId).toBe('stage_01');
  });

  it('auto_accept quest is accepted automatically on dialogue_ended', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const bus = mitt<DomainEvents>();
    const autoQuest = {
      ...mockQuestWithDialogueTrigger,
      id: 'quest_auto_accept',
      auto_accept: true,
    };
    const entries = new Map<string, any>([['quest_auto_accept', autoQuest]]);
    createQuestSystem(stores, entries, bus);

    expect(questStore.getState().quests['quest_auto_accept']).toBeUndefined();
    bus.emit('dialogue_ended', { npcId: 'npc_innkeeper' });
    expect(questStore.getState().quests['quest_auto_accept']?.status).toBe('active');
  });

  it('auto_accept quest is NOT re-accepted if already active', async () => {
    const { createQuestSystem } = await import('./quest-system');
    const bus = mitt<DomainEvents>();
    const autoQuest = {
      ...mockQuestWithDialogueTrigger,
      id: 'quest_auto_accept_2',
      auto_accept: true,
    };
    const entries = new Map<string, any>([['quest_auto_accept_2', autoQuest]]);
    const questSystem = createQuestSystem(stores, entries, bus);

    questSystem.acceptQuest('quest_auto_accept_2');
    const acceptedAt = questStore.getState().quests['quest_auto_accept_2']?.acceptedAt;
    bus.emit('dialogue_ended', { npcId: 'npc_innkeeper' });
    expect(questStore.getState().quests['quest_auto_accept_2']?.acceptedAt).toBe(acceptedAt);
  });
});
