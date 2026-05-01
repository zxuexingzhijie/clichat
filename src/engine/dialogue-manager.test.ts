import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { NpcDialogue } from '../ai/schemas/npc-dialogue';
import type { CheckResult } from '../types/common';
import { createStore } from '../state/create-store';
import type { QuestState } from '../state/quest-store';

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
  [
    'npc_elder',
    {
      id: 'npc_elder',
      name: '镇长·王德',
      type: 'npc' as const,
      tags: ['official', '黑松镇'],
      description: '花白胡须的矮胖老人',
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
      location_id: 'loc_main_street',
      personality_tags: ['diplomatic', 'cautious', 'authoritative'],
      goals: ['maintain_order', 'secure_trade_routes', 'hide_town_secret'],
      backstory: '王德做了二十年镇长',
      initial_disposition: 0.1,
      knowledge_profile: {
        always_knows: ['黑松镇日常事务和历史'],
        hidden_knowledge: ['五年前他与外来势力达成了秘密协议'],
        trust_gates: [
          { min_trust: 5, reveals: '五年前的狼灾处理方式有些不寻常' },
          { min_trust: 7, reveals: '他知道失踪事件与五年前的某些旧事有关联' },
        ],
      },
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

  it('startDialogue with simple NPC opens full dialogue panel mode', async () => {
    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    const result = await manager.startDialogue('npc_guard');

    expect(result.mode).toBe('full');
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

  it('startDialogue uses generateDialogueOptionsFn to build response items', async () => {
    const mockGenerateOptions = mock(() =>
      Promise.resolve({ options: ['"你在这里多久了？"', '"最近镇上有什么新鲜事？"'] }),
    );
    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      generateDialogueOptionsFn: mockGenerateOptions,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_guard');

    const { dialogueStore } = await import('../state/dialogue-store');
    const options = dialogueStore.getState().availableResponses;
    const labels = options.map((o) => o.label);
    expect(labels).toContain('"你在这里多久了？"');
    expect(labels).toContain('"最近镇上有什么新鲜事？"');
    expect(labels).toContain('结束对话');
  });

  it('startDialogue always appends 结束对话 and check option in full mode', async () => {
    const mockGenerateOptions = mock(() =>
      Promise.resolve({ options: ['"选项A"'] }),
    );
    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      generateDialogueOptionsFn: mockGenerateOptions,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_guard');

    const { dialogueStore } = await import('../state/dialogue-store');
    const options = dialogueStore.getState().availableResponses;
    const labels = options.map((o) => o.label);
    expect(labels).toContain('结束对话');
    expect(labels.some((l) => l.includes('心智检定'))).toBe(true);
  });

  it('processPlayerResponse uses generateDialogueOptionsFn after NPC reply', async () => {
    const mockGenerateOptions = mock(() =>
      Promise.resolve({ options: ['"你刚才说的登记是什么意思？"', '"镇公所在哪里？"'] }),
    );
    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      generateDialogueOptionsFn: mockGenerateOptions,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_guard');
    await manager.processPlayerResponse(0);

    const { dialogueStore } = await import('../state/dialogue-store');
    const options = dialogueStore.getState().availableResponses;
    const labels = options.map((o) => o.label);
    expect(labels).toContain('"你刚才说的登记是什么意思？"');
    expect(labels).toContain('"镇公所在哪里？"');
    expect(labels).toContain('结束对话');
  });

  it('generateDialogueOptionsFn receives NPC name and latest dialogue', async () => {
    let capturedName = '';
    let capturedDialogue = '';
    const mockGenerateOptions = mock((name: string, dialogue: string) => {
      capturedName = name;
      capturedDialogue = dialogue;
      return Promise.resolve({ options: ['"好的"'] });
    });
    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      generateDialogueOptionsFn: mockGenerateOptions,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_guard');

    expect(capturedName).toBe('北门守卫');
    expect(capturedDialogue).toBe('这里最近发生了些事情，你要小心。');
  });

  it('with narrativeStore passes narrativeContext to doGenerateDialogue', async () => {
    let capturedNarrativeCtx: unknown = 'not-called';
    const trackingDialogueFn = mock((...args: unknown[]) => {
      capturedNarrativeCtx = args[5];
      return Promise.resolve({
        dialogue: '测试对白。',
        emotionTag: 'neutral',
        shouldRemember: false,
        sentiment: 'neutral',
      });
    });

    const narrativeStore = {
      getState: () => ({ currentAct: 'act2' as const, atmosphereTags: ['dread'], worldFlags: {}, playerKnowledgeLevel: 0 }),
      setState: () => {},
      subscribe: () => () => {},
      restoreState: () => {},
    };

    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: trackingDialogueFn as typeof import('../ai/roles/npc-actor').generateNpcDialogue,
      adjudicateFn: mockAdjudicate,
      narrativeStore,
    });

    await manager.startDialogue('npc_guard');

    expect(capturedNarrativeCtx).toEqual({ storyAct: 'act2', atmosphereTags: ['dread'] });
  });

  it('without narrativeStore passes undefined narrativeContext to doGenerateDialogue', async () => {
    let capturedNarrativeCtx: unknown = 'not-called';
    const trackingDialogueFn = mock((...args: unknown[]) => {
      capturedNarrativeCtx = args[5];
      return Promise.resolve({
        dialogue: '测试对白。',
        emotionTag: 'neutral',
        shouldRemember: false,
        sentiment: 'neutral',
      });
    });

    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: trackingDialogueFn as typeof import('../ai/roles/npc-actor').generateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_guard');

    expect(capturedNarrativeCtx).toBeUndefined();
  });

  it('startDialogue with personalTrust=90 passes trustLevel >= 9 to generateNpcDialogue', async () => {
    const { relationStore } = await import('../state/relation-store');
    relationStore.setState((draft) => {
      draft.npcDispositions['npc_elder'] = {
        value: 0,
        publicReputation: 0,
        personalTrust: 90,
        fear: 0,
        infamy: 0,
        credibility: 0,
      };
    });

    let capturedTrustLevel: unknown = undefined;
    const trackingDialogueFn = mock((...args: unknown[]) => {
      capturedTrustLevel = args[6];
      return Promise.resolve({
        dialogue: '测试对白。',
        emotionTag: 'neutral',
        shouldRemember: false,
        sentiment: 'neutral',
      });
    });

    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: trackingDialogueFn as typeof import('../ai/roles/npc-actor').generateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_elder');

    expect(typeof capturedTrustLevel).toBe('number');
    expect(capturedTrustLevel as number).toBeGreaterThanOrEqual(9);
  });

  it('startDialogue with no disposition entry passes trustLevel <= 5 to generateNpcDialogue', async () => {
    const { relationStore } = await import('../state/relation-store');
    relationStore.setState((draft) => {
      delete draft.npcDispositions['npc_elder'];
    });

    let capturedTrustLevel: unknown = undefined;
    const trackingDialogueFn = mock((...args: unknown[]) => {
      capturedTrustLevel = args[6];
      return Promise.resolve({
        dialogue: '测试对白。',
        emotionTag: 'neutral',
        shouldRemember: false,
        sentiment: 'neutral',
      });
    });

    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: trackingDialogueFn as typeof import('../ai/roles/npc-actor').generateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_elder');

    expect(typeof capturedTrustLevel).toBe('number');
    expect(capturedTrustLevel as number).toBeLessThanOrEqual(5);
  });

  it('endDialogue with npc_captain at stage_allies_decision sets justice_score_locked', async () => {
    const questStore = createStore<QuestState>({
      quests: {
        quest_main_01: {
          status: 'active',
          currentStageId: 'stage_allies_decision',
          completedObjectives: [],
          discoveredClues: [],
          flags: {},
          acceptedAt: 1,
          completedAt: null,
        },
      },
      eventLog: [],
    });

    const manager = createDialogueManager(
      { ...stores, quest: questStore },
      mockCodexEntries,
      { generateNpcDialogueFn: mockGenerateNpcDialogue, adjudicateFn: mockAdjudicate },
    );

    await manager.startDialogue('npc_captain');
    manager.endDialogue();

    expect(questStore.getState().quests['quest_main_01']?.flags['justice_score_locked']).toBe(true);
  });

  it('endDialogue with npc_bartender at stage_allies_decision does NOT set any route flag', async () => {
    const questStore = createStore<QuestState>({
      quests: {
        quest_main_01: {
          status: 'active',
          currentStageId: 'stage_allies_decision',
          completedObjectives: [],
          discoveredClues: [],
          flags: {},
          acceptedAt: 1,
          completedAt: null,
        },
      },
      eventLog: [],
    });

    const manager = createDialogueManager(
      { ...stores, quest: questStore },
      mockCodexEntries,
      { generateNpcDialogueFn: mockGenerateNpcDialogue, adjudicateFn: mockAdjudicate },
    );

    await manager.startDialogue('npc_bartender');
    manager.endDialogue();

    const flags = questStore.getState().quests['quest_main_01']?.flags ?? {};
    expect(flags['justice_score_locked']).toBeUndefined();
    expect(flags['shadow_score_locked']).toBeUndefined();
    expect(flags['pragmatism_score_locked']).toBeUndefined();
  });

  it('endDialogue without quest store present does not throw', async () => {
    const manager = createDialogueManager(stores, mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_captain');
    expect(() => manager.endDialogue()).not.toThrow();
  });

  describe('adjudicateTalkResult integration', () => {
    it('processPlayerResponse with sentiment positive — relationshipValue increases by 10', async () => {
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

      const manager = createDialogueManager(stores, mockCodexEntries, {
        generateNpcDialogueFn: mockGenerateNpcDialogue,
        adjudicateFn: mockAdjudicate,
      });

      await manager.startDialogue('npc_guard');
      const before = dialogueStore.getState().relationshipValue;
      await manager.processPlayerResponse(0);
      const after = dialogueStore.getState().relationshipValue;

      expect(after - before).toBe(10);
    });

    it('processPlayerResponse with sentiment hostile — relationshipValue decreases by 20', async () => {
      mockGenerateNpcDialogue
        .mockResolvedValueOnce({
          dialogue: '你好。',
          emotionTag: 'neutral',
          shouldRemember: false,
          sentiment: 'neutral',
        })
        .mockResolvedValueOnce({
          dialogue: '走开！',
          emotionTag: 'angry',
          shouldRemember: false,
          sentiment: 'hostile',
        });

      const manager = createDialogueManager(stores, mockCodexEntries, {
        generateNpcDialogueFn: mockGenerateNpcDialogue,
        adjudicateFn: mockAdjudicate,
      });

      await manager.startDialogue('npc_guard');
      const before = dialogueStore.getState().relationshipValue;
      await manager.processPlayerResponse(0);
      const after = dialogueStore.getState().relationshipValue;

      expect(after - before).toBe(-20);
    });

    it('processPlayerFreeText with sentiment negative — relationshipValue decreases by 10', async () => {
      mockGenerateNpcDialogue
        .mockResolvedValueOnce({
          dialogue: '你好。',
          emotionTag: 'neutral',
          shouldRemember: false,
          sentiment: 'neutral',
        })
        .mockResolvedValueOnce({
          dialogue: '我不喜欢你的态度。',
          emotionTag: 'angry',
          shouldRemember: false,
          sentiment: 'negative',
        });

      const manager = createDialogueManager(stores, mockCodexEntries, {
        generateNpcDialogueFn: mockGenerateNpcDialogue,
        adjudicateFn: mockAdjudicate,
      });

      await manager.startDialogue('npc_guard');
      const before = dialogueStore.getState().relationshipValue;
      await manager.processPlayerFreeText('你好吗？');
      const after = dialogueStore.getState().relationshipValue;

      expect(after - before).toBe(-10);
    });

    it('processPlayerFreeText with sentiment neutral — relationshipValue unchanged', async () => {
      mockGenerateNpcDialogue
        .mockResolvedValueOnce({
          dialogue: '你好。',
          emotionTag: 'neutral',
          shouldRemember: false,
          sentiment: 'neutral',
        })
        .mockResolvedValueOnce({
          dialogue: '没什么特别的。',
          emotionTag: 'neutral',
          shouldRemember: false,
          sentiment: 'neutral',
        });

      const manager = createDialogueManager(stores, mockCodexEntries, {
        generateNpcDialogueFn: mockGenerateNpcDialogue,
        adjudicateFn: mockAdjudicate,
      });

      await manager.startDialogue('npc_guard');
      const before = dialogueStore.getState().relationshipValue;
      await manager.processPlayerFreeText('怎么了？');
      const after = dialogueStore.getState().relationshipValue;

      expect(after - before).toBe(0);
    });
  });

  describe('dialogueHistory format — DIAL-02', () => {
    it('startDialogue writes {role:user, content:greet} then {role:assistant} into dialogueHistory', async () => {
      const manager = createDialogueManager(stores, mockCodexEntries, {
        generateNpcDialogueFn: mockGenerateNpcDialogue,
        adjudicateFn: mockAdjudicate,
      });

      await manager.startDialogue('npc_guard');

      const { dialogueStore } = await import('../state/dialogue-store');
      const history = dialogueStore.getState().dialogueHistory;
      expect(history.length).toBe(2);
      expect(history[0]!.role).toBe('user');
      expect(history[0]!.content).toBe('greet');
      expect(history[1]!.role).toBe('assistant');
      expect(history[1]!.content).toBe('这里最近发生了些事情，你要小心。');
    });

    it('processPlayerResponse appends {role:user} and {role:assistant} entries to dialogueHistory', async () => {
      mockGenerateNpcDialogue
        .mockResolvedValueOnce({
          dialogue: '第一句问候。',
          emotionTag: 'neutral',
          shouldRemember: false,
          sentiment: 'neutral',
        })
        .mockResolvedValueOnce({
          dialogue: '第二句回应。',
          emotionTag: 'neutral',
          shouldRemember: false,
          sentiment: 'neutral',
        });

      const manager = createDialogueManager(stores, mockCodexEntries, {
        generateNpcDialogueFn: mockGenerateNpcDialogue,
        adjudicateFn: mockAdjudicate,
      });

      await manager.startDialogue('npc_guard');
      await manager.processPlayerResponse(0);

      const { dialogueStore } = await import('../state/dialogue-store');
      const history = dialogueStore.getState().dialogueHistory;
      expect(history.length).toBe(4);
      expect(history[0]!.role).toBe('user');    // greet
      expect(history[1]!.role).toBe('assistant'); // npc greeting
      expect(history[2]!.role).toBe('user');    // player choice
      expect(history[3]!.role).toBe('assistant');
      expect(history[3]!.content).toBe('第二句回应。');
    });

    it('DialogueManager passes dialogueHistory as conversationHistory to generateNpcDialogue', async () => {
      mockGenerateNpcDialogue
        .mockResolvedValueOnce({
          dialogue: '初始对话。',
          emotionTag: 'neutral',
          shouldRemember: false,
          sentiment: 'neutral',
        })
        .mockResolvedValueOnce({
          dialogue: '后续对话。',
          emotionTag: 'neutral',
          shouldRemember: false,
          sentiment: 'neutral',
        });

      const manager = createDialogueManager(stores, mockCodexEntries, {
        generateNpcDialogueFn: mockGenerateNpcDialogue,
        adjudicateFn: mockAdjudicate,
      });

      await manager.startDialogue('npc_guard');

      const { dialogueStore } = await import('../state/dialogue-store');
      const historyAfterStart = dialogueStore.getState().dialogueHistory;

      await manager.processPlayerResponse(0);

      const secondCallArgs = mockGenerateNpcDialogue.mock.calls[1] as unknown as [
        unknown,
        unknown,
        unknown,
        unknown,
        { conversationHistory?: unknown },
      ];
      const passedHistory = secondCallArgs[4]?.conversationHistory;
      expect(passedHistory).toEqual(historyAfterStart);
    });
  });
});
