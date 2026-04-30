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

export type NpcProfile = {
  readonly id: string;
  readonly name: string;
  readonly personality_tags: readonly string[];
  readonly goals: readonly string[];
  readonly backstory: string;
  readonly knowledgeProfile?: NpcKnowledgeProfile;
};

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

  const result = (() => {
    if (!npc.knowledgeProfile) return base;

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

    return base + '\n\n' + disclosureLines.join('\n');
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
  readonly emotionHint?: string;
  readonly archiveSummary?: string;
  readonly relevantCodex?: readonly string[];
};

export function buildNpcUserPrompt(context: NpcUserPromptContext): string {
  const memoriesText = context.memories.slice(0, 8).join('\n') || '（无）';

  const archiveSection = context.archiveSummary
    ? `\n长期记忆摘要：${context.archiveSummary}`
    : '';

  const codexSection = context.relevantCodex?.length
    ? `\n当前相关世界知识：\n${context.relevantCodex.map((c) => `- ${c}`).join('\n')}`
    : '';

  return `场景：${context.scene}
玩家动作：${context.playerAction}
你对这个玩家的记忆：${memoriesText}${archiveSection}${codexSection}
当前情绪倾向：${context.emotionHint ?? '中立'}
请以角色身份回应。`;
}
