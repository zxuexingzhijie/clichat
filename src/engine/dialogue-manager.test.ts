import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { NpcDialogue } from '../ai/schemas/npc-dialogue';
import type { CheckResult } from '../types/common';

const mockGenerateNpcDialogue = mock((): Promise<NpcDialogue> =>
  Promise.resolve({
    dialogue: '这里最近发生了些事情，你要小心。',
    emotionTag: 'suspicious',
    shouldRemember: false,
    sentiment: 'neutral',
  }),
);

const mockAdjudicate = mock((): CheckResult => ({
  roll: 15,
  attributeName: 'mind',
  attributeModifier: 2,
  skillModifier: 0,
  environmentModifier: 0,
  total: 17,
  dc: 12,
  grade: 'success',
  display: '[D20: 15] + 心智 2 = 17 vs DC 12 -> 成功',
}));

const { createDialogueManager } = await import('./dialogue-manager');

const { dialogueStore, getDefaultDialogueState } = await import('../state/dialogue-store');
const { npcMemoryStore, getDefaultNpcMemoryState } = await import('../state/npc-memory-store');
const { sceneStore } = await import('../state/scene-store');
const { gameStore } = await import('../state/game-store');
const { playerStore } = await import('../state/player-store');
const { relationStore } = await import('../state/relation-store');

const stores = {
  dialogue: dialogueStore,
  npcMemory: npcMemoryStore,
  scene: sceneStore,
  game: gameStore,
  player: playerStore,
  relation: relationStore,
};

const mockCodexEntries = new Map([
  [
    'npc_guard',
    {
      id: 'npc_guard',
      name: '北门守卫',
      type: 'npc' as const,
      tags: ['guard', '黑松镇'],
      description: '黑松镇北门的守卫',
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
      location_id: 'loc_north_gate',
      personality_tags: ['dutiful', 'cautious'],
      goals: ['protect_gate', 'report_suspicious_activity'],
      backstory: '守卫队成员',
      initial_disposition: 0.0,
    },
  ],
  [
    'npc_captain',
    {
      id: 'npc_captain',
      name: '守卫队长·陈铁柱',
      type: 'npc' as const,
      tags: ['military', '黑松镇'],
      description: '守卫队长',
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
      location_id: 'loc_guard_post',
      personality_tags: ['stern', 'dutiful'],
      goals: ['protect_town', 'investigate_disappearances'],
      backstory: '守卫队长，有任务调查失踪事件',
      initial_disposition: 0.0,
    },
  ],
  [
    'npc_bartender',
    {
      id: 'npc_bartender',
      name: '酒馆老板·老陈',
      type: 'npc' as const,
      tags: ['merchant', 'information_broker'],
      description: '酒馆老板',
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
      location_id: 'loc_tavern',
      personality_tags: ['friendly', 'gossipy'],
      goals: ['run_business', 'collect_information'],
      backstory: '酒馆老板',
      initial_disposition: 0.3,
    },
  ],
  [
    'npc_faction_guard',
    {
      id: 'npc_faction_guard',
      name: '派系守卫',
      type: 'npc' as const,
      tags: ['guard'],
      description: '隶属守卫派系的士兵',
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
      location_id: 'loc_north_gate',
      personality_tags: ['dutiful'],
      goals: ['protect_gate'],
      backstory: '派系士兵',
      initial_disposition: 0.0,
      faction: 'faction_guard',
    },
  ],
  [
    'npc_quest_chinese',
    {
      id: 'npc_quest_chinese',
      name: '任务NPC',
      type: 'npc' as const,
      tags: ['merchant'],
      description: '有中文任务目标的NPC',
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
      location_id: 'loc_tavern',
      personality_tags: ['friendly'],
      goals: ['调查失踪事件'],
      backstory: '商人',
      initial_disposition: 0.0,
    },
  ],
  [
    'npc_innkeeper',
    {
      id: 'npc_innkeeper',
      name: '客栈老板',
      type: 'npc' as const,
      tags: ['innkeeper'],
      description: '客栈老板娘',
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
      location_id: 'loc_inn',
      personality_tags: ['friendly'],
      goals: ['run_inn'],
      backstory: '经营客栈多年',
      initial_disposition: 0.1,
    },
  ],
  [
    'npc_hunter',
    {
      id: 'npc_hunter',
      name: '猎人',
      type: 'npc' as const,
      tags: ['hunter'],
      description: '经验丰富的猎人',
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
      location_id: 'loc_forest',
      personality_tags: ['cautious'],
      goals: ['hunt_monsters'],
      backstory: '在森林里打猎',
      initial_disposition: 0.0,
    },
  ],
  [
    'npc_soldier',
    {
      id: 'npc_soldier',
      name: '士兵',
      type: 'npc' as const,
      tags: ['military', 'guard'],
      description: '驻扎在此的士兵',
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
      location_id: 'loc_barracks',
      personality_tags: ['dutiful'],
      goals: ['defend_town'],
      backstory: '军队士兵',
      initial_disposition: 0.0,
    },
  ],
  [
    'npc_priest',
    {
      id: 'npc_priest',
      name: '神父',
      type: 'npc' as const,
      tags: ['clergy'],
      description: '神殿的神职人员',
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
      location_id: 'loc_temple',
      personality_tags: ['honest'],
      goals: ['serve_gods'],
      backstory: '侍奉神明',
      initial_disposition: 0.1,
    },
  ],
  [
    'npc_beggar',
    {
      id: 'npc_beggar',
      name: '乞丐',
      type: 'npc' as const,
      tags: ['beggar'],
      description: '街头乞丐',
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
      location_id: 'loc_market',
      personality_tags: ['cautious'],
      goals: ['survive'],
      backstory: '流落街头',
      initial_disposition: 0.0,
    },
  ],
  [
    'npc_criminal',
    {
      id: 'npc_criminal',
      name: '黑市商人',
      type: 'npc' as const,
      tags: ['underworld'],
      description: '黑市中的神秘人物',
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
      location_id: 'loc_underworld',
      personality_tags: ['shrewd'],
      goals: ['profit'],
      backstory: '黑市经营者',
      initial_disposition: -0.1,
    },
  ],
]);

