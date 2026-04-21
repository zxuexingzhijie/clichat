import { describe, it, expect, mock, beforeEach } from 'bun:test';

const mockGenerateNpcDialogue = mock(() =>
  Promise.resolve({
    dialogue: '这里最近发生了些事情，你要小心。',
    emotionTag: 'suspicious',
    shouldRemember: false,
    relationshipDelta: 0,
  }),
);

const mockAdjudicate = mock(() => ({
  roll: 15,
  attributeName: 'mind',
  attributeModifier: 2,
  skillModifier: 0,
  environmentModifier: 0,
  total: 17,
  dc: 12,
  grade: 'success' as const,
  display: '[D20: 15] + 心智 2 = 17 vs DC 12 -> 成功',
}));

const { createDialogueManager } = await import('./dialogue-manager');

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
]);

describe('createDialogueManager', () => {
  beforeEach(() => {
    mockGenerateNpcDialogue.mockReset();
    mockAdjudicate.mockReset();
    mockGenerateNpcDialogue.mockResolvedValue({
      dialogue: '这里最近发生了些事情，你要小心。',
      emotionTag: 'suspicious',
      shouldRemember: false,
      relationshipDelta: 0,
    });
    mockAdjudicate.mockReturnValue({
      roll: 15,
      attributeName: 'mind',
      attributeModifier: 2,
      skillModifier: 0,
      environmentModifier: 0,
      total: 17,
      dc: 12,
      grade: 'success' as const,
      display: '[D20: 15] + 心智 2 = 17 vs DC 12 -> 成功',
    });
  });

  it('startDialogue with quest-NPC enters full mode', async () => {
    const manager = createDialogueManager(mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    const result = await manager.startDialogue('npc_captain');

    expect(result.mode).toBe('full');
    expect(result.npcName).toBe('守卫队长·陈铁柱');
    expect(result.dialogue).toBeTruthy();
  });

  it('startDialogue with simple NPC (no quest goals, neutral disposition) enters inline mode', async () => {
    const manager = createDialogueManager(mockCodexEntries, {
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
        relationshipDelta: 0,
      })
      .mockResolvedValueOnce({
        dialogue: '你有什么线索吗？',
        emotionTag: 'hopeful',
        shouldRemember: false,
        relationshipDelta: 0.1,
      });

    const manager = createDialogueManager(mockCodexEntries, {
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
      relationshipDelta: 0,
    });

    mockAdjudicate.mockReturnValue({
      roll: 18,
      attributeName: 'mind',
      attributeModifier: 2,
      skillModifier: 0,
      environmentModifier: 0,
      total: 20,
      dc: 12,
      grade: 'success' as const,
      display: '[D20: 18] + 心智 2 = 20 vs DC 12 -> 成功',
    });

    const manager = createDialogueManager(mockCodexEntries, {
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
    const manager = createDialogueManager(mockCodexEntries, {
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
      relationshipDelta: 0.2,
    });

    const manager = createDialogueManager(mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_captain');

    const { npcMemoryStore } = await import('../state/npc-memory-store');
    const record = npcMemoryStore.getState().memories['npc_captain'];
    expect(record?.recentMemories.length).toBeGreaterThan(0);
  });

  it('startDialogue returns error for unknown NPC', async () => {
    const manager = createDialogueManager(mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    const result = await manager.startDialogue('npc_unknown');
    expect(result.mode).toBe('inline');
    expect(result.error).toBeTruthy();
  });

  it('endDialogue flushes non-zero relationshipValue delta to RelationStore', async () => {
    mockGenerateNpcDialogue.mockResolvedValue({
      dialogue: '你是个值得信赖的人。',
      emotionTag: 'happy',
      shouldRemember: false,
      relationshipDelta: 0.3,
    });

    const { relationStore } = await import('../state/relation-store');
    relationStore.setState(draft => {
      draft.npcDispositions = {};
    });

    const manager = createDialogueManager(mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_guard');
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
        lastUpdated: new Date().toISOString(),
      };
    });

    const manager = createDialogueManager(mockCodexEntries, {
      generateNpcDialogueFn: mockGenerateNpcDialogue,
      adjudicateFn: mockAdjudicate,
    });

    await manager.startDialogue('npc_guard');

    const callArgs = mockGenerateNpcDialogue.mock.calls[0];
    const memories = callArgs?.[3] as string[];
    expect(memories).toHaveLength(3);
    expect(memories).toContain('最近的记忆1');
    expect(memories).toContain('最近的记忆2');
    expect(memories).toContain('重要的记忆1');
  });
});
