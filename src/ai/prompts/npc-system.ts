import type { EcologicalMemoryContext } from '../utils/ecological-memory-retriever';
import type { NarrativePromptContext } from './narrative-system';

export type NpcTrustGate = {
  readonly min_trust: number;
  readonly reveals: string;
};

export type NpcKnowledgeProfile = {
  readonly always_knows?: readonly string[];
  readonly hidden_knowledge?: readonly string[];
  readonly trust_gates?: readonly NpcTrustGate[];
};

export type NpcVoiceProfile = {
  readonly register?: string;
  readonly sentenceStyle?: string;
  readonly verbalTics?: readonly string[];
};

export type NpcSocialMemoryProfile = {
  readonly remembers?: readonly string[];
  readonly sharesWith?: readonly string[];
  readonly secrecy?: string;
};

export type NpcAiGroundingProfile = {
  readonly mustKnow?: readonly string[];
  readonly mustNotInvent?: readonly string[];
  readonly tone?: readonly string[];
  readonly revealPolicy?: Record<string, string | { readonly response: string }>;
};

export type NpcProfile = {
  readonly id: string;
  readonly name: string;
  readonly personality_tags: readonly string[];
  readonly goals: readonly string[];
  readonly backstory: string;
  readonly knowledgeProfile?: NpcKnowledgeProfile;
  readonly voice?: NpcVoiceProfile;
  readonly socialMemory?: NpcSocialMemoryProfile;
  readonly aiGrounding?: NpcAiGroundingProfile;
};

function formatPolicyValue(value: string | { readonly response: string }): string {
  return typeof value === 'string' ? value : value.response;
}

function formatNpcAuthoringV2Context(npc: NpcProfile): string {
  const lines: string[] = [];

  if (npc.voice) {
    const voiceLines: string[] = [];
    if (npc.voice.register) voiceLines.push(`语域：${npc.voice.register}`);
    if (npc.voice.sentenceStyle) voiceLines.push(`句式：${npc.voice.sentenceStyle}`);
    if (npc.voice.verbalTics?.length) voiceLines.push(`口头禅：${npc.voice.verbalTics.join('、')}`);
    if (voiceLines.length) lines.push(`声音设定：\n${voiceLines.join('\n')}`);
  }

  if (npc.socialMemory) {
    const memoryLines: string[] = [];
    if (npc.socialMemory.remembers?.length) {
      memoryLines.push(`记得：${npc.socialMemory.remembers.join('、')}`);
    }
    if (npc.socialMemory.sharesWith?.length) {
      memoryLines.push(`可分享对象：${npc.socialMemory.sharesWith.join('、')}`);
    }
    if (npc.socialMemory.secrecy) {
      memoryLines.push(`保密原则：${npc.socialMemory.secrecy}`);
    }
    if (memoryLines.length) lines.push(`社交记忆：\n${memoryLines.join('\n')}`);
  }

  const aiGrounding = npc.aiGrounding;
  if (aiGrounding?.mustKnow?.length) {
    lines.push(`必须知道：\n${bulletList(aiGrounding.mustKnow)}`);
  }
  if (aiGrounding?.mustNotInvent?.length) {
    lines.push(`不得发明：\n${bulletList(aiGrounding.mustNotInvent)}`);
  }
  if (aiGrounding?.tone?.length) {
    lines.push(`语气约束：\n${bulletList(aiGrounding.tone)}`);
  }

  const revealPolicy = aiGrounding?.revealPolicy;
  if (revealPolicy && Object.keys(revealPolicy).length) {
    const policyLines = Object.entries(revealPolicy)
      .map(([key, value]) => `- ${key}: ${formatPolicyValue(value)}`);
    lines.push(`揭示策略：\n${policyLines.join('\n')}`);
  }

  if (!lines.length) return '';
  return `\n\nAI专用角色设定（用于约束生成；不要把这些隐藏设定逐字作为对白说出）：\n${lines.join('\n')}`;
}