describe('createDialogueManager', () => {
  beforeEach(() => {
    mockGenerateNpcDialogue.mockReset();
    mockAdjudicate.mockReset();
    mockGenerateNpcDialogue.mockResolvedValue({
      dialogue: '这里最近发生了些事情，你要小心。',
      emotionTag: 'suspicious',
      shouldRemember: false,
      sentiment: 'neutral',
    });
    mockAdjudicate.mockReturnValue({
      roll: 15,
      attributeName: 'mind',
      attributeModifier: 2,
      skillModifier: 0,
      environmentModifier: 0,
      total: 17,
      dc: 12,
      grade: 'success',
      display: '[D20: 15] + 心智 2 = 17 vs DC 12 -> 成功',
    });
  });

  it('startDialogue with quest-NPC enters full mode', async () => {
    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    const result = await manager.startDialogue('npc_captain');

    expect(result.mode).toBe('full');
    expect(result.npcName).toBe('守卫队长·陈铁柱');
    expect(result.dialogue).toBeTruthy();
  });

  it('startDialogue with simple NPC (no quest goals, neutral disposition) enters inline mode', async () => {
    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    const result = await manager.startDialogue('npc_guard');

    expect(result.mode).toBe('inline');
    expect(result.npcName).toBe('北门守卫');
  });

  it('processPlayerResponse generates follow-up dialogue', async () => {
    mockGenerateNpcDialogue
      .mockResolvedValueOnce({
        dialogue: '最近的确不太平。',
        emotionTag: 'neutral',
        shouldRemember: false,
        sentiment: 'neutral',
      })
      .mockResolvedValueOnce({
        dialogue: '你有什么线索吗？',
        emotionTag: 'happy',
        shouldRemember: false,
        sentiment: 'positive',
      });

    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_captain');
    const result = await manager.processPlayerResponse(0);

    expect(result).not.toBeNull();
    expect(mockGenerateNpcDialogue).toHaveBeenCalledTimes(2);
  });

  it('check option success reveals emotion hint', async () => {
    mockGenerateNpcDialogue.mockResolvedValue({
      dialogue: '什么事也没有。',
      emotionTag: 'suspicious',
      shouldRemember: false,
      sentiment: 'neutral',
    });

    mockAdjudicate.mockReturnValue({
      roll: 18,
      attributeName: 'mind',
      attributeModifier: 2,
      skillModifier: 0,
      environmentModifier: 0,
      total: 20,
      dc: 12,
      grade: 'success',
      display: '[D20: 18] + 心智 2 = 20 vs DC 12 -> 成功',
    });

    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_captain');

    const { dialogueStore } = await import('../state/dialogue-store');
    const stateAfterStart = dialogueStore.getState();
    const checkOptionIndex = stateAfterStart.availableResponses.findIndex(
      (r) => r.requiresCheck,
    );

    if (checkOptionIndex >= 0) {
      await manager.processPlayerResponse(checkOptionIndex);
      const state = dialogueStore.getState();
      expect(state.emotionHint).not.toBeNull();
    } else {
      expect(stateAfterStart.mode).toBe('inline');
    }
  });

  it('endDialogue clears dialogue store', async () => {
    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_captain');

    const { dialogueStore } = await import('../state/dialogue-store');
    expect(dialogueStore.getState().active).toBe(true);

    manager.endDialogue();

    expect(dialogueStore.getState().active).toBe(false);
    expect(dialogueStore.getState().npcId).toBeNull();
  });

  it('shouldRemember=true writes to npc memory store', async () => {
    mockGenerateNpcDialogue.mockResolvedValue({
      dialogue: '我会记住你的帮助。',
      emotionTag: 'happy',
      shouldRemember: true,
      sentiment: 'positive',
    });

    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_captain');

    const { npcMemoryStore } = await import('../state/npc-memory-store');
    const record = npcMemoryStore.getState().memories['npc_captain'];
    expect(record?.recentMemories.length).toBeGreaterThan(0);
  });

  it('startDialogue returns error for unknown NPC', async () => {
    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    const result = await manager.startDialogue('npc_unknown');
    expect(result.mode).toBe('inline');
    expect(result.error).toBeTruthy();
  });

  it('endDialogue flushes non-zero relationshipValue delta to RelationStore', async () => {
    mockGenerateNpcDialogue
      .mockResolvedValueOnce({
        dialogue: '你好。',
        emotionTag: 'neutral',
        shouldRemember: false,
        sentiment: 'neutral',
      })
      .mockResolvedValueOnce({
        dialogue: '你是个值得信赖的人。',
        emotionTag: 'happy',
        shouldRemember: false,
        sentiment: 'positive',
      });

    const { relationStore } = await import('../state/relation-store');
    relationStore.setState(draft => {
      draft.npcDispositions = {};
    });

    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_guard');
    await manager.processPlayerResponse(0);
    manager.endDialogue();

    const disposition = relationStore.getState().npcDispositions['npc_guard'];
    expect(disposition).toBeDefined();
    expect(disposition?.value).not.toBe(0);
  });

  it('startDialogue passes both recentMemories and salientMemories to generateNpcDialogue', async () => {
    const { npcMemoryStore } = await import('../state/npc-memory-store');

    npcMemoryStore.setState(draft => {
      draft.memories['npc_guard'] = {
        npcId: 'npc_guard',
        recentMemories: [
          { id: 'r1', npcId: 'npc_guard', event: '最近的记忆1', turnNumber: 1, importance: 'medium', emotionalValence: 0, participants: ['player', 'npc_guard'] },
          { id: 'r2', npcId: 'npc_guard', event: '最近的记忆2', turnNumber: 2, importance: 'medium', emotionalValence: 0, participants: ['player', 'npc_guard'] },
        ],
        salientMemories: [
          { id: 's1', npcId: 'npc_guard', event: '重要的记忆1', turnNumber: 0, importance: 'high', emotionalValence: 0.5, participants: ['player', 'npc_guard'] },
        ],
        archiveSummary: '',
        version: 0,
        lastUpdated: new Date().toISOString(),
      };
    });

    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_guard');

    const callArgs = mockGenerateNpcDialogue.mock.calls[0] as unknown as [unknown, unknown, unknown, string[]];
    const memories = callArgs?.[3];
    expect(memories).toHaveLength(3);
    expect(memories).toContain('最近的记忆1');
    expect(memories).toContain('最近的记忆2');
    expect(memories).toContain('重要的记忆1');
  });

  it('startDialogue sets dialogue-store relationshipValue to 0', async () => {
    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_guard');

    const { dialogueStore } = await import('../state/dialogue-store');
    expect(dialogueStore.getState().relationshipValue).toBe(0);
  });

  it('endDialogue writes exact integer delta (10) to relation-store after positive sentiment', async () => {
    mockGenerateNpcDialogue
      .mockResolvedValueOnce({
        dialogue: '你好。',
        emotionTag: 'neutral',
        shouldRemember: false,
        sentiment: 'neutral',
      })
      .mockResolvedValueOnce({
        dialogue: '你是个值得信赖的人。',
        emotionTag: 'happy',
        shouldRemember: false,
        sentiment: 'positive',
      });

    const { relationStore } = await import('../state/relation-store');
    relationStore.setState(draft => {
      draft.npcDispositions = {};
    });

    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_guard');
    await manager.processPlayerResponse(0);
    manager.endDialogue();

    const disposition = relationStore.getState().npcDispositions['npc_guard'];
    expect(disposition?.value).toBe(10);
  });

  it('endDialogue calls applyFactionReputationDelta when npc has faction', async () => {
    mockGenerateNpcDialogue
      .mockResolvedValueOnce({
        dialogue: '你好。',
        emotionTag: 'neutral',
        shouldRemember: false,
        sentiment: 'neutral',
      })
      .mockResolvedValueOnce({
        dialogue: '好的。',
        emotionTag: 'neutral',
        shouldRemember: false,
        sentiment: 'positive',
      });

    const { relationStore } = await import('../state/relation-store');
    relationStore.setState(draft => {
      draft.npcDispositions = {};
      draft.factionReputations = {};
    });

    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_faction_guard');
    await manager.processPlayerResponse(0);
    manager.endDialogue();

    const factionRep = relationStore.getState().factionReputations['faction_guard'];
    expect(factionRep).toBe(5);
  });

  it('isQuestNpc returns true for NPC with Chinese goal keyword 调查', async () => {
    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    const result = await manager.startDialogue('npc_quest_chinese');
    expect(result.mode).toBe('full');
  });

  it('NPC with innkeeper tag gets innkeeper-specific questions containing 房间 or 住宿', async () => {
    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_innkeeper');

    const { dialogueStore } = await import('../state/dialogue-store');
    const options = dialogueStore.getState().availableResponses;
    const labels = options.map(o => o.label).join(' ');
    expect(labels).toMatch(/房间|住宿/);
  });

  it('NPC with hunter tag gets hunter-specific questions containing 猎物 or 危险', async () => {
    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_hunter');

    const { dialogueStore } = await import('../state/dialogue-store');
    const options = dialogueStore.getState().availableResponses;
    const labels = options.map(o => o.label).join(' ');
    expect(labels).toMatch(/猎物|危险/);
  });

  it('NPC with military tag gets military-specific questions containing 驻守 or 任务', async () => {
    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_soldier');

    const { dialogueStore } = await import('../state/dialogue-store');
    const options = dialogueStore.getState().availableResponses;
    const labels = options.map(o => o.label).join(' ');
    expect(labels).toMatch(/驻守|任务/);
  });

  it('NPC with clergy tag gets clergy questions', async () => {
    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_priest');

    const { dialogueStore } = await import('../state/dialogue-store');
    const options = dialogueStore.getState().availableResponses;
    const labels = options.map(o => o.label).join(' ');
    expect(labels).toMatch(/神明|神殿|庇护|服务/);
  });

  it('NPC with tags [military, guard] gets military questions (first match wins)', async () => {
    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_soldier');

    const { dialogueStore } = await import('../state/dialogue-store');
    const options = dialogueStore.getState().availableResponses;
    const labels = options.map(o => o.label).join(' ');
    expect(labels).toMatch(/任务|动向|管辖/);
    expect(labels).not.toMatch(/执勤多久/);
  });

  it('NPC with beggar tag gets questions containing 帮助 or 施舍', async () => {
    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_beggar');

    const { dialogueStore } = await import('../state/dialogue-store');
    const options = dialogueStore.getState().availableResponses;
    const labels = options.map(o => o.label).join(' ');
    expect(labels).toMatch(/帮助|施舍/);
  });

  it('NPC with underworld tag gets questions containing 服务 or 黑市', async () => {
    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_criminal');

    const { dialogueStore } = await import('../state/dialogue-store');
    const options = dialogueStore.getState().availableResponses;
    const labels = options.map(o => o.label).join(' ');
    expect(labels).toMatch(/服务|黑市/);
  });
});
