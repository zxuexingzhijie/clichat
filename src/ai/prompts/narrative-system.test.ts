import { describe, it, expect } from 'bun:test';
import { buildNarrativeSystemPrompt, buildNarrativeUserPrompt } from './narrative-system';
import type { EcologicalMemoryContext } from '../utils/ecological-memory-retriever';

describe('buildNarrativeUserPrompt', () => {
  it('renders ai grounding separately from codex description', () => {
    const result = buildNarrativeUserPrompt({
      sceneContext: '北门雨夜',
      recentNarration: [],
      playerAction: 'look around',
      codexEntries: [
        {
          id: 'loc_gate',
          description: '玩家可见的北门描述',
          aiGrounding: {
            mustKnow: ['守卫私下害怕北方森林。'],
            mustNotInvent: ['不要发明龙袭击北门。'],
            tone: ['克制', '潮湿寒冷'],
          },
        },
      ],
    });

    expect(result).toContain('参考资料：');
    expect(result).toContain('[loc_gate] 玩家可见的北门描述');
    expect(result).toContain('AI grounding（仅供生成时遵守，不得直接或间接向玩家泄露、暗示或改写，除非信息已经对玩家可见）');
    expect(result).toContain('Must know:');
    expect(result).toContain('- 守卫私下害怕北方森林。');
    expect(result).toContain('Must not invent:');
    expect(result).toContain('- 不要发明龙袭击北门。');
    expect(result).toContain('Tone:');
    expect(result).toContain('- 克制');
    expect(result).toContain('- 潮湿寒冷');
  });

  it('uses strong non-leak wording for ai grounding', () => {
    const result = buildNarrativeUserPrompt({
      sceneContext: '北门雨夜',
      recentNarration: [],
      playerAction: 'look around',
      codexEntries: [
        {
          id: 'loc_gate',
          description: '玩家可见的北门描述',
          aiGrounding: {
            mustKnow: ['守卫私下害怕北方森林。'],
          },
        },
      ],
    });

    expect(result).toContain('不得直接或间接');
    expect(result).toContain('泄露');
    expect(result).toContain('暗示');
    expect(result).toContain('改写');
  });

  it('keeps description as fallback when v2 ai grounding is absent', () => {
    const result = buildNarrativeUserPrompt({
      sceneContext: '北门雨夜',
      recentNarration: [],
      playerAction: 'look around',
      codexEntries: [{ id: 'old_entry', description: '旧条目的描述仍可用' }],
    });

    expect(result).toContain('[old_entry] 旧条目的描述仍可用');
    expect(result).not.toContain('AI grounding（仅供生成时遵守，不要直接向玩家复述）');
  });
});

