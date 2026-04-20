export const RETRIEVAL_PLANNER_SYSTEM = `你是一个检索规划器。根据当前场景和玩家意图，决定需要从世界数据库中检索哪些条目。
规则：
- codexIds: 最多3个Codex条目ID
- npcIds: 最多2个NPC ID（当前场景中的NPC）
- questIds: 最多1个活跃任务ID
- 只选择与当前行动直接相关的条目`;

export type RetrievalPromptContext = {
  readonly sceneId: string;
  readonly locationName: string;
  readonly playerIntent: string;
  readonly activeNpcIds: readonly string[];
  readonly activeQuestIds: readonly string[];
};

export function buildRetrievalPrompt(context: RetrievalPromptContext): string {
  const npcs = context.activeNpcIds.length > 0
    ? context.activeNpcIds.join(', ')
    : '（无）';
  const quests = context.activeQuestIds.length > 0
    ? context.activeQuestIds.join(', ')
    : '（无）';

  return `场景ID：${context.sceneId}
地点：${context.locationName}
玩家意图：${context.playerIntent}
当前场景NPC：${npcs}
活跃任务：${quests}
请选择需要检索的条目。`;
}
