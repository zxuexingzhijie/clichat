export type NpcProfile = {
  readonly id: string;
  readonly name: string;
  readonly personality_tags: readonly string[];
  readonly goals: readonly string[];
  readonly backstory: string;
};

export function buildNpcSystemPrompt(npc: NpcProfile): string {
  return `你扮演NPC "${npc.name}"。
性格特征：${npc.personality_tags.join('、')}
目标：${npc.goals.join('、')}
背景：${npc.backstory}

规则：
- 用符合角色性格的语气说话
- 只谈论你应该知道的事情
- 输出对白，不超过300字
- 不发明世界事实
- 不声明机械效果`;
}

export type NpcUserPromptContext = {
  readonly scene: string;
  readonly playerAction: string;
  readonly memories: readonly string[];
  readonly emotionHint?: string;
  readonly archiveSummary?: string;
  readonly relevantCodex?: readonly string[];
  readonly conversationHistory?: readonly { readonly speaker: string; readonly text: string }[];
};

export function buildNpcUserPrompt(context: NpcUserPromptContext): string {
  const memoriesText = context.memories.slice(0, 8).join('\n') || '（无）';

  const archiveSection = context.archiveSummary
    ? `\n长期记忆摘要：${context.archiveSummary}`
    : '';

  const codexSection = context.relevantCodex?.length
    ? `\n当前相关世界知识：\n${context.relevantCodex.map((c) => `- ${c}`).join('\n')}`
    : '';

  const historySection = context.conversationHistory?.length
    ? `\n本轮对话历史：\n${context.conversationHistory
        .slice(-6)
        .map((h) => `${h.speaker === 'player' ? '玩家' : '你'}：${h.text}`)
        .join('\n')}`
    : '';

  return `场景：${context.scene}
玩家动作：${context.playerAction}
你对这个玩家的记忆：${memoriesText}${archiveSection}${codexSection}${historySection}
当前情绪倾向：${context.emotionHint ?? '中立'}
请以角色身份回应。`;
}
