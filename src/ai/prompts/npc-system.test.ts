import { describe, it, expect } from 'bun:test';
import { buildNpcSystemPrompt, buildNpcUserPrompt } from './npc-system';
import type { NpcProfile } from './npc-system';

const baseNpc: NpcProfile = {
  id: 'npc_test',
  name: '测试NPC',
  personality_tags: ['cautious', 'shrewd'],
  goals: ['survive', 'profit'],
  backstory: '一个普通的商人',
};

const npcWithProfile: NpcProfile = {
  ...baseNpc,
  knowledgeProfile: {
    always_knows: ['镇上的基本布局', '市场价格'],
    trust_gates: [
      { min_trust: 5, reveals: '将军的秘密行动' },
      { min_trust: 8, reveals: '地下组织的联络方式' },
    ],
    hidden_knowledge: ['他亲眼目睹了谋杀'],
  },
};

describe('buildNpcSystemPrompt', () => {
  it('called without knowledgeProfile returns same string as original', () => {
    const result = buildNpcSystemPrompt(baseNpc);
    expect(result).toContain('你扮演NPC "测试NPC"');
    expect(result).toContain('cautious、shrewd');
    expect(result).toContain('survive、profit');
    expect(result).toContain('一个普通的商人');
    expect(result).not.toContain('信任度');
  });

  it('called without second argument defaults to trustLevel 0 (backward compat)', () => {
    const result = buildNpcSystemPrompt(npcWithProfile);
    expect(result).toContain('回避任何追问');
    expect(result).not.toContain('将军的秘密行动');
  });

  it('trustLevel 3 with gate at min_trust 5 does NOT include gate content', () => {
    const result = buildNpcSystemPrompt(npcWithProfile, 3);
    expect(result).not.toContain('将军的秘密行动');
    expect(result).not.toContain('地下组织的联络方式');
  });

  it('trustLevel 6 with gate at min_trust 5 DOES include gate content', () => {
    const result = buildNpcSystemPrompt(npcWithProfile, 6);
    expect(result).toContain('将军的秘密行动');
  });

  it('trustLevel 6 does NOT include gate with min_trust 8', () => {
    const result = buildNpcSystemPrompt(npcWithProfile, 6);
    expect(result).not.toContain('地下组织的联络方式');
  });

  it('trustLevel 9 includes hidden_knowledge content', () => {
    const result = buildNpcSystemPrompt(npcWithProfile, 9);
    expect(result).toContain('他亲眼目睹了谋杀');
  });

  it('trustLevel 9 includes 极度不愿承认 qualifier', () => {
    const result = buildNpcSystemPrompt(npcWithProfile, 9);
    expect(result).toContain('极度不愿承认');
  });

  it('trustLevel 3 includes 回避 restriction text', () => {
    const result = buildNpcSystemPrompt(npcWithProfile, 3);
    expect(result).toContain('回避');
  });

  it('always_knows items always appear regardless of trust level', () => {
    const low = buildNpcSystemPrompt(npcWithProfile, 0);
    const high = buildNpcSystemPrompt(npcWithProfile, 9);
    expect(low).toContain('镇上的基本布局');
    expect(low).toContain('市场价格');
    expect(high).toContain('镇上的基本布局');
    expect(high).toContain('市场价格');
  });

  it('trustLevel 5 exactly matches gate at min_trust 5', () => {
    const result = buildNpcSystemPrompt(npcWithProfile, 5);
    expect(result).toContain('将军的秘密行动');
    expect(result).not.toContain('地下组织的联络方式');
  });

  it('trustLevel 8 exactly matches gate at min_trust 8', () => {
    const result = buildNpcSystemPrompt(npcWithProfile, 8);
    expect(result).toContain('地下组织的联络方式');
    expect(result).not.toContain('他亲眼目睹了谋杀');
  });

  it('success criteria: trustLevel 9 with gate at min_trust 8 reveals 秘密内容', () => {
    const npc: NpcProfile = {
      ...baseNpc,
      knowledgeProfile: {
        trust_gates: [{ min_trust: 8, reveals: '秘密内容' }],
      },
    };
    const result = buildNpcSystemPrompt(npc, 9);
    expect(result).toContain('秘密内容');
  });

  it('success criteria: trustLevel 3 does NOT reveal content behind min_trust 8', () => {
    const npc: NpcProfile = {
      ...baseNpc,
      knowledgeProfile: {
        trust_gates: [{ min_trust: 8, reveals: '秘密内容' }],
      },
    };
    const result = buildNpcSystemPrompt(npc, 3);
    expect(result).not.toContain('秘密内容');
  });
});

