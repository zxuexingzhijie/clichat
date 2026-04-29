import { describe, it, expect } from 'bun:test';
import { buildNpcSystemPrompt } from './npc-system';
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
