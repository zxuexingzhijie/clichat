import type { EcologicalMemoryContext } from '../utils/ecological-memory-retriever';

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

export type NarrativePromptContext = {
  readonly storyAct: 'act1' | 'act2' | 'act3';
  readonly atmosphereTags: readonly string[];
  readonly recentNarration?: readonly string[];
  readonly ecologicalMemory?: EcologicalMemoryContext;
};

const ACT_TONE_GUIDANCE: Record<string, string> = {
  act1: '第一幕提示：场景是日常的，但有轻微不安。避免惊悚语气，保持克制。',
  act2: '第二幕提示：读者已知出了什么问题，但细节还不清楚。用悬疑和信息空缺制造张力。',
  act3: '第三幕提示：玩家掌握了真相。场景描述可带沉重感——同样的地方，已有不同的含义。',
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
  const recentEvents = memory.events.map((event) => event.summary);

  return `\nRuntime world memory:\nConfirmed world facts:\n${bulletList(confirmedFacts)}\nLocal rumors:\n${bulletList(rumors)}\nRecent relevant events:\n${bulletList(recentEvents)}\nRules for runtime world memory:\n- Keep authored codex world truth distinct from runtime world facts.\n- Treat confirmed world facts as runtime truth.\n- Treat local rumors as uncertain and avoid narrating them as confirmed.`;
}

export function buildNarrativeSystemPrompt(
  sceneType: SceneType,
  narrativeContext?: NarrativePromptContext,
): string {
  const config = SCENE_STYLES[sceneType];
  const base = `你是一个中文奇幻RPG游戏的叙述者。
${CORE_CONSTRAINTS}
- 视角：${config.perspective}
- 风格：${config.style}`;

  if (!narrativeContext) return base;

  const actLabel = { act1: '第一幕', act2: '第二幕', act3: '第三幕' }[narrativeContext.storyAct];
  const atmosphereStr = narrativeContext.atmosphereTags.join('、');
  const toneGuidance = ACT_TONE_GUIDANCE[narrativeContext.storyAct] ?? '';

  const narrativeParagraph = `\n当前叙事氛围：${atmosphereStr}（用这些词语的语气和意象）\n故事进程：${actLabel}\n${toneGuidance}`;

  const recentSection = narrativeContext.recentNarration?.length
    ? `\n最近叙述（保持语气和意象的连贯性，避免重复同一词语）：\n${narrativeContext.recentNarration.slice(-3).join('\n')}`
    : '';

  const ecologicalMemorySection = formatEcologicalMemory(narrativeContext.ecologicalMemory);

  return base + narrativeParagraph + recentSection + ecologicalMemorySection;
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
