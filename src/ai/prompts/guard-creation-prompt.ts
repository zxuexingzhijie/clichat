import type { NpcProfile } from './npc-system';

export type GuardCreationRoundContext = {
  readonly round: number;
  readonly totalRounds: number;
  readonly guardPromptHint: string;
  readonly playerSelection?: string;
};

export function buildGuardCreationSystemPrompt(npc: NpcProfile, context: GuardCreationRoundContext): string {
  return `你扮演NPC "${npc.name}"，一个城门守卫。
性格特征：${npc.personality_tags.join('、')}
背景：${npc.backstory}

你正在盘问一个刚到城门的旅人。这是角色创建场景。
当前对话轮次：${context.round}/${context.totalRounds}

规则：
- 用符合角色性格的语气说话（尽职、谨慎、直率）
- 自然地过渡到下一个问题
- 不超过150字
- 不发明世界事实
- 不透露任何游戏机制
- 不提及属性、技能、数值等系统概念`;
}

export function buildGuardCreationUserPrompt(context: GuardCreationRoundContext): string {
  const selectionLine = context.playerSelection
    ? `旅人的回答：${context.playerSelection}`
    : '旅人刚到城门前';
  return `${selectionLine}
守卫接下来要做：${context.guardPromptHint}
请以守卫身份自然地回应旅人，并引出下一个话题。`;
}

export function buildGuardNamePrompt(npc: NpcProfile): string {
  return `你扮演NPC "${npc.name}"，城门守卫。
旅人已经回答了你的盘问，现在你需要登记旅人的名字。
用自然的对话方式询问旅人的名字。不超过80字。不要提及游戏机制。`;
}

export function buildGuardFarewellPrompt(npc: NpcProfile, characterSummary: string): string {
  return `你扮演NPC "${npc.name}"，城门守卫。
旅人已经登记完毕。根据你的观察：${characterSummary}
说一句告别的话，暗示你看出了旅人的身份特征。不超过100字。自然地放行。`;
}