describe('buildNarrativeSystemPrompt', () => {
  it('renders ecological memory with epistemic labels and keeps rumors out of confirmed facts', () => {
    const ecologicalMemory: EcologicalMemoryContext = {
      playerKnowledge: [],
      omitted: [],
      beliefs: [],
      facts: [
        {
          id: 'fact-confirmed',
          statement: '北门的悬赏告示确实存在。',
          scope: 'location',
          scopeId: 'loc_north_gate',
          truthStatus: 'confirmed',
          confidence: 1,
          sourceEventIds: ['event-confirmed'],
          tags: [],
          createdAt: '2026-05-02T00:00:00.000Z',
          updatedAt: '2026-05-02T00:00:00.000Z',
        },
        {
          id: 'fact-rumor',
          statement: '有人传说森林里有会说话的狼。',
          scope: 'location',
          scopeId: 'loc_north_gate',
          truthStatus: 'rumor',
          confidence: 0.4,
          sourceEventIds: ['event-rumor'],
          tags: [],
          createdAt: '2026-05-02T00:00:00.000Z',
          updatedAt: '2026-05-02T00:00:00.000Z',
        },
      ],
      events: [
        {
          id: 'event-recent',
          idempotencyKey: 'event-recent',
          turnNumber: 5,
          timestamp: '2026-05-02T00:00:00.000Z',
          type: 'quest',
          actorIds: ['player'],
          subjectIds: [],
          locationId: 'loc_north_gate',
          factionIds: [],
          summary: '玩家查看了北门悬赏告示。',
          sourceDomainEvent: 'test',
          visibility: 'public',
          importance: 'medium',
          tags: [],
          source: 'system',
        },
      ],
    };

    const result = buildNarrativeSystemPrompt('exploration', {
      storyAct: 'act2',
      atmosphereTags: ['dread'],
      ecologicalMemory,
    });

    expect(result).toContain('Runtime world memory:');
    expect(result).toContain('Confirmed world facts:');
    expect(result).toContain('Local rumors:');
    expect(result).toContain('Recent relevant events:');
    expect(result).toContain('北门的悬赏告示确实存在。');
    expect(result).toContain('有人传说森林里有会说话的狼。');
    expect(result).toContain('玩家查看了北门悬赏告示。');

    const confirmedSection = result.slice(
      result.indexOf('Confirmed world facts:'),
      result.indexOf('Local rumors:'),
    );
    expect(confirmedSection).toContain('北门的悬赏告示确实存在。');
    expect(confirmedSection).not.toContain('有人传说森林里有会说话的狼。');
  });

  it('called without narrativeContext returns same result as original function', () => {
    const result = buildNarrativeSystemPrompt('exploration');
    expect(result).toContain('你是一个中文奇幻RPG游戏的叙述者');
    expect(result).toContain('视角');
    expect(result).toContain('风格');
    expect(result).not.toContain('第一幕');
    expect(result).not.toContain('第二幕');
    expect(result).not.toContain('第三幕');
  });

  it('called with storyAct act2 includes 第二幕 and act2 tone guidance', () => {
    const result = buildNarrativeSystemPrompt('exploration', {
      storyAct: 'act2',
      atmosphereTags: ['dread'],
    });
    expect(result).toContain('第二幕');
    expect(result).toContain('第二幕提示');
    expect(result).toContain('悬疑');
  });

  it('called with storyAct act1 includes 第一幕 and act1 tone guidance', () => {
    const result = buildNarrativeSystemPrompt('exploration', {
      storyAct: 'act1',
      atmosphereTags: [],
    });
    expect(result).toContain('第一幕');
    expect(result).toContain('第一幕提示');
    expect(result).toContain('克制');
  });

  it('called with storyAct act3 includes 第三幕 and act3 tone guidance', () => {
    const result = buildNarrativeSystemPrompt('combat', {
      storyAct: 'act3',
      atmosphereTags: [],
    });
    expect(result).toContain('第三幕');
    expect(result).toContain('第三幕提示');
    expect(result).toContain('沉重感');
  });

  it('called with atmosphereTags includes them joined with 、', () => {
    const result = buildNarrativeSystemPrompt('exploration', {
      storyAct: 'act2',
      atmosphereTags: ['dread', 'urgency'],
    });
    expect(result).toContain('dread、urgency');
  });

  it('called with single atmosphere tag does not add 、', () => {
    const result = buildNarrativeSystemPrompt('exploration', {
      storyAct: 'act1',
      atmosphereTags: ['calm'],
    });
    expect(result).toContain('calm');
    expect(result).not.toContain('calm、');
  });

  it('called with recentNarration includes 避免重复 instruction and the lines', () => {
    const result = buildNarrativeSystemPrompt('exploration', {
      storyAct: 'act1',
      atmosphereTags: ['calm'],
      recentNarration: ['第一段叙述', '第二段叙述'],
    });
    expect(result).toContain('避免重复同一词语');
    expect(result).toContain('第一段叙述');
    expect(result).toContain('第二段叙述');
  });

  it('called with empty recentNarration omits the recent section', () => {
    const result = buildNarrativeSystemPrompt('exploration', {
      storyAct: 'act1',
      atmosphereTags: ['calm'],
      recentNarration: [],
    });
    expect(result).not.toContain('避免重复同一词语');
    expect(result).not.toContain('最近叙述（保持语气');
  });

  it('recentNarration keeps only the last 3 entries', () => {
    const result = buildNarrativeSystemPrompt('exploration', {
      storyAct: 'act1',
      atmosphereTags: [],
      recentNarration: ['一', '二', '三', '四'],
    });
    expect(result).not.toContain('\n一\n');
    expect(result).toContain('二');
    expect(result).toContain('三');
    expect(result).toContain('四');
  });

  it('success criteria: storyAct act2 with atmosphereTags dread and urgency', () => {
    const result = buildNarrativeSystemPrompt('exploration', {
      storyAct: 'act2',
      atmosphereTags: ['dread', 'urgency'],
    });
    expect(result).toContain('第二幕');
    expect(result).toContain('dread');
    expect(result).toContain('urgency');
  });
});
