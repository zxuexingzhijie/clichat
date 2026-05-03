import { describe, it, expect } from 'bun:test';
import { buildNarrativeSystemPrompt, buildNarrativeUserPrompt } from './narrative-system';
import type { EcologicalMemoryContext } from '../utils/ecological-memory-retriever';

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

  it('recentNarration includes all entries instead of only the last 3', () => {
    const result = buildNarrativeSystemPrompt('exploration', {
      storyAct: 'act1',
      atmosphereTags: [],
      recentNarration: ['一', '二', '三', '四'],
    });
    expect(result).toContain('一');
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

describe('buildNarrativeUserPrompt', () => {
  it('includes all narration, all codex entries, and full descriptions', () => {
    const longDescription = '很长的资料'.repeat(60);

    const result = buildNarrativeUserPrompt({
      sceneContext: '当前场景',
      playerAction: '观察',
      recentNarration: ['叙述一', '叙述二', '叙述三', '叙述四'],
      codexEntries: [
        { id: 'c1', description: longDescription },
        { id: 'c2', description: '资料二' },
        { id: 'c3', description: '资料三' },
        { id: 'c4', description: '资料四' },
      ],
    });

    expect(result).toContain('叙述一');
    expect(result).toContain('叙述四');
    expect(result).toContain('[c1] ' + longDescription);
    expect(result).toContain('[c4] 资料四');
  });
});
