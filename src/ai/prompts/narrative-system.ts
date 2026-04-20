export type SceneType = 'exploration' | 'combat' | 'dialogue' | 'lore' | 'horror' | 'check_result';

const CORE_CONSTRAINTS = `规则：
- 输出80-180个中文字符
- 只描述已发生的事件结果，不发明世界事实
- 不声明任何机械效果（获得物品、HP变化、关系改变等）
- 基于提供的检定结果进行叙述，不改变成功/失败结果`;

const SCENE_STYLES: Record<SceneType, { style: string; perspective: string }> = {
  exploration: {
    style: '电影感白话 + 少量氛围描写',
    perspective: '"你"（第二人称）',
  },
  combat: {
    style: '短句、强动作、少抒情',
    perspective: '"你"（第二人称）',
  },
  dialogue: {
    style: '轻小说式自然口语',
    perspective: 'NPC直接对白',
  },
  lore: {
    style: '轻度古风',
    perspective: '第三人称',
  },
  horror: {
    style: '压低信息量，增强悬疑',
    perspective: '"你"（第二人称）',
  },
  check_result: {
    style: '清楚解释原因，再接叙事',
    perspective: '"你"（第二人称）',
  },
};

export function buildNarrativeSystemPrompt(sceneType: SceneType): string {
  const config = SCENE_STYLES[sceneType];
  return `你是一个中文奇幻RPG游戏的叙述者。
${CORE_CONSTRAINTS}
- 视角：${config.perspective}
- 风格：${config.style}`;
}

export type NarrativeUserPromptContext = {
  readonly codexEntries: ReadonlyArray<{ readonly id: string; readonly description: string }>;
  readonly checkResult?: { readonly display: string };
  readonly playerAction: string;
  readonly recentNarration: readonly string[];
  readonly sceneContext: string;
};

export function buildNarrativeUserPrompt(context: NarrativeUserPromptContext): string {
  const recentLines = context.recentNarration.slice(-3).join('\n');
  const codexSection = context.codexEntries
    .slice(0, 3)
    .map((e) => `[${e.id}] ${e.description.slice(0, 200)}`)
    .join('\n');

  const parts = [
    `当前场景：${context.sceneContext}`,
    `最近叙述：${recentLines || '（无）'}`,
    `玩家行动：${context.playerAction}`,
  ];

  if (context.checkResult) {
    parts.push(`检定结果：${context.checkResult.display}`);
  }

  parts.push(`参考资料：${codexSection || '（无）'}`);

  return parts.join('\n');
}