export function buildNpcSystemPrompt(npc: NpcProfile, trustLevel: number = 0, narrativeContext?: NarrativePromptContext): string {
  const base = `你扮演NPC "${npc.name}"。
性格特征：${npc.personality_tags.join('、')}
目标：${npc.goals.join('、')}
背景：${npc.backstory}

规则：
- 用符合角色性格的语气说话
- 只谈论你应该知道的事情
- 输出对白，不超过300字
- 不发明世界事实
- 不声明机械效果`;

  const authoringV2Context = formatNpcAuthoringV2Context(npc);
  const baseWithAuthoringContext = base + authoringV2Context;

  const result = (() => {
    if (!npc.knowledgeProfile) return baseWithAuthoringContext;

    const profile = npc.knowledgeProfile;
    const disclosureLines: string[] = [];

    if (profile.always_knows?.length) {
      disclosureLines.push(`你可以自由谈论：${profile.always_knows.join('、')}`);
    }

    const unlockedGates = (profile.trust_gates ?? []).filter(g => trustLevel >= g.min_trust);
    if (unlockedGates.length) {
      disclosureLines.push(`基于当前信任度（${trustLevel}/10），你可以提及（但保持间接和不确认）：`);
      for (const gate of unlockedGates) {
        disclosureLines.push(`- ${gate.reveals}`);
      }
    }

    if (trustLevel > 8 && profile.hidden_knowledge?.length) {
      disclosureLines.push(`你内心知道但极度不愿承认（只在被逼到绝境时才透露，保持犹豫和回避）：`);
      for (const item of profile.hidden_knowledge) {
        disclosureLines.push(`- ${item}`);
      }
    }

    if (trustLevel < 5) {
      disclosureLines.push('当前信任度不足：只谈表面日常话题，回避任何追问。');
    }

    return baseWithAuthoringContext + '\n\n' + disclosureLines.join('\n');
  })();

  if (!narrativeContext) return result;

  const atmosphereStr = narrativeContext.atmosphereTags.join('、');
  const narrativeParagraph = `\n\n当前故事阶段：${narrativeContext.storyAct}\n氛围：${atmosphereStr}\n请用符合当前氛围的语气说话。`;
  return result + narrativeParagraph;
}

export type NpcUserPromptContext = {
  readonly scene: string;
  readonly playerAction: string;
  readonly memories: readonly string[];
  readonly encounterCount?: number;
  readonly emotionHint?: string;
  readonly archiveSummary?: string;
  readonly relevantCodex?: readonly string[];
  readonly ecologicalMemory?: EcologicalMemoryContext;
};

function bulletList(items: readonly string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- （无）';
}

function formatEcologicalMemory(memory: EcologicalMemoryContext | undefined): string {
  if (!memory) return '';

  const confirmedFacts = memory.facts
    .filter((fact) => fact.truthStatus === 'confirmed')
    .map((fact) => fact.statement);
  const rumors = memory.facts
    .filter((fact) => fact.truthStatus === 'rumor')
    .map((fact) => fact.statement);
  const beliefs = memory.beliefs.map((belief) => `${belief.stance}: ${belief.statement}`);
  const recentEvents = memory.events.map((event) => event.summary);

  return `
Runtime memory:
Player knowledge:
${bulletList(memory.playerKnowledge)}
Confirmed world facts:
${bulletList(confirmedFacts)}
Rumors:
${bulletList(rumors)}
This NPC believes:
${bulletList(beliefs)}
Recent events:
${bulletList(recentEvents)}`;
}

export function buildNpcUserPrompt(context: NpcUserPromptContext): string {
  const memoriesText = context.memories.join('\n') || '（无）';

  const archiveSection = context.archiveSummary
    ? `\n长期记忆摘要：${context.archiveSummary}`
    : '';

  const codexSection = context.relevantCodex?.length
    ? `\n当前相关世界知识：\n${context.relevantCodex.map((c) => `- ${c}`).join('\n')}`
    : '';

  const ecologicalMemorySection = formatEcologicalMemory(context.ecologicalMemory);

  return `场景：${context.scene}
玩家动作：${context.playerAction}
与玩家的接触次数：${context.encounterCount ?? 0} 次
你对这个玩家的记忆：${memoriesText}${archiveSection}${codexSection}${ecologicalMemorySection}
当前情绪倾向：${context.emotionHint ?? '中立'}
请以角色身份回应。`;
}