describe('buildNpcUserPrompt', () => {
  it('injects encounter count separately from memory text', () => {
    const result = buildNpcUserPrompt({
      scene: '雨夜北门',
      playerAction: 'greet',
      memories: [],
      encounterCount: 2,
    });

    expect(result).toContain('与玩家的接触次数：2 次');
    expect(result).toContain('你对这个玩家的记忆：（无）');
  });

  it('formats ecological memory with epistemic labels and keeps rumors out of confirmed facts', () => {
    const promptContext = {
      scene: '雨夜北门',
      playerAction: '询问失踪矿工',
      memories: ['玩家曾在雨夜来过北门'],
      ecologicalMemory: {
        playerKnowledge: ['玩家知道旧矿洞封锁了'],
        facts: [
          {
            id: 'fact-confirmed-gate',
            statement: '北门今晚已经封锁。',
            scope: 'location' as const,
            scopeId: 'loc_north_gate',
            truthStatus: 'confirmed' as const,
            confidence: 0.95,
            sourceEventIds: ['event-gate'],
            tags: [],
            createdAt: '2026-05-02T00:00:00.000Z',
            updatedAt: '2026-05-02T00:00:00.000Z',
          },
          {
            id: 'fact-rumor-miner',
            statement: '有人传言失踪矿工被狼群带走。',
            scope: 'location' as const,
            scopeId: 'loc_north_gate',
            truthStatus: 'rumor' as const,
            confidence: 0.4,
            sourceEventIds: ['event-rumor'],
            tags: [],
            createdAt: '2026-05-02T00:00:00.000Z',
            updatedAt: '2026-05-02T00:00:00.000Z',
          },
        ],
        beliefs: [
          {
            id: 'belief-guard-player',
            holderId: 'npc_guard',
            holderType: 'npc' as const,
            subjectId: 'player',
            factId: null,
            statement: '这个旅行者可能知道矿工失踪的线索。',
            stance: 'believes' as const,
            confidence: 0.7,
            sourceEventIds: ['event-talk'],
            lastReinforcedTurn: 4,
            decay: 'normal' as const,
            tags: [],
          },
        ],
        events: [
          {
            id: 'event-gate',
            idempotencyKey: 'event-gate',
            turnNumber: 4,
            timestamp: '2026-05-02T00:00:00.000Z',
            type: 'dialogue' as const,
            actorIds: ['player', 'npc_guard'],
            subjectIds: ['npc_guard'],
            locationId: 'loc_north_gate',
            factionIds: [],
            summary: '玩家在北门询问失踪矿工。',
            visibility: 'same_location' as const,
            importance: 'medium' as const,
            tags: [],
            source: 'npc_dialogue' as const,
          },
        ],
        omitted: [],
      },
    };

    const result = buildNpcUserPrompt(promptContext);

    expect(result).toContain('Runtime memory:');
    expect(result).toContain('Confirmed world facts:');
    expect(result).toContain('Rumors:');
    expect(result).toContain('This NPC believes:');
    expect(result).toContain('Recent events:');
    const confirmedSection = result.slice(
      result.indexOf('Confirmed world facts:'),
      result.indexOf('Rumors:'),
    );
    expect(confirmedSection).toContain('北门今晚已经封锁。');
    expect(confirmedSection).not.toContain('有人传言失踪矿工被狼群带走。');
  });
});

describe('buildNpcSystemPrompt — narrativeContext injection', () => {
  it('called with undefined narrativeContext produces identical output to 2-arg call', () => {
    const without = buildNpcSystemPrompt(baseNpc, 0);
    const withUndefined = buildNpcSystemPrompt(baseNpc, 0, undefined);
    expect(withUndefined).toBe(without);
  });

  it('called with act1 context contains 当前故事阶段：act1', () => {
    const result = buildNpcSystemPrompt(baseNpc, 0, {
      storyAct: 'act1',
      atmosphereTags: ['平静', '日常'],
    });
    expect(result).toContain('当前故事阶段：act1');
  });

  it('called with act3 context contains atmosphere tags and 请用符合当前氛围的语气说话', () => {
    const result = buildNpcSystemPrompt(baseNpc, 0, {
      storyAct: 'act3',
      atmosphereTags: ['沉重', '真相'],
    });
    expect(result).toContain('沉重、真相');
    expect(result).toContain('请用符合当前氛围的语气说话');
  });

  it('narrative paragraph is appended AFTER existing trust-gate content', () => {
    const result = buildNpcSystemPrompt(npcWithProfile, 0, {
      storyAct: 'act2',
      atmosphereTags: ['悬疑'],
    });
    const trustIdx = result.indexOf('回避任何追问');
    const actIdx = result.indexOf('当前故事阶段：act2');
    expect(trustIdx).toBeGreaterThan(-1);
    expect(actIdx).toBeGreaterThan(trustIdx);
  });

  it('with trust-unlocked NPC and narrativeContext contains both trust content and act paragraph', () => {
    const result = buildNpcSystemPrompt(npcWithProfile, 6, {
      storyAct: 'act1',
      atmosphereTags: ['紧张'],
    });
    expect(result).toContain('将军的秘密行动');
    expect(result).toContain('当前故事阶段：act1');
    expect(result).toContain('紧张');
  });
});

describe('buildNpcUserPrompt', () => {
  it('includes all memories instead of fixed first 8', () => {
    const memories = Array.from({ length: 10 }, (_, index) => `记忆${index + 1}`);

    const result = buildNpcUserPrompt({
      scene: '场景',
      playerAction: '问候',
      memories,
    });

    expect(result).toContain('记忆1');
    expect(result).toContain('记忆8');
    expect(result).toContain('记忆9');
    expect(result).toContain('记忆10');
  });
});
